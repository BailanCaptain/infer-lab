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
];

export function getTroubleshootFixture(id: string | undefined): TroubleshootFixture {
  if (id) {
    const matched = TROUBLESHOOT_FIXTURES.find((f) => f.id === id);
    if (matched) return matched;
  }
  return TROUBLESHOOT_FIXTURES[0]!;
}
