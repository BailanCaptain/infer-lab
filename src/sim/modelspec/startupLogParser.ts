/**
 * Mode B：真实 Ascend `vllm serve` 启动日志解析器与逐项对账引擎。
 * 对齐 `vllm-ascend@c09d3e20` (`worker.py` / `worker_310p.py` / `model_runner_v1.py`)
 * 与 `vllm@ced6857a` (`mem_utils.py` / `kv_cache_utils.py` / `gpu_model_runner.py`)。
 */

import { HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB } from "../rules/hcclAccounting";
import { VERIFIED_COMMITS } from "../rules/types";
import { type DeployPlanInput, type DeployPlanReport, GIB, MIB } from "./deployCalculator";

export interface StartupLogMatchedLine {
  lineNumber: number;
  field: string;
  rawLine: string;
  rankLabel?: string | undefined;
}

export interface StartupLogRankSnapshot {
  rankLabel: string;
  dpRank: number | null;
  ppRank: number | null;
  tpRank: number | null;
  epRank: number | null;
  weightsGiB: number | null;
  nonKvCacheMemoryGiB: number | null;
  torchPeakIncreaseGiB: number | null;
  nonTorchIncreaseGiB: number | null;
  availableKvGiB: number | null;
  kvCacheTokens: number | null;
  aclGraphGiB: number | null;
  initialFreeGiB: number | null;
  totalDeviceGiB: number | null;
  suggestedKvMemoryBytes: number | null;
  suggestedKvMemoryGiB: number | null;
}

export interface ParseStartupLogOptions {
  /** Explicitly reconcile a specific worker rank label (e.g. "Worker_DP1_TP1_EP5"). */
  targetRank?: string | undefined;
}

export interface ParsedStartupLog {
  weightsGiB: number | null;
  weightLoadSeconds: number | null;
  nonKvCacheMemoryGiB: number | null;
  torchPeakIncreaseGiB: number | null;
  nonTorchIncreaseGiB: number | null;
  totalConsumedGiB: number | null;
  availableKvGiB: number | null;
  kvHalvedFor310pWorkspace: boolean;
  expandableSegmentsDisabled?: boolean;
  kvCacheTokens: number | null;
  kvCacheDeviceLabel: string | null;
  maxConcurrency: number | null;
  maxConcurrencyModelLen: number | null;
  aclGraphGiB: number | null;
  aclGraphSeconds: number | null;
  initialFreeGiB: number | null;
  totalDeviceGiB: number | null;
  gpuMemoryUtilization: number | null;
  requestedMemoryGiB: number | null;
  suggestedKvMemoryBytes: number | null;
  suggestedKvMemoryGiB: number | null;
  torchReservedAfterWarmupGiB: number | null;
  torchAllocatedAfterWarmupGiB: number | null;
  selectedRankLabel: string | null;
  detectedRanks: readonly string[];
  rankSnapshots: readonly StartupLogRankSnapshot[];
  crossRankNotes: readonly string[];
  detectedErrors: readonly string[];
  matchedLines: readonly StartupLogMatchedLine[];
  hasAnyMetric: boolean;
}

export type ReconciliationItemId =
  | "weights"
  | "nonKvOverhead"
  | "availableKv"
  | "kvTokens"
  | "aclGraph"
  | "headroomSafety";

export type ReconciliationItemStatus =
  | "within-interval"
  | "above-interval"
  | "below-interval"
  | "oom-risk"
  | "missing";

export interface ReconciliationItem {
  id: ReconciliationItemId;
  title: string;
  unit: "GiB" | "tokens";
  predictedLow: number;
  predictedPoint: number;
  predictedHigh: number;
  measured: number | null;
  /** measured - predictedPoint (GiB or tokens; null when missing) */
  delta: number | null;
  /** Same as delta for GiB items; null for token items or missing */
  deltaGiB: number | null;
  status: ReconciliationItemStatus;
  summary: string;
  likelyRootCauses: readonly string[];
}

export interface LogReconciliationReport {
  overallStatus: "aligned" | "partial" | "drift" | "oom-risk" | "incomplete";
  hcclDoubleCounted: false;
  hcclAccountingNote: string;
  redundancyBufferMiB: number;
  impliedKvBytesPerToken: number | null;
  selectedRankLabel: string | null;
  crossRankNotes: readonly string[];
  items: readonly ReconciliationItem[];
  byKey: Readonly<Record<ReconciliationItemId, ReconciliationItem>>;
  logErrors: readonly string[];
  summary: string;
}

export interface SampleStartupLogTemplate {
  id: string;
  title: string;
  isReferenceTemplate: boolean;
  disclaimer: string;
  recommendedPlanInput: DeployPlanInput;
  logText: string;
}

export const SAMPLE_ASCEND_STARTUP_LOGS: readonly SampleStartupLogTemplate[] = [
  {
    id: "qwen3-8b-a2-tp1",
    title: "Qwen3-8B · BF16 · 单卡 TP=1 · Atlas A2 64 GiB（参考模板）",
    isReferenceTemplate: true,
    disclaimer:
      "参考日志模板（格式对齐 vllm-ascend@c09d3e20 worker.py / vllm@ced6857a kv_cache_utils.py，数值对应 wiki 标尺算例；真机请粘贴实际 vllm serve 启动日志）",
    recommendedPlanInput: {
      model: "qwen3-8b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      tpSize: 1,
      ppSize: 1,
      dpSize: 1,
      gpuMemoryUtilization: 0.92,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      cudagraphMode: "PIECEWISE",
      cudagraphCaptureCount: 16,
    },
    logText: [
      "INFO 11-18 10:12:04 [model_runner_v1.py:4476] Loading model weights took 15.2564 GB",
      "DEBUG 11-18 10:12:15 [worker.py:659] Memory profiling takes 11.42 seconds. Total non KV cache memory: 18.00GiB; torch peak memory increase: 2.14GiB; total consumed (from mem_get_info): 15.86GiB; weights memory: 15.26GiB.",
      "INFO 11-18 10:12:15 [worker.py:661] Available KV cache memory: 40.88 GiB",
      "INFO 11-18 10:12:16 [kv_cache_utils.py:2396] NPU KV cache size: 297,472 tokens, Maximum concurrency for 32,768 tokens per request: 9.08x",
      "INFO 11-18 10:12:35 [gpu_model_runner.py:6930] Graph capturing finished in 19 secs, took 1.28 GiB",
      "INFO 11-18 10:12:35 [worker.py:950] Free memory on device (62.80/64.00 GiB) on startup. Desired GPU memory utilization is (0.92, 58.88 GiB). Actual usage: 15.26 GiB for weights, 2.14 GiB for peak activation, 0.60 GiB for non-torch memory, 1.28 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=42359111680` (39.45 GiB) to fit into requested memory, or `--kv-cache-memory=46568570880` (43.37 GiB) to fully utilize NPU free memory. Current KV cache memory: 40.88 GiB. After warmup: torch reserved memory 57.62 GiB, torch allocated memory 56.40 GiB.",
    ].join("\n"),
  },
  {
    id: "qwen3-30b-a3b-a2-tp4-ep4-w8a8",
    title: "Qwen3-30B-A3B · W8A8_DYNAMIC · 四卡 TP=4 + EP=4 · Atlas A2 64 GiB（参考模板）",
    isReferenceTemplate: true,
    disclaimer:
      "参考日志模板（格式对齐 vllm-ascend@c09d3e20 worker.py / vllm@ced6857a kv_cache_utils.py，数值对应 wiki 标尺算例；真机请粘贴实际 vllm serve 启动日志）",
    recommendedPlanInput: {
      model: "qwen3-30b-a3b",
      cardId: "a2-64g",
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "auto",
      tpSize: 4,
      ppSize: 1,
      dpSize: 1,
      enableEp: true,
      gpuMemoryUtilization: 0.92,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      cudagraphMode: "PIECEWISE",
      cudagraphCaptureCount: 16,
    },
    logText: [
      "INFO 11-18 10:20:09 [model_runner_v1.py:4476] Loading model weights took 7.4012 GB",
      "DEBUG 11-18 10:20:26 [worker.py:659] Memory profiling takes 16.85 seconds. Total non KV cache memory: 10.60GiB; torch peak memory increase: 2.30GiB; total consumed (from mem_get_info): 8.30GiB; weights memory: 7.40GiB.",
      "INFO 11-18 10:20:26 [worker.py:661] Available KV cache memory: 48.28 GiB",
      "INFO 11-18 10:20:27 [kv_cache_utils.py:2396] NPU KV cache size: 2,109,184 tokens, Maximum concurrency for 32,768 tokens per request: 64.37x",
      "INFO 11-18 10:20:53 [gpu_model_runner.py:6930] Graph capturing finished in 26 secs, took 1.72 GiB",
      "INFO 11-18 10:20:53 [worker.py:950] Free memory on device (62.60/64.00 GiB) on startup. Desired GPU memory utilization is (0.92, 58.88 GiB). Actual usage: 7.40 GiB for weights, 2.30 GiB for peak activation, 0.90 GiB for non-torch memory, 1.72 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=49828347904` (46.41 GiB) to fit into requested memory, or `--kv-cache-memory=53822652416` (50.13 GiB) to fully utilize NPU free memory. Current KV cache memory: 48.28 GiB. After warmup: torch reserved memory 57.10 GiB, torch allocated memory 55.82 GiB.",
    ].join("\n"),
  },
  {
    id: "real-910b3-qwen3-8b-tp1",
    title: "Qwen3-8B · BF16 · 单卡 TP=1 · Ascend 910B3 真机实测",
    isReferenceTemplate: false,
    disclaimer:
      "Ascend 910B3 真机实测日志（HDK 25.5.0 · CANN 9.1.0 · vllm 0.30.0 · vllm-ascend 0.30.0，OS 可见显存 60.96 GiB）",
    recommendedPlanInput: {
      model: "qwen3-8b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      tpSize: 1,
      ppSize: 1,
      dpSize: 1,
      gpuMemoryUtilization: 0.85,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      cudagraphMode: "FULL_AND_PIECEWISE",
    },
    logText: [
      "(EngineCore pid=40516) INFO 11-22 21:36:54 [model_runner_v1.py:4476] Loading model weights took 15.2859 GB",
      "(EngineCore pid=40516) DEBUG 11-22 21:37:44 [worker.py:659] Memory profiling takes 49.13 seconds. Total non KV cache memory: 15.52GiB; torch peak memory increase: 0.2GiB; total consumed (from mem_get_info): 15.35GiB; weights memory: 15.29GiB.",
      "(EngineCore pid=40516) INFO 11-22 21:37:44 [worker.py:660] Available KV cache memory: 36.29 GiB",
      "(EngineCore pid=40516) INFO 11-22 21:37:44 [v1/core/kv_cache_utils.py:2395] NPU KV cache size: 264,192 tokens, Maximum concurrency for 32,768 tokens per request: 8.06x",
      "(EngineCore pid=40516) INFO 11-22 21:38:14 [v1/worker/gpu_model_runner.py:6929] Graph capturing finished in 28 secs, took 2.59 GiB",
      "(EngineCore pid=40516) INFO 11-22 21:38:14 [worker.py:950] Free memory on device (60.57/60.96 GiB) on startup. Desired GPU memory utilization is (0.85, 51.81 GiB). Actual usage: 15.29 GiB for weights, 0.2 GiB for peak activation, 0.03 GiB for non-torch memory, 2.59 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=36029129728` (33.55 GiB) to fit into requested memory, or `--kv-cache-memory=45429695488` (42.31 GiB) to fully utilize NPU free memory. Current KV cache memory: 36.29 GiB. After warmup: torch reserved memory 54.02 GiB, torch allocated memory 51.59 GiB.",
    ].join("\n"),
  },
  {
    id: "real-910b3-qwen3-8b-tp2",
    title: "Qwen3-8B · BF16 · 双卡 TP=2 · Ascend 910B3 真机实测",
    isReferenceTemplate: false,
    disclaimer:
      "8×Ascend 910B3 真机实测日志（TP=2，non-torch 0.43 GiB，KV 43.52 GiB / 633,728 tokens，录图 2.93 GiB）",
    recommendedPlanInput: {
      model: "qwen3-8b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      tpSize: 2,
      ppSize: 1,
      dpSize: 1,
      gpuMemoryUtilization: 0.85,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      cudagraphMode: "FULL_AND_PIECEWISE",
    },
    logText: [
      "(Worker_TP0 pid=28025) INFO 11-23 02:15:08 [model_runner_v1.py:4476] Loading model weights took 7.6580 GB",
      "(Worker_TP0 pid=28025) DEBUG 11-23 02:16:07 [worker.py:659] Memory profiling takes 58.95 seconds. Total non KV cache memory: 8.29GiB; torch peak memory increase: 0.2GiB; total consumed (from mem_get_info): 8.11GiB; weights memory: 7.66GiB.",
      "(Worker_TP0 pid=28025) INFO 11-23 02:16:07 [worker.py:660] Available KV cache memory: 43.52 GiB",
      "(EngineCore pid=27636) INFO 11-23 02:16:07 [v1/core/kv_cache_utils.py:2395] NPU KV cache size: 633,728 tokens, Maximum concurrency for 32,768 tokens per request: 19.34x",
      "(Worker_TP0 pid=28025) INFO 11-23 02:17:00 [v1/worker/gpu_model_runner.py:6929] Graph capturing finished in 40 secs, took 2.93 GiB",
      "(Worker_TP0 pid=28025) INFO 11-23 02:17:00 [worker.py:950] Free memory on device (60.58/60.96 GiB) on startup. Desired GPU memory utilization is (0.85, 51.81 GiB). Actual usage: 7.66 GiB for weights, 0.2 GiB for peak activation, 0.43 GiB for non-torch memory, 2.93 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=43426800640` (40.44 GiB) to fit into requested memory, or `--kv-cache-memory=52841767936` (49.21 GiB) to fully utilize NPU free memory. Current KV cache memory: 43.52 GiB. After warmup: torch reserved memory 53.92 GiB, torch allocated memory 51.19 GiB.",
    ].join("\n"),
  },
  {
    id: "real-910b3-qwen3-8b-tp4",
    title: "Qwen3-8B · BF16 · 四卡 TP=4 · Ascend 910B3 真机实测",
    isReferenceTemplate: false,
    disclaimer:
      "8×Ascend 910B3 真机实测日志（TP=4，non-torch 0.44 GiB，KV 47.35 GiB / 1,379,200 tokens，录图 3.10 GiB）",
    recommendedPlanInput: {
      model: "qwen3-8b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      tpSize: 4,
      ppSize: 1,
      dpSize: 1,
      gpuMemoryUtilization: 0.85,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      cudagraphMode: "FULL_AND_PIECEWISE",
    },
    logText: [
      "(Worker_TP0 pid=31442) INFO 11-23 02:19:37 [model_runner_v1.py:4476] Loading model weights took 3.8440 GB",
      "(Worker_TP0 pid=31442) DEBUG 11-23 02:20:35 [worker.py:659] Memory profiling takes 56.34 seconds. Total non KV cache memory: 4.46GiB; torch peak memory increase: 0.18GiB; total consumed (from mem_get_info): 4.31GiB; weights memory: 3.84GiB.",
      "(Worker_TP0 pid=31442) INFO 11-23 02:20:35 [worker.py:660] Available KV cache memory: 47.35 GiB",
      "(EngineCore pid=31111) INFO 11-23 02:20:35 [v1/core/kv_cache_utils.py:2395] NPU KV cache size: 1,379,200 tokens, Maximum concurrency for 32,768 tokens per request: 42.09x",
      "(Worker_TP0 pid=31442) INFO 11-23 02:21:18 [v1/worker/gpu_model_runner.py:6929] Graph capturing finished in 40 secs, took 3.10 GiB",
      "(Worker_TP0 pid=31442) INFO 11-23 02:21:18 [worker.py:950] Free memory on device (60.58/60.96 GiB) on startup. Desired GPU memory utilization is (0.85, 51.81 GiB). Actual usage: 3.84 GiB for weights, 0.18 GiB for peak activation, 0.44 GiB for non-torch memory, 3.1 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=47364912128` (44.11 GiB) to fit into requested memory, or `--kv-cache-memory=56778978304` (52.88 GiB) to fully utilize NPU free memory. Current KV cache memory: 47.35 GiB. After warmup: torch reserved memory 54.12 GiB, torch allocated memory 51.22 GiB.",
    ].join("\n"),
  },
  {
    id: "real-910b3-qwen3-8b-tp8",
    title: "Qwen3-8B · BF16 · 八卡 TP=8 · Ascend 910B3 真机实测",
    isReferenceTemplate: false,
    disclaimer:
      "8×Ascend 910B3 真机实测日志（TP=8，non-torch 0.44 GiB，KV 49.27 GiB / 2,869,888 tokens，录图 3.21 GiB）",
    recommendedPlanInput: {
      model: "qwen3-8b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      tpSize: 8,
      ppSize: 1,
      dpSize: 1,
      gpuMemoryUtilization: 0.85,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      cudagraphMode: "FULL_AND_PIECEWISE",
    },
    logText: [
      "(Worker_TP0 pid=35438) INFO 11-23 02:23:50 [model_runner_v1.py:4476] Loading model weights took 1.9370 GB",
      "(Worker_TP0 pid=35438) DEBUG 11-23 02:24:53 [worker.py:659] Memory profiling takes 61.51 seconds. Total non KV cache memory: 2.55GiB; torch peak memory increase: 0.17GiB; total consumed (from mem_get_info): 2.41GiB; weights memory: 1.94GiB.",
      "(Worker_TP0 pid=35438) INFO 11-23 02:24:53 [worker.py:660] Available KV cache memory: 49.27 GiB",
      "(EngineCore pid=35132) INFO 11-23 02:24:53 [v1/core/kv_cache_utils.py:2395] NPU KV cache size: 2,869,888 tokens, Maximum concurrency for 32,768 tokens per request: 87.58x",
      "(Worker_TP0 pid=35438) INFO 11-23 02:25:38 [v1/worker/gpu_model_runner.py:6929] Graph capturing finished in 43 secs, took 3.21 GiB",
      "(Worker_TP0 pid=35438) INFO 11-23 02:25:38 [worker.py:950] Free memory on device (60.58/60.96 GiB) on startup. Desired GPU memory utilization is (0.85, 51.81 GiB). Actual usage: 1.94 GiB for weights, 0.17 GiB for peak activation, 0.44 GiB for non-torch memory, 3.21 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=49295324160` (45.91 GiB) to fit into requested memory, or `--kv-cache-memory=58709787648` (54.68 GiB) to fully utilize NPU free memory. Current KV cache memory: 49.27 GiB. After warmup: torch reserved memory 54.21 GiB, torch allocated memory 51.22 GiB.",
    ].join("\n"),
  },
  {
    id: "real-910b3-qwen3-30b-a3b-tp4-ep4",
    title: "Qwen3-30B-A3B · BF16 · 四卡 TP=4+EP=4 · Ascend 910B3 真机实测",
    isReferenceTemplate: false,
    disclaimer:
      "8×Ascend 910B3 真机实测完整 48 层 Qwen3-30B-A3B MoE（TP=4+EP=4，单卡权重 14.27 GiB，KV 1,692,032 tokens）",
    recommendedPlanInput: {
      model: "qwen3-30b-a3b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      tpSize: 4,
      ppSize: 1,
      dpSize: 1,
      enableEp: true,
      gpuMemoryUtilization: 0.88,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      cudagraphMode: "FULL_AND_PIECEWISE",
    },
    logText: [
      "(Worker_TP0_EP0 pid=53742) INFO 11-23 02:42:59 [model_runner_v1.py:4476] Loading model weights took 14.2652 GB",
      "(Worker_TP0_EP0 pid=53742) INFO 11-23 02:44:16 [worker.py:660] Available KV cache memory: 38.73 GiB",
      "(EngineCore pid=53401) INFO 11-23 02:44:16 [kv_cache_utils.py:2395] NPU KV cache size: 1,692,032 tokens, Maximum concurrency for 32,768 tokens per request: 51.64x",
      "(Worker_TP0_EP0 pid=53742) INFO 11-23 02:45:25 [gpu_model_runner.py:6929] Graph capturing finished in 67 secs, took 2.30 GiB",
      "(Worker_TP0_EP0 pid=53742) INFO 11-23 02:45:25 [worker.py:950] Free memory on device (60.58/60.96 GiB) on startup. Desired GPU memory utilization is (0.88, 53.64 GiB). Actual usage: 14.27 GiB for weights, 0.2 GiB for peak activation, 0.45 GiB for non-torch memory, 2.3 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=38958851481` (36.28 GiB) to fit into requested memory, or `--kv-cache-memory=46407900160` (43.22 GiB) to fully utilize NPU free memory. Current KV cache memory: 38.73 GiB. After warmup: torch reserved memory 54.92 GiB, torch allocated memory 53.01 GiB.",
    ].join("\n"),
  },
  {
    id: "real-910b3-qwen3-30b-a3b-dp2-tp4-ep8",
    title: "Qwen3-30B-A3B · BF16 · 八卡 DP=2+TP=4+EP=8 · Ascend 910B3 真机实测",
    isReferenceTemplate: false,
    disclaimer:
      "8×Ascend 910B3 真机实测完整 48 层 Qwen3-30B-A3B MoE（DP=2+TP=4+EP=8，单卡权重 7.52 GiB，单 DP 组 KV 1,975,168 tokens，双 DP 总计 3,950,336 tokens）",
    recommendedPlanInput: {
      model: "qwen3-30b-a3b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      tpSize: 4,
      ppSize: 1,
      dpSize: 2,
      enableEp: true,
      gpuMemoryUtilization: 0.88,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      cudagraphMode: "FULL_AND_PIECEWISE",
    },
    logText: [
      "(Worker_DP0_TP0_EP0 pid=58356) INFO 11-23 02:48:11 [model_runner_v1.py:4476] Loading model weights took 7.5152 GB",
      "(Worker_DP0_TP0_EP0 pid=58356) INFO 11-23 02:49:16 [worker.py:660] Available KV cache memory: 45.21 GiB",
      "(EngineCore_DP0 pid=57743) INFO 11-23 02:49:16 [kv_cache_utils.py:2395] NPU KV cache size: 1,975,168 tokens, Maximum concurrency for 32,768 tokens per request: 60.28x",
      "(Worker_DP0_TP0_EP0 pid=58356) INFO 11-23 02:50:41 [gpu_model_runner.py:6929] Graph capturing finished in 83 secs, took 2.64 GiB",
      "(Worker_DP0_TP0_EP0 pid=58356) INFO 11-23 02:50:41 [worker.py:950] Free memory on device (60.58/60.96 GiB) on startup. Desired GPU memory utilization is (0.88, 53.64 GiB). Actual usage: 7.52 GiB for weights, 0.37 GiB for peak activation, 0.55 GiB for non-torch memory, 2.64 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=45547475353` (42.42 GiB) to fit into requested memory, or `--kv-cache-memory=52996540416` (49.36 GiB) to fully utilize NPU free memory. Current KV cache memory: 45.21 GiB. After warmup: torch reserved memory 54.94 GiB, torch allocated memory 52.74 GiB.",
    ].join("\n"),
  },
];

function toGiB(value: number, unit: string | undefined, treatGbAsGiB = false): number {
  const u = (unit ?? "gib").trim().toLowerCase();
  if (u === "mib") return value / 1024;
  if (u === "mb") return (value * 1e6) / GIB;
  if (u === "gb") return treatGbAsGiB ? value : (value * 1e9) / GIB;
  if (u === "kib") return value / (1024 * 1024);
  if (u === "b" || u === "bytes") return value / GIB;
  return value; // GiB
}

function parseIntWithCommas(raw: string): number {
  return Number.parseInt(raw.replace(/,/g, ""), 10);
}

interface ScopeMeta {
  key: string;
  label: string;
  role: "worker" | "engine" | "default";
  pid: number | null;
  dp: number | null;
  pp: number | null;
  tp: number | null;
  ep: number | null;
}

interface ScopeBucket {
  meta: ScopeMeta;
  weightsFromLoaderGiB: number | null;
  weightsFromProfileGiB: number | null;
  weightLoadSeconds: number | null;
  nonKvCacheMemoryGiB: number | null;
  torchPeakFromProfileGiB: number | null;
  torchPeakFromSummaryGiB: number | null;
  nonTorchFromKeyValueGiB: number | null;
  nonTorchFromSummaryGiB: number | null;
  totalConsumedGiB: number | null;
  availableKvPrimaryGiB: number | null;
  availableKvFallbackGiB: number | null;
  kvHalvedFor310pWorkspace: boolean;
  expandableSegmentsState: boolean | null;
  kvCacheTokens: number | null;
  kvCacheDeviceLabel: string | null;
  maxConcurrency: number | null;
  maxConcurrencyModelLen: number | null;
  aclGraphFromCaptureGiB: number | null;
  aclGraphFromSummaryGiB: number | null;
  aclGraphSeconds: number | null;
  initialFreeGiB: number | null;
  totalDeviceGiB: number | null;
  gpuMemoryUtilization: number | null;
  requestedMemoryGiB: number | null;
  suggestedKvMemoryBytes: number | null;
  suggestedKvMemoryGiB: number | null;
  torchReservedAfterWarmupGiB: number | null;
  torchAllocatedAfterWarmupGiB: number | null;
}

interface ResolvedBucketMetrics {
  meta: ScopeMeta;
  weightsGiB: number | null;
  weightLoadSeconds: number | null;
  nonKvCacheMemoryGiB: number | null;
  torchPeakIncreaseGiB: number | null;
  nonTorchIncreaseGiB: number | null;
  totalConsumedGiB: number | null;
  availableKvGiB: number | null;
  kvHalvedFor310pWorkspace: boolean;
  expandableSegmentsState: boolean | null;
  kvCacheTokens: number | null;
  kvCacheDeviceLabel: string | null;
  maxConcurrency: number | null;
  maxConcurrencyModelLen: number | null;
  aclGraphGiB: number | null;
  aclGraphSeconds: number | null;
  initialFreeGiB: number | null;
  totalDeviceGiB: number | null;
  gpuMemoryUtilization: number | null;
  requestedMemoryGiB: number | null;
  suggestedKvMemoryBytes: number | null;
  suggestedKvMemoryGiB: number | null;
  torchReservedAfterWarmupGiB: number | null;
  torchAllocatedAfterWarmupGiB: number | null;
}

const WORKER_SCOPE_RE =
  /(?:\(|\[\s*)((?:Vllm)?Worker(?:_(?:DP|PP|TP|EP)\d+)+|(?:Vllm)?Worker_\d+)(?:\s+pid=\d+)?(?:\)|\s*\])/i;
const RANK_SCOPE_RE = /\[\s*Rank\s*[:=#]?\s*(\d+)\s*\]|\b(?:local_rank|global_rank|rank)\s*[:=]\s*(\d+)\b/i;
const ENGINE_SCOPE_RE = /(?:\(|\[\s*)(EngineCore(?:_DP(\d+))?)(?:\s+pid=\d+)?(?:\)|\s*\])/i;

const SCOPE_PID_RE = /\bpid=(\d+)\b/i;

function extractScopeMeta(line: string): ScopeMeta {
  const pidMatch = SCOPE_PID_RE.exec(line)?.[1];
  const pid = pidMatch !== undefined ? Number.parseInt(pidMatch, 10) : null;
  const pidSuffix = pid !== null ? `:pid=${pid}` : "";

  const mWorker = WORKER_SCOPE_RE.exec(line);
  if (mWorker?.[1]) {
    const tag = mWorker[1];
    const dp = /_DP(\d+)/i.exec(tag)?.[1];
    const pp = /_PP(\d+)/i.exec(tag)?.[1];
    const tp = /_TP(\d+)/i.exec(tag)?.[1];
    const ep = /_EP(\d+)/i.exec(tag)?.[1];
    return {
      key: `worker:${tag}${pidSuffix}`,
      label: tag,
      role: "worker",
      pid,
      dp: dp !== undefined ? Number.parseInt(dp, 10) : null,
      pp: pp !== undefined ? Number.parseInt(pp, 10) : null,
      tp: tp !== undefined ? Number.parseInt(tp, 10) : null,
      ep: ep !== undefined ? Number.parseInt(ep, 10) : null,
    };
  }
  const mRank = RANK_SCOPE_RE.exec(line);
  const rankStr = mRank?.[1] ?? mRank?.[2];
  if (rankStr !== undefined) {
    const n = Number.parseInt(rankStr, 10);
    return {
      key: `worker:Rank_${n}${pidSuffix}`,
      label: `Rank ${n}`,
      role: "worker",
      pid,
      dp: null,
      pp: null,
      tp: n,
      ep: null,
    };
  }
  const mEngine = ENGINE_SCOPE_RE.exec(line);
  if (mEngine?.[1]) {
    const tag = mEngine[1];
    const dp = mEngine[2] !== undefined ? Number.parseInt(mEngine[2], 10) : null;
    return {
      key: `engine:${tag}${pidSuffix}`,
      label: tag,
      role: "engine",
      pid,
      dp,
      pp: null,
      tp: null,
      ep: null,
    };
  }
  return {
    key: "default",
    label: "default",
    role: "default",
    pid: null,
    dp: null,
    pp: null,
    tp: null,
    ep: null,
  };
}

function createScopeBucket(meta: ScopeMeta): ScopeBucket {
  return {
    meta,
    weightsFromLoaderGiB: null,
    weightsFromProfileGiB: null,
    weightLoadSeconds: null,
    nonKvCacheMemoryGiB: null,
    torchPeakFromProfileGiB: null,
    torchPeakFromSummaryGiB: null,
    nonTorchFromKeyValueGiB: null,
    nonTorchFromSummaryGiB: null,
    totalConsumedGiB: null,
    availableKvPrimaryGiB: null,
    availableKvFallbackGiB: null,
    kvHalvedFor310pWorkspace: false,
    expandableSegmentsState: null,
    kvCacheTokens: null,
    kvCacheDeviceLabel: null,
    maxConcurrency: null,
    maxConcurrencyModelLen: null,
    aclGraphFromCaptureGiB: null,
    aclGraphFromSummaryGiB: null,
    aclGraphSeconds: null,
    initialFreeGiB: null,
    totalDeviceGiB: null,
    gpuMemoryUtilization: null,
    requestedMemoryGiB: null,
    suggestedKvMemoryBytes: null,
    suggestedKvMemoryGiB: null,
    torchReservedAfterWarmupGiB: null,
    torchAllocatedAfterWarmupGiB: null,
  };
}

function resolveScopeBucket(b: ScopeBucket): ResolvedBucketMetrics {
  const weightsGiB = b.weightsFromLoaderGiB ?? b.weightsFromProfileGiB;
  const torchPeakIncreaseGiB = b.torchPeakFromSummaryGiB ?? b.torchPeakFromProfileGiB;
  let nonTorchIncreaseGiB = b.nonTorchFromSummaryGiB ?? b.nonTorchFromKeyValueGiB;
  let nonKvCacheMemoryGiB = b.nonKvCacheMemoryGiB;

  if (
    nonKvCacheMemoryGiB === null &&
    weightsGiB !== null &&
    torchPeakIncreaseGiB !== null &&
    nonTorchIncreaseGiB !== null
  ) {
    nonKvCacheMemoryGiB = Number((weightsGiB + torchPeakIncreaseGiB + nonTorchIncreaseGiB).toFixed(4));
  }
  if (
    nonTorchIncreaseGiB === null &&
    nonKvCacheMemoryGiB !== null &&
    weightsGiB !== null &&
    torchPeakIncreaseGiB !== null
  ) {
    nonTorchIncreaseGiB = Number(
      Math.max(0, nonKvCacheMemoryGiB - weightsGiB - torchPeakIncreaseGiB).toFixed(4),
    );
  }

  return {
    meta: b.meta,
    weightsGiB,
    weightLoadSeconds: b.weightLoadSeconds,
    nonKvCacheMemoryGiB,
    torchPeakIncreaseGiB,
    nonTorchIncreaseGiB,
    totalConsumedGiB: b.totalConsumedGiB,
    availableKvGiB: b.availableKvPrimaryGiB ?? b.availableKvFallbackGiB,
    kvHalvedFor310pWorkspace: b.kvHalvedFor310pWorkspace,
    expandableSegmentsState: b.expandableSegmentsState,
    kvCacheTokens: b.kvCacheTokens,
    kvCacheDeviceLabel: b.kvCacheDeviceLabel,
    maxConcurrency: b.maxConcurrency,
    maxConcurrencyModelLen: b.maxConcurrencyModelLen,
    aclGraphGiB: b.aclGraphFromCaptureGiB ?? b.aclGraphFromSummaryGiB,
    aclGraphSeconds: b.aclGraphSeconds,
    initialFreeGiB: b.initialFreeGiB,
    totalDeviceGiB: b.totalDeviceGiB,
    gpuMemoryUtilization: b.gpuMemoryUtilization,
    requestedMemoryGiB: b.requestedMemoryGiB,
    suggestedKvMemoryBytes: b.suggestedKvMemoryBytes,
    suggestedKvMemoryGiB: b.suggestedKvMemoryGiB,
    torchReservedAfterWarmupGiB: b.torchReservedAfterWarmupGiB,
    torchAllocatedAfterWarmupGiB: b.torchAllocatedAfterWarmupGiB,
  };
}

function compareScopeCanonical(a: ScopeMeta, b: ScopeMeta): number {
  const dpDiff = (a.dp ?? 0) - (b.dp ?? 0);
  if (dpDiff !== 0) return dpDiff;
  const ppDiff = (a.pp ?? 0) - (b.pp ?? 0);
  if (ppDiff !== 0) return ppDiff;
  const tpDiff = (a.tp ?? 0) - (b.tp ?? 0);
  if (tpDiff !== 0) return tpDiff;
  const epDiff = (a.ep ?? 0) - (b.ep ?? 0);
  if (epDiff !== 0) return epDiff;
  const labelDiff = a.label.localeCompare(b.label);
  if (labelDiff !== 0) return labelDiff;
  return (a.pid ?? Number.MAX_SAFE_INTEGER) - (b.pid ?? Number.MAX_SAFE_INTEGER);
}

function keepMax(prev: number | null, next: number): number {
  return prev === null ? next : Math.max(prev, next);
}

function keepMin(prev: number | null, next: number): number {
  return prev === null ? next : Math.min(prev, next);
}

function scoreBucketCompleteness(r: ResolvedBucketMetrics): number {
  let score = 0;
  if (r.weightsGiB !== null) score += 1;
  if (r.nonKvCacheMemoryGiB !== null) score += 1;
  if (r.availableKvGiB !== null) score += 1;
  if (r.kvCacheTokens !== null) score += 1;
  if (r.aclGraphGiB !== null) score += 1;
  if (r.initialFreeGiB !== null) score += 1;
  return score;
}

function hasAnyBucketMetric(r: ResolvedBucketMetrics): boolean {
  return (
    r.weightsGiB !== null ||
    r.nonKvCacheMemoryGiB !== null ||
    r.availableKvGiB !== null ||
    r.kvCacheTokens !== null ||
    r.aclGraphGiB !== null ||
    r.maxConcurrency !== null
  );
}

function toRankSnapshot(r: ResolvedBucketMetrics): StartupLogRankSnapshot {
  return {
    rankLabel: r.meta.label,
    dpRank: r.meta.dp,
    ppRank: r.meta.pp,
    tpRank: r.meta.tp,
    epRank: r.meta.ep,
    weightsGiB: r.weightsGiB,
    nonKvCacheMemoryGiB: r.nonKvCacheMemoryGiB,
    torchPeakIncreaseGiB: r.torchPeakIncreaseGiB,
    nonTorchIncreaseGiB: r.nonTorchIncreaseGiB,
    availableKvGiB: r.availableKvGiB,
    kvCacheTokens: r.kvCacheTokens,
    aclGraphGiB: r.aclGraphGiB,
    initialFreeGiB: r.initialFreeGiB,
    totalDeviceGiB: r.totalDeviceGiB,
    suggestedKvMemoryBytes: r.suggestedKvMemoryBytes,
    suggestedKvMemoryGiB: r.suggestedKvMemoryGiB,
  };
}

export function parseAscendStartupLog(logText: string, options?: ParseStartupLogOptions): ParsedStartupLog {
  const lines = logText.split(/\r?\n/);
  const matchedLines: StartupLogMatchedLine[] = [];
  const detectedErrors: string[] = [];
  const buckets = new Map<string, ScopeBucket>();

  const getBucket = (meta: ScopeMeta): ScopeBucket => {
    let bucket = buckets.get(meta.key);
    if (!bucket) {
      bucket = createScopeBucket(meta);
      buckets.set(meta.key, bucket);
    }
    return bucket;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!line.trim()) continue;

    const scope = extractScopeMeta(line);
    const b = getBucket(scope);
    const rankLabel = scope.role !== "default" ? scope.label : undefined;
    const record = (field: string): void => {
      matchedLines.push({
        lineNumber: i + 1,
        field,
        rawLine: line.trim(),
        ...(rankLabel ? { rankLabel } : {}),
      });
    };

    // 1. Model weight loading
    const mLoadVllm =
      /Model loading took\s+([\d.]+)\s*(GiB|GB|MiB|MB)(?:\s+memory(?:\s+and\s+([\d.]+)\s*s(?:ec(?:ond)?s?)?)?)?/i.exec(
        line,
      );
    if (mLoadVllm?.[1]) {
      b.weightsFromLoaderGiB = keepMax(
        b.weightsFromLoaderGiB,
        toGiB(Number.parseFloat(mLoadVllm[1]), mLoadVllm[2], mLoadVllm[2]?.toLowerCase() === "gb"),
      );
      if (mLoadVllm[3]) b.weightLoadSeconds = keepMax(b.weightLoadSeconds, Number.parseFloat(mLoadVllm[3]));
      record("weights");
    }
    const mLoadAscend = /Loading model weights took\s+([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mLoadAscend?.[1]) {
      b.weightsFromLoaderGiB = keepMax(
        b.weightsFromLoaderGiB,
        toGiB(Number.parseFloat(mLoadAscend[1]), mLoadAscend[2], mLoadAscend[2]?.toLowerCase() === "gb"),
      );
      record("weights");
    }
    const mCkpt = /Checkpoint size\s*[:=]?\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mCkpt?.[1] && b.weightsFromProfileGiB === null) {
      b.weightsFromProfileGiB = toGiB(Number.parseFloat(mCkpt[1]), mCkpt[2], false);
      record("weights");
    }

    // 2. Memory profiling repr (mem_utils.py#L217-L225) & key-value variants
    if (/Memory profiling takes/i.test(line) || /Total non KV cache memory/i.test(line)) {
      const mNonKv = /Total non KV cache memory:\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
      if (mNonKv?.[1])
        b.nonKvCacheMemoryGiB = keepMax(
          b.nonKvCacheMemoryGiB,
          toGiB(Number.parseFloat(mNonKv[1]), mNonKv[2], false),
        );
      const mPeak = /torch peak memory increase:\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
      if (mPeak?.[1])
        b.torchPeakFromProfileGiB = keepMax(
          b.torchPeakFromProfileGiB,
          toGiB(Number.parseFloat(mPeak[1]), mPeak[2], false),
        );
      const mConsumed = /total consumed[^:]*:\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
      if (mConsumed?.[1])
        b.totalConsumedGiB = keepMax(
          b.totalConsumedGiB,
          toGiB(Number.parseFloat(mConsumed[1]), mConsumed[2], false),
        );
      const mW = /weights memory:\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
      if (mW?.[1])
        b.weightsFromProfileGiB = keepMax(
          b.weightsFromProfileGiB,
          toGiB(Number.parseFloat(mW[1]), mW[2], false),
        );
      record("memoryProfiling");
    }

    const mKvNonKv = /\bnon_kv_cache_memory\s*[:=]\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mKvNonKv?.[1]) {
      b.nonKvCacheMemoryGiB = keepMax(
        b.nonKvCacheMemoryGiB,
        toGiB(Number.parseFloat(mKvNonKv[1]), mKvNonKv[2], false),
      );
      record("nonKvCacheMemory");
    }
    const mKvPeak = /\btorch_peak(?:_increase)?\s*[:=]\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mKvPeak?.[1]) {
      b.torchPeakFromProfileGiB = keepMax(
        b.torchPeakFromProfileGiB,
        toGiB(Number.parseFloat(mKvPeak[1]), mKvPeak[2], false),
      );
      record("torchPeak");
    }
    const mKvNonTorch = /\bnon_torch(?:_increase|_memory)?\s*[:=]\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mKvNonTorch?.[1]) {
      b.nonTorchFromKeyValueGiB = keepMax(
        b.nonTorchFromKeyValueGiB,
        toGiB(Number.parseFloat(mKvNonTorch[1]), mKvNonTorch[2], false),
      );
      record("nonTorchIncrease");
    }

    // 3. worker.py#L929-L949 post-warmup Actual usage summary
    const mFreeDev =
      /Free memory on device\s*\(\s*([\d.]+)\s*\/\s*([\d.]+)\s*(GiB|GB)\s*\)\s*on startup/i.exec(line);
    if (mFreeDev?.[1] && mFreeDev[2]) {
      b.initialFreeGiB = keepMin(b.initialFreeGiB, toGiB(Number.parseFloat(mFreeDev[1]), mFreeDev[3], false));
      b.totalDeviceGiB = keepMax(b.totalDeviceGiB, toGiB(Number.parseFloat(mFreeDev[2]), mFreeDev[3], false));
      record("startupFreeMemory");
    }
    const mDesired = /Desired GPU memory utilization is\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*(GiB|GB)\s*\)/i.exec(
      line,
    );
    if (mDesired?.[1] && mDesired[2]) {
      b.gpuMemoryUtilization = keepMax(b.gpuMemoryUtilization, Number.parseFloat(mDesired[1]));
      b.requestedMemoryGiB = keepMax(
        b.requestedMemoryGiB,
        toGiB(Number.parseFloat(mDesired[2]), mDesired[3], false),
      );
    }
    const mActual =
      /Actual usage:\s*([\d.]+)\s*(GiB|GB|MiB)\s*for weights,\s*([\d.]+)\s*(GiB|GB|MiB)\s*for peak activation,\s*([\d.]+)\s*(GiB|GB|MiB)\s*for non-torch memory,\s*([\d.]+)\s*(GiB|GB|MiB)\s*for NPU graph memory/i.exec(
        line,
      );
    if (mActual?.[1] && mActual[3] && mActual[5] && mActual[7]) {
      b.weightsFromProfileGiB = keepMax(
        b.weightsFromProfileGiB,
        toGiB(Number.parseFloat(mActual[1]), mActual[2], false),
      );
      b.torchPeakFromSummaryGiB = keepMax(
        b.torchPeakFromSummaryGiB,
        toGiB(Number.parseFloat(mActual[3]), mActual[4], false),
      );
      b.nonTorchFromSummaryGiB = keepMax(
        b.nonTorchFromSummaryGiB,
        toGiB(Number.parseFloat(mActual[5]), mActual[6], false),
      );
      b.aclGraphFromSummaryGiB = keepMax(
        b.aclGraphFromSummaryGiB,
        toGiB(Number.parseFloat(mActual[7]), mActual[8], false),
      );
      record("actualUsageSummary");
    }
    const mSuggest =
      /--kv-cache-memory=(\d+)`?\s*\(\s*([\d.]+)\s*(GiB|GB)\s*\)\s*to fit into requested/i.exec(line);
    if (mSuggest?.[1] && mSuggest[2]) {
      b.suggestedKvMemoryBytes = keepMin(b.suggestedKvMemoryBytes, Number.parseInt(mSuggest[1], 10));
      b.suggestedKvMemoryGiB = keepMin(
        b.suggestedKvMemoryGiB,
        toGiB(Number.parseFloat(mSuggest[2]), mSuggest[3], false),
      );
    }
    const mCurKv = /Current KV cache memory:\s*([\d.]+)\s*(GiB|GB|MiB)/i.exec(line);
    if (mCurKv?.[1]) {
      b.availableKvFallbackGiB = keepMin(
        b.availableKvFallbackGiB,
        toGiB(Number.parseFloat(mCurKv[1]), mCurKv[2], false),
      );
    }
    const mAfterWarmup =
      /torch reserved memory\s+([\d.]+)\s*(GiB|GB|MiB),\s*torch allocated memory\s+([\d.]+)\s*(GiB|GB|MiB)/i.exec(
        line,
      );
    if (mAfterWarmup?.[1] && mAfterWarmup[3]) {
      b.torchReservedAfterWarmupGiB = keepMax(
        b.torchReservedAfterWarmupGiB,
        toGiB(Number.parseFloat(mAfterWarmup[1]), mAfterWarmup[2], false),
      );
      b.torchAllocatedAfterWarmupGiB = keepMax(
        b.torchAllocatedAfterWarmupGiB,
        toGiB(Number.parseFloat(mAfterWarmup[3]), mAfterWarmup[4], false),
      );
    }

    // 4. Available KV cache memory (worker.py#L661 / worker_310p.py#L150)
    const mAvailKv =
      /Available KV cache memory:\s*(-?[\d.]+)\s*(GiB|GB|MiB|MB)(\s*\(halved for workspace\))?/i.exec(line);
    if (mAvailKv?.[1]) {
      b.availableKvPrimaryGiB = keepMin(
        b.availableKvPrimaryGiB,
        toGiB(Number.parseFloat(mAvailKv[1]), mAvailKv[2], false),
      );
      if (mAvailKv[3]) b.kvHalvedFor310pWorkspace = true;
      record("availableKv");
    }

    // 5. GPU / NPU KV cache size & Maximum concurrency (kv_cache_utils.py#L2396)
    const mKvTokens = /\b(GPU|NPU|XPU|CPU)\s+KV cache size:\s*([\d,]+)\s*tokens/i.exec(line);
    if (mKvTokens?.[1] && mKvTokens[2]) {
      b.kvCacheDeviceLabel = mKvTokens[1].toUpperCase();
      b.kvCacheTokens = keepMin(b.kvCacheTokens, parseIntWithCommas(mKvTokens[2]));
      record("kvCacheTokens");
    }
    const mMaxConc = /Maximum concurrency for\s*([\d,]+)\s*tokens per request:\s*([\d.]+)x/i.exec(line);
    if (mMaxConc?.[1] && mMaxConc[2]) {
      b.maxConcurrencyModelLen = keepMax(b.maxConcurrencyModelLen, parseIntWithCommas(mMaxConc[1]));
      b.maxConcurrency = keepMin(b.maxConcurrency, Number.parseFloat(mMaxConc[2]));
      record("maxConcurrency");
    }

    // 6. Graph capturing (gpu_model_runner.py#L6930)
    const mGraph =
      /Graph capturing finished in\s+([\d.]+)\s*s(?:ec(?:ond)?s?)?,?\s*took\s+([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(
        line,
      );
    if (mGraph?.[1] && mGraph[2]) {
      b.aclGraphSeconds = keepMax(b.aclGraphSeconds, Number.parseFloat(mGraph[1]));
      b.aclGraphFromCaptureGiB = keepMax(
        b.aclGraphFromCaptureGiB,
        toGiB(Number.parseFloat(mGraph[2]), mGraph[3], false),
      );
      record("aclGraph");
    }

    // 7. Known startup profiling errors
    if (/Error in memory profiling/i.test(line)) {
      detectedErrors.push(
        "检测到 Error in memory profiling 断言失败（同卡外部进程在试跑窗口内释放显存，并非 OOM）。",
      );
    }
    if (/is less than desired GPU memory utilization/i.test(line)) {
      detectedErrors.push("检测到启动前空闲显存低于 requested_memory（同卡其他进程已占用超过 1−u）。");
    }
    if (/No available memory for the cache blocks|NPU out of memory|OutOfMemoryError/i.test(line)) {
      detectedErrors.push("检测到显存不足 / OOM 报错（KV 块或前向显存溢出）。");
    }
    if (/expandable_segments\s*:\s*false\b/i.test(line)) {
      b.expandableSegmentsState = false;
    } else if (/expandable_segments\s*:\s*true\b/i.test(line)) {
      b.expandableSegmentsState = true;
    }
  }

  const allResolved = [...buckets.values()].map(resolveScopeBucket);
  const workerCandidates = allResolved
    .filter((r) => r.meta.role === "worker" && hasAnyBucketMetric(r))
    .sort((a, b) => compareScopeCanonical(a.meta, b.meta));
  const engineCandidates = allResolved
    .filter((r) => r.meta.role === "engine" && hasAnyBucketMetric(r))
    .sort((a, b) => compareScopeCanonical(a.meta, b.meta));
  const defaultBucket = allResolved.find((r) => r.meta.role === "default") ?? null;

  // Pair worker buckets with their matching EngineCore KV token capacity (never mixing across DP engines!)
  const findMatchingEngine = (dp: number | null): ResolvedBucketMetrics | null => {
    const withTokens = engineCandidates.filter((e) => e.kvCacheTokens !== null || e.maxConcurrency !== null);
    if (dp !== null) {
      const exactDp = withTokens.find((e) => e.meta.dp === dp);
      if (exactDp) return exactDp;
      const sharedEngine = withTokens.find((e) => e.meta.dp === null);
      if (sharedEngine) return sharedEngine;
      if (defaultBucket && (defaultBucket.kvCacheTokens !== null || defaultBucket.maxConcurrency !== null)) {
        return defaultBucket;
      }
      return null;
    }
    const sharedEngine = withTokens.find((e) => e.meta.dp === null);
    if (sharedEngine) return sharedEngine;
    const singleDp0 = withTokens.length === 1 && withTokens[0]!.meta.dp === 0 ? withTokens[0]! : null;
    if (singleDp0) return singleDp0;
    if (defaultBucket && (defaultBucket.kvCacheTokens !== null || defaultBucket.maxConcurrency !== null)) {
      return defaultBucket;
    }
    return null;
  };

  const allEngineBuckets = allResolved
    .filter((r) => r.meta.role === "engine")
    .sort((a, b) => compareScopeCanonical(a.meta, b.meta));
  const findEngineExpandableState = (dp: number | null): boolean | null => {
    const withState = allEngineBuckets.filter((e) => e.expandableSegmentsState !== null);
    if (dp !== null) {
      const exactDp = withState.find((e) => e.meta.dp === dp);
      if (exactDp) return exactDp.expandableSegmentsState;
      const sharedEngine = withState.find((e) => e.meta.dp === null);
      if (sharedEngine) return sharedEngine.expandableSegmentsState;
      return null;
    }
    const sharedEngine = withState.find((e) => e.meta.dp === null);
    if (sharedEngine) return sharedEngine.expandableSegmentsState;
    const singleDp0 = withState.length === 1 && withState[0]!.meta.dp === 0 ? withState[0]! : null;
    return singleDp0?.expandableSegmentsState ?? null;
  };

  let candidates: ResolvedBucketMetrics[];
  if (workerCandidates.length > 0) {
    candidates = workerCandidates.map((w) => {
      const eng = findMatchingEngine(w.meta.dp);
      const inheritedExpandable =
        w.expandableSegmentsState ??
        findEngineExpandableState(w.meta.dp) ??
        defaultBucket?.expandableSegmentsState ??
        null;
      if (!eng) {
        return inheritedExpandable === w.expandableSegmentsState
          ? w
          : { ...w, expandableSegmentsState: inheritedExpandable };
      }
      return {
        ...w,
        expandableSegmentsState: inheritedExpandable,
        kvCacheTokens: w.kvCacheTokens ?? eng.kvCacheTokens,
        kvCacheDeviceLabel: w.kvCacheDeviceLabel ?? eng.kvCacheDeviceLabel,
        maxConcurrency: w.maxConcurrency ?? eng.maxConcurrency,
        maxConcurrencyModelLen: w.maxConcurrencyModelLen ?? eng.maxConcurrencyModelLen,
      };
    });
  } else if (engineCandidates.length > 0) {
    candidates = engineCandidates.map((e) => ({
      ...e,
      expandableSegmentsState: e.expandableSegmentsState ?? defaultBucket?.expandableSegmentsState ?? null,
    }));
  } else if (defaultBucket && hasAnyBucketMetric(defaultBucket)) {
    candidates = [defaultBucket];
  } else {
    candidates = [
      resolveScopeBucket(
        createScopeBucket({
          key: "default",
          label: "default",
          role: "default",
          pid: null,
          dp: null,
          pp: null,
          tp: null,
          ep: null,
        }),
      ),
    ];
  }

  const labelCounts = new Map<string, number>();
  for (const c of candidates) {
    if (c.meta.role !== "default") {
      labelCounts.set(c.meta.label, (labelCounts.get(c.meta.label) ?? 0) + 1);
    }
  }
  const formatCandidateLabel = (c: ResolvedBucketMetrics): string => {
    if ((labelCounts.get(c.meta.label) ?? 0) > 1 && c.meta.pid !== null) {
      return `${c.meta.label} (pid=${c.meta.pid})`;
    }
    return c.meta.label;
  };

  const sortedCandidates = [...candidates].sort(
    (a, b) =>
      scoreBucketCompleteness(b) - scoreBucketCompleteness(a) || compareScopeCanonical(a.meta, b.meta),
  );
  const namedSnapshots = candidates
    .filter((c) => c.meta.role !== "default")
    .sort((a, b) => compareScopeCanonical(a.meta, b.meta))
    .map((c) => ({ ...toRankSnapshot(c), rankLabel: formatCandidateLabel(c) }));
  const detectedRanks = namedSnapshots.map((s) => s.rankLabel);

  const requestedTarget = options?.targetRank?.trim().toLowerCase();
  const explicitMatch = requestedTarget
    ? sortedCandidates.find(
        (c) =>
          formatCandidateLabel(c).toLowerCase() === requestedTarget ||
          c.meta.label.toLowerCase() === requestedTarget,
      )
    : undefined;

  // Deterministic order-independent selection: highest completeness, tie-broken by canonical (dp, pp, tp, ep, label, pid)
  const selected = explicitMatch ?? sortedCandidates[0]!;

  const selectedRankLabel = selected.meta.role !== "default" ? formatCandidateLabel(selected) : null;
  const crossRankNotes: string[] = [];
  if (namedSnapshots.length > 1 && selectedRankLabel) {
    crossRankNotes.push(
      `检测到 ${namedSnapshots.length} 个独立 Rank（${detectedRanks.join("、")}），已按确定性单卡口径选定 ${selectedRankLabel} 对账，未跨进程混拼指标。`,
    );
    const graphEntries = namedSnapshots.filter(
      (s): s is StartupLogRankSnapshot & { aclGraphGiB: number } => s.aclGraphGiB !== null,
    );
    if (graphEntries.length > 1) {
      const minG = Math.min(...graphEntries.map((e) => e.aclGraphGiB));
      const maxEntry = [...graphEntries].sort((a, b) => b.aclGraphGiB - a.aclGraphGiB)[0]!;
      if (maxEntry.aclGraphGiB - minG >= 0.005) {
        crossRankNotes.push(
          `各卡 ACLGraph 录图显存范围 ${minG.toFixed(2)}–${maxEntry.aclGraphGiB.toFixed(2)} GiB（最高 ${maxEntry.aclGraphGiB.toFixed(2)} GiB @ ${maxEntry.rankLabel}）。`,
        );
      }
    }
    const freeEntries = namedSnapshots.filter(
      (s): s is StartupLogRankSnapshot & { initialFreeGiB: number } => s.initialFreeGiB !== null,
    );
    if (freeEntries.length > 1) {
      const maxF = Math.max(...freeEntries.map((e) => e.initialFreeGiB));
      const minEntry = [...freeEntries].sort((a, b) => a.initialFreeGiB - b.initialFreeGiB)[0]!;
      if (maxF - minEntry.initialFreeGiB >= 0.005) {
        crossRankNotes.push(
          `各卡启动空闲显存范围 ${minEntry.initialFreeGiB.toFixed(2)}–${maxF.toFixed(2)} GiB（最低 ${minEntry.initialFreeGiB.toFixed(2)} GiB @ ${minEntry.rankLabel}）。`,
        );
      }
    }
  }

  return {
    weightsGiB: selected.weightsGiB,
    weightLoadSeconds: selected.weightLoadSeconds,
    nonKvCacheMemoryGiB: selected.nonKvCacheMemoryGiB,
    torchPeakIncreaseGiB: selected.torchPeakIncreaseGiB,
    nonTorchIncreaseGiB: selected.nonTorchIncreaseGiB,
    totalConsumedGiB: selected.totalConsumedGiB,
    availableKvGiB: selected.availableKvGiB,
    kvHalvedFor310pWorkspace: selected.kvHalvedFor310pWorkspace,
    expandableSegmentsDisabled: selected.expandableSegmentsState === false,
    kvCacheTokens: selected.kvCacheTokens,
    kvCacheDeviceLabel: selected.kvCacheDeviceLabel,
    maxConcurrency: selected.maxConcurrency,
    maxConcurrencyModelLen: selected.maxConcurrencyModelLen,
    aclGraphGiB: selected.aclGraphGiB,
    aclGraphSeconds: selected.aclGraphSeconds,
    initialFreeGiB: selected.initialFreeGiB,
    totalDeviceGiB: selected.totalDeviceGiB,
    gpuMemoryUtilization: selected.gpuMemoryUtilization,
    requestedMemoryGiB: selected.requestedMemoryGiB,
    suggestedKvMemoryBytes: selected.suggestedKvMemoryBytes,
    suggestedKvMemoryGiB: selected.suggestedKvMemoryGiB,
    torchReservedAfterWarmupGiB: selected.torchReservedAfterWarmupGiB,
    torchAllocatedAfterWarmupGiB: selected.torchAllocatedAfterWarmupGiB,
    selectedRankLabel,
    detectedRanks,
    rankSnapshots: namedSnapshots,
    crossRankNotes,
    detectedErrors,
    matchedLines,
    hasAnyMetric: hasAnyBucketMetric(selected),
  };
}

const GIB_TOLERANCE = 0.05;

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function classifyRange(
  measured: number,
  low: number,
  high: number,
  tol: number,
): "within-interval" | "above-interval" | "below-interval" {
  if (measured < low - tol) return "below-interval";
  if (measured > high + tol) return "above-interval";
  return "within-interval";
}

function reconcileWeightsAndNonKv(
  plan: DeployPlanReport,
  parsed: ParsedStartupLog,
): { weights: ReconciliationItem; nonKvOverhead: ReconciliationItem } {
  const s3 = plan.stages[2];
  const s4 = plan.stages[3];
  const s5 = plan.stages[4];
  const requestedGiB = parsed.requestedMemoryGiB ?? plan.requestedBytes / GIB;

  // 1. Weights
  const wLow = s3.lowBytes / GIB;
  const wPoint = s3.pointEstimateBytes / GIB;
  const wHigh = s3.highBytes / GIB;
  let weights: ReconciliationItem;
  if (parsed.weightsGiB === null) {
    weights = {
      id: "weights",
      title: "常驻模型权重（Stage 3）",
      unit: "GiB",
      predictedLow: round2(wLow),
      predictedPoint: round2(wPoint),
      predictedHigh: round2(wHigh),
      measured: null,
      delta: null,
      deltaGiB: null,
      status: "missing",
      summary: "日志中未找到权重加载行（Model loading took / Loading model weights took / Actual usage）。",
      likelyRootCauses: [],
    };
  } else {
    const m = parsed.weightsGiB;
    const delta = round2(m - wPoint);
    const status: ReconciliationItemStatus =
      m >= requestedGiB ? "oom-risk" : classifyRange(m, wLow, wHigh, GIB_TOLERANCE);
    const causes: string[] = [];
    if (status === "above-interval" || status === "oom-risk") {
      causes.push("权重实占高于预测：检查实际 TP/PP/EP 切分是否与算账台一致。");
      causes.push("若加载原生分块 FP8 到 A2/A3（v0.30.0），会静默反量化回 2 B BF16 导致权重翻倍。");
      causes.push(
        "检查是否开启 weight_nz_mode=2（FRACTAL_NZ 对齐膨胀）或包含未计入的视觉塔 / MTP 草稿层权重。",
      );
    } else if (status === "below-interval") {
      causes.push("权重实占低于预测：检查实机是否启用了 W8A8/W4A8 量化或更高的 TP/EP 并行度。");
    }
    weights = {
      id: "weights",
      title: "常驻模型权重（Stage 3）",
      unit: "GiB",
      predictedLow: round2(wLow),
      predictedPoint: round2(wPoint),
      predictedHigh: round2(wHigh),
      measured: round2(m),
      delta,
      deltaGiB: delta,
      status,
      summary: `实测 ${m.toFixed(2)} GiB vs 预测 [${wLow.toFixed(2)}, ${wHigh.toFixed(2)}] GiB（差值 ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} GiB）。`,
      likelyRootCauses: causes,
    };
  }

  // 2. Non-KV overhead (Stage 3 + 4 + 5 = profile_result.non_kv_cache_memory; HCCL already inside!)
  // With expandable_segments:True (v0.30.0 default), allocator block-splitting slack (~0.65 GiB on A2/A3/A5, 0.30 GiB on 310P)
  // and sequential-op buffer reuse allow profile_run peak above weights+HCCL to reach max(0.10..0.20 GiB, 0.45 * liveOpActivation),
  // while preserving genuine large-T live activation growth and respecting explicit expandable_segments:False logs.
  const isSingleRank =
    plan.inputSummary.tpSize *
      plan.inputSummary.ppSize *
      plan.inputSummary.dpSize *
      plan.inputSummary.pcpSize <=
    1;
  const hcclMaterializedGiB = isSingleRank ? 0 : plan.hcclEstimate.totalMaterializedMiB / 1024;
  const baseAllocSlackGiB = plan.card.family === "310P" ? 0.3 : 0.65;
  const liveOpActivationGiB = Math.max(0, s4.lowBytes / GIB - baseAllocSlackGiB);
  const tightActFloorGiB = Math.max(hcclMaterializedGiB > 0 ? 0.1 : 0.2, 0.45 * liveOpActivationGiB);
  const expandableTightFloorGiB = wLow + hcclMaterializedGiB + tightActFloorGiB;
  const baseNkvLowGiB = (s3.lowBytes + s4.lowBytes + s5.lowBytes) / GIB;
  const nkvLow = parsed.expandableSegmentsDisabled
    ? baseNkvLowGiB
    : Math.min(baseNkvLowGiB, expandableTightFloorGiB);
  const nkvPoint = (s3.pointEstimateBytes + s4.pointEstimateBytes + s5.pointEstimateBytes) / GIB;
  const nkvHigh = (s3.highBytes + s4.highBytes + s5.highBytes) / GIB;
  const measuredNonKv = parsed.nonKvCacheMemoryGiB;

  let nonKvOverhead: ReconciliationItem;
  if (measuredNonKv === null) {
    nonKvOverhead = {
      id: "nonKvOverhead",
      title: "非 KV 总开销（Stage 3+4+5，已含 HCCL）",
      unit: "GiB",
      predictedLow: round2(nkvLow),
      predictedPoint: round2(nkvPoint),
      predictedHigh: round2(nkvHigh),
      measured: null,
      delta: null,
      deltaGiB: null,
      status: "missing",
      summary: "日志中未找到 non_kv_cache_memory 或完整的 Actual usage 拆解行。",
      likelyRootCauses: [],
    };
  } else {
    const delta = round2(measuredNonKv - nkvPoint);
    const status: ReconciliationItemStatus =
      measuredNonKv >= requestedGiB
        ? "oom-risk"
        : classifyRange(measuredNonKv, nkvLow, nkvHigh, GIB_TOLERANCE);
    const causes: string[] = [];
    if (status === "above-interval" || status === "oom-risk") {
      causes.push(
        "实测 non_kv_cache_memory 偏高：排查 max_num_batched_tokens、CANN 算子工作区或 MoE 双路径 MC2 预热峰值。",
      );
      causes.push("检查 HCCL_BUFFSIZE 环境变量是否过大，或 _HCCL_PG_REGISTRY 未跨 group_name 复用通信域。");
    } else if (status === "below-interval") {
      causes.push("实测非 KV 总开销低于预测：PyTorch 缓冲复用更紧密或实际 max_num_batched_tokens 较小。");
    }
    causes.push(
      `口径守恒：non_kv_cache_memory 已包含具象化 HCCL（估算 ${plan.hcclEstimate.totalMaterializedMiB} MiB）与 CANN 非 Torch 增量，未做二次扣减。`,
    );
    nonKvOverhead = {
      id: "nonKvOverhead",
      title: "非 KV 总开销（Stage 3+4+5，已含 HCCL）",
      unit: "GiB",
      predictedLow: round2(nkvLow),
      predictedPoint: round2(nkvPoint),
      predictedHigh: round2(nkvHigh),
      measured: round2(measuredNonKv),
      delta,
      deltaGiB: delta,
      status,
      summary: `实测 ${measuredNonKv.toFixed(2)} GiB vs 预测 [${nkvLow.toFixed(2)}, ${nkvHigh.toFixed(2)}] GiB（差值 ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} GiB；不重复扣 HCCL）。`,
      likelyRootCauses: causes,
    };
  }

  return { weights, nonKvOverhead };
}

export function reconcileStartupLog(
  plan: DeployPlanReport,
  parsed: ParsedStartupLog,
): LogReconciliationReport {
  const { weights, nonKvOverhead } = reconcileWeightsAndNonKv(plan, parsed);
  const q2 = plan.fourQuestions.q2Capacity;
  const redundancyGiB = HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB / 1024;
  const requestedGiB = parsed.requestedMemoryGiB ?? plan.requestedBytes / GIB;
  const totalDevGiB = parsed.totalDeviceGiB ?? plan.totalHbmBytes / GIB;
  const unbudgetedGiB = totalDevGiB - requestedGiB;
  const preOccupiedGiB =
    parsed.totalDeviceGiB !== null && parsed.initialFreeGiB !== null
      ? Math.max(0, parsed.totalDeviceGiB - parsed.initialFreeGiB)
      : 0;
  const usableHeadroomGiB = Math.max(0, unbudgetedGiB - preOccupiedGiB);

  // 3. Available KV cache memory (align budget against OS-visible requestedMemoryGiB & expandable_segments tight floor)
  const scaleKvBytes = (rawBytes: number): number =>
    rawBytes <= 0 ? 0 : plan.card.halvesKvForWorkspace ? Math.floor(rawBytes / 2) : Math.floor(rawBytes);
  const targetRequestedBytes =
    parsed.requestedMemoryGiB !== null ? parsed.requestedMemoryGiB * GIB : plan.requestedBytes;
  const isSingleRank =
    plan.inputSummary.tpSize *
      plan.inputSummary.ppSize *
      plan.inputSummary.dpSize *
      plan.inputSummary.pcpSize <=
    1;
  const hcclFloorBytes = isSingleRank ? 0 : plan.hcclEstimate.totalMaterializedMiB * MIB;
  const baseAllocSlackBytes = (plan.card.family === "310P" ? 0.3 : 0.65) * GIB;
  const liveOpActBytes = Math.max(0, plan.stages[3].lowBytes - baseAllocSlackBytes);
  const tightActFloorBytes = Math.max(
    (hcclFloorBytes > 0 ? 0.1 : 0.2) * GIB,
    Math.round(0.45 * liveOpActBytes),
  );
  const stageExpandableTightCeilBytes = (stageWeightLowBytes: number): number => {
    if (parsed.requestedMemoryGiB === null || parsed.expandableSegmentsDisabled) return 0;
    return scaleKvBytes(targetRequestedBytes - (stageWeightLowBytes + hcclFloorBytes + tightActFloorBytes));
  };
  const expandableTightKvCeilBytes = stageExpandableTightCeilBytes(plan.stages[2].lowBytes);
  const s3 = plan.stages[2];
  const s4 = plan.stages[3];
  const s5 = plan.stages[4];
  const adjKvLowBytes =
    parsed.requestedMemoryGiB !== null
      ? scaleKvBytes(targetRequestedBytes - (s3.highBytes + s4.highBytes + s5.highBytes))
      : q2.kvPoolLowBytes;
  const adjKvPointBytes =
    parsed.requestedMemoryGiB !== null
      ? scaleKvBytes(
          targetRequestedBytes - (s3.pointEstimateBytes + s4.pointEstimateBytes + s5.pointEstimateBytes),
        )
      : q2.kvPoolPointBytes;
  const adjKvHighBytes =
    parsed.requestedMemoryGiB !== null
      ? Math.max(
          scaleKvBytes(targetRequestedBytes - (s3.lowBytes + s4.lowBytes + s5.lowBytes)),
          expandableTightKvCeilBytes,
        )
      : q2.kvPoolHighBytes;
  const kvLow = adjKvLowBytes / GIB;
  const kvPoint = adjKvPointBytes / GIB;
  const kvHigh = adjKvHighBytes / GIB;
  const fixedLinearStateBytes = Math.max(q2.totalFixedLinearStateBytes, q2.perSeqFixedLinearStateBytes);
  const pagedMinSingleSeqBytes = q2.blocksPerMaxSeq > 0 ? (q2.blocksPerMaxSeq + 1) * q2.kvBytesPerBlock : 0;
  const minOneSeqBytes = pagedMinSingleSeqBytes + fixedLinearStateBytes;
  const minOneSeqGiB = minOneSeqBytes / GIB;
  const staticPlanInsufficient =
    q2.oomStatus === "insufficient_for_single_max_len_seq" ||
    q2.oomStatus === "non_kv_exceeds_budget" ||
    q2.oomStatus === "weights_exceed_budget" ||
    q2.oomStatus === "weights_plus_activation_exceed_budget";
  const planReportsInsufficient =
    parsed.requestedMemoryGiB !== null
      ? adjKvPointBytes <= 0 || adjKvPointBytes < minOneSeqBytes
      : staticPlanInsufficient;
  let availableKv: ReconciliationItem;
  if (parsed.availableKvGiB === null) {
    availableKv = {
      id: "availableKv",
      title: "可用 KV Cache 显存（Stage 6）",
      unit: "GiB",
      predictedLow: round2(kvLow),
      predictedPoint: round2(kvPoint),
      predictedHigh: round2(kvHigh),
      measured: null,
      delta: null,
      deltaGiB: null,
      status: "missing",
      summary: "日志中未找到 Available KV cache memory 行。",
      likelyRootCauses: [],
    };
  } else {
    const m = parsed.availableKvGiB;
    const delta = round2(m - kvPoint);
    const rangeStatus = classifyRange(m, kvLow, kvHigh, GIB_TOLERANCE);
    const belowHardFloor = m <= 0 || m < minOneSeqGiB;
    const status: ReconciliationItemStatus =
      belowHardFloor || (planReportsInsufficient && rangeStatus === "within-interval")
        ? "oom-risk"
        : rangeStatus;
    const causes: string[] = [];
    if (parsed.kvHalvedFor310pWorkspace && !plan.card.halvesKvForWorkspace) {
      causes.push("日志含 (halved for workspace)，说明实机是 310P (worker_310p.py // 2)，请核对卡型选择。");
    }
    const nominalCardGiB = plan.totalHbmBytes / GIB;
    if (parsed.totalDeviceGiB !== null && nominalCardGiB - parsed.totalDeviceGiB > 1.0) {
      const carveoutGiB = nominalCardGiB - parsed.totalDeviceGiB;
      causes.push(
        `实机 OS 可见总显存为 ${parsed.totalDeviceGiB.toFixed(2)} GiB（标称 ${nominalCardGiB.toFixed(2)} GiB 中约 ${carveoutGiB.toFixed(2)} GiB 由驱动/固件/页表预留），requested_memory 按 ${parsed.totalDeviceGiB.toFixed(2)}×u 计算。`,
      );
    }
    if (belowHardFloor) {
      causes.push(
        fixedLinearStateBytes > 0
          ? `实测可用 KV（${m.toFixed(2)} GiB）低于 Stage 6 最低启动门槛 ${minOneSeqGiB.toFixed(2)} GiB（固定线性态 ${(fixedLinearStateBytes / GIB).toFixed(2)} GiB + 单条满长请求分页块与 null block），不足以承接单条满长序列。`
          : `实测可用 KV（${m.toFixed(2)} GiB）低于 Stage 6 单条满长请求 + null block 最低启动门槛 ${minOneSeqGiB.toFixed(2)} GiB。`,
      );
    } else if (planReportsInsufficient && status === "oom-risk") {
      causes.push(
        staticPlanInsufficient
          ? `静态部署计算器已判定当前配置容量不足（${q2.oomStatus}），实测可用 KV（${m.toFixed(2)} GiB）落在该不足区间内，不能按可行状态放行。`
          : `按实机日志 requested_memory（${requestedGiB.toFixed(2)} GiB）重算后当前可用 KV 点估计不足以承接满长序列，不能按可行状态放行。`,
      );
    }
    if (status === "below-interval" || status === "oom-risk") {
      causes.push(
        "实测可用 KV 低于预期：检查实际 gpu_memory_utilization、权重精度（如 FP8 静默转 BF16）或 CANN 非 Torch 占用。",
      );
    } else if (status === "above-interval") {
      causes.push("实测可用 KV 高于预期：实际激活峰值或非 Torch 增量低于保守估算，或实机 u 更高。");
    }
    availableKv = {
      id: "availableKv",
      title: "可用 KV Cache 显存（Stage 6）",
      unit: "GiB",
      predictedLow: round2(kvLow),
      predictedPoint: round2(kvPoint),
      predictedHigh: round2(kvHigh),
      measured: round2(m),
      delta,
      deltaGiB: delta,
      status,
      summary: `实测 ${m.toFixed(2)} GiB vs 预测 [${kvLow.toFixed(2)}, ${kvHigh.toFixed(2)}] GiB（差值 ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} GiB）。`,
      likelyRootCauses: causes,
    };
  }

  // 4. KV cache token slots — aligned with upstream vllm@ced6857a:kv_cache_utils.py#L2373-L2383
  // get_kv_cache_capacity: floor((usableBlocks / ceil(maxModelLen / virtualBlockTokens)) * maxModelLen)
  const virtualBlockTokens = q2.effectiveBlockSize * Math.max(1, plan.inputSummary.dcpSize);
  const pagedBlocksPerMaxSeq =
    virtualBlockTokens > 0 ? Math.ceil(plan.inputSummary.maxModelLen / virtualBlockTokens) : 0;
  const toEffectiveKvTokens = (rawSlots: number): number => {
    if (rawSlots <= 0 || virtualBlockTokens <= 0 || pagedBlocksPerMaxSeq <= 0) return 0;
    const usablePagedBlocks = rawSlots / virtualBlockTokens;
    return Math.floor((usablePagedBlocks / pagedBlocksPerMaxSeq) * plan.inputSummary.maxModelLen);
  };
  const pagedStageSlices = (q2.ppStageSlices ?? []).filter((s) => s.kvBytesPerBlock > 0);
  const computeShiftedPagedStageRawSlots = (mode: "low" | "point" | "high"): number | null => {
    if (pagedStageSlices.length === 0) return null;
    const s4 = plan.stages[3];
    const s5 = plan.stages[4];
    const perStageUsable = pagedStageSlices.map((s) => {
      let sKvPool: number;
      if (mode === "low") {
        sKvPool = scaleKvBytes(targetRequestedBytes - (s.wHighBytes + s4.highBytes + s5.highBytes));
      } else if (mode === "point") {
        sKvPool = scaleKvBytes(
          targetRequestedBytes - (s.wPointBytes + s4.pointEstimateBytes + s5.pointEstimateBytes),
        );
      } else {
        const baseHigh = scaleKvBytes(targetRequestedBytes - (s.wLowBytes + s4.lowBytes + s5.lowBytes));
        sKvPool = Math.max(baseHigh, stageExpandableTightCeilBytes(s.wLowBytes));
      }
      const sPaged = Math.max(0, sKvPool - s.fixedLinearStateBytes);
      const sRawBlocks = Math.floor(sPaged / s.kvBytesPerBlock);
      return Math.max(0, sRawBlocks - 1);
    });
    return Math.min(...perStageUsable) * virtualBlockTokens;
  };
  const toRawSlotsFromKvBytes = (
    mode: "low" | "point" | "high",
    kvBytes: number,
    origKvBytes: number,
    origRawSlots: number,
  ): number => {
    const exactStageSlots = computeShiftedPagedStageRawSlots(mode);
    if (exactStageSlots !== null) return exactStageSlots;
    const pagedPoolBytes = Math.max(0, kvBytes - q2.totalFixedLinearStateBytes);
    if (q2.kvBytesPerBlock > 0) {
      const rawBlocks = Math.floor(pagedPoolBytes / q2.kvBytesPerBlock);
      const usableBlocks = Math.max(0, rawBlocks - 1);
      return usableBlocks * virtualBlockTokens;
    }
    const origPagedBytes = Math.max(0, origKvBytes - q2.totalFixedLinearStateBytes);
    if (origPagedBytes <= 0 || origRawSlots <= 0) return 0;
    if (Math.abs(pagedPoolBytes - origPagedBytes) <= 1024 * 1024) return origRawSlots;
    return Math.floor((origRawSlots * pagedPoolBytes) / origPagedBytes);
  };
  const hasMeasuredBudget = parsed.requestedMemoryGiB !== null;
  const tokLow = toEffectiveKvTokens(
    hasMeasuredBudget
      ? toRawSlotsFromKvBytes("low", adjKvLowBytes, q2.kvPoolLowBytes, q2.totalKvTokenSlotsRange[0])
      : q2.totalKvTokenSlotsRange[0],
  );
  const tokPoint = toEffectiveKvTokens(
    hasMeasuredBudget
      ? toRawSlotsFromKvBytes("point", adjKvPointBytes, q2.kvPoolPointBytes, q2.totalKvTokenSlotsPoint)
      : q2.totalKvTokenSlotsPoint,
  );
  const tokHigh = toEffectiveKvTokens(
    hasMeasuredBudget
      ? toRawSlotsFromKvBytes("high", adjKvHighBytes, q2.kvPoolHighBytes, q2.totalKvTokenSlotsRange[1])
      : q2.totalKvTokenSlotsRange[1],
  );
  const packingRatio =
    pagedBlocksPerMaxSeq > 0 && virtualBlockTokens > 0
      ? plan.inputSummary.maxModelLen / (pagedBlocksPerMaxSeq * virtualBlockTokens)
      : 1;
  const expectedKvBytesPerEffectiveToken =
    packingRatio > 0 ? q2.kvBytesPerTokenPerRank / packingRatio : q2.kvBytesPerTokenPerRank;
  const impliedKvBytesPerToken =
    parsed.availableKvGiB !== null && parsed.kvCacheTokens !== null && parsed.kvCacheTokens > 0
      ? Math.round((parsed.availableKvGiB * GIB) / parsed.kvCacheTokens)
      : null;

  let kvTokens: ReconciliationItem;
  if (parsed.kvCacheTokens === null) {
    kvTokens = {
      id: "kvTokens",
      title: "KV Cache Token 容量（扣 1 null block）",
      unit: "tokens",
      predictedLow: tokLow,
      predictedPoint: tokPoint,
      predictedHigh: tokHigh,
      measured: null,
      delta: null,
      deltaGiB: null,
      status: "missing",
      summary: "日志中未找到 GPU/NPU KV cache size 行。",
      likelyRootCauses: [],
    };
  } else {
    const m = parsed.kvCacheTokens;
    const delta = m - tokPoint;
    const tokTol = Math.max(q2.effectiveBlockSize * 2, 256);
    const status: ReconciliationItemStatus =
      m < plan.inputSummary.maxModelLen ? "oom-risk" : classifyRange(m, tokLow, tokHigh, tokTol);
    const causes: string[] = [];
    if (
      impliedKvBytesPerToken !== null &&
      expectedKvBytesPerEffectiveToken > 0 &&
      Math.abs(impliedKvBytesPerToken - expectedKvBytesPerEffectiveToken) / expectedKvBytesPerEffectiveToken >
        0.15
    ) {
      causes.push(
        `日志推算单 token KV 约 ${(impliedKvBytesPerToken / 1024).toFixed(1)} KiB，与当前配置理论值 ${(expectedKvBytesPerEffectiveToken / 1024).toFixed(1)} KiB 偏差超 15%：检查 TP、PP、--kv-cache-dtype 或多 DP 汇总口径。`,
      );
    }
    if (status === "below-interval" || status === "oom-risk") {
      causes.push("Token 槽位偏少：核对同组各卡 min_num_blocks 木桶效应与 block_size 配置。");
    }
    kvTokens = {
      id: "kvTokens",
      title: "KV Cache Token 容量（扣 1 null block）",
      unit: "tokens",
      predictedLow: tokLow,
      predictedPoint: tokPoint,
      predictedHigh: tokHigh,
      measured: m,
      delta,
      deltaGiB: null,
      status,
      summary: `实测 ${m.toLocaleString()} tokens vs 预测 [${tokLow.toLocaleString()}, ${tokHigh.toLocaleString()}] tokens。`,
      likelyRootCauses: causes,
    };
  }

  // 5. ACLGraph capture memory
  const cgLow = plan.aclGraphRangeBytes[0] / GIB;
  const cgPoint = plan.aclGraphPointBytes / GIB;
  const cgHigh = plan.aclGraphRangeBytes[1] / GIB;
  let aclGraph: ReconciliationItem;
  if (parsed.aclGraphGiB === null) {
    aclGraph = {
      id: "aclGraph",
      title: "ACLGraph 录图显存（Stage 7，预算外支付）",
      unit: "GiB",
      predictedLow: round2(cgLow),
      predictedPoint: round2(cgPoint),
      predictedHigh: round2(cgHigh),
      measured: null,
      delta: null,
      deltaGiB: null,
      status: "missing",
      summary: "日志中未找到 Graph capturing finished / NPU graph memory 字段。",
      likelyRootCauses: [],
    };
  } else {
    const m = parsed.aclGraphGiB;
    const delta = round2(m - cgPoint);
    const status: ReconciliationItemStatus =
      m + redundancyGiB > usableHeadroomGiB ? "oom-risk" : classifyRange(m, cgLow, cgHigh, GIB_TOLERANCE);
    const causes: string[] = [];
    if (status === "oom-risk") {
      causes.push(
        `实测图显存 ${m.toFixed(2)} GiB + 150 MiB 裕度已超过可用预算外余量 ${usableHeadroomGiB.toFixed(2)} GiB，存在录图/首请求 OOM 风险！`,
      );
    } else if (status === "above-interval") {
      causes.push(
        "图显存高于预测：检查实际 cudagraph_capture_sizes 档数或 cudagraph_mode（FULL/PIECEWISE）。",
      );
    }
    aclGraph = {
      id: "aclGraph",
      title: "ACLGraph 录图显存（Stage 7，预算外支付）",
      unit: "GiB",
      predictedLow: round2(cgLow),
      predictedPoint: round2(cgPoint),
      predictedHigh: round2(cgHigh),
      measured: round2(m),
      delta,
      deltaGiB: delta,
      status,
      summary: `实测 ${m.toFixed(2)} GiB vs 预测 [${cgLow.toFixed(2)}, ${cgHigh.toFixed(2)}] GiB（由 1−u 余量支付）。`,
      likelyRootCauses: causes,
    };
  }

  // 6. Headroom safety (1 - u cushion after pre-startup occupancy, ACLGraph, and 150 MiB redundancy)
  const graphEnabled = !plan.inputSummary.enforceEager && plan.inputSummary.cudagraphMode !== "NONE";
  const hasStartupFreeSnapshot = parsed.initialFreeGiB !== null && parsed.totalDeviceGiB !== null;
  const predCushionLow = round2(usableHeadroomGiB - plan.stages[6].highBytes / GIB);
  const predCushionPoint = round2(usableHeadroomGiB - plan.stages[6].pointEstimateBytes / GIB);
  const predCushionHigh = round2(usableHeadroomGiB - plan.stages[6].lowBytes / GIB);
  let headroomSafety: ReconciliationItem;
  if (parsed.aclGraphGiB === null && parsed.initialFreeGiB === null) {
    headroomSafety = {
      id: "headroomSafety",
      title: "预算外 1−u 安全余量（扣录图与 150 MiB 裕度后）",
      unit: "GiB",
      predictedLow: predCushionLow,
      predictedPoint: predCushionPoint,
      predictedHigh: predCushionHigh,
      measured: null,
      delta: null,
      deltaGiB: null,
      status: "missing",
      summary: "缺少启动空闲显存与 ACLGraph 实测值，无法计算实机预算外净余量。",
      likelyRootCauses: [],
    };
  } else {
    const measuredGraph = parsed.aclGraphGiB ?? cgPoint;
    const netCushionGiB = round2(usableHeadroomGiB - measuredGraph - redundancyGiB);
    const lacksMeasuredInputsForPositiveCushion =
      netCushionGiB >= 0 && (!hasStartupFreeSnapshot || (graphEnabled && parsed.aclGraphGiB === null));
    if (lacksMeasuredInputsForPositiveCushion) {
      headroomSafety = {
        id: "headroomSafety",
        title: "预算外 1−u 安全余量（扣录图与 150 MiB 裕度后）",
        unit: "GiB",
        predictedLow: predCushionLow,
        predictedPoint: predCushionPoint,
        predictedHigh: predCushionHigh,
        measured: null,
        delta: null,
        deltaGiB: null,
        status: "missing",
        summary: !hasStartupFreeSnapshot
          ? `缺少 Free memory on device 启动快照（未知启动前同卡占用与真实可用上限，仅按 0 占用上界估算约 +${netCushionGiB.toFixed(2)} GiB），无法闭环核验预算外 1−u 净余量。`
          : "缺少 Graph capturing finished 录图实测行，无法闭环核验预算外 1−u 净余量。",
        likelyRootCauses: [],
      };
    } else {
      const delta = round2(netCushionGiB - predCushionPoint);
      const status: ReconciliationItemStatus =
        netCushionGiB < 0
          ? "oom-risk"
          : netCushionGiB < 0.5
            ? "below-interval"
            : classifyRange(netCushionGiB, Math.max(0, predCushionLow), Math.max(0.5, predCushionHigh), 0.25);
      const causes: string[] = [];
      if (preOccupiedGiB > 0.2) {
        causes.push(
          `启动快照前同卡已有 ${preOccupiedGiB.toFixed(2)} GiB 被系统/其他进程占用，吃掉了部分 1−u 余量。`,
        );
      }
      if (status === "oom-risk" || status === "below-interval") {
        causes.push(
          "预算外净余量过薄：建议下调 --gpu-memory-utilization 或按 worker.py 建议的 --kv-cache-memory 显式锁定。",
        );
      }
      headroomSafety = {
        id: "headroomSafety",
        title: "预算外 1−u 安全余量（扣录图与 150 MiB 裕度后）",
        unit: "GiB",
        predictedLow: predCushionLow,
        predictedPoint: predCushionPoint,
        predictedHigh: predCushionHigh,
        measured: netCushionGiB,
        delta,
        deltaGiB: delta,
        status,
        summary: `净安全余量 ${netCushionGiB >= 0 ? "+" : ""}${netCushionGiB.toFixed(2)} GiB（1−u=${unbudgetedGiB.toFixed(2)} GiB − 启动前占用 ${preOccupiedGiB.toFixed(2)} GiB − 录图 ${measuredGraph.toFixed(2)} GiB − 150 MiB）。`,
        likelyRootCauses: causes,
      };
    }
  }

  const items: ReconciliationItem[] = [
    weights,
    nonKvOverhead,
    availableKv,
    kvTokens,
    aclGraph,
    headroomSafety,
  ];
  const byKey: Record<ReconciliationItemId, ReconciliationItem> = {
    weights,
    nonKvOverhead,
    availableKv,
    kvTokens,
    aclGraph,
    headroomSafety,
  };

  const hasOom = parsed.detectedErrors.length > 0 || items.some((it) => it.status === "oom-risk");
  const measuredItems = items.filter((it) => it.status !== "missing");
  const hasDrift = measuredItems.some(
    (it) => it.status === "above-interval" || it.status === "below-interval",
  );
  const requiredClosureItems = graphEnabled ? items : [weights, nonKvOverhead, availableKv, kvTokens];
  const measuredRequired = requiredClosureItems.filter((it) => it.status !== "missing");
  const missingRequired = requiredClosureItems.filter((it) => it.status === "missing");
  const overallStatus: LogReconciliationReport["overallStatus"] = hasOom
    ? "oom-risk"
    : measuredItems.length === 0
      ? "incomplete"
      : hasDrift
        ? "drift"
        : missingRequired.length > 0
          ? "partial"
          : "aligned";

  const hcclAccountingNote =
    `HCCL 不二次扣减守恒（vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L461-L634）：` +
    `init_snapshot 拍在分布式通信建组之前，profile_run() 测得的 non_torch_increase 与 non_kv_cache_memory ` +
    `已完整包含具象化的 HCCL（${plan.hcclEstimate.totalMaterializedMiB} MiB）及 MC2 缓冲；对账绝不重复扣除 HCCL，` +
    `仅保留 worker.py 的 ${HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB} MiB（${((HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB * MIB) / GIB).toFixed(3)} GiB）安全裕度。`;

  const baseSummary =
    overallStatus === "aligned"
      ? `实机日志 ${measuredRequired.length}/${requiredClosureItems.length} 项全部落在 7 级静态区间内，显存账目闭环（HCCL 未二次扣减）。`
      : overallStatus === "partial"
        ? `已提取 ${measuredRequired.length}/${requiredClosureItems.length} 项且在预测区间内，但缺少关键账目（${missingRequired.map((it) => it.title).join("、")}），证据尚不完整，请补齐其余阶段启动日志后再核对全量账目。`
        : overallStatus === "oom-risk"
          ? `检测到 OOM 风险或启动报错，请优先检查标红项与预算外 1−u 余量。`
          : overallStatus === "incomplete"
            ? "未从粘贴文本中提取到可对账的启动显存指标，请粘贴包含 Model loading / Available KV cache memory / Actual usage 的日志段。"
            : `已对账 ${measuredItems.length} 项，部分指标偏离静态估算区间，请参考逐项根因提示。`;

  const summary =
    parsed.crossRankNotes.length > 0 ? `${baseSummary} ${parsed.crossRankNotes.join(" ")}` : baseSummary;

  return {
    overallStatus,
    hcclDoubleCounted: false,
    hcclAccountingNote,
    redundancyBufferMiB: HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB,
    impliedKvBytesPerToken,
    selectedRankLabel: parsed.selectedRankLabel,
    crossRankNotes: parsed.crossRankNotes,
    items,
    byKey,
    logErrors: parsed.detectedErrors,
    summary,
  };
}
