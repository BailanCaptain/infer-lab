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
  overallStatus: "aligned" | "drift" | "oom-risk" | "incomplete";
  hcclDoubleCounted: false;
  hcclAccountingNote: string;
  redundancyBufferMiB: number;
  impliedKvBytesPerToken: number | null;
  items: readonly ReconciliationItem[];
  byKey: Readonly<Record<ReconciliationItemId, ReconciliationItem>>;
  logErrors: readonly string[];
  summary: string;
}

export interface SampleStartupLogTemplate {
  id: string;
  title: string;
  isReferenceTemplate: true;
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
];

function toGiB(value: number, unit: string | undefined, treatGbAsGiB = false): number {
  const u = (unit ?? "gib").trim().toLowerCase();
  if (u === "mib") return value / 1024;
  if (u === "mb") return treatGbAsGiB ? value / 1024 : (value * 1e6) / GIB;
  if (u === "gb") return treatGbAsGiB ? value : (value * 1e9) / GIB;
  if (u === "kib") return value / (1024 * 1024);
  if (u === "b" || u === "bytes") return value / GIB;
  return value; // GiB
}

function parseIntWithCommas(raw: string): number {
  return Number.parseInt(raw.replace(/,/g, ""), 10);
}

export function parseAscendStartupLog(logText: string): ParsedStartupLog {
  const lines = logText.split(/\r?\n/);
  const matchedLines: StartupLogMatchedLine[] = [];
  const detectedErrors: string[] = [];

  let weightsGiB: number | null = null;
  let weightLoadSeconds: number | null = null;
  let nonKvCacheMemoryGiB: number | null = null;
  let torchPeakIncreaseGiB: number | null = null;
  let nonTorchIncreaseGiB: number | null = null;
  let totalConsumedGiB: number | null = null;
  let availableKvGiB: number | null = null;
  let kvHalvedFor310pWorkspace = false;
  let kvCacheTokens: number | null = null;
  let kvCacheDeviceLabel: string | null = null;
  let maxConcurrency: number | null = null;
  let maxConcurrencyModelLen: number | null = null;
  let aclGraphGiB: number | null = null;
  let aclGraphSeconds: number | null = null;
  let initialFreeGiB: number | null = null;
  let totalDeviceGiB: number | null = null;
  let gpuMemoryUtilization: number | null = null;
  let requestedMemoryGiB: number | null = null;
  let suggestedKvMemoryBytes: number | null = null;
  let suggestedKvMemoryGiB: number | null = null;
  let torchReservedAfterWarmupGiB: number | null = null;
  let torchAllocatedAfterWarmupGiB: number | null = null;

  const record = (idx: number, field: string, rawLine: string): void => {
    matchedLines.push({ lineNumber: idx + 1, field, rawLine: rawLine.trim() });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!line.trim()) continue;

    // 1. Model weight loading
    const mLoadVllm =
      /Model loading took\s+([\d.]+)\s*(GiB|GB|MiB|MB)(?:\s+memory(?:\s+and\s+([\d.]+)\s*s(?:ec(?:ond)?s?)?)?)?/i.exec(
        line,
      );
    if (mLoadVllm?.[1]) {
      weightsGiB = toGiB(Number.parseFloat(mLoadVllm[1]), mLoadVllm[2], true);
      if (mLoadVllm[3]) weightLoadSeconds = Number.parseFloat(mLoadVllm[3]);
      record(i, "weights", line);
    }
    const mLoadAscend = /Loading model weights took\s+([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mLoadAscend?.[1]) {
      // model_runner_v1.py#L4476 divides by 2**30 even though unit says "GB"
      weightsGiB = toGiB(Number.parseFloat(mLoadAscend[1]), mLoadAscend[2], true);
      record(i, "weights", line);
    }
    const mCkpt = /Checkpoint size\s*[:=]?\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mCkpt?.[1] && weightsGiB === null) {
      weightsGiB = toGiB(Number.parseFloat(mCkpt[1]), mCkpt[2], true);
      record(i, "weights", line);
    }

    // 2. Memory profiling repr (mem_utils.py#L217-L225) & key-value variants
    if (/Memory profiling takes/i.test(line) || /Total non KV cache memory/i.test(line)) {
      const mNonKv = /Total non KV cache memory:\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
      if (mNonKv?.[1]) nonKvCacheMemoryGiB = toGiB(Number.parseFloat(mNonKv[1]), mNonKv[2], true);
      const mPeak = /torch peak memory increase:\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
      if (mPeak?.[1]) torchPeakIncreaseGiB = toGiB(Number.parseFloat(mPeak[1]), mPeak[2], true);
      const mConsumed = /total consumed[^:]*:\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
      if (mConsumed?.[1]) totalConsumedGiB = toGiB(Number.parseFloat(mConsumed[1]), mConsumed[2], true);
      const mW = /weights memory:\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
      if (mW?.[1] && weightsGiB === null) weightsGiB = toGiB(Number.parseFloat(mW[1]), mW[2], true);
      record(i, "memoryProfiling", line);
    }

    const mKvNonKv = /\bnon_kv_cache_memory\s*[:=]\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mKvNonKv?.[1]) {
      nonKvCacheMemoryGiB = toGiB(Number.parseFloat(mKvNonKv[1]), mKvNonKv[2], true);
      record(i, "nonKvCacheMemory", line);
    }
    const mKvPeak = /\btorch_peak(?:_increase)?\s*[:=]\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mKvPeak?.[1]) {
      torchPeakIncreaseGiB = toGiB(Number.parseFloat(mKvPeak[1]), mKvPeak[2], true);
      record(i, "torchPeak", line);
    }
    const mKvNonTorch = /\bnon_torch(?:_increase|_memory)?\s*[:=]\s*([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(line);
    if (mKvNonTorch?.[1]) {
      nonTorchIncreaseGiB = toGiB(Number.parseFloat(mKvNonTorch[1]), mKvNonTorch[2], true);
      record(i, "nonTorchIncrease", line);
    }

    // 3. worker.py#L929-L949 post-warmup Actual usage summary
    const mFreeDev =
      /Free memory on device\s*\(\s*([\d.]+)\s*\/\s*([\d.]+)\s*(GiB|GB)\s*\)\s*on startup/i.exec(line);
    if (mFreeDev?.[1] && mFreeDev[2]) {
      initialFreeGiB = toGiB(Number.parseFloat(mFreeDev[1]), mFreeDev[3], true);
      totalDeviceGiB = toGiB(Number.parseFloat(mFreeDev[2]), mFreeDev[3], true);
      record(i, "startupFreeMemory", line);
    }
    const mDesired = /Desired GPU memory utilization is\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*(GiB|GB)\s*\)/i.exec(
      line,
    );
    if (mDesired?.[1] && mDesired[2]) {
      gpuMemoryUtilization = Number.parseFloat(mDesired[1]);
      requestedMemoryGiB = toGiB(Number.parseFloat(mDesired[2]), mDesired[3], true);
    }
    const mActual =
      /Actual usage:\s*([\d.]+)\s*(GiB|GB|MiB)\s*for weights,\s*([\d.]+)\s*(GiB|GB|MiB)\s*for peak activation,\s*([\d.]+)\s*(GiB|GB|MiB)\s*for non-torch memory,\s*([\d.]+)\s*(GiB|GB|MiB)\s*for NPU graph memory/i.exec(
        line,
      );
    if (mActual?.[1] && mActual[3] && mActual[5] && mActual[7]) {
      if (weightsGiB === null) weightsGiB = toGiB(Number.parseFloat(mActual[1]), mActual[2], true);
      torchPeakIncreaseGiB = toGiB(Number.parseFloat(mActual[3]), mActual[4], true);
      nonTorchIncreaseGiB = toGiB(Number.parseFloat(mActual[5]), mActual[6], true);
      aclGraphGiB = toGiB(Number.parseFloat(mActual[7]), mActual[8], true);
      record(i, "actualUsageSummary", line);
    }
    const mSuggest =
      /--kv-cache-memory=(\d+)`?\s*\(\s*([\d.]+)\s*(GiB|GB)\s*\)\s*to fit into requested/i.exec(line);
    if (mSuggest?.[1] && mSuggest[2]) {
      suggestedKvMemoryBytes = Number.parseInt(mSuggest[1], 10);
      suggestedKvMemoryGiB = toGiB(Number.parseFloat(mSuggest[2]), mSuggest[3], true);
    }
    const mCurKv = /Current KV cache memory:\s*([\d.]+)\s*(GiB|GB|MiB)/i.exec(line);
    if (mCurKv?.[1] && availableKvGiB === null) {
      availableKvGiB = toGiB(Number.parseFloat(mCurKv[1]), mCurKv[2], true);
    }
    const mAfterWarmup =
      /torch reserved memory\s+([\d.]+)\s*(GiB|GB|MiB),\s*torch allocated memory\s+([\d.]+)\s*(GiB|GB|MiB)/i.exec(
        line,
      );
    if (mAfterWarmup?.[1] && mAfterWarmup[3]) {
      torchReservedAfterWarmupGiB = toGiB(Number.parseFloat(mAfterWarmup[1]), mAfterWarmup[2], true);
      torchAllocatedAfterWarmupGiB = toGiB(Number.parseFloat(mAfterWarmup[3]), mAfterWarmup[4], true);
    }

    // 4. Available KV cache memory (worker.py#L661 / worker_310p.py#L150)
    const mAvailKv =
      /Available KV cache memory:\s*(-?[\d.]+)\s*(GiB|GB|MiB|MB)(\s*\(halved for workspace\))?/i.exec(line);
    if (mAvailKv?.[1]) {
      availableKvGiB = toGiB(Number.parseFloat(mAvailKv[1]), mAvailKv[2], true);
      if (mAvailKv[3]) kvHalvedFor310pWorkspace = true;
      record(i, "availableKv", line);
    }

    // 5. GPU / NPU KV cache size & Maximum concurrency (kv_cache_utils.py#L2396)
    const mKvTokens = /\b(GPU|NPU|XPU|CPU)\s+KV cache size:\s*([\d,]+)\s*tokens/i.exec(line);
    if (mKvTokens?.[1] && mKvTokens[2]) {
      kvCacheDeviceLabel = mKvTokens[1].toUpperCase();
      kvCacheTokens = parseIntWithCommas(mKvTokens[2]);
      record(i, "kvCacheTokens", line);
    }
    const mMaxConc = /Maximum concurrency for\s*([\d,]+)\s*tokens per request:\s*([\d.]+)x/i.exec(line);
    if (mMaxConc?.[1] && mMaxConc[2]) {
      maxConcurrencyModelLen = parseIntWithCommas(mMaxConc[1]);
      maxConcurrency = Number.parseFloat(mMaxConc[2]);
      record(i, "maxConcurrency", line);
    }

    // 6. Graph capturing (gpu_model_runner.py#L6930)
    const mGraph =
      /Graph capturing finished in\s+([\d.]+)\s*s(?:ec(?:ond)?s?)?,?\s*took\s+([\d.]+)\s*(GiB|GB|MiB|MB)/i.exec(
        line,
      );
    if (mGraph?.[1] && mGraph[2]) {
      aclGraphSeconds = Number.parseFloat(mGraph[1]);
      aclGraphGiB = toGiB(Number.parseFloat(mGraph[2]), mGraph[3], true);
      record(i, "aclGraph", line);
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
  }

  // Cross-derive complementary profiling metrics when partial logs are pasted
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

  const hasAnyMetric =
    weightsGiB !== null ||
    nonKvCacheMemoryGiB !== null ||
    availableKvGiB !== null ||
    kvCacheTokens !== null ||
    aclGraphGiB !== null ||
    maxConcurrency !== null;

  return {
    weightsGiB,
    weightLoadSeconds,
    nonKvCacheMemoryGiB,
    torchPeakIncreaseGiB,
    nonTorchIncreaseGiB,
    totalConsumedGiB,
    availableKvGiB,
    kvHalvedFor310pWorkspace,
    kvCacheTokens,
    kvCacheDeviceLabel,
    maxConcurrency,
    maxConcurrencyModelLen,
    aclGraphGiB,
    aclGraphSeconds,
    initialFreeGiB,
    totalDeviceGiB,
    gpuMemoryUtilization,
    requestedMemoryGiB,
    suggestedKvMemoryBytes,
    suggestedKvMemoryGiB,
    torchReservedAfterWarmupGiB,
    torchAllocatedAfterWarmupGiB,
    detectedErrors,
    matchedLines,
    hasAnyMetric,
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
  const nkvLow = (s3.lowBytes + s4.lowBytes + s5.lowBytes) / GIB;
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

  // 3. Available KV cache memory
  const kvLow = q2.kvPoolLowBytes / GIB;
  const kvPoint = q2.kvPoolPointBytes / GIB;
  const kvHigh = q2.kvPoolHighBytes / GIB;
  const minOneSeqGiB = ((q2.blocksPerMaxSeq + 1) * q2.kvBytesPerBlock) / GIB;
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
    const status: ReconciliationItemStatus =
      m <= 0 || m < minOneSeqGiB ? "oom-risk" : classifyRange(m, kvLow, kvHigh, GIB_TOLERANCE);
    const causes: string[] = [];
    if (parsed.kvHalvedFor310pWorkspace && !plan.card.halvesKvForWorkspace) {
      causes.push("日志含 (halved for workspace)，说明实机是 310P (worker_310p.py // 2)，请核对卡型选择。");
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

  // 4. KV cache token slots
  const tokLow = q2.totalKvTokenSlotsRange[0];
  const tokPoint = q2.totalKvTokenSlotsPoint;
  const tokHigh = q2.totalKvTokenSlotsRange[1];
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
      Math.abs(impliedKvBytesPerToken - q2.kvBytesPerTokenPerRank) / Math.max(1, q2.kvBytesPerTokenPerRank) >
        0.15
    ) {
      causes.push(
        `日志推算单 token KV 约 ${(impliedKvBytesPerToken / 1024).toFixed(1)} KiB，与当前配置理论值 ${(q2.kvBytesPerTokenPerRank / 1024).toFixed(1)} KiB 偏差超 15%：检查 TP、PP、--kv-cache-dtype 或多 DP 汇总口径。`,
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
  const overallStatus: LogReconciliationReport["overallStatus"] = hasOom
    ? "oom-risk"
    : measuredItems.length === 0
      ? "incomplete"
      : hasDrift
        ? "drift"
        : "aligned";

  const hcclAccountingNote =
    `HCCL 不二次扣减守恒（vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L461-L634）：` +
    `init_snapshot 拍在分布式通信建组之前，profile_run() 测得的 non_torch_increase 与 non_kv_cache_memory ` +
    `已完整包含具象化的 HCCL（${plan.hcclEstimate.totalMaterializedMiB} MiB）及 MC2 缓冲；对账绝不重复扣除 HCCL，` +
    `仅保留 worker.py 的 ${HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB} MiB（${((HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB * MIB) / GIB).toFixed(3)} GiB）安全裕度。`;

  const summary =
    overallStatus === "aligned"
      ? `实机日志 ${measuredItems.length}/6 项全部落在 7 级静态区间内，显存账目闭环（HCCL 未二次扣减）。`
      : overallStatus === "oom-risk"
        ? `检测到 OOM 风险或启动报错，请优先检查标红项与预算外 1−u 余量。`
        : overallStatus === "incomplete"
          ? "未从粘贴文本中提取到可对账的启动显存指标，请粘贴包含 Model loading / Available KV cache memory / Actual usage 的日志段。"
          : `已对账 ${measuredItems.length} 项，部分指标偏离静态估算区间，请参考逐项根因提示。`;

  return {
    overallStatus,
    hcclDoubleCounted: false,
    hcclAccountingNote,
    redundancyBufferMiB: HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB,
    impliedKvBytesPerToken,
    items,
    byKey,
    logErrors: parsed.detectedErrors,
    summary,
  };
}
