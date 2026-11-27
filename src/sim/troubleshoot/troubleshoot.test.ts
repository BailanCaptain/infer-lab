import { describe, expect, it } from "vitest";
import { getTroubleshootFixture, TROUBLESHOOT_FIXTURES } from "./fixtures";
import { analyzeTroubleshootInput, parsePrometheusMetrics } from "./logAnalyzer";
import {
  getTimelineScenario,
  getTimelineSnapshot,
  SCHEMATIC_TRACE_BADGE_TEXT,
  TIMELINE_SCENARIOS,
} from "./timelineSandbox";

const REPO_ANCHOR_RE = /^(?:vllm-ascend@c09d3e20|vllm@ced6857a):[A-Za-z0-9_./-]+#L\d+-L\d+$/;

const REGISTERED_DEEPLINK_PAGE_IDS = new Set([
  "request-overview",
  "ascend-model-onboarding",
  "hf-model-anatomy",
  "quantization",
  "ascend-env-and-serve",
  "continuous-batching",
  "paged-attention",
  "roofline-and-metrics",
  "ascend-flash-attention",
  "core-cli-params",
  "token",
  "gqa",
  "prefill",
  "kv-cache",
  "hardware-devices",
  "low-precision-formats",
  "npu-worker-lifecycle",
  "kv-cache-memory-profiling",
  "attention-qkv",
  "chunked-prefill",
  "ai-core",
  "collective-communication",
  "tensor-parallel",
  "pipeline-parallel",
  "data-parallel",
  "expert-parallel",
  "hccl-buffer",
  "kv-cache-spec",
  "pd-disaggregation",
  "mooncake-connector",
  "npugraph-ex",
  "acl-graph",
  "device-memory",
  "recompute-scheduler",
  "kv-cache-quantization",
  "cann-hccl",
  "moe",
  "sleep-mode",
  "tensor-layout",
  "inference-troubleshooting",
  "inference-performance-troubleshooting",
  "ascend-910b3-measured-baseline",
]);

describe("Panel A — Multi-Rank First-Fault Rank & Rule Diagnostics", () => {
  it("pinpoints Rank 3 as high-confidence first-fault rank even when Rank 0..2 EI0006 lines appear earlier in file", () => {
    const fixture = getTroubleshootFixture("multi-rank-hccl-rank3-fault");
    const report = analyzeTroubleshootInput(fixture.content);

    expect(report.inputKind).toBe("logs");
    expect(report.detectedRanks).toEqual([0, 1, 2, 3]);
    expect(report.firstFaultVerdict.rank).toBe(3);
    expect(report.firstFaultVerdict.confidence).toBe("high");
    expect(report.firstFaultVerdict.cascadeRanks).toEqual([0, 1, 2]);
    expect(report.firstFaultVerdict.primaryEvidenceLines[0]?.rank).toBe(3);
    expect(report.firstFaultVerdict.primaryEvidenceLines[0]?.kind).toBe("root-cause");

    const ruleIds = report.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain("oom-stage-split");
    expect(ruleIds).toContain("hccl-timeout-cascade");

    const hcclFinding = report.findings.find((f) => f.ruleId === "hccl-timeout-cascade");
    expect(hcclFinding?.title).toContain("Rank 3");
  });

  it("inherits traceback header timestamp on terminal exception lines so earlier multi-line Traceback beats later RuntimeError", () => {
    const interleaved = [
      "2026-04-12 10:12:00.100 ERROR [Rank 1] RuntimeError: NPU out of memory during forward",
      "2026-04-12 10:11:05.050 ERROR [Rank 3] Traceback (most recent call last):",
      '  File "vllm_ascend/worker/worker.py", line 465, in init_device',
      "    raise ValueError(",
      "ValueError: Free memory on device (41.20/64.00 GiB) on startup is less than desired GPU memory utilization (0.9, 57.60 GiB).",
    ].join("\n");

    const report = analyzeTroubleshootInput(interleaved);
    expect(report.firstFaultVerdict.rank).toBe(3);
    expect(report.firstFaultVerdict.confidence).toBe("high");
    expect(report.firstFaultVerdict.primaryEvidenceLines[0]?.rank).toBe(3);
    expect(report.firstFaultVerdict.primaryEvidenceLines[0]?.timestamp).toBe("2026-04-12 10:11:05.050");
  });

  it("refuses to falsely blame Rank 0 when only cascading EI0006 timeouts exist", () => {
    const fixture = getTroubleshootFixture("pure-hccl-timeout-no-primary");
    const report = analyzeTroubleshootInput(fixture.content);

    expect(report.firstFaultVerdict.rank).toBeNull();
    expect(report.firstFaultVerdict.confidence).toBe("low");
    expect(report.firstFaultVerdict.cascadeRanks).toEqual([0, 1, 2]);
    expect(report.firstFaultVerdict.rationale).toContain("切勿将 Rank 0");
    expect(report.findings.some((f) => f.ruleId === "hccl-timeout-cascade")).toBe(true);
  });

  it("distinguishes pre-profiling init_snapshot ValueError, post-KV ACLGraph OOM, and cold-start OOM", () => {
    const preProfile = analyzeTroubleshootInput(getTroubleshootFixture("pre-profile-free-memory").content);
    expect(preProfile.findings.map((f) => f.ruleId)).toContain("pre-profile-free-memory");
    expect(preProfile.firstFaultVerdict.rank).toBe(0);

    const postKv = analyzeTroubleshootInput(getTroubleshootFixture("post-kv-aclgraph-oom").content);
    const postKvFinding = postKv.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(postKvFinding?.title).toContain("图捕获");
    expect(postKvFinding?.summary).toContain("1 - u");

    const coldStart = analyzeTroubleshootInput(getTroubleshootFixture("cold-start-weight-oom").content);
    const coldFinding = coldStart.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(coldFinding?.title).toContain("冷启动");
    expect(coldStart.firstFaultVerdict.rank).toBe(1);
  });

  it("diagnoses exit code 137 SIGKILL as host/cgroup OOM or external kill, NOT proof of NPU HBM OOM", () => {
    const report = analyzeTroubleshootInput(getTroubleshootFixture("exit-137-host-sigkill").content);
    const finding = report.findings.find((f) => f.ruleId === "exit-137-sigkill");
    expect(finding).toBeDefined();
    expect(finding?.title).toContain("137");
    expect(finding?.title).toContain("不能证明 NPU HBM OOM");
    expect(finding?.nextEvidenceCmd).toContain("dmesg");
  });

  it("diagnoses SoC/310P/GQA+C8 compatibility errors, FA3/ACLGraph failures, and Mooncake KV transfer errors", () => {
    const gqaC8 = analyzeTroubleshootInput(getTroubleshootFixture("soc-310p-gqa-c8-compat").content);
    expect(gqaC8.findings.map((f) => f.ruleId)).toContain("soc-310p-or-c8-compat");

    const soc310p = analyzeTroubleshootInput(
      "2026-04-12 10:00:00 ERROR [Rank 0] ValueError: Ascend310P does not support bfloat16; Check ascend device type failed",
    );
    expect(soc310p.findings.map((f) => f.ruleId)).toContain("soc-310p-or-c8-compat");

    const fa3 = analyzeTroubleshootInput(getTroubleshootFixture("fa3-aclgraph-capture-fail").content);
    expect(fa3.findings.map((f) => f.ruleId)).toContain("graph-capture-failure");

    const mooncake = analyzeTroubleshootInput(
      "2026-04-12 10:01:02 ERROR [Rank 0] ValueError: MooncakeConnector does not support C8 KV cache quantization on GQA models.",
    );
    expect(mooncake.findings.map((f) => f.ruleId)).toContain("mooncake-pd-transfer-error");
  });

  it("extracts ranks from real v0.30.0 Worker_TP0_EP0 / Worker_DP1_TP2_EP6 / NPU 0 formats and diagnoses Sleep FRACTAL_NZ + Mooncake PD role/TP errors", () => {
    const epRankLog = [
      "(Worker_TP2_EP2 pid=53744) INFO 11-23 02:45:25 [worker.py:950] Available KV cache memory: 38.73 GiB",
      "(Worker_DP1_TP2_EP6 pid=58359) ERROR 11-23 02:50:40 [model_runner_v1.py:6612] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 1.98 GiB (NPU 6; 60.96 GiB total capacity)",
    ].join("\n");
    const epReport = analyzeTroubleshootInput(epRankLog);
    expect(epReport.detectedRanks).toEqual([2, 6]);
    expect(epReport.firstFaultVerdict.rank).toBe(6);

    const npuZeroOom = analyzeTroubleshootInput(
      getTroubleshootFixture("real-910b3-u090-aclgraph-oom").content,
    );
    expect(npuZeroOom.firstFaultVerdict.rank).toBe(0);
    expect(npuZeroOom.findings.map((f) => f.ruleId)).toContain("oom-stage-split");
    const oomFixture = getTroubleshootFixture("real-910b3-u090-aclgraph-oom");
    expect(oomFixture.content).toContain("20:58:45");
    expect(oomFixture.content).toContain("Available KV cache memory: 53.47 GiB");
    expect(oomFixture.content).toContain("500,480 tokens");
    expect(oomFixture.content).toContain("4,096 tokens per request: 122.19x");
    expect(oomFixture.content).toContain("device_op.py");
    const oomFinding = npuZeroOom.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(oomFinding?.title).toContain("图捕获");
    expect(oomFinding?.experimentStep).toContain("0.95 → 0.88 下调 0.07");
    expect(oomFinding?.experimentStep).toContain("0.90 → 0.82 下调 0.08");

    const sleepNz = analyzeTroubleshootInput(getTroubleshootFixture("real-910b3-sleep-nz-wakeup").content);
    expect(sleepNz.findings.map((f) => f.ruleId)).toContain("sleep-mode-fractal-nz-wakeup");
    const sleepFinding = sleepNz.findings.find((f) => f.ruleId === "sleep-mode-fractal-nz-wakeup");
    expect(sleepFinding?.wikiPageIds[0]).toBe("sleep-mode");
    expect(sleepFinding?.wikiPageIds).toContain("tensor-layout");
    expect(sleepFinding?.mechanism).toContain("utils.py#L373-L386");
    expect(sleepFinding?.mechanism).toContain("并不转 NZ");
    expect(sleepFinding?.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L279-L286");
    expect(sleepFinding?.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/utils.py#L373-L386");

    // Client-side Exception wrapper from measure_sleep_mode.py also matches sleep-mode-fractal-nz-wakeup
    const clientWakeErr = analyzeTroubleshootInput(
      "Exception: Call to wake_up method failed: FRACTAL_NZ mode is enabled. This may cause model parameter precision issues in the RL scenarios.",
    );
    expect(clientWakeErr.findings.map((f) => f.ruleId)).toContain("sleep-mode-fractal-nz-wakeup");

    const pdFixture = getTroubleshootFixture("real-910b3-pd-mooncake-config");
    expect(pdFixture.summary).toContain("双故障组合诊断样例");
    const pdRole = analyzeTroubleshootInput(pdFixture.content);
    expect(pdRole.findings.map((f) => f.ruleId)).toContain("mooncake-pd-transfer-error");
    const pdFinding = pdRole.findings.find((f) => f.ruleId === "mooncake-pd-transfer-error");
    expect(pdFinding?.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L879-L884");
    expect(pdFinding?.sources).not.toContain(
      "vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1212-L1213",
    );
  });

  it("zero false positives on healthy MooncakeConnectorV1 + HCCL 1836s startup logs and isolates err3 U+2011 GQA C8 error cleanly", () => {
    const healthyPdStartup = [
      "(APIServer pid=68557) INFO 11-23 03:01:42 [entrypoints/.../utils/api_utils.py:286] non-default args: {'model': '/mnt/workspace/models/Qwen3-0.6B', 'kv_transfer_config': KVTransferConfig(kv_connector='MooncakeConnectorV1', kv_role='kv_consumer', kv_ip='127.0.0.1', kv_port=30100, kv_load_failure_policy='fail')}",
      "(APIServer pid=68557) INFO 11-23 03:01:42 [platform.py:945] The timeout interval of the HCCL operator is 1836s. Timeout in seconds for execute_model RPC calls in multiprocessing must be greater than 1836s, Set VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS=3000",
      "(EngineCore pid=69127) INFO 11-23 03:02:23 [distributed/.../kv_connector/factory.py:62] Creating v1 connector with name: MooncakeConnector and engine_id: 3f756184",
      "(EngineCore pid=69127) INFO 11-23 03:02:23 [mooncake_connector.py:2103] MooncakeConnector set_xfer_handshake_metadata: worker_count=1",
      "(EngineCore pid=69127) DEBUG 11-23 03:02:36 [mooncake_connector.py:1931] MooncakeConnector get_num_new_matched_tokens: num_computed_tokens=0",
      "(APIServer pid=68557) INFO:     Application startup complete.",
    ].join("\n");

    const healthyReport = analyzeTroubleshootInput(healthyPdStartup);
    expect(healthyReport.findings).toEqual([]);
    expect(healthyReport.firstFaultVerdict.rank).toBeNull();
    expect(healthyReport.firstFaultVerdict.primaryEvidenceLines).toEqual([]);
    expect(healthyReport.unmatchedErrorLines).toEqual([]);

    // Real Mooncake runtime failure still triggers mooncake-pd-transfer-error
    const realMooncakeFail = analyzeTroubleshootInput(
      "(Worker_TP0 pid=70123) ERROR 11-23 03:15:02 [mooncake_connector.py:840] RuntimeError: MooncakeConnectorV1 handshake timeout connecting to peer",
    );
    expect(realMooncakeFail.findings.map((f) => f.ruleId)).toEqual(["mooncake-pd-transfer-error"]);

    // err3 fixture preserves U+2011 non-breaking hyphen and triggers ONLY soc-310p-or-c8-compat (no Mooncake/HCCL false positives)
    const err3Fixture = getTroubleshootFixture("real-910b3-gqa-static-c8-kv");
    expect(err3Fixture.content).toContain("GQA\u2011related");
    expect(err3Fixture.content).toContain("--kv\u2011cache\u2011dtype");
    const err3Report = analyzeTroubleshootInput(err3Fixture.content);
    expect(err3Report.findings.map((f) => f.ruleId)).toEqual(["soc-310p-or-c8-compat"]);
    expect(err3Report.findings[0]?.sources).toContain(
      "vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L571-L586",
    );

    // ASCII hyphen variant and stripped-backtick variant also trigger soc-310p-or-c8-compat pointing to kv-cache-quantization / quantization
    expect(err3Report.findings[0]?.wikiPageIds.slice(0, 2)).toEqual([
      "kv-cache-quantization",
      "quantization",
    ]);
    const asciiErr3 = analyzeTroubleshootInput(err3Fixture.content.replaceAll("\u2011", "-"));
    expect(asciiErr3.findings.map((f) => f.ruleId)).toEqual(["soc-310p-or-c8-compat"]);
    const strippedBacktickErr3 = analyzeTroubleshootInput(
      "ValueError: KV quantization is configured via --kv-cache-dtype upon service startup, and the corresponding quantized weights are required.",
    );
    expect(strippedBacktickErr3.findings.map((f) => f.ruleId)).toEqual(["soc-310p-or-c8-compat"]);
  });

  it("diagnoses 910B3 Mooncake ADXL endpoint fallback warnings and VLLM_LOGGING_LEVEL=DEBUG hot-path TTFT tax without hijacking first-fault rank", () => {
    const adxlFixture = getTroubleshootFixture("real-910b3-mooncake-adxl-fallback");
    const adxlReport = analyzeTroubleshootInput(adxlFixture.content);
    expect(adxlReport.findings.map((f) => f.ruleId)).toEqual(["mooncake-adxl-endpoint-fallback"]);
    expect(adxlReport.firstFaultVerdict.rank).toBeNull();
    const adxlFinding = adxlReport.findings[0]!;
    expect(adxlFinding.severity).toBe("warn");
    expect(adxlFinding.wikiPageIds).toContain("mooncake-connector");
    expect(adxlFinding.wikiPageIds).toContain("pd-disaggregation");
    expect(adxlFinding.summary).toContain("命中 4 行");
    expect(adxlFinding.sources).toContain(
      "vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1040-L1058",
    );

    const debugFixture = getTroubleshootFixture("real-910b3-debug-logging-ttft");
    const debugReport = analyzeTroubleshootInput(debugFixture.content);
    expect(debugReport.findings.map((f) => f.ruleId)).toEqual(["debug-logging-hotpath-overhead"]);
    expect(debugReport.firstFaultVerdict.rank).toBeNull();
    const debugFinding = debugReport.findings[0]!;
    expect(debugFinding.severity).toBe("warn");
    expect(debugFinding.wikiPageIds[0]).toBe("inference-performance-troubleshooting");
    expect(debugFinding.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L762-L778");
    expect(debugFinding.sources).toContain(
      "vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L275-L282",
    );

    // Healthy INFO warmup summary (without DEBUG colons) and benchmark note "without VLLM_LOGGING_LEVEL=DEBUG" must NOT false-positive
    const healthyWarmupSummary = [
      "(Worker_TP0 pid=35438) INFO 11-23 02:25:38 [worker.py:950] After warmup: torch reserved memory 54.21 GiB, torch allocated memory 51.22 GiB.",
      '{"note": "Clean production latency without VLLM_LOGGING_LEVEL=DEBUG per-step overhead"}',
    ].join("\n");
    expect(analyzeTroubleshootInput(healthyWarmupSummary).findings).toEqual([]);

    // When mixed with a real crash on Rank 3, Rank 0 DEBUG hot-path or ADXL warning never steals First-Fault Rank
    const mixedWarnAndCrash = [
      "(Worker_TP0 pid=35438) DEBUG 11-23 02:25:45 [worker.py:768] torch reserved memory: 54.21 GiB, torch allocated memory: 51.22 GiB",
      "W1123 02:25:46.100000 7379 transfer_executor_base.cpp:64] Dest buffer device_id=1 >= endpoint count 1, falling back to 192.168.88.208:20165",
      "(Worker_TP3 pid=35441) ERROR 11-23 02:25:47 [worker.py:510] RuntimeError: NPU out of memory. Tried to allocate 1.80 GiB on NPU 3",
    ].join("\n");
    const mixedReport = analyzeTroubleshootInput(mixedWarnAndCrash);
    expect(mixedReport.firstFaultVerdict.rank).toBe(3);
    expect(mixedReport.findings.map((f) => f.ruleId)).toEqual(
      expect.arrayContaining([
        "oom-stage-split",
        "mooncake-adxl-endpoint-fallback",
        "debug-logging-hotpath-overhead",
      ]),
    );
  });

  it("P2-5 & P2-6(b): scopes OOM stage to same-process stack, ignores healthy weight_nz_mode=0, prioritizes explicit HCCL fault codes over config exclusion, and restores line numbers across omission markers", () => {
    // 1) ACLGraph config chatter + in load_model OOM MUST be cold-start, NOT post-KV graph capture OOM
    const loadModelWithAclGraphInfo = [
      "(Worker_TP0 pid=41001) INFO 11-23 04:00:01 [ascend_config.py:120] Using ACLGraph configuration: FULL_AND_PIECEWISE",
      "(Worker_TP0 pid=41001) ERROR 11-23 04:00:15 [core.py:1366] Traceback (most recent call last):",
      '(Worker_TP0 pid=41001) ERROR 11-23 04:00:15 [core.py:1366]   File "/mnt/workspace/vllm_ascend/worker/worker.py", line 510, in load_model',
      "(Worker_TP0 pid=41001) ERROR 11-23 04:00:15 [core.py:1366]     self.model_runner.load_model()",
      "(Worker_TP0 pid=41001) ERROR 11-23 04:00:15 [core.py:1366] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 2.40 GiB (NPU 0; 60.96 GiB total capacity)",
    ].join("\n");
    const loadModelReport = analyzeTroubleshootInput(loadModelWithAclGraphInfo);
    const loadModelFinding = loadModelReport.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(loadModelFinding?.title).toContain("冷启动");
    expect(loadModelFinding?.title).not.toContain("图捕获");

    // Cross-process isolation: Rank 0 already logged Available KV cache memory, while Rank 1 OOMs before KV allocation
    const crossRankOom = [
      "(Worker_TP0 pid=42001) INFO 11-23 04:01:00 [worker.py:660] Available KV cache memory: 38.73 GiB",
      "(Worker_TP1 pid=42002) ERROR 11-23 04:01:02 [worker.py:510] RuntimeError: NPU out of memory. Tried to allocate 1.80 GiB on NPU 1",
    ].join("\n");
    const crossRankReport = analyzeTroubleshootInput(crossRankOom);
    expect(crossRankReport.firstFaultVerdict.rank).toBe(1);
    expect(crossRankReport.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain("冷启动");

    // 2) Healthy INFO weight_nz_mode=0 MUST NOT be flagged as primary signal or finding
    const healthyWeightNz = [
      "(EngineCore pid=43001) INFO 11-23 04:02:00 [ascend_config.py:180] weight_nz_mode=0",
      "(APIServer pid=43000) INFO:     Application startup complete.",
    ].join("\n");
    const healthyWeightNzReport = analyzeTroubleshootInput(healthyWeightNz);
    expect(healthyWeightNzReport.findings).toEqual([]);
    expect(healthyWeightNzReport.firstFaultVerdict.primaryEvidenceLines).toEqual([]);
    expect(healthyWeightNzReport.unmatchedErrorLines).toEqual([]);

    // 3) Explicit HCCL fault codes (EI0006) & ERROR-level HCCL timeout MUST override HCCL_EXEC_TIMEOUT= config exclusion
    const ei0006WithConfig = analyzeTroubleshootInput(
      "2026-11-23 04:03:00 ERROR [Rank 2] EI0006 HCCL timeout, HCCL_EXEC_TIMEOUT=1836",
    );
    expect(ei0006WithConfig.findings.map((f) => f.ruleId)).toContain("hccl-timeout-cascade");
    expect(ei0006WithConfig.firstFaultVerdict.cascadeRanks).toEqual([2]);

    const errHcclWithConfig = analyzeTroubleshootInput(
      "2026-11-23 04:03:01 ERROR [Rank 1] HCCL timeout, HCCL_EXEC_TIMEOUT=1836",
    );
    expect(errHcclWithConfig.findings.map((f) => f.ruleId)).toContain("hccl-timeout-cascade");

    const infoHcclEnv = analyzeTroubleshootInput("2026-11-23 04:03:02 INFO [Rank 0] HCCL_EXEC_TIMEOUT=1836");
    expect(infoHcclEnv.findings).toEqual([]);
    expect(infoHcclEnv.firstFaultVerdict.primaryEvidenceLines).toEqual([]);

    // 4) Original line number restoration across workbench omission markers
    const excerptWithOmission = [
      "(EngineCore pid=50001) INFO 11-23 04:05:00 [worker.py:660] Available KV cache memory: 53.47 GiB",
      "... [日志节选：已省略第 2–249 行常规输出；下行起原行号 L250] ...",
      '(EngineCore pid=50001) ERROR 11-23 04:05:40 [core.py:1366]   File "/mnt/workspace/vllm_ascend/worker/model_runner_v1.py", line 6613, in capture_model',
      "(EngineCore pid=50001) ERROR 11-23 04:05:40 [core.py:1366]     cuda_graph_size = GPUModelRunner.capture_model(self)",
      "(EngineCore pid=50001) ERROR 11-23 04:05:40 [core.py:1366] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 1.98 GiB (NPU 0; 60.96 GiB total capacity)",
    ].join("\n");
    const restoredReport = analyzeTroubleshootInput(excerptWithOmission);
    expect(restoredReport.firstFaultVerdict.rank).toBe(0);
    expect(restoredReport.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(252);
    expect(restoredReport.firstFaultVerdict.rationale).toContain("第 252 行");
    const restoredOom = restoredReport.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(restoredOom?.title).toContain("图捕获");
    expect(restoredOom?.matchedLines[0]?.lineNumber).toBe(252);
  });

  it("parses /metrics snapshots and distinguishes KV preemption storm vs low-KV Decode & Prefill bottlenecks", () => {
    const kvStorm = analyzeTroubleshootInput(getTroubleshootFixture("metrics-kv-preemption").content);
    expect(kvStorm.inputKind).toBe("metrics");
    expect(kvStorm.metrics.kvCacheUsageRatio).toBeCloseTo(0.982, 3);
    expect(kvStorm.metrics.numPreemptionsTotal).toBe(47);
    expect(kvStorm.metrics.numRequestsWaiting).toBe(19);
    const stormFinding = kvStorm.findings.find((f) => f.ruleId === "metrics-kv-preemption-storm");
    expect(stormFinding?.severity).toBe("error");

    const decodeSlow = analyzeTroubleshootInput(getTroubleshootFixture("metrics-low-kv-decode-slow").content);
    expect(decodeSlow.metrics.kvCacheUsageRatio).toBeCloseTo(0.24, 3);
    expect(decodeSlow.metrics.itlAvgSec).toBeCloseTo(0.142, 3);
    const decodeFinding = decodeSlow.findings.find((f) => f.ruleId === "metrics-low-kv-high-latency");
    expect(decodeFinding?.title).toContain("Decode");

    const prefillSlow = analyzeTroubleshootInput(
      [
        'vllm:kv_cache_usage_perc{engine="0"} 0.18',
        'vllm:num_requests_waiting{engine="0"} 0',
        'vllm:time_to_first_token_seconds_sum{engine="0"} 26.0',
        'vllm:time_to_first_token_seconds_count{engine="0"} 10',
        'vllm:inter_token_latency_seconds_sum{engine="0"} 2.5',
        'vllm:inter_token_latency_seconds_count{engine="0"} 100',
      ].join("\n"),
    );
    const prefillFinding = prefillSlow.findings.find((f) => f.ruleId === "metrics-low-kv-high-latency");
    expect(prefillFinding?.title).toContain("Prefill");
  });

  it("handles percentage-scaled kv_cache_usage_perc and empty input gracefully", () => {
    const parsed = parsePrometheusMetrics('vllm:kv_cache_usage_perc{engine="0"} 96.5\n');
    expect(parsed.kvCacheUsageRatio).toBeCloseTo(0.965, 3);

    const empty = analyzeTroubleshootInput("   \n ");
    expect(empty.inputKind).toBe("empty");
    expect(empty.findings).toEqual([]);
  });

  it("matches expected rules across all fixtures with valid repo anchors and registered wikiPageIds", () => {
    for (const fixture of TROUBLESHOOT_FIXTURES) {
      const report = analyzeTroubleshootInput(fixture.content);
      const ids = report.findings.map((f) => f.ruleId);
      for (const expected of fixture.expectedRuleIds) {
        expect(ids, `fixture ${fixture.id} missing ${expected}`).toContain(expected);
      }
      for (const finding of report.findings) {
        expect(finding.sources.length).toBeGreaterThan(0);
        for (const src of finding.sources) {
          expect(src).toMatch(REPO_ANCHOR_RE);
        }
        expect(finding.nextEvidenceCmd.trim().length).toBeGreaterThan(0);
        expect(finding.experimentStep.trim().length).toBeGreaterThan(0);
        expect(finding.wikiPageIds.length).toBeGreaterThan(0);
        for (const pageId of finding.wikiPageIds) {
          expect(REGISTERED_DEEPLINK_PAGE_IDS.has(pageId), `unregistered pageId: ${pageId}`).toBe(true);
        }
      }
    }
  });
});

describe("Panel B — Perfetto-lite Schematic Relative-Timeline Sandbox", () => {
  it("exposes all 6 required fault scenarios with permanent schematic badge text and counterfactual pairs", () => {
    expect(SCHEMATIC_TRACE_BADGE_TEXT).toBe("示意相对时序 · 非真机实测 Trace");
    expect(TIMELINE_SCENARIOS.map((s) => s.id)).toEqual([
      "proxy-buffering",
      "host-dispatch-bubble",
      "rank-straggler-hccl",
      "unbounded-prefill-head-of-line",
      "kv-preemption-storm",
      "moe-ep-straggler-dummy",
    ]);

    for (const scenario of TIMELINE_SCENARIOS) {
      const fault = getTimelineSnapshot(scenario.id, false);
      const fixed = getTimelineSnapshot(scenario.id, true);
      expect(fault.lanes.length).toBeGreaterThanOrEqual(2);
      expect(fixed.lanes.length).toBe(fault.lanes.length);
      expect(fault.bottleneckCallout).not.toBe(fixed.bottleneckCallout);
      expect(scenario.discriminatingEvidence.length).toBeGreaterThanOrEqual(3);

      for (const snap of [fault, fixed]) {
        for (const lane of snap.lanes) {
          for (const span of lane.spans) {
            expect(span.start).toBeGreaterThanOrEqual(0);
            expect(span.end).toBeLessThanOrEqual(100);
            expect(span.end).toBeGreaterThan(span.start);
            // Zero fabricated hardware ms/cycle claims in schematic labels
            expect(span.label).not.toMatch(/\d+\s*(?:ms|us|μs|ns|cycles?)\b/i);
          }
        }
      }

      for (const pageId of scenario.wikiPageIds) {
        expect(REGISTERED_DEEPLINK_PAGE_IDS.has(pageId), `unregistered pageId: ${pageId}`).toBe(true);
      }
    }

    expect(getTimelineScenario("unknown-id").id).toBe("proxy-buffering");
  });

  it("P2-5 regression: omission-gap original line distance and unlabelled KV milestones never falsely classify OOM as post-KV capture", () => {
    // (a) L1 has `in capture_model`, followed by omission marker jumping to L1000 OOM -> lineDist = 999 > 20 -> NOT post-KV capture
    const gappedExcerpt = [
      '(EngineCore_DP0 pid=101) ERROR 11-22 20:00:00 [core.py:1366]   File "worker.py", line 1, in capture_model',
      "... [日志节选：已省略第 2–999 行常规输出；下行起原行号 L1000] ...",
      "(EngineCore_DP0 pid=101) ERROR 11-22 20:05:00 [core.py:1366] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 2.00 GiB",
    ].join("\n");
    const gappedDiag = analyzeTroubleshootInput(gappedExcerpt);
    const gappedOom = gappedDiag.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(gappedOom).toBeDefined();
    expect(gappedOom!.title).not.toContain("图捕获");
    expect(gappedOom!.matchedLines[0]?.lineNumber).toBe(1000);

    // (b) Unlabelled `Available KV cache memory` followed by a DIFFERENT scoped worker failing in load_model / OOM -> NOT post-KV
    const mixedScopeLog = [
      "INFO 11-22 20:00:00 [worker.py:661] Available KV cache memory: 36.28 GiB",
      "(Worker_TP0 pid=999) ERROR 11-22 20:01:00 [loader.py:42] in load_model",
      "(Worker_TP0 pid=999) ERROR 11-22 20:01:01 [loader.py:43] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 4.00 GiB",
    ].join("\n");
    const mixedDiag = analyzeTroubleshootInput(mixedScopeLog);
    const mixedOom = mixedDiag.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(mixedOom).toBeDefined();
    expect(mixedOom!.title).not.toContain("图捕获");
  });

  it("P1 causal order: earlier or untimestamped EI0006 timeout is never attributed as a confirmed secondary cascade", () => {
    const reversedLog = [
      "2026-04-12 10:00:00.000 ERROR [Worker_TP1] [Rank 1] EI0006 Notify wait execute timeout during AllReduce",
      "2026-04-12 10:10:00.000 ERROR [Worker_TP3] [Rank 3] RuntimeError: NPU out of memory. Tried to allocate 2.00 GiB",
    ].join("\n");
    const report = analyzeTroubleshootInput(reversedLog);
    expect(report.firstFaultVerdict.rank).toBe(3);
    expect(report.firstFaultVerdict.confidence).toBe("medium");
    expect(report.firstFaultVerdict.cascadeCausalState).toBe("earlier-than-primary");
    expect(report.firstFaultVerdict.cascadeRanks).toEqual([]);
    const r3Earlier = report.findings.find((f) => f.ruleId === "hccl-timeout-cascade");
    expect(r3Earlier?.evidenceLevel).toBe("I");
    expect(r3Earlier?.title).toContain("早于 Rank 3");

    const untimestampedLog = [
      "ERROR [Rank 3] RuntimeError: NPU out of memory. Tried to allocate 2.00 GiB",
      "ERROR [Rank 1] EI0006 Notify wait execute timeout during AllReduce",
    ].join("\n");
    const untsReport = analyzeTroubleshootInput(untimestampedLog);
    expect(untsReport.firstFaultVerdict.rank).toBe(3);
    expect(untsReport.firstFaultVerdict.confidence).toBe("medium");
    expect(untsReport.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");
    expect(untsReport.firstFaultVerdict.cascadeRanks).toEqual([]);
    const r3Unts = untsReport.findings.find((f) => f.ruleId === "hccl-timeout-cascade");
    expect(r3Unts?.evidenceLevel).toBe("I");
    expect(r3Unts?.title).toContain("待核实");
  });

  it("P1 rank provenance: multi-host bare device=N and PID collisions across hosts never fabricate slot certainty", () => {
    const hostDeviceLog = "[host b] 2026-04-12 10:05:00 ERROR device=3 RuntimeError: NPU out of memory";
    const report = analyzeTroubleshootInput(hostDeviceLog);
    expect(report.firstFaultVerdict.rank).toBe(3);
    expect(report.firstFaultVerdict.confidence).toBe("medium");
    expect(report.firstFaultVerdict.slotMappable).toBe(false);
    expect(report.firstFaultVerdict.rankSource).toBe("device-id");

    // Multi-host duplicate PID 123: unprefixed plog RUNTIME(123,) must NOT inherit Rank 0 when Host A & Host B both used pid=123
    const pidCollisionLog = [
      "[host a] (Worker_TP0 pid=123) INFO 09-10 08:50:00 Worker started",
      "[host b] (Worker_TP2 pid=123) INFO 09-10 08:50:01 Worker started",
      "[ERROR] RUNTIME(123,):2026-09-10-08:52:41.377.821 [stream.cc:1743] GetError:retCode=0x26, [aicore exception].",
    ].join("\n");
    const collisionReport = analyzeTroubleshootInput(pidCollisionLog);
    expect(collisionReport.firstFaultVerdict.rank).toBeNull();
  });

  it("diagnoses CANN C++ plog cleanly without false positives on retCode=0x0 / isSmmuFault=0 or code conflation", () => {
    // Healthy INFO/plog lines with retCode=0x0 and isSmmuFault is 0 MUST NOT trigger any finding
    const benignPlog = [
      "[INFO] RUNTIME(289610,):2026-09-10-08:52:01.000 [device_error_core_proc.cc:775] CheckSmmuFault:Get isSmmuFault is 0.",
      "[INFO] RUNTIME(289610,):2026-09-10-08:52:01.002 [stream.cc:910] StreamSynchronize: stream_id=47, retCode=0x0.",
    ].join("\n");
    const benignReport = analyzeTroubleshootInput(benignPlog);
    expect(benignReport.findings).toEqual([]);
    expect(benignReport.firstFaultVerdict.primaryEvidenceLines).toEqual([]);

    const smmuPlog = [
      "(Worker_DP1_TP1_DCP1_EP9 pid=289610) ERROR 09-10 08:52:41 [multiproc_executor.py:987] RuntimeError: c10_npu::acl::AclrtSynchronizeStreamWithTimeout(stream()), error code is 507015",
      "[ERROR] RUNTIME(289610,):2026-09-10-08:52:37.461.278 [device_error_core_proc.cc:775]289907 CheckSmmuFault:Get isSmmuFault is 1.",
      "[ERROR] RUNTIME(289610,):2026-09-10-08:52:41.377.821 [stream.cc:1743]289907 GetError:Stream Synchronize failed, stream_id=47, retCode=0x26, [aicore exception].",
      "[ERROR] RUNTIME(289610,):2026-09-10-08:52:41.377.875 [stream.cc:1746]289907 GetError:[DFX_INFO]AI Core kernel execution failed, device_id=9, stream_id=47, fault kernel_name=MlaPrologV3_18fe44a5",
    ].join("\n");
    const smmuReport = analyzeTroubleshootInput(smmuPlog);
    expect(smmuReport.firstFaultVerdict.rank).toBe(9);
    expect(smmuReport.findings.map((f) => f.ruleId)).toContain("cann-plog-aicore-fault");

    // 207003 overflow vs 507035 Vector/launch exception vs aclnn runtime code non-conflation
    const overflowReport = analyzeTroubleshootInput(
      "(Worker_TP0 pid=1001) ERROR 09-10 09:00:00 RuntimeError: ACL_ERROR_RT_AICORE_OVER_FLOW, error code is 207003",
    );
    expect(overflowReport.findings.find((f) => f.ruleId === "cann-plog-aicore-fault")?.title).toContain(
      "算术溢出",
    );

    const aclnnWith507035 = analyzeTroubleshootInput(
      "(Worker_TP0 pid=1002) ERROR 09-10 09:01:00 RuntimeError: aclnnQuantMatmulV4 failed, error code is 507035",
    );
    expect(aclnnWith507035.findings.map((f) => f.ruleId)).toEqual(["cann-plog-aicore-fault"]);
    expect(aclnnWith507035.findings[0]?.title).toContain("507035");

    const bareAclnnFail = analyzeTroubleshootInput(
      "(Worker_TP0 pid=1003) ERROR 09-10 09:02:00 RuntimeError: call aclnnAddRmsNorm failed.",
    );
    const bareAclnnFinding = bareAclnnFail.findings.find((f) => f.ruleId === "cann-opapi-or-aclnn-fault");
    expect(bareAclnnFinding?.evidenceLevel).toBe("I");
    expect(bareAclnnFinding?.title).not.toContain("161002");

    // Pre-compression before 16-event cap preserves late-line root-cause event
    const burstLines: string[] = [];
    for (let i = 0; i < 18; i++) {
      burstLines.push(
        `2026-04-12 10:12:${String(10 + i).padStart(2, "0")}.000 ERROR [Rank 1] EI0006 Notify wait execute timeout`,
      );
    }
    burstLines.push(
      "2026-04-12 10:11:05.000 ERROR [Rank 3] RuntimeError: NPU out of memory. Tried to allocate 2.00 GiB",
    );
    const burstReport = analyzeTroubleshootInput(burstLines.join("\n"));
    expect(burstReport.firstFaultVerdict.rank).toBe(3);
    expect(burstReport.firstFaultVerdict.timelineEvents?.some((e) => e.kind === "root-cause")).toBe(true);

    const opapiReport = analyzeTroubleshootInput(
      "(Worker_TP0 pid=32786) ERROR 09-11 10:34:04 RuntimeError: aclnnHcPre or aclnnHcPreGetWorkspaceSize not in libopapi.so, or libopapi.so not found.",
    );
    expect(opapiReport.findings.map((f) => f.ruleId)).toContain("cann-opapi-or-aclnn-fault");

    const zmqReport = analyzeTroubleshootInput(
      "(Worker_TP0 pid=14470) ERROR [multiproc_executor.py:888] zmq.error.ZMQError: Address already in use (addr='tcp://10.246.224.8:60001')",
    );
    expect(zmqReport.findings.map((f) => f.ruleId)).toContain("zmq-port-conflict");
  });
});
