# 固定部署参数补写去重台账

A：先补；B：固定部署常用；C：按场景补；D：其他路径/升级。一个单元是一份共享说明，不代表一个独立运行参数；各 API/CLI/配置默认在 JSON 中保留。拟新增页没有创建。

| 单元 | 批次 | 参数身份 | 内容主页面 | 原记录数 | 原记录 ID |
|---|---|---|---|---:|---|
| W0501 | A1 | `text.request.presence_penalty` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2440, P2487, P2543, P3728 |
| W0481 | A1 | `text.request.frequency_penalty` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2424, P2468, P2530, P3716 |
| W0511 | A1 | `text.request.repetition_penalty` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2442, P2492, P2549, P3731 |
| W0488 | A1 | `text.request.logit_bias` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2429, P2474, P2535, P3719 |
| W0468 | A1 | `text.request.allowed_token_ids` | [sampling](../../../wiki/concepts/sampling.md) | 3 | P2459, P2525, P3711 |
| W0469 | A1 | `text.request.bad_words` | [sampling](../../../wiki/concepts/sampling.md) | 2 | P2460, P3712 |
| W0491 | A2 | `text.request.max_tokens` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 6 | P2432, P2433, P2477, P2478, P2538, P3722 |
| W0495 | A2 | `text.request.min_tokens` | [sampling](../../../wiki/concepts/sampling.md) | 3 | P2482, P2540, P3724 |
| W0522 | A2 | `text.request.stop` | [request-teardown](../../../wiki/concepts/request-teardown.md) | 4 | P2448, P2505, P2560, P3738 |
| W0523 | A2 | `text.request.stop_token_ids` | [request-teardown](../../../wiki/concepts/request-teardown.md) | 3 | P2506, P2561, P3739 |
| W0483 | A2 | `text.request.ignore_eos` | [request-teardown](../../../wiki/concepts/request-teardown.md) | 3 | P2469, P2531, P3717 |
| W0494 | B1 | `text.request.min_p` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2436, P2481, P2539, P3723 |
| W0518 | B1 | `text.request.seed` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2447, P2501, P2556, P3733 |
| W0539 | B1 | `text.request.temperature` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2450, P2511, P2567, P3742 |
| W0543 | B1 | `text.request.top_k` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2452, P2515, P2569, P3744 |
| W0545 | B1 | `text.request.top_p` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2454, P2517, P2570, P3745 |
| W1582 | B1 | `vllm.startup.generation_config` | [sampling](../../../wiki/concepts/sampling.md) | 3 | P0814, P1384, P1737 |
| W1662 | B1 | `vllm.startup.override_generation_config` | [sampling](../../../wiki/concepts/sampling.md) | 3 | P0906, P1478, P1774 |
| W1685 | B1 | `vllm.startup.seed` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P0935, P1507, P1782, P3677 |
| W1515 | B2 | `vllm.startup.block_size` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0732, P1302, P1556 |
| W1546 | B2 | `vllm.startup.disable_hybrid_kv_cache_manager` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0767, P1337, P1964 |
| W1583 | B2 | `vllm.startup.gpu_memory_utilization` | [kv-cache-memory-profiling](../../../wiki/concepts/kv-cache-memory-profiling.md) | 4 | P0815, P1385, P1561, P3659 |
| W1592 | B2 | `vllm.startup.kv_cache_dtype` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0828, P1398, P1557 |
| W1594 | B2 | `vllm.startup.kv_cache_memory_bytes` | [kv-cache-memory-profiling](../../../wiki/concepts/kv-cache-memory-profiling.md) | 4 | P0830, P1400, P1567, P3662 |
| W1612 | B2 | `vllm.startup.mamba_block_size` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0848, P1418, P1572 |
| W1614 | B2 | `vllm.startup.mamba_cache_mode` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0850, P1420, P1574 |
| W1625 | B2 | `vllm.startup.max_model_len` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 4 | P0862, P1433, P1750, P1971 |
| W1650 | B2 | `vllm.startup.num_gpu_blocks_override` | [kv-cache-memory-profiling](../../../wiki/concepts/kv-cache-memory-profiling.md) | 3 | P0894, P1466, P1579 |
| W1512 | B3 | `vllm.startup.async_scheduling` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0729, P1299, P1962 |
| W1555 | B3 | `vllm.startup.enable_chunked_prefill` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0780, P1350, P1965 |
| W1608 | B3 | `vllm.startup.long_prefill_token_threshold` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0844, P1414, P1969 |
| W1622 | B3 | `vllm.startup.max_long_partial_prefills` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0859, P1430, P1970 |
| W1626 | B3 | `vllm.startup.max_num_batched_tokens` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0863, P1434, P1972 |
| W1627 | B3 | `vllm.startup.max_num_partial_prefills` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0864, P1435, P1974 |
| W1628 | B3 | `vllm.startup.max_num_seqs` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0868, P1439, P1978 |
| W1682 | B3 | `vllm.startup.scheduler_cls` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0932, P1504, P1982 |
| W1683 | B3 | `vllm.startup.scheduler_reserve_full_isl` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0933, P1505, P1983 |
| W1684 | B3 | `vllm.startup.scheduling_policy` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0934, P1506, P1979 |
| W1336 | B4 | `vllm.compilation.cudagraph_capture_sizes` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 3 | P0743, P1313, P1597 |
| W1339 | B4 | `vllm.compilation.cudagraph_mode` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1600 |
| W1355 | B4 | `vllm.compilation.max_cudagraph_capture_size` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 3 | P0857, P1428, P1617 |
| W1519 | B4 | `vllm.startup.compilation_config` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 4 | P0736, P1306, P2036, P3652 |
| W1576 | B4 | `vllm.startup.enforce_eager` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 4 | P0806, P1376, P1736, P3658 |
| W1484 | B5 | `vllm.speculative.enforce_eager` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P1997 |
| W1486 | B5 | `vllm.speculative.method` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 2 | P0941, P2001 |
| W1487 | B5 | `vllm.speculative.model` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 2 | P0942, P2002 |
| W1489 | B5 | `vllm.speculative.num_speculative_tokens` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 2 | P0943, P2004 |
| W1695 | B5 | `vllm.startup.speculative_config` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 3 | P0945, P1517, P2060 |
| W0091 | B6 | `env.ASCEND_RT_VISIBLE_DEVICES` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P4582, P4601, P4637 |
| W0249 | B6 | `env.VLLM_ENABLE_V1_MULTIPROCESSING` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P2995, P3360, P3601 |
| W0266 | B6 | `env.VLLM_HOST_IP` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 2 | P3016, P3375 |
| W0328 | B6 | `env.VLLM_PORT` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 2 | P3100, P3454 |
| W0434 | B6 | `env.VLLM_WORKER_MULTIPROC_METHOD` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 4 | P3217, P3249, P3261, P3629 |
| W1410 | B6 | `vllm.frontend.api_server_count` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P0987 |
| W1439 | B6 | `vllm.frontend.headless` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P0990 |
| W1527 | B6 | `vllm.startup.data_parallel_address` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 2 | P0745, P1315 |
| W1532 | B6 | `vllm.startup.data_parallel_rank` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0750, P1320, P1877 |
| W1533 | B6 | `vllm.startup.data_parallel_rpc_port` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0751, P1321, P1879 |
| W1534 | B6 | `vllm.startup.data_parallel_size` | [data-parallel](../../../wiki/concepts/data-parallel.md) | 3 | P0752, P1322, P1880 |
| W1535 | B6 | `vllm.startup.data_parallel_size_local` | [data-parallel](../../../wiki/concepts/data-parallel.md) | 3 | P0753, P1323, P1881 |
| W1536 | B6 | `vllm.startup.data_parallel_start_rank` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 2 | P0754, P1324 |
| W1550 | B6 | `vllm.startup.distributed_executor_backend` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0771, P1341, P1890 |
| W1561 | B6 | `vllm.startup.enable_expert_parallel` | [expert-parallel](../../../wiki/concepts/expert-parallel.md) | 3 | P0786, P1356, P1898 |
| W1698 | B6 | `vllm.startup.tensor_parallel_size` | [tensor-parallel](../../../wiki/concepts/tensor-parallel.md) | 4 | P0948, P1520, P1919, P3683 |
| W0475 | B7 | `text.request.detokenize` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 1 | P3713 |
| W0485 | B7 | `text.request.include_stop_str_in_output` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 4 | P2427, P2471, P2532, P3718 |
| W0498 | B7 | `text.request.n` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 4 | P2439, P2485, P2542, P3725 |
| W0499 | B7 | `text.request.output_kind` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 1 | P3726 |
| W0520 | B7 | `text.request.skip_special_tokens` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 3 | P2503, P2558, P3736 |
| W0521 | B7 | `text.request.spaces_between_special_tokens` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 3 | P2504, P2559, P3737 |
| W0524 | B7 | `text.request.stream` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 2 | P2507, P2562 |
| W0525 | B7 | `text.request.stream_options` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 2 | P2509, P2564 |
| W0526 | B7 | `text.request.stream_options.continuous_usage_stats` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 1 | P2201 |
| W0527 | B7 | `text.request.stream_options.include_usage` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 1 | P2202 |
| W1696 | B7 | `vllm.startup.stream_interval` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 3 | P0946, P1518, P1984 |
| W0480 | B8 | `text.request.flat_logprobs` | [sampling](../../../wiki/concepts/sampling.md) | 1 | P3715 |
| W0489 | B8 | `text.request.logprob_token_ids` | [sampling](../../../wiki/concepts/sampling.md) | 1 | P3720 |
| W0490 | B8 | `text.request.logprobs` | [sampling](../../../wiki/concepts/sampling.md) | 4 | P2431, P2476, P2537, P3721 |
| W0505 | B8 | `text.request.prompt_logprobs` | [prefill](../../../wiki/concepts/prefill.md) | 3 | P2489, P2547, P3729 |
| W0544 | B8 | `text.request.top_logprobs` | [sampling](../../../wiki/concepts/sampling.md) | 2 | P2453, P2516 |
| W1607 | B8 | `vllm.startup.logprobs_mode` | [sampling](../../../wiki/concepts/sampling.md) | 3 | P0843, P1413, P1748 |
| W1621 | B8 | `vllm.startup.max_logprobs` | [sampling](../../../wiki/concepts/sampling.md) | 3 | P0858, P1429, P1749 |
| W0028 | B9 | `ascend.additional_config.ascend_compilation_config` | [npugraph-ex](../../../wiki/concepts/npugraph-ex.md) | 7 | P3870, P3953, P3961, P4272, P4463, P4502, P4506 |
| W0029 | B9 | `ascend.additional_config.ascend_compilation_config.fuse_muls_add` | [npugraph-ex](../../../wiki/concepts/npugraph-ex.md) | 2 | P3944, P3963 |
| W0030 | B9 | `ascend.additional_config.ascend_compilation_config.fuse_norm_quant` | [npugraph-ex](../../../wiki/concepts/npugraph-ex.md) | 1 | P3964 |
| W0031 | B9 | `ascend.additional_config.ascend_compilation_config.fuse_qknorm_rope` | [npugraph-ex](../../../wiki/concepts/npugraph-ex.md) | 1 | P3965 |
| W0078 | B9 | `ascend.additional_config.weight_nz_mode` | [tensor-layout](../../../wiki/concepts/tensor-layout.md) | 3 | P3918, P4572, P4619 |
| W1411 | B10 | `vllm.frontend.chat_template` | [token](../../../wiki/concepts/token.md) | 3 | P0077, P2840, P3651 |
| W1412 | B10 | `vllm.frontend.chat_template_content_format` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 2 | P0078, P2841 |
| W1413 | B10 | `vllm.frontend.config` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P0988 |
| W1440 | B10 | `vllm.frontend.host` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2883 |
| W1446 | B10 | `vllm.frontend.port` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2885 |
| W1459 | B10 | `vllm.frontend.trust_request_chat_template` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 2 | P0079, P2864 |
| W1553 | B10 | `vllm.startup.dtype` | [quantization](../../../wiki/concepts/quantization.md) | 4 | P0775, P1345, P1728, P3656 |
| W1605 | B10 | `vllm.startup.load_format` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0841, P1411, P1698 |
| W1643 | B10 | `vllm.startup.model` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 4 | P0887, P1458, P1768, P3665 |
| W1670 | B10 | `vllm.startup.quantization` | [quantization](../../../wiki/concepts/quantization.md) | 4 | P0918, P1490, P1776, P3672 |
| W1686 | B10 | `vllm.startup.served_model_name` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 3 | P0936, P1508, P1783 |
| W1699 | B10 | `vllm.startup.tokenizer` | [token](../../../wiki/concepts/token.md) | 4 | P0949, P1521, P1788, P3684 |
| W1700 | B10 | `vllm.startup.tokenizer_mode` | [token](../../../wiki/concepts/token.md) | 4 | P0950, P1522, P1789, P3685 |
| W0513 | C1 | `text.request.response_format` | [structured-output](../../../wiki/concepts/structured-output.md) | 3 | P2444, P2494, P2551 |
| W0528 | C1 | `text.request.structured_outputs` | [structured-output](../../../wiki/concepts/structured-output.md) | 4 | P2449, P2510, P2565, P3741 |
| W0529 | C1 | `text.request.structured_outputs.choice` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P3748 |
| W0530 | C1 | `text.request.structured_outputs.disable_additional_properties` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P3749 |
| W0531 | C1 | `text.request.structured_outputs.disable_any_whitespace` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P3750 |
| W0532 | C1 | `text.request.structured_outputs.grammar` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P3751 |
| W0533 | C1 | `text.request.structured_outputs.json` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P3752 |
| W0534 | C1 | `text.request.structured_outputs.json_object` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P3753 |
| W0535 | C1 | `text.request.structured_outputs.regex` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P3754 |
| W0536 | C1 | `text.request.structured_outputs.structural_tag` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P3755 |
| W0537 | C1 | `text.request.structured_outputs.whitespace_pattern` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P3756 |
| W0541 | C1 | `text.request.tool_choice` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P2513 |
| W0027 | C2 | `ascend.additional_config.SLO_limits_for_dynamic_batch` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4462 |
| W0032 | C2 | `ascend.additional_config.ascend_fusion_config` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 3 | P3871, P4273, P4464 |
| W0035 | C2 | `ascend.additional_config.dp_allreduce_on_npu` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3874, P4467 |
| W0038 | C2 | `ascend.additional_config.enable_balance_scheduling` | [balance-scheduling](../../../wiki/concepts/balance-scheduling.md) | 5 | P3878, P4230, P4566, P4613, P4630 |
| W0039 | C2 | `ascend.additional_config.enable_dsa_cp` | [context-parallel](../../../wiki/concepts/context-parallel.md) | 1 | P4415 |
| W0040 | C2 | `ascend.additional_config.enable_flashcomm1` | [sequence-parallel](../../../wiki/concepts/sequence-parallel.md) | 4 | P3880, P4416, P4568, P4615 |
| W0041 | C2 | `ascend.additional_config.enable_flashcomm2_parallel_size` | [sequence-parallel](../../../wiki/concepts/sequence-parallel.md) | 3 | P3881, P4573, P4620 |
| W0042 | C2 | `ascend.additional_config.enable_fused_mc2` | [expert-parallel](../../../wiki/concepts/expert-parallel.md) | 3 | P3882, P4569, P4616 |
| W0044 | C2 | `ascend.additional_config.enable_kv_nz` | [tensor-layout](../../../wiki/concepts/tensor-layout.md) | 2 | P3883, P4472 |
| W0045 | C2 | `ascend.additional_config.enable_mc2_hierarchy_comm` | [expert-parallel](../../../wiki/concepts/expert-parallel.md) | 2 | P3886, P4474 |
| W0046 | C2 | `ascend.additional_config.enable_mlapo` | [mla](../../../wiki/concepts/mla.md) | 3 | P3887, P4571, P4618 |
| W0047 | C2 | `ascend.additional_config.enable_prefill_mc2` | [expert-parallel](../../../wiki/concepts/expert-parallel.md) | 2 | P3888, P4475 |
| W0048 | C2 | `ascend.additional_config.enable_reduce_sample` | [sampling](../../../wiki/concepts/sampling.md) | 2 | P3889, P4476 |
| W0049 | C2 | `ascend.additional_config.enable_shared_expert_dp` | [expert-parallel](../../../wiki/concepts/expert-parallel.md) | 2 | P3890, P4477 |
| W0051 | C2 | `ascend.additional_config.enable_sparse_li_c8` | [kv-cache-quantization](../../../wiki/concepts/kv-cache-quantization.md) | 2 | P3893, P4479 |
| W0052 | C2 | `ascend.additional_config.enable_sparse_sfa_c8` | [kv-cache-quantization](../../../wiki/concepts/kv-cache-quantization.md) | 2 | P3894, P4480 |
| W0053 | C2 | `ascend.additional_config.enable_transpose_kv_cache_by_block` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P3895, P4574, P4621 |
| W0054 | C2 | `ascend.additional_config.eplb_config` | [eplb](../../../wiki/concepts/eplb.md) | 4 | P3896, P4151, P4481, P4541 |
| W0055 | C2 | `ascend.additional_config.eplb_config.dynamic_eplb` | [eplb](../../../wiki/concepts/eplb.md) | 2 | P3945, P4153 |
| W0056 | C2 | `ascend.additional_config.eplb_config.expert_map_record_path` | [eplb](../../../wiki/concepts/eplb.md) | 1 | P4154 |
| W0057 | C2 | `ascend.additional_config.eplb_config.num_redundant_experts` | [eplb](../../../wiki/concepts/eplb.md) | 1 | P3946 |
| W0058 | C2 | `ascend.additional_config.finegrained_tp_config` | [fine-grained-tp](../../../wiki/concepts/fine-grained-tp.md) | 2 | P3897, P4482 |
| W0059 | C2 | `ascend.additional_config.finegrained_tp_config.embedding_tensor_parallel_size` | [fine-grained-tp](../../../wiki/concepts/fine-grained-tp.md) | 1 | P3939 |
| W0060 | C2 | `ascend.additional_config.finegrained_tp_config.lmhead_tensor_parallel_size` | [fine-grained-tp](../../../wiki/concepts/fine-grained-tp.md) | 1 | P3940 |
| W0061 | C2 | `ascend.additional_config.finegrained_tp_config.mlp_tensor_parallel_size` | [fine-grained-tp](../../../wiki/concepts/fine-grained-tp.md) | 1 | P3941 |
| W0062 | C2 | `ascend.additional_config.finegrained_tp_config.olora_tensor_parallel_size` | [fine-grained-tp](../../../wiki/concepts/fine-grained-tp.md) | 1 | P3942 |
| W0063 | C2 | `ascend.additional_config.finegrained_tp_config.oproj_tensor_parallel_size` | [fine-grained-tp](../../../wiki/concepts/fine-grained-tp.md) | 1 | P3943 |
| W0065 | C2 | `ascend.additional_config.mega_moe_max_tokens` | [expert-parallel](../../../wiki/concepts/expert-parallel.md) | 2 | P3902, P4486 |
| W0066 | C2 | `ascend.additional_config.mix_placement` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3903, P4487 |
| W0069 | C2 | `ascend.additional_config.multistream_overlap_shared_expert` | [expert-parallel](../../../wiki/concepts/expert-parallel.md) | 2 | P3907, P4490 |
| W0070 | C2 | `ascend.additional_config.pa_shape_list` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3909, P4491 |
| W0071 | C2 | `ascend.additional_config.recompute_scheduler_enable` | [recompute-scheduler](../../../wiki/concepts/recompute-scheduler.md) | 2 | P3913, P4493 |
| W0072 | C2 | `ascend.additional_config.refresh` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 4 | P3914, P4417, P4494, P4553 |
| W0073 | C2 | `ascend.additional_config.rejection_sampler_config` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 2 | P3915, P4495 |
| W0074 | C2 | `ascend.additional_config.rejection_sampler_config.enable_block_verify` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P3925 |
| W0075 | C2 | `ascend.additional_config.rejection_sampler_config.enable_entropy_verify` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P3926 |
| W0076 | C2 | `ascend.additional_config.rejection_sampler_config.posterior_alpha` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P3933 |
| W0077 | C2 | `ascend.additional_config.rejection_sampler_config.posterior_threshold` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P3934 |
| W0079 | C2 | `ascend.additional_config.xlite_graph_config` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 2 | P3920, P4500 |
| W0080 | C2 | `ascend.additional_config.xlite_graph_config.enabled` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P3958 |
| W0081 | C2 | `ascend.additional_config.xlite_graph_config.full_mode` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P3959 |
| W0001 | C3 | `ascend.AscendStore.extra_config.backend` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 6 | P4079, P4115, P4121, P4512, P4520, P4526 |
| W0002 | C3 | `ascend.AscendStore.extra_config.consumer_is_to_load` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4116, P4521 |
| W0003 | C3 | `ascend.AscendStore.extra_config.consumer_is_to_put` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 6 | P4080, P4117, P4122, P4513, P4522, P4527 |
| W0004 | C3 | `ascend.AscendStore.extra_config.h2d_stagger_us` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4123, P4528 |
| W0005 | C3 | `ascend.AscendStore.extra_config.layerwise_max_transfer_blocks` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4124, P4529 |
| W0006 | C3 | `ascend.AscendStore.extra_config.layerwise_max_transfer_bytes` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4125, P4530 |
| W0007 | C3 | `ascend.AscendStore.extra_config.layerwise_prefetch_layers` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4129, P4534 |
| W0008 | C3 | `ascend.AscendStore.extra_config.load_async` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 4 | P4119, P4126, P4524, P4531 |
| W0009 | C3 | `ascend.AscendStore.extra_config.lookup_rpc_port` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4113 |
| W0010 | C3 | `ascend.AscendStore.extra_config.mooncake_rpc_port` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4114 |
| W0011 | C3 | `ascend.AscendStore.extra_config.prefill_pp_layer_partition` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4127, P4532 |
| W0012 | C3 | `ascend.AscendStore.extra_config.prefill_pp_size` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4128, P4533 |
| W0013 | C3 | `ascend.AscendStore.extra_config.save_decode_cache` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4120, P4525 |
| W0014 | C3 | `ascend.MooncakeStoreConfig.device_name` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4083 |
| W0015 | C3 | `ascend.MooncakeStoreConfig.enable_ssd_offload` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4084 |
| W0016 | C3 | `ascend.MooncakeStoreConfig.global_segment_size` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4085 |
| W0017 | C3 | `ascend.MooncakeStoreConfig.local_buffer_size` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4086 |
| W0018 | C3 | `ascend.MooncakeStoreConfig.master_server_address` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4087 |
| W0019 | C3 | `ascend.MooncakeStoreConfig.metadata_server` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4088 |
| W0020 | C3 | `ascend.MooncakeStoreConfig.prefer_alloc_in_same_node` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4089 |
| W0021 | C3 | `ascend.MooncakeStoreConfig.preferred_segment` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4090 |
| W0022 | C3 | `ascend.MooncakeStoreConfig.protocol` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4091 |
| W0023 | C3 | `ascend.MooncakeStoreConfig.ssd_offload_path` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4092 |
| W0024 | C3 | `ascend.YuanrongConfig.enable_exclusive_connection` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4099 |
| W0025 | C3 | `ascend.YuanrongConfig.enable_remote_h2d` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4101 |
| W0026 | C3 | `ascend.YuanrongConfig.worker_addr` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4106 |
| W0759 | C3 | `vllm-ascend.vllm_ascend/ascend_config.py::vllm_config.kv_transfer_config.get_from_extra_config('decode', {'tp_size': 1}).tp_size` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P3955 |
| W0760 | C3 | `vllm-ascend.vllm_ascend/ascend_config.py::vllm_config.kv_transfer_config.get_from_extra_config('prefill', {'tp_size': 1}).tp_size` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P3956 |
| W0761 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::decode_parallel_config.dp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3983 |
| W0762 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::decode_parallel_config.pp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3984 |
| W0763 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::decode_parallel_config.tp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3985 |
| W0764 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.num_computed_tokens` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3987 |
| W0765 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.num_prompt_blocks` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3988 |
| W0766 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_block_ids` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3989 |
| W0767 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_block_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3990 |
| W0768 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_dcp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3991 |
| W0769 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_engine_id` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3992 |
| W0770 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_host` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3993 |
| W0771 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_multi_nodes_meta_mapping` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3994 |
| W0772 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_pcp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3995 |
| W0773 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_port` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3996 |
| W0774 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_ptp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3997 |
| W0775 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::kv_transfer_params.remote_request_id` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P3998 |
| W0776 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::params.do_remote_decode` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4001 |
| W0777 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::params.do_remote_prefill` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4002 |
| W0778 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::params.num_computed_tokens` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4003 |
| W0779 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::params.remote_block_ids` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4004 |
| W0780 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::prefill_parallel_config.dp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4005 |
| W0781 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::prefill_parallel_config.pp_layer_partition` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4006 |
| W0782 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::prefill_parallel_config.pp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4007 |
| W0783 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py::prefill_parallel_config.tp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4008 |
| W0784 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::decode_parallel_config.dp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4009 |
| W0785 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::decode_parallel_config.pp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4010 |
| W0786 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::decode_parallel_config.tp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4011 |
| W0787 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::kv_transfer_params.num_prompt_blocks` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4012 |
| W0788 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::kv_transfer_params.remote_block_ids` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4013 |
| W0789 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::kv_transfer_params.remote_engine_id` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4014 |
| W0790 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::kv_transfer_params.remote_host` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4015 |
| W0791 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::kv_transfer_params.remote_multi_nodes_meta_mapping` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4016 |
| W0792 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::kv_transfer_params.remote_port` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4018 |
| W0793 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::kv_transfer_params.remote_ptp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4019 |
| W0794 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::kv_transfer_params.remote_request_id` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4020 |
| W0795 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::params.do_remote_decode` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4021 |
| W0796 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::params.do_remote_prefill` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4022 |
| W0797 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::params.remote_block_ids` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4023 |
| W0798 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::prefill_parallel_config.dp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4024 |
| W0799 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::prefill_parallel_config.pp_layer_partition` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4025 |
| W0800 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::prefill_parallel_config.pp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4026 |
| W0801 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py::prefill_parallel_config.tp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4027 |
| W0802 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.do_virtual` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4028 |
| W0803 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.metaserver` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4029 |
| W0804 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_block_ids` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4030 |
| W0805 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_block_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4031 |
| W0806 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_dcp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4032 |
| W0807 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_engine_id` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4033 |
| W0808 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_host` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4034 |
| W0809 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_layer_metadata` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4035 |
| W0810 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_pcp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4036 |
| W0811 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_port` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4037 |
| W0812 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_te_rpc_port` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4038 |
| W0813 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::kv_transfer_params.remote_tp_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4039 |
| W0814 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::params.do_remote_decode` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4040 |
| W0815 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::params.do_remote_prefill` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4041 |
| W0816 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::params.do_virtual` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4042 |
| W0817 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::params.metaserver` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4043 |
| W0818 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::params.remote_cached_tokens` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4044 |
| W0819 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::request.kv_transfer_params.remote_block_ids` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4045 |
| W0820 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::request.kv_transfer_params.remote_cached_tokens` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4046 |
| W0821 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::tls_config.ssl_ca_certs` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4047 |
| W0822 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::tls_config.ssl_certfile` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4048 |
| W0823 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::tls_config.ssl_enable` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4049 |
| W0824 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::tls_config.ssl_keyfile` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4050 |
| W0825 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py::tls_config.ssl_keyfile_password` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P4051 |
| W0826 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_pool/cpu_offload/metadata.py::kv_transfer_config.kv_connector_extra_config.connectors` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4132, P4535 |
| W0827 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py::extra_config.cpu_bytes_to_use` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4137, P4538 |
| W0828 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py::extra_config.cpu_bytes_to_use_per_rank` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 1 | P4138 |
| W0829 | C3 | `vllm-ascend.vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py::extra_config.enable_offload_prefix_caching` | [kv-pool](../../../wiki/concepts/kv-pool.md) | 2 | P4139, P4539 |
| W0878 | C3 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.kv_transfer_params` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P2365 |
| W0965 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_buffer_device` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1651 |
| W0966 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_buffer_size` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1652 |
| W0967 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_connector` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1653 |
| W0968 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_connector_extra_config` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1654 |
| W0969 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_connector_module_path` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1655 |
| W0970 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_ip` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1656 |
| W0971 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_parallel_size` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1657 |
| W0972 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_port` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1658 |
| W0973 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_rank` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1659 |
| W0974 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.ec_role` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1660 |
| W0975 | C3 | `vllm.ECTransferConfig@vllm/config/ec_transfer.py.engine_id` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1661 |
| W0987 | C3 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.kv_transfer_params` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P2696 |
| W1012 | C3 | `vllm.KVEventsConfig@vllm/config/kv_events.py.buffer_steps` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1674 |
| W1013 | C3 | `vllm.KVEventsConfig@vllm/config/kv_events.py.enable_kv_cache_events` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1675 |
| W1014 | C3 | `vllm.KVEventsConfig@vllm/config/kv_events.py.endpoint` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1676 |
| W1015 | C3 | `vllm.KVEventsConfig@vllm/config/kv_events.py.hwm` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1677 |
| W1016 | C3 | `vllm.KVEventsConfig@vllm/config/kv_events.py.max_queue_size` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1678 |
| W1017 | C3 | `vllm.KVEventsConfig@vllm/config/kv_events.py.publisher` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1679 |
| W1018 | C3 | `vllm.KVEventsConfig@vllm/config/kv_events.py.replay_endpoint` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1680 |
| W1019 | C3 | `vllm.KVEventsConfig@vllm/config/kv_events.py.topic` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1681 |
| W1020 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.enable_permute_local_kv` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1682 |
| W1021 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.engine_id` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1683 |
| W1022 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_buffer_device` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1684 |
| W1023 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_buffer_size` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1685 |
| W1024 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_connector` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1686 |
| W1025 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_connector_extra_config` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1687 |
| W1026 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_connector_module_path` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1688 |
| W1027 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_ip` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1689 |
| W1028 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_load_failure_policy` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1690 |
| W1029 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_parallel_size` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1691 |
| W1030 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_port` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1692 |
| W1031 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_rank` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1693 |
| W1032 | C3 | `vllm.KVTransferConfig@vllm/config/kv_transfer.py.kv_role` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1694 |
| W1065 | C3 | `vllm.MooncakeStoreConfig@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py.device_name` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P0021 |
| W1066 | C3 | `vllm.MooncakeStoreConfig@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py.enable_offload` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P0022 |
| W1067 | C3 | `vllm.MooncakeStoreConfig@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py.global_segment_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P0023 |
| W1068 | C3 | `vllm.MooncakeStoreConfig@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py.local_buffer_size` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P0024 |
| W1069 | C3 | `vllm.MooncakeStoreConfig@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py.master_server_address` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P0025 |
| W1070 | C3 | `vllm.MooncakeStoreConfig@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py.metadata_server` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P0026 |
| W1071 | C3 | `vllm.MooncakeStoreConfig@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py.mode` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P0027 |
| W1072 | C3 | `vllm.MooncakeStoreConfig@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py.protocol` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P0028 |
| W1142 | C3 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.kv_transfer_params` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P2589 |
| W1303 | C3 | `vllm.cli@vllm/distributed/kv_transfer/kv_connector/v1/hf3fs/hf3fs_metadata_server.py.host` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P0721 |
| W1304 | C3 | `vllm.cli@vllm/distributed/kv_transfer/kv_connector/v1/hf3fs/hf3fs_metadata_server.py.port` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P0722 |
| W1384 | C3 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/lmcache_connector.py.use_layerwise` | [lmcache](../../../wiki/concepts/lmcache.md) | 1 | P1214 |
| W1385 | C3 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/rdma_utils.py.preferred_segment` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P1218 |
| W1386 | C3 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/connector.py.enable_cross_layers_blocks` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P1219 |
| W1393 | C3 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/multi_connector.py.connectors` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1248 |
| W1394 | C3 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/nixl/connector.py.enable_cross_layers_blocks` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1251 |
| W1395 | C3 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/simple_cpu_offload_connector.py.cpu_bytes_to_use` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1255 |
| W1396 | C3 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/simple_cpu_offload_connector.py.lazy_offload` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1260 |
| W1462 | C3 | `vllm.kv_transfer_config.kv_connector_extra_config@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/mooncake_connector.py.mooncake_protocol` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P1216 |
| W1463 | C3 | `vllm.kv_transfer_config.kv_connector_extra_config@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/mooncake_connector.py.num_workers` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P1217 |
| W1465 | C3 | `vllm.kv_transfer_config.kv_connector_extra_config@vllm/distributed/kv_transfer/kv_connector/v1/multi_connector.py.connectors` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1249 |
| W1601 | C3 | `vllm.startup.kv_transfer_config` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 3 | P0837, P1407, P2045 |
| W1710 | C3 | `vllm.vllm_config.kv_transfer_config.kv_connector_extra_config@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/scheduler.py.load_async` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P1226 |
| W1711 | C3 | `vllm.vllm_config.kv_transfer_config.kv_connector_extra_config@vllm/distributed/kv_transfer/kv_connector/v1/mooncake/store/worker.py.load_async` | [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 1 | P1236 |
| W1712 | C3 | `vllm.vllm_config.kv_transfer_config.kv_connector_extra_config@vllm/distributed/kv_transfer/kv_connector/v1/multi_connector.py.connectors` | [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 1 | P1250 |
| W1036 | C4 | `vllm.LoRAModulePath@vllm/entrypoints/openai/models/protocol.py.base_model_name` | [lora](../../../wiki/concepts/lora.md) | 1 | P2208 |
| W1037 | C4 | `vllm.LoRAModulePath@vllm/entrypoints/openai/models/protocol.py.is_3d_lora_weight` | [lora](../../../wiki/concepts/lora.md) | 1 | P2209 |
| W1038 | C4 | `vllm.LoRAModulePath@vllm/entrypoints/openai/models/protocol.py.name` | [lora](../../../wiki/concepts/lora.md) | 1 | P2210 |
| W1039 | C4 | `vllm.LoRAModulePath@vllm/entrypoints/openai/models/protocol.py.path` | [lora](../../../wiki/concepts/lora.md) | 1 | P2211 |
| W1041 | C4 | `vllm.LoadLoRAAdapterRequest@vllm/entrypoints/serve/lora/protocol.py.is_3d_lora_weight` | [lora](../../../wiki/concepts/lora.md) | 1 | P2704 |
| W1042 | C4 | `vllm.LoadLoRAAdapterRequest@vllm/entrypoints/serve/lora/protocol.py.load_inplace` | [lora](../../../wiki/concepts/lora.md) | 1 | P2705 |
| W1043 | C4 | `vllm.LoadLoRAAdapterRequest@vllm/entrypoints/serve/lora/protocol.py.lora_name` | [lora](../../../wiki/concepts/lora.md) | 1 | P2706 |
| W1044 | C4 | `vllm.LoadLoRAAdapterRequest@vllm/entrypoints/serve/lora/protocol.py.lora_path` | [lora](../../../wiki/concepts/lora.md) | 1 | P2707 |
| W1288 | C4 | `vllm.UnloadLoRAAdapterRequest@vllm/entrypoints/serve/lora/protocol.py.lora_int_id` | [lora](../../../wiki/concepts/lora.md) | 1 | P2708 |
| W1289 | C4 | `vllm.UnloadLoRAAdapterRequest@vllm/entrypoints/serve/lora/protocol.py.lora_name` | [lora](../../../wiki/concepts/lora.md) | 1 | P2709 |
| W1294 | C4 | `vllm.VllmConfig@vllm/config/vllm.py.lora_config` | [lora](../../../wiki/concepts/lora.md) | 1 | P2047 |
| W1443 | C4 | `vllm.frontend.lora_modules` | [lora](../../../wiki/concepts/lora.md) | 1 | P2856 |
| W1542 | C4 | `vllm.startup.default_mm_loras` | [lora](../../../wiki/concepts/lora.md) | 3 | P0761, P1331, P1705 |
| W1566 | C4 | `vllm.startup.enable_lora` | [lora](../../../wiki/concepts/lora.md) | 2 | P0792, P1361 |
| W1569 | C4 | `vllm.startup.enable_mixed_moe_lora_format` | [lora](../../../wiki/concepts/lora.md) | 3 | P0796, P1365, P1706 |
| W1575 | C4 | `vllm.startup.enable_tower_connector_lora` | [lora](../../../wiki/concepts/lora.md) | 3 | P0804, P1374, P1708 |
| W1580 | C4 | `vllm.startup.fully_sharded_loras` | [lora](../../../wiki/concepts/lora.md) | 3 | P0812, P1382, P1709 |
| W1609 | C4 | `vllm.startup.lora_dtype` | [lora](../../../wiki/concepts/lora.md) | 3 | P0845, P1415, P1710 |
| W1610 | C4 | `vllm.startup.lora_target_modules` | [lora](../../../wiki/concepts/lora.md) | 3 | P0846, P1416, P1715 |
| W1620 | C4 | `vllm.startup.max_cpu_loras` | [lora](../../../wiki/concepts/lora.md) | 3 | P0856, P1427, P1711 |
| W1623 | C4 | `vllm.startup.max_lora_rank` | [lora](../../../wiki/concepts/lora.md) | 3 | P0860, P1431, P1712 |
| W1624 | C4 | `vllm.startup.max_loras` | [lora](../../../wiki/concepts/lora.md) | 3 | P0861, P1432, P1713 |
| W1694 | C4 | `vllm.startup.specialize_active_lora` | [lora](../../../wiki/concepts/lora.md) | 3 | P0944, P1516, P1714 |
| W1301 | C5 | `vllm.WeightTransferConfig@vllm/config/weight_transfer.py.backend` | [vllm-ascend-for-rl](../../../wiki/concepts/vllm-ascend-for-rl.md) | 1 | P2068 |
| W1573 | C5 | `vllm.startup.enable_return_routed_experts` | [vllm-ascend-for-rl](../../../wiki/concepts/vllm-ascend-for-rl.md) | 4 | P0802, P1372, P1733, P3657 |
| W1574 | C5 | `vllm.startup.enable_sleep_mode` | [vllm-ascend-for-rl](../../../wiki/concepts/vllm-ascend-for-rl.md) | 3 | P0803, P1373, P1734 |
| W1707 | C5 | `vllm.startup.weight_transfer_config` | [vllm-ascend-for-rl](../../../wiki/concepts/vllm-ascend-for-rl.md) | 3 | P0961, P1534, P2063 |
| W0033 | C6 | `ascend.additional_config.ascend_log_path` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 2 | P3872, P4465 |
| W0036 | C6 | `ascend.additional_config.dump_config` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 2 | P3875, P4468 |
| W0037 | C6 | `ascend.additional_config.dump_config_path` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 2 | P3876, P4469 |
| W0067 | C6 | `ascend.additional_config.msmonitor_use_daemon` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 3 | P3904, P4563, P4610 |
| W0090 | C6 | `env.ASCEND_LAUNCH_BLOCKING` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P4633 |
| W0161 | C6 | `env.PYTORCH_NPU_ALLOC_CONF` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 3 | P4584, P4632, P4636 |
| W0253 | C6 | `env.VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 2 | P2999, P3364 |
| W0278 | C6 | `env.VLLM_LOGGING_LEVEL` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 2 | P3034, P3392 |
| W0914 | C6 | `vllm.BatchFrontendArgs@vllm/entrypoints/openai/run_batch.py.enable_metrics` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P2894 |
| W1110 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.active_iterations` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1936 |
| W1111 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.delay_iterations` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1938 |
| W1112 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.ignore_frontend` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1940 |
| W1113 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.max_iterations` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1941 |
| W1114 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.profiler` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1942 |
| W1115 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.torch_profiler_dir` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1950 |
| W1117 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.torch_profiler_record_shapes` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1952 |
| W1118 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.torch_profiler_use_gzip` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1953 |
| W1119 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.torch_profiler_with_flops` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1954 |
| W1120 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.torch_profiler_with_memory` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1955 |
| W1121 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.torch_profiler_with_stack` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1956 |
| W1122 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.wait_iterations` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1957 |
| W1123 | C6 | `vllm.ProfilerConfig@vllm/config/profiler.py.warmup_iterations` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1958 |
| W1307 | C6 | `vllm.cli@vllm/entrypoints/api_server.py.log_level` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P0966 |
| W1377 | C6 | `vllm.eplb.log_balancedness` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1860 |
| W1378 | C6 | `vllm.eplb.log_balancedness_interval` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P1861 |
| W1416 | C6 | `vllm.frontend.disable_access_log_for_endpoints` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P2871 |
| W1425 | C6 | `vllm.frontend.enable_log_deltas` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P2845 |
| W1426 | C6 | `vllm.frontend.enable_log_outputs` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P2846 |
| W1441 | C6 | `vllm.frontend.log_config_file` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P2854 |
| W1442 | C6 | `vllm.frontend.log_error_stack` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P2855 |
| W1444 | C6 | `vllm.frontend.max_log_len` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P2857 |
| W1461 | C6 | `vllm.frontend.uvicorn_log_level` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 1 | P2893 |
| W1547 | C6 | `vllm.startup.disable_log_stats` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 2 | P0768, P1338 |
| W1564 | C6 | `vllm.startup.enable_log_requests` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 2 | P0790, P1292 |
| W1568 | C6 | `vllm.startup.enable_mfu_metrics` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 3 | P0795, P1364, P1841 |
| W1595 | C6 | `vllm.startup.kv_cache_metrics` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 3 | P0831, P1401, P1845 |
| W1596 | C6 | `vllm.startup.kv_cache_metrics_sample` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 3 | P0832, P1402, P1846 |
| W1668 | C6 | `vllm.startup.profiler_config` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 4 | P0916, P1488, P2055, P3671 |
| W1687 | C6 | `vllm.startup.show_hidden_metrics_for_version` | [inference-performance-analysis](../../../wiki/concepts/inference-performance-analysis.md) | 3 | P0937, P1509, P1849 |
| W0830 | C7 | `vllm-ascend.vllm_ascend/kv_offload/npu.py::self.extra_config.num_cpu_blocks` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P4150, P4540 |
| W0831 | C7 | `vllm-ascend.vllm_ascend/patch/platform/patch_mamba_config.py::kv_connector_extra_config.connectors` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P4246, P4545 |
| W0832 | C7 | `vllm-ascend.vllm_ascend/utils.py::extra_config.ascend_local_comm_res_path` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P4418, P4554 |
| W0905 | C7 | `vllm.AttentionConfig@vllm/config/attention.py.mla_prefill_backend` | [attention-backend-family](../../../wiki/concepts/attention-backend-family.md) | 1 | P1548 |
| W0907 | C7 | `vllm.AttentionConfig@vllm/config/attention.py.use_fp4_indexer_cache` | [attention-backend-family](../../../wiki/concepts/attention-backend-family.md) | 1 | P1551 |
| W0908 | C7 | `vllm.AttentionConfig@vllm/config/attention.py.use_non_causal` | [attention-backend-family](../../../wiki/concepts/attention-backend-family.md) | 1 | P1552 |
| W0909 | C7 | `vllm.AttentionConfig@vllm/config/attention.py.use_prefill_decode_attention` | [attention-backend-family](../../../wiki/concepts/attention-backend-family.md) | 1 | P1553 |
| W0910 | C7 | `vllm.AttentionConfig@vllm/config/attention.py.use_prefill_query_quantization` | [attention-backend-family](../../../wiki/concepts/attention-backend-family.md) | 1 | P1554 |
| W0912 | C7 | `vllm.BaseModelPath@vllm/entrypoints/openai/models/protocol.py.model_path` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2206 |
| W0913 | C7 | `vllm.BaseModelPath@vllm/entrypoints/openai/models/protocol.py.name` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2207 |
| W0915 | C7 | `vllm.BatchFrontendArgs@vllm/entrypoints/openai/run_batch.py.host` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2895 |
| W0916 | C7 | `vllm.BatchFrontendArgs@vllm/entrypoints/openai/run_batch.py.input_file` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2896 |
| W0917 | C7 | `vllm.BatchFrontendArgs@vllm/entrypoints/openai/run_batch.py.output_file` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2897 |
| W0918 | C7 | `vllm.BatchFrontendArgs@vllm/entrypoints/openai/run_batch.py.output_tmp_dir` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2898 |
| W0919 | C7 | `vllm.BatchFrontendArgs@vllm/entrypoints/openai/run_batch.py.port` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2899 |
| W0920 | C7 | `vllm.BatchFrontendArgs@vllm/entrypoints/openai/run_batch.py.url` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2900 |
| W0921 | C7 | `vllm.BatchTranscriptionRequest@vllm/entrypoints/openai/run_batch.py.file` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2626 |
| W0922 | C7 | `vllm.BatchTranscriptionRequest@vllm/entrypoints/openai/run_batch.py.file_url` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2627 |
| W0923 | C7 | `vllm.BatchTranslationRequest@vllm/entrypoints/openai/run_batch.py.file` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2628 |
| W0924 | C7 | `vllm.BatchTranslationRequest@vllm/entrypoints/openai/run_batch.py.file_url` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2629 |
| W0925 | C7 | `vllm.CacheConfig@vllm/config/cache.py.hash_block_size` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 1 | P1562 |
| W0926 | C7 | `vllm.CacheConfig@vllm/config/cache.py.is_attention_free` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 1 | P1563 |
| W0927 | C7 | `vllm.CacheConfig@vllm/config/cache.py.mamba_page_size_padded` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 1 | P1575 |
| W0928 | C7 | `vllm.CacheConfig@vllm/config/cache.py.sliding_window` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 1 | P1585 |
| W0929 | C7 | `vllm.ChatCompletionNamedFunction@vllm/entrypoints/openai/chat_completion/protocol.py.name` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2145 |
| W0930 | C7 | `vllm.ChatCompletionToolsParam@vllm/entrypoints/openai/chat_completion/protocol.py.defer_loading` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2146 |
| W0931 | C7 | `vllm.ChatCompletionToolsParam@vllm/entrypoints/openai/chat_completion/protocol.py.function` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2147 |
| W0932 | C7 | `vllm.ChatCompletionToolsParam@vllm/entrypoints/openai/chat_completion/protocol.py.type` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2148 |
| W0933 | C7 | `vllm.ChatParams@vllm/renderers/params.py.chat_template` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0509 |
| W0934 | C7 | `vllm.ChatParams@vllm/renderers/params.py.chat_template_content_format` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0510 |
| W0935 | C7 | `vllm.ChatParams@vllm/renderers/params.py.chat_template_kwargs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0511 |
| W0936 | C7 | `vllm.ChatParams@vllm/renderers/params.py.media_io_kwargs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0512 |
| W0937 | C7 | `vllm.ChatParams@vllm/renderers/params.py.mm_processor_kwargs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0513 |
| W0962 | C7 | `vllm.DetokenizeRequest@vllm/entrypoints/serve/tokenize/protocol.py.model` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2710 |
| W0963 | C7 | `vllm.DetokenizeRequest@vllm/entrypoints/serve/tokenize/protocol.py.tokens` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2711 |
| W0964 | C7 | `vllm.DeviceConfig@vllm/config/device.py.device` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1645 |
| W0981 | C7 | `vllm.FunctionDefinition@vllm/entrypoints/openai/engine/protocol.py.defer_loading` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2163 |
| W0982 | C7 | `vllm.FunctionDefinition@vllm/entrypoints/openai/engine/protocol.py.description` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2164 |
| W0983 | C7 | `vllm.FunctionDefinition@vllm/entrypoints/openai/engine/protocol.py.name` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2165 |
| W0984 | C7 | `vllm.FunctionDefinition@vllm/entrypoints/openai/engine/protocol.py.parameters` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2166 |
| W0985 | C7 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.cache_salt` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2694 |
| W0986 | C7 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.features` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2695 |
| W0988 | C7 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.model` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2697 |
| W0989 | C7 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.priority` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2698 |
| W0990 | C7 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.request_id` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2699 |
| W0991 | C7 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.sampling_params` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2700 |
| W0992 | C7 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.stream` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2701 |
| W0993 | C7 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.stream_options` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2702 |
| W0994 | C7 | `vllm.GenerateRequest@vllm/entrypoints/serve/disagg/protocol.py.token_ids` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2703 |
| W1010 | C7 | `vllm.IrOpPriorityConfig@vllm/config/kernel.py.fused_add_rms_norm` | [ops-and-kernels](../../../wiki/concepts/ops-and-kernels.md) | 1 | P1665 |
| W1011 | C7 | `vllm.IrOpPriorityConfig@vllm/config/kernel.py.rms_norm` | [ops-and-kernels](../../../wiki/concepts/ops-and-kernels.md) | 1 | P1666 |
| W1033 | C7 | `vllm.LegacyStructuralTag@vllm/entrypoints/openai/engine/protocol.py.begin` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2168 |
| W1034 | C7 | `vllm.LegacyStructuralTag@vllm/entrypoints/openai/engine/protocol.py.end` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2169 |
| W1035 | C7 | `vllm.LegacyStructuralTag@vllm/entrypoints/openai/engine/protocol.py.structural_tag_schema` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2170 |
| W1040 | C7 | `vllm.LoadConfig@vllm/config/load.py.device` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1695 |
| W1045 | C7 | `vllm.LogitsProcessorConstructor@vllm/entrypoints/openai/engine/protocol.py.args` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2171 |
| W1046 | C7 | `vllm.LogitsProcessorConstructor@vllm/entrypoints/openai/engine/protocol.py.kwargs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2172 |
| W1047 | C7 | `vllm.LogitsProcessorConstructor@vllm/entrypoints/openai/engine/protocol.py.qualname` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2173 |
| W1048 | C7 | `vllm.MambaConfig@vllm/config/mamba.py.enable_stochastic_rounding` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1717 |
| W1049 | C7 | `vllm.MambaConfig@vllm/config/mamba.py.stochastic_rounding_philox_rounds` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1719 |
| W1063 | C7 | `vllm.ModelConfig@vllm/config/model.py.multimodal_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1772 |
| W1064 | C7 | `vllm.ModelConfig@vllm/config/model.py.spec_target_max_model_len` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1787 |
| W1073 | C7 | `vllm.MultiModalFeatures@vllm/entrypoints/serve/disagg/protocol.py.kwargs_data` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2285 |
| W1074 | C7 | `vllm.MultiModalFeatures@vllm/entrypoints/serve/disagg/protocol.py.mm_hashes` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2286 |
| W1075 | C7 | `vllm.MultiModalFeatures@vllm/entrypoints/serve/disagg/protocol.py.mm_placeholders` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2287 |
| W1076 | C7 | `vllm.ObjStoreConfig@vllm/v1/kv_offload/tiering/obj/config.py.access_key` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0692 |
| W1077 | C7 | `vllm.ObjStoreConfig@vllm/v1/kv_offload/tiering/obj/config.py.bucket` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0693 |
| W1078 | C7 | `vllm.ObjStoreConfig@vllm/v1/kv_offload/tiering/obj/config.py.ca_bundle` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0694 |
| W1079 | C7 | `vllm.ObjStoreConfig@vllm/v1/kv_offload/tiering/obj/config.py.endpoint_override` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0695 |
| W1080 | C7 | `vllm.ObjStoreConfig@vllm/v1/kv_offload/tiering/obj/config.py.scheme` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0697 |
| W1081 | C7 | `vllm.ObjStoreConfig@vllm/v1/kv_offload/tiering/obj/config.py.secret_key` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0698 |
| W1082 | C7 | `vllm.OffloadConfig@vllm/config/offload.py.offload_backend` | [device-memory](../../../wiki/concepts/device-memory.md) | 1 | P1850 |
| W1083 | C7 | `vllm.OffloadConfig@vllm/config/offload.py.prefetch` | [device-memory](../../../wiki/concepts/device-memory.md) | 1 | P1851 |
| W1084 | C7 | `vllm.OffloadConfig@vllm/config/offload.py.uva` | [device-memory](../../../wiki/concepts/device-memory.md) | 1 | P1852 |
| W1085 | C7 | `vllm.ParallelConfig@vllm/config/parallel.py.data_parallel_master_ip` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P1875 |
| W1086 | C7 | `vllm.ParallelConfig@vllm/config/parallel.py.data_parallel_master_port` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P1876 |
| W1087 | C7 | `vllm.ParallelConfig@vllm/config/parallel.py.data_parallel_rank_local` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P1878 |
| W1088 | C7 | `vllm.ParallelConfig@vllm/config/parallel.py.is_moe_model` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P1903 |
| W1089 | C7 | `vllm.ParallelConfig@vllm/config/parallel.py.placement_group` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P1913 |
| W1090 | C7 | `vllm.ParallelConfig@vllm/config/parallel.py.rank` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P1915 |
| W1091 | C7 | `vllm.ParallelConfig@vllm/config/parallel.py.ray_runtime_env` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P1916 |
| W1092 | C7 | `vllm.ParallelConfig@vllm/config/parallel.py.sd_worker_cls` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 1 | P1918 |
| W1093 | C7 | `vllm.PlaceholderRangeInfo@vllm/entrypoints/serve/disagg/protocol.py.length` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2288 |
| W1094 | C7 | `vllm.PlaceholderRangeInfo@vllm/entrypoints/serve/disagg/protocol.py.offset` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2289 |
| W1106 | C7 | `vllm.PrefetchOffloadConfig@vllm/config/offload.py.offload_group_size` | [device-memory](../../../wiki/concepts/device-memory.md) | 1 | P1853 |
| W1107 | C7 | `vllm.PrefetchOffloadConfig@vllm/config/offload.py.offload_num_in_group` | [device-memory](../../../wiki/concepts/device-memory.md) | 1 | P1854 |
| W1108 | C7 | `vllm.PrefetchOffloadConfig@vllm/config/offload.py.offload_params` | [device-memory](../../../wiki/concepts/device-memory.md) | 1 | P1855 |
| W1109 | C7 | `vllm.PrefetchOffloadConfig@vllm/config/offload.py.offload_prefetch_step` | [device-memory](../../../wiki/concepts/device-memory.md) | 1 | P1856 |
| W1124 | C7 | `vllm.ReasoningConfig@vllm/config/reasoning.py.reasoning_end_str` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 1 | P1959 |
| W1125 | C7 | `vllm.ReasoningConfig@vllm/config/reasoning.py.reasoning_parser` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 1 | P1960 |
| W1126 | C7 | `vllm.ReasoningConfig@vllm/config/reasoning.py.reasoning_start_str` | [streaming-output](../../../wiki/concepts/streaming-output.md) | 1 | P1961 |
| W1177 | C7 | `vllm.SchedulerConfig@vllm/config/scheduler.py.is_encoder_decoder` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 1 | P1967 |
| W1178 | C7 | `vllm.SchedulerConfig@vllm/config/scheduler.py.is_multimodal_model` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 1 | P1968 |
| W1179 | C7 | `vllm.SchedulerConfig@vllm/config/scheduler.py.max_num_scheduled_tokens` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 1 | P1977 |
| W1180 | C7 | `vllm.SchedulerConfig@vllm/config/scheduler.py.runner_type` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 1 | P1981 |
| W1195 | C7 | `vllm.SpeechToTextConfig@vllm/config/speech_to_text.py.max_audio_clip_s` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2023 |
| W1196 | C7 | `vllm.SpeechToTextConfig@vllm/config/speech_to_text.py.min_energy_split_window_size` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2024 |
| W1197 | C7 | `vllm.SpeechToTextConfig@vllm/config/speech_to_text.py.overlap_chunk_second` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2025 |
| W1198 | C7 | `vllm.SpeechToTextConfig@vllm/config/speech_to_text.py.sample_rate` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2026 |
| W1199 | C7 | `vllm.StructuredOutputsConfig@vllm/config/structured_outputs.py.backend` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P2027 |
| W1200 | C7 | `vllm.StructuredOutputsConfig@vllm/config/structured_outputs.py.disable_additional_properties` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P2028 |
| W1201 | C7 | `vllm.StructuredOutputsConfig@vllm/config/structured_outputs.py.disable_any_whitespace` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P2029 |
| W1202 | C7 | `vllm.StructuredOutputsConfig@vllm/config/structured_outputs.py.enable_in_reasoning` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P2030 |
| W1203 | C7 | `vllm.StructuredOutputsConfig@vllm/config/structured_outputs.py.reasoning_parser` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P2031 |
| W1204 | C7 | `vllm.StructuredOutputsConfig@vllm/config/structured_outputs.py.reasoning_parser_plugin` | [structured-output](../../../wiki/concepts/structured-output.md) | 1 | P2032 |
| W1218 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.add_generation_prompt` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2712 |
| W1219 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.add_special_tokens` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2713 |
| W1220 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.chat_template` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2714 |
| W1221 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.chat_template_kwargs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2715 |
| W1222 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.continue_final_message` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2716 |
| W1223 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.media_io_kwargs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2717 |
| W1224 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.messages` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2718 |
| W1225 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.mm_processor_kwargs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2719 |
| W1226 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.model` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2720 |
| W1227 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.return_token_strs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2721 |
| W1228 | C7 | `vllm.TokenizeChatRequest@vllm/entrypoints/serve/tokenize/protocol.py.tools` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2722 |
| W1229 | C7 | `vllm.TokenizeCompletionRequest@vllm/entrypoints/serve/tokenize/protocol.py.add_special_tokens` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2723 |
| W1230 | C7 | `vllm.TokenizeCompletionRequest@vllm/entrypoints/serve/tokenize/protocol.py.model` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2724 |
| W1231 | C7 | `vllm.TokenizeCompletionRequest@vllm/entrypoints/serve/tokenize/protocol.py.prompt` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2725 |
| W1232 | C7 | `vllm.TokenizeCompletionRequest@vllm/entrypoints/serve/tokenize/protocol.py.return_token_strs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2726 |
| W1233 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.add_special_tokens` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0517 |
| W1234 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.do_lower_case` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0518 |
| W1235 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.max_output_tokens` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0519 |
| W1236 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.max_output_tokens_param` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0520 |
| W1237 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.max_total_tokens` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0521 |
| W1238 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.max_total_tokens_param` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0522 |
| W1239 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.needs_detokenization` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0523 |
| W1240 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.pad_prompt_tokens` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0524 |
| W1241 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.truncate_prompt_tokens` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0526 |
| W1242 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.truncate_prompt_tokens_param` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0527 |
| W1243 | C7 | `vllm.TokenizeParams@vllm/renderers/params.py.truncation_side` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0528 |
| W1286 | C7 | `vllm.UVAOffloadConfig@vllm/config/offload.py.cpu_offload_gb` | [device-memory](../../../wiki/concepts/device-memory.md) | 1 | P1857 |
| W1287 | C7 | `vllm.UVAOffloadConfig@vllm/config/offload.py.cpu_offload_params` | [device-memory](../../../wiki/concepts/device-memory.md) | 1 | P1858 |
| W1290 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.cache_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2035 |
| W1291 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.device_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2037 |
| W1292 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.instance_id` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2042 |
| W1293 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.load_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2046 |
| W1295 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.model_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2049 |
| W1296 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.observability_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2050 |
| W1297 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.offload_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2051 |
| W1298 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.parallel_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2053 |
| W1299 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.quant_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2056 |
| W1300 | C7 | `vllm.VllmConfig@vllm/config/vllm.py.scheduler_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P2058 |
| W1302 | C7 | `vllm.additional_config@vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py.gdn_prefill_backend` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1263 |
| W1305 | C7 | `vllm.cli@vllm/entrypoints/api_server.py.enable_ssl_refresh` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0964 |
| W1306 | C7 | `vllm.cli@vllm/entrypoints/api_server.py.host` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0965 |
| W1308 | C7 | `vllm.cli@vllm/entrypoints/api_server.py.port` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0967 |
| W1309 | C7 | `vllm.cli@vllm/entrypoints/api_server.py.root_path` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0968 |
| W1310 | C7 | `vllm.cli@vllm/entrypoints/api_server.py.ssl_ca_certs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0969 |
| W1311 | C7 | `vllm.cli@vllm/entrypoints/api_server.py.ssl_cert_reqs` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0970 |
| W1312 | C7 | `vllm.cli@vllm/entrypoints/api_server.py.ssl_certfile` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0971 |
| W1313 | C7 | `vllm.cli@vllm/entrypoints/api_server.py.ssl_keyfile` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0972 |
| W1314 | C7 | `vllm.cli@vllm/entrypoints/cli/main.py.version` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P0973 |
| W1330 | C7 | `vllm.compilation.backend` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1590 |
| W1331 | C7 | `vllm.compilation.cache_dir` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1591 |
| W1332 | C7 | `vllm.compilation.compile_cache_save_format` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1593 |
| W1333 | C7 | `vllm.compilation.compile_mm_encoder` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1594 |
| W1334 | C7 | `vllm.compilation.compile_ranges_endpoints` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1595 |
| W1335 | C7 | `vllm.compilation.compile_sizes` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1596 |
| W1337 | C7 | `vllm.compilation.cudagraph_copy_inputs` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1598 |
| W1338 | C7 | `vllm.compilation.cudagraph_mm_encoder` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1599 |
| W1340 | C7 | `vllm.compilation.cudagraph_num_of_warmups` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1601 |
| W1341 | C7 | `vllm.compilation.cudagraph_specialize_lora` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1602 |
| W1342 | C7 | `vllm.compilation.custom_ops` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1603 |
| W1343 | C7 | `vllm.compilation.debug_dump_path` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1604 |
| W1344 | C7 | `vllm.compilation.dynamic_shapes_config` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1606 |
| W1345 | C7 | `vllm.compilation.dynamic_shapes_config.assume_32_bit_indexing` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1625 |
| W1346 | C7 | `vllm.compilation.dynamic_shapes_config.evaluate_guards` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1626 |
| W1347 | C7 | `vllm.compilation.dynamic_shapes_config.type` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1627 |
| W1348 | C7 | `vllm.compilation.encoder_cudagraph_max_frames_per_batch` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1609 |
| W1349 | C7 | `vllm.compilation.encoder_cudagraph_max_vision_items_per_batch` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1610 |
| W1350 | C7 | `vllm.compilation.encoder_cudagraph_token_budgets` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1611 |
| W1351 | C7 | `vllm.compilation.fast_moe_cold_start` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1612 |
| W1352 | C7 | `vllm.compilation.inductor_compile_config` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1613 |
| W1353 | C7 | `vllm.compilation.inductor_passes` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1614 |
| W1354 | C7 | `vllm.compilation.ir_enable_torch_wrap` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1615 |
| W1356 | C7 | `vllm.compilation.mode` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1618 |
| W1357 | C7 | `vllm.compilation.pass_config` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1619 |
| W1374 | C7 | `vllm.compilation.splitting_ops` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1620 |
| W1375 | C7 | `vllm.compilation.use_inductor_graph_partition` | [graph-mode-layer](../../../wiki/concepts/graph-mode-layer.md) | 1 | P1624 |
| W1376 | C7 | `vllm.eplb.communicator` | [eplb](../../../wiki/concepts/eplb.md) | 1 | P1859 |
| W1379 | C7 | `vllm.eplb.num_redundant_experts` | [eplb](../../../wiki/concepts/eplb.md) | 1 | P1862 |
| W1380 | C7 | `vllm.eplb.policy` | [eplb](../../../wiki/concepts/eplb.md) | 1 | P1863 |
| W1381 | C7 | `vllm.eplb.step_interval` | [eplb](../../../wiki/concepts/eplb.md) | 1 | P1864 |
| W1382 | C7 | `vllm.eplb.use_async` | [eplb](../../../wiki/concepts/eplb.md) | 1 | P1865 |
| W1383 | C7 | `vllm.eplb.window_size` | [eplb](../../../wiki/concepts/eplb.md) | 1 | P1866 |
| W1397 | C7 | `vllm.extra_config@vllm/model_executor/model_loader/default_loader.py.enable_multithread_load` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1266 |
| W1398 | C7 | `vllm.extra_config@vllm/model_executor/model_loader/default_loader.py.enable_weights_track` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1267 |
| W1399 | C7 | `vllm.extra_config@vllm/model_executor/model_loader/default_loader.py.num_threads` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1268 |
| W1403 | C7 | `vllm.extra_config@vllm/v1/kv_offload/factory.py.spec_module_path` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1287 |
| W1404 | C7 | `vllm.extra_config@vllm/v1/kv_offload/factory.py.spec_name` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1288 |
| W1466 | C7 | `vllm.self.extra_config@vllm/v1/kv_offload/base.py.block_size` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1277 |
| W1467 | C7 | `vllm.self.extra_config@vllm/v1/kv_offload/base.py.offload_prompt_only` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1278 |
| W1468 | C7 | `vllm.self.extra_config@vllm/v1/kv_offload/cpu/spec.py.cpu_bytes_to_use` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1282 |
| W1469 | C7 | `vllm.self.extra_config@vllm/v1/kv_offload/cpu/spec.py.eviction_policy` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1283 |
| W1470 | C7 | `vllm.self.extra_config@vllm/v1/kv_offload/cpu/spec.py.max_tracker_size` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1284 |
| W1471 | C7 | `vllm.self.extra_config@vllm/v1/kv_offload/cpu/spec.py.store_threshold` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1285 |
| W1472 | C7 | `vllm.self.extra_config@vllm/v1/kv_offload/tiering/spec.py.secondary_tiers` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1290 |
| W1473 | C7 | `vllm.self.extra_config@vllm/v1/kv_offload/tiering/spec.py.store_threshold` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1291 |
| W1474 | C7 | `vllm.self.extra_config[layer_name]@vllm/model_executor/layers/quantization/inc.py.bits` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 1 | P1264 |
| W1476 | C7 | `vllm.speculative.attention_backend` | [attention-backend-family](../../../wiki/concepts/attention-backend-family.md) | 1 | P1986 |
| W1477 | C7 | `vllm.speculative.code_revision` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P1987 |
| W1478 | C7 | `vllm.speculative.disable_padded_drafter_batch` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P1989 |
| W1479 | C7 | `vllm.speculative.draft_load_config` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P1990 |
| W1480 | C7 | `vllm.speculative.draft_model_config` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P1991 |
| W1481 | C7 | `vllm.speculative.draft_parallel_config` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P1992 |
| W1482 | C7 | `vllm.speculative.draft_sample_method` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P1993 |
| W1483 | C7 | `vllm.speculative.draft_tensor_parallel_size` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P1994 |
| W1485 | C7 | `vllm.speculative.max_model_len` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2000 |
| W1488 | C7 | `vllm.speculative.moe_backend` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2003 |
| W1490 | C7 | `vllm.speculative.parallel_drafting` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2006 |
| W1491 | C7 | `vllm.speculative.prompt_lookup_max` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2007 |
| W1492 | C7 | `vllm.speculative.prompt_lookup_min` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2008 |
| W1493 | C7 | `vllm.speculative.quantization` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2009 |
| W1494 | C7 | `vllm.speculative.rejection_sample_method` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2010 |
| W1495 | C7 | `vllm.speculative.revision` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2011 |
| W1496 | C7 | `vllm.speculative.suffix_decoding_max_cached_requests` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2012 |
| W1497 | C7 | `vllm.speculative.suffix_decoding_max_spec_factor` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2013 |
| W1498 | C7 | `vllm.speculative.suffix_decoding_max_tree_depth` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2014 |
| W1499 | C7 | `vllm.speculative.suffix_decoding_min_token_prob` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2015 |
| W1500 | C7 | `vllm.speculative.synthetic_acceptance_length` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2016 |
| W1501 | C7 | `vllm.speculative.synthetic_acceptance_rates` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2017 |
| W1502 | C7 | `vllm.speculative.target_model_config` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2018 |
| W1503 | C7 | `vllm.speculative.target_parallel_config` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2019 |
| W1504 | C7 | `vllm.speculative.tensor_parallel_size` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2020 |
| W1505 | C7 | `vllm.speculative.use_local_argmax_reduction` | [speculative-decoding](../../../wiki/concepts/speculative-decoding.md) | 1 | P2022 |
| W1506 | C7 | `vllm.startup.additional_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0723, P1293, P2033 |
| W1507 | C7 | `vllm.startup.aggregate_engine_logging` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0724, P1294 |
| W1508 | C7 | `vllm.startup.all2all_backend` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0725, P1295, P1867 |
| W1509 | C7 | `vllm.startup.allow_deprecated_quantization` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0726, P1296, P1720 |
| W1510 | C7 | `vllm.startup.allowed_local_media_path` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0727, P1297, P1721, P3648 |
| W1511 | C7 | `vllm.startup.allowed_media_domains` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0728, P1298, P1722, P3649 |
| W1513 | C7 | `vllm.startup.attention_backend` | [attention-backend-family](../../../wiki/concepts/attention-backend-family.md) | 3 | P0730, P1300, P1537 |
| W1514 | C7 | `vllm.startup.attention_config` | [attention-backend-family](../../../wiki/concepts/attention-backend-family.md) | 4 | P0731, P1301, P2034, P3650 |
| W1516 | C7 | `vllm.startup.calculate_kv_scales` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0733, P1303, P1558 |
| W1517 | C7 | `vllm.startup.code_revision` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0734, P1304, P1723 |
| W1518 | C7 | `vllm.startup.collect_detailed_traces` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0735, P1305, P1837 |
| W1520 | C7 | `vllm.startup.config_format` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0737, P1307, P1724 |
| W1521 | C7 | `vllm.startup.convert` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0738, P1308, P1725, P3653 |
| W1522 | C7 | `vllm.startup.cp_kv_cache_interleave_size` | [context-parallel](../../../wiki/concepts/context-parallel.md) | 3 | P0739, P1309, P1869 |
| W1523 | C7 | `vllm.startup.cpu_distributed_timeout_seconds` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0740, P1310, P1870 |
| W1524 | C7 | `vllm.startup.cpu_offload_gb` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0741, P1311, P3654 |
| W1525 | C7 | `vllm.startup.cpu_offload_params` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0742, P1312 |
| W1528 | C7 | `vllm.startup.data_parallel_backend` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0746, P1316, P1871 |
| W1529 | C7 | `vllm.startup.data_parallel_external_lb` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0747, P1317, P1872 |
| W1530 | C7 | `vllm.startup.data_parallel_hybrid_lb` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0748, P1318, P1873 |
| W1531 | C7 | `vllm.startup.data_parallel_multi_port_external_lb` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0749, P1319 |
| W1537 | C7 | `vllm.startup.dbo_decode_token_threshold` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0755, P1325, P1882 |
| W1538 | C7 | `vllm.startup.dbo_prefill_token_threshold` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0756, P1326, P1883 |
| W1539 | C7 | `vllm.startup.dcp_comm_backend` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0757, P1327, P1884 |
| W1540 | C7 | `vllm.startup.dcp_kv_cache_interleave_size` | [context-parallel](../../../wiki/concepts/context-parallel.md) | 3 | P0758, P1328, P1885 |
| W1541 | C7 | `vllm.startup.decode_context_parallel_size` | [context-parallel](../../../wiki/concepts/context-parallel.md) | 3 | P0760, P1330, P1887 |
| W1543 | C7 | `vllm.startup.disable_cascade_attn` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0764, P1334, P1726 |
| W1544 | C7 | `vllm.startup.disable_chunked_mm_input` | [vllm-scheduler](../../../wiki/concepts/vllm-scheduler.md) | 3 | P0765, P1335, P1963 |
| W1545 | C7 | `vllm.startup.disable_custom_all_reduce` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 4 | P0766, P1336, P1888, P3655 |
| W1548 | C7 | `vllm.startup.disable_nccl_for_dp_synchronization` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0769, P1339, P1889 |
| W1549 | C7 | `vllm.startup.disable_sliding_window` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0770, P1340, P1727 |
| W1551 | C7 | `vllm.startup.distributed_timeout_seconds` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0772, P1342, P1891 |
| W1552 | C7 | `vllm.startup.download_dir` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0773, P1343, P1696 |
| W1554 | C7 | `vllm.startup.ec_transfer_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0777, P1347, P2040 |
| W1556 | C7 | `vllm.startup.enable_cumem_allocator` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0781, P1351, P1729 |
| W1557 | C7 | `vllm.startup.enable_dbo` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0782, P1352, P1894 |
| W1558 | C7 | `vllm.startup.enable_elastic_ep` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0783, P1353, P1895 |
| W1559 | C7 | `vllm.startup.enable_ep_weight_filter` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0784, P1354, P1896 |
| W1560 | C7 | `vllm.startup.enable_eplb` | [eplb](../../../wiki/concepts/eplb.md) | 3 | P0785, P1355, P1897 |
| W1563 | C7 | `vllm.startup.enable_layerwise_nvtx_tracing` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0789, P1359, P1839 |
| W1565 | C7 | `vllm.startup.enable_logging_iteration_details` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0791, P1360, P1840 |
| W1567 | C7 | `vllm.startup.enable_mamba_cache_stochastic_rounding` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0793, P1362 |
| W1570 | C7 | `vllm.startup.enable_mm_embeds` | [token](../../../wiki/concepts/token.md) | 4 | P0797, P1366, P1730, P1814 |
| W1571 | C7 | `vllm.startup.enable_mm_processor_stats` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P1367, P1842 |
| W1572 | C7 | `vllm.startup.enable_prompt_embeds` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0801, P1371, P1732 |
| W1577 | C7 | `vllm.startup.eplb_config` | [eplb](../../../wiki/concepts/eplb.md) | 3 | P0808, P1378, P1900 |
| W1578 | C7 | `vllm.startup.expert_placement_strategy` | [expert-parallel](../../../wiki/concepts/expert-parallel.md) | 3 | P0809, P1379, P1901 |
| W1579 | C7 | `vllm.startup.fail_on_environ_validation` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0810, P1380 |
| W1581 | C7 | `vllm.startup.gdn_prefill_backend` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0813, P1383 |
| W1584 | C7 | `vllm.startup.hf_config_path` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0816, P1386, P1739 |
| W1585 | C7 | `vllm.startup.hf_overrides` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0817, P1387, P1740, P3660 |
| W1586 | C7 | `vllm.startup.hf_token` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0818, P1388, P1742, P3661 |
| W1587 | C7 | `vllm.startup.ignore_patterns` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0819, P1389, P1697 |
| W1588 | C7 | `vllm.startup.interleave_mm_strings` | [token](../../../wiki/concepts/token.md) | 4 | P0820, P1390, P1743, P1815 |
| W1589 | C7 | `vllm.startup.io_processor_plugin` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0821, P1391, P1744 |
| W1590 | C7 | `vllm.startup.ir_op_priority` | [ops-and-kernels](../../../wiki/concepts/ops-and-kernels.md) | 3 | P0822, P1392, P1671 |
| W1591 | C7 | `vllm.startup.kernel_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0827, P1397, P2043 |
| W1593 | C7 | `vllm.startup.kv_cache_dtype_skip_layers` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0829, P1399, P1564 |
| W1597 | C7 | `vllm.startup.kv_events_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0833, P1403, P2044 |
| W1598 | C7 | `vllm.startup.kv_offloading_backend` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0834, P1404, P1569 |
| W1599 | C7 | `vllm.startup.kv_offloading_size` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0835, P1405, P1570 |
| W1600 | C7 | `vllm.startup.kv_sharing_fast_prefill` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0836, P1406, P1571 |
| W1602 | C7 | `vllm.startup.language_model_only` | [token](../../../wiki/concepts/token.md) | 4 | P0838, P1408, P1745, P1816 |
| W1603 | C7 | `vllm.startup.limit_mm_per_prompt` | [token](../../../wiki/concepts/token.md) | 4 | P0839, P1409, P1746, P1817 |
| W1604 | C7 | `vllm.startup.linear_backend` | [ops-and-kernels](../../../wiki/concepts/ops-and-kernels.md) | 3 | P0840, P1410, P1672 |
| W1606 | C7 | `vllm.startup.logits_processors` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0842, P1412, P1747, P3663 |
| W1611 | C7 | `vllm.startup.mamba_backend` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0847, P1417, P1716 |
| W1613 | C7 | `vllm.startup.mamba_cache_dtype` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0849, P1419, P1573 |
| W1615 | C7 | `vllm.startup.mamba_cache_philox_rounds` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0851, P1421 |
| W1616 | C7 | `vllm.startup.mamba_config` | [linear-attention](../../../wiki/concepts/linear-attention.md) | 2 | P1422, P2048 |
| W1617 | C7 | `vllm.startup.mamba_ssm_cache_dtype` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0852, P1423, P1576 |
| W1618 | C7 | `vllm.startup.master_addr` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0854, P1425, P1904 |
| W1619 | C7 | `vllm.startup.master_port` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0855, P1426, P1905 |
| W1629 | C7 | `vllm.startup.max_parallel_loading_workers` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0869, P1440, P1906 |
| W1630 | C7 | `vllm.startup.media_io_kwargs` | [token](../../../wiki/concepts/token.md) | 4 | P0870, P1441, P1751, P1818 |
| W1631 | C7 | `vllm.startup.mm_encoder_attn_backend` | [token](../../../wiki/concepts/token.md) | 4 | P0872, P1443, P1753, P1820 |
| W1632 | C7 | `vllm.startup.mm_encoder_attn_dtype` | [token](../../../wiki/concepts/token.md) | 4 | P0873, P1444, P1754, P1821 |
| W1633 | C7 | `vllm.startup.mm_encoder_fp8_scale_path` | [token](../../../wiki/concepts/token.md) | 4 | P0874, P1445, P1755, P1822 |
| W1634 | C7 | `vllm.startup.mm_encoder_fp8_scale_save_margin` | [token](../../../wiki/concepts/token.md) | 4 | P0875, P1446, P1756, P1823 |
| W1635 | C7 | `vllm.startup.mm_encoder_fp8_scale_save_path` | [token](../../../wiki/concepts/token.md) | 4 | P0876, P1447, P1757, P1824 |
| W1636 | C7 | `vllm.startup.mm_encoder_only` | [token](../../../wiki/concepts/token.md) | 4 | P0877, P1448, P1758, P1825 |
| W1637 | C7 | `vllm.startup.mm_encoder_tp_mode` | [token](../../../wiki/concepts/token.md) | 4 | P0878, P1449, P1759, P1826 |
| W1638 | C7 | `vllm.startup.mm_processor_cache_gb` | [token](../../../wiki/concepts/token.md) | 4 | P0881, P1452, P1762, P1829 |
| W1639 | C7 | `vllm.startup.mm_processor_cache_type` | [token](../../../wiki/concepts/token.md) | 4 | P0882, P1453, P1763, P1830 |
| W1640 | C7 | `vllm.startup.mm_processor_kwargs` | [token](../../../wiki/concepts/token.md) | 5 | P0884, P1455, P1765, P1831, P3664 |
| W1641 | C7 | `vllm.startup.mm_shm_cache_max_object_size_mb` | [token](../../../wiki/concepts/token.md) | 4 | P0885, P1456, P1766, P1832 |
| W1642 | C7 | `vllm.startup.mm_tensor_ipc` | [token](../../../wiki/concepts/token.md) | 4 | P0886, P1457, P1767, P1833 |
| W1644 | C7 | `vllm.startup.model_impl` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0889, P1460, P1770 |
| W1645 | C7 | `vllm.startup.model_loader_extra_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0890, P1461, P1699 |
| W1646 | C7 | `vllm.startup.model_weights` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P1462, P1771 |
| W1647 | C7 | `vllm.startup.moe_backend` | [ops-and-kernels](../../../wiki/concepts/ops-and-kernels.md) | 3 | P0891, P1463, P1673 |
| W1648 | C7 | `vllm.startup.nnodes` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0892, P1464, P1907 |
| W1649 | C7 | `vllm.startup.node_rank` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0893, P1465, P1908 |
| W1651 | C7 | `vllm.startup.numa_bind` | [cpu-binding](../../../wiki/concepts/cpu-binding.md) | 3 | P0895, P1467, P1909 |
| W1652 | C7 | `vllm.startup.numa_bind_cpus` | [cpu-binding](../../../wiki/concepts/cpu-binding.md) | 3 | P0896, P1468, P1910 |
| W1653 | C7 | `vllm.startup.numa_bind_nodes` | [cpu-binding](../../../wiki/concepts/cpu-binding.md) | 3 | P0897, P1469, P1911 |
| W1654 | C7 | `vllm.startup.offload_backend` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0898, P1470 |
| W1655 | C7 | `vllm.startup.offload_group_size` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0899, P1471, P3666 |
| W1656 | C7 | `vllm.startup.offload_num_in_group` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0900, P1472, P3667 |
| W1657 | C7 | `vllm.startup.offload_params` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0901, P1473, P3668 |
| W1658 | C7 | `vllm.startup.offload_prefetch_step` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0902, P1474, P3669 |
| W1659 | C7 | `vllm.startup.optimization_level` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0903, P1475, P2052 |
| W1660 | C7 | `vllm.startup.otlp_traces_endpoint` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0904, P1476, P1847 |
| W1661 | C7 | `vllm.startup.override_attention_dtype` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0905, P1477, P1773 |
| W1663 | C7 | `vllm.startup.performance_mode` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0908, P1480, P2054 |
| W1664 | C7 | `vllm.startup.pipeline_parallel_size` | [pipeline-parallel](../../../wiki/concepts/pipeline-parallel.md) | 3 | P0909, P1481, P1912 |
| W1665 | C7 | `vllm.startup.pooler_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0910, P1482, P1775, P3670 |
| W1666 | C7 | `vllm.startup.prefill_context_parallel_size` | [context-parallel](../../../wiki/concepts/context-parallel.md) | 3 | P0911, P1483, P1914 |
| W1667 | C7 | `vllm.startup.prefix_caching_hash_algo` | [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 3 | P0914, P1486, P1581 |
| W1669 | C7 | `vllm.startup.pt_load_map_location` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0917, P1489, P1700 |
| W1671 | C7 | `vllm.startup.quantization_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0919, P1491, P1777, P3673 |
| W1672 | C7 | `vllm.startup.ray_workers_use_nsight` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0920, P1492, P1917 |
| W1673 | C7 | `vllm.startup.reasoning_config` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0921, P1493, P2057 |
| W1674 | C7 | `vllm.startup.reasoning_parser` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0922, P1494 |
| W1675 | C7 | `vllm.startup.reasoning_parser_plugin` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P0923, P1495 |
| W1676 | C7 | `vllm.startup.renderer_num_workers` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0924, P1496, P1778 |
| W1677 | C7 | `vllm.startup.revision` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0927, P1499, P1780, P3675 |
| W1678 | C7 | `vllm.startup.runner` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0928, P1500, P1781, P3676 |
| W1679 | C7 | `vllm.startup.safetensors_load_strategy` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0929, P1501, P1701 |
| W1680 | C7 | `vllm.startup.safetensors_prefetch_block_size` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0930, P1502, P1702 |
| W1681 | C7 | `vllm.startup.safetensors_prefetch_num_threads` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0931, P1503, P1703 |
| W1688 | C7 | `vllm.startup.shutdown_timeout` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0938, P1510, P2059 |
| W1689 | C7 | `vllm.startup.skip_mm_profiling` | [token](../../../wiki/concepts/token.md) | 4 | P0939, P1511, P1784, P1834 |
| W1690 | C7 | `vllm.startup.skip_tokenizer_init` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0940, P1512, P1785, P3678 |
| W1691 | C7 | `vllm.startup.spec_method` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P1513, P3679 |
| W1692 | C7 | `vllm.startup.spec_model` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P1514, P3680 |
| W1693 | C7 | `vllm.startup.spec_tokens` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 2 | P1515, P3681 |
| W1697 | C7 | `vllm.startup.structured_outputs_config` | [structured-output](../../../wiki/concepts/structured-output.md) | 4 | P0947, P1519, P2061, P3682 |
| W1701 | C7 | `vllm.startup.tokenizer_revision` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0951, P1523, P1790, P3686 |
| W1702 | C7 | `vllm.startup.trust_remote_code` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 4 | P0952, P1525, P1791, P3687 |
| W1703 | C7 | `vllm.startup.ubatch_size` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0953, P1526, P1920 |
| W1704 | C7 | `vllm.startup.use_fp64_gumbel` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0954, P1527, P1792 |
| W1705 | C7 | `vllm.startup.use_tqdm_on_load` | [npu-worker-lifecycle](../../../wiki/concepts/npu-worker-lifecycle.md) | 3 | P0956, P1529, P1704 |
| W1706 | C7 | `vllm.startup.video_pruning_rate` | [token](../../../wiki/concepts/token.md) | 4 | P0958, P1531, P1794, P1836 |
| W1708 | C7 | `vllm.startup.worker_cls` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0962, P1535, P1921 |
| W1709 | C7 | `vllm.startup.worker_extension_cls` | [engine-processes](../../../wiki/concepts/engine-processes.md) | 3 | P0963, P1536, P1922 |
| W0466 | C8 | `text.request.add_generation_prompt` | [token](../../../wiki/concepts/token.md) | 2 | P2416, P2457 |
| W0467 | C8 | `text.request.add_special_tokens` | [token](../../../wiki/concepts/token.md) | 2 | P2458, P2524 |
| W0470 | C8 | `text.request.best_of` | [token](../../../wiki/concepts/token.md) | 1 | P2417 |
| W0471 | C8 | `text.request.cache_salt` | [token](../../../wiki/concepts/token.md) | 2 | P2461, P2527 |
| W0472 | C8 | `text.request.chat_template` | [token](../../../wiki/concepts/token.md) | 2 | P2419, P2462 |
| W0473 | C8 | `text.request.chat_template_kwargs` | [token](../../../wiki/concepts/token.md) | 2 | P2420, P2463 |
| W0474 | C8 | `text.request.continue_final_message` | [token](../../../wiki/concepts/token.md) | 2 | P2421, P2464 |
| W0476 | C8 | `text.request.documents` | [token](../../../wiki/concepts/token.md) | 1 | P2465 |
| W0477 | C8 | `text.request.early_stopping` | [token](../../../wiki/concepts/token.md) | 1 | P2422 |
| W0478 | C8 | `text.request.echo` | [token](../../../wiki/concepts/token.md) | 3 | P2423, P2467, P2529 |
| W0479 | C8 | `text.request.extra_args` | [sampling](../../../wiki/concepts/sampling.md) | 1 | P3714 |
| W0482 | C8 | `text.request.guided_decoding_backend` | [token](../../../wiki/concepts/token.md) | 1 | P2425 |
| W0484 | C8 | `text.request.include_reasoning` | [token](../../../wiki/concepts/token.md) | 1 | P2470 |
| W0486 | C8 | `text.request.kv_transfer_params` | [token](../../../wiki/concepts/token.md) | 2 | P2472, P2533 |
| W0487 | C8 | `text.request.length_penalty` | [token](../../../wiki/concepts/token.md) | 3 | P2428, P2473, P2534 |
| W0492 | C8 | `text.request.media_io_kwargs` | [token](../../../wiki/concepts/token.md) | 1 | P2479 |
| W0493 | C8 | `text.request.messages` | [token](../../../wiki/concepts/token.md) | 2 | P2435, P2480 |
| W0496 | C8 | `text.request.mm_processor_kwargs` | [token](../../../wiki/concepts/token.md) | 1 | P2483 |
| W0497 | C8 | `text.request.model` | [token](../../../wiki/concepts/token.md) | 3 | P2438, P2484, P2541 |
| W0500 | C8 | `text.request.parallel_tool_calls` | [token](../../../wiki/concepts/token.md) | 1 | P2486 |
| W0502 | C8 | `text.request.priority` | [token](../../../wiki/concepts/token.md) | 2 | P2488, P2544 |
| W0503 | C8 | `text.request.prompt` | [token](../../../wiki/concepts/token.md) | 1 | P2545 |
| W0504 | C8 | `text.request.prompt_embeds` | [token](../../../wiki/concepts/token.md) | 1 | P2546 |
| W0506 | C8 | `text.request.reasoning_effort` | [token](../../../wiki/concepts/token.md) | 1 | P2490 |
| W0507 | C8 | `text.request.repetition_detection` | [request-teardown](../../../wiki/concepts/request-teardown.md) | 3 | P2491, P2548, P3730 |
| W0508 | C8 | `text.request.repetition_detection.max_pattern_size` | [request-teardown](../../../wiki/concepts/request-teardown.md) | 1 | P3708 |
| W0509 | C8 | `text.request.repetition_detection.min_count` | [request-teardown](../../../wiki/concepts/request-teardown.md) | 1 | P3709 |
| W0510 | C8 | `text.request.repetition_detection.min_pattern_size` | [request-teardown](../../../wiki/concepts/request-teardown.md) | 1 | P3710 |
| W0512 | C8 | `text.request.request_id` | [token](../../../wiki/concepts/token.md) | 3 | P2443, P2493, P2550 |
| W0514 | C8 | `text.request.return_prompt_text` | [token](../../../wiki/concepts/token.md) | 1 | P2496 |
| W0515 | C8 | `text.request.return_token_ids` | [token](../../../wiki/concepts/token.md) | 3 | P2445, P2497, P2552 |
| W0516 | C8 | `text.request.return_tokens_as_token_ids` | [token](../../../wiki/concepts/token.md) | 2 | P2499, P2554 |
| W0517 | C8 | `text.request.routed_experts_prompt_start` | [vllm-ascend-for-rl](../../../wiki/concepts/vllm-ascend-for-rl.md) | 1 | P3732 |
| W0519 | C8 | `text.request.skip_reading_prefix_cache` | [prefix-caching](../../../wiki/concepts/prefix-caching.md) | 1 | P3735 |
| W0538 | C8 | `text.request.suffix` | [token](../../../wiki/concepts/token.md) | 1 | P2566 |
| W0540 | C8 | `text.request.thinking_token_budget` | [sampling](../../../wiki/concepts/sampling.md) | 3 | P2512, P2568, P3743 |
| W0542 | C8 | `text.request.tools` | [token](../../../wiki/concepts/token.md) | 1 | P2514 |
| W0546 | C8 | `text.request.truncate_prompt_tokens` | [token](../../../wiki/concepts/token.md) | 2 | P2518, P2571 |
| W0547 | C8 | `text.request.truncation_side` | [token](../../../wiki/concepts/token.md) | 2 | P2519, P2572 |
| W0548 | C8 | `text.request.use_beam_search` | [token](../../../wiki/concepts/token.md) | 3 | P2455, P2520, P2573 |
| W0549 | C8 | `text.request.user` | [token](../../../wiki/concepts/token.md) | 3 | P2456, P2521, P2574 |
| W0550 | C8 | `text.request.vllm_xargs` | [token](../../../wiki/concepts/token.md) | 2 | P2522, P2575 |
| W1405 | C8 | `vllm.frontend.allow_credentials` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2865 |
| W1406 | C8 | `vllm.frontend.allowed_headers` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2866 |
| W1407 | C8 | `vllm.frontend.allowed_methods` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2867 |
| W1408 | C8 | `vllm.frontend.allowed_origins` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2868 |
| W1409 | C8 | `vllm.frontend.api_key` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2869 |
| W1414 | C8 | `vllm.frontend.data_parallel_supervisor_port` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2870 |
| W1415 | C8 | `vllm.frontend.default_chat_template_kwargs` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2842 |
| W1417 | C8 | `vllm.frontend.disable_fastapi_docs` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2872 |
| W1418 | C8 | `vllm.frontend.disable_uvicorn_access_log` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2873 |
| W1419 | C8 | `vllm.frontend.dp_supervisor_probe_failure_threshold` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2874 |
| W1420 | C8 | `vllm.frontend.dp_supervisor_probe_interval_s` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2875 |
| W1421 | C8 | `vllm.frontend.dp_supervisor_probe_timeout_s` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2876 |
| W1422 | C8 | `vllm.frontend.enable_auto_tool_choice` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2843 |
| W1423 | C8 | `vllm.frontend.enable_flash_late_interaction` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2877 |
| W1424 | C8 | `vllm.frontend.enable_force_include_usage` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2844 |
| W1427 | C8 | `vllm.frontend.enable_offline_docs` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2878 |
| W1428 | C8 | `vllm.frontend.enable_prompt_tokens_details` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2848 |
| W1429 | C8 | `vllm.frontend.enable_request_id_headers` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2879 |
| W1430 | C8 | `vllm.frontend.enable_server_load_tracking` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2849 |
| W1431 | C8 | `vllm.frontend.enable_ssl_refresh` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2880 |
| W1432 | C8 | `vllm.frontend.enable_tokenizer_info_endpoint` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2850 |
| W1433 | C8 | `vllm.frontend.exclude_tools_when_tool_choice_none` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2851 |
| W1434 | C8 | `vllm.frontend.fingerprint_mode` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2852 |
| W1435 | C8 | `vllm.frontend.fingerprint_value` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2853 |
| W1437 | C8 | `vllm.frontend.h11_max_header_count` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2881 |
| W1438 | C8 | `vllm.frontend.h11_max_incomplete_event_size` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2882 |
| W1445 | C8 | `vllm.frontend.middleware` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2884 |
| W1447 | C8 | `vllm.frontend.response_role` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2858 |
| W1448 | C8 | `vllm.frontend.return_tokens_as_token_ids` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2859 |
| W1449 | C8 | `vllm.frontend.root_path` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2886 |
| W1450 | C8 | `vllm.frontend.ssl_ca_certs` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2887 |
| W1451 | C8 | `vllm.frontend.ssl_cert_reqs` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2888 |
| W1452 | C8 | `vllm.frontend.ssl_certfile` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2889 |
| W1453 | C8 | `vllm.frontend.ssl_ciphers` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2890 |
| W1454 | C8 | `vllm.frontend.ssl_keyfile` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2891 |
| W1455 | C8 | `vllm.frontend.tokens_only` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 2 | P1524, P2860 |
| W1456 | C8 | `vllm.frontend.tool_call_parser` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2861 |
| W1457 | C8 | `vllm.frontend.tool_parser_plugin` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2862 |
| W1458 | C8 | `vllm.frontend.tool_server` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2863 |
| W1460 | C8 | `vllm.frontend.uds` | [api-server-entry](../../../wiki/concepts/api-server-entry.md) | 1 | P2892 |
| W0088 | C9 | `env.ASCEND_ENABLE_USE_FABRIC_MEM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4587 |
| W0089 | C9 | `env.ASCEND_HOME_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 3 | P4555, P4602, P4640 |
| W0092 | C9 | `env.ASCEND_TRANSFER_TIMEOUT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4598 |
| W0093 | C9 | `env.AWS_ENDPOINT_URL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3588 |
| W0094 | C9 | `env.CCL_ATL_TRANSPORT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3646 |
| W0095 | C9 | `env.CMAKE_BUILD_TYPE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 3 | P2901, P4556, P4603 |
| W0096 | C9 | `env.COMPILE_CUSTOM_KERNELS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P4557, P4604 |
| W0097 | C9 | `env.CONDA_EXE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3235 |
| W0098 | C9 | `env.CONDA_PREFIX` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3262 |
| W0104 | C9 | `env.CUDNN_LIBRARY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3238 |
| W0105 | C9 | `env.CXX_COMPILER` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P4558, P4605 |
| W0106 | C9 | `env.C_COMPILER` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P4559, P4606 |
| W0107 | C9 | `env.DO_NOT_TRACK` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3269 |
| W0108 | C9 | `env.DS_ENABLE_EXCLUSIVE_CONNECTION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4592 |
| W0109 | C9 | `env.DS_ENABLE_REMOTE_H2D` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4593 |
| W0110 | C9 | `env.DS_WORKER_ADDR` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4594 |
| W0111 | C9 | `env.DYNAMIC_EPLB` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 4 | P4560, P4579, P4607, P4628 |
| W0112 | C9 | `env.EXA_API_KEY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3260 |
| W0113 | C9 | `env.EXPERT_MAP_RECORD` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P4580, P4629 |
| W0116 | C9 | `env.FLA_CI_ENV` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3583 |
| W0117 | C9 | `env.FLA_COMPILER_MODE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3584 |
| W0118 | C9 | `env.FLA_TRIL_PRECISION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3582 |
| W0120 | C9 | `env.FLA_USE_FAST_OPS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3581, P4627 |
| W0121 | C9 | `env.FLA_USE_TMA` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3586 |
| W0122 | C9 | `env.FORCE_NUM_KV_SPLITS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3632 |
| W0123 | C9 | `env.GDN_RECOMPUTE_SUPPRESS_LEVEL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3587 |
| W0124 | C9 | `env.HCCL_INTRA_PCIE_ENABLE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4638 |
| W0125 | C9 | `env.HCCL_INTRA_ROCE_ENABLE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4639 |
| W0126 | C9 | `env.HCCL_OP_EXPANSION_MODE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P4583, P4631 |
| W0127 | C9 | `env.HCCL_RDMA_RETRY_CNT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4599 |
| W0128 | C9 | `env.HCCL_RDMA_TIMEOUT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4600 |
| W0129 | C9 | `env.HCCL_SO_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P4561, P4608 |
| W0131 | C9 | `env.JAX_PLATFORMS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3270 |
| W0132 | C9 | `env.K_SCALE_CONSTANT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2904, P3271 |
| W0133 | C9 | `env.LD_LIBRARY_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 3 | P2905, P3263, P3272 |
| W0134 | C9 | `env.LD_PRELOAD` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 3 | P3599, P3627, P3643 |
| W0135 | C9 | `env.LLGUIDANCE_LOG_LEVEL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3640 |
| W0136 | C9 | `env.LMCACHE_CONFIG_FILE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3253 |
| W0137 | C9 | `env.LMCACHE_FORCE_SKIP_SAVE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3254 |
| W0138 | C9 | `env.LMCACHE_USE_UPSTREAM_MP` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3255 |
| W0139 | C9 | `env.LOCAL_RANK` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 3 | P2906, P3273, P3637 |
| W0140 | C9 | `env.LOCAL_WORLD_SIZE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3647 |
| W0141 | C9 | `env.MAX_JOBS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 4 | P2907, P3274, P4562, P4609 |
| W0142 | C9 | `env.MMC_LOCAL_CONFIG_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4586 |
| W0143 | C9 | `env.MODELSCOPE_API_TOKEN` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3622 |
| W0144 | C9 | `env.MOONCAKE_CONFIG_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3256, P4589 |
| W0145 | C9 | `env.MOONCAKE_GLOBAL_SEGMENT_SIZE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4590 |
| W0146 | C9 | `env.MOONCAKE_MASTER` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P4591 |
| W0147 | C9 | `env.MOONCAKE_PREFERRED_SEGMENT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2908, P3275 |
| W0148 | C9 | `env.MOONCAKE_REQUESTER_LOCAL_HOSTNAME` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2909, P3276 |
| W0151 | C9 | `env.NO_COLOR` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2910, P3277 |
| W0152 | C9 | `env.NVCC_THREADS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2911, P3278 |
| W0153 | C9 | `env.OMP_NUM_THREADS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3631 |
| W0154 | C9 | `env.OPENAI_API_KEY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3230, P3258 |
| W0155 | C9 | `env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3617 |
| W0156 | C9 | `env.OUTLINES_CACHE_DIR` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3641 |
| W0157 | C9 | `env.PROGRAMFILES` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3239 |
| W0158 | C9 | `env.PROMETHEUS_MULTIPROC_DIR` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3639 |
| W0159 | C9 | `env.PYTHONHASHSEED` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3633 |
| W0162 | C9 | `env.ProgramFiles` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3615 |
| W0163 | C9 | `env.Q_SCALE_CONSTANT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2912, P3279 |
| W0164 | C9 | `env.RANK` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 3 | P3233, P3246, P3638 |
| W0165 | C9 | `env.RAY_CGRAPH_get_timeout` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3634 |
| W0166 | C9 | `env.RAY_USAGE_STATS_ENABLED` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3635, P3636 |
| W0168 | C9 | `env.RUNAI_STREAMER_S3_ENDPOINT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3589 |
| W0169 | C9 | `env.S3_ACCESS_KEY_ID` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2913, P3280 |
| W0170 | C9 | `env.S3_ENDPOINT_URL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2914, P3281 |
| W0171 | C9 | `env.S3_SECRET_ACCESS_KEY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2915, P3282 |
| W0172 | C9 | `env.SAVE_TO_PYTORCH_BENCHMARK_FORMAT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3231 |
| W0173 | C9 | `env.SOC_VERSION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P4564, P4611 |
| W0174 | C9 | `env.SYSTEMROOT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3242 |
| W0175 | C9 | `env.TORCH_COMPILE_DISABLE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3248 |
| W0177 | C9 | `env.TRACEPARENT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3618 |
| W0178 | C9 | `env.TRACESTATE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3619 |
| W0181 | C9 | `env.USE_DEFAULT_FLA_NORM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3580 |
| W0182 | C9 | `env.USE_FLAGOS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3591 |
| W0183 | C9 | `env.UV` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3244 |
| W0184 | C9 | `env.VERBOSE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 4 | P2916, P3283, P4565, P4612 |
| W0185 | C9 | `env.VLLM_ALLOW_CHUNKED_LOCAL_ATTN_WITH_HYBRID_KV_CACHE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2918, P3285 |
| W0186 | C9 | `env.VLLM_ALLOW_INSECURE_SERIALIZATION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2919, P3286 |
| W0187 | C9 | `env.VLLM_ALLOW_LONG_MAX_MODEL_LEN` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2920, P3287 |
| W0188 | C9 | `env.VLLM_ALLOW_RUNTIME_LORA_UPDATING` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2921, P3288 |
| W0190 | C9 | `env.VLLM_ALLREDUCE_USE_SYMM_MEM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2924, P3291 |
| W0191 | C9 | `env.VLLM_API_KEY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2925, P3292 |
| W0192 | C9 | `env.VLLM_ASCEND_ENABLE_BATCH_MEMCPY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P4567, P4614 |
| W0193 | C9 | `env.VLLM_ASSETS_CACHE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2926, P3293 |
| W0194 | C9 | `env.VLLM_ASSETS_CACHE_MODEL_CLEAN` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2927, P3294 |
| W0195 | C9 | `env.VLLM_AUDIO_FETCH_TIMEOUT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2928, P3295 |
| W0196 | C9 | `env.VLLM_BATCH_INVARIANT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2930, P3297 |
| W0198 | C9 | `env.VLLM_CACHE_ROOT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 3 | P2935, P3232, P3302 |
| W0199 | C9 | `env.VLLM_CI_USE_S3` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2936, P3303 |
| W0200 | C9 | `env.VLLM_COMPILE_CACHE_SAVE_FORMAT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P2937 |
| W0201 | C9 | `env.VLLM_COMPUTE_NANS_IN_LOGITS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2938, P3304 |
| W0202 | C9 | `env.VLLM_CONFIGURE_LOGGING` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2939, P3305 |
| W0203 | C9 | `env.VLLM_CONFIG_ROOT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2940, P3306 |
| W0214 | C9 | `env.VLLM_CUSTOM_SCOPES_FOR_PROFILING` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2950, P3316 |
| W0215 | C9 | `env.VLLM_DBO_COMM_SMS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2951, P3317 |
| W0216 | C9 | `env.VLLM_DEBUG_DUMP_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2953, P3319 |
| W0217 | C9 | `env.VLLM_DEBUG_LOG_API_SERVER_RESPONSE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2954, P3320 |
| W0218 | C9 | `env.VLLM_DEBUG_MFU_METRICS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2955, P3321 |
| W0219 | C9 | `env.VLLM_DEBUG_WORKSPACE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2956, P3322 |
| W0220 | C9 | `env.VLLM_DEEPEPLL_NVFP4_DISPATCH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2957, P3323 |
| W0221 | C9 | `env.VLLM_DEEPEP_BUFFER_SIZE_MB` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2958, P3324 |
| W0222 | C9 | `env.VLLM_DEEPEP_HIGH_THROUGHPUT_FORCE_INTRA_NODE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2959, P3325 |
| W0223 | C9 | `env.VLLM_DEEPEP_LOW_LATENCY_USE_MNNVL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2960, P3326 |
| W0224 | C9 | `env.VLLM_DEEP_GEMM_WARMUP` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P2964 |
| W0225 | C9 | `env.VLLM_DISABLED_KERNELS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2965, P3330 |
| W0226 | C9 | `env.VLLM_DISABLE_COMPILE_CACHE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2966, P3331 |
| W0227 | C9 | `env.VLLM_DISABLE_LOG_LOGO` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2968, P3333 |
| W0229 | C9 | `env.VLLM_DISABLE_REQUEST_ID_RANDOMIZATION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2970, P3335 |
| W0230 | C9 | `env.VLLM_DISABLE_SHARED_EXPERTS_STREAM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2971, P3336 |
| W0231 | C9 | `env.VLLM_DISTRIBUTED_USE_SPLIT_GROUP` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2972, P3337 |
| W0232 | C9 | `env.VLLM_DIST_IDENT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3251 |
| W0233 | C9 | `env.VLLM_DOCKER_BUILD_CONTEXT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2973, P3338 |
| W0234 | C9 | `env.VLLM_DO_NOT_TRACK` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2974, P3339 |
| W0235 | C9 | `env.VLLM_DP_MASTER_IP` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2975, P3340 |
| W0236 | C9 | `env.VLLM_DP_MASTER_PORT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2976, P3341 |
| W0237 | C9 | `env.VLLM_DP_RANK` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2977, P3342 |
| W0238 | C9 | `env.VLLM_DP_RANK_LOCAL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2978, P3343 |
| W0239 | C9 | `env.VLLM_DP_SIZE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2979, P3344 |
| W0240 | C9 | `env.VLLM_ELASTIC_EP_DRAIN_REQUESTS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2982, P3347 |
| W0241 | C9 | `env.VLLM_ELASTIC_EP_SCALE_UP_LAUNCH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2983, P3348 |
| W0244 | C9 | `env.VLLM_ENABLE_FLA_PACKED_RECURRENT_DECODE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2987, P3352 |
| W0245 | C9 | `env.VLLM_ENABLE_INDUCTOR_COORDINATE_DESCENT_TUNING` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2989, P3354 |
| W0246 | C9 | `env.VLLM_ENABLE_INDUCTOR_MAX_AUTOTUNE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2990, P3355 |
| W0247 | C9 | `env.VLLM_ENABLE_PREGRAD_PASSES` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2991, P3356 |
| W0248 | C9 | `env.VLLM_ENABLE_RESPONSES_API_STORE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2992, P3357 |
| W0250 | C9 | `env.VLLM_ENFORCE_STRICT_TOOL_CALLING` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2996, P3361 |
| W0251 | C9 | `env.VLLM_ENGINE_ITERATION_TIMEOUT_S` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2997, P3362 |
| W0252 | C9 | `env.VLLM_ENGINE_READY_TIMEOUT_S` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P2998, P3363 |
| W0259 | C9 | `env.VLLM_FLOAT32_MATMUL_PRECISION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3007 |
| W0260 | C9 | `env.VLLM_FORCE_AOT_LOAD` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3008, P3370 |
| W0261 | C9 | `env.VLLM_GC_DEBUG` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3009, P3371 |
| W0262 | C9 | `env.VLLM_GPT_OSS_HARMONY_SYSTEM_INSTRUCTIONS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3011, P3372 |
| W0263 | C9 | `env.VLLM_GPT_OSS_SYSTEM_TOOL_MCP_LABELS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3012 |
| W0264 | C9 | `env.VLLM_GPU_NIC_PCIE_MAPPING` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3013, P3373 |
| W0267 | C9 | `env.VLLM_HTTP_TIMEOUT_KEEP_ALIVE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3017, P3376 |
| W0268 | C9 | `env.VLLM_HUMMING_INPUT_QUANT_CONFIG` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3018, P3377 |
| W0269 | C9 | `env.VLLM_HUMMING_MOE_GEMM_TYPE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3019, P3378 |
| W0270 | C9 | `env.VLLM_HUMMING_ONLINE_QUANT_CONFIG` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3020, P3379 |
| W0271 | C9 | `env.VLLM_HUMMING_USE_F16_ACCUM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3021, P3380 |
| W0272 | C9 | `env.VLLM_IMAGE_FETCH_TIMEOUT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3022, P3381 |
| W0273 | C9 | `env.VLLM_KEEP_ALIVE_ON_ENGINE_DEATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3024, P3383 |
| W0274 | C9 | `env.VLLM_KV_CACHE_LAYOUT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3029 |
| W0275 | C9 | `env.VLLM_KV_EVENTS_USE_INT_BLOCK_HASHES` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3030, P3388 |
| W0276 | C9 | `env.VLLM_LOGGING_COLOR` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3032, P3390 |
| W0277 | C9 | `env.VLLM_LOGGING_CONFIG_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3033, P3391 |
| W0279 | C9 | `env.VLLM_LOGGING_PREFIX` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3035, P3393 |
| W0280 | C9 | `env.VLLM_LOGGING_STREAM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3036, P3394 |
| W0281 | C9 | `env.VLLM_LOG_BATCHSIZE_INTERVAL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3037, P3395 |
| W0282 | C9 | `env.VLLM_LOG_MODEL_INSPECTION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3038, P3396 |
| W0283 | C9 | `env.VLLM_LOG_STATS_INTERVAL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3039, P3397 |
| W0284 | C9 | `env.VLLM_LOOPBACK_IP` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3040, P3398 |
| W0285 | C9 | `env.VLLM_LORA_DISABLE_PDL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3041, P3399 |
| W0286 | C9 | `env.VLLM_LORA_ENABLE_DUAL_STREAM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3042, P3400 |
| W0287 | C9 | `env.VLLM_LORA_RESOLVER_CACHE_DIR` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3043, P3401 |
| W0288 | C9 | `env.VLLM_LORA_RESOLVER_HF_REPO_LIST` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3044, P3402 |
| W0290 | C9 | `env.VLLM_MARLIN_INPUT_DTYPE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3046 |
| W0291 | C9 | `env.VLLM_MARLIN_USE_ATOMIC_ADD` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3047, P3404 |
| W0292 | C9 | `env.VLLM_MAX_AUDIO_CLIP_FILESIZE_MB` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3048, P3405 |
| W0293 | C9 | `env.VLLM_MAX_N_SEQUENCES` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3058, P3415 |
| W0294 | C9 | `env.VLLM_MAX_TOKENS_PER_EXPERT_FP4_MOE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3060, P3417 |
| W0295 | C9 | `env.VLLM_MEDIA_CACHE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3061, P3418 |
| W0296 | C9 | `env.VLLM_MEDIA_CACHE_MAX_SIZE_MB` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3062, P3419 |
| W0297 | C9 | `env.VLLM_MEDIA_CACHE_TTL_HOURS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3063, P3420 |
| W0298 | C9 | `env.VLLM_MEDIA_CONNECTOR` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3064, P3421 |
| W0299 | C9 | `env.VLLM_MEDIA_FETCH_MAX_RETRIES` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3065, P3422 |
| W0300 | C9 | `env.VLLM_MEDIA_LOADING_THREAD_COUNT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3066, P3423 |
| W0301 | C9 | `env.VLLM_MEDIA_URL_ALLOW_REDIRECTS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3067, P3424 |
| W0303 | C9 | `env.VLLM_MLA_DISABLE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3069, P3426 |
| W0304 | C9 | `env.VLLM_MM_HASHER_ALGORITHM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3070 |
| W0305 | C9 | `env.VLLM_MODEL_REDIRECT_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3071, P3427 |
| W0306 | C9 | `env.VLLM_MOE_ROUTING_SIMULATION_STRATEGY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3072, P3428 |
| W0307 | C9 | `env.VLLM_MOE_USE_DEEP_GEMM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3074, P3430 |
| W0308 | C9 | `env.VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3075, P3431 |
| W0309 | C9 | `env.VLLM_MOONCAKE_BOOTSTRAP_PORT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3076, P3432 |
| W0310 | C9 | `env.VLLM_MOONCAKE_DISK_STAGING_USABLE_RATIO` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3077, P3433 |
| W0311 | C9 | `env.VLLM_MOONCAKE_STORE_TIER_LOG` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3079, P3435 |
| W0312 | C9 | `env.VLLM_MQ_MAX_CHUNK_BYTES_MB` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3080, P3436 |
| W0313 | C9 | `env.VLLM_MSGPACK_ZERO_COPY_THRESHOLD` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3081, P3437 |
| W0314 | C9 | `env.VLLM_MULTI_STREAM_GEMM_TOKEN_THRESHOLD` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3082, P3438 |
| W0315 | C9 | `env.VLLM_MXFP4_USE_MARLIN` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3083, P3439 |
| W0318 | C9 | `env.VLLM_NIC_SELECTION_VARS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3087, P3443 |
| W0319 | C9 | `env.VLLM_NIXL_EP_MAX_NUM_RANKS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3088, P3444 |
| W0320 | C9 | `env.VLLM_NIXL_SIDE_CHANNEL_HOST` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3089, P3445 |
| W0321 | C9 | `env.VLLM_NIXL_SIDE_CHANNEL_PORT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3090, P3446 |
| W0322 | C9 | `env.VLLM_NO_USAGE_STATS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3091, P3447 |
| W0323 | C9 | `env.VLLM_NVFP4_GEMM_BACKEND` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3092 |
| W0324 | C9 | `env.VLLM_NVTX_SCOPES_FOR_PROFILING` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3093, P3448 |
| W0325 | C9 | `env.VLLM_OBJECT_STORAGE_SHM_BUFFER_NAME` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3094 |
| W0326 | C9 | `env.VLLM_PATTERN_MATCH_DEBUG` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3097, P3451 |
| W0327 | C9 | `env.VLLM_PLUGINS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3099, P3453 |
| W0329 | C9 | `env.VLLM_PP_LAYER_PARTITION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3101, P3455 |
| W0330 | C9 | `env.VLLM_PRECOMPILED_WHEEL_LOCATION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3456 |
| W0331 | C9 | `env.VLLM_PREFIX_CACHE_RETENTION_INTERVAL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3102, P3457 |
| W0332 | C9 | `env.VLLM_PROCESS_NAME_PREFIX` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3103, P3458 |
| W0333 | C9 | `env.VLLM_RANDOMIZE_DP_DUMMY_INPUTS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3105, P3460 |
| W0334 | C9 | `env.VLLM_RAY_BUNDLE_INDICES` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3106, P3461 |
| W0335 | C9 | `env.VLLM_RAY_DP_PACK_STRATEGY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3107, P3462 |
| W0336 | C9 | `env.VLLM_RAY_DP_PLACEMENT_NODE_IPS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3108, P3463 |
| W0337 | C9 | `env.VLLM_RAY_EXTRA_ENV_VARS_TO_COPY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3109, P3464 |
| W0338 | C9 | `env.VLLM_RAY_EXTRA_ENV_VAR_PREFIXES_TO_COPY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3110, P3465 |
| W0339 | C9 | `env.VLLM_RAY_PER_WORKER_GPUS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3111, P3466 |
| W0340 | C9 | `env.VLLM_RINGBUFFER_WARNING_INTERVAL` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3114, P3469 |
| W0368 | C9 | `env.VLLM_RPC_BASE_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3145, P3498 |
| W0369 | C9 | `env.VLLM_RUST_FRONTEND_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3146, P3499 |
| W0370 | C9 | `env.VLLM_SERVER_DEV_MODE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3147, P3500 |
| W0371 | C9 | `env.VLLM_SHARED_EXPERTS_STREAM_TOKEN_THRESHOLD` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3148, P3501 |
| W0372 | C9 | `env.VLLM_SKIP_MODEL_NAME_VALIDATION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3149, P3502 |
| W0373 | C9 | `env.VLLM_SKIP_P2P_CHECK` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3150, P3503 |
| W0374 | C9 | `env.VLLM_SKIP_PRECOMPILED_VERSION_SUFFIX` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3151, P3504 |
| W0375 | C9 | `env.VLLM_SPARSE_INDEXER_MAX_LOGITS_MB` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3152, P3505 |
| W0376 | C9 | `env.VLLM_SSM_CONV_STATE_LAYOUT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3153 |
| W0377 | C9 | `env.VLLM_SYSTEM_START_DATE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3154, P3506 |
| W0378 | C9 | `env.VLLM_TARGET_DEVICE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3155, P3507 |
| W0379 | C9 | `env.VLLM_TEST_FORCE_FP8_MARLIN` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3156, P3508 |
| W0380 | C9 | `env.VLLM_TEST_FORCE_LOAD_FORMAT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3157, P3509 |
| W0381 | C9 | `env.VLLM_TOOL_JSON_ERROR_AUTOMATIC_RETRY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3158, P3510 |
| W0382 | C9 | `env.VLLM_TOOL_PARSE_REGEX_TIMEOUT_SECONDS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3159, P3511 |
| W0383 | C9 | `env.VLLM_TPU_BUCKET_PADDING_GAP` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3160, P3512 |
| W0384 | C9 | `env.VLLM_TPU_MOST_MODEL_LEN` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3161, P3513 |
| W0385 | C9 | `env.VLLM_TPU_USING_PATHWAYS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3162 |
| W0386 | C9 | `env.VLLM_TRACE_FUNCTION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3163, P3514 |
| W0388 | C9 | `env.VLLM_TUNED_CONFIG_FOLDER` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3167, P3518 |
| W0389 | C9 | `env.VLLM_USAGE_SOURCE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3168, P3519 |
| W0390 | C9 | `env.VLLM_USAGE_STATS_SERVER` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3169, P3520 |
| W0391 | C9 | `env.VLLM_USE_AOT_COMPILE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3170, P3521 |
| W0393 | C9 | `env.VLLM_USE_BYTECODE_HOOK` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3172, P3523 |
| W0394 | C9 | `env.VLLM_USE_DEEP_GEMM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3173, P3524 |
| W0395 | C9 | `env.VLLM_USE_DEEP_GEMM_E8M0` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3174, P3525 |
| W0396 | C9 | `env.VLLM_USE_DEEP_GEMM_TMA_ALIGNED_SCALES` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3175, P3526 |
| W0397 | C9 | `env.VLLM_USE_EXPERIMENTAL_PARSER_CONTEXT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3179, P3530 |
| W0398 | C9 | `env.VLLM_USE_FASTOKENS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3180, P3531 |
| W0399 | C9 | `env.VLLM_USE_FBGEMM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3181, P3532 |
| W0408 | C9 | `env.VLLM_USE_FUSED_MOE_GROUPED_TOPK` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3190, P3541 |
| W0409 | C9 | `env.VLLM_USE_LAYERNAME` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3192, P3543 |
| W0410 | C9 | `env.VLLM_USE_MEGA_AOT_ARTIFACT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3193, P3544 |
| W0411 | C9 | `env.VLLM_USE_MODELSCOPE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3194, P3545 |
| W0413 | C9 | `env.VLLM_USE_NVFP4_CT_EMULATIONS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3196, P3547 |
| W0414 | C9 | `env.VLLM_USE_OINK_OPS` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3197, P3548 |
| W0415 | C9 | `env.VLLM_USE_PRECOMPILED` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3198, P3549 |
| W0416 | C9 | `env.VLLM_USE_PRECOMPILED_RUST` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3199, P3550 |
| W0417 | C9 | `env.VLLM_USE_RAY_COMPILED_DAG_CHANNEL_TYPE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3200 |
| W0418 | C9 | `env.VLLM_USE_RAY_COMPILED_DAG_OVERLAP_COMM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3201, P3551 |
| W0419 | C9 | `env.VLLM_USE_RAY_V2_EXECUTOR_BACKEND` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3202, P3552 |
| W0420 | C9 | `env.VLLM_USE_RAY_WRAPPED_PP_COMM` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3203, P3553 |
| W0421 | C9 | `env.VLLM_USE_RUST_FRONTEND` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3205, P3555 |
| W0422 | C9 | `env.VLLM_USE_SIMPLE_KV_OFFLOAD` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3206, P3556 |
| W0423 | C9 | `env.VLLM_USE_SPINLOOP_EXT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3207, P3557 |
| W0424 | C9 | `env.VLLM_USE_STANDALONE_COMPILE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3208, P3558 |
| W0426 | C9 | `env.VLLM_USE_V2_MODEL_RUNNER` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3210, P3560 |
| W0427 | C9 | `env.VLLM_V1_OUTPUT_PROC_CHUNK_SIZE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3211, P3561 |
| W0428 | C9 | `env.VLLM_V1_USE_OUTLINES_CACHE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3212, P3562 |
| W0429 | C9 | `env.VLLM_VERSION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P4578, P4624 |
| W0430 | C9 | `env.VLLM_VIDEO_FETCH_TIMEOUT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3213, P3563 |
| W0431 | C9 | `env.VLLM_VIDEO_LOADER_BACKEND` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3214, P3564 |
| W0432 | C9 | `env.VLLM_WEIGHT_OFFLOADING_DISABLE_PIN_MEMORY` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3215, P3565 |
| W0433 | C9 | `env.VLLM_WEIGHT_OFFLOADING_DISABLE_UVA` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3216, P3566 |
| W0435 | C9 | `env.VLLM_XGRAMMAR_CACHE_MB` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3220, P3569 |
| W0436 | C9 | `env.VLLM_XLA_CACHE_PATH` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3221, P3570 |
| W0437 | C9 | `env.VLLM_XLA_CHECK_RECOMPILATION` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3222, P3571 |
| W0438 | C9 | `env.VLLM_XLA_USE_SPMD` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3223, P3572 |
| W0441 | C9 | `env.VLLM_ZENTORCH_WEIGHT_PREPACK` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3228, P3576 |
| W0442 | C9 | `env.V_SCALE_CONSTANT` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3229, P3577 |
| W0443 | C9 | `env.WINDIR` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3616 |
| W0444 | C9 | `env.WORLD_SIZE` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3234 |
| W0445 | C9 | `env.XDG_CACHE_HOME` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 2 | P3578, P3642 |
| W0446 | C9 | `env.XDG_CONFIG_HOME` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3579 |
| W0448 | C9 | `env.traceparent` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3620 |
| W0449 | C9 | `env.tracestate` | [ascend-config-system](../../../wiki/concepts/ascend-config-system.md) | 1 | P3621 |
| W0043 | D1 | `ascend.additional_config.enable_hamming_sparse` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3960, P4504 |
| W0064 | D1 | `ascend.additional_config.hamming_sparse` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3898, P4483 |
| W0068 | D1 | `ascend.additional_config.multistream_dsv4_dsa_overlap` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3905, P4488 |
| W0099 | D1 | `env.CUDA_DEVICE_ORDER` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3602 |
| W0100 | D1 | `env.CUDA_HOME` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2902, P3267 |
| W0101 | D1 | `env.CUDA_MODULE_LOADING` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3236 |
| W0102 | D1 | `env.CUDA_PATH` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3237 |
| W0103 | D1 | `env.CUDA_VISIBLE_DEVICES` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 5 | P2903, P3268, P3603, P3623, P3630 |
| W0114 | D1 | `env.FLASHINFER_CUBINS_REPOSITORY` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3625 |
| W0115 | D1 | `env.FLASH_ATTENTION_TRITON_AMD_ENABLE` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3604 |
| W0119 | D1 | `env.FLA_USE_CUDA_GRAPH` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3585 |
| W0130 | D1 | `env.HIP_VISIBLE_DEVICES` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3605 |
| W0149 | D1 | `env.NCCL_ASYNC_ERROR_HANDLING` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3644 |
| W0150 | D1 | `env.NCCL_MAX_CTAS` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3252 |
| W0160 | D1 | `env.PYTORCH_CUDA_ALLOC_CONF` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 4 | P3240, P3247, P3250, P3645 |
| W0167 | D1 | `env.ROCM_HOME` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3241 |
| W0176 | D1 | `env.TORCH_CUDA_ARCH_LIST` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3243 |
| W0179 | D1 | `env.TRITON_ALL_BLOCKS_PARALLEL` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4626 |
| W0180 | D1 | `env.TRITON_PRINT_AUTOTUNING` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3624 |
| W0189 | D1 | `env.VLLM_ALLREDUCE_USE_FLASHINFER` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2922, P3289 |
| W0197 | D1 | `env.VLLM_BLOCKSCALE_FP8_GEMM_FLASHINFER` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2931, P3298 |
| W0204 | D1 | `env.VLLM_CPU_ATTN_SPLIT_KV` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2941, P3307 |
| W0205 | D1 | `env.VLLM_CPU_CI_ENV` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3600 |
| W0206 | D1 | `env.VLLM_CPU_INT4_W4A8` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2943, P3309 |
| W0207 | D1 | `env.VLLM_CPU_KVCACHE_SPACE` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2944, P3310 |
| W0208 | D1 | `env.VLLM_CPU_NUM_OF_RESERVED_CPU` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2945, P3311 |
| W0209 | D1 | `env.VLLM_CPU_OMP_THREADS_BIND` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2946, P3312 |
| W0210 | D1 | `env.VLLM_CPU_SGL_KERNEL` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2947, P3313 |
| W0211 | D1 | `env.VLLM_CPU_SIM_MULTI_NUMA` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3628 |
| W0212 | D1 | `env.VLLM_CUDART_SO_PATH` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2948, P3314 |
| W0213 | D1 | `env.VLLM_CUDA_COMPATIBILITY_PATH` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 3 | P2949, P3264, P3315 |
| W0228 | D1 | `env.VLLM_DISABLE_PYNCCL` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2969, P3334 |
| W0242 | D1 | `env.VLLM_ENABLE_CUDAGRAPH_GC` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P2985, P3350 |
| W0243 | D1 | `env.VLLM_ENABLE_CUDA_COMPATIBILITY` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 3 | P2986, P3265, P3351 |
| W0254 | D1 | `env.VLLM_FLASHINFER_ALLREDUCE_BACKEND` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3001 |
| W0255 | D1 | `env.VLLM_FLASHINFER_ALLREDUCE_FUSION_THRESHOLDS_MB` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3002, P3366 |
| W0256 | D1 | `env.VLLM_FLASHINFER_AUTOTUNE_CACHE_DIR` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3003, P3367 |
| W0257 | D1 | `env.VLLM_FLASHINFER_MOE_BACKEND` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3005 |
| W0258 | D1 | `env.VLLM_FLASHINFER_WORKSPACE_BUFFER_SIZE` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3006, P3369 |
| W0265 | D1 | `env.VLLM_HAS_FLASHINFER_CUBIN` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3015, P3374 |
| W0289 | D1 | `env.VLLM_MAIN_CUDA_VERSION` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3045, P3403 |
| W0302 | D1 | `env.VLLM_MEMORY_PROFILER_ESTIMATE_CUDAGRAPHS` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3068, P3425 |
| W0316 | D1 | `env.VLLM_NCCL_INCLUDE_PATH` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3085, P3441 |
| W0317 | D1 | `env.VLLM_NCCL_SO_PATH` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3086, P3442 |
| W0341 | D1 | `env.VLLM_ROCM_AITER_MOE_DISPATCH_POLICY` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3116, P3470 |
| W0342 | D1 | `env.VLLM_ROCM_FP8_MFMA_PAGE_ATTN` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3117, P3471 |
| W0343 | D1 | `env.VLLM_ROCM_FP8_PADDING` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3118, P3472 |
| W0344 | D1 | `env.VLLM_ROCM_MOE_PADDING` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3119, P3473 |
| W0345 | D1 | `env.VLLM_ROCM_QUICK_REDUCE_CAST_BF16_TO_FP16` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3120, P3474 |
| W0346 | D1 | `env.VLLM_ROCM_QUICK_REDUCE_MAX_SIZE_BYTES_MB` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3121, P3475 |
| W0347 | D1 | `env.VLLM_ROCM_QUICK_REDUCE_MIN_SIZE_BYTES_MB` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3122, P3476 |
| W0348 | D1 | `env.VLLM_ROCM_QUICK_REDUCE_QUANTIZATION` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3123 |
| W0349 | D1 | `env.VLLM_ROCM_QUICK_REDUCE_QUANTIZATION_MIN_SIZE_KB` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3124, P3477 |
| W0350 | D1 | `env.VLLM_ROCM_SHUFFLE_KV_CACHE_LAYOUT` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3125, P3478 |
| W0351 | D1 | `env.VLLM_ROCM_SLEEP_MEM_CHUNK_SIZE` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3126, P3479 |
| W0352 | D1 | `env.VLLM_ROCM_USE_AITER` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3127, P3480 |
| W0353 | D1 | `env.VLLM_ROCM_USE_AITER_FP4BMM` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3129, P3482 |
| W0354 | D1 | `env.VLLM_ROCM_USE_AITER_FP4_ASM_GEMM` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3130, P3483 |
| W0355 | D1 | `env.VLLM_ROCM_USE_AITER_FP8BMM` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3131, P3484 |
| W0356 | D1 | `env.VLLM_ROCM_USE_AITER_FUSION_SHARED_EXPERTS` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3132, P3485 |
| W0357 | D1 | `env.VLLM_ROCM_USE_AITER_LINEAR` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3133, P3486 |
| W0358 | D1 | `env.VLLM_ROCM_USE_AITER_LINEAR_HIPBMM` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3134, P3487 |
| W0359 | D1 | `env.VLLM_ROCM_USE_AITER_MHA` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3135, P3488 |
| W0360 | D1 | `env.VLLM_ROCM_USE_AITER_MLA` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3136, P3489 |
| W0361 | D1 | `env.VLLM_ROCM_USE_AITER_MOE` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3137, P3490 |
| W0362 | D1 | `env.VLLM_ROCM_USE_AITER_PAGED_ATTN` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3139, P3492 |
| W0363 | D1 | `env.VLLM_ROCM_USE_AITER_RMSNORM` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3140, P3493 |
| W0364 | D1 | `env.VLLM_ROCM_USE_AITER_TRITON_GEMM` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3141, P3494 |
| W0365 | D1 | `env.VLLM_ROCM_USE_AITER_TRITON_ROPE` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3142, P3495 |
| W0366 | D1 | `env.VLLM_ROCM_USE_AITER_UNIFIED_ATTENTION` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3143, P3496 |
| W0367 | D1 | `env.VLLM_ROCM_USE_SKINNY_GEMM` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3144, P3497 |
| W0387 | D1 | `env.VLLM_TRITON_ATTN_USE_TD` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3164, P3515 |
| W0392 | D1 | `env.VLLM_USE_BREAKABLE_CUDAGRAPH` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3171, P3522 |
| W0400 | D1 | `env.VLLM_USE_FLASHINFER_MOE_FP16` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3182, P3533 |
| W0401 | D1 | `env.VLLM_USE_FLASHINFER_MOE_FP4` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3183, P3534 |
| W0402 | D1 | `env.VLLM_USE_FLASHINFER_MOE_FP8` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3184, P3535 |
| W0403 | D1 | `env.VLLM_USE_FLASHINFER_MOE_INT4` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3185, P3536 |
| W0404 | D1 | `env.VLLM_USE_FLASHINFER_MOE_MXFP4_BF16` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3186, P3537 |
| W0405 | D1 | `env.VLLM_USE_FLASHINFER_MOE_MXFP4_MXFP8` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3187, P3538 |
| W0406 | D1 | `env.VLLM_USE_FLASHINFER_MOE_MXFP4_MXFP8_CUTLASS` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3188, P3539 |
| W0407 | D1 | `env.VLLM_USE_FLASHINFER_SAMPLER` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3189, P3540 |
| W0412 | D1 | `env.VLLM_USE_NCCL_SYMM_MEM` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3195, P3546 |
| W0425 | D1 | `env.VLLM_USE_TRITON_AWQ` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3209, P3559 |
| W0439 | D1 | `env.VLLM_XPU_ENABLE_XPU_GRAPH` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3224, P3573 |
| W0440 | D1 | `env.VLLM_XPU_USE_SAMPLER_KERNEL` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 2 | P3227, P3575 |
| W0447 | D1 | `env.XPU_USE_TRITON_KERNEL` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P3606 |
| W0833 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.chunk_repre_method` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4427 |
| W0834 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.chunk_size` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4428 |
| W0835 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.hash_bits` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4429 |
| W0836 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.hash_bits_kv_lora` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4430 |
| W0837 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.hash_bits_qk_rope` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4431 |
| W0838 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.hash_weight` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4432 |
| W0839 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.hash_weight_kv_lora` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4433 |
| W0840 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.hash_weight_qk_rope` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4434 |
| W0841 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.hash_weight_type` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4435 |
| W0842 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.head_dim` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4436 |
| W0843 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.is_mla` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4437 |
| W0844 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.kv_lora_rank` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4438 |
| W0845 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.model_name` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4439 |
| W0846 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.must_select_blocks` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4440 |
| W0847 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.num_hidden_layers` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4441 |
| W0848 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.qk_rope_head_dim` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4442 |
| W0849 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.seq_len_threshhold` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4443 |
| W0850 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.top_k_index_reuse` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4444 |
| W0851 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.top_k_ratio_per_layer` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4445 |
| W0852 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.vllm_hash_attention_reduction_head_num` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4446 |
| W0853 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.vllm_hash_attention_rollback_layers` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4447 |
| W0854 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.vllm_hash_attention_skip_layers` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4448 |
| W0855 | D1 | `vllm-ascend.vllm_ascend/worker/kvcomp_utils.py::KVCompConfig.vllm_hash_attention_topk` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P4449 |
| W0898 | D1 | `vllm.AttentionConfig@vllm/config/attention.py.disable_flashinfer_q_quantization` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1539 |
| W0899 | D1 | `vllm.AttentionConfig@vllm/config/attention.py.flash_attn_max_num_splits_for_cuda_graph` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1540 |
| W0900 | D1 | `vllm.AttentionConfig@vllm/config/attention.py.flash_attn_version` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1541 |
| W0901 | D1 | `vllm.AttentionConfig@vllm/config/attention.py.flex_attn_block_m` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1542 |
| W0902 | D1 | `vllm.AttentionConfig@vllm/config/attention.py.flex_attn_block_n` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1543 |
| W0903 | D1 | `vllm.AttentionConfig@vllm/config/attention.py.flex_attn_kv_block_size` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1544 |
| W0904 | D1 | `vllm.AttentionConfig@vllm/config/attention.py.flex_attn_q_block_size` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1545 |
| W0906 | D1 | `vllm.AttentionConfig@vllm/config/attention.py.tq_max_kv_splits_for_cuda_graph` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1550 |
| W0911 | D1 | `vllm.AttentionConfig@vllm/config/attention.py.use_trtllm_attention` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1555 |
| W1050 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.backend` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0030 |
| W1051 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.defer_timeout` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0031 |
| W1052 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.handshake_port` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0034 |
| W1053 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.http_port` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0035 |
| W1054 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.local_ip` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0036 |
| W1055 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.notify_port` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0039 |
| W1056 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.num_workers` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0040 |
| W1057 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.post_batch_size` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0041 |
| W1058 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.proxy_ip` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0042 |
| W1059 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.proxy_ping_port` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0043 |
| W1060 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.qp_per_transfer` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0044 |
| W1061 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.read_mode` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0045 |
| W1062 | D1 | `vllm.MoRIIOConfig@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.transfer_timeout` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0048 |
| W1116 | D1 | `vllm.ProfilerConfig@vllm/config/profiler.py.torch_profiler_dump_cuda_time_total` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1951 |
| W1205 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.deserialization_kwargs` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0204 |
| W1206 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.encryption_keyfile` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0206 |
| W1207 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.lora_dir` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0208 |
| W1208 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.num_readers` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0210 |
| W1209 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.s3_access_key_id` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0211 |
| W1210 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.s3_endpoint` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0212 |
| W1211 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.s3_secret_access_key` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0213 |
| W1212 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.serialization_kwargs` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0214 |
| W1213 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.stream_kwargs` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0215 |
| W1214 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.tensorizer_dir` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0216 |
| W1215 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.tensorizer_uri` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0217 |
| W1216 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.verify_hash` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0218 |
| W1217 | D1 | `vllm.TensorizerConfig@vllm/model_executor/model_loader/tensorizer.py.vllm_tensorized` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0219 |
| W1323 | D1 | `vllm.cli@vllm/model_executor/model_loader/tensorizer.py.encryption_keyfile` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0991 |
| W1324 | D1 | `vllm.cli@vllm/model_executor/model_loader/tensorizer.py.num_readers` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0992 |
| W1325 | D1 | `vllm.cli@vllm/model_executor/model_loader/tensorizer.py.s3_access_key_id` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0993 |
| W1326 | D1 | `vllm.cli@vllm/model_executor/model_loader/tensorizer.py.s3_endpoint` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0994 |
| W1327 | D1 | `vllm.cli@vllm/model_executor/model_loader/tensorizer.py.s3_secret_access_key` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0995 |
| W1328 | D1 | `vllm.cli@vllm/model_executor/model_loader/tensorizer.py.tensorizer_uri` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0996 |
| W1329 | D1 | `vllm.cli@vllm/model_executor/model_loader/tensorizer.py.verify_hash` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P0997 |
| W1358 | D1 | `vllm.compilation.pass_config.eliminate_noops` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1628 |
| W1359 | D1 | `vllm.compilation.pass_config.enable_qk_norm_rope_fusion` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1629 |
| W1360 | D1 | `vllm.compilation.pass_config.enable_sp` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1630 |
| W1361 | D1 | `vllm.compilation.pass_config.fi_allreduce_fusion_max_size_mb` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1631 |
| W1362 | D1 | `vllm.compilation.pass_config.fuse_act_padding` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1632 |
| W1363 | D1 | `vllm.compilation.pass_config.fuse_act_quant` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1633 |
| W1364 | D1 | `vllm.compilation.pass_config.fuse_allreduce_rms` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1634 |
| W1365 | D1 | `vllm.compilation.pass_config.fuse_attn_quant` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1635 |
| W1366 | D1 | `vllm.compilation.pass_config.fuse_gemm_comms` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1636 |
| W1367 | D1 | `vllm.compilation.pass_config.fuse_minimax_qk_norm` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1637 |
| W1368 | D1 | `vllm.compilation.pass_config.fuse_mla_dual_rms_norm` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1638 |
| W1369 | D1 | `vllm.compilation.pass_config.fuse_norm_quant` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1639 |
| W1370 | D1 | `vllm.compilation.pass_config.fuse_rope_kvcache` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1641 |
| W1371 | D1 | `vllm.compilation.pass_config.fuse_rope_kvcache_cat_mla` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1642 |
| W1372 | D1 | `vllm.compilation.pass_config.rope_kvcache_fusion_max_token_num` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1643 |
| W1373 | D1 | `vllm.compilation.pass_config.sp_min_token_num` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1644 |
| W1387 | D1 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.backend` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1237 |
| W1388 | D1 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.defer_timeout` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1238 |
| W1389 | D1 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.num_workers` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1240 |
| W1390 | D1 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.post_batch_size` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1241 |
| W1391 | D1 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.qp_per_transfer` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1244 |
| W1392 | D1 | `vllm.extra_config@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.transfer_timeout` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1245 |
| W1400 | D1 | `vllm.extra_config@vllm/model_executor/model_loader/runai_streamer_loader.py.concurrency` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1269 |
| W1401 | D1 | `vllm.extra_config@vllm/model_executor/model_loader/runai_streamer_loader.py.distributed` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1270 |
| W1402 | D1 | `vllm.extra_config@vllm/model_executor/model_loader/runai_streamer_loader.py.memory_limit` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1271 |
| W1464 | D1 | `vllm.kv_transfer_config.kv_connector_extra_config@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_common.py.read_mode` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1246 |
| W1475 | D1 | `vllm.self.kv_transfer_config.kv_connector_extra_config@vllm/distributed/kv_transfer/kv_connector/v1/moriio/moriio_connector.py.defer_timeout` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 1 | P1247 |
| W1526 | D1 | `vllm.startup.cudagraph_metrics` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 3 | P0744, P1314, P1838 |
| W1562 | D1 | `vllm.startup.enable_flashinfer_autotune` | [vllm-platform-interface](../../../wiki/concepts/vllm-platform-interface.md) | 3 | P0788, P1358, P1669 |
| W0082 | D2 | `beam.beam_width` | 拟新增：wiki/concepts/beam-search.md | 1 | P3701 |
| W0083 | D2 | `beam.ignore_eos` | 拟新增：wiki/concepts/beam-search.md | 1 | P3702 |
| W0084 | D2 | `beam.include_stop_str_in_output` | 拟新增：wiki/concepts/beam-search.md | 1 | P3703 |
| W0085 | D2 | `beam.length_penalty` | 拟新增：wiki/concepts/beam-search.md | 1 | P3704 |
| W0086 | D2 | `beam.max_tokens` | 拟新增：wiki/concepts/beam-search.md | 1 | P3705 |
| W0087 | D2 | `beam.temperature` | 拟新增：wiki/concepts/beam-search.md | 1 | P3707 |
| W0450 | D2 | `pooling.config.dimensions` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1924 |
| W0451 | D2 | `pooling.config.enable_chunked_processing` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1925 |
| W0452 | D2 | `pooling.config.logit_mean` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1926 |
| W0453 | D2 | `pooling.config.logit_sigma` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1927 |
| W0454 | D2 | `pooling.config.max_embed_len` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1928 |
| W0455 | D2 | `pooling.config.pooling_type` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1929 |
| W0456 | D2 | `pooling.config.returned_token_ids` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1930 |
| W0457 | D2 | `pooling.config.seq_pooling_type` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1931 |
| W0458 | D2 | `pooling.config.step_tag_id` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1932 |
| W0459 | D2 | `pooling.config.task` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1933 |
| W0460 | D2 | `pooling.config.tok_pooling_type` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1934 |
| W0461 | D2 | `pooling.config.use_activation` | 拟新增：wiki/concepts/pooling-api.md | 1 | P1935 |
| W0462 | D2 | `pooling.request.dimensions` | 拟新增：wiki/concepts/pooling-api.md | 1 | P3691 |
| W0463 | D2 | `pooling.request.returned_token_ids` | 拟新增：wiki/concepts/pooling-api.md | 1 | P3696 |
| W0464 | D2 | `pooling.request.step_tag_id` | 拟新增：wiki/concepts/pooling-api.md | 1 | P3698 |
| W0465 | D2 | `pooling.request.use_activation` | 拟新增：wiki/concepts/pooling-api.md | 1 | P3700 |
| W0856 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.content` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2069 |
| W0857 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.data` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2070 |
| W0858 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.id` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2071 |
| W0859 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.input` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2072 |
| W0860 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.is_error` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2073 |
| W0861 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.name` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2074 |
| W0862 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.signature` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2075 |
| W0863 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.source` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2076 |
| W0864 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.text` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2077 |
| W0865 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.thinking` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2078 |
| W0866 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.tool_name` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2079 |
| W0867 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.tool_use_id` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2080 |
| W0868 | D2 | `vllm.AnthropicContentBlock@vllm/entrypoints/anthropic/protocol.py.type` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2081 |
| W0869 | D2 | `vllm.AnthropicCountTokensRequest@vllm/entrypoints/anthropic/protocol.py.chat_template_kwargs` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2356 |
| W0870 | D2 | `vllm.AnthropicCountTokensRequest@vllm/entrypoints/anthropic/protocol.py.messages` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2357 |
| W0871 | D2 | `vllm.AnthropicCountTokensRequest@vllm/entrypoints/anthropic/protocol.py.model` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2358 |
| W0872 | D2 | `vllm.AnthropicCountTokensRequest@vllm/entrypoints/anthropic/protocol.py.system` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2359 |
| W0873 | D2 | `vllm.AnthropicCountTokensRequest@vllm/entrypoints/anthropic/protocol.py.tool_choice` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2360 |
| W0874 | D2 | `vllm.AnthropicCountTokensRequest@vllm/entrypoints/anthropic/protocol.py.tools` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2361 |
| W0875 | D2 | `vllm.AnthropicMessage@vllm/entrypoints/anthropic/protocol.py.content` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2083 |
| W0876 | D2 | `vllm.AnthropicMessage@vllm/entrypoints/anthropic/protocol.py.role` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2084 |
| W0877 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.chat_template_kwargs` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2363 |
| W0879 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.max_tokens` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2366 |
| W0880 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.messages` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2367 |
| W0881 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.metadata` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2368 |
| W0882 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.model` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2369 |
| W0883 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.output_config` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2370 |
| W0884 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.stop_sequences` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2371 |
| W0885 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.stream` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2372 |
| W0886 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.system` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2373 |
| W0887 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.temperature` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2374 |
| W0888 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.tool_choice` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2375 |
| W0889 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.tools` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2376 |
| W0890 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.top_k` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2377 |
| W0891 | D2 | `vllm.AnthropicMessagesRequest@vllm/entrypoints/anthropic/protocol.py.top_p` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2378 |
| W0892 | D2 | `vllm.AnthropicOutputConfig@vllm/entrypoints/anthropic/protocol.py.effort` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P0075 |
| W0893 | D2 | `vllm.AnthropicOutputConfig@vllm/entrypoints/anthropic/protocol.py.format` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P0076 |
| W0894 | D2 | `vllm.AnthropicTool@vllm/entrypoints/anthropic/protocol.py.defer_loading` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2092 |
| W0895 | D2 | `vllm.AnthropicTool@vllm/entrypoints/anthropic/protocol.py.description` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2093 |
| W0896 | D2 | `vllm.AnthropicTool@vllm/entrypoints/anthropic/protocol.py.input_schema` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2094 |
| W0897 | D2 | `vllm.AnthropicTool@vllm/entrypoints/anthropic/protocol.py.name` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2095 |
| W0938 | D2 | `vllm.ChatRequestMixin@vllm/entrypoints/pooling/base/protocol.py.add_generation_prompt` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2215 |
| W0939 | D2 | `vllm.ChatRequestMixin@vllm/entrypoints/pooling/base/protocol.py.add_special_tokens` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2216 |
| W0940 | D2 | `vllm.ChatRequestMixin@vllm/entrypoints/pooling/base/protocol.py.chat_template` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2217 |
| W0941 | D2 | `vllm.ChatRequestMixin@vllm/entrypoints/pooling/base/protocol.py.chat_template_kwargs` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2218 |
| W0942 | D2 | `vllm.ChatRequestMixin@vllm/entrypoints/pooling/base/protocol.py.continue_final_message` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2219 |
| W0943 | D2 | `vllm.ChatRequestMixin@vllm/entrypoints/pooling/base/protocol.py.media_io_kwargs` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2220 |
| W0944 | D2 | `vllm.ChatRequestMixin@vllm/entrypoints/pooling/base/protocol.py.messages` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2221 |
| W0945 | D2 | `vllm.ClassifyRequestMixin@vllm/entrypoints/pooling/base/protocol.py.use_activation` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2228 |
| W0946 | D2 | `vllm.CohereEmbedContent@vllm/entrypoints/pooling/embed/protocol.py.image_url` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2257 |
| W0947 | D2 | `vllm.CohereEmbedContent@vllm/entrypoints/pooling/embed/protocol.py.text` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2258 |
| W0948 | D2 | `vllm.CohereEmbedContent@vllm/entrypoints/pooling/embed/protocol.py.type` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2259 |
| W0949 | D2 | `vllm.CohereEmbedInput@vllm/entrypoints/pooling/embed/protocol.py.content` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2260 |
| W0950 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.embedding_types` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2630 |
| W0951 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.images` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2631 |
| W0952 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.input_type` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2632 |
| W0953 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.inputs` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2633 |
| W0954 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.max_tokens` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2634 |
| W0955 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.model` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2635 |
| W0956 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.output_dimension` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2636 |
| W0957 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.priority` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2637 |
| W0958 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.texts` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2638 |
| W0959 | D2 | `vllm.CohereEmbedRequest@vllm/entrypoints/pooling/embed/protocol.py.truncate` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2639 |
| W0960 | D2 | `vllm.CompletionRequestMixin@vllm/entrypoints/pooling/base/protocol.py.add_special_tokens` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2229 |
| W0961 | D2 | `vllm.CompletionRequestMixin@vllm/entrypoints/pooling/base/protocol.py.input` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2230 |
| W0976 | D2 | `vllm.EmbedRequestMixin@vllm/entrypoints/pooling/base/protocol.py.dimensions` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2231 |
| W0977 | D2 | `vllm.EmbedRequestMixin@vllm/entrypoints/pooling/base/protocol.py.use_activation` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2232 |
| W0978 | D2 | `vllm.EncodingRequestMixin@vllm/entrypoints/pooling/base/protocol.py.embed_dtype` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2233 |
| W0979 | D2 | `vllm.EncodingRequestMixin@vllm/entrypoints/pooling/base/protocol.py.encoding_format` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2234 |
| W0980 | D2 | `vllm.EncodingRequestMixin@vllm/entrypoints/pooling/base/protocol.py.endianness` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2235 |
| W0995 | D2 | `vllm.GenerativeScoringRequest@vllm/entrypoints/generate/generative_scoring/serving.py.add_special_tokens` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2403 |
| W0996 | D2 | `vllm.GenerativeScoringRequest@vllm/entrypoints/generate/generative_scoring/serving.py.apply_softmax` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2404 |
| W0997 | D2 | `vllm.GenerativeScoringRequest@vllm/entrypoints/generate/generative_scoring/serving.py.item_first` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2405 |
| W0998 | D2 | `vllm.GenerativeScoringRequest@vllm/entrypoints/generate/generative_scoring/serving.py.items` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2406 |
| W0999 | D2 | `vllm.GenerativeScoringRequest@vllm/entrypoints/generate/generative_scoring/serving.py.label_token_ids` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2407 |
| W1000 | D2 | `vllm.GenerativeScoringRequest@vllm/entrypoints/generate/generative_scoring/serving.py.model` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2408 |
| W1001 | D2 | `vllm.GenerativeScoringRequest@vllm/entrypoints/generate/generative_scoring/serving.py.priority` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2409 |
| W1002 | D2 | `vllm.GenerativeScoringRequest@vllm/entrypoints/generate/generative_scoring/serving.py.query` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2410 |
| W1003 | D2 | `vllm.GenerativeScoringRequest@vllm/entrypoints/generate/generative_scoring/serving.py.request_id` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2411 |
| W1004 | D2 | `vllm.IOProcessorRequest@vllm/entrypoints/pooling/pooling/protocol.py.data` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2643 |
| W1005 | D2 | `vllm.IOProcessorRequest@vllm/entrypoints/pooling/pooling/protocol.py.task` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2644 |
| W1006 | D2 | `vllm.InputAudioBufferAppend@vllm/entrypoints/speech_to_text/realtime/protocol.py.audio` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2312 |
| W1007 | D2 | `vllm.InputAudioBufferAppend@vllm/entrypoints/speech_to_text/realtime/protocol.py.type` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2313 |
| W1008 | D2 | `vllm.InputAudioBufferCommit@vllm/entrypoints/speech_to_text/realtime/protocol.py.final` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2314 |
| W1009 | D2 | `vllm.InputAudioBufferCommit@vllm/entrypoints/speech_to_text/realtime/protocol.py.type` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2315 |
| W1095 | D2 | `vllm.PoolingBasicRequestMixin@vllm/entrypoints/pooling/base/protocol.py.cache_salt` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2236 |
| W1096 | D2 | `vllm.PoolingBasicRequestMixin@vllm/entrypoints/pooling/base/protocol.py.mm_processor_kwargs` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2237 |
| W1097 | D2 | `vllm.PoolingBasicRequestMixin@vllm/entrypoints/pooling/base/protocol.py.model` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2238 |
| W1098 | D2 | `vllm.PoolingBasicRequestMixin@vllm/entrypoints/pooling/base/protocol.py.priority` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2240 |
| W1099 | D2 | `vllm.PoolingBasicRequestMixin@vllm/entrypoints/pooling/base/protocol.py.request_id` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2241 |
| W1100 | D2 | `vllm.PoolingBasicRequestMixin@vllm/entrypoints/pooling/base/protocol.py.truncate_prompt_tokens` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2242 |
| W1101 | D2 | `vllm.PoolingBasicRequestMixin@vllm/entrypoints/pooling/base/protocol.py.truncation_side` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2243 |
| W1102 | D2 | `vllm.PoolingBasicRequestMixin@vllm/entrypoints/pooling/base/protocol.py.user` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2244 |
| W1103 | D2 | `vllm.PoolingChatRequest@vllm/entrypoints/pooling/pooling/protocol.py.task` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2645 |
| W1104 | D2 | `vllm.PoolingCompletionRequest@vllm/entrypoints/pooling/pooling/protocol.py.task` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2646 |
| W1105 | D2 | `vllm.PoolingTokenizeParamsMixin@vllm/entrypoints/pooling/base/protocol.py.add_special_tokens` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2245 |
| W1127 | D2 | `vllm.RerankDocument@vllm/entrypoints/pooling/scoring/protocol.py.multi_modal` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2263 |
| W1128 | D2 | `vllm.RerankDocument@vllm/entrypoints/pooling/scoring/protocol.py.text` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2264 |
| W1129 | D2 | `vllm.RerankRequest@vllm/entrypoints/pooling/scoring/protocol.py.documents` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2647 |
| W1130 | D2 | `vllm.RerankRequest@vllm/entrypoints/pooling/scoring/protocol.py.query` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2648 |
| W1131 | D2 | `vllm.RerankRequest@vllm/entrypoints/pooling/scoring/protocol.py.top_n` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2649 |
| W1132 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.background` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2577 |
| W1133 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.cache_salt` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2578 |
| W1134 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.chat_template_kwargs` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2579 |
| W1135 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.enable_response_messages` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2581 |
| W1136 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.frequency_penalty` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2582 |
| W1137 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.ignore_eos` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2583 |
| W1138 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.include` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2584 |
| W1139 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.include_stop_str_in_output` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2586 |
| W1140 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.input` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2587 |
| W1141 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.instructions` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2588 |
| W1143 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.logit_bias` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2590 |
| W1144 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.max_output_tokens` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2591 |
| W1145 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.max_tool_calls` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2592 |
| W1146 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.media_io_kwargs` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2593 |
| W1147 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.metadata` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2594 |
| W1148 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.mm_processor_kwargs` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2595 |
| W1149 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.model` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2596 |
| W1150 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.parallel_tool_calls` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2597 |
| W1151 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.presence_penalty` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2598 |
| W1152 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.previous_input_messages` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2599 |
| W1153 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.previous_response_id` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2600 |
| W1154 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.priority` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2601 |
| W1155 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.prompt` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2602 |
| W1156 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.prompt_cache_key` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2603 |
| W1157 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.reasoning` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2604 |
| W1158 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.repetition_penalty` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2605 |
| W1159 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.request_id` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2606 |
| W1160 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.seed` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2607 |
| W1161 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.service_tier` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2608 |
| W1162 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.skip_special_tokens` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2610 |
| W1163 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.stop` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2611 |
| W1164 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.store` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2612 |
| W1165 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.stream` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2613 |
| W1166 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.structured_outputs` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2614 |
| W1167 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.temperature` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2615 |
| W1168 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.text` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2616 |
| W1169 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.tool_choice` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2617 |
| W1170 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.tools` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2618 |
| W1171 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.top_k` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2619 |
| W1172 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.top_logprobs` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2620 |
| W1173 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.top_p` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2621 |
| W1174 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.truncation` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2622 |
| W1175 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.user` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2623 |
| W1176 | D2 | `vllm.ResponsesRequest@vllm/entrypoints/openai/responses/protocol.py.vllm_xargs` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2624 |
| W1181 | D2 | `vllm.ScoreDataRequest@vllm/entrypoints/pooling/scoring/protocol.py.data_1` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2650 |
| W1182 | D2 | `vllm.ScoreDataRequest@vllm/entrypoints/pooling/scoring/protocol.py.data_2` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2651 |
| W1183 | D2 | `vllm.ScoreQueriesDocumentsRequest@vllm/entrypoints/pooling/scoring/protocol.py.documents` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2652 |
| W1184 | D2 | `vllm.ScoreQueriesDocumentsRequest@vllm/entrypoints/pooling/scoring/protocol.py.queries` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2653 |
| W1185 | D2 | `vllm.ScoreQueriesItemsRequest@vllm/entrypoints/pooling/scoring/protocol.py.items` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2654 |
| W1186 | D2 | `vllm.ScoreQueriesItemsRequest@vllm/entrypoints/pooling/scoring/protocol.py.queries` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2655 |
| W1187 | D2 | `vllm.ScoreTextRequest@vllm/entrypoints/pooling/scoring/protocol.py.text_1` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2656 |
| W1188 | D2 | `vllm.ScoreTextRequest@vllm/entrypoints/pooling/scoring/protocol.py.text_2` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2657 |
| W1189 | D2 | `vllm.ScoringRequestMixin@vllm/entrypoints/pooling/scoring/protocol.py.chat_template_kwargs` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2268 |
| W1190 | D2 | `vllm.ScoringRequestMixin@vllm/entrypoints/pooling/scoring/protocol.py.instruction` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2269 |
| W1191 | D2 | `vllm.ScoringRequestMixin@vllm/entrypoints/pooling/scoring/protocol.py.max_tokens_per_doc` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2270 |
| W1192 | D2 | `vllm.ScoringRequestMixin@vllm/entrypoints/pooling/scoring/protocol.py.max_tokens_per_query` | 拟新增：wiki/concepts/pooling-api.md | 1 | P2271 |
| W1193 | D2 | `vllm.SessionUpdate@vllm/entrypoints/speech_to_text/realtime/protocol.py.model` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2319 |
| W1194 | D2 | `vllm.SessionUpdate@vllm/entrypoints/speech_to_text/realtime/protocol.py.type` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2320 |
| W1244 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.file` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2727 |
| W1245 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.frequency_penalty` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2728 |
| W1246 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.hotwords` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2729 |
| W1247 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.include_stop_str_in_output` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2730 |
| W1248 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.language` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2731 |
| W1249 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.length_penalty` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2732 |
| W1250 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.max_completion_tokens` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2733 |
| W1251 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.min_p` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2734 |
| W1252 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.model` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2735 |
| W1253 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.n` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2736 |
| W1254 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.presence_penalty` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2737 |
| W1255 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.prompt` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2738 |
| W1256 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.repetition_penalty` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2739 |
| W1257 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.response_format` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2740 |
| W1258 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.seed` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2741 |
| W1259 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.stream` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2742 |
| W1260 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.stream_continuous_usage_stats` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2743 |
| W1261 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.stream_include_usage` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2744 |
| W1262 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.temperature` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2745 |
| W1263 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.timestamp_granularities` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2746 |
| W1264 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.to_language` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2747 |
| W1265 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.top_k` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2748 |
| W1266 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.top_p` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2749 |
| W1267 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.use_beam_search` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2750 |
| W1268 | D2 | `vllm.TranscriptionRequest@vllm/entrypoints/speech_to_text/transcription/protocol.py.vllm_xargs` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2751 |
| W1269 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.file` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2752 |
| W1270 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.hotwords` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2754 |
| W1271 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.include_stop_str_in_output` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2755 |
| W1272 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.language` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2756 |
| W1273 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.length_penalty` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2757 |
| W1274 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.max_completion_tokens` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2758 |
| W1275 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.model` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2760 |
| W1276 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.n` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2761 |
| W1277 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.prompt` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2763 |
| W1278 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.response_format` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2765 |
| W1279 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.seed` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2766 |
| W1280 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.stream` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2767 |
| W1281 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.stream_continuous_usage_stats` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2768 |
| W1282 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.stream_include_usage` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2769 |
| W1283 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.temperature` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2770 |
| W1284 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.to_language` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2771 |
| W1285 | D2 | `vllm.TranslationRequest@vllm/entrypoints/speech_to_text/translation/protocol.py.use_beam_search` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P2774 |
| W1321 | D2 | `vllm.cli@vllm/entrypoints/grpc_server.py.host` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P0981 |
| W1322 | D2 | `vllm.cli@vllm/entrypoints/grpc_server.py.port` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P0982 |
| W1436 | D2 | `vllm.frontend.grpc` | 拟新增：wiki/concepts/compatible-api-parameters.md | 1 | P0989 |
| W0551 | D3 | `tool.vllm/benchmarks/datasets/create_txt_slices_dataset.py.input` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P0999 |
| W0552 | D3 | `tool.vllm/benchmarks/datasets/create_txt_slices_dataset.py.input_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1000 |
| W0553 | D3 | `tool.vllm/benchmarks/datasets/create_txt_slices_dataset.py.num_prompts` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1001 |
| W0554 | D3 | `tool.vllm/benchmarks/datasets/create_txt_slices_dataset.py.output` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1002 |
| W0555 | D3 | `tool.vllm/benchmarks/datasets/create_txt_slices_dataset.py.output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1003 |
| W0556 | D3 | `tool.vllm/benchmarks/datasets/create_txt_slices_dataset.py.range_ratio` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1004 |
| W0557 | D3 | `tool.vllm/benchmarks/datasets/create_txt_slices_dataset.py.seed` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1005 |
| W0558 | D3 | `tool.vllm/benchmarks/datasets/create_txt_slices_dataset.py.tokenizer` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1006 |
| W0559 | D3 | `tool.vllm/benchmarks/datasets/create_txt_slices_dataset.py.trust_remote_code` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1007 |
| W0560 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.asr_max_audio_len_sec` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1008 |
| W0561 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.asr_min_audio_len_sec` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1009 |
| W0562 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.blazedit_max_distance` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1011 |
| W0563 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.blazedit_min_distance` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1012 |
| W0564 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.custom_ensure_client_side_data` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1013 |
| W0565 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.custom_output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1014 |
| W0566 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.dataset_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1015 |
| W0567 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.dataset_path` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1016 |
| W0568 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.disable_shuffle` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1017 |
| W0569 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.enable_multimodal_chat` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1018 |
| W0570 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.hf_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1019 |
| W0571 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.hf_output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1020 |
| W0572 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.hf_split` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1021 |
| W0573 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.hf_subset` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1022 |
| W0574 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.no_oversample` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1023 |
| W0575 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.no_reranker` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1024 |
| W0576 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.no_stream` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1025 |
| W0577 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.num_prompts` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1026 |
| W0578 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.prefix_repetition_num_prefixes` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1027 |
| W0579 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.prefix_repetition_output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1028 |
| W0580 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.prefix_repetition_prefix_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1029 |
| W0581 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.prefix_repetition_suffix_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1030 |
| W0582 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.random_batch_size` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1031 |
| W0583 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.random_input_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1032 |
| W0584 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.random_mm_base_items_per_request` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1033 |
| W0585 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.random_mm_bucket_config` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1034 |
| W0586 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.random_mm_limit_mm_per_prompt` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1035 |
| W0587 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.random_mm_num_mm_items_range_ratio` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1036 |
| W0588 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.random_output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1037 |
| W0589 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.random_prefix_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1038 |
| W0590 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.random_range_ratio` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1039 |
| W0591 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.seed` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1040 |
| W0592 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.sharegpt_output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1041 |
| W0593 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.skip_chat_template` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1042 |
| W0594 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.sonnet_input_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1043 |
| W0595 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.sonnet_output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1044 |
| W0596 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.sonnet_prefix_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1045 |
| W0597 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.spec_bench_category` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1046 |
| W0598 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.spec_bench_output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1047 |
| W0599 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.speed_bench_category` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1048 |
| W0600 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.speed_bench_dataset_subset` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1049 |
| W0601 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.speed_bench_output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1050 |
| W0602 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.timed_trace_chunk_hash_size` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1051 |
| W0603 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.timed_trace_label_hash_ids` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1052 |
| W0604 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.timed_trace_label_input_length` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1053 |
| W0605 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.timed_trace_label_output_length` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1054 |
| W0606 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.timed_trace_label_timestamp` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1055 |
| W0607 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.timed_trace_sec_multiplier` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1056 |
| W0608 | D3 | `tool.vllm/benchmarks/datasets/datasets.py.trust_remote_code` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1057 |
| W0609 | D3 | `tool.vllm/benchmarks/latency.py.batch_size` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1058 |
| W0610 | D3 | `tool.vllm/benchmarks/latency.py.disable_detokenize` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1059 |
| W0611 | D3 | `tool.vllm/benchmarks/latency.py.input_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1060 |
| W0612 | D3 | `tool.vllm/benchmarks/latency.py.n` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1061 |
| W0613 | D3 | `tool.vllm/benchmarks/latency.py.num_iters` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1062 |
| W0614 | D3 | `tool.vllm/benchmarks/latency.py.num_iters_warmup` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1063 |
| W0615 | D3 | `tool.vllm/benchmarks/latency.py.output_json` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1064 |
| W0616 | D3 | `tool.vllm/benchmarks/latency.py.output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1065 |
| W0617 | D3 | `tool.vllm/benchmarks/latency.py.profile` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1066 |
| W0618 | D3 | `tool.vllm/benchmarks/latency.py.use_beam_search` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1067 |
| W0619 | D3 | `tool.vllm/benchmarks/mm_processor.py.dataset_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1068 |
| W0620 | D3 | `tool.vllm/benchmarks/mm_processor.py.dataset_path` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1069 |
| W0621 | D3 | `tool.vllm/benchmarks/mm_processor.py.disable_tqdm` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1070 |
| W0622 | D3 | `tool.vllm/benchmarks/mm_processor.py.hf_split` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1071 |
| W0623 | D3 | `tool.vllm/benchmarks/mm_processor.py.hf_subset` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1072 |
| W0624 | D3 | `tool.vllm/benchmarks/mm_processor.py.metric_percentiles` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1073 |
| W0625 | D3 | `tool.vllm/benchmarks/mm_processor.py.num_prompts` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1074 |
| W0626 | D3 | `tool.vllm/benchmarks/mm_processor.py.num_warmups` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1075 |
| W0627 | D3 | `tool.vllm/benchmarks/mm_processor.py.output_json` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1076 |
| W0628 | D3 | `tool.vllm/benchmarks/mm_processor.py.output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1077 |
| W0629 | D3 | `tool.vllm/benchmarks/serve.py.append_result` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1078 |
| W0630 | D3 | `tool.vllm/benchmarks/serve.py.backend` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1079 |
| W0631 | D3 | `tool.vllm/benchmarks/serve.py.base_url` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1080 |
| W0632 | D3 | `tool.vllm/benchmarks/serve.py.burstiness` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1081 |
| W0633 | D3 | `tool.vllm/benchmarks/serve.py.chat_template_kwargs` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1082 |
| W0634 | D3 | `tool.vllm/benchmarks/serve.py.disable_tqdm` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1083 |
| W0635 | D3 | `tool.vllm/benchmarks/serve.py.endpoint` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1084 |
| W0636 | D3 | `tool.vllm/benchmarks/serve.py.extra_body` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1085 |
| W0637 | D3 | `tool.vllm/benchmarks/serve.py.frequency_penalty` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1086 |
| W0638 | D3 | `tool.vllm/benchmarks/serve.py.goodput` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1087 |
| W0639 | D3 | `tool.vllm/benchmarks/serve.py.header` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1088 |
| W0640 | D3 | `tool.vllm/benchmarks/serve.py.host` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1089 |
| W0641 | D3 | `tool.vllm/benchmarks/serve.py.ignore_eos` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1090 |
| W0642 | D3 | `tool.vllm/benchmarks/serve.py.input_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1091 |
| W0643 | D3 | `tool.vllm/benchmarks/serve.py.insecure` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1092 |
| W0644 | D3 | `tool.vllm/benchmarks/serve.py.label` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1093 |
| W0645 | D3 | `tool.vllm/benchmarks/serve.py.logprobs` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1094 |
| W0646 | D3 | `tool.vllm/benchmarks/serve.py.lora_assignment` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1095 |
| W0647 | D3 | `tool.vllm/benchmarks/serve.py.lora_modules` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1096 |
| W0648 | D3 | `tool.vllm/benchmarks/serve.py.max_concurrency` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1097 |
| W0649 | D3 | `tool.vllm/benchmarks/serve.py.metadata` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1098 |
| W0650 | D3 | `tool.vllm/benchmarks/serve.py.metric_percentiles` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1099 |
| W0651 | D3 | `tool.vllm/benchmarks/serve.py.min_p` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1100 |
| W0652 | D3 | `tool.vllm/benchmarks/serve.py.model` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1101 |
| W0653 | D3 | `tool.vllm/benchmarks/serve.py.num_warmups` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1102 |
| W0654 | D3 | `tool.vllm/benchmarks/serve.py.output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1103 |
| W0655 | D3 | `tool.vllm/benchmarks/serve.py.percentile_metrics` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1104 |
| W0656 | D3 | `tool.vllm/benchmarks/serve.py.plot_dataset_stats` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1105 |
| W0657 | D3 | `tool.vllm/benchmarks/serve.py.plot_timeline` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1106 |
| W0658 | D3 | `tool.vllm/benchmarks/serve.py.port` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1107 |
| W0659 | D3 | `tool.vllm/benchmarks/serve.py.presence_penalty` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1108 |
| W0660 | D3 | `tool.vllm/benchmarks/serve.py.profile` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1110 |
| W0661 | D3 | `tool.vllm/benchmarks/serve.py.ramp_up_end_rps` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1111 |
| W0662 | D3 | `tool.vllm/benchmarks/serve.py.ramp_up_start_rps` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1112 |
| W0663 | D3 | `tool.vllm/benchmarks/serve.py.ramp_up_strategy` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1113 |
| W0664 | D3 | `tool.vllm/benchmarks/serve.py.ready_check_timeout_sec` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1114 |
| W0665 | D3 | `tool.vllm/benchmarks/serve.py.repetition_penalty` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1115 |
| W0666 | D3 | `tool.vllm/benchmarks/serve.py.request_id_prefix` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1116 |
| W0667 | D3 | `tool.vllm/benchmarks/serve.py.request_rate` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1117 |
| W0668 | D3 | `tool.vllm/benchmarks/serve.py.result_dir` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1118 |
| W0669 | D3 | `tool.vllm/benchmarks/serve.py.result_filename` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1119 |
| W0670 | D3 | `tool.vllm/benchmarks/serve.py.save_detailed` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1120 |
| W0671 | D3 | `tool.vllm/benchmarks/serve.py.save_result` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1121 |
| W0672 | D3 | `tool.vllm/benchmarks/serve.py.self_timed` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1122 |
| W0673 | D3 | `tool.vllm/benchmarks/serve.py.served_model_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1123 |
| W0674 | D3 | `tool.vllm/benchmarks/serve.py.skip_tokenizer_init` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1124 |
| W0675 | D3 | `tool.vllm/benchmarks/serve.py.temperature` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1125 |
| W0676 | D3 | `tool.vllm/benchmarks/serve.py.timeline_itl_thresholds` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1126 |
| W0677 | D3 | `tool.vllm/benchmarks/serve.py.tokenizer` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1127 |
| W0678 | D3 | `tool.vllm/benchmarks/serve.py.tokenizer_mode` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1128 |
| W0679 | D3 | `tool.vllm/benchmarks/serve.py.top_k` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1129 |
| W0680 | D3 | `tool.vllm/benchmarks/serve.py.top_p` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1130 |
| W0681 | D3 | `tool.vllm/benchmarks/serve.py.use_beam_search` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1131 |
| W0682 | D3 | `tool.vllm/benchmarks/startup.py.num_iters_cold` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1132 |
| W0683 | D3 | `tool.vllm/benchmarks/startup.py.num_iters_warm` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1133 |
| W0684 | D3 | `tool.vllm/benchmarks/startup.py.num_iters_warmup` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1134 |
| W0685 | D3 | `tool.vllm/benchmarks/startup.py.output_json` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1135 |
| W0686 | D3 | `tool.vllm/benchmarks/sweep/plot.py.bin_by` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1136 |
| W0687 | D3 | `tool.vllm/benchmarks/sweep/plot.py.col_by` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1137 |
| W0688 | D3 | `tool.vllm/benchmarks/sweep/plot.py.curve_by` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1138 |
| W0689 | D3 | `tool.vllm/benchmarks/sweep/plot.py.dry_run` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1139 |
| W0690 | D3 | `tool.vllm/benchmarks/sweep/plot.py.fig_by` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1140 |
| W0691 | D3 | `tool.vllm/benchmarks/sweep/plot.py.fig_dir` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1141 |
| W0692 | D3 | `tool.vllm/benchmarks/sweep/plot.py.fig_dpi` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1142 |
| W0693 | D3 | `tool.vllm/benchmarks/sweep/plot.py.fig_height` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1143 |
| W0694 | D3 | `tool.vllm/benchmarks/sweep/plot.py.fig_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1144 |
| W0695 | D3 | `tool.vllm/benchmarks/sweep/plot.py.filter_by` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1145 |
| W0696 | D3 | `tool.vllm/benchmarks/sweep/plot.py.no_error_bars` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1146 |
| W0697 | D3 | `tool.vllm/benchmarks/sweep/plot.py.row_by` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1147 |
| W0698 | D3 | `tool.vllm/benchmarks/sweep/plot.py.scale_x` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1148 |
| W0699 | D3 | `tool.vllm/benchmarks/sweep/plot.py.scale_y` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1149 |
| W0700 | D3 | `tool.vllm/benchmarks/sweep/plot.py.var_x` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1150 |
| W0701 | D3 | `tool.vllm/benchmarks/sweep/plot.py.var_y` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1151 |
| W0702 | D3 | `tool.vllm/benchmarks/sweep/plot_pareto.py.dry_run` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1152 |
| W0703 | D3 | `tool.vllm/benchmarks/sweep/plot_pareto.py.gpu_count_var` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1153 |
| W0704 | D3 | `tool.vllm/benchmarks/sweep/plot_pareto.py.label_by` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1154 |
| W0705 | D3 | `tool.vllm/benchmarks/sweep/plot_pareto.py.user_count_var` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1155 |
| W0706 | D3 | `tool.vllm/benchmarks/sweep/serve.py.after_bench_cmd` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1156 |
| W0707 | D3 | `tool.vllm/benchmarks/sweep/serve.py.bench_cmd` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1157 |
| W0708 | D3 | `tool.vllm/benchmarks/sweep/serve.py.bench_params` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1158 |
| W0709 | D3 | `tool.vllm/benchmarks/sweep/serve.py.dry_run` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1159 |
| W0710 | D3 | `tool.vllm/benchmarks/sweep/serve.py.experiment_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1160 |
| W0711 | D3 | `tool.vllm/benchmarks/sweep/serve.py.link_vars` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1161 |
| W0712 | D3 | `tool.vllm/benchmarks/sweep/serve.py.num_runs` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1162 |
| W0713 | D3 | `tool.vllm/benchmarks/sweep/serve.py.output_dir` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1163 |
| W0714 | D3 | `tool.vllm/benchmarks/sweep/serve.py.resume` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1164 |
| W0715 | D3 | `tool.vllm/benchmarks/sweep/serve.py.serve_cmd` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1165 |
| W0716 | D3 | `tool.vllm/benchmarks/sweep/serve.py.serve_params` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1166 |
| W0717 | D3 | `tool.vllm/benchmarks/sweep/serve.py.server_ready_timeout` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1167 |
| W0718 | D3 | `tool.vllm/benchmarks/sweep/serve.py.show_stdout` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1168 |
| W0719 | D3 | `tool.vllm/benchmarks/sweep/serve_workload.py.workload_iters` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1169 |
| W0720 | D3 | `tool.vllm/benchmarks/sweep/serve_workload.py.workload_var` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1170 |
| W0721 | D3 | `tool.vllm/benchmarks/sweep/startup.py.dry_run` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1171 |
| W0722 | D3 | `tool.vllm/benchmarks/sweep/startup.py.experiment_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1172 |
| W0723 | D3 | `tool.vllm/benchmarks/sweep/startup.py.num_runs` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1173 |
| W0724 | D3 | `tool.vllm/benchmarks/sweep/startup.py.output_dir` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1174 |
| W0725 | D3 | `tool.vllm/benchmarks/sweep/startup.py.resume` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1175 |
| W0726 | D3 | `tool.vllm/benchmarks/sweep/startup.py.serve_params` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1176 |
| W0727 | D3 | `tool.vllm/benchmarks/sweep/startup.py.show_stdout` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1177 |
| W0728 | D3 | `tool.vllm/benchmarks/sweep/startup.py.startup_cmd` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1178 |
| W0729 | D3 | `tool.vllm/benchmarks/sweep/startup.py.startup_params` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1179 |
| W0730 | D3 | `tool.vllm/benchmarks/sweep/startup.py.strict_params` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1180 |
| W0731 | D3 | `tool.vllm/benchmarks/throughput.py.asr_max_audio_len_sec` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1181 |
| W0732 | D3 | `tool.vllm/benchmarks/throughput.py.asr_min_audio_len_sec` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1182 |
| W0733 | D3 | `tool.vllm/benchmarks/throughput.py.async_engine` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1183 |
| W0734 | D3 | `tool.vllm/benchmarks/throughput.py.backend` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1184 |
| W0735 | D3 | `tool.vllm/benchmarks/throughput.py.dataset` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1186 |
| W0736 | D3 | `tool.vllm/benchmarks/throughput.py.dataset_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1187 |
| W0737 | D3 | `tool.vllm/benchmarks/throughput.py.dataset_path` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1188 |
| W0738 | D3 | `tool.vllm/benchmarks/throughput.py.disable_detokenize` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1189 |
| W0739 | D3 | `tool.vllm/benchmarks/throughput.py.hf_enable_torch_compile` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1191 |
| W0740 | D3 | `tool.vllm/benchmarks/throughput.py.hf_max_batch_size` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1192 |
| W0741 | D3 | `tool.vllm/benchmarks/throughput.py.hf_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1193 |
| W0742 | D3 | `tool.vllm/benchmarks/throughput.py.hf_split` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1194 |
| W0743 | D3 | `tool.vllm/benchmarks/throughput.py.hf_subset` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1195 |
| W0744 | D3 | `tool.vllm/benchmarks/throughput.py.input_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1196 |
| W0745 | D3 | `tool.vllm/benchmarks/throughput.py.lora_assignment` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1197 |
| W0746 | D3 | `tool.vllm/benchmarks/throughput.py.lora_path` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1198 |
| W0747 | D3 | `tool.vllm/benchmarks/throughput.py.n` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1199 |
| W0748 | D3 | `tool.vllm/benchmarks/throughput.py.num_prompts` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1201 |
| W0749 | D3 | `tool.vllm/benchmarks/throughput.py.num_warmups` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1202 |
| W0750 | D3 | `tool.vllm/benchmarks/throughput.py.output_json` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1203 |
| W0751 | D3 | `tool.vllm/benchmarks/throughput.py.output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1204 |
| W0752 | D3 | `tool.vllm/benchmarks/throughput.py.prefix_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1205 |
| W0753 | D3 | `tool.vllm/benchmarks/throughput.py.prefix_repetition_num_prefixes` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1206 |
| W0754 | D3 | `tool.vllm/benchmarks/throughput.py.prefix_repetition_output_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1207 |
| W0755 | D3 | `tool.vllm/benchmarks/throughput.py.prefix_repetition_prefix_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1208 |
| W0756 | D3 | `tool.vllm/benchmarks/throughput.py.prefix_repetition_suffix_len` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1209 |
| W0757 | D3 | `tool.vllm/benchmarks/throughput.py.prequeue_requests` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1210 |
| W0758 | D3 | `tool.vllm/benchmarks/throughput.py.profile` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P1211 |
| W1315 | D3 | `vllm.cli@vllm/entrypoints/cli/openai.py.api_key` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P0974 |
| W1316 | D3 | `vllm.cli@vllm/entrypoints/cli/openai.py.max_tokens` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P0975 |
| W1317 | D3 | `vllm.cli@vllm/entrypoints/cli/openai.py.model_name` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P0976 |
| W1318 | D3 | `vllm.cli@vllm/entrypoints/cli/openai.py.quick` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P0977 |
| W1319 | D3 | `vllm.cli@vllm/entrypoints/cli/openai.py.system_prompt` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P0979 |
| W1320 | D3 | `vllm.cli@vllm/entrypoints/cli/openai.py.url` | [inference-benchmarking](../../../wiki/concepts/inference-benchmarking.md) | 1 | P0980 |
| W0034 | D4 | `ascend.additional_config.c8_enable_reshape_optim` | [c8-enable-reshape-optim-8bd7e5f82c6c](../../../wiki/params/c8-enable-reshape-optim-8bd7e5f82c6c.md) | 2 | P3873, P4466 |
| W0050 | D4 | `ascend.additional_config.enable_sleep_mode_extra_cleanup` | [enable-sleep-mode-extra-cleanup](../../../wiki/params/enable-sleep-mode-extra-cleanup.md) | 2 | P3891, P4478 |
