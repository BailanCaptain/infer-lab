/**
 * Realistic Ascend / CANN / HCCL / vLLM error log & `/metrics` fixtures
 * for Wave 4A Tool ③ (`troubleshoot-workbench` Panel A).
 *
 * Covers primary Ascend/CANN/HCCL/vLLM failure modes & `/metrics` snapshots,
 * including multi-rank interleaved First-Fault Rank attribution.
 */

export interface TroubleshootFixture {
  id: string;
  label: string;
  kind: "logs" | "metrics";
  summary: string;
  expectedRuleIds: readonly string[];
  content: string;
}

export const TROUBLESHOOT_FIXTURES: readonly TroubleshootFixture[] = [
  {
    id: "multi-rank-hccl-rank3-fault",
    label: "多卡 EI0002 假象（首错 Rank 3）",
    kind: "logs",
    summary:
      "Rank 0/1/2 在 10:12:35 报 HCCL EI0002 Notify wait execute timeout，但交错日志里 Rank 3 早在 10:11:05 已触发 NPU OOM 与 EZ9999。",
    expectedRuleIds: ["oom-stage-split", "hccl-timeout-cascade"],
    content: [
      "2026-04-12 10:10:58.104 INFO [Worker_TP0] [Rank 0] Available KV cache memory: 24.80 GiB",
      "2026-04-12 10:10:58.118 INFO [Worker_TP1] [Rank 1] Available KV cache memory: 24.80 GiB",
      "2026-04-12 10:10:58.122 INFO [Worker_TP2] [Rank 2] Available KV cache memory: 24.80 GiB",
      "2026-04-12 10:10:58.131 INFO [Worker_TP3] [Rank 3] Available KV cache memory: 24.80 GiB",
      "2026-04-12 10:12:35.402 ERROR [Worker_TP0] [Rank 0] HCCL_E_WAIT_TIMEOUT: EI0002 Notify wait execute timeout on AllReduce group tp_0",
      "2026-04-12 10:12:35.419 ERROR [Worker_TP1] [Rank 1] EI0002 Notify wait execute timeout during collective AllReduce",
      "2026-04-12 10:12:35.437 ERROR [Worker_TP2] [Rank 2] Watchdog caught collective operation timeout: EI0002 Notify wait execute timeout",
      "2026-04-12 10:11:05.214 ERROR [Worker_TP3] [Rank 3] RuntimeError: NPU out of memory. Tried to allocate 1.24 GiB during capture_model() aclgraph pool init",
      "2026-04-12 10:11:05.229 ERROR [Worker_TP3] [Rank 3] EZ9999: Inner Error! ACL_ERROR_RT_MEMORY_ALLOCATION failed on device 3",
      "2026-04-12 10:12:36.011 ERROR [EngineCore_DP0] EngineCoreProc(DP0) died unexpectedly, shutting down client.",
    ].join("\n"),
  },
  {
    id: "pre-profile-free-memory",
    label: "启动预检显存不足（init_snapshot）",
    kind: "logs",
    summary: "尚未进入权重加载即在 worker.py init_snapshot 校验抛出 ValueError（残余进程占用或 u 偏高）。",
    expectedRuleIds: ["pre-profile-free-memory"],
    content: [
      "2026-04-12 09:02:11.012 INFO [Rank 0] Initializing NPUWorker on Ascend910B2 (64.00 GiB HBM)",
      "2026-04-12 09:02:12.440 ERROR [Rank 0] Traceback (most recent call last):",
      '  File "vllm_ascend/worker/worker.py", line 465, in init_device',
      "    raise ValueError(",
      "ValueError: Free memory on device (41.20/64.00 GiB) on startup is less than desired GPU memory utilization (0.9, 57.60 GiB). Decrease GPU memory utilization or reduce GPU memory used by other processes.",
    ].join("\n"),
  },
  {
    id: "post-kv-aclgraph-oom",
    label: "KV 后图捕获期 OOM（u 过高）",
    kind: "logs",
    summary:
      "权重与 KV 池已分配完毕，却在 compile_or_warm_up_model / capture_model 阶段因 1 - u 余量耗尽报 NPU OOM。",
    expectedRuleIds: ["oom-stage-split"],
    content: [
      "2026-04-12 09:15:02.110 INFO [Rank 0] Model loading took 15.62 GiB and 12.4 seconds",
      "2026-04-12 09:15:18.304 INFO [Rank 0] Available KV cache memory: 41.80 GiB (gpu_memory_utilization=0.95)",
      "2026-04-12 09:15:21.778 INFO [Rank 0] Entering compile_or_warm_up_model() -> capture_model() for ACLGraph",
      "2026-04-12 09:15:26.905 ERROR [Rank 0] RuntimeError: NPU out of memory. Tried to allocate 768.00 MiB (ACL_ERROR_RT_MEMORY_ALLOCATION) while capturing aclgraph batch_size=64",
    ].join("\n"),
  },
  {
    id: "cold-start-weight-oom",
    label: "冷启动权重/试跑期 OOM",
    kind: "logs",
    summary: "权重加载或 profile_run 试跑阶段即耗尽 HBM，尚未走到 KV 池切分与图捕获。",
    expectedRuleIds: ["oom-stage-split"],
    content: [
      "2026-04-12 09:20:01.005 INFO [Rank 1] Starting load_model() for Qwen3-32B-BF16 on TP=1",
      "2026-04-12 09:20:19.442 ERROR [Rank 1] RuntimeError: NPU out of memory. Tried to allocate 2.50 GiB during load_weights on NPU:1",
    ].join("\n"),
  },
  {
    id: "exit-137-host-sigkill",
    label: "退出码 137 / SIGKILL（非 NPU OOM 铁证）",
    kind: "logs",
    summary: "子进程突然以 exitcode -9 / 137 退出且无 NPU OOM 栈——先查宿主机/容器 cgroup 内存与 OOMKilled。",
    expectedRuleIds: ["exit-137-sigkill"],
    content: [
      "2026-04-12 09:33:10.812 INFO [Rank 0] Loading safetensors checkpoint shards: 4/16",
      "2026-04-12 09:33:24.991 ERROR [EngineCore_DP0] EngineCoreProc died unexpectedly with exitcode: -9 (SIGKILL, container exit code 137)",
      "2026-04-12 09:33:25.004 ERROR [APIServer] RuntimeError: Engine core initialization failed. See root cause above.",
    ].join("\n"),
  },
  {
    id: "soc-310p-gqa-c8-compat",
    label: "310P / GQA+C8 校准权重不兼容",
    kind: "logs",
    summary:
      "GQA 模型开启 --kv-cache-dtype int8 却未提供 ModelSlim C8 静态校准权重，attention_v1.py 抛 ValueError。",
    expectedRuleIds: ["soc-310p-or-c8-compat"],
    content: [
      "2026-04-12 11:04:12.088 INFO [Rank 0] Loading GQA attention backend with kv_cache_dtype=int8",
      "2026-04-12 11:04:13.204 ERROR [Rank 0] Traceback (most recent call last):",
      '  File "vllm_ascend/attention/attention_v1.py", line 583, in __init__',
      "ValueError: The current GQA-related models adopt static quantization. KV quantization is configured via `--kv-cache-dtype` upon service startup, and the corresponding quantized weights are required.",
    ].join("\n"),
  },
  {
    id: "fa3-aclgraph-capture-fail",
    label: "FA3 + FULL_DECODE_ONLY 图捕获冲突",
    kind: "logs",
    summary:
      "启用 AscendFAImpl (FA3) 且使用 FULL_DECODE_ONLY 图捕获，fa3_v1.py 初始化阶段直接抛 ValueError。",
    expectedRuleIds: ["graph-capture-failure"],
    content: [
      "2026-04-12 11:18:40.015 WARNING [Rank 0] npugraph_ex is not supported by the current hardware profile. Disabling it.",
      "2026-04-12 11:18:41.390 ERROR [Rank 0] Traceback (most recent call last):",
      '  File "vllm_ascend/attention/fa3_v1.py", line 55, in __init__',
      "ValueError: AscendFAImpl does not support ACL graph capture with FULL_DECODE_ONLY mode. Please set enforce_eager=True or not set FULL_DECODE_ONLY or use the default FIA backend.",
    ].join("\n"),
  },
  {
    id: "metrics-kv-preemption",
    label: "/metrics：KV 池打满与累计抢占快照",
    kind: "metrics",
    summary:
      "vllm:kv_cache_usage_perc > 0.95 且累计计数器 num_preemptions_total > 0（本快照为 47）与 num_requests_waiting > 0。",
    expectedRuleIds: ["metrics-kv-preemption-storm"],
    content: [
      "# HELP vllm:kv_cache_usage_perc KV-cache usage. 1 means 100 percent usage.",
      "# TYPE vllm:kv_cache_usage_perc gauge",
      'vllm:kv_cache_usage_perc{engine="0",model_name="Qwen3-32B"} 0.982',
      "# TYPE vllm:num_requests_running gauge",
      'vllm:num_requests_running{engine="0",model_name="Qwen3-32B"} 64',
      "# TYPE vllm:num_requests_waiting gauge",
      'vllm:num_requests_waiting{engine="0",model_name="Qwen3-32B"} 19',
      "# TYPE vllm:num_preemptions_total counter",
      'vllm:num_preemptions_total{engine="0",model_name="Qwen3-32B"} 47',
      'vllm:inter_token_latency_seconds_sum{engine="0",model_name="Qwen3-32B"} 142.8',
      'vllm:inter_token_latency_seconds_count{engine="0",model_name="Qwen3-32B"} 920',
    ].join("\n"),
  },
  {
    id: "metrics-low-kv-decode-slow",
    label: "/metrics：低 KV 零排队但 Decode 慢",
    kind: "metrics",
    summary:
      "KV 使用率仅 24%、排队为 0，但平均 ITL 高达 142 ms/tok——排除排队与容量，直指 Host 空泡或带宽瓶颈。",
    expectedRuleIds: ["metrics-low-kv-high-latency"],
    content: [
      "# TYPE vllm:kv_cache_usage_perc gauge",
      'vllm:kv_cache_usage_perc{engine="0",model_name="Qwen3-32B"} 0.24',
      "# TYPE vllm:num_requests_running gauge",
      'vllm:num_requests_running{engine="0",model_name="Qwen3-32B"} 4',
      "# TYPE vllm:num_requests_waiting gauge",
      'vllm:num_requests_waiting{engine="0",model_name="Qwen3-32B"} 0',
      "# TYPE vllm:num_preemptions_total counter",
      'vllm:num_preemptions_total{engine="0",model_name="Qwen3-32B"} 0',
      'vllm:time_to_first_token_seconds_sum{engine="0",model_name="Qwen3-32B"} 48.0',
      'vllm:time_to_first_token_seconds_count{engine="0",model_name="Qwen3-32B"} 100',
      'vllm:inter_token_latency_seconds_sum{engine="0",model_name="Qwen3-32B"} 142.0',
      'vllm:inter_token_latency_seconds_count{engine="0",model_name="Qwen3-32B"} 1000',
    ].join("\n"),
  },
  {
    id: "pure-hccl-timeout-no-primary",
    label: "纯 EI0002 缺首错卡（防误判 Rank 0）",
    kind: "logs",
    summary: "只贴了多卡 EI0002 超时而无前序主错误——工作台明确报 low 置信度并拒绝甩锅 Rank 0。",
    expectedRuleIds: ["hccl-timeout-cascade"],
    content: [
      "2026-04-12 14:22:10.105 ERROR [Rank 0] EI0002 Notify wait execute timeout in HCCL AllReduce",
      "2026-04-12 14:22:10.121 ERROR [Rank 1] HCCL_E_WAIT_TIMEOUT: Notify wait execute timeout",
      "2026-04-12 14:22:10.144 ERROR [Rank 2] Watchdog caught collective operation timeout",
    ].join("\n"),
  },
  {
    id: "real-910b3-u090-aclgraph-oom",
    label: "910B3 实测：u=0.90 录图期 OOM [M]",
    kind: "logs",
    summary:
      "Ascend 910B3 真机捕获：Qwen3-0.6B 在 OS 可见 60.96 GiB 下设 u=0.90，KV 池划走 53.47 GiB（500,480 tokens / max_len 4,096 / 122.19x）并通过 35 档 PIECEWISE 后，在 FULL Decode 捕获期 device_op.py:216 FIA 申请 1.98 GiB（仅剩 1.71 GiB）触发 torch.OutOfMemoryError。",
    expectedRuleIds: ["oom-stage-split"],
    content: [
      "(EngineCore pid=35805) INFO 11-22 20:58:45 [model_runner_v1.py:4476] Loading model weights took 1.1397 GB",
      "(EngineCore pid=35805) INFO 11-22 20:59:23 [worker.py:660] Available KV cache memory: 53.47 GiB",
      "(EngineCore pid=35805) INFO 11-22 20:59:23 [kv_cache_utils.py:2395] NPU KV cache size: 500,480 tokens, Maximum concurrency for 4,096 tokens per request: 122.19x",
      '(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]   File "/mnt/workspace/src/vllm_ascend-0.30.0/vllm_ascend/worker/model_runner_v1.py", line 6613, in capture_model',
      "(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]     cuda_graph_size = GPUModelRunner.capture_model(self)",
      '(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]   File "/mnt/workspace/src/vllm_ascend-0.30.0/vllm_ascend/device/device_op.py", line 216, in npu_fused_infer_attention_score',
      "(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]     return torch_npu.npu_fused_infer_attention_score(",
      "(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 1.98 GiB (NPU 0; 60.96 GiB total capacity; 54.62 GiB already allocated; 54.62 GiB current active; 1.71 GiB free; 58.75 GiB reserved in total by PyTorch).If reserved memory is >> allocated memory try setting max_split_size_mb to avoid fragmentation.",
      '(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]   File "/mnt/workspace/src/vllm_ascend-0.30.0/vllm_ascend/worker/worker.py", line 909, in compile_or_warm_up_model',
      "(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]     npugraph_memory_bytes = self.model_runner.capture_model()",
    ].join("\n"),
  },
  {
    id: "real-910b3-sleep-nz-wakeup",
    label: "910B3 实测：Sleep 唤醒 FRACTAL_NZ 报错 [M]",
    kind: "logs",
    summary:
      "Ascend 910B3 真机捕获：Qwen3-8B (BF16) 开启 --enable-sleep-mode 后 sleep(level=1) 卸载成功，但 wake_up() 因配置项默认 weight_nz_mode=1 非零触发 worker.py:282 守卫抛 ValueError（即使 BF16 按 utils.py:373-386 并未转 NZ）。",
    expectedRuleIds: ["sleep-mode-fractal-nz-wakeup"],
    content: [
      "(EngineCore pid=42268) INFO 11-22 21:47:59 [camem.py:198] CaMem sleep: offloading 151/187 allocations (tags=('weights',))",
      "(EngineCore pid=42268) INFO 11-22 21:48:16 [worker.py:272] Sleep mode (level=1) freed 48.37 GiB memory, 3.02 GiB memory is still in use.",
      "(EngineCore pid=42268) ERROR 11-22 21:48:17 [core.py:1609] Invocation of wake_up method failed",
      '(EngineCore pid=42268) ERROR 11-22 21:48:17 [core.py:1609]   File "/mnt/workspace/src/vllm_ascend-0.30.0/vllm_ascend/worker/worker.py", line 282, in wake_up',
      "(EngineCore pid=42268) ERROR 11-22 21:48:17 [core.py:1609] ValueError: FRACTAL_NZ mode is enabled. This may cause model parameter precision issues in the RL scenarios. Please set weight_nz_mode=0 via --additional-config, or enable additional_config.rl_config (enabled: true) which disables NZ automatically.",
    ].join("\n"),
  },
  {
    id: "real-910b3-pd-mooncake-config",
    label: "910B3 实测：PD 双故障组合样例（TP 整除 + kv_both） [M]",
    kind: "logs",
    summary:
      "【双故障组合诊断样例，非单次故障时序】合并 8×Ascend 910B3 两次独立失败标本：① pid=66409（err1）TP_P=2 不能整除 TP_D=4 在 ascend_config.py:879-884 触发 VllmConfig AssertionError；② pid=66950（err2）MooncakeConnectorV2（解析为 MooncakePullConnector）误传 kv_role='kv_both' 在 base_worker.py:116 抛 ValueError。",
    expectedRuleIds: ["mooncake-pd-transfer-error"],
    content: [
      "(APIServer pid=66409) pydantic_core._pydantic_core.ValidationError: 1 validation error for VllmConfig",
      "(APIServer pid=66409)   Assertion failed, Prefill TP size must be divisible by Decode TP size. [type=assertion_error, input_value=ArgsKwargs((), {'model_co... 'shutdown_timeout': 0}), input_type=ArgsKwargs]",
      "(EngineCore pid=66950) INFO 11-23 03:00:15 [factory.py:62] Creating v1 connector with name: MooncakePullConnector",
      '(EngineCore pid=66950) ERROR 11-23 03:00:15 [core.py:1366]   File "/mnt/workspace/src/vllm_ascend-0.30.0/vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py", line 116, in __init__',
      "(EngineCore pid=66950) ERROR 11-23 03:00:15 [core.py:1366] ValueError: Mooncake worker requires exactly one KV transfer role, got 'kv_both'",
    ].join("\n"),
  },
  {
    id: "real-910b3-gqa-static-c8-kv",
    label: "910B3 实测：未量化 GQA 开启 int8 KV 报错（err3） [M]",
    kind: "logs",
    summary:
      "8×Ascend 910B3 真机捕获（err3，含正常 MooncakeConnectorV1 与 1836s HCCL 配置行）：未量化 BF16 Qwen3-0.6B 传入 --kv-cache-dtype int8，在 attention_v1.py:583 抛静态量化权重缺失 ValueError（保留原件 U+2011 不换行连字符 `‑`）。",
    expectedRuleIds: ["soc-310p-or-c8-compat"],
    content: [
      "(APIServer pid=67670) INFO 11-23 03:00:44 [api_utils.py:286] non-default args: {'model_tag': '/mnt/workspace/models/Qwen3-0.6B', 'port': 19903, 'model': '/mnt/workspace/models/Qwen3-0.6B', 'enforce_eager': True, 'kv_cache_dtype': 'int8', 'kv_transfer_config': KVTransferConfig(kv_connector='MooncakeConnectorV1', engine_id='1cd5ffe8-8116-4248-8295-1d67c1fb3eb6', kv_buffer_device='npu', kv_buffer_size=1000000000.0, kv_role='kv_producer', kv_rank=None, kv_parallel_size=1, kv_ip='127.0.0.1', kv_port=31200, kv_connector_extra_config={'prefill': {'dp_size': 1, 'tp_size': 1}, 'decode': {'dp_size': 1, 'tp_size': 1}}, kv_connector_module_path=None, enable_permute_local_kv=False, kv_load_failure_policy='fail')}",
      "(APIServer pid=67670) INFO 11-23 03:00:44 [platform.py:945] The timeout interval of the HCCL operator is 1836s. Timeout in seconds for execute_model RPC calls in multiprocessing must be greater than 1836s, Set VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS=3000",
      '(EngineCore pid=67937) ERROR 11-23 03:01:14 [core.py:1366]   File "/mnt/workspace/src/vllm_ascend-0.30.0/vllm_ascend/attention/attention_v1.py", line 583, in __init__',
      "(EngineCore pid=67937) ERROR 11-23 03:01:14 [core.py:1366]     raise ValueError(",
      "(EngineCore pid=67937) ERROR 11-23 03:01:14 [core.py:1366] ValueError: The current GQA\u2011related models adopt static quantization. KV quantization is configured via `--kv\u2011cache\u2011dtype` upon service startup, and the corresponding quantized weights are required.",
      "(APIServer pid=67670) RuntimeError: Engine core initialization failed. See root cause above. Failed core proc(s): {}",
    ].join("\n"),
  },
  {
    id: "real-910b3-mooncake-adxl-fallback",
    label: "910B3 实测：Mooncake ADXL 端点回退刷屏 [M]",
    kind: "logs",
    summary:
      "8×Ascend 910B3 真机捕获（Qwen3-8B 2P2D D 端日志）：跨实例拉取 216 段离散 KV 时，transfer_executor_base.cpp:64 因 Dest buffer device_id=1 >= endpoint count 1 连续刷出 4,991 行回退告警（30B 4P4D 达 19,941 行），放大首字延迟。",
    expectedRuleIds: ["mooncake-adxl-endpoint-fallback"],
    content: [
      "(Worker_TP0 pid=5153) INFO 11-23 07:24:02 [mooncake_connector.py:1053] KV cache transfer for request cmpl-65d5fa5d-e37e-41e6-8210-691266996be8-0-9888c32d took 207.49 ms. local_ip 192.168.88.208 local_device_id 0 remote_session_id 192.168.88.208:16506",
      "(Worker_TP1 pid=5155) INFO 11-23 07:24:02 [mooncake_connector.py:1053] KV cache transfer for request cmpl-65d5fa5d-e37e-41e6-8210-691266996be8-0-9888c32d took 346.74 ms. local_ip 192.168.88.208 local_device_id 1 remote_session_id 192.168.88.208:16889",
      "W1123 07:23:51.968192  7379 transfer_executor_base.cpp:64] Dest buffer device_id=1 >= endpoint count 1, falling back to 192.168.88.208:20165",
      "W1123 07:23:51.968256  7379 transfer_executor_base.cpp:64] Dest buffer device_id=1 >= endpoint count 1, falling back to 192.168.88.208:20165",
      "W1123 07:23:51.968266  7379 transfer_executor_base.cpp:64] Dest buffer device_id=1 >= endpoint count 1, falling back to 192.168.88.208:20165",
      "W1123 07:24:46.036317  7385 transfer_executor_base.cpp:64] Dest buffer device_id=1 >= endpoint count 1, falling back to 192.168.88.208:20165",
    ].join("\n"),
  },
  {
    id: "real-910b3-debug-logging-ttft",
    label: "910B3 实测：DEBUG 日志热路径拖慢 TTFT [M]",
    kind: "logs",
    summary:
      "Ascend 910B3 真机捕获：误留 VLLM_LOGGING_LEVEL=DEBUG 触发 worker.py 每步 execute_model() 读取缓存分配器打日志（TP=8 达 3,312 行）及 acl_graph.py 回放前 data_ptr() 校验，使 Qwen3-8B TP=8 (c=1) TTFT 从 139.07 ms 升至 193.98 ms（+39.48%）。",
    expectedRuleIds: ["debug-logging-hotpath-overhead"],
    content: [
      "export VLLM_LOGGING_LEVEL=DEBUG",
      "(Worker_TP0 pid=35438) DEBUG 11-23 02:25:45 [worker.py:768] torch reserved memory: 54.21 GiB, torch allocated memory: 51.22 GiB",
      "(Worker_TP1 pid=35439) DEBUG 11-23 02:25:45 [worker.py:768] torch reserved memory: 54.21 GiB, torch allocated memory: 51.22 GiB",
      "(EngineCore pid=40516) DEBUG 11-22 21:38:20 [model_runner_v1.py:2392] Running batch with cudagraph_mode: FULL, batch_descriptor: BatchDescriptor(num_tokens=1, num_reqs=1, uniform=True, has_lora=False, num_active_loras=0), should_ubatch: False, num_tokens_across_dp: None",
    ].join("\n"),
  },
  {
    id: "cann-plog-smmu-0x26-fault",
    label: "CANN plog：507015 + CheckSmmuFault 越界首错",
    kind: "logs",
    summary:
      "社区脱敏标本（DP+TP+EP 多维进程名）：Python 层仅见笼统 error code 507015 与邻卡 EI0002，下钻同 PID 的 CANN RUNTIME plog 可见 CheckSmmuFault:Get isSmmuFault is 1、retCode=0x26 与故障 kernel_name。",
    expectedRuleIds: ["cann-plog-aicore-fault", "hccl-timeout-cascade"],
    content: [
      "(Worker_DP0_TP0_EP0 pid=289601) INFO 09-10 08:51:10 [worker.py:660] Available KV cache memory: 31.40 GiB",
      "(Worker_DP0_TP1_EP1 pid=289602) INFO 09-10 08:51:10 [worker.py:660] Available KV cache memory: 31.40 GiB",
      "(Worker_DP0_TP2_EP2 pid=289603) INFO 09-10 08:51:10 [worker.py:660] Available KV cache memory: 31.40 GiB",
      "(Worker_DP0_TP3_EP3 pid=289604) INFO 09-10 08:51:10 [worker.py:660] Available KV cache memory: 31.40 GiB",
      "[ERROR] RUNTIME(289603,):2026-09-10-08:52:37.461.278 [device_error_core_proc.cc:775]289907 CheckSmmuFault:Get isSmmuFault is 1.",
      "[ERROR] RUNTIME(289603,):2026-09-10-08:52:41.377.821 [stream.cc:1743]289907 GetError:Stream Synchronize failed, stream_id=47, retCode=0x26, [aicore exception].",
      "[ERROR] RUNTIME(289603,):2026-09-10-08:52:41.377.875 [stream.cc:1746]289907 GetError:[DFX_INFO]AI Core kernel execution failed, device_id=2, stream_id=47, fault kernel_name=MlaPrologV3_18fe44a5",
      "(Worker_DP0_TP2_EP2 pid=289603) ERROR 09-10 08:52:41 [multiproc_executor.py:987] RuntimeError: c10_npu::acl::AclrtSynchronizeStreamWithTimeout(stream()), error code is 507015",
      "(Worker_DP0_TP0_EP0 pid=289601) ERROR 09-10 08:55:42 [hccl_comm.py:112] HCCL_E_WAIT_TIMEOUT: EI0002 Notify wait execute timeout",
      "(Worker_DP0_TP1_EP1 pid=289602) ERROR 09-10 08:55:42 [hccl_comm.py:112] EI0002 Notify wait execute timeout during AllToAll",
    ].join("\n"),
  },
  {
    id: "zmq-port-conflict-cascade",
    label: "ZMQ/RPC 端口残留冲突（Address already in use）",
    kind: "logs",
    summary:
      "社区高频排障标本：前次异常退出的残留 vllm/python 子进程仍占用 ZMQ/Gloo 握手端口，导致 Rank 1 启动即抛 ZMQError: Address already in use 并拖垮 EngineCore。",
    expectedRuleIds: ["zmq-port-conflict"],
    content: [
      "(Worker_TP0 pid=14469) INFO 09-12 14:10:02 [parallel_state.py:420] Initializing distributed environment TP=2",
      "(Worker_TP1 pid=14470) ERROR 09-12 14:10:03 [multiproc_executor.py:888] zmq.error.ZMQError: Address already in use (addr='tcp://127.0.0.1:55671')",
      "(EngineCore_DP0 pid=14450) ERROR 09-12 14:10:04 [core.py:1366] RuntimeError: Engine core initialization failed. See root cause above.",
    ].join("\n"),
  },
  {
    id: "hccl-rasocket-ifname-cascade",
    label: "HCCL 网卡/RaSocket 建链失败 + 邻卡 EI0002 陪等",
    kind: "logs",
    summary:
      "Rank 3 因 HCCL_SOCKET_IFNAME=eth9 / HCCL_IF_IP 绑定与 RaSocketConnect No route to host 在建链期先失败，Rank 0/1/2 在 100s 后触发 EI0002 Notify wait execute timeout（3D 区分红色网卡断链与紫色陪等弧）。",
    expectedRuleIds: ["hccl-link-or-ifname-fault", "hccl-timeout-cascade"],
    content: [
      "2026-11-24 10:00:00.105 INFO [Worker_TP0] [Rank 0] Initializing HCCL communicator on enp65s0f0",
      "2026-11-24 10:00:00.112 INFO [Worker_TP1] [Rank 1] Initializing HCCL communicator on enp65s0f0",
      "2026-11-24 10:00:00.119 INFO [Worker_TP2] [Rank 2] Initializing HCCL communicator on enp65s0f0",
      "2026-11-24 10:00:00.125 INFO [Worker_TP3] [Rank 3] HCCL_SOCKET_IFNAME=eth9 HCCL_IF_IP=192.0.2.99",
      "[ERROR] HCCP(41003,python):2026-11-24-10:00:02.110.204 [Rank 3] [CANN HCCP internal plog] RaSocketBind failed on interface eth9: EADDRNOTAVAIL (Cannot assign requested address), HCCL_SOCKET_IFNAME bind failed.",
      "2026-11-24 10:00:02.118 ERROR [Worker_TP3] [Rank 3] EI0009: Device 3 transport init error. Reason: RaSocketConnect failed: No route to host 192.0.2.12:16666.",
      "2026-11-24 10:01:45.402 ERROR [Worker_TP0] [Rank 0] HCCL_E_WAIT_TIMEOUT: EI0002 Notify wait execute timeout on AllReduce group tp_0",
      "2026-11-24 10:01:45.419 ERROR [Worker_TP1] [Rank 1] EI0002 Notify wait execute timeout during collective AllReduce",
      "2026-11-24 10:01:45.437 ERROR [Worker_TP2] [Rank 2] Watchdog caught collective operation timeout: EI0002 Notify wait execute timeout",
    ].join("\n"),
  },
  {
    id: "torchair-ge-meta-compile-fault",
    label: "TorchAir / npugraph_ex 编译与 GE Host Tiling 失败",
    kind: "logs",
    summary:
      "torch.compile(fullgraph=True) 路由至 npugraph_ex/TorchAir 时因缺少自定义算子 Meta fake_impl 与 Host Tiling coreNum=0 / EZ3002 失败（不误报 Rule 13 AI Core SMMU 或 Rule 6 FA3）。",
    expectedRuleIds: ["torchair-ge-graph-compile-fault"],
    content: [
      "(Worker_TP0 pid=52010) INFO 11-24 11:02:10 [compiler_interface.py:320] enable_npugraph_ex is enabled, which will bring graph compilation optimization.",
      "(Worker_TP0 pid=52010) ERROR 11-24 11:02:15 [core.py:1366] Traceback (most recent call last):",
      '(Worker_TP0 pid=52010) ERROR 11-24 11:02:15 [core.py:1366]   File "vllm_ascend/compilation/compiler_interface.py", line 238, in npugraph_ex_compile',
      "(Worker_TP0 pid=52010) ERROR 11-24 11:02:15 [core.py:1366] torch._dynamo.exc.BackendCompilerFailed: backend='npugraph_ex' raised: RuntimeError: There was no fake impl registered for vllm_ascend::custom_sparse_op",
      "[ERROR] OP_HOST(52010,python):2026-11-24-11:02:15.301.112 [attn_res_fwd_tiling.cpp:197] coreNum is 0, tiling failed.",
      "[ERROR] GE(52010,python):2026-11-24-11:02:15.301.480 [graph_compiler] GE compile graph failed: EZ3002 unsupported op CheckMlaAttrs (EZ9999 retCode=0x1).",
    ].join("\n"),
  },
  {
    id: "moe-mc2-buffsize-too-small",
    label: "MoE MC2 融合算子窗口不足（HCCL_BUFFSIZE is too SMALL）",
    kind: "logs",
    summary:
      "A3 开启 enable_fused_mc2 后，DispatchFFNCombine Host Tiling 校验实际所需窗口为 16MB 而环境仅设 HCCL_BUFFSIZE=8MB，Rank 1 先失败并拖累 Rank 0 触发 EI0002。",
    expectedRuleIds: ["moe-mc2-or-modelslim-quant-fault", "hccl-timeout-cascade"],
    content: [
      "2026-11-24 12:10:01.010 INFO [Worker_TP0] [Rank 0] Creating MC2 dispatch/combine group for EP=2",
      "[ERROR] OP_HOST(61202,python):2026-11-24-12:10:02.180.005 [dispatch_ffn_combine_tiling.cpp:291] [Rank 1] DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, m = 128, k = 2048, topK = 8 expected HCCL_BUFFSIZE is ((m * k * topK * sizeof(int8_t)) * 3 + 3MB)= 16MB, HCCL_BUFFSIZE=8MB.",
      "2026-11-24 12:11:30.402 ERROR [Worker_TP0] [Rank 0] EI0002 Notify wait execute timeout during collective AllToAll",
    ].join("\n"),
  },
  {
    id: "modelslim-quant-config-missing",
    label: "msModelSlim 量化描述文件缺失（quant_model_description.json）",
    kind: "logs",
    summary:
      "启动携带 --quantization ascend，但权重目录缺少 quant_model_description.json，AscendModelSlimConfig 在加载阶段抛出 ValueError。",
    expectedRuleIds: ["moe-mc2-or-modelslim-quant-fault"],
    content: [
      "(APIServer pid=71001) ERROR 11-24 13:05:11 [modelslim_config.py:927] ModelSlim quantization config not found for model '/models/Qwen3-30B-A3B'. Searched path: /models/Qwen3-30B-A3B. Found JSON files: ['config.json', 'tokenizer.json'].",
      "(APIServer pid=71001) ERROR 11-24 13:05:11 [modelslim_config.py:933] ValueError: ERROR: ModelSlim Quantization Config Not Found — missing quant_model_description.json",
    ].join("\n"),
  },
  {
    id: "cann-driver-davinci-hal-init-fault",
    label: "容器设备挂载/HAL 驱动初始化失败（/dev/davinci_manager / 507008）",
    kind: "logs",
    summary:
      "容器内缺少 /dev/davinci_manager 设备节点或 libascend_hal.so 版本不匹配，worker.init_device() 阶段即报 aclrtGetPhyDevIdByUserDevId failed 与 507008 ACL_ERROR_RT_SOC_VERSION。",
    expectedRuleIds: ["cann-driver-or-device-env-fault"],
    content: [
      "(Worker_TP0 pid=81001) ERROR 11-24 14:20:01 [worker.py:440] OSError: /dev/davinci_manager: No such file or directory (container mount missing)",
      "(Worker_TP0 pid=81001) ERROR 11-24 14:20:01 [torch_binding.cpp:129] RuntimeError: aclrtGetPhyDevIdByUserDevId failed for user device 0, error code: 507008 (ACL_ERROR_RT_SOC_VERSION)",
      "(Worker_TP0 pid=81001) ERROR 11-24 14:20:01 [hal_loader] ImportError: libascend_hal.so: cannot open shared object file: No such file or directory",
    ].join("\n"),
  },
  {
    id: "worker-segfault-exit-139",
    label: "Worker 进程触发 SIGSEGV 段错误退出（exit code 139 / -11）",
    kind: "logs",
    summary:
      "底层 C++/CANN 扩展访问非法地址触发 OS SIGSEGV（signal 11 / exit code 139），导致 Rank 1 Worker 异常终止。",
    expectedRuleIds: ["exit-139-sigsegv"],
    content: [
      "2026-11-24 15:01:02 INFO [launcher.py:88] Starting vLLM Worker processes on Ascend NPU",
      "2026-11-24 15:02:19 ERROR [Rank 1] Worker process terminated by signal SIGSEGV (exitcode=-11, returncode=139)",
    ].join("\n"),
  },
  {
    id: "aclnn-opapi-param-161002",
    label: "CANN aclnn 算子参数校验失败（161002 / EZ1001）",
    kind: "logs",
    summary:
      "自定义/融合算子在 Host 参数校验阶段返回 161002 (ACLNN_ERR_PARAM_INVALID) 与 AclNN_Parameter_Error(EZ1001)。",
    expectedRuleIds: ["cann-opapi-or-aclnn-fault"],
    content: [
      "(Worker_TP0 pid=92001) ERROR 11-24 15:10:03 [custom_ops.py:142] RuntimeError: call aclnnMatmul failed, error code is 161002 (ACLNN_ERR_PARAM_INVALID)",
      "(Worker_TP0 pid=92001) ERROR 11-24 15:10:03 [op_host.cpp:88] AclNN_Parameter_Error(EZ1001): invalid tensor shape alignment",
    ].join("\n"),
  },
];

export function getTroubleshootFixture(id: string | undefined): TroubleshootFixture {
  if (id) {
    const matched = TROUBLESHOOT_FIXTURES.find((f) => f.id === id);
    if (matched) return matched;
  }
  return TROUBLESHOOT_FIXTURES[0]!;
}
