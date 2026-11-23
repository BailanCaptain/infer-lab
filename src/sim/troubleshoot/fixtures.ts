/**
 * Realistic Ascend / CANN / HCCL / vLLM error log & `/metrics` fixtures
 * for Wave 4A Tool ③ (`troubleshoot-workbench` Panel A).
 *
 * Covers every diagnostic rule in `logAnalyzer.ts`, including multi-rank
 * interleaved First-Fault Rank attribution and Prometheus `/metrics` snapshots.
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
    label: "多卡 EI0006 假象（首错 Rank 3）",
    kind: "logs",
    summary:
      "Rank 0/1/2 在 10:12:35 报 HCCL EI0006 Notify wait execute timeout，但交错日志里 Rank 3 早在 10:11:05 已触发 NPU OOM 与 EZ9999。",
    expectedRuleIds: ["oom-stage-split", "hccl-timeout-cascade"],
    content: [
      "2026-04-12 10:10:58.104 INFO [Worker_TP0] [Rank 0] Available KV cache memory: 24.80 GiB",
      "2026-04-12 10:10:58.118 INFO [Worker_TP1] [Rank 1] Available KV cache memory: 24.80 GiB",
      "2026-04-12 10:10:58.122 INFO [Worker_TP2] [Rank 2] Available KV cache memory: 24.80 GiB",
      "2026-04-12 10:10:58.131 INFO [Worker_TP3] [Rank 3] Available KV cache memory: 24.80 GiB",
      "2026-04-12 10:12:35.402 ERROR [Worker_TP0] [Rank 0] HCCL_E_WAIT_TIMEOUT: EI0006 Notify wait execute timeout on AllReduce group tp_0",
      "2026-04-12 10:12:35.419 ERROR [Worker_TP1] [Rank 1] EI0006 Notify wait execute timeout during collective AllReduce",
      "2026-04-12 10:12:35.437 ERROR [Worker_TP2] [Rank 2] Watchdog caught collective operation timeout: EI0006 Notify wait execute timeout",
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
    label: "/metrics：KV 池打满与抢占风暴",
    kind: "metrics",
    summary: "vllm:kv_cache_usage_perc > 0.95 且伴随 num_preemptions_total 上升与 num_requests_waiting > 0。",
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
    label: "纯 EI0006 缺首错卡（防误判 Rank 0）",
    kind: "logs",
    summary: "只贴了多卡 EI0006 超时而无前序主错误——工作台明确报 low 置信度并拒绝甩锅 Rank 0。",
    expectedRuleIds: ["hccl-timeout-cascade"],
    content: [
      "2026-04-12 14:22:10.105 ERROR [Rank 0] EI0006 Notify wait execute timeout in HCCL AllReduce",
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
];

export function getTroubleshootFixture(id: string | undefined): TroubleshootFixture {
  if (id) {
    const matched = TROUBLESHOOT_FIXTURES.find((f) => f.id === id);
    if (matched) return matched;
  }
  return TROUBLESHOOT_FIXTURES[0]!;
}
