import { describe, expect, it } from "vitest";
import { getWarGameScenario } from "../wargame/scenarios";
import { getTroubleshootFixture, TROUBLESHOOT_FIXTURES } from "./fixtures";
import {
  analyzeTroubleshootInput,
  extractRankMatch,
  extractTimestamp,
  extractVisibleDevicesFromLog,
  isRuleEvidenceLine,
  parsePrometheusMetrics,
  withAnalyzerScaleProbeForTest,
} from "./logAnalyzer";
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
  "moe-comm-dispatch",
  "quantization-methods",
  "sleep-mode",
  "tensor-layout",
  "inference-troubleshooting",
  "inference-performance-troubleshooting",
  "ascend-910b3-measured-baseline",
]);

describe("Panel A — Multi-Rank First-Fault Rank & Rule Diagnostics", () => {
  it("pinpoints Rank 3 as high-confidence first-fault rank even when Rank 0..2 EI0002 lines appear earlier in file", () => {
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

  it("refuses to falsely blame Rank 0 when only cascading EI0002 timeouts exist", () => {
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
    expect(fa3.findings[0]?.ruleId).toBe("graph-capture-failure");
    expect(fa3.findings[0]?.severity).toBe("error");
    expect(fa3.firstFaultVerdict.primaryEvidenceLines[0]?.rawLine).toContain("AscendFAImpl");

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
      expect(ids, `fixture ${fixture.id} ruleIds should match exactly`).toEqual([...fixture.expectedRuleIds]);
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

  it("diagnoses Rules 17-20 with zero duplicate shadowing, separates EI0006 link-establish vs execution wait, and fixes ValueError EI0006 cascade classification", () => {
    expect(TROUBLESHOOT_FIXTURES.length).toBeGreaterThanOrEqual(22);

    // 1) Rule 17: ValueError: EI0006 Notify wait execute timeout must be cascade (NOT root-cause!), while RaSocket/HCCL_SOCKET_IFNAME/EI0004/EI0009/EJ0001/RoCE hit Rule 17
    const valueErrCascade = analyzeTroubleshootInput(
      [
        "2026-11-24 10:00:02.000 ERROR [Rank 3] [ra_socket.cc:412] RaSocketConnect failed: No route to host <REDACTED_IP>:16666",
        "2026-11-24 10:01:45.000 ERROR [Rank 1] ValueError: EI0006 Notify wait execute timeout during AllReduce",
        "2026-11-24 10:01:45.100 ERROR [Rank 2] EI0002 The wait execution of the Notify register times out",
      ].join("\n"),
    );
    expect(valueErrCascade.firstFaultVerdict.rank).toBe(3);
    expect(valueErrCascade.firstFaultVerdict.confidence).toBe("high");
    expect(valueErrCascade.firstFaultVerdict.cascadeRanks).toEqual([1, 2]);
    expect(valueErrCascade.findings.map((f) => f.ruleId)).toEqual([
      "hccl-link-or-ifname-fault",
      "hccl-timeout-cascade",
    ]);
    const linkEv = valueErrCascade.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 3);
    const waitEv = valueErrCascade.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1);
    expect(linkEv?.faultMechanism).toBe("hccl-link");
    expect(waitEv?.faultMechanism).toBe("hccl-wait-cascade");

    // LinkEstablish EI0006 + Getting socket times out -> Rule 17 ONLY (NOT Rule 3!) and low confidence without blaming Rank 0
    const linkEstablishOnly = analyzeTroubleshootInput(
      "2026-11-24 10:00:05.000 ERROR [Rank 0] EI0006 Getting socket times out during [Wait][LinkEstablish]",
    );
    expect(linkEstablishOnly.findings.map((f) => f.ruleId)).toEqual(["hccl-link-or-ifname-fault"]);
    expect(linkEstablishOnly.firstFaultVerdict.rank).toBeNull();
    expect(linkEstablishOnly.firstFaultVerdict.timelineEvents?.[0]?.faultMechanism).toBe("hccl-wait-cascade");

    for (const line of [
      "ERROR [Rank 2] EI0004 ranktable check failed: invalid host ip",
      "ERROR [Rank 2] EI0009 Device 2 transport init error. Reason: link down",
      "ERROR [Rank 2] EJ0001 HCCP init failed",
      "ERROR [Rank 2] RaSocketBind failed on enp65s0f0: EADDRNOTAVAIL Cannot assign requested address",
      "ERROR [Rank 2] HCCL_SOCKET_IFNAME=eth9 bind failed",
      "ERROR [Rank 2] RoCE port 0 link down",
    ]) {
      expect(analyzeTroubleshootInput(line).findings.map((f) => f.ruleId)).toEqual([
        "hccl-link-or-ifname-fault",
      ]);
    }
    const p2pWaitOnly = analyzeTroubleshootInput("ERROR [Rank 2] HCCL p2p timeout during comm init");
    expect(p2pWaitOnly.findings.map((f) => f.ruleId)).toEqual(["hccl-timeout-cascade"]);
    expect(p2pWaitOnly.firstFaultVerdict.rank).toBeNull();
    // Benign export HCCL_SOCKET_IFNAME must not false-positive
    expect(
      analyzeTroubleshootInput("export HCCL_SOCKET_IFNAME=enp65s0f0 HCCL_IF_IP=192.0.2.11").findings,
    ).toEqual([]);

    // 2) Rule 18: TorchAir / npugraph_ex / GE compile / Dynamo / fake_impl / tiling — ZERO shadowing with Rule 6 or Rule 13
    const compileShadowCheck = analyzeTroubleshootInput(
      [
        'File "vllm_ascend/worker/model_runner_v1.py", line 6613, in capture_model',
        "ERROR [Rank 0] GE compile graph failed EZ9999 retCode=0x1: coreNum is 0, tiling failed (CheckMlaAttrs)",
      ].join("\n"),
    );
    expect(compileShadowCheck.findings.map((f) => f.ruleId)).toEqual(["torchair-ge-graph-compile-fault"]);

    for (const line of [
      "ERROR [Rank 0] [torchair] torch._dynamo.exc.Unsupported: graph break under fullgraph=True",
      "ERROR [Rank 0] torch._dynamo.exc.BackendCompilerFailed: backend='npugraph_ex' raised",
      "ERROR [Rank 0] RuntimeError: There was no fake impl registered for vllm_ascend::custom_op",
      "ERROR [Rank 0] RuntimeError: External DP static compilation requires the full DP worker world",
      "ERROR [Rank 0] EZ3002 unsupported op type in GE graph compile",
      "ERROR [Rank 0] EZ3003 no supported kernel engine found",
      "ERROR [Rank 0] E19999 OPP version mismatch during graph compile",
    ]) {
      expect(analyzeTroubleshootInput(line).findings.map((f) => f.ruleId)).toEqual([
        "torchair-ge-graph-compile-fault",
      ]);
    }
    expect(
      analyzeTroubleshootInput(
        "ERROR [Rank 0] torch._dynamo.exc.BackendCompilerFailed: backend='inductor' raised: FileNotFoundError: gcc",
      ).findings.map((f) => f.ruleId),
    ).not.toContain("torchair-ge-graph-compile-fault");

    // 3) Rule 19: MoE MC2 & msModelSlim (while GQA C8 & 310P stay on Rule 5)
    for (const line of [
      "ERROR [Rank 1] AssertionError: mc2 group is not initialized",
      "ERROR [Rank 1] AssertionError: expert_map is required for MC2 token dispatch.",
      "ERROR [Rank 1] npu_moe_distribute_dispatch_v2 failed: worldSize is invalid, expect (0, 768]",
      "ERROR [Rank 1] DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, m = 128, k = 2048, topK = 8",
      "ERROR [Rank 1] ValueError: fused mc2 op cannot be used with hierarchy communication.",
      "ERROR [Rank 1] ValueError: mc2_comm_alg == 'hierarchy' supports at most 512 experts",
      "ERROR [Rank 0] ValueError: ERROR: ModelSlim Quantization Config Not Found (quant_model_description.json)",
      "ERROR [Rank 0] ValueError: Not all shards of model.layers.0.mlp are quantized with same quant type.",
      "ERROR [Rank 0] ValueError: Could not determine quantization type for layer model.layers.0.self_attn",
      "ERROR [Rank 0] NotImplementedError: Currently, vLLM Ascend doesn't support quant_type=W4A4 for layer_type=Linear.",
    ]) {
      expect(analyzeTroubleshootInput(line).findings.map((f) => f.ruleId)).toEqual([
        "moe-mc2-or-modelslim-quant-fault",
      ]);
    }

    // 4) Rule 20: CANN HAL / driver / /dev/davinci* / device init blockers (while wheel SoC mismatch stays on Rule 5)
    for (const line of [
      "ERROR [Rank 0] ImportError: libascend_hal.so: cannot open shared object file: No such file or directory",
      "ERROR [Rank 0] OSError: /dev/davinci0: Permission denied (EACCES)",
      "ERROR [Rank 0] RuntimeError: aclrtGetPhyDevIdByUserDevId failed for user device 0, error code: 507008",
      "ERROR [Rank 0] RuntimeError: drvGetDevInfo failed, error code: 107002 (ACL_ERROR_RT_CONTEXT_NULL)",
      "ERROR [Rank 0] AssertionError: DP adjusted local rank 4 is out of bounds for 4 devices.",
      "ERROR [Rank 0] EL0004: Failed to allocate memory.",
    ]) {
      expect(analyzeTroubleshootInput(line).findings.map((f) => f.ruleId)).toEqual([
        "cann-driver-or-device-env-fault",
      ]);
    }
    expect(
      analyzeTroubleshootInput(
        "docker run --device=/dev/davinci_manager --device=/dev/davinci0 ascend:latest",
      ).findings,
    ).toEqual([]);
    expect(
      analyzeTroubleshootInput(
        "ValueError: Current device type: Ascend910B does not match the installed version's device type: Ascend310P.",
      ).findings.map((f) => f.ruleId),
    ).toEqual(["soc-310p-or-c8-compat"]);

    // Verify all 20 ruleIds are exercised directly across TROUBLESHOOT_FIXTURES
    const allSeenRuleIds = new Set<string>(
      TROUBLESHOOT_FIXTURES.flatMap((fx) =>
        analyzeTroubleshootInput(fx.content).findings.map((f) => f.ruleId),
      ),
    );
    expect(allSeenRuleIds.size).toBe(20);
  });

  it("P1-2: eliminates benign INFO/DEBUG/ret=0 false positives on Rules 17-20 and preserves later Rank 3 OOM verdict", () => {
    const benignPlusOom = [
      "10:00:00 [Rank 1] INFO torchair backend initialized",
      "10:00:01 [Rank 3] ERROR NPU out of memory",
    ].join("\n");
    const r = analyzeTroubleshootInput(benignPlusOom);
    expect(r.firstFaultVerdict.rank).toBe(3);
    expect(r.firstFaultVerdict.confidence).toBe("high");
    expect(r.findings.map((f) => f.ruleId)).toEqual(["oom-stage-split"]);

    for (const benignLine of [
      "RaSocketConnect success; error=0",
      "MoeDistributeDispatch tiling completed",
      "DispatchFFNCombine Tiling Debug",
      "aclrtSetDevice(0) ret=0",
      "GE compile finished retCode=0",
      "tokens processed: 107002",
      "port 507008",
      "10:00:00 [Rank 1] INFO torchair backend initialized",
    ]) {
      const rep = analyzeTroubleshootInput(benignLine);
      expect(rep.findings, `expected zero findings for: ${benignLine}`).toEqual([]);
      expect(rep.firstFaultVerdict.rank, `expected null rank for: ${benignLine}`).toBeNull();
    }
  });

  it("P1-3: isolates peer/target ranks from reporter rank, ignores bare RoCE as iface, supports quoted IFNAME, and enforces causal host/target/unranked checks", () => {
    const peerErr = analyzeTroubleshootInput(
      "[ERROR] HCCL RaSocketConnect failed to peer rank 7: ECONNREFUSED",
    );
    expect(peerErr.firstFaultVerdict.rank).toBeNull();
    expect(peerErr.firstFaultVerdict.slotMappable).toBe(false);
    expect(peerErr.firstFaultVerdict.timelineEvents?.[0]?.rank).toBeNull();
    expect(peerErr.firstFaultVerdict.timelineEvents?.[0]?.peerRank).toBe(7);
    expect(peerErr.firstFaultVerdict.timelineEvents?.[0]?.slotMappable).toBe(false);
    const peerR17 = peerErr.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault");
    expect(peerR17?.title).toContain("ECONNREFUSED");

    for (const phrase of [
      "remote rank 7",
      "target rank 7",
      "dst rank 7",
      "to rank 7",
      "from rank 7",
      "waiting for rank 7",
      "root rank 7",
    ]) {
      const rep = analyzeTroubleshootInput(`[ERROR] HCCL connect failed ${phrase}: ECONNREFUSED`);
      expect(rep.firstFaultVerdict.rank, `phrase=${phrase}`).toBeNull();
      expect(rep.firstFaultVerdict.timelineEvents?.[0]?.peerRank, `phrase=${phrase}`).toBe(7);
    }

    const rocePort = analyzeTroubleshootInput("ERROR [Rank 2] RoCE port 2 link down");
    const roceR17 = rocePort.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault");
    expect(roceR17?.title).toContain("端口 2");
    expect(roceR17?.title).not.toContain("接口 RoCE");
    expect(rocePort.firstFaultVerdict.timelineEvents?.[0]?.iface).toBeNull();
    expect(rocePort.firstFaultVerdict.timelineEvents?.[0]?.port).toBe("2");

    const quotedIf = analyzeTroubleshootInput('ERROR [Rank 1] HCCL_SOCKET_IFNAME="eth0" bind failed');
    expect(quotedIf.firstFaultVerdict.timelineEvents?.[0]?.iface).toBe("eth0");
    expect(quotedIf.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault")?.title).toContain("eth0");

    const crossHostLog = [
      "10:00:00 [node-P] [Rank 1] ERROR NPU out of memory",
      "10:00:05 [node-D] [Rank 3] ERROR EI0002 Notify wait execute timeout waiting for rank 2",
    ].join("\n");
    const crossHostRep = analyzeTroubleshootInput(crossHostLog);
    expect(crossHostRep.firstFaultVerdict.cascadeCausalState).not.toBe("confirmed-after");
    expect(crossHostRep.firstFaultVerdict.cascadeRanks).toEqual([]);
    const crossEv = crossHostRep.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 3);
    expect(crossEv?.kind).toBe("unattributed-cascade");

    const unrankedEarlierLog = [
      "10:00:00 ERROR EI0002 Notify wait execute timeout",
      "10:00:05 [Rank 3] ERROR NPU out of memory",
    ].join("\n");
    const unrankedRep = analyzeTroubleshootInput(unrankedEarlierLog);
    expect(unrankedRep.firstFaultVerdict.cascadeCausalState).toBe("earlier-than-primary");
  });

  it("P1-4 & P2/P3: separates EI0002 vs EI0006, avoids R3+R17 double-claiming, keeps multi-rank R6+R18, deduplicates single-line faults, fixes R18/R19/R20 details & slicing", () => {
    // EI0002-only log must show EI0002 (NOT EI0006!) in Rule 3 title
    const ei0002Only = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 1] ERROR NPU out of memory",
        "10:00:05 [Rank 2] ERROR EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    const r3Ei0002 = ei0002Only.findings.find((f) => f.ruleId === "hccl-timeout-cascade");
    expect(r3Ei0002?.title).toContain("EI0002");
    expect(r3Ei0002?.title).not.toContain("EI0006");

    // Primary R17 line must NOT open R3 hccl-timeout-cascade
    const raTimedOut = analyzeTroubleshootInput(
      "[Rank 0] ERROR RaSocketConnect timed out on HCCL_SOCKET_IFNAME=eth0",
    );
    expect(raTimedOut.findings.map((f) => f.ruleId)).toEqual(["hccl-link-or-ifname-fault"]);

    // 2-line bare EI0006 + [Wait][LinkEstablish] on same rank is ONE link-establish event (R17 only, no R3)
    const twoLineLinkEst = analyzeTroubleshootInput(
      [
        "10:00:01 [Rank 0] ERROR EI0006",
        "10:00:01 [Rank 0] [Wait][LinkEstablish]wait socket establish timeout",
      ].join("\n"),
    );
    expect(twoLineLinkEst.findings.map((f) => f.ruleId)).toEqual(["hccl-link-or-ifname-fault"]);
    expect(twoLineLinkEst.firstFaultVerdict.timelineEvents).toHaveLength(1);

    // HTTP No route to host is NOT R17; Mooncake No route to host stays R9
    expect(
      analyzeTroubleshootInput("[Rank 1] ERROR HTTP client connect: No route to host").findings.map(
        (f) => f.ruleId,
      ),
    ).not.toContain("hccl-link-or-ifname-fault");
    expect(
      analyzeTroubleshootInput("ERROR [Rank 1] MooncakeConnectorV1 failed: No route to host").findings.map(
        (f) => f.ruleId,
      ),
    ).toEqual(["mooncake-pd-transfer-error"]);

    // Multi-rank R6 + R18 independence
    const multiRankGraph = analyzeTroubleshootInput(
      [
        "[Rank 0] ERROR capture_model failed",
        "[Rank 1] ERROR BackendCompilerFailed: backend='npugraph_ex' raised",
      ].join("\n"),
    );
    expect(multiRankGraph.findings.map((f) => f.ruleId)).toEqual(
      expect.arrayContaining(["graph-capture-failure", "torchair-ge-graph-compile-fault"]),
    );

    // Single-event dedup: aclnnMoeDistributeDispatchV2 + coreNum=0 tiling does NOT triple-open; drvGetDevInfo retCode=0x1 does NOT open R13
    const singleAclnnTiling = analyzeTroubleshootInput(
      "ERROR [Rank 0] aclnnMoeDistributeDispatchV2 failed: coreNum is 0, tiling failed",
    );
    expect(singleAclnnTiling.findings).toHaveLength(1);
    const drvRet = analyzeTroubleshootInput("ERROR [Rank 0] drvGetDevInfo failed retCode=0x1");
    expect(drvRet.findings.map((f) => f.ruleId)).toEqual(["cann-driver-or-device-env-fault"]);

    // POST_KV_CAPTURE_STACK_RE catches `during aclgraph capture_model`
    const aclgraphOom = analyzeTroubleshootInput(
      "ERROR [Rank 0] RuntimeError: NPU out of memory during aclgraph capture_model",
    );
    expect(aclgraphOom.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain("图捕获");

    // R18 nested config & static kernel note
    const r18 = analyzeTroubleshootInput(
      "ERROR [Rank 0] torch._dynamo.exc.BackendCompilerFailed: backend='npugraph_ex' raised",
    ).findings.find((f) => f.ruleId === "torchair-ge-graph-compile-fault");
    expect(r18?.experimentStep).toContain('{"ascend_compilation_config":{"enable_npugraph_ex":false}}');
    expect(r18?.experimentStep).toContain("enable_static_kernel");

    // R19 formula (x 3 + 10 MiB) & moe_comm_method.py:591 & no ModelSlim on generic (awq) vs (gptq)
    const r19 = analyzeTroubleshootInput(
      "ERROR [Rank 1] DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, m = 128, k = 2048, topK = 8",
    ).findings.find((f) => f.ruleId === "moe-mc2-or-modelslim-quant-fault");
    expect(r19?.summary).toContain("× 3");
    expect(r19?.sources).toContain(
      "vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/moe_comm_method.py#L590-L609",
    );
    const genericQuant = analyzeTroubleshootInput(
      "ValueError: Quantization method specified in the model config (awq) does not match the quantization method specified in the `quantization` argument (gptq).",
    );
    expect(genericQuant.findings.map((f) => f.ruleId)).not.toContain("moe-mc2-or-modelslim-quant-fault");

    // R20 pure EL0004 scope + per-rank OOM isolation
    const pureEl0004 = analyzeTroubleshootInput("ERROR [Rank 2] EL0004: Failed to allocate memory.");
    const r20Pure = pureEl0004.findings.find((f) => f.ruleId === "cann-driver-or-device-env-fault");
    expect(r20Pure?.summary).not.toContain("/dev/davinci");
    const crossRankEl0004 = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] ERROR NPU out of memory",
        "10:00:01 [Rank 2] ERROR EL0004: Failed to allocate memory.",
      ].join("\n"),
    );
    expect(crossRankEl0004.findings.map((f) => f.ruleId)).toContain("cann-driver-or-device-env-fault");

    // Pre-slice evaluation: 4 LinkEstablish timeout lines + 1 later RaSocketBind still extracts RaSocketBind & eth9
    const r17After4Timeouts = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] ERROR EI0006 Getting socket times out [Wait][LinkEstablish]",
        "10:00:00 [Rank 1] ERROR EI0006 Getting socket times out [Wait][LinkEstablish]",
        "10:00:00 [Rank 2] ERROR EI0006 Getting socket times out [Wait][LinkEstablish]",
        "10:00:00 [Rank 3] ERROR EI0006 Getting socket times out [Wait][LinkEstablish]",
        "10:00:00 [Rank 4] ERROR RaSocketBind failed on HCCL_SOCKET_IFNAME=eth9: EADDRNOTAVAIL",
      ].join("\n"),
    );
    const r17Pre = r17After4Timeouts.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault");
    expect(r17Pre?.evidenceLevel).toBe("C");
    expect(r17Pre?.title).toContain("eth9");

    // 16-event timeline cap preserves EVERY distinct primary root-cause rank even after 16 early wait lines
    const earlyWaits = Array.from(
      { length: 16 },
      (_, i) =>
        `10:00:${String(i).padStart(2, "0")} [node-${i}] [Rank ${i % 8}] ERROR EI0002 Notify wait execute timeout`,
    );
    const lateRoots = [
      "10:01:00 [node-A] [Rank 3] ERROR NPU out of memory",
      "10:01:01 [node-B] [Rank 5] ERROR NPU out of memory",
    ];
    const capReport = analyzeTroubleshootInput([...earlyWaits, ...lateRoots].join("\n"));
    const rootRanksInTimeline = capReport.firstFaultVerdict.timelineEvents
      ?.filter((e) => e.kind === "root-cause")
      .map((e) => e.rank);
    expect(rootRanksInTimeline).toEqual(expect.arrayContaining([3, 5]));
  });

  it("corpus hardening (Items 1–5): 161002/561002/161001 -> R14, 507035/Vector Core/0x31 preserved in R13, MoeDistributeDispatchV2 routing & BUFFSIZE formula isolation, cross-instance/group guard, EI0006/EL0004 precision", () => {
    // 1. 161002 / 161001 / 561002 -> R14 ONLY (never R13 507015/SMMU)
    for (const line of [
      "ERROR [Rank 0] call aclnnChunkGatedDeltaRule failed, error code is 161002",
      "RuntimeError: npu_mla_prolog_v3_functional:../MlaPrologV3KernelNpuOpApi.cpp:389 NPU function error: call aclnn                          MlaPrologV3WeightNz failed, error code is 161002",
    ]) {
      const r = analyzeTroubleshootInput(line);
      expect(r.findings.map((f) => f.ruleId)).toEqual(["cann-opapi-or-aclnn-fault"]);
      expect(r.findings[0]?.title).toContain("161002");
      expect(r.findings[0]?.title).not.toContain("507015");
      expect(r.findings[0]?.summary).toContain("ACLNN_ERR_PARAM_INVALID");
    }

    for (const line of [
      "ERROR [Rank 0] call aclnnChunkGatedDeltaRule failed, error code is 561002",
      "RuntimeError: aclnnMatmul failed, error code is 561002: tiling failed",
      "slice=[0 64)   : status=561002   <- x D=64, cos/sin D=128",
    ]) {
      const r = analyzeTroubleshootInput(line);
      expect(r.findings.map((f) => f.ruleId)).toEqual(["cann-opapi-or-aclnn-fault"]);
      expect(r.findings[0]?.evidenceLevel).toBe("C");
      expect(r.findings[0]?.title).toContain("561002");
      expect(r.findings[0]?.summary).toContain("ACLNN_ERR_INNER_TILING_ERROR");
      expect(r.findings[0]?.summary).not.toContain("未贴出具体返回码");
    }

    const r161001 = analyzeTroubleshootInput("ERROR [Rank 0] call aclnnRope failed, error code is 161001");
    expect(r161001.findings.map((f) => f.ruleId)).toEqual(["cann-opapi-or-aclnn-fault"]);
    expect(r161001.findings[0]?.evidenceLevel).toBe("C");
    expect(r161001.findings[0]?.title).toContain("161001");
    expect(r161001.findings[0]?.summary).toContain("ACLNN_ERR_PARAM_NULLPTR");

    // 2. 507035 / Vector Core / retCode=0x31 / native ErrCode=507035 & multi-host 507015 + 507035
    const vec0x31 = analyzeTroubleshootInput(
      "[ERROR] RUNTIME(17495,):2026-08-28-07:07:41.091.652 [davinci_kernel_task_v100.cc:568]17841 SetStarsResultForDavinciTask:Vector Core kernel execution failed, retCode=0x31.",
    );
    expect(vec0x31.findings.map((f) => f.ruleId)).toEqual(["cann-plog-aicore-fault"]);
    expect(vec0x31.findings[0]?.title).toContain("Vector Core");
    expect(vec0x31.findings[0]?.title).toContain("0x31");
    expect(vec0x31.findings[0]?.title).not.toContain("507015");
    expect(vec0x31.findings[0]?.summary).toContain("0x31");
    expect(vec0x31.findings[0]?.summary).not.toContain("507015");

    const smmu507035 = analyzeTroubleshootInput("ERROR [Rank 0] kernel failed: 507035, SMMU fault");
    expect(smmu507035.findings.map((f) => f.ruleId)).toEqual(["cann-plog-aicore-fault"]);
    expect(smmu507035.findings[0]?.title).toContain("507035");
    expect(smmu507035.findings[0]?.title).not.toContain("507015");
    expect(smmu507035.findings[0]?.summary).not.toContain("507015");

    const native507035 = analyzeTroubleshootInput(
      "rtStreamSynchronize: ErrCode=507035, desc=[vector core exception]",
    );
    expect(native507035.findings.map((f) => f.ruleId)).toEqual(["cann-plog-aicore-fault"]);
    expect(native507035.findings[0]?.title).toContain("507035");
    expect(native507035.findings[0]?.title).not.toContain("507015");

    const dual5070 = analyzeTroubleshootInput(
      [
        "[node-P] [Rank 0] ERROR aclnnMatmul failed, error code is 507035",
        "[node-D] [Rank 1] ERROR AclrtSynchronizeStreamWithTimeout error code is 507015",
      ].join("\n"),
    );
    expect(dual5070.findings[0]?.title).toContain("507035");
    expect(dual5070.findings[0]?.title).not.toContain("507015");

    const sameHostDual5070 = analyzeTroubleshootInput(
      [
        "[node-P] [Rank 0] ERROR aclnnMatmul failed, error code is 507035",
        "[node-P] [Rank 1] ERROR AclrtSynchronizeStreamWithTimeout error code is 507015",
      ].join("\n"),
    );
    expect(sameHostDual5070.findings[0]?.title).toContain("507015");
    expect(sameHostDual5070.findings[0]?.title).toContain("507035");
    expect(sameHostDual5070.findings[0]?.summary).toContain("507035");

    // 3. MoeDistributeDispatchV2 with explicit return codes (even with group_ep=ep0) -> R13/R14, NOT R19; BUFFSIZE formula isolation & timeline phase
    for (const epSuffix of ["", ", group_ep=ep0"]) {
      expect(
        analyzeTroubleshootInput(
          `ERROR [Rank 0] aclnnMoeDistributeDispatchV2 failed${epSuffix}, error code is 507035`,
        ).findings.map((f) => f.ruleId),
      ).toEqual(["cann-plog-aicore-fault"]);
      expect(
        analyzeTroubleshootInput(
          `ERROR [Rank 0] aclnnMoeDistributeDispatchV2 failed${epSuffix}, error code is 507015`,
        ).findings.map((f) => f.ruleId),
      ).toEqual(["cann-plog-aicore-fault"]);
      expect(
        analyzeTroubleshootInput(
          `ERROR [Rank 0] aclnnMoeDistributeDispatchV2 failed${epSuffix}, error code is 161002`,
        ).findings.map((f) => f.ruleId),
      ).toEqual(["cann-opapi-or-aclnn-fault"]);
      expect(
        analyzeTroubleshootInput(
          `ERROR [Rank 0] aclnnMoeDistributeDispatchV2 failed${epSuffix}, error code is 561002`,
        ).findings.map((f) => f.ruleId),
      ).toEqual(["cann-opapi-or-aclnn-fault"]);
    }

    const v2Buff = analyzeTroubleshootInput(
      "ERROR [Rank 1] MoeDistributeDispatchV2: HCCL_BUFFSIZE is too SMALL",
    );
    expect(v2Buff.findings.map((f) => f.ruleId)).toEqual(["moe-mc2-or-modelslim-quant-fault"]);
    expect(v2Buff.findings[0]?.summary).not.toContain("× 3");
    expect(v2Buff.findings[0]?.summary).not.toContain("10 MiB");
    expect(v2Buff.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("runtime");

    const genericBuff = analyzeTroubleshootInput("ERROR [Rank 1] HCCL_BUFFSIZE is too SMALL");
    expect(genericBuff.findings.map((f) => f.ruleId)).toEqual(["moe-mc2-or-modelslim-quant-fault"]);
    expect(genericBuff.findings[0]?.summary).not.toContain("× 3");
    expect(genericBuff.findings[0]?.summary).not.toContain("DispatchFFNCombine");

    const dispatchPhase = analyzeTroubleshootInput(
      "ERROR [Rank 1] DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, m = 128, k = 2048, topK = 8",
    );
    expect(dispatchPhase.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("runtime");
    const mc2InitPhase = analyzeTroubleshootInput(
      "ERROR [Rank 1] AssertionError: mc2 group is not initialized",
    );
    expect(mc2InitPhase.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("comm-init");

    // 4. Cross-instance/group cascade guard, benign EI0006 count=0, bare EI0006 link-establish, pure HCCL_E_WAIT_TIMEOUT
    const crossInstance = analyzeTroubleshootInput(
      [
        "2026-11-24 10:00:00.000 ERROR [Rank 3] instance=blue group=tp-blue RuntimeError: NPU out of memory",
        "2026-11-24 10:00:10.000 ERROR [Rank 0] instance=green group=tp-green EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(crossInstance.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");
    expect(crossInstance.firstFaultVerdict.cascadeRanks).toEqual([]);
    expect(crossInstance.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 0)?.kind).toBe(
      "unattributed-cascade",
    );

    const benignCountZero = analyzeTroubleshootInput("INFO [Rank 0] EI0006 count=0");
    expect(benignCountZero.findings).toEqual([]);
    expect(benignCountZero.firstFaultVerdict.timelineEvents).toEqual([]);

    const bareEi0006 = analyzeTroubleshootInput("ERROR [Rank 2] EI0006");
    expect(bareEi0006.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("link-establish");
    expect(bareEi0006.firstFaultVerdict.rank).toBeNull();

    const waitTimeoutOnly = analyzeTroubleshootInput("ERROR [Rank 1] HCCL_E_WAIT_TIMEOUT");
    const r3WaitOnly = waitTimeoutOnly.findings.find((f) => f.ruleId === "hccl-timeout-cascade");
    expect(r3WaitOnly?.title).toContain("HCCL_E_WAIT_TIMEOUT");
    expect(r3WaitOnly?.title).not.toContain("EI0002");

    // 5. EL0004 timeline tag + multi-code R20 summary
    const pureEl = analyzeTroubleshootInput("ERROR [Rank 0] EL0004: Failed to allocate memory.");
    expect(pureEl.firstFaultVerdict.timelineEvents?.[0]?.signalTag).toBe("CANN 运行时内存/资源分配失败");
    expect(pureEl.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("runtime");
    expect(pureEl.firstFaultVerdict.rationale).toContain("CANN 运行时内存/资源分配失败");
    expect(pureEl.firstFaultVerdict.rationale).not.toContain("驱动 / HAL / 设备初始化阻断");

    const multiR20 = analyzeTroubleshootInput(
      [
        "[node-P] [Rank 0] ERROR EL0004: Failed to allocate memory.",
        "[node-D] [Rank 1] ERROR RuntimeError: drvGetDevInfo failed, error code: 107002 (ACL_ERROR_RT_CONTEXT_NULL)",
      ].join("\n"),
    );
    const r20Multi = multiR20.findings.find((f) => f.ruleId === "cann-driver-or-device-env-fault");
    expect(r20Multi?.title).toContain("EL0004");
    expect(r20Multi?.title).not.toContain("107002");

    const sameHostMultiR20 = analyzeTroubleshootInput(
      [
        "[node-P] [Rank 0] ERROR EL0004: Failed to allocate memory.",
        "[node-P] [Rank 1] ERROR RuntimeError: drvGetDevInfo failed, error code: 107002 (ACL_ERROR_RT_CONTEXT_NULL)",
      ].join("\n"),
    );
    const r20SameHost = sameHostMultiR20.findings.find((f) => f.ruleId === "cann-driver-or-device-env-fault");
    expect(r20SameHost?.title).toContain("EL0004");
    expect(r20SameHost?.title).toContain("107002");
    expect(r20SameHost?.summary).toContain("EL0004");
    expect(r20SameHost?.summary).toContain("107002");
  });

  it("corpus hardening (Items 6–9): R6 Triton/test-name exclusion, R2 CUDA exclusion & runtime OOM split, R4 pid=137 & dual SIGKILL+SIGSEGV, R7–R12 precision", () => {
    // 6. R6 false positives on pytest identifiers & Triton JIT compilation
    const tritonJit = analyzeTroubleshootInput(
      "`test_qwen3_moe_full_decode_only_tp2` failed during triton kernel compilation period:",
    );
    expect(tritonJit.findings.map((f) => f.ruleId)).not.toContain("graph-capture-failure");

    const testAclgraphShell = analyzeTroubleshootInput(
      "- test_qwen35_lora_with_aclgraph_tp1_fp16 — RuntimeError: Engine core initialization failed. See root cause above. Failed core proc(s): {'EngineCore': 1}",
    );
    expect(testAclgraphShell.findings.map((f) => f.ruleId)).not.toContain("graph-capture-failure");

    // 7. R2 CUDA exclusion & 3-way runtime/workspace OOM split
    const pureCudaOom = analyzeTroubleshootInput(
      "torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB (GPU 0; 79.15 GiB total capacity)",
    );
    expect(pureCudaOom.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");

    for (const runtimeLine of [
      "[rank0]:[E723 03:19:38] NPU out of memory. NPUWorkspaceAllocator tried to allocate 216.00 MiB",
      "ERROR [Rank 0] RuntimeError: NPU out of memory during decode",
    ]) {
      const r = analyzeTroubleshootInput(runtimeLine);
      const oom = r.findings.find((f) => f.ruleId === "oom-stage-split");
      expect(oom?.title).toBe("运行期请求执行 / Workspace 显存不足（NPU HBM OOM）");
      expect(oom?.title).not.toContain("冷启动");
      expect(oom?.title).not.toContain("图捕获");
    }

    const dummyWarmupOom = analyzeTroubleshootInput(
      [
        "INFO [Rank 0] Available KV cache memory: 30.00 GiB",
        'File "vllm_ascend/worker/model_runner_v1.py", line 100, in _dummy_run',
        "ERROR [Rank 0] RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    expect(dummyWarmupOom.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain("图捕获");

    // 8. R4 pid=137 never triggers SIGKILL, and concurrent SIGSEGV (-11) + SIGKILL (-9) emit BOTH cards
    const pid137Segv = analyzeTroubleshootInput(
      "[Worker_TP0 pid=137] ERROR worker exited with exitcode: -11",
    );
    expect(pid137Segv.findings.map((f) => f.ruleId)).toEqual(["exit-139-sigsegv"]);

    const dualExit = analyzeTroubleshootInput(
      [
        "[Worker_TP0 pid=137] ERROR worker exited with exitcode: -11",
        "[Worker_TP1 pid=200] ERROR worker exited with exitcode: -9",
      ].join("\n"),
    );
    expect(dualExit.findings.map((f) => f.ruleId)).toEqual(
      expect.arrayContaining(["exit-137-sigkill", "exit-139-sigsegv"]),
    );

    const oomKiller = analyzeTroubleshootInput("Out of memory: Killed process 4412 (python)");
    expect(oomKiller.findings.map((f) => f.ruleId)).toEqual(["exit-137-sigkill"]);

    // 9. R7–R12 precision
    const r7Snap = analyzeTroubleshootInput(
      ["vllm:kv_cache_usage_perc 0.96", "vllm:num_preemptions_total 1", "vllm:num_requests_waiting 1"].join(
        "\n",
      ),
    );
    const r7Finding = r7Snap.findings.find((f) => f.ruleId === "metrics-kv-preemption-storm");
    expect(r7Finding?.title).toContain("累计已记录抢占");
    expect(r7Finding?.title).toContain("KV 高水位伴随排队");
    expect(r7Finding?.summary).not.toContain("正在反复驱逐");

    const r8TtftOnly = analyzeTroubleshootInput(
      ["vllm:time_to_first_token_seconds_sum 2", "vllm:time_to_first_token_seconds_count 1"].join("\n"),
    );
    const r8Finding = r8TtftOnly.findings.find((f) => f.ruleId === "metrics-low-kv-high-latency");
    expect(r8Finding).toBeDefined();
    expect(r8Finding?.title).not.toContain("低 KV");
    expect(r8Finding?.title).not.toContain("零排队");
    expect(r8Finding?.title).not.toContain("正常 ITL");
    expect(r8Finding?.summary).not.toContain("num_requests_waiting=0");
    expect(r8Finding?.summary).not.toContain("KV 使用率仅 低水位");

    const r9MetricsHttp = analyzeTroubleshootInput("ERROR HTTP connection to mooncake metrics server failed");
    expect(r9MetricsHttp.findings.map((f) => f.ruleId)).not.toContain("mooncake-pd-transfer-error");

    const r10WeightUpdate = analyzeTroubleshootInput(
      [
        'File "vllm_ascend/worker/worker.py", line 336, in start_weight_update',
        "  self._check_nz_disabled()",
        "ValueError: FRACTAL_NZ mode is enabled.",
      ].join("\n"),
    );
    const r10Finding = r10WeightUpdate.findings.find((f) => f.ruleId === "sleep-mode-fractal-nz-wakeup");
    expect(r10Finding?.title).toContain("start_weight_update");
    expect(r10Finding?.summary).toContain("_check_nz_disabled");
    expect(r10Finding?.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L318-L339");

    const r11DirectOk = analyzeTroubleshootInput(
      "INFO transfer_executor_base.cpp:64] Dest buffer device_id=0 < endpoint count, direct transfer completed",
    );
    expect(r11DirectOk.findings.map((f) => f.ruleId)).not.toContain("mooncake-adxl-endpoint-fallback");

    const r12PrevDebug = analyzeTroubleshootInput(
      "INFO VLLM_LOGGING_LEVEL=INFO (previous VLLM_LOGGING_LEVEL=DEBUG)",
    );
    expect(r12PrevDebug.findings.map((f) => f.ruleId)).not.toContain("debug-logging-hotpath-overhead");

    // 10. Final review precision guards:
    // (a) Socket handshake timeout stays unattributed (never proven root cause on waiting rank)
    const sockWaitOnly = analyzeTroubleshootInput(
      "[Rank 1] ERROR EI0006 [Wait][LinkEstablish] RaSocketConnect timed out waiting for rank 2",
    );
    expect(sockWaitOnly.firstFaultVerdict.rank).toBeNull();
    expect(sockWaitOnly.firstFaultVerdict.confidence).toBe("low");
    expect(sockWaitOnly.findings.map((f) => f.ruleId)).toEqual(["hccl-link-or-ifname-fault"]);

    // (b) Split EI0006 record preserves original rankSource (device-id stays slotMappable: false) and ignores benign count=0
    const splitDeviceEi0006 = analyzeTroubleshootInput(
      ["[device: 3] ERROR EI0006", "[Wait][LinkEstablish] Getting socket times out"].join("\n"),
    );
    expect(splitDeviceEi0006.firstFaultVerdict.timelineEvents?.[0]?.rank).toBe(3);
    expect(splitDeviceEi0006.firstFaultVerdict.timelineEvents?.[0]?.rankSource).toBe("device-id");
    expect(splitDeviceEi0006.firstFaultVerdict.timelineEvents?.[0]?.slotMappable).toBe(false);

    const benignCountBeforeWait = analyzeTroubleshootInput(
      ["[Rank 0] INFO EI0006 count=0", "[Wait][LinkEstablish] Getting socket times out"].join("\n"),
    );
    expect(benignCountBeforeWait.firstFaultVerdict.timelineEvents?.[0]?.rank).toBeNull();

    // (c) Peer/nearby startup milestone requires compatible instance & nonnegative time delta (including `load_model()`)
    for (const startToken of ["Starting load_model", "Starting load_model()"]) {
      const crossInstanceNegDeltaOom = analyzeTroubleshootInput(
        [`13:00:00 instance=blue INFO ${startToken}`, "09:00:00 instance=green ERROR NPU out of memory"].join(
          "\n",
        ),
      );
      const greenOomCard = crossInstanceNegDeltaOom.findings.find((f) => f.ruleId === "oom-stage-split");
      expect(greenOomCard?.title).toContain("缺少阶段里程碑");
      expect(greenOomCard?.title).not.toContain("冷启动");
    }

    // (d) Cross-host Ascend token never converts explicit CUDA OOM on another host into NPU HBM OOM (bracketed or unbracketed)
    for (const logPair of [
      [
        "10:00:00 [node-P] [Rank 0] INFO NPU initialized",
        "10:00:02 [node-D] [Rank 1] ERROR torch.cuda.OutOfMemoryError: CUDA out of memory",
      ],
      ["node-P INFO NPU initialized", "node-D ERROR torch.cuda.OutOfMemoryError: CUDA out of memory"],
    ]) {
      const crossHostCudaOom = analyzeTroubleshootInput(logPair.join("\n"));
      expect(crossHostCudaOom.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");
    }

    // (e) Consecutive distinct failed RoCE ports AND distinct peer ranks on the same rank survive timeline compression
    const twoRocePorts = analyzeTroubleshootInput(
      ["10:00:01 [Rank 2] ERROR RoCE port 1 link down", "10:00:02 [Rank 2] ERROR RoCE port 2 link down"].join(
        "\n",
      ),
    );
    expect(twoRocePorts.firstFaultVerdict.timelineEvents?.map((e) => e.port)).toEqual(["1", "2"]);

    const twoPeerWaits = analyzeTroubleshootInput(
      [
        "10:00:01 [Rank 0] ERROR EI0002 Notify wait execute timeout waiting for rank 1",
        "10:00:02 [Rank 0] ERROR EI0002 Notify wait execute timeout waiting for rank 2",
      ].join("\n"),
    );
    expect(twoPeerWaits.firstFaultVerdict.timelineEvents?.map((e) => e.peerRank)).toEqual([1, 2]);

    // (f) Closure guards: `timeout summary: EI0006 count=0`, post-OOM `Starting load_model()`, paste-order invariance across instances, and conflicting PIDs on same rank
    const timeoutSummaryZeroCount = analyzeTroubleshootInput(
      [
        "[Rank 7] INFO timeout summary: EI0006 count=0",
        "[Wait][LinkEstablish] Getting socket times out",
      ].join("\n"),
    );
    expect(timeoutSummaryZeroCount.firstFaultVerdict.timelineEvents?.[0]?.rank).toBeNull();

    const postOomRestartLoad = analyzeTroubleshootInput(
      [
        "10:00:01 instance=green ERROR NPU out of memory",
        "10:00:05 instance=green INFO Starting load_model()",
      ].join("\n"),
    );
    const postOomCard = postOomRestartLoad.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(postOomCard?.title).toContain("缺少阶段里程碑");
    expect(postOomCard?.title).not.toContain("冷启动");

    const blueFirstPaste = analyzeTroubleshootInput(
      [
        "12:00:00 instance=blue [Rank 0] INFO Starting load_model()",
        "12:00:01 instance=blue [Rank 0] ERROR NPU out of memory",
        "10:00:00 instance=green [Rank 0] ERROR NPU out of memory during decode",
      ].join("\n"),
    );
    const greenFirstPaste = analyzeTroubleshootInput(
      [
        "10:00:00 instance=green [Rank 0] ERROR NPU out of memory during decode",
        "12:00:00 instance=blue [Rank 0] INFO Starting load_model()",
        "12:00:01 instance=blue [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(blueFirstPaste.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain(
      "运行期请求执行",
    );
    expect(blueFirstPaste.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toBe(
      greenFirstPaste.findings.find((f) => f.ruleId === "oom-stage-split")?.title,
    );

    const conflictingPidCudaOom = analyzeTroubleshootInput(
      [
        "node-P INFO [Rank 0] pid=101 NPU Traceback (most recent call last):",
        "node-P ERROR [Rank 0] pid=202 torch.cuda.OutOfMemoryError: CUDA out of memory",
      ].join("\n"),
    );
    expect(conflictingPidCudaOom.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");

    // (g) v2 closure guards: unranked indented PID conflict, omission gap L5000, reversed timestamped load_model(), explicit `during decode` priority, and untimestamped Rank 4 transitivity
    const indentedPidConflict = analyzeTroubleshootInput(
      [
        "[node-P] [Rank 0] NPU Traceback (most recent call last):",
        "  [node-P] pid=101 worker frame",
        "torch.cuda.OutOfMemoryError: CUDA out of memory (pid=202)",
      ].join("\n"),
    );
    expect(indentedPidConflict.firstFaultVerdict.rank).toBeNull();
    expect(indentedPidConflict.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");

    const omissionGapEi0006 = analyzeTroubleshootInput(
      [
        "[Rank 7] ERROR EI0006",
        "... [日志节选：下行起原行号 L5000] ...",
        "[Wait][LinkEstablish] Getting socket times out",
      ].join("\n"),
    );
    expect(
      omissionGapEi0006.firstFaultVerdict.timelineEvents?.find((e) => e.lineNumber === 5000)?.rank,
    ).toBeNull();

    const chronoLoad = analyzeTroubleshootInput(
      [
        "10:00:00 instance=alpha [Rank 0] INFO Starting load_model()",
        "10:00:01 instance=alpha [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    const reverseLoad = analyzeTroubleshootInput(
      [
        "10:00:01 instance=alpha [Rank 0] ERROR NPU out of memory",
        "10:00:00 instance=alpha [Rank 0] INFO Starting load_model()",
      ].join("\n"),
    );
    expect(chronoLoad.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain("冷启动");
    expect(reverseLoad.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain("冷启动");

    const explicitDecodeOverridesLoad = analyzeTroubleshootInput(
      [
        "10:00:00 instance=alpha [Rank 0] INFO Starting load_model()",
        "10:00:01 instance=alpha [Rank 0] ERROR NPU out of memory during decode",
      ].join("\n"),
    );
    expect(explicitDecodeOverridesLoad.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain(
      "运行期请求执行",
    );

    const transitiveBlueFirst = analyzeTroubleshootInput(
      [
        "12:00:00 instance=blue [Rank 0] INFO Starting load_model()",
        "12:00:01 instance=blue [Rank 0] ERROR NPU out of memory",
        "[Rank 4] RuntimeError: other",
        "10:00:00 instance=green [Rank 0] ERROR NPU out of memory during decode",
      ].join("\n"),
    );
    const transitiveGreenFirst = analyzeTroubleshootInput(
      [
        "10:00:00 instance=green [Rank 0] ERROR NPU out of memory during decode",
        "[Rank 4] RuntimeError: other",
        "12:00:00 instance=blue [Rank 0] INFO Starting load_model()",
        "12:00:01 instance=blue [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(transitiveBlueFirst.firstFaultVerdict.primaryEvidenceLines[0]?.rawLine).toContain(
      "instance=green",
    );
    expect(transitiveGreenFirst.firstFaultVerdict.primaryEvidenceLines[0]?.rawLine).toContain(
      "instance=green",
    );
    expect(transitiveBlueFirst.firstFaultVerdict.confidence).toBe("medium");
    expect(transitiveGreenFirst.firstFaultVerdict.confidence).toBe("medium");
  });

  it("final architectural closure (v3 P2s 1–8): segmentId omission fences, closest-neighbor EI0006, strict traceback reset, full PID causal-domain scoping, ISO-8601 Z/offset timestamps, verdict confidence, OOM lifecycle progression, and timeline phase parity", () => {
    // 1. Short omission marker (L1 -> L4) blocks EI0006 pairing, OOM stack frames, and unscoped scopes; closest-neighbor EI0006 wins
    const shortGapEi0006 = analyzeTroubleshootInput(
      [
        "[Rank 7] ERROR EI0006",
        "... [日志节选：下行起原行号 L4] ...",
        "[Wait][LinkEstablish] Getting socket times out",
      ].join("\n"),
    );
    expect(shortGapEi0006.firstFaultVerdict.timelineEvents?.find((e) => e.lineNumber === 4)?.rank).toBeNull();

    const adjacentEi0006 = analyzeTroubleshootInput(
      [
        "[Rank 7] ERROR EI0006",
        "[Rank 2] ERROR EI0006",
        "[Wait][LinkEstablish] Getting socket times out",
      ].join("\n"),
    );
    expect(adjacentEi0006.firstFaultVerdict.timelineEvents?.map((e) => e.rank)).toEqual([7, 2]);
    expect(adjacentEi0006.firstFaultVerdict.timelineEvents?.find((e) => e.lineNumber === 3)?.rank).toBe(2);

    const shortGapOomFrame = analyzeTroubleshootInput(
      [
        '(EngineCore_DP0 pid=101) ERROR 11-22 20:00:00 [core.py:1366]   File "worker.py", line 1, in capture_model',
        "... [日志节选：下行起原行号 L4] ...",
        "(EngineCore_DP0 pid=101) ERROR 11-22 20:00:05 [core.py:1366] torch.OutOfMemoryError: NPU out of memory",
      ].join("\n"),
    );
    expect(shortGapOomFrame.findings.find((f) => f.ruleId === "oom-stage-split")?.title).not.toContain(
      "图捕获",
    );

    const shortGapUnscopedEl0004 = analyzeTroubleshootInput(
      [
        "ERROR NPU out of memory",
        "... [日志节选：下行起原行号 L4] ...",
        "ERROR EL0004: Failed to allocate memory.",
      ].join("\n"),
    );
    expect(shortGapUnscopedEl0004.findings.map((f) => f.ruleId)).toContain("cann-driver-or-device-env-fault");

    // 2. Strict traceback continuation state machine resets immediately on non-traceback unindented lines
    const finishedTbThenInfoCuda = analyzeTroubleshootInput(
      [
        "[node-P] [Rank 0] NPU Traceback (most recent call last):",
        "INFO worker restarted",
        "torch.cuda.OutOfMemoryError: CUDA out of memory",
      ].join("\n"),
    );
    expect(finishedTbThenInfoCuda.firstFaultVerdict.rank).toBeNull();
    expect(finishedTbThenInfoCuda.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");

    const prefixedInfoBreaksTb = analyzeTroubleshootInput(
      [
        "(Worker_TP0 pid=52010) ERROR 11-24 11:02:15 [core.py:1366] Traceback (most recent call last):",
        "(Worker_TP0 pid=52010) INFO 11-24 11:02:15 [worker.py:700] worker restarted",
        "torch.cuda.OutOfMemoryError: CUDA out of memory",
      ].join("\n"),
    );
    expect(prefixedInfoBreaksTb.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");

    const chainedCausedByTb = analyzeTroubleshootInput(
      [
        "[Rank 2] NPU Traceback (most recent call last):",
        '  File "a.py", line 1, in foo',
        "During handling of the above exception, another exception occurred:",
        "Caused by: NPU runtime failure",
        "torch.cuda.OutOfMemoryError: CUDA out of memory",
      ].join("\n"),
    );
    expect(chainedCausedByTb.firstFaultVerdict.rank).toBe(2);
    expect(chainedCausedByTb.findings.map((f) => f.ruleId)).toContain("oom-stage-split");

    // 3. Full causal-domain scoping on PID maps (instanceTag & groupTag isolation)
    const pidAcrossInstances = analyzeTroubleshootInput(
      [
        "[node-P] instance=blue [Rank 0] pid=101 NPU initialized",
        "[node-P] instance=green pid=101 RuntimeError: unrelated failure",
      ].join("\n"),
    );
    expect(pidAcrossInstances.firstFaultVerdict.rank).toBeNull();

    const pidAcrossGroups = analyzeTroubleshootInput(
      [
        "[node-P] group=tp-blue [Rank 0] pid=101 NPU initialized",
        "[node-P] group=tp-green pid=101 RuntimeError: unrelated failure",
      ].join("\n"),
    );
    expect(pidAcrossGroups.firstFaultVerdict.rank).toBeNull();

    const pidSameInstance = analyzeTroubleshootInput(
      [
        "[node-P] instance=blue [Rank 0] pid=101 NPU initialized",
        "[node-P] instance=blue pid=101 RuntimeError: instance failure",
      ].join("\n"),
    );
    expect(pidSameInstance.firstFaultVerdict.rank).toBe(0);

    // 4. ISO-8601 Z, sub-second precision, and timezone offsets
    const utcFracTs = extractTimestamp("2026-01-01T10:00:01.900Z ERROR worker");
    expect(utcFracTs.timestamp).toBe("2026-01-01T10:00:01.900Z");
    expect(utcFracTs.timestampMs).toBe(Date.UTC(2026, 0, 1, 10, 0, 1, 900));

    const utcWholeSecTs = extractTimestamp("2026-01-01T10:00:01Z ERROR worker");
    expect(utcWholeSecTs.timestamp).toBe("2026-01-01T10:00:01Z");
    expect(utcWholeSecTs.timestampMs).toBe(Date.UTC(2026, 0, 1, 10, 0, 1, 0));

    const tzOffsetTs = extractTimestamp("2026-01-01T10:00:01.100+08:00 ERROR worker");
    expect(tzOffsetTs.timestamp).toBe("2026-01-01T10:00:01.100+08:00");
    expect(tzOffsetTs.timestampMs).toBe(Date.UTC(2026, 0, 1, 2, 0, 1, 100));

    const utcSubSecOrder = analyzeTroubleshootInput(
      [
        "2026-01-01T10:00:01.900Z [Rank 2] RuntimeError: worker stopped",
        "2026-01-01T10:00:01.100Z [Rank 1] RuntimeError: worker stopped",
      ].join("\n"),
    );
    expect(utcSubSecOrder.firstFaultVerdict.rank).toBe(1);
    expect(utcSubSecOrder.firstFaultVerdict.confidence).toBe("high");

    const utcWholeVsOffset = analyzeTroubleshootInput(
      [
        "2026-01-01T10:00:01Z [Rank 2] RuntimeError: worker stopped",
        "2026-01-01T10:00:01.100+08:00 [Rank 1] RuntimeError: worker stopped",
      ].join("\n"),
    );
    expect(utcWholeVsOffset.firstFaultVerdict.rank).toBe(1);
    expect(utcWholeVsOffset.firstFaultVerdict.confidence).toBe("high");

    // 5. Verdict confidence vs earlier unranked primaries & multi-instance identical rank
    const earlierUnrankedPrimary = analyzeTroubleshootInput(
      ["09:00:00 RuntimeError: worker stopped", "10:00:00 [Rank 3] RuntimeError: worker stopped"].join("\n"),
    );
    expect(earlierUnrankedPrimary.firstFaultVerdict.rank).toBeNull();
    expect(earlierUnrankedPrimary.firstFaultVerdict.confidence).toBe("medium");

    const untimestampedUnrankedPrimary = analyzeTroubleshootInput(
      ["RuntimeError: worker stopped", "10:00:00 [Rank 3] RuntimeError: worker stopped"].join("\n"),
    );
    expect(untimestampedUnrankedPrimary.firstFaultVerdict.rank).toBe(3);
    expect(untimestampedUnrankedPrimary.firstFaultVerdict.confidence).toBe("medium");

    const laterUnrankedPrimary = analyzeTroubleshootInput(
      ["10:00:00 [Rank 3] RuntimeError: worker stopped", "10:00:05 RuntimeError: api wrapper"].join("\n"),
    );
    expect(laterUnrankedPrimary.firstFaultVerdict.rank).toBe(3);
    expect(laterUnrankedPrimary.firstFaultVerdict.confidence).toBe("high");

    const multiInstanceSameRankMixedTs = analyzeTroubleshootInput(
      [
        "10:00:00 instance=green [Rank 0] RuntimeError: green stopped",
        "instance=blue [Rank 0] RuntimeError: blue stopped",
      ].join("\n"),
    );
    expect(multiInstanceSameRankMixedTs.firstFaultVerdict.rank).toBe(0);
    expect(multiInstanceSameRankMixedTs.firstFaultVerdict.confidence).toBe("medium");

    // 6. Chronological stage progression in classifyNpuOomStage
    const startupCompleteSupersedesLoad = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] INFO Starting load_model()",
        "10:00:10 [Rank 0] INFO Application startup complete",
        "10:00:11 [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    const startupCompleteCard = startupCompleteSupersedesLoad.findings.find(
      (f) => f.ruleId === "oom-stage-split",
    );
    expect(startupCompleteCard?.title).toContain("运行期请求执行");
    expect(startupCompleteCard?.title).not.toContain("冷启动");

    const apiServerStartupCompleteSupersedesLoad = analyzeTroubleshootInput(
      [
        "10:00:00 (Worker_TP0 pid=1001) INFO Starting load_model()",
        "10:00:10 (APIServer pid=1000) INFO Application startup complete.",
        "10:00:11 (Worker_TP0 pid=1001) ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(
      apiServerStartupCompleteSupersedesLoad.findings.find((f) => f.ruleId === "oom-stage-split")?.title,
    ).toContain("运行期请求执行");

    const kvAllocSupersedesLoad = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] INFO Starting load_model()",
        "10:00:05 [Rank 0] INFO Available KV cache memory: 40.00 GiB",
        "10:00:11 [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(kvAllocSupersedesLoad.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain(
      "KV Cache 物理块分配期",
    );
    expect(kvAllocSupersedesLoad.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("device-init");

    const captureWarmupSupersedesKvBudget = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] INFO Available KV cache memory: 40.00 GiB",
        "10:00:06 [Rank 0] INFO Entering compile_or_warm_up_model",
        "10:00:11 [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(
      captureWarmupSupersedesKvBudget.findings.find((f) => f.ruleId === "oom-stage-split")?.title,
    ).toContain("图捕获");
    expect(captureWarmupSupersedesKvBudget.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe(
      "graph-compile",
    );

    const reversedStartupComplete = analyzeTroubleshootInput(
      [
        "10:00:11 [Rank 0] ERROR NPU out of memory",
        "10:00:10 [Rank 0] INFO Application startup complete",
        "10:00:00 [Rank 0] INFO Starting load_model()",
      ].join("\n"),
    );
    expect(reversedStartupComplete.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain(
      "运行期请求执行",
    );

    // 7. FaultTimelineEvent.phase matches OOM diagnosis stage
    const capturePhaseOom = analyzeTroubleshootInput(
      "10:00:11 [Rank 0] ERROR NPU out of memory in capture_model()",
    );
    expect(capturePhaseOom.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain("图捕获");
    expect(capturePhaseOom.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("graph-compile");

    const coldStartPhaseOom = analyzeTroubleshootInput(
      "10:00:11 [Rank 1] ERROR NPU out of memory during load_weights",
    );
    expect(coldStartPhaseOom.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain("冷启动");
    expect(coldStartPhaseOom.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("device-init");

    const runtimePhaseOom = analyzeTroubleshootInput(
      "10:00:11 [Rank 0] ERROR NPU out of memory during decode",
    );
    expect(runtimePhaseOom.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain(
      "运行期请求执行",
    );
    expect(runtimePhaseOom.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("runtime");
  });

  it("adversarial round-2 closure part 1: signal taxonomy, rank priority, EI0006 pairing, and multi-clock normalization", () => {
    // Findings 1 & 2: PascalCase Python exceptions on INFO lines & generic ERROR unmatched fallback; global_rank > local_rank
    const infoPyExc = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 1] INFO ValueError: unsupported precision config",
        "10:00:01 [Rank 2] ERROR RuntimeError: worker abort",
      ].join("\n"),
    );
    expect(infoPyExc.firstFaultVerdict.rank).toBe(1);
    expect(infoPyExc.firstFaultVerdict.timelineEvents?.[0]?.rank).toBe(1);

    const genericTypeAndError = analyzeTroubleshootInput(
      [
        "2026-01-01 10:00:00 [Rank 1] TypeError: unexpected keyword argument",
        "2026-01-01 10:00:01 [Rank 2] RuntimeError: late wrapper failure",
      ].join("\n"),
    );
    expect(genericTypeAndError.firstFaultVerdict.rank).toBe(1);

    const genericErrorFallback = analyzeTroubleshootInput(
      "2026-01-01 10:00:00 [Rank 0] ERROR custom subsystem initialization failed unexpectedly",
    );
    expect(genericErrorFallback.firstFaultVerdict.rank).toBe(0);
    expect(genericErrorFallback.unmatchedErrorLines).toHaveLength(1);

    const globalVsLocalRank = analyzeTroubleshootInput(
      "2026-01-01 10:00:00 local_rank=0 global_rank=8 RuntimeError: distributed rank error",
    );
    expect(globalVsLocalRank.firstFaultVerdict.rank).toBe(8);
    expect(globalVsLocalRank.firstFaultVerdict.rankSource).toBe("explicit-rank");

    // Findings 3, 14, 15, 16, 17: EI0006/LinkEstablish inheritance, primary protection, bare EI0006, and EI0002 + config
    const splitEi0006Inherit = analyzeTroubleshootInput(
      [
        "10:00:01 instance=blue [Rank 2] ERROR EI0006: connect failed",
        "ERROR [Wait][LinkEstablish] Getting socket times out",
        "10:00:00 instance=red [Rank 0] ERROR RuntimeError: worker failure",
      ].join("\n"),
    );
    const linkCard = splitEi0006Inherit.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault");
    expect(linkCard).toBeDefined();
    expect(linkCard?.matchedLines.some((m) => m.lineNumber === 2 && m.rank === 2)).toBe(true);
    expect(linkCard?.matchedLines.some((m) => m.lineNumber === 2 && m.timestamp === "10:00:01")).toBe(true);
    expect(splitEi0006Inherit.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");
    expect(splitEi0006Inherit.firstFaultVerdict.cascadeRanks).toEqual([]);

    const oomPlusEi0006NotStolen = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] ERROR NPU out of memory; EI0006: Wait timeout",
        "10:00:01 [Rank 1] ERROR [Wait][LinkEstablish] Getting socket times out",
      ].join("\n"),
    );
    expect(oomPlusEi0006NotStolen.firstFaultVerdict.rank).toBe(0);
    expect(oomPlusEi0006NotStolen.findings.map((f) => f.ruleId)).toContain("oom-stage-split");
    expect(
      oomPlusEi0006NotStolen.firstFaultVerdict.timelineEvents?.find((e) => e.lineNumber === 2)?.rank,
    ).toBe(1);

    const bareEi0006Link = analyzeTroubleshootInput("10:00:00 [Rank 2] ERROR EI0006: connect failed");
    expect(bareEi0006Link.findings.map((f) => f.ruleId)).toEqual(["hccl-timeout-cascade"]);
    expect(bareEi0006Link.firstFaultVerdict.rank).toBeNull();
    expect(bareEi0006Link.firstFaultVerdict.timelineEvents?.[0]?.signalTag).toBe("HCCL EI0006");
    expect(bareEi0006Link.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("link-establish");

    const ei0002WithExecTimeout = analyzeTroubleshootInput(
      "10:00:00 [Rank 0] ERROR EI0002 Notify wait execute timeout; HCCL_EXEC_TIMEOUT=1800",
    );
    expect(ei0002WithExecTimeout.findings.map((f) => f.ruleId)).toContain("hccl-timeout-cascade");

    // Findings 4, 5, 6: Clock tiers, timezone comparability, unique-year binding, sub-ms order, header vs body timestamp
    const fullVsTimeOnly = analyzeTroubleshootInput(
      [
        "2026-01-01 10:00:00 [Rank 2] RuntimeError: full ts",
        "09:00:00 [Rank 1] RuntimeError: time-only ts",
      ].join("\n"),
    );
    expect(fullVsTimeOnly.firstFaultVerdict.confidence).toBe("medium");

    const naiveVsOffset = analyzeTroubleshootInput(
      [
        "2026-01-01T10:00:00 [Rank 2] RuntimeError: naive",
        "2026-01-01T09:59:59+08:00 [Rank 1] RuntimeError: tz",
      ].join("\n"),
    );
    expect(naiveVsOffset.firstFaultVerdict.confidence).toBe("medium");

    const uniqueYearShortDate = analyzeTroubleshootInput(
      [
        "2026-01-01 10:00:05 [Rank 2] RuntimeError: full",
        "01-01 10:00:01 [Rank 1] RuntimeError: short earlier",
      ].join("\n"),
    );
    expect(uniqueYearShortDate.firstFaultVerdict.rank).toBe(1);
    expect(uniqueYearShortDate.firstFaultVerdict.confidence).toBe("high");

    const nanoSubMsOrder = analyzeTroubleshootInput(
      [
        "2026-01-01T10:00:01.123456789Z [Rank 2] RuntimeError: later nanosecond",
        "2026-01-01T10:00:01.123456788Z [Rank 1] RuntimeError: earlier nanosecond",
      ].join("\n"),
    );
    expect(nanoSubMsOrder.firstFaultVerdict.rank).toBe(1);
    expect(nanoSubMsOrder.firstFaultVerdict.confidence).toBe("high");

    const headerBeforeBodySinceTs = analyzeTroubleshootInput(
      [
        "2026-04-12 10:00:01 [Rank 1] RuntimeError: failed since 2025-01-01 00:00:00",
        "2026-04-12 10:00:00 [Rank 0] RuntimeError: true first fault",
      ].join("\n"),
    );
    expect(
      extractTimestamp("2026-04-12 10:00:01 [Rank 1] RuntimeError: failed since 2025-01-01 00:00:00")
        .timestamp,
    ).toBe("2026-04-12 10:00:01");
    expect(headerBeforeBodySinceTs.firstFaultVerdict.rank).toBe(0);

    // Findings 7, 8, 9: Traceback termination, timestamp/rank preservation, and chained exceptions
    const indentedInfoEndsTb = analyzeTroubleshootInput(
      [
        "[Rank 2] Traceback (most recent call last):",
        "   INFO restarted",
        "torch.cuda.OutOfMemoryError: CUDA out of memory",
      ].join("\n"),
    );
    expect(indentedInfoEndsTb.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");

    const prefixedErrorNonContEndsTb = analyzeTroubleshootInput(
      [
        "[Rank 2] ERROR Traceback (most recent call last):",
        "[Rank 2] ERROR  worker restarted",
        "torch.cuda.OutOfMemoryError: CUDA out of memory",
      ].join("\n"),
    );
    expect(prefixedErrorNonContEndsTb.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");

    const prefixedTerminalInheritsTs = analyzeTroubleshootInput(
      [
        "(Worker_TP2 pid=200) ERROR 10:00:01 Traceback (most recent call last):",
        "(Worker_TP2 pid=200) ERROR torch.OutOfMemoryError: NPU out of memory",
      ].join("\n"),
    );
    expect(prefixedTerminalInheritsTs.firstFaultVerdict.rank).toBe(2);
    expect(prefixedTerminalInheritsTs.firstFaultVerdict.timelineEvents?.[0]?.timestamp).toBe("10:00:01");

    const unprefixedNpuOomKeepsTbRank = analyzeTroubleshootInput(
      [
        "[Rank 3] NPU Traceback (most recent call last):",
        '  File "runner.py", line 10, in step',
        "torch.OutOfMemoryError: NPU out of memory (NPU 0; 64.00 GiB total)",
      ].join("\n"),
    );
    expect(unprefixedNpuOomKeepsTbRank.firstFaultVerdict.rank).toBe(3);
    expect(unprefixedNpuOomKeepsTbRank.firstFaultVerdict.rankSource).toBe("explicit-rank");

    const realChainedExceptionAfterTerminal = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 2] Traceback (most recent call last):",
        '  File "a.py", line 1, in foo',
        "ValueError: initial failure",
        "",
        "During handling of the above exception, another exception occurred:",
        "",
        "Traceback (most recent call last):",
        '  File "b.py", line 2, in bar',
        "RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    expect(realChainedExceptionAfterTerminal.firstFaultVerdict.rank).toBe(2);
    expect(realChainedExceptionAfterTerminal.findings.map((f) => f.ruleId)).toContain("oom-stage-split");
  });

  it("adversarial round-2 closure part 2: causal-domain isolation, verdict/R3 causality, OOM stage invariants, benign gating, and scale", () => {
    // Findings 10, 11, 12, 13: host= syntax, "No route to host", per-PID scoping, cross-host NPU leakage, instance-scoped visibleDevices
    const hostEqIsolation = analyzeTroubleshootInput(
      [
        "10:00:00 host=a [Rank 0] pid=101 NPU initialized",
        "10:00:01 host=b pid=101 RuntimeError: isolated host b failure",
      ].join("\n"),
    );
    expect(hostEqIsolation.firstFaultVerdict.rank).toBeNull();

    const noRouteHostPhrase = analyzeTroubleshootInput(
      "10:00:00 [Rank 0] ERROR RaSocketConnect failed: No route to host: peer unreachable",
    );
    expect(noRouteHostPhrase.firstFaultVerdict.hostTag).toBeNull();
    expect(noRouteHostPhrase.firstFaultVerdict.slotMappable).toBe(true);

    const perPidScopingMaintained = analyzeTroubleshootInput(
      [
        "[node-a] [Rank 2] pid=7 NPU initialized",
        "[node-b] instance=green [Rank 5] pid=7 NPU initialized",
        "[node-a] pid=7 RuntimeError: boom",
      ].join("\n"),
    );
    expect(perPidScopingMaintained.firstFaultVerdict.rank).toBe(2);

    const conflictingRanksOnPidDoNotLeak = analyzeTroubleshootInput(
      [
        "[Rank 1] pid=8 worker init",
        "[Rank 2] pid=8 worker init",
        "[node-b] pid=8 OutOfMemoryError: NPU out of memory",
      ].join("\n"),
    );
    expect(conflictingRanksOnPidDoNotLeak.firstFaultVerdict.rank).toBeNull();

    const crossHostNpuContextDoesNotConvertCuda = analyzeTroubleshootInput(
      [
        "10:00:00 [node-a] pid=7 INFO NPU allocator warmup",
        "10:00:01 [node-b] pid=7 ERROR OutOfMemoryError: CUDA out of memory",
      ].join("\n"),
    );
    expect(crossHostNpuContextDoesNotConvertCuda.findings.map((f) => f.ruleId)).not.toContain(
      "oom-stage-split",
    );

    const instanceScopedVisibleDevices = analyzeTroubleshootInput(
      [
        "instance=a ASCEND_RT_VISIBLE_DEVICES=4",
        "instance=b ASCEND_RT_VISIBLE_DEVICES=0",
        "instance=a [Rank 0] RuntimeError: instance a error",
      ].join("\n"),
    );
    expect(instanceScopedVisibleDevices.visibleDevices).toEqual([4]);
    expect(instanceScopedVisibleDevices.firstFaultVerdict.slotMappable).toBe(true);
    expect(
      extractVisibleDevicesFromLog(
        "instance=a ASCEND_RT_VISIBLE_DEVICES=4\ninstance=b ASCEND_RT_VISIBLE_DEVICES=0",
      ),
    ).toBeNull();

    // Findings 18, 19, 20, 21: tied primaries, earlier same-rank timeout, R3 independent of R17, R3 with unranked primary
    const tiedPrimariesNoPeerRank = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] ERROR RuntimeError: a",
        "10:00:00 [Rank 1] ERROR RuntimeError: b",
        "10:00:05 [Rank 2] ERROR EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(tiedPrimariesNoPeerRank.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");
    expect(tiedPrimariesNoPeerRank.firstFaultVerdict.cascadeRanks).toEqual([]);

    const earlierSameRankTimeout = analyzeTroubleshootInput(
      [
        "09:59:59 [Rank 0] ERROR EI0002 Notify wait execute timeout",
        "10:00:00 [Rank 0] ERROR RuntimeError: late fault",
      ].join("\n"),
    );
    expect(earlierSameRankTimeout.firstFaultVerdict.cascadeCausalState).toBe("earlier-than-primary");
    expect(earlierSameRankTimeout.firstFaultVerdict.confidence).toBe("medium");
    expect(earlierSameRankTimeout.findings.find((f) => f.ruleId === "hccl-timeout-cascade")?.title).toContain(
      "早于 Rank 0",
    );

    const r3DoesNotBorrowR17Confirmation = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] ERROR RuntimeError: oom",
        "10:00:02 [Rank 2] ERROR EI0006 Getting socket times out",
        "ERROR [Rank 1] EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    const r3Independent = r3DoesNotBorrowR17Confirmation.findings.find(
      (f) => f.ruleId === "hccl-timeout-cascade",
    );
    expect(r3Independent?.evidenceLevel).toBe("I");
    expect(r3Independent?.title).toContain("待核实");
    expect(r3Independent?.title).not.toContain("连锁超时");

    const r3WithUnrankedPrimary = analyzeTroubleshootInput(
      [
        "10:00:00 ERROR RuntimeError: NPU out of memory",
        "10:00:01 [Rank 1] ERROR EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    const r3UnrankedCard = r3WithUnrankedPrimary.findings.find((f) => f.ruleId === "hccl-timeout-cascade");
    expect(r3UnrankedCard?.title).toContain("伴随未标注 Rank 主报错");
    expect(r3UnrankedCard?.title).not.toContain("尚未见单卡主报错");

    // Findings 22, 23, 24, 25, 26, 27: OOM reset boundaries, untimestamped APIServer milestone, future startup, distant EL0004, multi-phase timeline
    const interveningValueErrorBreaksCaptureFrame = analyzeTroubleshootInput(
      [
        '10:00:00 [Rank 0] ERROR   File "worker.py", line 10, in capture_model',
        "10:00:00 [Rank 0] ERROR ValueError: stale capture failure",
        "10:00:15 [Rank 0] ERROR torch.OutOfMemoryError: NPU out of memory",
      ].join("\n"),
    );
    const brokenCaptureOomTitle = interveningValueErrorBreaksCaptureFrame.findings.find(
      (f) => f.ruleId === "oom-stage-split",
    )?.title;
    expect(brokenCaptureOomTitle).toContain("缺少阶段里程碑");
    expect(brokenCaptureOomTitle).not.toContain("图捕获");

    const crossRankKvMilestoneDoesNotBleed = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] INFO Available KV cache memory: 40.00 GiB",
        "10:00:02 [Rank 1] ERROR torch.OutOfMemoryError: NPU out of memory",
      ].join("\n"),
    );
    expect(
      crossRankKvMilestoneDoesNotBleed.findings.find((f) => f.ruleId === "oom-stage-split")?.title,
    ).not.toContain("图捕获");

    const untimestampedApiServerStartupSupersedesLoad = analyzeTroubleshootInput(
      [
        "10:00:00 instance=green [Rank 0] INFO Starting load_model()",
        "(APIServer pid=8) INFO: Application startup complete.",
        "10:00:11 instance=green [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(
      untimestampedApiServerStartupSupersedesLoad.findings.find((f) => f.ruleId === "oom-stage-split")?.title,
    ).toContain("运行期请求执行");

    const pidDomainBlocksWrongInstanceApiMilestone = analyzeTroubleshootInput(
      [
        "10:00:00 instance=green pid=8 INFO worker boot",
        "(APIServer pid=8) INFO: Available KV cache memory: 40.00 GiB",
        "10:00:05 instance=blue [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(
      pidDomainBlocksWrongInstanceApiMilestone.findings.find((f) => f.ruleId === "oom-stage-split")?.title,
    ).not.toContain("图捕获");

    const futureStartupDoesNotSuppressEarlierColdStart = analyzeTroubleshootInput(
      [
        "10:00:01 [Rank 0] INFO Starting load_model()",
        "10:00:03 [Rank 1] ERROR NPU out of memory",
        "10:00:20 [Rank 0] INFO Application startup complete",
      ].join("\n"),
    );
    expect(
      futureStartupDoesNotSuppressEarlierColdStart.findings.find((f) => f.ruleId === "oom-stage-split")
        ?.title,
    ).toContain("冷启动");

    const distantMarchEl0004NotSuppressedByJanOom = analyzeTroubleshootInput(
      [
        "2026-01-01 10:00:00 [Rank 0] ERROR NPU out of memory",
        "2026-03-01 10:00:00 ERROR EL0004: Failed to allocate memory.",
      ].join("\n"),
    );
    expect(distantMarchEl0004NotSuppressedByJanOom.findings.map((f) => f.ruleId)).toEqual(
      expect.arrayContaining(["oom-stage-split", "cann-driver-or-device-env-fault"]),
    );

    const sameRankDistinctOomPhasesRetained = analyzeTroubleshootInput(
      [
        "10:00:01 [Rank 0] ERROR NPU out of memory during load_weights",
        "10:00:15 [Rank 0] INFO Application startup complete",
        "10:00:20 [Rank 0] ERROR NPU out of memory during decode",
      ].join("\n"),
    );
    expect(sameRankDistinctOomPhasesRetained.firstFaultVerdict.timelineEvents?.map((e) => e.phase)).toEqual([
      "device-init",
      "runtime",
    ]);

    const multiInstanceCapRetainsDistinctInstances = analyzeTroubleshootInput(
      Array.from(
        { length: 18 },
        (_, idx) =>
          `10:00:${String(idx).padStart(2, "0")} instance=inst-${idx} [Rank 0] ERROR RuntimeError: fail ${idx}`,
      ).join("\n"),
    );
    expect(multiInstanceCapRetainsDistinctInstances.firstFaultVerdict.timelineEvents).toHaveLength(16);

    // Findings 28, 29, 30, 31: Benign info gating, CUDA OOM exclusion, Aicore kernel execute failed, 4k OOM line perf
    const benignInfoLines = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] INFO stats OutOfMemoryError=0 OOMKilled=false",
        "10:00:01 [Rank 0] INFO installed SIGSEGV handler successfully",
        "10:00:02 [Rank 0] INFO using AscendModelSlimConfig310 config loaded",
        "10:00:03 [Rank 0] INFO FRACTAL_NZ mode is enabled",
      ].join("\n"),
    );
    expect(benignInfoLines.findings).toHaveLength(0);
    expect(benignInfoLines.firstFaultVerdict.rank).toBeNull();

    const standaloneCudaOom = analyzeTroubleshootInput("10:00:00 [Rank 0] ERROR CUDA error: out of memory");
    expect(standaloneCudaOom.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");

    const aicoreKernelExecFailed = analyzeTroubleshootInput(
      "10:00:00 [Rank 0] ERROR Aicore kernel execute failed",
    );
    expect(aicoreKernelExecFailed.findings.map((f) => f.ruleId)).toContain("cann-opapi-or-aclnn-fault");

    const largeOomLog = Array.from(
      { length: 4096 },
      (_, idx) => `10:00:${String(idx % 60).padStart(2, "0")} [Rank 0] ERROR NPU out of memory`,
    ).join("\n");
    const t0 = performance.now();
    const largeReport = analyzeTroubleshootInput(largeOomLog);
    const elapsedMs = performance.now() - t0;
    expect(largeReport.findings.map((f) => f.ruleId)).toContain("oom-stage-split");
    expect(elapsedMs).toBeLessThan(2000);
  });

  it("adversarial round-3 closure part 1: P1s (1-4) and P2s (1-20) across severity, peerRank, PID/devices, clocks, and tracebacks", () => {
    // P1 #1: VLLM_LOGGING_LEVEL=ERROR on INFO line never wins first fault
    const loggingLevelSetting = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] INFO VLLM_LOGGING_LEVEL=ERROR",
        "10:00:01 [Rank 3] ERROR NPU out of memory",
        "10:00:02 [Rank 2] EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(loggingLevelSetting.firstFaultVerdict.rank).toBe(3);
    expect(loggingLevelSetting.findings.find((f) => f.ruleId === "hccl-timeout-cascade")?.title).toContain(
      "Rank 3",
    );

    // P1 #2: Split EI0006 retains peerRank from header
    const splitPeerInherit = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] RuntimeError: boom",
        "10:00:01 [Rank 1] EI0006 waiting for rank 7",
        "[Wait][LinkEstablish] Getting socket times out",
      ].join("\n"),
    );
    const splitEvt = splitPeerInherit.firstFaultVerdict.timelineEvents?.find((e) => e.lineNumber === 3);
    expect(splitEvt?.rank).toBe(1);
    expect(splitEvt?.peerRank).toBe(7);
    expect(splitEvt?.kind).toBe("unattributed-cascade");
    expect(splitPeerInherit.firstFaultVerdict.cascadeRanks).toEqual([]);

    // P1 #3: peerRank cannot bypass multi-instance tie on identical rank
    const tiedMultiInstPeer = analyzeTroubleshootInput(
      [
        "10:00:00 instance=a [Rank 0] RuntimeError: crash",
        "10:00:00 instance=b [Rank 0] RuntimeError: crash",
        "10:00:01 [Rank 1] EI0002 waiting for rank 0",
      ].join("\n"),
    );
    expect(tiedMultiInstPeer.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");
    expect(tiedMultiInstPeer.firstFaultVerdict.cascadeRanks).toEqual([]);
    expect(tiedMultiInstPeer.findings.find((f) => f.ruleId === "hccl-timeout-cascade")?.evidenceLevel).toBe(
      "I",
    );

    // P1 #4: PID-scoped ASCEND_RT_VISIBLE_DEVICES
    const pidVisibleDevices = analyzeTroubleshootInput(
      [
        "pid=10 ASCEND_RT_VISIBLE_DEVICES=4",
        "pid=11 ASCEND_RT_VISIBLE_DEVICES=7",
        "pid=10 [Rank 0] RuntimeError: crash",
      ].join("\n"),
    );
    expect(pidVisibleDevices.visibleDevices).toEqual([4]);
    expect(pidVisibleDevices.firstFaultVerdict.slotMappable).toBe(true);
    expect(pidVisibleDevices.firstFaultVerdict.confidence).toBe("high");

    // P2 #1-#8: KeyError: 0 / bare AssertionError / : None / error=0 / errno=0 / quoted traceback / indented ERROR / CPU & HIP OOM / exit 137 + OOMKilled=false
    const keyErrAndAssert = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 3] Traceback (most recent call last):",
        "KeyError: 0",
        "10:00:01 [Rank 1] RuntimeError: wrapper",
      ].join("\n"),
    );
    expect(keyErrAndAssert.firstFaultVerdict.rank).toBe(3);

    const bareAssertTb = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 3] Traceback (most recent call last):",
        "AssertionError",
        "10:00:01 [Rank 1] RuntimeError: wrapper",
      ].join("\n"),
    );
    expect(bareAssertTb.firstFaultVerdict.rank).toBe(3);

    expect(
      analyzeTroubleshootInput("[Rank 1] INFO health RuntimeError: None").firstFaultVerdict.timelineEvents,
    ).toEqual([]);
    expect(analyzeTroubleshootInput("[Rank 1] INFO health OutOfMemoryError: None").findings).toEqual([]);
    expect(analyzeTroubleshootInput("[Rank 0] INFO health EI0006 count=0 error=0").findings).toEqual([]);

    const typeErrErrnoZero = analyzeTroubleshootInput(
      ["10:00:00 [Rank 0] TypeError: bad value (errno=0)", "10:00:01 [Rank 3] RuntimeError: later"].join(
        "\n",
      ),
    );
    expect(typeErrErrnoZero.firstFaultVerdict.rank).toBe(0);

    const quotedSourceInTb = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] ERROR Traceback (most recent call last):",
        '  File "w.py", line 1, in log',
        '    message = messages["NPU out of memory"]',
        "NameError: name 'messages' is not defined",
      ].join("\n"),
    );
    expect(quotedSourceInTb.findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");
    expect(quotedSourceInTb.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(4);

    const indentedErrorHeader = analyzeTroubleshootInput(
      [
        "  10:00:00 [Rank 0] ERROR worker bootstrap aborted",
        "10:00:01 [Rank 3] RuntimeError: worker abort",
      ].join("\n"),
    );
    expect(indentedErrorHeader.firstFaultVerdict.rank).toBe(0);

    for (const nonNpu of [
      "[Rank 1] torch.OutOfMemoryError: CPU allocator out of memory",
      "[Rank 1] torch.OutOfMemoryError: HIP out of memory",
    ]) {
      expect(analyzeTroubleshootInput(nonNpu).findings.map((f) => f.ruleId)).not.toContain("oom-stage-split");
    }

    const exit137WithFalseFlag = analyzeTroubleshootInput(
      "[Rank 2] INFO container exited with exit code 137 OOMKilled=false",
    );
    expect(exit137WithFalseFlag.findings.map((f) => f.ruleId)).toContain("exit-137-sigkill");

    // P2 #9-#20: peer [rank7], rank=8 tp_rank=0, heartbeat PID, host propagation, timeline slotMappable on visible ambiguity, host normalization, clocks, traceback continuity
    const peerBracketNoSpace = analyzeTroubleshootInput(
      "10:00:00 ERROR RaSocketConnect failed: Connection refused by peer [rank7]",
    );
    expect(peerBracketNoSpace.firstFaultVerdict.rank).toBeNull();
    expect(peerBracketNoSpace.firstFaultVerdict.timelineEvents?.[0]?.peerRank).toBe(7);

    const explicitOverTpRank = analyzeTroubleshootInput(
      "(Worker_TP0 pid=42) rank=8 tp_rank=0 RuntimeError: worker aborted",
    );
    expect(explicitOverTpRank.firstFaultVerdict.rank).toBe(8);
    expect(explicitOverTpRank.firstFaultVerdict.rankSource).toBe("explicit-rank");

    const metadataFreeHeartbeat = analyzeTroubleshootInput(
      [
        "[Rank 0] pid=42 host=a INFO ready",
        "pid=42 INFO heartbeat",
        "pid=42 host=a RuntimeError: crash",
      ].join("\n"),
    );
    expect(metadataFreeHeartbeat.firstFaultVerdict.rank).toBe(0);

    const hostPropagatedOnPidDomain = analyzeTroubleshootInput(
      [
        "host=a pid=8 INFO worker boot",
        "10:00:01 host=b [Rank 0] INFO Starting load_model()",
        "(APIServer pid=8) INFO Application startup complete.",
        "10:00:05 host=b [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(hostPropagatedOnPidDomain.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain(
      "冷启动",
    );

    const cascadeTimelineVisibleAmbiguity = analyzeTroubleshootInput(
      [
        "instance=a ASCEND_RT_VISIBLE_DEVICES=4",
        "instance=b ASCEND_RT_VISIBLE_DEVICES=7",
        "10:00:00 [Rank 0] EI0002",
      ].join("\n"),
    );
    expect(cascadeTimelineVisibleAmbiguity.visibleDevices).toBeNull();
    expect(cascadeTimelineVisibleAmbiguity.firstFaultVerdict.timelineEvents?.[0]?.slotMappable).toBe(false);

    const normalizedHostFormats = analyzeTroubleshootInput(
      [
        "10:00:00 [host a] [Rank 0] RuntimeError: crash",
        "10:00:02 host=a [Rank 1] EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(normalizedHostFormats.firstFaultVerdict.cascadeCausalState).toBe("confirmed-after");
    expect(normalizedHostFormats.firstFaultVerdict.cascadeRanks).toEqual([1]);

    const shortDateHeaderBeforeBodyCheckpoint = analyzeTroubleshootInput(
      [
        "11-22 10:00:00 [Rank 2] ERROR bootstrap failed, last checkpoint=2025-11-21 09:00:00",
        "2025-11-22 09:59:59 [Rank 1] ERROR worker aborted",
      ].join("\n"),
    );
    expect(shortDateHeaderBeforeBodyCheckpoint.firstFaultVerdict.rank).toBe(1);

    const uniqueYearInheritedOnTbTerminal = analyzeTroubleshootInput(
      [
        "11-22 10:00:00 [Rank 2] Traceback (most recent call last):",
        "ValueError: original",
        "2025-11-22 10:00:01 [Rank 1] RuntimeError: wrapper",
      ].join("\n"),
    );
    expect(uniqueYearInheritedOnTbTerminal.firstFaultVerdict.rank).toBe(2);
    expect(uniqueYearInheritedOnTbTerminal.firstFaultVerdict.confidence).toBe("high");

    const colonRankLoggerPrefix = analyzeTroubleshootInput(
      [
        "10:00:00 [rank3]: Traceback (most recent call last):",
        "[rank3]: ValueError: original",
        "10:00:01 [rank1]: RuntimeError: wrapper",
      ].join("\n"),
    );
    expect(colonRankLoggerPrefix.firstFaultVerdict.rank).toBe(3);

    const sameRankWithoutPidCont = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 2] pid=8 ERROR Traceback (most recent call last):",
        "[Rank 2] ERROR ValueError: original",
        "10:00:01 [Rank 1] ERROR RuntimeError: wrapper",
      ].join("\n"),
    );
    expect(sameRankWithoutPidCont.firstFaultVerdict.rank).toBe(2);

    const embeddedRankInExceptionBody = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 2] Traceback (most recent call last):",
        "ValueError: invalid configuration for rank=4",
      ].join("\n"),
    );
    expect(embeddedRankInExceptionBody.firstFaultVerdict.rank).toBe(2);

    const prefixedChainMarker = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 2] Traceback (most recent call last):",
        "ValueError: original",
        "",
        "[Rank 2] During handling of the above exception, another exception occurred:",
        "",
        "Traceback (most recent call last):",
        "RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    const chainOom = prefixedChainMarker.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(chainOom?.matchedLines[0]?.rank).toBe(2);
    expect(chainOom?.matchedLines[0]?.timestamp).toBe("10:00:00");
  });

  it("enforces causal ordering, domain scoping, OOM reset/nanosecond precision, timeline parity, and O(N log N) scale (P2 #21-#39)", () => {
    // P2 #21: time-only timestamps >12h apart are incomparable -> unverified-order
    const midnightWrap = analyzeTroubleshootInput(
      [
        "23:59:59 [Rank 0] RuntimeError: driver init crashed",
        "00:00:01 [Rank 1] ERROR EI0002: Notify wait execute timeout, waiting for rank 0",
      ].join("\n"),
    );
    expect(midnightWrap.firstFaultVerdict?.cascadeCausalState).toBe("unverified-order");

    // P2 #22: non-cascade signal on a line mentioning EI0002 does not get classified into Rule 3 cascadeRanks
    const oomWithWaitMention = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] RuntimeError: weight load crashed",
        "10:00:01 [Rank 3] ERROR NPU out of memory; EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    const r3AfterOom = oomWithWaitMention.findings.find((f) => f.ruleId === "hccl-timeout-cascade");
    expect(r3AfterOom?.evidenceLevel).toBe("I");
    expect(oomWithWaitMention.firstFaultVerdict?.cascadeRanks).toEqual([]);

    // P2 #23: same-rank EI0002 cascade without an earlier peer cascade stays unverified-order and unattributed
    const sameRankWait = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 1] RuntimeError: rank 1 worker crashed",
        "10:00:01 [Rank 1] ERROR EI0002: Notify wait execute timeout",
      ].join("\n"),
    );
    expect(sameRankWait.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");
    expect(
      sameRankWait.firstFaultVerdict.timelineEvents?.some((ev) => ev.kind === "unattributed-cascade"),
    ).toBe(true);

    // P2 #24: EI0006 partner lookup must not treat primary ValueError body line as partner to [Rank 3] EI0006
    const ei0006PrimaryCollision = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 3] ERROR EI0006: HCCL link establishment error",
        "[Wait][LinkEstablish] Getting socket times out. ValueError: Free memory on device (1 GiB) on startup is less than desired",
      ].join("\n"),
    );
    const r1Startup = ei0006PrimaryCollision.findings.find((f) => f.ruleId === "pre-profile-free-memory");
    expect(r1Startup?.matchedLines[0]?.lineNumber).toBe(2);
    expect(r1Startup?.matchedLines[0]?.rank).toBeNull();
    expect(r1Startup?.matchedLines[0]?.timestamp).toBeNull();

    // P2 #25: generic CPU bfloat16 error must not trigger Ascend 310P/C8 SoC compat rule
    const cpuBf16 = analyzeTroubleshootInput("[Rank 0] ERROR bfloat16 not supported by CPU backend");
    expect(cpuBf16.findings.some((f) => f.ruleId === "soc-310p-or-c8-compat")).toBe(false);

    // P2 #26: cross-instance Rule 10 must not borrow weight_update specialization from a sibling instance
    const r10CrossInstance = analyzeTroubleshootInput(
      [
        "10:00:00 instance=a [Rank 0] ValueError: FRACTAL_NZ mode is enabled",
        "10:00:01 instance=b [Rank 1] RuntimeError: start_weight_update failed: HTTP 503",
      ].join("\n"),
    );
    const r10Finding = r10CrossInstance.findings.find((f) => f.ruleId === "sleep-mode-fractal-nz-wakeup");
    expect(r10Finding?.title).not.toContain("在线权重更新失败");

    // P2 #27 & #28: numeric error codes must not false-match inside pid= fields, while real aclnn/libopapi codes match
    const pidNumberMasking = analyzeTroubleshootInput(
      [
        "10:00:00 pid=161002 ERROR aclnnFoo failed",
        "10:00:01 pid=507008 ERROR /dev/davinci0: Permission denied",
      ].join("\n"),
    );
    expect(pidNumberMasking.findings.some((f) => f.ruleId === "cann-plog-aicore-fault")).toBe(false);
    const pidAclnn = pidNumberMasking.findings.find((f) => f.ruleId === "cann-opapi-or-aclnn-fault");
    expect(pidAclnn?.title).not.toContain("161002");
    const pidDavinci = pidNumberMasking.findings.find((f) => f.ruleId === "cann-driver-or-device-env-fault");
    expect(pidDavinci?.title).not.toContain("507008");

    const realAclnnCode = analyzeTroubleshootInput(
      "10:00:00 [Rank 0] ERROR libopapi.so: aclnnFoo failed, error code 161002",
    );
    const realAclnnFinding = realAclnnCode.findings.find((f) => f.ruleId === "cann-opapi-or-aclnn-fault");
    expect(realAclnnFinding?.title).toContain("161002");

    // P2 #29 & #30: EI0006 timeout with IFNAME stays timeout (not bind/EADDRNOTAVAIL), and cross-rank bind+port don't mix
    const ei0006IfnameTimeout = analyzeTroubleshootInput(
      "10:00:00 [Rank 0] ERROR EI0006: Getting socket times out HCCL_SOCKET_IFNAME=eth0",
    );
    const r17Timeout = ei0006IfnameTimeout.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault");
    expect(r17Timeout).toBeDefined();
    expect(r17Timeout?.title).toContain("超时");
    expect(r17Timeout?.title).not.toContain("绑定");

    const r17CrossRank = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] ERROR RaSocketBind failed ifname=eth1",
        "10:00:01 [Rank 1] ERROR RaSocketConnect ECONNREFUSED port=88",
      ].join("\n"),
    );
    const r17Finding = r17CrossRank.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault");
    expect(r17Finding?.title).not.toContain("接口 eth1 / 端口 88");

    // P2 #31: cross-date timestamps (>10min apart) must not falsely collapse Rule 20 into Ascend context of another month
    const crossMonthRule20 = analyzeTroubleshootInput(
      [
        "2026-01-01T10:00:00 [Rank 0] ERROR NPU out of memory",
        "2026-03-01T10:00:00Z [Rank 0] ERROR EL0004: Failed to allocate memory.",
      ].join("\n"),
    );
    expect(crossMonthRule20.findings.some((f) => f.ruleId === "cann-driver-or-device-env-fault")).toBe(true);

    // P2 #32 & #33: Rank 1 error + future startup-complete don't reset Rank 0 capture; subsequent Traceback doesn't bleed backward
    const interleavedStartupAndFutureTb = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] Traceback (most recent call last):",
        '  File "runner.py", line 10, in capture_model',
        "10:00:01 [Rank 1] ValueError: unrelated warning on rank 1",
        "10:00:02 [Rank 0] ERROR NPU out of memory",
        "10:00:05 [Rank 0] INFO Application startup complete",
      ].join("\n"),
    );
    const interleavedOom = interleavedStartupAndFutureTb.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(interleavedOom?.title).toContain("图捕获");

    const backwardCaptureBleed = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] ERROR NPU out of memory",
        "10:00:01 [Rank 0] Traceback (most recent call last):",
        '  File "runner.py", line 10, in capture_model',
        "RuntimeError: capture failed",
      ].join("\n"),
    );
    const runtimeOom = backwardCaptureBleed.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(runtimeOom?.title).toContain("缺少阶段里程碑");
    expect(runtimeOom?.title).not.toContain("图捕获");
    expect(backwardCaptureBleed.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("unknown");

    // P2 #34, #35, #36: sub-millisecond ordering excluded, omission marker fences cold-start, and Mar NPU fences Jan CUDA
    const subMsKvAfterOom = analyzeTroubleshootInput(
      [
        "10:00:00.000000002 [Rank 0] INFO Available KV cache memory: 2 GiB",
        "10:00:00.000000001 [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(subMsKvAfterOom.findings.find((f) => f.ruleId === "oom-stage-split")?.title).not.toContain(
      "图捕获",
    );

    const omissionFencedColdStart = analyzeTroubleshootInput(
      ["INFO Starting load_model()", "... [日志节选：下行起原行号 L4] ...", "ERROR NPU out of memory"].join(
        "\n",
      ),
    );
    const fencedOomTitle = omissionFencedColdStart.findings.find(
      (f) => f.ruleId === "oom-stage-split",
    )?.title;
    expect(fencedOomTitle).toContain("缺少阶段里程碑");
    expect(fencedOomTitle).not.toContain("冷启动");

    const monthFencedCudaOom = analyzeTroubleshootInput(
      [
        "2026-01-01T10:00:00 [Rank 0] ERROR torch.cuda.OutOfMemoryError: CUDA out of memory",
        "... [日志节选：下行起原行号 L5000] ...",
        "2026-03-01T10:00:00Z [Rank 0] INFO NPU initialized successfully",
      ].join("\n"),
    );
    expect(monthFencedCudaOom.findings.some((f) => f.ruleId === "oom-stage-split")).toBe(false);

    // P2 #37: timeline retains both distinct root-cause phases alongside cascades within the 16-event cap
    const manyWaitsLines = ["10:00:00 [Rank 0] ERROR NPU out of memory during load_weights"];
    for (let i = 1; i <= 15; i += 1) {
      const sec = String(i).padStart(2, "0");
      manyWaitsLines.push(`10:00:${sec} [Rank ${i}] ERROR EI0002: Notify wait execute timeout`);
    }
    manyWaitsLines.push("10:00:20 [Rank 0] ERROR NPU out of memory during decode");
    const cappedTimeline = analyzeTroubleshootInput(manyWaitsLines.join("\n"));
    const events = cappedTimeline.firstFaultVerdict.timelineEvents ?? [];
    expect(events).toHaveLength(16);
    const rootEvents = events.filter((ev) => ev.kind === "root-cause");
    expect(rootEvents).toHaveLength(2);
    expect(rootEvents.map((ev) => ev.lineNumber)).toEqual([1, 17]);

    // P2 #38 & #39 + P3 #2: O(N log N) OOM lifecycle lookup & O(1) deduplicated PID tracking show sub-quadratic scaling without brittle cold-start wall-clock flakes
    analyzeTroubleshootInput("INFO warmup");
    const buildPerfOomLog = (count: number) => {
      const rows: string[] = [];
      for (let i = 0; i < count; i += 1) {
        rows.push("10:00:00 [Rank 0] INFO Available KV cache memory: 1 GiB");
        rows.push("10:00:01 [Rank 0] ERROR NPU out of memory");
      }
      return rows.join("\n");
    };
    const buildPerfPidLog = (count: number) =>
      Array.from({ length: count }, () => "10:00:00 host=a pid=81 INFO heartbeat ok").join("\n");

    const smallOomInput = buildPerfOomLog(256);
    const largeOomInput = buildPerfOomLog(2048); // 8x larger
    analyzeTroubleshootInput(smallOomInput); // warmup JIT
    analyzeTroubleshootInput(largeOomInput);
    const tOomSmall0 = performance.now();
    for (let k = 0; k < 16; k += 1) analyzeTroubleshootInput(smallOomInput);
    const dtOomSmallBatch = performance.now() - tOomSmall0;
    const tOomStart = performance.now();
    const perfOom = analyzeTroubleshootInput(largeOomInput);
    analyzeTroubleshootInput(largeOomInput);
    const dtOomLargeBatch = performance.now() - tOomStart;
    expect(dtOomLargeBatch / 2).toBeLessThan(1500);
    expect(dtOomLargeBatch).toBeLessThan(Math.max(dtOomSmallBatch, 1) * 4);
    expect(perfOom.findings.some((f) => f.ruleId === "oom-stage-split")).toBe(true);

    const smallPidInput = buildPerfPidLog(256);
    const largePidInput = buildPerfPidLog(2048); // 8x larger
    analyzeTroubleshootInput(smallPidInput); // warmup JIT
    analyzeTroubleshootInput(largePidInput);
    const tPidSmall0 = performance.now();
    for (let k = 0; k < 16; k += 1) analyzeTroubleshootInput(smallPidInput);
    const dtPidSmallBatch = performance.now() - tPidSmall0;
    const tPidStart = performance.now();
    const perfPid = analyzeTroubleshootInput(largePidInput);
    analyzeTroubleshootInput(largePidInput);
    const dtPidLargeBatch = performance.now() - tPidStart;
    expect(dtPidLargeBatch / 2).toBeLessThan(1500);
    expect(dtPidLargeBatch).toBeLessThan(Math.max(dtPidSmallBatch, 1) * 4);
    expect(perfPid.findings).toHaveLength(0);
  });

  it("adversarial round-4 verifier closure: 4 P1s and 5 P2s across PID domain order, interleaved [rankN]: tracebacks, HCCL_SOCKET_IFNAME ERROR, body dates, scaffold/chain banners, CANN codes, OOM TZ buckets, and prose node-(...)", () => {
    // P1 #1: pidDomainMap propagates host/instance BEFORE scopedPidMap lookup (Repros A, B, C)
    const pidDomainOrder = analyzeTroubleshootInput(
      [
        "10:00:00 host=a [Rank 0] pid=42 INFO ready",
        "10:00:01 pid=42 RuntimeError: crash",
        "10:00:02 host=a [Rank 1] RuntimeError: later",
      ].join("\n"),
    );
    expect(pidDomainOrder.firstFaultVerdict.rank).toBe(0);

    const canPlogHostScoped = analyzeTroubleshootInput(
      [
        "[host a] (Worker_TP2 pid=289603) INFO 09-10 08:51:10 Worker initialized",
        "[ERROR] RUNTIME(289603,):2026-09-10-08:52:41.377.821 [stream.cc:1743]289907 GetError:retCode=0x26, [aicore exception].",
      ].join("\n"),
    );
    expect(canPlogHostScoped.firstFaultVerdict.rank).toBe(2);

    const pidMergedHostInst = analyzeTroubleshootInput(
      [
        "host=a [Rank 0] pid=8 INFO worker boot",
        "instance=blue pid=8 INFO heartbeat",
        "host=a pid=8 RuntimeError: crash",
      ].join("\n"),
    );
    expect(pidMergedHostInst.firstFaultVerdict.rank).toBe(0);

    // P1 #2: Interleaved [rankN]: tracebacks preserve independent traceback stacks & clocks
    const interleavedRankPrefixTb = analyzeTroubleshootInput(
      [
        "10:00:00 [rank0]: Traceback (most recent call last):",
        '[rank0]:   File "a.py", line 1, in foo',
        "10:00:01 [rank1]: Traceback (most recent call last):",
        '[rank1]:   File "b.py", line 2, in bar',
        "[rank1]: ValueError: later",
        "[rank0]: RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    expect(interleavedRankPrefixTb.firstFaultVerdict.rank).toBe(0);
    const tbOomFinding = interleavedRankPrefixTb.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(tbOomFinding?.matchedLines[0]?.timestamp).toBe("10:00:00");
    expect(tbOomFinding?.matchedLines[0]?.rank).toBe(0);

    // P1 #3: Case-sensitive HCCL_SOCKET_IFNAME ERROR does not falsify EI0002 wait or RaSocketConnect timeout
    const ifnameWithEi0002Wait = analyzeTroubleshootInput(
      "[Rank 0] HCCL_SOCKET_IFNAME=eth0 ERROR EI0002 Notify wait execute timeout",
    );
    expect(ifnameWithEi0002Wait.firstFaultVerdict.rank).toBeNull();
    expect(ifnameWithEi0002Wait.firstFaultVerdict.confidence).toBe("low");
    expect(ifnameWithEi0002Wait.findings.map((f) => f.ruleId)).toEqual(["hccl-timeout-cascade"]);

    const ifnameWithEi0006Timeout = analyzeTroubleshootInput(
      "[Rank 0] HCCL_SOCKET_IFNAME=eth0 ERROR EI0006: Getting socket times out",
    );
    const ifnameEi0006R17 = ifnameWithEi0006Timeout.findings.find(
      (f) => f.ruleId === "hccl-link-or-ifname-fault",
    );
    expect(ifnameEi0006R17?.title).toContain("超时");
    expect(ifnameEi0006R17?.title).not.toContain("绑定");

    const ifnameWithRaTimeout = analyzeTroubleshootInput(
      "10:00:00 [Rank 0] ERROR HCCL_SOCKET_IFNAME=eth0 RaSocketConnect error: timed out",
    );
    const ifnameRaR17 = ifnameWithRaTimeout.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault");
    expect(ifnameRaR17?.title).toContain("超时");
    expect(ifnameRaR17?.title).not.toContain("绑定");

    // P1 #4: Headerless line body date (`failed since 2025-...`) must not become header timestamp
    const headerlessBodyDate = analyzeTroubleshootInput(
      [
        "2026-04-12 10:00:00 [Rank 0] ERROR NPU out of memory",
        "[Rank 1] ERROR failed since 2025-01-01 00:00:00",
      ].join("\n"),
    );
    expect(headerlessBodyDate.firstFaultVerdict.rank).toBe(0);
    expect(
      headerlessBodyDate.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.timestamp,
    ).toBeNull();

    // P2 #5: Traceback scaffold source lines never generate spurious rule findings via collectAllMatchingLines
    const scaffoldSourceLines = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 0] ERROR Traceback (most recent call last):",
        '  File "w.py", line 1, in log',
        '    raise TimeoutError("EI0002 Notify wait execute timeout")',
        '    msg = messages["HCCL_BUFFSIZE is too SMALL"]',
        '    if sig == "SIGKILL":',
        '    p = "/dev/davinci0: Permission denied"',
        "NameError: name 'messages' is not defined",
      ].join("\n"),
    );
    expect(scaffoldSourceLines.findings).toEqual([]);

    // P2 #6: Rule 13 status=/() codes and Rule 14 sanitized R13_RUNTIME_CODE_RE checks
    for (const r13Input of [
      "10:00:00 [Rank 0] ERROR aclnnQuantMatmulV4 failed, status=507035",
      "10:00:00 [Rank 0] ERROR aclrtSynchronizeStream status=507015",
      "10:00:00 [Rank 0] ERROR aclrtSynchronizeStream failed (507015)",
    ]) {
      const rep = analyzeTroubleshootInput(r13Input);
      expect(rep.findings.map((f) => f.ruleId)).toContain("cann-plog-aicore-fault");
    }
    for (const r14Input of [
      "10:00:00 pid=507015 ERROR aclnnFoo failed",
      "10:00:00 [Rank 0] pid=507035 ERROR Aicore kernel execute failed",
    ]) {
      const rep = analyzeTroubleshootInput(r14Input);
      expect(rep.findings.map((f) => f.ruleId)).toContain("cann-opapi-or-aclnn-fault");
      expect(rep.findings.map((f) => f.ruleId)).not.toContain("cann-plog-aicore-fault");
    }

    // P2 #7: OOM lifecycle isolates TZ-aware from naive timestamps in separate buckets
    const tzVsNaiveOom = analyzeTroubleshootInput(
      [
        "2026-01-01 09:50:00 [Rank 0] INFO Starting load_model()",
        "2026-01-01 09:50:05 [Rank 0] ERROR NPU out of memory",
        "2026-01-01T10:00:00+08:00 (APIServer pid=1) INFO Application startup complete.",
      ].join("\n"),
    );
    expect(tzVsNaiveOom.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain("冷启动");
    expect(tzVsNaiveOom.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("device-init");

    const timeOnlyTzMismatchOom = analyzeTroubleshootInput(
      [
        "18:00:00+08:00 [Rank 0] INFO NPU KV cache size: 40000 tokens",
        "10:00:02 [Rank 0] INFO Starting load_model()",
        "18:00:05+08:00 [Rank 0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(timeOnlyTzMismatchOom.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain(
      "图捕获",
    );
    expect(timeOnlyTzMismatchOom.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("graph-compile");

    // P2 #8: Multi-space prefix stripping & timestamped chained traceback OOM stage without chain-banner noise
    const multiSpacePrefixTb = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 2]  ERROR Traceback (most recent call last):",
        "[Rank 2]  ERROR ValueError: bad",
        "10:00:01 [Rank 1] ERROR RuntimeError: late",
      ].join("\n"),
    );
    expect(multiSpacePrefixTb.firstFaultVerdict.rank).toBe(2);

    const sameTsChainedOom = analyzeTroubleshootInput(
      [
        "11-24 11:02:15 [Rank 0] ERROR Traceback (most recent call last):",
        '11-24 11:02:15 [Rank 0] ERROR   File "worker.py", line 10, in capture_model',
        "11-24 11:02:15 [Rank 0] ERROR ValueError: inner",
        "11-24 11:02:15 [Rank 0] ERROR During handling of the above exception, another exception occurred:",
        "11-24 11:02:15 [Rank 0] ERROR Traceback (most recent call last):",
        "11-24 11:02:15 [Rank 0] ERROR RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    expect(sameTsChainedOom.findings.find((f) => f.ruleId === "oom-stage-split")?.title).toContain("图捕获");
    expect(
      sameTsChainedOom.firstFaultVerdict.primaryEvidenceLines.some((l) =>
        /During handling of/i.test(l.rawLine),
      ),
    ).toBe(false);
    expect(sameTsChainedOom.unmatchedErrorLines.some((l) => /During handling of/i.test(l.rawLine))).toBe(
      false,
    );

    // P2 #9: Prose `node-1 (unreachable)` does not fabricate a hostTag
    const proseNodeParen = analyzeTroubleshootInput(
      "10:00:00 [Rank 0] ERROR Failed to reach node-1 (unreachable)",
    );
    expect(proseNodeParen.firstFaultVerdict.hostTag).toBeNull();
    expect(proseNodeParen.firstFaultVerdict.slotMappable).toBe(true);
    expect(proseNodeParen.firstFaultVerdict.confidence).toBe("high");

    // Round-2 verifier #44 (2 P1 + 1 P2): prefixed continuation domain inheritance, ERROR:/Watchdog/HCCL_E_WAIT_TIMEOUT IFNAME guard, padded prefixed traceback terminal
    const prefixedCrossInstCascade = analyzeTroubleshootInput(
      [
        "10:00:00 instance=blue [Rank 0] ERROR Traceback (most recent call last):",
        "[Rank 0] ERROR RuntimeError: NPU out of memory",
        "10:00:05 instance=green [Rank 1] ERROR EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(prefixedCrossInstCascade.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");
    expect(prefixedCrossInstCascade.firstFaultVerdict.cascadeRanks).toEqual([]);
    expect(
      prefixedCrossInstCascade.findings.find((f) => f.ruleId === "hccl-timeout-cascade")?.evidenceLevel,
    ).toBe("I");

    const prefixedVisibleDevices = analyzeTroubleshootInput(
      [
        "instance=a ASCEND_RT_VISIBLE_DEVICES=4",
        "instance=b ASCEND_RT_VISIBLE_DEVICES=7",
        "10:00:00 instance=a [Rank 0] ERROR Traceback (most recent call last):",
        "[Rank 0] ERROR RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    expect(prefixedVisibleDevices.visibleDevices).toEqual([4]);
    expect(prefixedVisibleDevices.firstFaultVerdict.slotMappable).toBe(true);

    const prefixedHostInherited = analyzeTroubleshootInput(
      [
        "10:00:00 host=a [Rank 0] ERROR Traceback (most recent call last):",
        "[Rank 0] ERROR RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    expect(prefixedHostInherited.firstFaultVerdict.hostTag).toBe("a");

    for (const waitLine of [
      "[Rank 0] HCCL_SOCKET_IFNAME=eth0 ERROR: Watchdog caught collective operation timeout",
      "[Rank 0] HCCL_SOCKET_IFNAME=eth0 ERROR: HCCL_E_WAIT_TIMEOUT",
    ]) {
      const rep = analyzeTroubleshootInput(waitLine);
      expect(rep.firstFaultVerdict.rank).toBeNull();
      expect(rep.findings.map((f) => f.ruleId)).toEqual(["hccl-timeout-cascade"]);
    }

    const ifnameWithColonPythonErr = analyzeTroubleshootInput(
      "[Rank 0] HCCL_SOCKET_IFNAME=eth0 ERROR: ValueError: bad config",
    );
    expect(ifnameWithColonPythonErr.findings).toEqual([]);

    const paddedPrefixedTerminal = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 2] ERROR:     Traceback (most recent call last):",
        "[Rank 2] ERROR:     ValueError: bad",
        "10:00:01 [Rank 1] ERROR RuntimeError: late",
      ].join("\n"),
    );
    expect(paddedPrefixedTerminal.firstFaultVerdict.rank).toBe(2);
  });

  it("A2 audit P1 closure: finding priority, ECONNREFUSED cascade, wait wrappers, ReDoS bounds, multi-TB isolation, RankID, routing, advisory warns, and provenance", () => {
    // P1-1: Top finding (findings[0]) owns winning primary ahead of confirmed cascades
    const roceTop = analyzeTroubleshootInput(
      "10:00:01 [Rank 3] ERROR RoCE port 1 link down\n10:00:02 [Rank 0] ERROR EI0002 Notify wait execute timeout",
    );
    expect(roceTop.findings.map((f) => f.ruleId)).toEqual([
      "hccl-link-or-ifname-fault",
      "hccl-timeout-cascade",
    ]);

    // P1-2 + shared FaultMechanism contract: ECONNREFUSED/c10d -> cascade (link-peer-refused / hccl-wait-cascade), EI0004/EI0009/EJ0001 -> link-transport-init, peerRank demotion
    const c10dCascade = analyzeTroubleshootInput(
      [
        "2026-04-18 10:00:01.000 ERROR [Rank 0] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 2.00 GiB",
        "2026-04-18 10:00:03.000 ERROR [Rank 1] [c10d] The client socket has failed to connect to [node0]:29500 (errno: 111 - Connection refused).",
        "2026-04-18 10:00:03.100 ERROR [Rank 2] [c10d] The client socket has failed to connect to [node0]:29500 (errno: 111 - Connection refused).",
      ].join("\n"),
    );
    expect(c10dCascade.firstFaultVerdict.rank).toBe(0);
    expect(c10dCascade.firstFaultVerdict.confidence).toBe("high");
    expect(c10dCascade.firstFaultVerdict.cascadeRanks).toEqual([1, 2]);
    expect(c10dCascade.findings[0]?.ruleId).toBe("oom-stage-split");
    for (const rank of [1, 2]) {
      const ev = c10dCascade.firstFaultVerdict.timelineEvents?.find((e) => e.rank === rank);
      expect(ev?.kind).toBe("confirmed-cascade");
      expect(ev?.mechanism).toBe("link-peer-refused");
      expect(ev?.faultMechanism).toBe("hccl-wait-cascade");
    }

    const untimestampedOomVsRefused = analyzeTroubleshootInput(
      [
        "[Rank 0] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 2.00 GiB",
        "2026-04-18 10:00:03.000 ERROR [Rank 1] HCCL RaSocket connect to peer rank 0 failed: Connection refused",
      ].join("\n"),
    );
    expect(untimestampedOomVsRefused.firstFaultVerdict.rank).toBe(0);
    expect(untimestampedOomVsRefused.findings[0]?.ruleId).toBe("oom-stage-split");
    const peerRefusedEv = untimestampedOomVsRefused.firstFaultVerdict.timelineEvents?.find(
      (e) => e.rank === 1,
    );
    expect(peerRefusedEv?.kind).toBe("unattributed-cascade");
    expect(peerRefusedEv?.mechanism).toBe("link-peer-refused");

    const untimestampedOomVsPeerPrim = analyzeTroubleshootInput(
      [
        "[Rank 0] torch.OutOfMemoryError: NPU out of memory.",
        "2026-04-18 10:00:03.000 ERROR [Rank 1] RaSocketConnect to peer rank 0 failed: No route to host",
      ].join("\n"),
    );
    expect(untimestampedOomVsPeerPrim.firstFaultVerdict.rank).toBe(0);

    for (const transportLine of [
      "2026-04-18 10:00:01.000 ERROR [Rank 3] EI0004: The ranktable is invalid. rank_id 3 device_ip mismatch",
      "2026-04-18 10:00:01.000 ERROR [Rank 3] EI0009 Device 3 transport init error",
      "2026-04-18 10:00:01.000 ERROR [Rank 3] EJ0001 HCCP init failed",
    ]) {
      const tr = analyzeTroubleshootInput(transportLine);
      expect(tr.firstFaultVerdict.timelineEvents?.[0]?.mechanism).toBe("link-transport-init");
    }

    // P1-3: Wait wrappers & monitoredBarrier / HCCL_E_TIMEOUT / HCCL error: 9 do not masquerade as root
    const ez9999Wait = analyzeTroubleshootInput(
      "10:00:00 [rank0] ERROR EZ9999 HCCL_E_WAIT_TIMEOUT\n10:00:01 [rank3] ERROR NPU out of memory",
    );
    expect(ez9999Wait.firstFaultVerdict.rank).toBe(3);
    expect(ez9999Wait.findings[0]?.ruleId).toBe("oom-stage-split");

    const barrierWait = analyzeTroubleshootInput(
      "10:00:00 [rank0] RuntimeError: Rank 3 failed to pass monitoredBarrier in 1800000 ms\n10:00:01 [rank3] ERROR NPU out of memory",
    );
    expect(barrierWait.firstFaultVerdict.rank).toBe(3);
    expect(barrierWait.findings.map((f) => f.ruleId)).toEqual(["oom-stage-split", "hccl-timeout-cascade"]);

    for (const waitSig of ["RuntimeError: HCCL error: 9", "ERROR [Rank 1] HCCL_E_TIMEOUT"]) {
      const r = analyzeTroubleshootInput(waitSig);
      expect(r.findings.map((f) => f.ruleId)).toEqual(["hccl-timeout-cascade"]);
      expect(r.firstFaultVerdict.rank).toBeNull();
    }

    // P1-4: O(N) bounded regex evaluation on 180KB single lines (<150ms each)
    for (const longLine of [
      `ERROR torchair ${"torchair ".repeat(20000)}`,
      `ERROR RaSocket ${"RaSocket ".repeat(20000)}`,
    ]) {
      const t0 = performance.now();
      const longRep = analyzeTroubleshootInput(longLine);
      expect(performance.now() - t0).toBeLessThan(150);
      expect(longRep.totalLines).toBe(1);
    }

    // P1-5: Interleaved tracebacks mark unlabelled continuation lines rank-ambiguous (rank: null, confidence: medium)
    const interleavedTbs = analyzeTroubleshootInput(
      [
        "2026-04-18 10:00:01.000 ERROR [Rank 0] Traceback (most recent call last):",
        "2026-04-18 10:00:01.000 ERROR [Rank 1] Traceback (most recent call last):",
        '  File "a.py", line 1, in f',
        "RuntimeError: NPU out of memory. Tried to allocate 1 GiB",
        "2026-04-18 10:00:02.000 ERROR [Rank 0] EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(interleavedTbs.firstFaultVerdict.rank).toBeNull();
    expect(interleavedTbs.firstFaultVerdict.confidence).toBe("medium");

    // P1-6: torch_npu (PID:42, Device:0, RankID:3) & separate PID rank vs device tracking
    const cannRankId = analyzeTroubleshootInput("(PID:42, Device:0, RankID:3) NPU out of memory");
    expect(cannRankId.firstFaultVerdict.rank).toBe(3);
    expect(cannRankId.firstFaultVerdict.rankSource).toBe("explicit-rank");

    const bodyDevNoOverwrite = analyzeTroubleshootInput(
      "[rank3] pid=42 INFO ready\npid=42 RuntimeError: NPU out of memory (NPU 0)\npid=42 RuntimeError: abort",
    );
    expect(bodyDevNoOverwrite.firstFaultVerdict.rank).toBe(3);
    expect(bodyDevNoOverwrite.firstFaultVerdict.timelineEvents?.length).toBeGreaterThanOrEqual(2);
    expect(bodyDevNoOverwrite.firstFaultVerdict.timelineEvents?.every((e) => e.rank === 3)).toBe(true);

    // P1-7 & P1-8 & P1-9: DefaultCPUAllocator isolation, advisory warning non-root, device-id exclusion from detectedRanks, instanceTag & cross-instance/same-domain slotMappable
    expect(
      analyzeTroubleshootInput("torch.OutOfMemoryError: DefaultCPUAllocator: can't allocate memory").findings,
    ).toEqual([]);

    const advWarnLog = analyzeTroubleshootInput(
      [
        "10:00:01 [Rank 0] WARNING npugraph_ex is not supported by the current hardware profile. Disabling it.",
        "10:00:02 [Rank 1] ERROR aclnnMatmul failed, error code is 161002",
      ].join("\n"),
    );
    expect(advWarnLog.firstFaultVerdict.rank).toBe(1);
    expect(advWarnLog.firstFaultVerdict.confidence).toBe("high");
    expect(advWarnLog.findings[0]?.ruleId).toBe("cann-opapi-or-aclnn-fault");

    const devIdStartup = analyzeTroubleshootInput(
      [
        "INFO 04-18 10:00:00 [platform.py:100] Found NPU 15 healthy",
        "2026-04-18 10:00:01.000 ERROR [Rank 0] torch.OutOfMemoryError: NPU out of memory.",
        "2026-04-18 10:00:05.000 ERROR [Rank 1] EI0002 Notify wait execute timeout waiting for rank 0",
      ].join("\n"),
    );
    expect(devIdStartup.detectedRanks).toEqual([0, 1]);

    const crossInstVis = analyzeTroubleshootInput(
      [
        "instance=A pid=201 ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B pid=202 ASCEND_RT_VISIBLE_DEVICES=6,7",
        "2026-04-18 10:00:01.000 pid=201 [Rank 0] ERROR NPU out of memory",
        "2026-04-18 10:00:05.000 pid=202 [Rank 1] ERROR EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(crossInstVis.visibleDevices).toEqual([4, 5]);
    const evtA = crossInstVis.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 0);
    const evtB = crossInstVis.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1);
    expect(evtA?.instanceTag).toBe("A");
    expect(evtA?.slotMappable).toBe(true);
    expect(evtB?.instanceTag).toBe("B");
    expect(evtB?.slotMappable).toBe(false);

    const sameDomainDiffVisMaps = analyzeTroubleshootInput(
      [
        "pid=201 ASCEND_RT_VISIBLE_DEVICES=4,5",
        "pid=202 ASCEND_RT_VISIBLE_DEVICES=6,7",
        "2026-04-18 10:00:01.000 pid=201 [Rank 0] ERROR NPU out of memory",
        "2026-04-18 10:00:05.000 pid=202 [Rank 1] ERROR EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(sameDomainDiffVisMaps.visibleDevices).toEqual([4, 5]);
    const sameDomEvt0 = sameDomainDiffVisMaps.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 0);
    const sameDomEvt1 = sameDomainDiffVisMaps.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1);
    expect(sameDomEvt0?.instanceTag).toBeNull();
    expect(sameDomEvt0?.slotMappable).toBe(true);
    expect(sameDomEvt1?.instanceTag).toBeNull();
    expect(sameDomEvt1?.slotMappable).toBe(false);
  });

  it("A2 audit P2/P3 closure: peer grammars, plog us, clocks, OOM stages, hccn split, routing precision, CASE-07/08, isRuleEvidenceLine, and backfeed codes", () => {
    // Peer rank global_rank / remoteRank, traceback logger.info guard, plog 2-level sub-ms, year rollover, body duration & date guards
    const peerGlobal = analyzeTroubleshootInput(
      "10:00:00 [rank3] ERROR NPU out of memory\n10:00:05 [rank0] EI0002 Notify wait execute timeout waiting for global_rank=2",
    );
    expect(peerGlobal.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");
    expect(peerGlobal.firstFaultVerdict.cascadeRanks).toEqual([]);
    const peerRemote = analyzeTroubleshootInput(
      "10:00:00 [rank3] ERROR NPU out of memory\n10:00:05 [rank0] EI0002 remoteRank=1 Notify wait execute timeout",
    );
    expect(peerRemote.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");

    const tbLoggerInfo = analyzeTroubleshootInput(
      '[rank3] Traceback (most recent call last):\n[rank3]     logger.info("NPU out of memory: %s", stats["size"])\n[rank3] KeyError: \'size\'',
    );
    expect(tbLoggerInfo.findings).toEqual([]);
    expect(tbLoggerInfo.firstFaultVerdict.timelineEvents?.[0]?.signalTag).toBe("Python 硬异常");

    const plogSubMs = analyzeTroubleshootInput(
      "[2024-01-01-12:00:00.123.900] [rank0] AICore exception\n[2024-01-01-12:00:00.123.100] [rank3] AICore exception",
    );
    expect(plogSubMs.firstFaultVerdict.rank).toBe(3);

    const rollover = analyzeTroubleshootInput(
      "2025-12-31 23:59:59 [rank3] NPU out of memory\n01-01 00:00:01 [rank0] EI0002 Notify wait execute timeout",
    );
    expect(rollover.firstFaultVerdict.rank).toBe(3);
    expect(rollover.firstFaultVerdict.cascadeCausalState).toBe("confirmed-after");
    expect(rollover.firstFaultVerdict.cascadeRanks).toEqual([0]);

    expect(
      extractTimestamp("[Rank 2] EI0002 Notify wait execute timeout, elapsed 00:05:13").timestamp,
    ).toBeNull();
    const shortBeforeBodyDate = analyzeTroubleshootInput(
      "01-02 10:00:05 [rank0] EI0002 (last progress at 2024-01-01 00:00:00)",
    );
    expect(shortBeforeBodyDate.firstFaultVerdict.timelineEvents?.[0]?.timestamp).toBe("01-02 10:00:05");

    // OOM stage precision: initialize_kv_cache -> kv-alloc; _dummy_run under profile_run -> cold-start; EL0004 + OOM dedup
    const kvAllocOom = analyzeTroubleshootInput(
      "[rank3] INFO Available KV cache memory: 8 GiB\n[rank3] RuntimeError: NPU out of memory in initialize_kv_cache",
    );
    expect(kvAllocOom.findings[0]?.title).toContain("KV Cache 物理块分配期");

    const dummyProfileOom = analyzeTroubleshootInput(
      '[rank3] INFO Entering profile_run\n[rank3]   File "runner.py", line 1, in _dummy_run\n[rank3] RuntimeError: NPU out of memory',
    );
    expect(dummyProfileOom.findings[0]?.title).toContain("冷启动");

    const elAndOom = analyzeTroubleshootInput(
      "10:00:00 [rank3] ERROR EL0004: Failed to allocate memory\n10:00:01 [rank3] RuntimeError: NPU out of memory",
    );
    expect(elAndOom.findings.map((f) => f.ruleId)).toEqual(["oom-stage-split"]);

    // hccn_tool multi-line split, generic error ownership, INFO help & shutdown SIGKILL guards, tie symmetry
    const hccnSplit = analyzeTroubleshootInput(
      "hccn_tool -i 0 -link -g\nlink status: DOWN\n[Rank 0] ERROR EI0002 Notify wait execute timeout",
    );
    expect(hccnSplit.findings[0]?.ruleId).toBe("hccl-link-or-ifname-fault");
    expect(
      analyzeTroubleshootInput("ERROR HCCL_SOCKET_IFNAME=eth9 interface does not exist").findings.map(
        (f) => f.ruleId,
      ),
    ).toEqual(["hccl-link-or-ifname-fault"]);

    expect(analyzeTroubleshootInput("OSError: [Errno 99] Cannot assign requested address").findings).toEqual(
      [],
    );
    expect(
      analyzeTroubleshootInput("ERROR metrics server: Address already in use (tcp://127.0.0.1:9090)")
        .findings[0]?.title,
    ).toContain("Metrics");
    expect(
      analyzeTroubleshootInput(
        "[W socket.cpp:464] [c10d] The server socket has failed to bind to [::]:29500 (errno: 98 - Address already in use).",
      ).findings[0]?.ruleId,
    ).toBe("zmq-port-conflict");
    expect(
      analyzeTroubleshootInput(
        "ERROR:    [Errno 98] error while attempting to bind on address ('0.0.0.0', 8000): address already in use",
      ).findings[0]?.ruleId,
    ).toBe("zmq-port-conflict");

    const hcclRdma = analyzeTroubleshootInput("ERROR HCCL: RDMA register failed");
    expect(hcclRdma.findings.map((f) => f.ruleId)).toEqual(["hccl-link-or-ifname-fault"]);
    expect(hcclRdma.findings[0]?.title).not.toContain("EI0006");

    expect(analyzeTroubleshootInput("[Rank 0] INFO Help: EZ9999 during graph compilation").findings).toEqual(
      [],
    );
    const shutdownSigkill = analyzeTroubleshootInput(
      "RuntimeError: aclnnMatmul failed, error code is 161002\nWARNING [shutdown] Executor: workers still running after SIGTERM; sending SIGKILL count=1",
    );
    expect(shutdownSigkill.findings.map((f) => f.ruleId)).toEqual(["cann-opapi-or-aclnn-fault"]);

    const tieForward = analyzeTroubleshootInput(
      "10:00:01 [Rank 3] ERROR RoCE port 1 link down\n10:00:01 [Rank 5] ERROR aclnnMatmul failed, error code is 161002",
    );
    const tieReversed = analyzeTroubleshootInput(
      "10:00:01 [Rank 5] ERROR aclnnMatmul failed, error code is 161002\n10:00:01 [Rank 3] ERROR RoCE port 1 link down",
    );
    expect(tieForward.firstFaultVerdict.rank).toBeNull();
    expect(tieReversed.firstFaultVerdict.rank).toBeNull();
    expect(tieForward.firstFaultVerdict.confidence).toBe("medium");
    expect(tieReversed.firstFaultVerdict.confidence).toBe("medium");
    expect(tieForward.firstFaultVerdict.primaryEvidenceLines[0]?.rawLine).toBe(
      tieReversed.firstFaultVerdict.primaryEvidenceLines[0]?.rawLine,
    );
    expect(tieForward.findings.map((f) => f.ruleId)).toEqual(tieReversed.findings.map((f) => f.ruleId));

    // Multi-engine Prometheus isolation + redacted IP host discrimination + unmatchedErrorLines (>4 lines)
    const multiEngineMetrics = analyzeTroubleshootInput(
      [
        'vllm:kv_cache_usage_perc{engine="0"} 0.99',
        'vllm:kv_cache_usage_perc{engine="1"} 0.01',
        'vllm:num_requests_waiting{engine="0"} 10',
        'vllm:num_preemptions_total{engine="0"} 12',
      ].join("\n"),
    );
    expect(multiEngineMetrics.findings.map((f) => f.ruleId)).toContain("metrics-kv-preemption-storm");

    const redactedHosts = analyzeTroubleshootInput(
      [
        "2026-04-18 10:00:01 [REDACTED_IP_1] [Rank 0] ERROR NPU out of memory",
        "2026-04-18 10:00:02 <IP#2> [Rank 1] ERROR EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(redactedHosts.firstFaultVerdict.hostTag).toBe("[REDACTED_IP_1]");
    expect(redactedHosts.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");

    const manyOomLines = Array.from(
      { length: 6 },
      (_, i) => `10:00:0${i} [Rank ${i}] ERROR NPU out of memory`,
    ).join("\n");
    expect(analyzeTroubleshootInput(manyOomLines).unmatchedErrorLines).toEqual([]);

    // Real WarGame CASE-07 & CASE-08 telemetry checks
    const case07 = analyzeTroubleshootInput(
      getWarGameScenario("a3-dual-die-static-kernel-trap").telemetryText,
    );
    expect(case07.firstFaultVerdict.rank).toBeNull();
    expect(case07.findings[0]?.ruleId).toBe("torchair-ge-graph-compile-fault");

    const case08 = analyzeTroubleshootInput(
      getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap").telemetryText,
    );
    expect(case08.firstFaultVerdict.rank).toBe(1);
    expect(case08.firstFaultVerdict.hostTag).toBe("node-D");
    expect(case08.firstFaultVerdict.rationale).toContain("node-P");
    expect(case08.findings[0]?.ruleId).toBe("moe-mc2-or-modelslim-quant-fault");

    // isRuleEvidenceLine single-source contract & Board #74 corpus backfeed signatures
    expect(isRuleEvidenceLine("INFO 04-18 10:00:00 [platform.py] Found NPU 15 healthy")).toBe(false);
    expect(isRuleEvidenceLine("ERROR [Rank 0] Dest buffer device_id >= endpoint count")).toBe(true);
    expect(isRuleEvidenceLine('vllm:kv_cache_usage_perc{engine="0"} 0.99')).toBe(true);

    for (const [log, expectedRule] of [
      ["ERROR [Rank 0] AclmdlRICaptureEnd failed, error code is 107025", "graph-capture-failure"],
      ["ERROR [Rank 0] rtStreamWaitEvent failed, error code is 107024", "graph-capture-failure"],
      ["ERROR [Rank 0] ERR03005 torch.ops.air.scope_enter unpaired", "torchair-ge-graph-compile-fault"],
      ["ERROR [Rank 0] aclnnMatmul failed, status=561103", "cann-opapi-or-aclnn-fault"],
      ["ERROR [Rank 0] AclNN_Parameter_Error(EZ1001): invalid tensor shape", "cann-opapi-or-aclnn-fault"],
      ["ERROR [Rank 0] HostCpuRoceChannel ibv_post_send failed", "hccl-link-or-ifname-fault"],
      ["ERROR [Rank 0] HCCL error: 7 (HCCL_E_UNAVAIL)", "hccl-link-or-ifname-fault"],
      ["ERROR [Rank 0] aclrtSynchronizeStream failed, error code is 507014", "cann-plog-aicore-fault"],
      ["ERROR [Rank 0] VEC instruction to read/write UB is out of bounds", "cann-plog-aicore-fault"],
      ["ERROR [Rank 0] [AdxDataDumpServer][Init]dump server run failed", "cann-driver-or-device-env-fault"],
      [
        "ERROR [Rank 0] ImportError: libatb.so: cannot open shared object file",
        "cann-driver-or-device-env-fault",
      ],
      [
        "ERROR [Rank 0] world_size (8) is larger than visible NPU count (4)",
        "cann-driver-or-device-env-fault",
      ],
      ["ERROR [Rank 0] ValueError: No available memory for the cache blocks", "pre-profile-free-memory"],
    ] as const) {
      expect(analyzeTroubleshootInput(log).findings[0]?.ruleId, log).toBe(expectedRule);
      expect(isRuleEvidenceLine(log), `isRuleEvidenceLine(${log})`).toBe(true);
    }
    const missingWeights = analyzeTroubleshootInput(
      "10:00:01 [rank3] RuntimeError: Cannot find any model weights\n10:00:02 [rank0] EI0002 Notify wait execute timeout",
    );
    expect(missingWeights.firstFaultVerdict.rank).toBe(3);
    expect(missingWeights.firstFaultVerdict.timelineEvents?.[0]?.signalTag).toBe("模型权重文件缺失");
    expect(missingWeights.findings.map((f) => f.ruleId)).toEqual([
      "cann-driver-or-device-env-fault",
      "hccl-timeout-cascade",
    ]);
    expect(missingWeights.unmatchedErrorLines).toEqual([]);
  });

  it("gpt-6.2-astra xhigh P1/P2/P3 closure: traceback multi-open rank ambiguity, peer demotion, wrappers, OOM/profiling phases, CASE-07, evidence parity, metrics, and scale", () => {
    // P1 #2 & #3: multi-open traceback ignores body rank; Errno 111 / ECONNRESET / Connection reset -> link-peer-refused cascade
    const multiOpenBodyRank = analyzeTroubleshootInput(
      "[rank2] Traceback (most recent call last):\n[rank3] Traceback (most recent call last):\nRuntimeError: NPU out of memory copying tensor on rank 1",
    );
    expect(multiOpenBodyRank.firstFaultVerdict.rank).toBeNull();
    expect(multiOpenBodyRank.firstFaultVerdict.confidence).toBe("medium");

    for (const peerRefused of [
      "10:00:01 [rank1] RuntimeError: HCCL connect failed [Errno 111]\n10:00:02 [rank0] ERROR NPU out of memory",
      "10:00:01 [rank1] HCCL ECONNRESET\n10:00:02 [rank0] ERROR NPU out of memory",
      "10:00:01 [rank1] HCCL Connection reset\n10:00:02 [rank0] ERROR NPU out of memory",
    ]) {
      const r = analyzeTroubleshootInput(peerRefused);
      expect(r.firstFaultVerdict.rank).toBe(0);
      expect(r.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.mechanism).toBe(
        "link-peer-refused",
      );
      expect(r.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.faultMechanism).toBe(
        "hccl-wait-cascade",
      );
    }

    // P1 #4, #5, #6, #7: RoCE port down to peer keeps root; peer exit demotes; EZ9999+wait & CUDA tiling & eager fallback
    const portDownToPeer = analyzeTroubleshootInput(
      "10:00:01 [rank1] ERROR RoCE port 1 link down to peer rank 0\n10:00:02 [rank0] ERROR NPU out of memory",
    );
    expect(portDownToPeer.firstFaultVerdict.rank).toBe(1);
    expect(portDownToPeer.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.kind).toBe(
      "root-cause",
    );

    const peerExitDemoted = analyzeTroubleshootInput(
      "[rank0] RuntimeError: NPU out of memory\n10:00:01 [rank1] RuntimeError: peer rank 0 exited",
    );
    expect(peerExitDemoted.firstFaultVerdict.rank).toBe(0);

    const ezWaitWithGraphWord = analyzeTroubleshootInput(
      "10:00:00 [rank0] ERROR EZ9999 HCCL_E_WAIT_TIMEOUT during collective graph execution\n10:00:01 [rank3] ERROR NPU out of memory",
    );
    expect(ezWaitWithGraphWord.firstFaultVerdict.rank).toBe(3);
    expect(ezWaitWithGraphWord.findings[0]?.ruleId).toBe("oom-stage-split");

    expect(
      analyzeTroubleshootInput(
        "[rank2] RuntimeError: Error compiling CUDA kernel: tiling failed",
      ).findings.map((f) => f.ruleId),
    ).not.toContain("torchair-ge-graph-compile-fault");

    const eagerFallbackWarn = analyzeTroubleshootInput(
      "10:00:01 [rank0] WARNING torchair graph fallback to eager; continuing in eager mode\n10:00:03 [rank3] ERROR NPU out of memory",
    );
    expect(eagerFallbackWarn.firstFaultVerdict.rank).toBe(3);
    expect(eagerFallbackWarn.firstFaultVerdict.confidence).toBe("high");
    expect(eagerFallbackWarn.findings[0]?.ruleId).toBe("oom-stage-split");

    // P1 #8, #10, #11: earlier timestamped unranked root; R17 subtype priority; cross-instance slotMappable
    const unrankedEarlier = analyzeTroubleshootInput(
      "10:00:01 RuntimeError: NPU out of memory\n10:00:03 [rank3] ERROR aclnnMatmul failed, error code is 161002",
    );
    expect(unrankedEarlier.firstFaultVerdict.rank).toBeNull();
    expect(unrankedEarlier.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(1);
    expect(unrankedEarlier.findings[0]?.ruleId).toBe("oom-stage-split");

    const bindBeforePortDown = analyzeTroubleshootInput(
      "10:00:01 [rank1] ERROR RaSocket bind failed: Cannot assign requested address\n10:00:02 [rank0] ERROR RoCE port 3 link down",
    );
    expect(bindBeforePortDown.findings[0]?.ruleId).toBe("hccl-link-or-ifname-fault");
    expect(bindBeforePortDown.findings[0]?.title).toContain("绑定失败");
    expect(bindBeforePortDown.findings[0]?.title).not.toContain("端口 3");

    const sameVisCrossInst = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=4,5",
        "10:00:01 instance=A [rank0] ERROR NPU out of memory",
        "10:00:05 instance=B [rank1] ERROR EI0002",
      ].join("\n"),
    );
    expect(sameVisCrossInst.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.slotMappable).toBe(
      false,
    );

    // P2 #1-#6: nonfatal 107030 + startup + decode OOM, INFO Help guard, DP0 pid mapping, EL0004 dedup, OOM KV-alloc & unknown phases
    const nonfatal107030 = analyzeTroubleshootInput(
      [
        "10:00:00 [rank1] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess",
        "10:00:03 [rank1] INFO Application startup complete.",
        "10:00:10 [rank1] RuntimeError: NPU out of memory during decode",
      ].join("\n"),
    );
    expect(nonfatal107030.findings.map((f) => f.ruleId)).toEqual(["oom-stage-split"]);

    const infoHelpCache = analyzeTroubleshootInput(
      "10:00:01 [rank0] INFO Help: No available memory for the cache blocks\n10:00:02 [rank1] RuntimeError: NPU out of memory",
    );
    expect(infoHelpCache.firstFaultVerdict.rank).toBe(1);
    expect(infoHelpCache.findings.map((f) => f.ruleId)).toEqual(["oom-stage-split"]);
    expect(isRuleEvidenceLine("INFO Help: No available memory for the cache blocks")).toBe(false);

    const dp0ThenRank3 = analyzeTroubleshootInput(
      "(EngineCore_DP0 pid=42) INFO ready\n[rank3] pid=42 INFO ready\npid=42 RuntimeError: NPU out of memory",
    );
    expect(dp0ThenRank3.firstFaultVerdict.rank).toBe(3);

    const el0004Exact = analyzeTroubleshootInput(
      "10:00:00 [rank3] ERROR EL0004: Failed to allocate memory\n10:00:01 [rank3] RuntimeError: NPU out of memory",
    );
    expect(el0004Exact.firstFaultVerdict.rank).toBe(3);
    expect(el0004Exact.findings.map((f) => f.ruleId)).toEqual(["oom-stage-split"]);
    expect(el0004Exact.unmatchedErrorLines).toEqual([]);
    expect(el0004Exact.firstFaultVerdict.timelineEvents).toHaveLength(1);

    const kvBudgetAlone = analyzeTroubleshootInput(
      "[rank3] INFO Available KV cache memory: 8 GiB\n[rank3] RuntimeError: NPU out of memory",
    );
    expect(kvBudgetAlone.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("device-init");
    expect(kvBudgetAlone.findings[0]?.title).toContain("KV Cache 物理块分配期");

    const bareOom = analyzeTroubleshootInput("[rank3] RuntimeError: NPU out of memory");
    expect(bareOom.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("unknown");
    expect(bareOom.findings[0]?.title).toContain("缺少阶段里程碑");

    const profilingEq = analyzeTroubleshootInput(
      "[rank3] AssertionError: Error in memory profiling. Initial free memory 8 GiB, current free memory 8 GiB",
    );
    expect(profilingEq.findings[0]?.ruleId).toBe("pre-profile-free-memory");
    expect(profilingEq.firstFaultVerdict.timelineEvents?.[0]?.phase).toBe("device-init");

    // P2 #7, #8, #10, #11-#17, P3 #2, #3: clocks, CASE-07, evidence parity, EE1001, libopapi, Errno 98, hccn dev, metrics, ADXL, 561103
    const bodyProgressDate = analyzeTroubleshootInput(
      "2026-04-18 10:00:00 [rank3] ERROR NPU out of memory\n[rank1] EI0002 Notify wait execute timeout, last progress at 2024-01-01 00:05:13",
    );
    expect(bodyProgressDate.firstFaultVerdict.cascadeCausalState).not.toBe("earlier-than-primary");
    expect(
      bodyProgressDate.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.timestamp,
    ).toBeNull();

    const decJanRollover = analyzeTroubleshootInput(
      "12-31 23:59:59 [rank3] ERROR NPU out of memory\n01-01 00:00:01 [rank0] ERROR EI0002 Notify wait execute timeout",
    );
    expect(decJanRollover.firstFaultVerdict.rank).toBe(3);
    expect(decJanRollover.firstFaultVerdict.cascadeCausalState).not.toBe("earlier-than-primary");

    const case07Re = analyzeTroubleshootInput(
      getWarGameScenario("a3-dual-die-static-kernel-trap").telemetryText,
    );
    expect(case07Re.findings[0]?.ruleId).toBe("torchair-ge-graph-compile-fault");
    expect(case07Re.findings[0]?.title).toContain("Static Kernel");
    expect(case07Re.findings[0]?.experimentStep).toContain("FULL_DECODE_ONLY");
    expect(case07Re.findings[0]?.experimentStep).toContain('"enable_static_kernel":true');

    expect(isRuleEvidenceLine("INFO worker terminated by signal SIGSEGV")).toBe(true);
    expect(isRuleEvidenceLine("json.decoder.JSONDecodeError: Expecting value: line 1 column 1")).toBe(true);
    expect(isRuleEvidenceLine("INFO metrics exporter registered vllm:kv_cache_usage_perc")).toBe(false);

    const ee1001Dev = analyzeTroubleshootInput("EE1001: The argument is invalid on device 0");
    expect(ee1001Dev.findings).toEqual([]);
    expect(ee1001Dev.firstFaultVerdict.timelineEvents?.length).toBe(1);

    const libopapiUndef = analyzeTroubleshootInput(
      "ImportError: /usr/local/Ascend/lib64/libopapi.so: undefined symbol: aclnnMatmulGetWorkspaceSize",
    );
    expect(libopapiUndef.findings.map((f) => f.ruleId)).toEqual(["cann-opapi-or-aclnn-fault"]);

    expect(analyzeTroubleshootInput("OSError: [Errno 98] Address already in use").findings).toEqual([]);

    const hccnDev = analyzeTroubleshootInput("hccn_tool -i 3 -link -g\nlink status: DOWN");
    expect(hccnDev.firstFaultVerdict.timelineEvents?.[0]?.port).toBeNull();
    expect(hccnDev.findings[0]?.title).toContain("设备 3");
    expect(hccnDev.findings[0]?.title).not.toContain("端口 3");

    const singleLabelPlusUnlabelled = analyzeTroubleshootInput(
      [
        'vllm:kv_cache_usage_perc{engine="0"} 0.99',
        "vllm:kv_cache_usage_perc 0.01",
        'vllm:num_requests_waiting{engine="0"} 10',
        'vllm:num_preemptions_total{engine="0"} 12',
      ].join("\n"),
    );
    expect(singleLabelPlusUnlabelled.findings.map((f) => f.ruleId)).toContain("metrics-kv-preemption-storm");

    const omissionMetrics = analyzeTroubleshootInput(
      [
        "... [日志节选：下行起原行号 L100] ...",
        'vllm:kv_cache_usage_perc{engine="0"} 0.99',
        'vllm:num_requests_waiting{engine="0"} 10',
        'vllm:num_preemptions_total{engine="0"} 12',
      ].join("\n"),
    );
    expect(omissionMetrics.findings[0]?.matchedLines.map((m) => m.lineNumber)).toEqual([100, 101, 102]);

    const singleAdxl = analyzeTroubleshootInput("WARNING Dest buffer device_id >= endpoint count");
    expect(singleAdxl.findings[0]?.title).not.toContain("刷屏");

    const sig561103 = analyzeTroubleshootInput("[rank2] RuntimeError: aclnnMatmul failed, status=561103");
    expect(sig561103.firstFaultVerdict.timelineEvents?.[0]?.signalTag).toContain("561103");
    expect(sig561103.firstFaultVerdict.timelineEvents?.[0]?.signalTag).not.toContain("561002");

    // P2 #1 & P3 #2: multi-instance scale guard exercises multiple green/group/pid lookups across all 9 paths (4x size -> sub-quadratic growth)
    const buildMultiInstSuite = (n: number) =>
      [
        ...Array.from(
          { length: n },
          () => "10:00:00 instance=blue [rank0] INFO Available KV cache memory: 8 GiB",
        ),
        ...Array.from({ length: n }, () => "10:00:01 instance=green [rank0] ERROR NPU out of memory"),
        ...Array.from(
          { length: n },
          () => "10:00:05 instance=blue [rank0] ERROR EL0004: Failed to allocate memory",
        ),
        ...Array.from({ length: n }, () => "10:00:05 instance=blue [rank0] ERROR npugraph_ex compile failed"),
        ...Array.from({ length: n }, () => "10:00:05 instance=blue [rank0] RuntimeError: abort execution"),
        ...Array.from(
          { length: n },
          () =>
            "10:00:05 instance=green [rank0] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess",
        ),
        ...Array.from({ length: n }, () => "10:00:02 instance=blue [rank1] RuntimeError: peer rank 0 exited"),
        ...Array.from(
          { length: n },
          (_, i) =>
            `group=g${i} ASCEND_RT_VISIBLE_DEVICES=0,1\n10:00:01 group=g${i} [rank0] ERROR NPU out of memory`,
        ),
        ...Array.from({ length: n }, (_, i) => `instance=asc_${i} [rank0] INFO CANN ok`),
        ...Array.from({ length: n }, (_, i) => `instance=asg_${i} [rank0] RuntimeError: out of memory`),
        ...Array.from(
          { length: n },
          () =>
            "instance=sleep_b [rank0] ERROR FRACTAL_NZ mode is enabled\ninstance=sleep_g [rank0] RuntimeError: wake_up error",
        ),
        ...Array.from(
          { length: n },
          (_, i) =>
            `10:00:00 instance=pid_${i} pid=42 INFO boot\n10:00:01 instance=dyn_r${i % 8} [Rank ${i}] Traceback (most recent call last):\n  File "worker.py", line ${i + 1}, in step\n[Rank ${i % 8}] 10:00:00 NPU out of memory\n[Rank ${i % 8}] 11:30:00 EL0004 Failed to allocate memory`,
        ),
      ].join("\n");

    const suiteSmall = buildMultiInstSuite(32);
    const suiteLarge = buildMultiInstSuite(256); // 8x larger across multi-instance, TB-index, and Rule-10 O(log N) paths
    analyzeTroubleshootInput(suiteSmall); // warmup JIT
    analyzeTroubleshootInput(suiteLarge);
    const tS0 = performance.now();
    for (let k = 0; k < 16; k += 1) analyzeTroubleshootInput(suiteSmall);
    const dtSmallBatch = performance.now() - tS0;
    const tL0 = performance.now();
    const scaleRes = analyzeTroubleshootInput(suiteLarge);
    analyzeTroubleshootInput(suiteLarge);
    const dtLargeBatch = performance.now() - tL0;
    expect(dtLargeBatch / 2).toBeLessThan(3000);
    expect(dtLargeBatch).toBeLessThan(Math.max(dtSmallBatch, 1) * 4);
    expect(scaleRes.findings.some((f) => f.ruleId === "oom-stage-split")).toBe(true);
  });

  it("gpt-6.2-astra xhigh final P1/P2/P3 closure: multi-TB rank+instance ambiguity, EL0004 dedup, physical slotMappable withholding, FileNotFoundError/transient priority, help/negated OOM, peer-refused vs Redis/port-down, EI0004 local ranktable, R1/R17 card fidelity, CASE-07/08, clocks, and provenance", () => {
    // P1-1: multi-open embedded body pid/rank & two [rank0] tracebacks in A vs B
    const multiTbBodyPid = analyzeTroubleshootInput(
      "[rank2] Traceback (most recent call last):\n[rank3] Traceback (most recent call last):\nRuntimeError: NPU out of memory copying tensor from pid=42 on rank 1",
    );
    expect(multiTbBodyPid.firstFaultVerdict.rank).toBeNull();
    expect(multiTbBodyPid.firstFaultVerdict.slotMappable).toBe(false);

    const twoRank0CrossInst = analyzeTroubleshootInput(
      "10:00:01 instance=A [rank0] Traceback (most recent call last):\n10:00:02 instance=B [rank0] Traceback (most recent call last):\n[rank0] RuntimeError: NPU out of memory",
    );
    expect(twoRank0CrossInst.firstFaultVerdict.rank).toBe(0);
    expect(twoRank0CrossInst.firstFaultVerdict.confidence).toBe("medium");
    expect(twoRank0CrossInst.firstFaultVerdict.timelineEvents?.[0]?.instanceTag).toBeNull();
    expect(twoRank0CrossInst.firstFaultVerdict.timelineEvents?.[0]?.timestamp).toBeNull();

    // P1-2: OOM(EL0004) self-suppression & TB EL0004 + post-TB OOM dedup
    const oomWithEl = analyzeTroubleshootInput(
      "10:00:01 [rank3] RuntimeError: NPU out of memory (EL0004: Failed to allocate memory)\n10:00:02 [rank0] EI0002",
    );
    expect(oomWithEl.firstFaultVerdict.rank).toBe(3);
    expect(oomWithEl.firstFaultVerdict.confidence).toBe("high");
    expect(oomWithEl.findings[0]?.ruleId).toBe("oom-stage-split");

    const tbElThenOom = analyzeTroubleshootInput(
      "10:00:01 [rank3] Traceback (most recent call last):\nRuntimeError: EL0004: Failed to allocate memory\n10:00:01 [rank3] ERROR NPU out of memory",
    );
    expect(tbElThenOom.findings.map((f) => f.ruleId)).toEqual(["oom-stage-split"]);
    expect(tbElThenOom.firstFaultVerdict.timelineEvents?.filter((e) => e.kind === "root-cause")).toHaveLength(
      1,
    );

    // P1-3: physical slotMappable withheld when maps or domains cannot be reconciled
    const crossInstTieDiffRank = analyzeTroubleshootInput(
      "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5\ninstance=B ASCEND_RT_VISIBLE_DEVICES=6,7\n10:00:01 instance=A [rank0] ERROR NPU out of memory\n10:00:01 instance=B [rank1] ERROR NPU out of memory",
    );
    expect(crossInstTieDiffRank.visibleDevices).toBeNull();
    const diffRankEvents = crossInstTieDiffRank.firstFaultVerdict.timelineEvents ?? [];
    expect(diffRankEvents.length).toBeGreaterThanOrEqual(2);
    expect(diffRankEvents.every((e) => !e.slotMappable)).toBe(true);

    const crossInstTieSameRank = analyzeTroubleshootInput(
      "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5\ninstance=B ASCEND_RT_VISIBLE_DEVICES=6,7\n10:00:01 instance=A [rank0] ERROR NPU out of memory\n10:00:01 instance=B [rank0] ERROR NPU out of memory",
    );
    expect(crossInstTieSameRank.visibleDevices).toBeNull();
    expect(crossInstTieSameRank.firstFaultVerdict.slotMappable).toBe(false);
    const sameRankEvents = crossInstTieSameRank.firstFaultVerdict.timelineEvents ?? [];
    expect(sameRankEvents.length).toBeGreaterThanOrEqual(2);
    expect(sameRankEvents.every((e) => !e.slotMappable)).toBe(true);

    const pidOnlyUnmappedWinner = analyzeTroubleshootInput(
      "pid=101 ASCEND_RT_VISIBLE_DEVICES=4,5\n10:00:01 pid=102 [rank0] ERROR NPU out of memory\n10:00:02 pid=101 [rank1] ERROR EI0002 Notify wait execute timeout",
    );
    expect(pidOnlyUnmappedWinner.visibleDevices).toBeNull();
    expect(pidOnlyUnmappedWinner.firstFaultVerdict.slotMappable).toBe(false);
    const pidOnlyEvents = pidOnlyUnmappedWinner.firstFaultVerdict.timelineEvents ?? [];
    expect(pidOnlyEvents.length).toBeGreaterThanOrEqual(2);
    expect(pidOnlyEvents.every((e) => !e.slotMappable)).toBe(true);

    // P1-4, P1-5, P1-6, P1-7, P1-8, P1-9, P1-10
    const unruledFileNotFound = analyzeTroubleshootInput(
      "10:00:01 FileNotFoundError: checkpoint missing\n10:00:02 [rank3] ERROR NPU out of memory",
    );
    expect(unruledFileNotFound.firstFaultVerdict.rank).toBeNull();
    expect(unruledFileNotFound.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(1);

    const lowercaseUnsupportedWarn = analyzeTroubleshootInput(
      "10:00:01 [rank1] WARNING ACLGraph capture unsupported; falling back to eager\n10:00:02 [rank3] ERROR NPU out of memory",
    );
    expect(lowercaseUnsupportedWarn.firstFaultVerdict.rank).toBe(3);
    expect(lowercaseUnsupportedWarn.firstFaultVerdict.confidence).toBe("high");
    expect(lowercaseUnsupportedWarn.findings[0]?.ruleId).toBe("oom-stage-split");

    for (const benign of [
      "[rank2] INFO no NPU out of memory errors detected",
      "INFO Help: RuntimeError: NPU out of memory",
      "INFO Help: NPU out of memory",
    ]) {
      const r = analyzeTroubleshootInput(benign);
      expect(r.findings).toEqual([]);
      expect(r.firstFaultVerdict.timelineEvents).toEqual([]);
    }

    const roceDownPlusRefused = analyzeTroubleshootInput(
      "10:00:01 [rank1] ERROR RoCE port 1 link down; reconnect: Connection refused\n10:00:02 [rank3] ERROR NPU out of memory",
    );
    expect(roceDownPlusRefused.firstFaultVerdict.rank).toBe(1);
    expect(roceDownPlusRefused.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.mechanism).toBe(
      "link-port-down",
    );

    const redisRefused = analyzeTroubleshootInput(
      "[rank1] RuntimeError: Redis connection refused on localhost:6379",
    );
    expect(redisRefused.findings).toEqual([]);
    expect(redisRefused.firstFaultVerdict.timelineEvents?.[0]?.mechanism).toBe("other");

    const ei0004LocalRanktable = analyzeTroubleshootInput(
      "10:00:01 [rank0] ERROR EI0004 invalid local ranktable entry for peer rank 3\n10:00:02 [rank3] ERROR NPU out of memory",
    );
    expect(ei0004LocalRanktable.firstFaultVerdict.rank).toBe(0);
    expect(ei0004LocalRanktable.firstFaultVerdict.timelineEvents?.[0]?.mechanism).toBe("link-transport-init");

    const r1WinnerOrder = analyzeTroubleshootInput(
      "10:00:03 [rank1] ValueError: No available memory for the cache blocks\n10:00:01 [rank2] ValueError: Free memory on device (3/64 GiB) on startup is less than desired GPU memory utilization (0.9, 57.6 GiB).",
    );
    expect(r1WinnerOrder.firstFaultVerdict.rank).toBe(2);
    expect(r1WinnerOrder.findings[0]?.title).toContain("init_snapshot");
    expect(r1WinnerOrder.findings[0]?.experimentStep).toContain("降到低于");

    const r17NoPortSteal = analyzeTroubleshootInput(
      "10:00:01 [rank3] ERROR RoCE link down\n10:00:02 [rank1] ERROR RoCE port 3 link down",
    );
    expect(r17NoPortSteal.firstFaultVerdict.rank).toBe(3);
    expect(r17NoPortSteal.findings[0]?.title).not.toContain("端口 3");
    expect(r17NoPortSteal.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.port).toBe("3");

    // P2-2..P2-17 + P3-1
    const c7 = analyzeTroubleshootInput(getWarGameScenario("a3-dual-die-static-kernel-trap").telemetryText);
    const c7Events = c7.firstFaultVerdict.timelineEvents ?? [];
    expect(c7Events[0]?.phase).toBe("device-init");
    expect(c7Events[0]?.signalTag).not.toContain("GE");
    expect(
      c7Events.some(
        (e) =>
          e.lineNumber === 5 && e.ruleId === "torchair-ge-graph-compile-fault" && e.kind === "root-cause",
      ),
    ).toBe(true);
    expect(c7Events.some((e) => e.lineNumber === 7)).toBe(false);
    expect(
      c7Events.some(
        (e) =>
          e.lineNumber === 8 && e.ruleId === "cann-driver-or-device-env-fault" && e.kind === "root-cause",
      ),
    ).toBe(true);
    expect(c7.findings.find((f) => f.ruleId === "graph-capture-failure")?.severity).toBe("warn");

    const c8 = analyzeTroubleshootInput(getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap").telemetryText);
    const r19c8 = c8.findings.find((f) => f.ruleId === "moe-mc2-or-modelslim-quant-fault")!;
    const r17c8 = c8.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault")!;
    expect(r19c8.experimentStep).not.toContain(">=128/256");
    expect(r19c8.experimentStep).toContain("128");
    expect(r19c8.experimentStep).toContain("16");
    expect(r17c8.experimentStep).toContain("192.0.2.11");
    expect(r17c8.experimentStep).toContain("enp65s0f0");
    expect(r17c8.experimentStep).not.toContain("ip -br addr");

    expect(isRuleEvidenceLine("NPU out of memory")).toBe(true);
    expect(isRuleEvidenceLine("ERROR npugraph_ex is not supported by the current hardware profile")).toBe(
      true,
    );

    const abortThenStartupThen107030 = analyzeTroubleshootInput(
      "10:00:00 [rank1] RuntimeError: previous worker aborted\n10:00:01 [rank1] INFO Application startup complete.\n10:00:02 [rank1] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess\n10:00:03 [rank1] FileNotFoundError: weights.safetensors",
    );
    expect(abortThenStartupThen107030.findings.some((f) => f.ruleId === "cann-plog-aicore-fault")).toBe(
      false,
    );

    const metricsPreempt = analyzeTroubleshootInput(getTroubleshootFixture("metrics-kv-preemption").content);
    const r7m = metricsPreempt.findings.find((f) => f.ruleId === "metrics-kv-preemption-storm")!;
    expect(r7m.matchedLines.every((m) => !m.rawLine.startsWith("#"))).toBe(true);
    expect(r7m.matchedLines.some((m) => m.lineNumber === 9)).toBe(true);

    const dpCascade = analyzeTroubleshootInput(
      "10:00:01 [rank3] ERROR NPU out of memory\n10:00:02 (EngineCore_DP1 pid=42) ERROR EI0002",
    );
    expect(dpCascade.firstFaultVerdict.confidence).toBe("medium");
    expect(dpCascade.firstFaultVerdict.cascadeRanks).toEqual([]);

    const devCascade = analyzeTroubleshootInput(
      "10:00:01 [rank3] ERROR NPU out of memory\n10:00:02 device=1 ERROR EI0002",
    );
    expect(devCascade.firstFaultVerdict.confidence).toBe("medium");
    expect(devCascade.firstFaultVerdict.cascadeRanks).toEqual([]);

    const devOomNotPeer = analyzeTroubleshootInput(
      "10:00:01 device=0 ERROR NPU out of memory\n10:00:02 [rank1] RuntimeError: peer rank 0 exited",
    );
    expect(devOomNotPeer.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.kind).toBe(
      "root-cause",
    );

    const latestHeartbeatTs = analyzeTroubleshootInput(
      "2026-04-18 10:00:00 [rank3] ERROR NPU out of memory\n[rank1] EI0002, latest heartbeat was 2024-01-01 00:05:13",
    );
    expect(
      latestHeartbeatTs.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.timestamp,
    ).toBeNull();
    expect(latestHeartbeatTs.firstFaultVerdict.cascadeCausalState).not.toBe("earlier-than-primary");

    const decJanUnanchored = analyzeTroubleshootInput(
      "12-31 23:59:59 [rank3] ERROR NPU out of memory\n01-01 00:00:01 [rank1] ERROR aclnnMatmul failed, error code is 161002",
    );
    expect(decJanUnanchored.firstFaultVerdict.rank).toBeNull();
    expect(decJanUnanchored.firstFaultVerdict.confidence).toBe("medium");

    expect(analyzeTroubleshootInput("ERROR GE graph compile failed").findings[0]?.ruleId).toBe(
      "torchair-ge-graph-compile-fault",
    );
    expect(
      analyzeTroubleshootInput("[rank3] ERROR OP_HOST tiling failed, status=561103").findings[0]?.ruleId,
    ).toBe("cann-opapi-or-aclnn-fault");

    const keyErrNone = analyzeTroubleshootInput(
      "10:00:01 [rank2] Traceback (most recent call last):\nKeyError: None\n10:00:02 [rank0] ERROR EI0002",
    );
    expect(keyErrNone.firstFaultVerdict.rank).toBe(2);

    const pidRestartedVis = analyzeTroubleshootInput(
      "pid=42 ASCEND_RT_VISIBLE_DEVICES=0,1\n10:00:01 pid=42 [rank0] ERROR NPU out of memory\npid=42 ASCEND_RT_VISIBLE_DEVICES=4,5\n10:00:05 pid=42 [rank0] ERROR NPU out of memory",
    );
    expect(pidRestartedVis.visibleDevices).toEqual([0, 1]);
    expect(
      analyzeTroubleshootInput("ASCEND_RT_VISIBLE_DEVICES=4096,5\n[rank0] ERROR NPU out of memory")
        .visibleDevices,
    ).toBeNull();

    const tcpstoreBind = analyzeTroubleshootInput(
      "[rank0] RuntimeError: TCPStore failed to bind tcp://localhost:29500: EADDRINUSE",
    );
    expect(tcpstoreBind.findings[0]?.title).toContain("TCPStore");
    expect(tcpstoreBind.findings[0]?.title).not.toContain("ZMQ");

    const hostOther = analyzeTroubleshootInput("10:00:01 host=other [rank2] ERROR NPU out of memory");
    expect(hostOther.firstFaultVerdict.hostTag).toBe("other");
    expect(hostOther.firstFaultVerdict.rank).toBe(2);

    const sameRankTwoRules = analyzeTroubleshootInput(
      "[rank1] ERROR Vector Core exception code 507035\n[rank1] ERROR aclnnMatmul failed, error code is 161002",
    );
    expect(sameRankTwoRules.firstFaultVerdict.timelineEvents?.map((e) => e.ruleId)).toEqual([
      "cann-plog-aicore-fault",
      "cann-opapi-or-aclnn-fault",
    ]);

    const kvBudgetQualified = analyzeTroubleshootInput(
      "[rank3] INFO Available KV cache memory: 8 GiB\n[rank3] RuntimeError: NPU out of memory",
    );
    expect(kvBudgetQualified.findings[0]?.title).toContain("推断");
    expect(kvBudgetQualified.findings[0]?.summary).toContain("缺少 initialize_kv_cache()");

    const twoSameRankAdxl = analyzeTroubleshootInput(
      "[rank2] WARNING Dest buffer device_id >= endpoint count\n[rank2] WARNING Dest buffer device_id >= endpoint count",
    );
    expect(twoSameRankAdxl.findings[0]?.title).not.toContain("多卡");
    expect(twoSameRankAdxl.findings[0]?.title).not.toContain("刷屏");
  });

  it("Wave 2 Track F2 closure (codex_closure_r4: 12 P1, 13 P2, 5 P3)", () => {
    // P3-4: fixtures.ts metrics-kv-preemption cumulative counter summary
    expect(TROUBLESHOOT_FIXTURES.find((f) => f.id === "metrics-kv-preemption")?.summary).toContain(
      "累计计数器 num_preemptions_total > 0（本快照为 47）",
    );

    // P1-1: body operand rank + timestamped continuation in single open traceback
    const bodyOpRank = analyzeTroubleshootInput(
      "10:00:00 [Rank 0] Traceback (most recent call last):\nRuntimeError: recv failed from rank 1",
    );
    expect(bodyOpRank.firstFaultVerdict.rank).toBe(0);
    const tsContTb = analyzeTroubleshootInput(
      '10:00:00 [Rank 0] Traceback (most recent call last):\n2026-11-28 10:00:00.123 File "x.py", line 9, in step\n2026-11-28 10:00:00.124 RuntimeError: bad tensor',
    );
    expect(tsContTb.firstFaultVerdict.rank).toBe(0);

    // P1-2 & P1-3: global unmapped PID ambiguity & invalid ASCEND_RT_VISIBLE_DEVICES override
    const unmappedOtherPid = analyzeTroubleshootInput(
      "pid=101 ASCEND_RT_VISIBLE_DEVICES=0,1\n10:00:01 pid=102 [rank0] ERROR NPU out of memory",
    );
    expect(unmappedOtherPid.visibleDevices).toBeNull();
    expect(unmappedOtherPid.firstFaultVerdict.slotMappable).toBe(false);
    const invalidOverride = analyzeTroubleshootInput(
      "10:00:00 pid=42 INFO ASCEND_RT_VISIBLE_DEVICES=0,1\n10:00:01 pid=42 INFO ASCEND_RT_VISIBLE_DEVICES=2,invalid\n10:00:02 pid=42 [rank0] ERROR NPU out of memory",
    );
    expect(invalidOverride.visibleDevices).toBeNull();
    expect(invalidOverride.firstFaultVerdict.slotMappable).toBe(false);

    // P1-4: benign negated OOM info checks
    const negatedOom = analyzeTroubleshootInput(
      "[rank3] INFO no NPU out of memory detected\n[rank3] INFO NPU out of memory: false",
    );
    expect(negatedOom.findings).toEqual([]);
    expect(negatedOom.firstFaultVerdict.timelineEvents).toEqual([]);

    // P1-5: single fatal APIServer error (even mentioning "transient") beats later Rank 0 OOM;
    // alive multi-error APIServer with later INFO does NOT block Rank 0 OOM
    const singleFatalApi = analyzeTroubleshootInput(
      "10:00:00 (APIServer pid=100) ERROR RuntimeError: transient channel corrupted\n10:00:05 [Rank 0] ERROR NPU out of memory",
    );
    expect(singleFatalApi.firstFaultVerdict.rank).toBeNull();
    const aliveRetryApi = analyzeTroubleshootInput(
      [
        "10:00:00 (APIServer pid=100) ERROR RuntimeError: timeout retry 1",
        "10:00:01 (APIServer pid=100) ERROR RuntimeError: timeout retry 2",
        "10:00:03 [Rank 0] ERROR NPU out of memory",
        "10:00:09 (APIServer pid=100) INFO health ok",
      ].join("\n"),
    );
    expect(aliveRetryApi.firstFaultVerdict.rank).toBe(0);

    // P1-6: non-link concrete rule beats "Connection reset by peer" on same line
    const aclnnWithReset = analyzeTroubleshootInput(
      "[Rank 2] ERROR aclnnMatmul failed, error code is 161002; Connection reset by peer",
    );
    expect(aclnnWithReset.findings[0]?.ruleId).toBe("cann-opapi-or-aclnn-fault");
    expect(aclnnWithReset.firstFaultVerdict.timelineEvents?.[0]?.kind).toBe("root-cause");

    // P1-7: startup boundary prevents pre-restart OOM from cascading post-restart peer refused/exit or EL0004
    const restartSplitPeer = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 1] ERROR NPU out of memory",
        "10:00:05 [Rank 1] INFO Application startup complete.",
        "10:00:10 [Rank 0] ERROR RaSocketConnect peer rank 1 Connection refused",
        "10:00:12 [Rank 2] ERROR exit code 137 peer rank 1",
      ].join("\n"),
    );
    expect(restartSplitPeer.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 0)?.kind).toBe(
      "unattributed-cascade",
    );
    expect(restartSplitPeer.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 2)?.kind).toBe(
      "root-cause",
    );
    const restartSplitEl0004 = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 1] ERROR NPU out of memory",
        "10:00:05 [Rank 1] INFO Application startup complete.",
        "10:00:11 [Rank 1] ERROR EL0004 Failed to allocate memory",
      ].join("\n"),
    );
    expect(restartSplitEl0004.findings.map((f) => f.ruleId)).toContain("cann-driver-or-device-env-fault");

    // P1-8: deterministic Dec-Jan rollover preserving intra-month ordering
    const decOrderWithJan = analyzeTroubleshootInput(
      "12-31 10:00:00 [Rank 0] ERROR NPU out of memory\n12-31 10:30:00 [Rank 1] ERROR NPU out of memory\n01-01 00:05:00 [Rank 2] ERROR EI0002 Notify wait execute timeout",
    );
    expect(decOrderWithJan.firstFaultVerdict.rank).toBe(0);
    expect(decOrderWithJan.firstFaultVerdict.cascadeCausalState).toBe("unverified-order");
    const janFirstRollover = analyzeTroubleshootInput(
      "01-01 00:00:05 [Rank 1] ERROR NPU out of memory\n12-31 23:59:50 [Rank 0] ERROR RuntimeError: late",
    );
    expect(janFirstRollover.firstFaultVerdict.rank).toBeNull();
    expect(janFirstRollover.firstFaultVerdict.confidence).toBe("medium");

    // P1-9: host-isolated NIC inventory & collapsed redacted IP guard
    const redactedSelfReplace = analyzeTroubleshootInput(
      [
        "[node-P] ERROR RaSocket bind failed HCCL_IF_IP=<IP#1>",
        "[node-P] INFO Host NIC inventory: enp65s0f0 UP <IP#1>/24",
        "[node-D] INFO Host NIC inventory: enp65s0f1 UP <IP#2>/24",
      ].join("\n"),
    );
    const r17Redacted = redactedSelfReplace.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault")!;
    expect(r17Redacted.experimentStep).not.toContain("勿填错为 <IP#1>");
    expect(r17Redacted.experimentStep).not.toContain("<IP#2>");

    // P1-10: HCCL_BUFFSIZE >= 128 scaling & zero fabricated thresholds
    const bigBuff = analyzeTroubleshootInput(
      "ERROR [Rank 1] DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, expected HCCL_BUFFSIZE=256MB, HCCL_BUFFSIZE=128MB",
    );
    expect(bigBuff.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=256");
    expect(bigBuff.findings[0]?.experimentStep).not.toContain("HCCL_BUFFSIZE=128");
    const noNumBuff = analyzeTroubleshootInput(
      "ERROR [Rank 1] DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL",
    );
    expect(noNumBuff.findings[0]?.summary).not.toContain("16 MiB");
    expect(noNumBuff.findings[0]?.experimentStep).not.toContain("16 MiB");
    expect(noNumBuff.findings[0]?.experimentStep).not.toContain("8MB");

    // P1-11: chronological rule headline scoping in R13/R20
    const r13Scoped = analyzeTroubleshootInput(
      "10:00:01 [Rank 0] ERROR Vector Core exception code 507035\n10:00:05 [Rank 1] ERROR AclrtSynchronizeStreamWithTimeout error code is 507015",
    );
    expect(r13Scoped.findings[0]?.title).toContain("507035");
    expect(r13Scoped.findings[0]?.title).not.toContain("507015");
    const r20Scoped = analyzeTroubleshootInput(
      "10:00:01 [Rank 0] ERROR RuntimeError: Cannot find any model weights\n10:00:05 [Rank 1] ERROR libatb.so cannot open shared object file",
    );
    expect(r20Scoped.findings[0]?.title).toContain("Cannot find any model weights");
    expect(r20Scoped.findings[0]?.title).not.toContain("libatb.so");

    // P1-12: standalone hccn_tool link DOWN + cross-rank pairing guard
    const hccnDown = analyzeTroubleshootInput("[node-P] hccn_tool -i 3 -link -g: link status: DOWN");
    expect(hccnDown.findings[0]?.ruleId).toBe("hccl-link-or-ifname-fault");
    expect(hccnDown.findings[0]?.title).toContain("设备 3");
    const hccnCrossRank = analyzeTroubleshootInput(
      "[Rank 0] hccn_tool -i 7 -link -g\n[Rank 1] link status: DOWN",
    );
    expect(hccnCrossRank.findings[0]?.title).not.toContain("设备 7");

    // P2-1, P2-2, P2-5, P2-6, P2-12, P2-13, P3-1, P3-5
    const dpUnrankedNoCascade = analyzeTroubleshootInput(
      "10:00:00 EngineCore_DP0 ERROR RuntimeError: worker crash\n10:00:05 [Rank 1] ERROR EI0002 Notify wait execute timeout",
    );
    expect(dpUnrankedNoCascade.firstFaultVerdict.cascadeRanks).toEqual([]);
    const unrankedTie = analyzeTroubleshootInput(
      "10:00:01 RuntimeError: unranked boom\n10:00:01 [Rank 0] ERROR NPU out of memory",
    );
    expect(unrankedTie.firstFaultVerdict.rank).toBeNull();
    expect(unrankedTie.firstFaultVerdict.timelineEvents?.length).toBeGreaterThanOrEqual(2);
    const keyErrFalse = analyzeTroubleshootInput(
      "10:00:00 [Rank 2] Traceback (most recent call last):\nKeyError: False\n10:00:01 [Rank 0] ERROR NPU out of memory",
    );
    expect(keyErrFalse.firstFaultVerdict.rank).toBe(2);
    const invalidDate = analyzeTroubleshootInput("2026-02-30 10:00:00 [Rank 0] ERROR NPU out of memory");
    expect(invalidDate.firstFaultVerdict.timelineEvents?.[0]?.timestamp).toBeNull();
    const invalidShortDate = analyzeTroubleshootInput("02-30 10:00:00 [Rank 0] ERROR NPU out of memory");
    expect(invalidShortDate.firstFaultVerdict.timelineEvents?.[0]?.timestamp).toBeNull();
    const feb29NonLeap = analyzeTroubleshootInput("2026-02-29 10:00:00 [Rank 0] ERROR NPU out of memory");
    expect(feb29NonLeap.firstFaultVerdict.timelineEvents?.[0]?.timestamp).toBeNull();
    const feb29Leap = analyzeTroubleshootInput("2024-02-29 10:00:00 [Rank 0] ERROR NPU out of memory");
    expect(feb29Leap.firstFaultVerdict.timelineEvents?.[0]?.timestamp).toBe("2024-02-29 10:00:00");
    const bodyTsIgnored = analyzeTroubleshootInput(
      "10:00:05 [Rank 0] INFO heartbeat timestamp: 09:00:00 ERROR failed",
    );
    expect(bodyTsIgnored.firstFaultVerdict.timelineEvents?.[0]?.timestamp).toBe("10:00:05");
    const genericTcpPort = analyzeTroubleshootInput(
      "10:00:00 [Rank 0] ERROR tcp://0.0.0.0:29500 EADDRINUSE: Address already in use",
    );
    expect(genericTcpPort.findings[0]?.ruleId).toBe("zmq-port-conflict");
    expect(genericTcpPort.unmatchedErrorLines).toEqual([]);
    const earlierPeerExit = analyzeTroubleshootInput(
      "10:00:01 [Rank 0] ERROR exit code 137 peer rank 1\n10:00:03 [Rank 1] ERROR NPU out of memory",
    );
    expect(earlierPeerExit.firstFaultVerdict.rank).toBe(0);
    const singleRankSlow = analyzeTroubleshootInput(
      "[Rank 0] WARNING Dest buffer device_id >= endpoint count\n[Rank 0] WARNING Dest buffer device_id >= endpoint count",
    );
    expect(singleRankSlow.findings[0]?.ruleId).toBe("mooncake-adxl-endpoint-fallback");
    expect(singleRankSlow.findings[0]?.title).toContain("Rank 0");
    expect(singleRankSlow.findings[0]?.title ?? "").not.toContain("多卡");

    // P2-7, P2-8, P2-9, P2-11: Prometheus exposition & ReDoS immunity
    const promPoison = [
      "# HELP vllm:errors_total Count of NPU out of memory errors.",
      "# TYPE vllm:errors_total counter",
      'vllm:requests_total{reason="NPU out of memory"} 0',
    ];
    expect(analyzeTroubleshootInput(promPoison.join("\n")).findings).toEqual([]);
    for (const pl of promPoison) expect(isRuleEvidenceLine(pl)).toBe(false);
    const r7Rep = analyzeTroubleshootInput(
      [
        'vllm:kv_cache_usage_perc{engine="0",label="a"} 0.97',
        'vllm:kv_cache_usage_perc{engine="0",label="b"} 0.98',
        'vllm:kv_cache_usage_perc{engine="0",label="c"} 0.99',
        'vllm:kv_cache_usage_perc{engine="0",label="d"} 0.99',
        'vllm:num_preemptions_total{engine="0"} 47',
        'vllm:num_requests_waiting{engine="0"} 3',
      ].join("\n"),
    );
    expect(r7Rep.findings[0]?.matchedLines.some((m) => m.rawLine.includes("num_requests_waiting"))).toBe(
      true,
    );
    const promScopes = analyzeTroubleshootInput(
      [
        'vllm:kv_cache_usage_perc{instance="a",model_name="qwen",engine="0"} 0.98',
        'vllm:num_requests_waiting{instance="a",model_name="qwen",engine="0"} 4',
        'vllm:num_preemptions_total{instance="a",model_name="qwen",engine="0"} 12',
        'vllm:kv_cache_usage_perc{instance="b",model_name="qwen",engine="0"} 0.2',
      ].join("\n"),
    );
    expect(promScopes.findings[0]?.title).toContain("instance=a");
    const tProm0 = performance.now();
    const hugeProm = analyzeTroubleshootInput(
      `vllm:kv_cache_usage_perc{long_label="${"x".repeat(200_000)}"} 0.98\nvllm:num_requests_waiting 2\nvllm:num_preemptions_total 5`,
    );
    expect(performance.now() - tProm0).toBeLessThan(150);
    expect(hugeProm.findings[0]?.ruleId).toBe("metrics-kv-preemption-storm");
  });

  it("R5 closure P1 suite: col-0 operands, header PID isolation, sole visibility fencing, override invalidation, Prom poisoning, clause negation, APIServer lastErr, Redis guard, hccn ambiguity, scoped NIC/BUFFSIZE, post-restart headline, and compound 107030", () => {
    // R5 P1-1: column-0 exception operand rank ignored
    const col0Op = analyzeTroubleshootInput("RuntimeError: failed to copy tensor on rank 1");
    expect(col0Op.firstFaultVerdict.rank).toBeNull();
    expect(col0Op.firstFaultVerdict.slotMappable).toBe(false);

    // R5 P1-2: operand pid=42 does not select instance=B pid=42 [rank3] traceback
    const peerPidTb = analyzeTroubleshootInput(
      [
        "10:00:01 instance=A pid=11 [rank2] Traceback (most recent call last):",
        "10:00:02 instance=B pid=42 [rank3] Traceback (most recent call last):",
        "10:00:03 RuntimeError: NPU out of memory copying tensor from pid=42 on rank 1",
      ].join("\n"),
    );
    expect(peerPidTb.firstFaultVerdict.rank).toBeNull();
    expect(peerPidTb.firstFaultVerdict.confidence).toBe("medium");
    expect(peerPidTb.firstFaultVerdict.slotMappable).toBe(false);

    // R5 P1-3: post-restart & post-omission sole visibility map does not apply retroactively
    const postRestartVis = analyzeTroubleshootInput(
      [
        "10:00:02 pid=42 [rank0] ERROR NPU out of memory",
        "10:00:03 pid=42 INFO Application startup complete.",
        "10:00:04 pid=42 INFO ASCEND_RT_VISIBLE_DEVICES=4,5",
      ].join("\n"),
    );
    expect(postRestartVis.visibleDevices).toBeNull();
    expect(postRestartVis.firstFaultVerdict.slotMappable).toBe(false);

    const postOmissionVis = analyzeTroubleshootInput(
      [
        "10:00:02 pid=42 [rank0] ERROR NPU out of memory",
        "... [日志节选：下行起原行号 L100] ...",
        "10:00:04 pid=42 INFO ASCEND_RT_VISIBLE_DEVICES=4,5",
      ].join("\n"),
    );
    expect(postOmissionVis.visibleDevices).toBeNull();
    expect(postOmissionVis.firstFaultVerdict.slotMappable).toBe(false);

    // R5 P1-4: last invalid ASCEND_RT_VISIBLE_DEVICES override supersedes valid prefix
    const invalidOverrideVis = analyzeTroubleshootInput(
      "export ASCEND_RT_VISIBLE_DEVICES=4,5 ASCEND_RT_VISIBLE_DEVICES=2,invalid\n[rank0] ERROR NPU out of memory",
    );
    expect(invalidOverrideVis.visibleDevices).toBeNull();
    expect(invalidOverrideVis.firstFaultVerdict.slotMappable).toBe(false);

    // R5 P1-5: Prometheus labels never populate PID rank or visibleDevices
    const promPidRank = analyzeTroubleshootInput(
      'vllm:requests_total{reason="pid=42 [rank5]"} 0\n10:00:01 pid=42 ERROR NPU out of memory',
    );
    expect(promPidRank.firstFaultVerdict.rank).toBeNull();
    const promVisAttr = analyzeTroubleshootInput(
      'vllm:requests_total{reason="ASCEND_RT_VISIBLE_DEVICES=4,5"} 0\n[rank0] ERROR NPU out of memory',
    );
    expect(promVisAttr.visibleDevices).toBeNull();

    // R5 P1-6: clause-level OOM negation neither manufactures OOM nor hides 507015
    const negatedPlusHccl = analyzeTroubleshootInput(
      "[rank2] ERROR HCCL setup failed; no NPU out of memory detected",
    );
    expect(negatedPlusHccl.findings.some((f) => f.ruleId === "oom-stage-split")).toBe(false);
    const infoNegPlus507015 = analyzeTroubleshootInput(
      "[rank3] INFO no NPU out of memory detected; rtMemcpy failed error code 507015",
    );
    expect(infoNegPlus507015.findings[0]?.ruleId).toBe("cann-plog-aicore-fault");
    expect(infoNegPlus507015.firstFaultVerdict.rank).toBe(3);

    // R5 P1-7: APIServer heartbeat before fatal error & cross-host PID isolation
    const apiFatalAfterHb = analyzeTroubleshootInput(
      [
        "10:00:00 (APIServer pid=42) ERROR RuntimeError: retry 1",
        "10:00:01 (APIServer pid=42) INFO health ok",
        "10:00:02 (APIServer pid=42) ERROR FileNotFoundError: fatal missing checkpoint",
        "10:00:03 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(apiFatalAfterHb.firstFaultVerdict.rank).toBeNull();
    expect(apiFatalAfterHb.firstFaultVerdict.confidence).toBe("medium");

    const crossHostApiPid = analyzeTroubleshootInput(
      [
        "10:00:00 node-A (APIServer pid=42) ERROR RuntimeError: retry 1",
        "10:00:01 node-A (APIServer pid=42) ERROR FileNotFoundError: fatal missing checkpoint",
        "10:00:02 node-B (APIServer pid=42) INFO health ok",
        "10:00:03 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(crossHostApiPid.firstFaultVerdict.rank).toBeNull();

    // R5 P1-8: non-HCCL application link failure does not fire hccl-link-or-ifname-fault
    const redisLink = analyzeTroubleshootInput("[rank2] ERROR Redis replication link status: DOWN");
    expect(redisLink.findings.some((f) => f.ruleId === "hccl-link-or-ifname-fault")).toBe(false);
    expect(redisLink.firstFaultVerdict.timelineEvents?.[0]?.mechanism).not.toBe("link-port-down");

    // R5 P1-9 & R6 P3-3: interleaved unresolved hccn_tool -link avoids paste-dependent dev/rank pick without dropping DOWN event
    const hccnOrderA = analyzeTroubleshootInput(
      "[rank0] hccn_tool -i 0 -link -g\n[rank1] hccn_tool -i 6 -link -g\nlink status: DOWN",
    );
    const hccnOrderB = analyzeTroubleshootInput(
      "[rank1] hccn_tool -i 6 -link -g\n[rank0] hccn_tool -i 0 -link -g\nlink status: DOWN",
    );
    expect(hccnOrderA.firstFaultVerdict.rank).toBeNull();
    expect(hccnOrderB.firstFaultVerdict.rank).toBeNull();
    expect(hccnOrderA.findings[0]?.ruleId).toBe("hccl-link-or-ifname-fault");
    expect(hccnOrderB.findings[0]?.ruleId).toBe("hccl-link-or-ifname-fault");
    expect(hccnOrderA.findings[0]?.title).toBe(hccnOrderB.findings[0]?.title);
    expect(hccnOrderA.firstFaultVerdict.timelineEvents?.some((e) => e.mechanism === "link-port-down")).toBe(
      true,
    );
    expect(hccnOrderB.firstFaultVerdict.timelineEvents?.some((e) => e.mechanism === "link-port-down")).toBe(
      true,
    );

    // R5 P1-10/11/12: instance-scoped NIC inventory + synchronized strict/unitless HCCL_BUFFSIZE
    const scopedNicAndBuff = analyzeTroubleshootInput(
      [
        "[node-A] instance=blue INFO Host NIC inventory: ethA UP 192.0.2.11/24",
        "[node-A] instance=green INFO Host NIC inventory: ethB UP 192.0.2.22/24",
        "[node-A] instance=green ERROR RaSocket bind failed HCCL_IF_IP=192.0.2.33",
        "[node-D] instance=green ERROR DispatchFFNCombine HCCL_BUFFSIZE is too SMALL, HCCL_BUFFSIZE=8MB, expected HCCL_BUFFSIZE=384 MiB",
      ].join("\n"),
    );
    const r17Scoped = scopedNicAndBuff.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault")!;
    const r19Scoped = scopedNicAndBuff.findings.find((f) => f.ruleId === "moe-mc2-or-modelslim-quant-fault")!;
    expect(r17Scoped.experimentStep).toContain("ethB");
    expect(r17Scoped.experimentStep).toContain("192.0.2.22");
    expect(r17Scoped.experimentStep).not.toContain("ethA");
    expect(r17Scoped.experimentStep).not.toContain("192.0.2.11");
    expect(r17Scoped.experimentStep).toContain("HCCL_BUFFSIZE=512");
    expect(r19Scoped.experimentStep).toContain("ethB");
    expect(r19Scoped.experimentStep).toContain("192.0.2.22");
    expect(r19Scoped.experimentStep).not.toContain("ethA");
    expect(r19Scoped.experimentStep).toContain("HCCL_BUFFSIZE=512");

    const unitlessBuff = analyzeTroubleshootInput(
      "ERROR DispatchFFNCombine HCCL_BUFFSIZE is too SMALL, HCCL_BUFFSIZE=8, expected HCCL_BUFFSIZE=384",
    );
    expect(unitlessBuff.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");
    const strictGtBuff = analyzeTroubleshootInput(
      "ERROR DispatchFFNCombine HCCL_BUFFSIZE is too SMALL, expected HCCL_BUFFSIZE > 256 MiB, HCCL_BUFFSIZE=8MB",
    );
    expect(strictGtBuff.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");

    // R5 P1-13: later run after startup restart never rewrites winning hardware fault headline
    const r13RestartIso = analyzeTroubleshootInput(
      [
        "10:00:00 [rank0] ERROR error code 507014",
        "10:00:01 [rank0] INFO Application startup complete.",
        "10:01:00 [rank0] ERROR Vector Core exception code 507035 fault kernel_name=OtherRunOnly",
      ].join("\n"),
    );
    expect(r13RestartIso.findings[0]?.title).toContain("507014");
    expect(r13RestartIso.findings[0]?.title).not.toContain("507035");
    expect(r13RestartIso.findings[0]?.title).not.toContain("OtherRunOnly");

    // R5 P1-14: standalone 107030 suppressed vs compound 107030 + fatal OOM preserved
    const compound107030 = analyzeTroubleshootInput(
      "[rank1] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess; torch.OutOfMemoryError: NPU out of memory",
    );
    expect(compound107030.findings[0]?.ruleId).toBe("oom-stage-split");
    expect(compound107030.firstFaultVerdict.rank).toBe(1);
    expect(compound107030.firstFaultVerdict.confidence).toBe("high");
    expect(compound107030.firstFaultVerdict.timelineEvents?.length).toBeGreaterThanOrEqual(1);
  });

  it("R5 closure P2 & P3 suite: chained TB ambiguity, per-segment visibility order, paste-invariant Dec-Jan, leap Feb 29, body heartbeat timestamps, mixed startup fences, 107030 PID parity, Prometheus comments/exporters/quantiles/metrics, ADXL device_id, O(N) TB/vis/peer scaling, PID timeline dedup, and fixture label", () => {
    // R5 P2-1: unlabelled chained traceback after multiple closed TBs does not blame last-focused rank
    const chainedA = analyzeTroubleshootInput(
      [
        "[rank2] Traceback (most recent call last):",
        "[rank2] KeyError: 2",
        "[rank3] Traceback (most recent call last):",
        "[rank3] KeyError: 3",
        "During handling of the above exception, another exception occurred:",
        "Traceback (most recent call last):",
        "RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    const chainedB = analyzeTroubleshootInput(
      [
        "[rank3] Traceback (most recent call last):",
        "[rank3] KeyError: 3",
        "[rank2] Traceback (most recent call last):",
        "[rank2] KeyError: 2",
        "During handling of the above exception, another exception occurred:",
        "Traceback (most recent call last):",
        "RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    expect(
      chainedA.firstFaultVerdict.timelineEvents?.find((e) => e.ruleId === "oom-stage-split")?.rank,
    ).toBeNull();
    expect(
      chainedA.firstFaultVerdict.timelineEvents?.find((e) => e.ruleId === "oom-stage-split")?.slotMappable,
    ).toBe(false);
    expect(
      chainedB.firstFaultVerdict.timelineEvents?.find((e) => e.ruleId === "oom-stage-split")?.rank,
    ).toBeNull();
    expect(
      chainedB.firstFaultVerdict.timelineEvents?.find((e) => e.ruleId === "oom-stage-split")?.slotMappable,
    ).toBe(false);
    expect(chainedA.findings[0]?.matchedLines[0]?.rank).toBeNull();
    expect(chainedB.findings[0]?.matchedLines[0]?.rank).toBeNull();

    // R5 P2-2: old segment timestamp order does not invalidate fault segment visibility map
    const segVis = analyzeTroubleshootInput(
      [
        "10:00:11 pid=42 ASCEND_RT_VISIBLE_DEVICES=0,1",
        "... [日志节选：下行起原行号 L100] ...",
        "10:00:01 pid=42 ASCEND_RT_VISIBLE_DEVICES=4,5",
        "10:00:02 pid=42 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(segVis.visibleDevices).toEqual([4, 5]);
    expect(segVis.firstFaultVerdict.slotMappable).toBe(true);

    // R5 P2-3: unanchored Dec-Jan same-rank errors are paste-order independent & medium confidence
    const decThenJan = analyzeTroubleshootInput(
      "12-31 23:59:50 [rank0] ERROR NPU out of memory\n01-01 00:00:05 [rank0] ERROR RoCE port 1 link down",
    );
    const janThenDec = analyzeTroubleshootInput(
      "01-01 00:00:05 [rank0] ERROR RoCE port 1 link down\n12-31 23:59:50 [rank0] ERROR NPU out of memory",
    );
    expect(decThenJan.findings.map((f) => f.ruleId)).toEqual(janThenDec.findings.map((f) => f.ruleId));
    expect(decThenJan.firstFaultVerdict.confidence).toBe("medium");
    expect(janThenDec.firstFaultVerdict.confidence).toBe("medium");

    // R5 P2-4: short-date 02-29 does not overflow into March 1
    const feb29ShortWait = analyzeTroubleshootInput(
      "02-29 16:00:00 [rank2] ERROR NPU out of memory\n03-01 06:00:00 [rank0] ERROR EI0002 waiting for rank 2",
    );
    expect(feb29ShortWait.firstFaultVerdict.rank).toBe(2);
    expect(feb29ShortWait.firstFaultVerdict.cascadeCausalState).toBe("confirmed-after");
    expect(feb29ShortWait.firstFaultVerdict.cascadeRanks).toEqual([0]);

    // R5 P2-5: date inside body prose after un-timestamped header does not invert causality
    const bodyHeartbeatDate = analyzeTroubleshootInput(
      "2026-04-18 10:00:00 [rank0] ERROR NPU out of memory\n[rank1] EI0002, last heartbeat reported by watchdog 2024-01-01 00:05:13",
    );
    expect(bodyHeartbeatDate.firstFaultVerdict.rank).toBe(0);
    expect(bodyHeartbeatDate.firstFaultVerdict.cascadeCausalState).not.toBe("earlier-than-primary");
    const waitEvt = bodyHeartbeatDate.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1);
    expect(waitEvt?.timestamp).toBeNull();

    // R5 P2-6 & P2-7: mixed timestamped startup blocks EL0004 dedup, while third-rank startup never un-demotes peer cascade
    const mixedElBoundary = analyzeTroubleshootInput(
      "[rank1] ERROR EL0004 Failed to allocate memory\n10:00:01 [rank1] INFO Application startup complete.\n[rank1] ERROR NPU out of memory",
    );
    expect(mixedElBoundary.findings.map((f) => f.ruleId)).toContain("cann-driver-or-device-env-fault");
    expect(mixedElBoundary.findings.map((f) => f.ruleId)).toContain("oom-stage-split");

    const thirdRankStartup = analyzeTroubleshootInput(
      [
        "10:00:00 [rank0] ERROR NPU out of memory",
        "10:00:01 [rank5] INFO Application startup complete.",
        "10:00:02 [rank1] RuntimeError: peer rank 0 exited",
      ].join("\n"),
    );
    expect(thirdRankStartup.firstFaultVerdict.rank).toBe(0);
    expect(thirdRankStartup.firstFaultVerdict.cascadeRanks).toEqual([1]);

    // R5 P2-8: 107030 abort corroboration invariant to which rank-1 line carries pid=17
    const pidOnAbort = analyzeTroubleshootInput(
      "10:00:01 [rank1] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess\n10:00:02 [rank1] pid=17 RuntimeError: worker aborted",
    );
    const pidOn107030 = analyzeTroubleshootInput(
      "10:00:01 [rank1] pid=17 ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess\n10:00:02 [rank1] RuntimeError: worker aborted",
    );
    expect(pidOnAbort.findings.map((f) => f.ruleId)).toContain("cann-plog-aicore-fault");
    expect(pidOn107030.findings.map((f) => f.ruleId)).toContain("cann-plog-aicore-fault");

    // R5 P2-9/10/11/12/13: Prom comments/signed ts, namespace & delimiter collision, Rule 8 _sum/_count/gpu_cache, quantiles, ADXL device_id
    const promCommentSigned = analyzeTroubleshootInput(
      [
        "# NPU out of memory errors are counted below",
        'vllm:requests_total{reason="NPU out of memory"} 0 -1000',
        "vllm:errors_total 0",
      ].join("\n"),
    );
    expect(promCommentSigned.inputKind).toBe("metrics");
    expect(promCommentSigned.findings).toEqual([]);
    expect(promCommentSigned.firstFaultVerdict.rank).toBeNull();

    const promNsIso = analyzeTroubleshootInput(
      [
        'vllm:kv_cache_usage_perc{pod="api-0",namespace="dev"} 0.99',
        'vllm:num_requests_waiting{pod="api-0",namespace="prod"} 2',
        'vllm:num_preemptions_total{pod="api-0",namespace="prod"} 8',
      ].join("\n"),
    );
    expect(promNsIso.findings[0]?.title).not.toContain("抢占 8 次");

    const promDelimIso = analyzeTroubleshootInput(
      [
        'vllm:kv_cache_usage_perc{instance="A|pod=B"} 0.99',
        'vllm:num_requests_waiting{instance="A",pod="B"} 3',
        'vllm:num_preemptions_total{instance="A",pod="B"} 7',
      ].join("\n"),
    );
    expect(promDelimIso.findings[0]?.title).not.toContain("抢占 7 次");

    const rule8SumCountGpu = analyzeTroubleshootInput(
      [
        "vllm:gpu_cache_usage_perc 0.2",
        "vllm:num_requests_waiting 0",
        'vllm:inter_token_latency_seconds_bucket{le="0.1"} 0',
        'vllm:inter_token_latency_seconds_bucket{le="0.2"} 0',
        'vllm:inter_token_latency_seconds_bucket{le="+Inf"} 2',
        "vllm:inter_token_latency_seconds_sum 2",
        "vllm:inter_token_latency_seconds_count 2",
      ].join("\n"),
    );
    const r8MatchedRaw = rule8SumCountGpu.findings[0]?.matchedLines.map((m) => m.rawLine) ?? [];
    expect(r8MatchedRaw.some((r) => r.includes("vllm:gpu_cache_usage_perc"))).toBe(true);
    expect(r8MatchedRaw.some((r) => r.includes("vllm:inter_token_latency_seconds_sum"))).toBe(true);
    expect(r8MatchedRaw.some((r) => r.includes("vllm:inter_token_latency_seconds_count"))).toBe(true);

    const summaryQuantileOnly = analyzeTroubleshootInput(
      '# TYPE vllm:inter_token_latency_seconds summary\nvllm:inter_token_latency_seconds{quantile="0.99"} 0.2',
    );
    expect(summaryQuantileOnly.metrics.itlAvgSec).toBeUndefined();
    expect(summaryQuantileOnly.findings).toEqual([]);

    const adxlDestDevices = analyzeTroubleshootInput(
      [
        "(APIServer pid=42) WARNING Dest buffer device_id=2 >= endpoint count 1",
        "(APIServer pid=42) WARNING Dest buffer device_id=3 >= endpoint count 1",
      ].join("\n"),
    );
    expect(adxlDestDevices.findings[0]?.ruleId).toBe("mooncake-adxl-endpoint-fallback");
    expect(adxlDestDevices.findings[0]?.title).not.toContain("多卡");

    // R5 P2-14/15/16 & R6 P3-4 & R7 P3-3 & R8 P3-1: sub-quadratic equal-total-work scaling (32x32=1024 vs 1x1024=1024 => 32x quadratic separation)
    const fmtClockMs = (baseSec: number, idx: number) => {
      const totalMs = baseSec * 1000 + idx;
      const sec = Math.floor(totalMs / 1000) % 60;
      const min = Math.floor(totalMs / 60_000) % 60;
      const hr = 10 + Math.floor(totalMs / 3_600_000);
      const ms = totalMs % 1000;
      return `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    };
    const buildTbContStress = (count: number) =>
      [
        ...Array.from(
          { length: count },
          (_, i) => `[rank0] pid=${100 + i} group=tb_open_${i} Traceback (most recent call last):`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `[rank0] group=tb_cont_${i}   File "worker.py", line ${i + 1}, in step`,
        ),
        "RuntimeError: NPU out of memory",
      ].join("\n");
    const buildPeerRestartStress = (count: number) =>
      [
        ...Array.from({ length: count }, (_, i) => `${fmtClockMs(0, i)} [rank0] ERROR NPU out of memory`),
        `${fmtClockMs(60, 0)} [rank0] INFO Application startup complete.`,
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(120, i)} [rank1] RuntimeError: peer rank 0 exited`,
        ),
      ].join("\n");
    const buildManyStartupsPeerStress = (count: number) =>
      [
        "10:00:00.000 [rank0] ERROR NPU out of memory",
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(60, i)} [rank0] INFO Application startup complete.`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(180, i)} [rank1] RuntimeError: peer rank 0 exited`,
        ),
      ].join("\n");
    const buildApiRecoveryStress = (count: number) =>
      [
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(0, i)} (APIServer pid=42) ERROR RuntimeError: transient retry ${i}`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(60, i)} (APIServer pid=42) INFO health check ok ${i}`,
        ),
        "10:05:00.000 [rank0] ERROR NPU out of memory",
      ].join("\n");
    const buildManyApiPidsRecoveryStress = (count: number) =>
      [
        ...Array.from({ length: count }, (_, i) => {
          const p = 1000 + i;
          return [
            `10:00:00.000 (APIServer pid=${p}) INFO Application startup complete.`,
            `10:00:01.000 (APIServer pid=${p}) ERROR RuntimeError: transient A`,
            `10:00:02.000 (APIServer pid=${p}) ERROR RuntimeError: transient B`,
            `10:00:03.000 (APIServer pid=${p}) INFO health check ok`,
          ].join("\n");
        }),
        "10:00:05.000 [rank0] ERROR NPU out of memory",
      ].join("\n");
    const buildBuffContStress = (count: number) =>
      [
        ...Array.from(
          { length: count },
          () => "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL",
        ),
        ...Array.from({ length: count }, () => "[rank0] ERROR expected 16 MiB"),
      ].join("\n");

    for (const [buildFn, checkFn] of [
      [
        buildTbContStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBeNull();
          expect(r.findings[0]?.ruleId).toBe("oom-stage-split");
        },
      ],
      [
        buildPeerRestartStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.cascadeRanks).toEqual([]);
          expect(r.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.kind).toBe("root-cause");
        },
      ],
      [
        buildManyStartupsPeerStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.cascadeRanks).toEqual([]);
          expect(r.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.kind).toBe("root-cause");
        },
      ],
      [
        buildApiRecoveryStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.confidence).toBe("high");
        },
      ],
      [
        buildManyApiPidsRecoveryStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.confidence).toBe("high");
        },
      ],
      [
        buildBuffContStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.findings[0]?.ruleId).toBe("moe-mc2-or-modelslim-quant-fault");
          expect(r.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
        },
      ],
    ] as const) {
      const s = buildFn(16);
      const l = buildFn(1024);
      analyzeTroubleshootInput(s);
      analyzeTroubleshootInput(l);
      const ts0 = performance.now();
      for (let k = 0; k < 64; k += 1) analyzeTroubleshootInput(s);
      const dtS = performance.now() - ts0;
      const tl0 = performance.now();
      const lRes = analyzeTroubleshootInput(l);
      const dtL = performance.now() - tl0;
      expect(dtL).toBeLessThan(Math.max(dtS, 10) * 4);
      checkFn(lRes);
    }

    // R5 P2-17 & P3-1: two PIDs with identical visibility keep both timeline events & accurate rationale/fixture label
    const sameVisTwoPids = analyzeTroubleshootInput(
      [
        "pid=11 ASCEND_RT_VISIBLE_DEVICES=2,3",
        "pid=22 ASCEND_RT_VISIBLE_DEVICES=2,3",
        "10:00:01 pid=11 [rank0] ERROR NPU out of memory",
        "10:00:01 pid=22 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(sameVisTwoPids.firstFaultVerdict.timelineEvents?.length).toBe(2);
    expect(sameVisTwoPids.firstFaultVerdict.rationale).not.toContain("多个不同的 ASCEND_RT_VISIBLE_DEVICES");

    const kvPreemptionFixture = TROUBLESHOOT_FIXTURES.find((f) => f.id === "metrics-kv-preemption");
    expect(kvPreemptionFixture?.label).toContain("累计抢占快照");
    expect(kvPreemptionFixture?.label).not.toContain("抢占风暴");
  });

  it("R6 closure suite: remediates all P1/P2/P3 edge regressions across rank/pid provenance, run boundaries, Prom poisoning, link/serial/NIC/BUFFSIZE, headline isolation, TB dedup, Rule 8 slots, and prose timestamps", () => {
    // R6 P1-1: multi-word exception operand does not leak reporting rank
    const multiWordExcOp = analyzeTroubleshootInput(
      "RuntimeError: failed to read tensor owned by worker rank 3",
    );
    expect(multiWordExcOp.firstFaultVerdict.rank).toBeNull();
    expect(multiWordExcOp.firstFaultVerdict.slotMappable).toBe(false);

    // R6 P1-2: body PID on ERROR line without Python Exception prefix does not adopt prior PID's rank
    const bodyPidErrorLine = analyzeTroubleshootInput(
      "[rank3] pid=42 INFO ready\n10:00:03 ERROR NPU out of memory copying tensor owned by pid=42",
    );
    expect(bodyPidErrorLine.firstFaultVerdict.rank).toBeNull();
    expect(bodyPidErrorLine.firstFaultVerdict.slotMappable).toBe(false);

    // R6 P1-3: undated sole visibility map across restart/omission + plog sub-ms reversed map stay unmapped
    const undatedRestartVis = analyzeTroubleshootInput(
      "pid=42 [rank0] ERROR NPU out of memory\npid=42 INFO Application startup complete.\npid=42 ASCEND_RT_VISIBLE_DEVICES=4,5",
    );
    expect(undatedRestartVis.visibleDevices).toBeNull();
    expect(undatedRestartVis.firstFaultVerdict.slotMappable).toBe(false);

    const earlierVisAcrossOmission = analyzeTroubleshootInput(
      "pid=42 ASCEND_RT_VISIBLE_DEVICES=4,5\n... [日志节选：已省略第 2–5 行；下行起原行号 L6] ...\npid=42 [rank0] ERROR NPU out of memory",
    );
    expect(earlierVisAcrossOmission.visibleDevices).toBeNull();
    expect(earlierVisAcrossOmission.firstFaultVerdict.slotMappable).toBe(false);

    const subMsReversedVis = analyzeTroubleshootInput(
      "2026-04-12-10:00:00.000.100 pid=42 [rank0] ERROR NPU out of memory\n2026-04-12-10:00:00.000.900 pid=42 INFO ASCEND_RT_VISIBLE_DEVICES=4,5",
    );
    expect(subMsReversedVis.visibleDevices).toBeNull();
    expect(subMsReversedVis.firstFaultVerdict.slotMappable).toBe(false);

    // R6 P1-4: shell comment or quoted NOTE does not override real ASCEND_RT_VISIBLE_DEVICES
    const shellCommentVis = analyzeTroubleshootInput(
      "export ASCEND_RT_VISIBLE_DEVICES=4,5 # previously ASCEND_RT_VISIBLE_DEVICES=0,1\n[rank0] ERROR NPU out of memory",
    );
    expect(shellCommentVis.visibleDevices).toEqual([4, 5]);
    const quotedNoteVis = analyzeTroubleshootInput(
      'export ASCEND_RT_VISIBLE_DEVICES=4,5 NOTE="previously ASCEND_RT_VISIBLE_DEVICES=0,1"\n[rank0] ERROR NPU out of memory',
    );
    expect(quotedNoteVis.visibleDevices).toEqual([4, 5]);

    // R6 P1-5 & P1-6 & P2-7: positive signed Prom timestamp, label NIC/startup suppression, and comment-only Prom exposition
    const posSignedProm = analyzeTroubleshootInput(
      'vllm:requests_total{reason="pid=42 [rank5] NPU out of memory"} 0 +1000\n10:00:01 pid=42 ERROR NPU out of memory',
    );
    expect(posSignedProm.firstFaultVerdict.rank).toBeNull();

    const promNicAndStartup = analyzeTroubleshootInput(
      [
        'vllm:errors_total{reason="Host NIC inventory: ethFAKE UP 192.0.2.11/24"} 0',
        "10:00:00 [rank0] ERROR NPU out of memory",
        "# NPU out of memory",
        'vllm:errors_total{reason="Application startup complete."} 0',
        "10:00:02 [rank1] ERROR RaSocketConnect peer rank 0 Connection refused",
        "10:00:03 ERROR RaSocket bind failed HCCL_IF_IP=192.0.2.33",
      ].join("\n"),
    );
    const r17PromNic = promNicAndStartup.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault")!;
    expect(r17PromNic.experimentStep).not.toContain("ethFAKE");
    expect(r17PromNic.experimentStep).not.toContain("192.0.2.11");
    expect(promNicAndStartup.firstFaultVerdict.rank).toBe(0);
    expect(promNicAndStartup.firstFaultVerdict.cascadeRanks).toContain(1);

    const commentOnlyProm = analyzeTroubleshootInput(
      "# HELP vllm:errors_total Total errors\n# NPU out of memory errors are counted below\n# TYPE vllm:errors_total counter",
    );
    expect(commentOnlyProm.findings).toEqual([]);
    expect(commentOnlyProm.firstFaultVerdict.timelineEvents).toEqual([]);
    expect(isRuleEvidenceLine("# NPU out of memory errors are counted below")).toBe(false);

    // R6 P1-7 & P1-8: colon-negated OOM & comma-separated 107030 + 507015
    const colonNegOom = analyzeTroubleshootInput(
      "[rank2] ERROR HCCL setup failed; NPU out of memory: not detected",
    );
    expect(colonNegOom.findings.some((f) => f.ruleId === "oom-stage-split")).toBe(false);

    const comma107030With507015 = analyzeTroubleshootInput(
      "[rank1] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess, rtMemcpy failed error code 507015",
    );
    expect(comma107030With507015.findings[0]?.ruleId).toBe("cann-plog-aicore-fault");
    expect(comma107030With507015.firstFaultVerdict.rank).toBe(1);

    // R6 P1-9: APIServer recovery in new epoch after omission/startup never clears earlier fatal error
    const apiEarlierFatalBeforeOmission = analyzeTroubleshootInput(
      [
        "10:00:00 (APIServer pid=42) ERROR FileNotFoundError: missing model weights",
        "... [日志节选：已省略第 2–8 行；下行起原行号 L9] ...",
        "10:00:01 (APIServer pid=42) INFO Application startup complete.",
        "10:00:02 (APIServer pid=42) ERROR RuntimeError: transient retry 1",
        "10:00:03 (APIServer pid=42) ERROR RuntimeError: transient retry 2",
        "10:00:04 (APIServer pid=42) INFO health ok",
        "10:00:05 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(apiEarlierFatalBeforeOmission.firstFaultVerdict.rank).toBeNull();

    // R6 P1-10 & P1-11: same-rank interleaved hccn_tool ambiguity & serial-port exclusion
    const sameRankHccnA = analyzeTroubleshootInput(
      "[rank0] hccn_tool -i 0 -link -g\n[rank0] hccn_tool -i 6 -link -g\nlink status: DOWN",
    );
    const sameRankHccnB = analyzeTroubleshootInput(
      "[rank0] hccn_tool -i 6 -link -g\n[rank0] hccn_tool -i 0 -link -g\nlink status: DOWN",
    );
    expect(sameRankHccnA.findings[0]?.ruleId).toBe("hccl-link-or-ifname-fault");
    expect(sameRankHccnA.findings[0]?.title).toBe(sameRankHccnB.findings[0]?.title);
    expect(sameRankHccnA.findings[0]?.title).not.toContain("设备 0");
    expect(sameRankHccnA.findings[0]?.title).not.toContain("设备 6");
    expect(sameRankHccnA.firstFaultVerdict.confidence).toBe("medium");

    const serialPortDown = analyzeTroubleshootInput("[rank2] ERROR serial port COM1 link status: DOWN");
    expect(serialPortDown.findings.some((f) => f.ruleId === "hccl-link-or-ifname-fault")).toBe(false);
    expect(serialPortDown.firstFaultVerdict.timelineEvents?.[0]?.mechanism).not.toBe("link-port-down");

    // R6 P1-12, P1-13 & P3-2: exact scoped NIC beats earlier unscoped NIC, Rule 19 no incompatible fallback, max BUFFSIZE across lines & strict > wording
    const exactNicBeatsUnscoped = analyzeTroubleshootInput(
      [
        "[node-P] INFO Host NIC inventory: ethX UP 192.0.2.11/24",
        "[node-P] instance=green group=g2 INFO Host NIC inventory: ethG UP 192.0.2.22/24",
        "[node-P] instance=green group=g2 ERROR RaSocket bind failed HCCL_IF_IP=192.0.2.33",
        "[node-D] instance=green group=g2 ERROR DispatchFFNCombine HCCL_BUFFSIZE is too SMALL, HCCL_BUFFSIZE=8MB, expected HCCL_BUFFSIZE=256 MiB",
      ].join("\n"),
    );
    for (const rId of ["hccl-link-or-ifname-fault", "moe-mc2-or-modelslim-quant-fault"] as const) {
      const f = exactNicBeatsUnscoped.findings.find((item) => item.ruleId === rId)!;
      expect(f.experimentStep).toContain("ethG");
      expect(f.experimentStep).toContain("192.0.2.22");
      expect(f.experimentStep).not.toContain("ethX");
      expect(f.experimentStep).not.toContain("192.0.2.11");
    }

    const r19NoIncompatFallback = analyzeTroubleshootInput(
      [
        "[node-P] instance=blue INFO Host NIC inventory: ethB UP 192.0.2.11/24",
        "[node-P] instance=blue ERROR RaSocket bind failed HCCL_IF_IP=192.0.2.33",
        "[node-D] instance=green ERROR DispatchFFNCombine HCCL_BUFFSIZE is too SMALL, HCCL_BUFFSIZE=8MB, expected HCCL_BUFFSIZE=256 MiB",
      ].join("\n"),
    );
    const r19NoCross = r19NoIncompatFallback.findings.find(
      (f) => f.ruleId === "moe-mc2-or-modelslim-quant-fault",
    )!;
    expect(r19NoCross.experimentStep).not.toContain("ethB");
    expect(r19NoCross.experimentStep).not.toContain("192.0.2.11");

    const multiBuffSameInst = analyzeTroubleshootInput(
      [
        "[node-P] instance=green ERROR RaSocket bind failed HCCL_IF_IP=192.0.2.33",
        "[node-P] instance=green INFO Host NIC inventory: ethG UP 192.0.2.22/24",
        "[node-D] instance=green ERROR DispatchFFNCombine HCCL_BUFFSIZE is too SMALL, HCCL_BUFFSIZE=8MB, expected HCCL_BUFFSIZE=64 MiB",
        "[node-D] instance=green ERROR DispatchFFNCombine HCCL_BUFFSIZE is too SMALL, HCCL_BUFFSIZE=8MB, expected HCCL_BUFFSIZE=384 MiB",
      ].join("\n"),
    );
    expect(
      multiBuffSameInst.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault")?.experimentStep,
    ).toContain("HCCL_BUFFSIZE=512");
    expect(
      multiBuffSameInst.findings.find((f) => f.ruleId === "moe-mc2-or-modelslim-quant-fault")?.experimentStep,
    ).toContain("HCCL_BUFFSIZE=512");

    const strictGtMinText = analyzeTroubleshootInput(
      "ERROR DispatchFFNCombine HCCL_BUFFSIZE is too SMALL, expected HCCL_BUFFSIZE > 256 MiB, HCCL_BUFFSIZE=8MB",
    );
    expect(strictGtMinText.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");
    expect(strictGtMinText.findings[0]?.experimentStep).toContain("大于 256 MiB");
    expect(strictGtMinText.findings[0]?.experimentStep).not.toContain("至少需 256 MiB");

    // R6 P1-14: undated unrelated instance never rewrites Rule 13 or Rule 20 headline
    const r13InstIso = analyzeTroubleshootInput(
      [
        "10:00:00 instance=A pid=11 [rank0] ERROR error code 507014",
        "instance=B pid=22 [rank0] ERROR Vector Core exception code 507035 fault kernel_name=OtherRunOnly",
      ].join("\n"),
    );
    expect(r13InstIso.findings[0]?.title).toContain("507014");
    expect(r13InstIso.findings[0]?.title).not.toContain("507035");
    expect(r13InstIso.findings[0]?.title).not.toContain("OtherRunOnly");

    const r20InstIso = analyzeTroubleshootInput(
      [
        "10:00:00 instance=A pid=11 [rank0] ERROR RuntimeError: Cannot find any model weights",
        "instance=B pid=22 [rank0] ERROR ImportError: libatb.so: cannot open shared object file",
      ].join("\n"),
    );
    expect(r20InstIso.findings[0]?.title).not.toContain("libatb.so");

    // R6 P2-1, P2-5, P2-6, P2-8, P2-9, P3-1
    const repeatedTb = analyzeTroubleshootInput(
      [
        "10:00:00 pid=42 [rank2] Traceback (most recent call last):",
        "10:00:00 pid=42 [rank2] Traceback (most recent call last):",
        "RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    expect(repeatedTb.firstFaultVerdict.rank).toBe(2);
    expect(repeatedTb.firstFaultVerdict.confidence).toBe("high");

    const newRunPeerDemoteGuard = analyzeTroubleshootInput(
      [
        "10:00:00 [rank1] RuntimeError: peer rank 0 exited",
        "... [日志节选：已省略第 2–5 行；下行起原行号 L6] ...",
        "[rank0] INFO Application startup complete.",
        "[rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(newRunPeerDemoteGuard.firstFaultVerdict.rank).toBe(1);
    expect(newRunPeerDemoteGuard.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.kind).toBe(
      "root-cause",
    );

    const rule8P99AndDenominator = analyzeTroubleshootInput(
      [
        "vllm:kv_cache_usage_perc 0.2",
        "vllm:num_requests_waiting 0",
        'vllm:inter_token_latency_seconds{quantile="0.99"} 0.9',
        "vllm:inter_token_latency_seconds_sum 2",
        "vllm:inter_token_latency_seconds_count 2",
        "vllm:time_to_first_token_seconds_sum 8",
        "vllm:time_to_first_token_seconds_count 2",
      ].join("\n"),
    );
    const r8Lines = rule8P99AndDenominator.findings[0]?.matchedLines.map((m) => m.lineNumber) ?? [];
    expect(r8Lines).toEqual([1, 2, 4, 5, 6, 7]);
    expect(r8Lines).not.toContain(3);

    const sharedGlobalVisTwoPids = analyzeTroubleshootInput(
      [
        "ASCEND_RT_VISIBLE_DEVICES=2,3",
        "10:00:01 pid=11 [rank0] ERROR NPU out of memory",
        "10:00:01 pid=22 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(sharedGlobalVisTwoPids.firstFaultVerdict.timelineEvents?.length).toBe(2);

    const noVisTwoInstRationale = analyzeTroubleshootInput(
      [
        "10:00:01 instance=A pid=11 [rank0] ERROR NPU out of memory",
        "10:00:01 instance=B pid=22 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(noVisTwoInstRationale.firstFaultVerdict.rationale).not.toContain("共享当前可见设备集合");

    const postFaultSingleMapRationale = analyzeTroubleshootInput(
      "10:00:00 pid=42 [rank0] ERROR NPU out of memory\n10:00:01 pid=42 ASCEND_RT_VISIBLE_DEVICES=2,3",
    );
    expect(postFaultSingleMapRationale.visibleDevices).toBeNull();
    expect(postFaultSingleMapRationale.firstFaultVerdict.rationale).not.toContain(
      "多个不同的 ASCEND_RT_VISIBLE_DEVICES",
    );

    const proseAllreduceDate = analyzeTroubleshootInput(
      "2026-04-12 10:00:00 [rank0] ERROR NPU out of memory\n[rank1] EI0002 (Previous ALLREDUCE 2024-01-01 00:05:13)",
    );
    expect(proseAllreduceDate.firstFaultVerdict.cascadeCausalState).not.toBe("earlier-than-primary");
    expect(proseAllreduceDate.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.kind).toBe(
      "unattributed-cascade",
    );
  });

  it("R7 closure suite: covers all P1/P2/P3 boundary, reset, Prom, HCCL, headline, scaling, and verdict edge cases", () => {
    // R7 P1-1 & P1-2: plain ERROR prose rank/pid leaks neither rank nor pid inheritance
    const plainProseRank = analyzeTroubleshootInput(
      "10:00:00 ERROR tensor owned by worker rank 3\n10:00:01 [rank0] ERROR NPU out of memory",
    );
    expect(plainProseRank.detectedRanks).toEqual([0]);
    expect(plainProseRank.firstFaultVerdict.rank).toBeNull();

    const soloProseRank = analyzeTroubleshootInput("ERROR tensor owned by worker rank 3 failed");
    expect(soloProseRank.detectedRanks).toEqual([]);
    expect(soloProseRank.firstFaultVerdict.rank).toBeNull();

    const proseParenPid = analyzeTroubleshootInput(
      "[rank1] pid=42 INFO worker init\n10:00:01 ERROR (tensor owned by pid=42) bad state",
    );
    expect(proseParenPid.firstFaultVerdict.rank).toBeNull();

    // R7 P1-3: worker exit resets visibleDevices across restart, while single clean launch preserves it
    const workerExitReset = analyzeTroubleshootInput(
      [
        "10:00:00 [rank0] ASCEND_RT_VISIBLE_DEVICES=2,3",
        "10:00:01 [rank0] INFO worker exited normally",
        "10:00:02 [rank0] INFO Application startup complete.",
        "10:00:05 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(workerExitReset.visibleDevices).toBeNull();
    expect(workerExitReset.firstFaultVerdict.slotMappable).toBe(false);
    expect(workerExitReset.firstFaultVerdict.confidence).toBe("medium");

    const cleanLaunchVis = analyzeTroubleshootInput(
      [
        "10:00:00 ASCEND_RT_VISIBLE_DEVICES=2,3",
        "10:00:02 INFO Application startup complete.",
        "10:00:05 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(cleanLaunchVis.visibleDevices).toEqual([2, 3]);
    expect(cleanLaunchVis.firstFaultVerdict.slotMappable).toBe(true);
    expect(cleanLaunchVis.firstFaultVerdict.confidence).toBe("high");

    // R7 P1-4: shell ;# comment & echo "..." literal never parse as visibleDevices, while export "..." does
    expect(
      analyzeTroubleshootInput(";# ASCEND_RT_VISIBLE_DEVICES=4,5\n10:00:00 [rank0] ERROR NPU out of memory")
        .visibleDevices,
    ).toBeNull();
    expect(
      analyzeTroubleshootInput(
        '10:00:00 echo "ASCEND_RT_VISIBLE_DEVICES=4,5"\n10:00:01 [rank0] ERROR NPU out of memory',
      ).visibleDevices,
    ).toBeNull();
    expect(
      analyzeTroubleshootInput(
        'export "ASCEND_RT_VISIBLE_DEVICES=2,3"\n10:00:01 [rank0] ERROR NPU out of memory',
      ).visibleDevices,
    ).toEqual([2, 3]);

    // R7 P1-5 & P3-2: wide whitespace in Prom sample & sampleless # HELP / # TYPE exposition
    const wideWsProm = analyzeTroubleshootInput(
      `vllm:num_preemptions_total 8${" ".repeat(110)}+1000\nvllm:kv_cache_usage_perc 0.99`,
    );
    expect(wideWsProm.metrics.hasMetrics).toBe(true);
    expect(wideWsProm.inputKind).toBe("metrics");

    const headerOnlyProm = analyzeTroubleshootInput(
      "# HELP vllm:kv_cache_usage_perc KV cache usage\n# TYPE vllm:kv_cache_usage_perc gauge",
    );
    expect(headerOnlyProm.inputKind).toBe("metrics");
    expect(headerOnlyProm.findings).toEqual([]);

    // R7 P1-6 & P1-7: negated OOM prose ("was not detected", "= not present") & 107030 ... and rtMemcpy failed
    const negatedWasNotDetected = analyzeTroubleshootInput(
      "[rank0] INFO NPU out of memory: was not detected\n[rank1] INFO OOM = not present",
    );
    expect(negatedWasNotDetected.findings).toEqual([]);
    expect(negatedWasNotDetected.firstFaultVerdict.rank).toBeNull();

    const compound107030And = analyzeTroubleshootInput(
      "10:00:00 [rank0] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT and Vector Core exception",
    );
    expect(compound107030And.findings[0]?.ruleId).toBe("cann-plog-aicore-fault");
    expect(compound107030And.findings[0]?.title).not.toContain("107030");
    expect(compound107030And.firstFaultVerdict.rank).toBe(0);
    expect(compound107030And.firstFaultVerdict.timelineEvents?.[0]?.mechanism).toBe("aicore-runtime");

    const compound107030Aicore = analyzeTroubleshootInput(
      "10:00:00 [rank0] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT and rtMemcpy failed ACL_ERROR_RT_AICORE_EXCEPTION",
    );
    expect(compound107030Aicore.findings[0]?.ruleId).toBe("cann-plog-aicore-fault");
    expect(compound107030Aicore.findings[0]?.title).not.toContain("107030");
    expect(compound107030Aicore.firstFaultVerdict.rank).toBe(0);
    expect(compound107030Aicore.firstFaultVerdict.timelineEvents?.[0]?.mechanism).toBe("aicore-runtime");

    const compound107030Mte = analyzeTroubleshootInput(
      "10:00:00 [rank0] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess and MTE accesses an invalid GM address",
    );
    expect(compound107030Mte.findings[0]?.ruleId).toBe("cann-plog-aicore-fault");
    expect(compound107030Mte.findings[0]?.title).not.toContain("107030");
    expect(compound107030Mte.firstFaultVerdict.timelineEvents?.[0]?.mechanism).toBe("aicore-runtime");

    // R7 P1-8: APIServer Application startup complete. does NOT count as recovery for prior retries
    const apiStartupNotRecovery = analyzeTroubleshootInput(
      [
        "10:00:00 (APIServer pid=42) ERROR RuntimeError: retry 1",
        "10:00:01 (APIServer pid=42) ERROR RuntimeError: retry 2",
        "10:00:02 (APIServer pid=42) INFO Application startup complete.",
        "10:00:05 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(apiStartupNotRecovery.firstFaultVerdict.rank).toBeNull();

    // R7 P1-9, P2-5 & P1-10: ambiguous hccn_tool slots, unlabelled UP preservation, SATA/PCIe port DOWN exclusion
    const multiHccnSameRank = analyzeTroubleshootInput(
      "[rank0] hccn_tool -i 2 -link -g\n[rank0] hccn_tool -i 6 -link -g\n[rank0] link status: DOWN",
    );
    expect(multiHccnSameRank.firstFaultVerdict.slotMappable).toBe(false);
    expect(multiHccnSameRank.firstFaultVerdict.confidence).toBe("medium");
    expect(multiHccnSameRank.firstFaultVerdict.timelineEvents?.[0]?.slotMappable).toBe(false);
    expect(multiHccnSameRank.findings[0]?.title).not.toContain("设备 2");
    expect(multiHccnSameRank.findings[0]?.title).not.toContain("设备 6");

    const unlabelledUpPreservesOtherCmd = analyzeTroubleshootInput(
      "[rank0] hccn_tool -i 2 -link -g\n[rank1] hccn_tool -i 6 -link -g\nlink status: UP\n[rank1] link status: DOWN",
    );
    expect(unlabelledUpPreservesOtherCmd.firstFaultVerdict.rank).toBe(1);
    expect(unlabelledUpPreservesOtherCmd.findings[0]?.title).toContain("设备 6");

    const nonNicPortDown = analyzeTroubleshootInput(
      "[rank0] ERROR SATA port id=1 link status: DOWN\n[rank1] ERROR PCIe device port 1 link status: DOWN",
    );
    expect(nonNicPortDown.findings.some((f) => f.ruleId === "hccl-link-or-ifname-fault")).toBe(false);
    expect(
      nonNicPortDown.firstFaultVerdict.timelineEvents?.some((e) => e.mechanism === "link-port-down"),
    ).toBe(false);

    // R7 P1-11, P1-12, P1-13 & P1-14: Rule 19 scoped NIC fallback, colon/split HCCL_BUFFSIZE, R13/R20 cross-host isolation
    const r19WrongInstNicBlocked = analyzeTroubleshootInput(
      [
        "instance=A Host NIC inventory: ethA UP 10.0.0.1/24",
        "instance=B [rank1] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, expected HCCL_BUFFSIZE=16MB",
        "ERROR RaSocketBind failed HCCL_IF_IP=10.0.0.99",
      ].join("\n"),
    );
    const r19WrongInstFinding = r19WrongInstNicBlocked.findings.find(
      (f) => f.ruleId === "moe-mc2-or-modelslim-quant-fault",
    )!;
    expect(r19WrongInstFinding.experimentStep).not.toContain("ethA");
    expect(r19WrongInstFinding.experimentStep).not.toContain("10.0.0.1");

    const colonBuff = analyzeTroubleshootInput(
      "[rank1] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, expected HCCL_BUFFSIZE: 384 MiB",
    );
    expect(colonBuff.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");

    const splitLineBuff = analyzeTroubleshootInput(
      "[rank1] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL\n[rank1] ERROR expected HCCL_BUFFSIZE > 384 MiB",
    );
    expect(splitLineBuff.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");
    expect(splitLineBuff.unmatchedErrorLines).toEqual([]);

    const r13CrossHostNo507015 = analyzeTroubleshootInput(
      "10:00:00 host=node-A [rank0] ERROR error code 507014 ACL_ERROR_RT_AICORE_TIMEOUT\nhost=node-B [rank1] ERROR 507035 ACL_ERROR_RT_VECTOR_CORE_EXCEPTION",
    );
    expect(r13CrossHostNo507015.findings[0]?.title).toContain("507014");
    expect(r13CrossHostNo507015.findings[0]?.title).not.toContain("507035");

    const r20CrossHostUndated = analyzeTroubleshootInput(
      "host=node-A [rank0] ERROR /dev/davinci0: No such file or directory\nhost=node-B [rank1] ERROR ImportError: libatb.so: cannot open shared object file",
    );
    expect(r20CrossHostUndated.findings[0]?.title).toContain("/dev/davinci*");
    expect(r20CrossHostUndated.findings[0]?.title).not.toContain("libatb.so");

    // R7 P2-1, P2-2, P2-3, P2-4, P2-6, P2-7, P2-8 & P3-1
    const tbInlineOwnedPid = analyzeTroubleshootInput(
      '[rank0] pid=11 Traceback (most recent call last):\n  File "a.py", line 1, in f\nRuntimeError: NPU out of memory copying tensor owned by pid=99',
    );
    expect(tbInlineOwnedPid.firstFaultVerdict.rank).toBe(0);
    expect(tbInlineOwnedPid.firstFaultVerdict.confidence).toBe("high");

    const promMidTraceback = analyzeTroubleshootInput(
      [
        "[rank0] Traceback (most recent call last):",
        '  File "a.py", line 1, in f',
        "# HELP vllm:kv_cache_usage_perc KV cache usage",
        "# TYPE vllm:kv_cache_usage_perc gauge",
        "vllm:kv_cache_usage_perc 0.5",
        "RuntimeError: NPU out of memory",
      ].join("\n"),
    );
    expect(promMidTraceback.firstFaultVerdict.rank).toBe(0);
    expect(promMidTraceback.findings[0]?.ruleId).toBe("oom-stage-split");

    const shellCommentRules = analyzeTroubleshootInput(
      "# NPU out of memory\n# DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL\n# RaSocketBind failed on eth0: EADDRNOTAVAIL",
    );
    expect(shellCommentRules.findings).toEqual([]);
    expect(shellCommentRules.firstFaultVerdict.timelineEvents).toEqual([]);

    expect(
      analyzeTroubleshootInput(
        "ASCEND_RT_VISIBLE_DEVICES=2,3\n10:00:01 [rank0] EI0002 Notify wait execute timeout",
      ).visibleDevices,
    ).toEqual([2, 3]);
    expect(
      analyzeTroubleshootInput(
        "10:00:01 [rank0] EI0002 Notify wait execute timeout\n10:00:05 ASCEND_RT_VISIBLE_DEVICES=2,3",
      ).visibleDevices,
    ).toBeNull();

    const simUnrankedCrossVis = analyzeTroubleshootInput(
      [
        "host=node-A ASCEND_RT_VISIBLE_DEVICES=0,1",
        "host=node-B ASCEND_RT_VISIBLE_DEVICES=2,3",
        "10:00:00 host=node-A [rank0] ERROR NPU out of memory",
        "10:00:00 host=node-B RuntimeError: startup failed",
      ].join("\n"),
    );
    expect(simUnrankedCrossVis.visibleDevices).toBeNull();

    const outOfOrderStartupPeer = analyzeTroubleshootInput(
      "10:00:03 [rank0] ERROR NPU out of memory\n10:00:01 [rank0] INFO Application startup complete.\n10:00:05 [rank1] RuntimeError: peer rank 0 exited",
    );
    expect(outOfOrderStartupPeer.firstFaultVerdict.cascadeRanks).toContain(1);
    expect(outOfOrderStartupPeer.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.kind).toBe(
      "confirmed-cascade",
    );

    const untsOmissionPeerFence = analyzeTroubleshootInput(
      [
        "10:00:00 [rank0] ERROR NPU out of memory",
        "... [日志节选：已省略第 2–5 行；下行起原行号 L6] ...",
        "[rank0] INFO Application startup complete.",
        "10:00:05 [rank1] RuntimeError: peer rank 0 exited",
      ].join("\n"),
    );
    expect(untsOmissionPeerFence.firstFaultVerdict.cascadeRanks).toEqual([]);
    expect(untsOmissionPeerFence.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.kind).toBe(
      "root-cause",
    );

    const parensProseHeaderColon = analyzeTroubleshootInput(
      "2026-04-12 10:00:00 [rank0] ERROR NPU out of memory\n[rank1] EI0002 ERROR (Previous ALLREDUCE): 2024-01-01 00:05:13",
    );
    expect(parensProseHeaderColon.firstFaultVerdict.cascadeCausalState).not.toBe("earlier-than-primary");

    const lateSamePidWithOtherPidVis = analyzeTroubleshootInput(
      "10:00:00 pid=11 [rank0] ERROR NPU out of memory\n10:00:03 pid=11 ASCEND_RT_VISIBLE_DEVICES=0,1\n10:00:03 pid=22 ASCEND_RT_VISIBLE_DEVICES=2,3",
    );
    expect(lateSamePidWithOtherPidVis.firstFaultVerdict.rationale).toContain("声明晚于首错");
    expect(lateSamePidWithOtherPidVis.firstFaultVerdict.rationale).not.toContain("多个不同的");

    // #78 contract parity: exclude device-id / worker-dp-pp from detectedRanks & propagate instanceTag + slotMappable mismatch on FaultTimelineEvent
    const devIdAndDpExcluded = analyzeTroubleshootInput(
      [
        "INFO Found NPU 15",
        "EngineCore_DP3 ERROR initializing",
        "10:00:00 [Rank 0] ERROR NPU out of memory",
        "10:00:05 [Rank 1] ERROR EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    expect(devIdAndDpExcluded.detectedRanks).toEqual([0, 1]);

    const multiInstPidInheritVis = analyzeTroubleshootInput(
      [
        "instance=A pid=201 INFO ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B pid=202 INFO ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 pid=201 [Rank 0] ERROR NPU out of memory",
        "10:00:02 pid=202 [Rank 1] ERROR EI0002 Notify wait execute timeout",
      ].join("\n"),
    );
    const instAEvt = multiInstPidInheritVis.firstFaultVerdict.timelineEvents?.find(
      (e) => e.instanceTag === "A",
    );
    const instBEvt = multiInstPidInheritVis.firstFaultVerdict.timelineEvents?.find(
      (e) => e.instanceTag === "B",
    );
    expect(instAEvt?.slotMappable).toBe(true);
    expect(instBEvt?.instanceTag).toBe("B");
    expect(instBEvt?.slotMappable).toBe(false);
  });

  it("R8 closure suite: closes all P1/P2/P3 analyzer boundary, PID epoch, negation, host, slot, BUFFSIZE, and APIServer regressions", () => {
    // R8 P1-1 & P1-2: body rank / RankID / Worker_TP and body HCCL(pid,python) never leak reporter rank/PID
    for (const line of [
      "10:00:03 ERROR NPU out of memory copying tensor owned by [rank3]",
      "10:00:03 ERROR NPU out of memory copying tensor RankID:3",
      "10:00:03 ERROR NPU out of memory received from Worker_TP3",
    ]) {
      const r = analyzeTroubleshootInput(line);
      expect(r.firstFaultVerdict.rank).toBeNull();
      expect(r.firstFaultVerdict.confidence).toBe("medium");
      expect(r.firstFaultVerdict.slotMappable).toBe(false);
    }

    const bodyClogsPid = analyzeTroubleshootInput(
      "[rank3] pid=42 INFO ready\n10:00:03 ERROR NPU out of memory copying cached record HCCL(42,python)",
    );
    expect(bodyClogsPid.firstFaultVerdict.rank).toBeNull();
    expect(bodyClogsPid.firstFaultVerdict.slotMappable).toBe(false);
    expect(extractRankMatch("[ERROR] HCCL(42,python): [Rank 3] ready")?.rank).toBe(3);

    // R8 P1-3 & P2-1: PID epoch fenced across worker exit, while unrelated pid=99 exit keeps pid=42 map
    const pidExitEpochFence = analyzeTroubleshootInput(
      [
        "10:00:00 pid=42 [rank3] INFO Application startup complete.",
        "10:00:00 pid=42 INFO ASCEND_RT_VISIBLE_DEVICES=4,5",
        "10:00:01 pid=42 INFO worker exited normally",
        "10:00:02 pid=42 INFO Application startup complete.",
        "10:00:03 pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(pidExitEpochFence.firstFaultVerdict.rank).toBeNull();
    expect(pidExitEpochFence.firstFaultVerdict.confidence).toBe("medium");
    expect(pidExitEpochFence.firstFaultVerdict.slotMappable).toBe(false);
    expect(pidExitEpochFence.visibleDevices).toBeNull();

    const otherPidExitPreservesVis = analyzeTroubleshootInput(
      [
        "pid=42 INFO ASCEND_RT_VISIBLE_DEVICES=4,5",
        "pid=99 INFO worker exited normally",
        "10:00:02 pid=42 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(otherPidExitPreservesVis.visibleDevices).toEqual([4, 5]);
    expect(otherPidExitPreservesVis.firstFaultVerdict.slotMappable).toBe(true);
    expect(otherPidExitPreservesVis.firstFaultVerdict.confidence).toBe("high");

    // R8 P1-4, P1-5, P1-6 & P2-4: unquoted echo arg, 67-char Prom zero, negated OOM prose, single-word (Previous): timestamp
    const echoUnquoted = analyzeTroubleshootInput(
      "export ASCEND_RT_VISIBLE_DEVICES=4,5; echo ASCEND_RT_VISIBLE_DEVICES=0,1\n[rank0] ERROR NPU out of memory",
    );
    expect(echoUnquoted.visibleDevices).toEqual([4, 5]);
    expect(echoUnquoted.firstFaultVerdict.slotMappable).toBe(true);

    const longZeroProm = analyzeTroubleshootInput(
      `vllm:errors_total{reason="pid=42 [rank5] NPU out of memory"} 0.${"0".repeat(65)}\n[rank0] ERROR NPU out of memory`,
    );
    expect(longZeroProm.inputKind).toBe("mixed");
    expect(longZeroProm.firstFaultVerdict.rank).toBe(0);

    for (const negLine of [
      "[rank2] ERROR HCCL setup failed; no evidence of NPU out of memory",
      "[rank2] ERROR HCCL setup failed; NPU out of memory was ruled out",
    ]) {
      const r = analyzeTroubleshootInput(negLine);
      expect(r.findings.some((f) => f.ruleId === "oom-stage-split")).toBe(false);
      expect(r.firstFaultVerdict.timelineEvents?.some((e) => e.mechanism === "memory-oom")).toBe(false);
    }

    const singleWordPreviousParen = analyzeTroubleshootInput(
      "2026-04-12 10:00:00 [rank0] ERROR NPU out of memory\n[rank1] (Previous): 2024-01-01 00:05:13 EI0002 Notify wait execute timeout",
    );
    expect(singleWordPreviousParen.firstFaultVerdict.cascadeCausalState).not.toBe("earlier-than-primary");

    // R8 P1-7 & P2-3: compound 107030 keeps Vector Core / MTE; shell comment never corroborates mla_preprocess 107030
    const unrankedCompound107030 = analyzeTroubleshootInput(
      "ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess and Vector Core exception",
    );
    expect(unrankedCompound107030.findings[0]?.ruleId).toBe("cann-plog-aicore-fault");
    expect(unrankedCompound107030.firstFaultVerdict.timelineEvents?.[0]?.mechanism).toBe("aicore-runtime");

    const shellCommentAbort = analyzeTroubleshootInput(
      "ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess\n# RuntimeError: worker aborted",
    );
    expect(shellCommentAbort.findings).toEqual([]);
    expect(shellCommentAbort.firstFaultVerdict.timelineEvents).toEqual([]);

    // R8 P1-8 & P2-2: HTTP 503 readiness != recovery; PID 99 startup never fences PID 42 recovery
    const probe503NotRecovery = analyzeTroubleshootInput(
      [
        "10:00:00 (APIServer pid=42) ERROR FileNotFoundError: weights missing",
        "10:00:01 (APIServer pid=42) ERROR FileNotFoundError: retry",
        "10:00:02 (APIServer pid=42) INFO readiness probe returned HTTP 503",
        "10:00:05 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(probe503NotRecovery.firstFaultVerdict.rank).toBeNull();
    expect(probe503NotRecovery.firstFaultVerdict.confidence).toBe("medium");

    const otherApiStartupNoFence = analyzeTroubleshootInput(
      [
        "10:00:00 (APIServer pid=42) ERROR RuntimeError: transient A",
        "10:00:01 (APIServer pid=42) ERROR RuntimeError: transient B",
        "10:00:02 (APIServer pid=99) INFO Application startup complete.",
        "10:00:03 (APIServer pid=42) INFO health check ok",
        "10:00:05 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(otherApiStartupNoFence.firstFaultVerdict.rank).toBe(0);
    expect(otherApiStartupNoFence.firstFaultVerdict.confidence).toBe("high");

    // R8 P1-9: hccn_tool device mismatch & rank >= visibleDevices.length block slotMappable
    const hccnMismatch = analyzeTroubleshootInput(
      "ASCEND_RT_VISIBLE_DEVICES=4,5\n[rank0] hccn_tool -i 6 -link -g\n[rank0] link status: DOWN",
    );
    expect(hccnMismatch.firstFaultVerdict.slotMappable).toBe(false);
    expect(hccnMismatch.firstFaultVerdict.confidence).toBe("medium");
    expect(hccnMismatch.firstFaultVerdict.timelineEvents?.[0]?.slotMappable).toBe(false);

    const rankOutOfMap = analyzeTroubleshootInput(
      "ASCEND_RT_VISIBLE_DEVICES=4,5\n10:00:00 [rank2] ERROR NPU out of memory",
    );
    expect(rankOutOfMap.firstFaultVerdict.slotMappable).toBe(false);
    expect(rankOutOfMap.firstFaultVerdict.confidence).toBe("medium");
    expect(rankOutOfMap.firstFaultVerdict.timelineEvents?.[0]?.slotMappable).toBe(false);

    // R8 P1-10 & P1-11: redacted colon hosts, node_rank fallback after host=, and untagged headline latch
    const redactedColonHosts = analyzeTroubleshootInput(
      "[REDACTED_IP_1]: 10:00:00 [rank0] ERROR 507014\n[REDACTED_IP_2]: 10:00:01 [rank1] ERROR 507035",
    );
    expect(redactedColonHosts.firstFaultVerdict.timelineEvents?.length).toBe(2);
    expect(redactedColonHosts.firstFaultVerdict.hostTag).toBe("[REDACTED_IP_1]");
    expect(redactedColonHosts.firstFaultVerdict.timelineEvents?.[1]?.hostTag).toBe("[REDACTED_IP_2]");
    expect(redactedColonHosts.findings[0]?.title).toContain("507014");
    expect(redactedColonHosts.findings[0]?.title).not.toContain("507035");

    const nodeRankVsHost = analyzeTroubleshootInput(
      "node_rank=0 host=node-A 10:00:00 ERROR 507014\nnode_rank=0 host=node-B 10:00:01 ERROR 507035",
    );
    expect(nodeRankVsHost.firstFaultVerdict.hostTag).toBe("node-A");
    expect(nodeRankVsHost.firstFaultVerdict.timelineEvents?.length).toBe(2);
    expect(nodeRankVsHost.firstFaultVerdict.timelineEvents?.[1]?.hostTag).toBe("node-B");

    const untaggedAnchorR13 = analyzeTroubleshootInput(
      "10:00:00 ERROR 507014\n10:00:01 host=node-A ERROR 507035\n10:00:02 host=node-B ERROR 507015",
    );
    expect(untaggedAnchorR13.findings[0]?.title).not.toContain("507015 / 507035");
    expect(untaggedAnchorR13.findings[0]?.title).not.toContain("507015");

    const untaggedAnchorR20 = analyzeTroubleshootInput(
      "10:00:00 ERROR EL0004 allocate failed\n10:00:01 host=node-A ERROR error code is 107005\n10:00:02 host=node-B ERROR ImportError: libatb.so: cannot open shared object file",
    );
    expect(untaggedAnchorR20.findings[0]?.title).not.toContain("libatb.so");
    expect(untaggedAnchorR20.findings[0]?.summary).not.toContain("libatb.so");

    const untaggedAnchorR20NotFound = analyzeTroubleshootInput(
      "10:00:00 ERROR EL0004 allocate failed\n10:00:01 host=node-A ERROR error code is 107005\n10:00:02 host=node-B ERROR libatb.so not found",
    );
    expect(untaggedAnchorR20NotFound.findings[0]?.title).not.toContain("libatb.so");
    expect(untaggedAnchorR20NotFound.findings[0]?.summary).not.toContain("libatb.so");

    const sameHostAnchorR20 = analyzeTroubleshootInput(
      "10:00:00 ERROR EL0004 allocate failed\n10:00:01 host=node-A ERROR error code is 107005\n10:00:02 host=node-A ERROR ImportError: libatb.so: cannot open shared object file",
    );
    expect(`${sameHostAnchorR20.findings[0]?.title} ${sameHostAnchorR20.findings[0]?.summary}`).toContain(
      "libatb.so",
    );

    // R8 P1-12, P1-13, P1-14 & P2-5: BUFFSIZE phrasings/units, cross-host isolation, host memory rejection, split citation parity
    for (const reqText of [
      "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL; HCCL_BUFFSIZE must be at least 384 MiB",
      "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL; expected HCCL_BUFFSIZE >= 393216 KiB",
    ]) {
      expect(analyzeTroubleshootInput(reqText).findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");
    }

    const crossHostBuff = analyzeTroubleshootInput(
      [
        "10:00:00 host=node-A [rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL",
        "10:00:00 host=node-A [rank0] ERROR expected 128 MiB",
        "10:00:01 host=node-B [rank1] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL",
        "10:00:01 host=node-B [rank1] ERROR expected HCCL_BUFFSIZE >= 1024 MiB",
      ].join("\n"),
    );
    expect(crossHostBuff.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
    expect(crossHostBuff.findings[0]?.experimentStep).not.toContain("1024");

    const crossHostBuffContOnly = analyzeTroubleshootInput(
      [
        "10:00:00 host=node-A [rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL",
        "10:00:00 host=node-A [rank0] ERROR expected 128 MiB",
        "10:00:01 host=node-B [rank1] ERROR expected HCCL_BUFFSIZE >= 1024 MiB",
      ].join("\n"),
    );
    expect(crossHostBuffContOnly.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
    expect(crossHostBuffContOnly.findings[0]?.experimentStep).not.toContain("1024");

    const hostMemNotBuff = analyzeTroubleshootInput(
      "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL\n[rank0] INFO expected 2 GiB of host memory",
    );
    expect(hostMemNotBuff.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
    expect(hostMemNotBuff.findings[0]?.experimentStep).not.toContain("2048");

    const splitBuffParity = analyzeTroubleshootInput(
      "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL\nexpected HCCL_BUFFSIZE > 384 MiB",
    );
    expect(splitBuffParity.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");
    expect(splitBuffParity.findings[0]?.matchedLines.length).toBe(2);
    expect(splitBuffParity.unmatchedErrorLines).toEqual([]);
    expect(isRuleEvidenceLine("expected HCCL_BUFFSIZE > 384 MiB")).toBe(true);
  });

  it("R9 closure suite: covers all 16 P1s and 9 P2s across header/body boundaries, PID epochs, shell/Prom/negation, APIServer resets, hccn parity, and BUFFSIZE rules", () => {
    // R9 P1 #1 & #2: body rank, quoted CANN tuple, and prose parens never forge rank or PID reporter
    expect(
      analyzeTroubleshootInput("10:00:03 NPU out of memory copying tensor owned by [rank3]").firstFaultVerdict
        .rank,
    ).toBeNull();
    expect(
      analyzeTroubleshootInput(
        '10:00:03 ERROR NPU out of memory copying record "(PID:42, Device:0, RankID:3)"',
      ).firstFaultVerdict.rank,
    ).toBeNull();
    expect(
      analyzeTroubleshootInput(
        "[rank3] pid=42 INFO ready\n10:00:03 ERROR (worker inspected HCCL(42,python)) NPU out of memory",
      ).firstFaultVerdict.rank,
    ).toBeNull();
    expect(
      analyzeTroubleshootInput(
        "[rank3] pid=42 INFO ready\n10:00:03 ERROR (Worker referenced pid=42) NPU out of memory",
      ).firstFaultVerdict.rank,
    ).toBeNull();

    // R9 P1 #3: host & instance isolate PID epochs on both exit and startup
    const hostEpochExit = analyzeTroubleshootInput(
      [
        "10:00:00 host=A [rank1] pid=42 INFO ready",
        "10:00:01 host=B [rank3] pid=42 INFO ready",
        "10:00:02 host=B pid=42 INFO worker exited normally",
        "10:00:03 host=B Application startup complete.",
        "10:00:04 host=B pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(hostEpochExit.firstFaultVerdict.rank).toBeNull();

    const instEpochIsolation = analyzeTroubleshootInput(
      [
        "10:00:00 instance=A [rank1] pid=42 INFO ready",
        "10:00:01 instance=B [rank3] pid=42 INFO ready",
        "10:00:02 instance=A pid=42 INFO worker exited normally",
        "10:00:03 instance=B pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(instEpochIsolation.firstFaultVerdict.rank).toBe(3);

    // R9 P1 #4: comma without space in CANN tuple matches comma with space
    const compactTuple = analyzeTroubleshootInput(
      "(PID:42,Device:0,RankID:3): 10:00:00 ERROR NPU out of memory\n[rank1] 10:00:01 ERROR 507035",
    );
    expect(compactTuple.firstFaultVerdict.rank).toBe(3);

    // R9 P1 #5: shell printing wrappers never override physical export
    const quotedEchoVis = analyzeTroubleshootInput(
      'export ASCEND_RT_VISIBLE_DEVICES=4,5; echo export "ASCEND_RT_VISIBLE_DEVICES=0,1"\n10:00:00 [rank0] ERROR NPU out of memory',
    );
    expect(quotedEchoVis.visibleDevices).toEqual([4, 5]);
    const cmdPrintfVis = analyzeTroubleshootInput(
      "export ASCEND_RT_VISIBLE_DEVICES=4,5\ncommand printf '%s\\n' ASCEND_RT_VISIBLE_DEVICES=0,1\n10:00:00 [rank0] ERROR NPU out of memory",
    );
    expect(cmdPrintfVis.visibleDevices).toEqual([4, 5]);

    // R9 P1 #6: queried hccn_tool device mismatch blocks mapping even without declared ASCEND_RT_VISIBLE_DEVICES
    const noVisHccnMismatch = analyzeTroubleshootInput(
      "[rank0] hccn_tool -i 6 -link -g\n[rank0] link status: DOWN",
    );
    expect(noVisHccnMismatch.firstFaultVerdict.rank).toBe(0);
    expect(noVisHccnMismatch.firstFaultVerdict.slotMappable).toBe(false);
    expect(noVisHccnMismatch.firstFaultVerdict.confidence).toBe("medium");
    expect(noVisHccnMismatch.firstFaultVerdict.timelineEvents?.[0]?.slotMappable).toBe(false);
    expect(noVisHccnMismatch.firstFaultVerdict.rationale).not.toContain("与当前 ASCEND_RT_VISIBLE_DEVICES");

    // R9 P1 #7: >4096-char Prometheus line & isRuleEvidenceLine parity
    const longPromLine = `vllm:errors_total{reason="pid=42 [rank5] NPU out of memory"} 0.${"0".repeat(4095)}`;
    const longPromRes = analyzeTroubleshootInput(longPromLine);
    expect(longPromRes.inputKind).toBe("metrics");
    expect(longPromRes.findings).toEqual([]);
    expect(longPromRes.firstFaultVerdict.rank).toBeNull();
    expect(isRuleEvidenceLine(longPromLine)).toBe(false);

    const longDiagPromLine = `vllm:num_preemptions_total{reason="pid=42 [rank5] NPU out of memory"} 0.${"0".repeat(4095)}`;
    const longDiagPromRes = analyzeTroubleshootInput(longDiagPromLine);
    expect(longDiagPromRes.inputKind).toBe("metrics");
    expect(longDiagPromRes.findings).toEqual([]);
    expect(longDiagPromRes.firstFaultVerdict.rank).toBeNull();
    expect(isRuleEvidenceLine(longDiagPromLine)).toBe(true);

    // R9 P1 #8 & #9: determiner-extended negations suppress OOM and 107030 compound stripping
    const negAnyOom = analyzeTroubleshootInput("[rank2] INFO no evidence of any NPU out of memory");
    expect(negAnyOom.findings).toEqual([]);
    expect(negAnyOom.firstFaultVerdict.rank).toBeNull();
    expect(isRuleEvidenceLine("[rank2] INFO no evidence of any NPU out of memory")).toBe(false);

    const negVector107030 = analyzeTroubleshootInput(
      "[rank0] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess; no evidence of Vector Core exception",
    );
    expect(negVector107030.findings).toEqual([]);
    expect(negVector107030.firstFaultVerdict.rank).toBeNull();

    // R9 P1 #10 & #11: HTTP 401/403, pending probe, and process exited normally block false APIServer recovery
    for (const nonRecovery of [
      "10:00:02.000 (APIServer pid=42) INFO readiness probe returned HTTP 403",
      "10:00:02.000 (APIServer pid=42) INFO readiness probe returned HTTP 401",
      "10:00:02.000 (APIServer pid=42) INFO health check pending",
    ]) {
      const res = analyzeTroubleshootInput(
        [
          "10:00:00.000 (APIServer pid=42) ERROR FileNotFoundError: config A",
          "10:00:01.000 (APIServer pid=42) ERROR FileNotFoundError: config B",
          nonRecovery,
          "10:00:05.000 [rank0] ERROR NPU out of memory",
        ].join("\n"),
      );
      expect(res.firstFaultVerdict.rank).toBeNull();
      expect(res.firstFaultVerdict.confidence).toBe("medium");
    }

    const exitedBetweenApi = analyzeTroubleshootInput(
      [
        "10:00:00.000 (APIServer pid=42) ERROR FileNotFoundError: config A",
        "10:00:01.000 (APIServer pid=42) ERROR FileNotFoundError: config B",
        "10:00:02.000 (APIServer pid=42) INFO process exited normally",
        "10:00:03.000 (APIServer pid=42) INFO health check ok",
        "10:00:05.000 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(exitedBetweenApi.firstFaultVerdict.rank).toBeNull();
    expect(exitedBetweenApi.firstFaultVerdict.confidence).toBe("medium");

    // R9 P1 #12: prose host=node-B after redacted prefix never steals reporter host
    const redactedWithCopyHost = analyzeTroubleshootInput(
      [
        "[REDACTED_IP_1]: 10:00:00 [rank0] ERROR 507014 while copying from host=node-B",
        "[REDACTED_IP_2]: 10:00:01 [rank1] ERROR 507035 while copying from host=node-B",
      ].join("\n"),
    );
    expect(redactedWithCopyHost.firstFaultVerdict.hostTag).toBe("[REDACTED_IP_1]");
    expect(redactedWithCopyHost.findings[0]?.title).toContain("507014");
    expect(redactedWithCopyHost.findings[0]?.title).not.toContain("507035");

    // R9 P1 #13 & #14: byte-unit BuffSize conversion + host=A metadata vs host memory rejection
    const bytesBuff = analyzeTroubleshootInput(
      "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL; expected HCCL_BUFFSIZE >= 536870912 bytes; expected 2 GiB of host memory",
    );
    expect(bytesBuff.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");
    expect(bytesBuff.findings[0]?.experimentStep).not.toContain("HCCL_BUFFSIZE=536870912");
    expect(bytesBuff.findings[0]?.experimentStep).not.toContain("2048");

    const sameHostShortCont = analyzeTroubleshootInput(
      "10:00:00 host=A [rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL\n10:00:00 host=A [rank0] ERROR expected 384 MiB",
    );
    expect(sameHostShortCont.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");
    expect(sameHostShortCont.findings[0]?.matchedLines.length).toBe(2);
    expect(sameHostShortCont.unmatchedErrorLines).toEqual([]);

    // R9 P1 #15: Rule 17 prefers own-host & deterministic domain regardless of paste order
    const r17LinesCommon = [
      "10:00:00 host=A INFO Host NIC inventory: eth0 UP 10.0.0.10",
      "10:00:01 host=A [rank0] ERROR RaSocketBind failed HCCL_IF_IP=10.0.0.99",
    ];
    const r17BufA =
      "10:00:02 host=A [rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL; expected 128 MiB";
    const r17BufB =
      "10:00:02 host=B [rank1] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL; expected 1024 MiB";
    for (const ordered of [
      [...r17LinesCommon, r17BufA, r17BufB],
      [...r17LinesCommon, r17BufB, r17BufA],
    ]) {
      const r17 = analyzeTroubleshootInput(ordered.join("\n"));
      const r17Finding = r17.findings.find((f) => f.ruleId === "hccl-link-or-ifname-fault");
      expect(r17Finding?.experimentStep).toContain("HCCL_BUFFSIZE=128");
      expect(r17Finding?.experimentStep).not.toContain("1024");
    }

    // R9 P1 #16: Rule 19 latches host domain from untagged anchor
    const r19UntaggedLatch = analyzeTroubleshootInput(
      [
        "10:00:00 [rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL",
        "10:00:01 host=A [rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL; expected 128 MiB",
        "10:00:02 host=B [rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL; expected 1024 MiB",
      ].join("\n"),
    );
    expect(r19UntaggedLatch.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
    expect(r19UntaggedLatch.findings[0]?.experimentStep).not.toContain("1024");

    // R9 P2 #1-#5: comment hostTag ignored, should-be-BUFFSIZE evidence parity, 107030+HCCL 9 timeline, Rule 13/20 PID latch, libatb not found
    const commentHostOom = analyzeTroubleshootInput("# host=node-fake\n[rank0] ERROR NPU out of memory");
    expect(commentHostOom.firstFaultVerdict.confidence).toBe("high");
    expect(commentHostOom.firstFaultVerdict.slotMappable).toBe(true);

    expect(isRuleEvidenceLine("HCCL_BUFFSIZE should be >= 384 MiB")).toBe(true);
    expect(isRuleEvidenceLine("expected HCCL_BUFFSIZE >= 536870912 bytes")).toBe(true);

    const compound107030Hccl9 = analyzeTroubleshootInput(
      "[rank0] ERROR rtMemcpy error code 107030 during graph mode torch.ops._C_ascend.mla_preprocess and HCCL error: 9",
    );
    expect(compound107030Hccl9.findings.some((f) => f.ruleId === "hccl-timeout-cascade")).toBe(true);
    expect(
      compound107030Hccl9.firstFaultVerdict.timelineEvents?.some((e) => e.mechanism === "wait-cascade"),
    ).toBe(true);

    const pidLatchedR13 = analyzeTroubleshootInput(
      "10:00:00 ERROR 507014\n10:00:01 pid=42 ERROR 507035\n10:00:02 pid=99 ERROR 507015",
    );
    expect(pidLatchedR13.findings[0]?.title).toContain("507035");
    expect(pidLatchedR13.findings[0]?.title).not.toContain("507015");

    const pidLatchedR20 = analyzeTroubleshootInput(
      "10:00:00 ERROR EL0004 allocate failed\n10:00:01 pid=42 ERROR error code is 107005\n10:00:02 pid=99 ERROR libatb.so not found",
    );
    expect(`${pidLatchedR20.findings[0]?.title} ${pidLatchedR20.findings[0]?.summary}`).not.toContain(
      "libatb.so",
    );

    const libatbNotFound = analyzeTroubleshootInput("ERROR libatb.so not found");
    expect(libatbNotFound.findings[0]?.ruleId).toBe("cann-driver-or-device-env-fault");
    expect(libatbNotFound.unmatchedErrorLines).toEqual([]);

    // Coordinator #85 contract: activeScopeDetectedRanks & FirstFaultVerdict.instanceTag
    const multiInstWithoutReady = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:01 ERROR instance=A [Rank 0] NPU out of memory",
        "10:00:02 ERROR instance=B [Rank 1] RaSocketBind failed on eth0: EADDRNOTAVAIL",
      ].join("\n"),
    );
    expect(multiInstWithoutReady.detectedRanks).toEqual([0, 1]);
    expect(multiInstWithoutReady.activeScopeDetectedRanks).toEqual([0]);
    expect(multiInstWithoutReady.visibleDevices).toEqual([4, 5]);
    expect(multiInstWithoutReady.firstFaultVerdict.instanceTag).toBe("A");

    const multiInstWithReady = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 INFO instance=A [Rank 1] worker ready",
        "10:00:00 INFO instance=A device=2 standby ignored",
        "10:00:00 INFO instance=A EngineCore_DP3 coordinator ignored",
        "10:00:01 ERROR instance=A [Rank 0] NPU out of memory",
        "10:00:02 ERROR instance=B [Rank 1] RaSocketBind failed on eth0: EADDRNOTAVAIL",
      ].join("\n"),
    );
    expect(multiInstWithReady.detectedRanks).toEqual([0, 1]);
    expect(multiInstWithReady.activeScopeDetectedRanks).toEqual([0, 1]);
    expect(multiInstWithReady.visibleDevices).toEqual([4, 5]);
    expect(multiInstWithReady.firstFaultVerdict.instanceTag).toBe("A");

    const multiInstUntaggedReadyExcluded = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 INFO [Rank 1] worker ready",
        "10:00:01 ERROR instance=A [Rank 0] NPU out of memory",
        "10:00:02 ERROR instance=B [Rank 1] RaSocketBind failed on eth0: EADDRNOTAVAIL",
      ].join("\n"),
    );
    expect(multiInstUntaggedReadyExcluded.activeScopeDetectedRanks).toEqual([0]);

    const multiInstSiblingPidReady = analyzeTroubleshootInput(
      [
        "instance=A pid=100 ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B pid=200 ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 INFO instance=A pid=101 [Rank 1] worker ready",
        "10:00:01 ERROR instance=A pid=100 [Rank 0] NPU out of memory",
        "10:00:02 ERROR instance=B pid=200 [Rank 1] link down",
      ].join("\n"),
    );
    expect(multiInstSiblingPidReady.activeScopeDetectedRanks).toEqual([0, 1]);

    const multiInstCrossTieUndefined = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:01 ERROR instance=A [Rank 0] NPU out of memory",
        "10:00:01 ERROR instance=B [Rank 1] NPU out of memory",
      ].join("\n"),
    );
    expect(multiInstCrossTieUndefined.activeScopeDetectedRanks).toBeUndefined();

    const singleScopeUndefined = analyzeTroubleshootInput(
      "ASCEND_RT_VISIBLE_DEVICES=4,5\n10:00:00 INFO [Rank 1] worker ready\n10:00:01 ERROR [Rank 0] NPU out of memory",
    );
    expect(singleScopeUndefined.detectedRanks).toEqual([0, 1]);
    expect(singleScopeUndefined.activeScopeDetectedRanks).toBeUndefined();
  });

  it("R9 scaling closure: keeps O(N log N) latency across multi-host visibility, host-tagged peer startups, shared/unscoped APIServer, and PID-epoch workloads", () => {
    const fmtClockMs = (baseSec: number, idx: number) => {
      const totalMs = baseSec * 1000 + idx;
      const sec = Math.floor(totalMs / 1000) % 60;
      const min = Math.floor(totalMs / 60_000) % 60;
      const hr = 10 + Math.floor(totalMs / 3_600_000);
      const ms = totalMs % 1000;
      return `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    };
    const buildHostAndUnscopedVisStress = (count: number) =>
      [
        ...Array.from(
          { length: count },
          (_, i) => `10:00:00 INFO unscoped_pool_${i} ASCEND_RT_VISIBLE_DEVICES=0,1`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `10:00:00 host=node_${i} INFO scoped_pool_${i} ASCEND_RT_VISIBLE_DEVICES=0,1`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `10:00:01 host=node_${i} pid=${500 + i} [rank0] ERROR NPU out of memory`,
        ),
      ].join("\n");
    const buildHostTaggedPeerStartupsStress = (count: number) =>
      [
        "10:00:00.000 [rank0] ERROR NPU out of memory",
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(60, i)} host=node_${i} [rank0] INFO Application startup complete.`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(180, i)} [rank1] RuntimeError: peer rank 0 exited`,
        ),
      ].join("\n");
    const buildSharedPidMultiHostApiStress = (count: number) =>
      [
        ...Array.from({ length: count }, (_, i) =>
          [
            `10:00:00.000 host=node_${i} (APIServer pid=42) INFO Application startup complete.`,
            `10:00:01.000 host=node_${i} (APIServer pid=42) ERROR RuntimeError: transient A`,
            `10:00:02.000 host=node_${i} (APIServer pid=42) ERROR RuntimeError: transient B`,
            `10:00:03.000 host=node_${i} (APIServer pid=42) INFO health check ok`,
          ].join("\n"),
        ),
        "10:00:05.000 [rank0] ERROR NPU out of memory",
      ].join("\n");
    const buildDistinctHostApiUnscopedStartupsStress = (count: number) =>
      [
        ...Array.from({ length: count }, () => "10:00:00.000 INFO Application startup complete."),
        ...Array.from({ length: count }, (_, i) => {
          const p = 1000 + i;
          return [
            `10:00:01.000 host=node_${i} (APIServer pid=${p}) ERROR RuntimeError: transient A`,
            `10:00:02.000 host=node_${i} (APIServer pid=${p}) ERROR RuntimeError: transient B`,
            `10:00:03.000 host=node_${i} (APIServer pid=${p}) INFO health check ok`,
          ].join("\n");
        }),
        "10:00:05.000 [rank0] ERROR NPU out of memory",
      ].join("\n");
    const buildPidEpochCrossHostStartupsStress = (count: number) =>
      [
        ...Array.from(
          { length: count },
          (_, i) => `10:00:00.000 host=node_${i} pid=${1000 + i} [rank0] INFO ready`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `10:00:01.000 host=other_${i} INFO Application startup complete.`,
        ),
        "10:00:02.000 host=node_0 pid=1000 RuntimeError: NPU out of memory",
      ].join("\n");

    for (const [buildFn, checkFn] of [
      [
        buildHostAndUnscopedVisStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.visibleDevices).toEqual([0, 1]);
          expect(r.firstFaultVerdict.rank).toBe(0);
        },
      ],
      [
        buildHostTaggedPeerStartupsStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.cascadeRanks).toEqual([]);
          expect(r.firstFaultVerdict.timelineEvents?.find((e) => e.rank === 1)?.kind).toBe("root-cause");
        },
      ],
      [
        buildSharedPidMultiHostApiStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.confidence).toBe("medium");
        },
      ],
      [
        buildDistinctHostApiUnscopedStartupsStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.confidence).toBe("medium");
        },
      ],
      [
        buildPidEpochCrossHostStartupsStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
        },
      ],
    ] as const) {
      const s = buildFn(16);
      const l = buildFn(1024);
      analyzeTroubleshootInput(s);
      analyzeTroubleshootInput(l);
      const ts0 = performance.now();
      for (let k = 0; k < 64; k += 1) analyzeTroubleshootInput(s);
      const dtS = performance.now() - ts0;
      const tl0 = performance.now();
      const lRes = analyzeTroubleshootInput(l);
      const dtL = performance.now() - tl0;
      expect(dtL).toBeLessThan(Math.max(dtS, 10) * 4);
      checkFn(lRes);
    }
  }, 60_000);

  it("R10 closure suite: remediates all 10 P1s and active-scope P2 #1-#3 across quoted PID, compact headers, PID startups/exits, shell wrappers, health probes, BUFFSIZE commas, Rule 17/instance provenance, and #85 edges", () => {
    // R10 P1 #1: quoted CANN tuple in exception body must not assign PID reporter
    const quotedPidBody = analyzeTroubleshootInput(
      '[rank6] pid=42 INFO ready\n10:00:03 ERROR NPU out of memory copying record "(PID:42, Device:0, RankID:3)"',
    );
    expect(quotedPidBody.firstFaultVerdict.rank).toBeNull();
    expect(quotedPidBody.firstFaultVerdict.slotMappable).toBe(false);
    expect(
      analyzeTroubleshootInput("10:00:03 ERROR (PID:42, Device:0, RankID:3) NPU out of memory")
        .firstFaultVerdict.rank,
    ).toBe(3);

    // R10 P1 #2: compact (Rank3, pid=42) matches spaced (Rank 3, pid=42)
    const compactRankPid = analyzeTroubleshootInput(
      "(Rank3, pid=42) 10:00:01 ERROR NPU out of memory\n[rank1] 10:00:02 ERROR 507035",
    );
    expect(compactRankPid.firstFaultVerdict.rank).toBe(3);
    expect(compactRankPid.firstFaultVerdict.primaryEvidenceLines[0]?.timestamp).toBe("10:00:01");

    // R10 P1 #3: second startup clears prior clean INFO rank registration, while single boot preserves rank
    const secondStartupClearsInfoRank = analyzeTroubleshootInput(
      [
        "instance=B INFO Application startup complete.",
        "instance=B [rank3] pid=42 INFO ready",
        "instance=B INFO Application startup complete.",
        "instance=B pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(secondStartupClearsInfoRank.firstFaultVerdict.rank).toBeNull();
    expect(secondStartupClearsInfoRank.firstFaultVerdict.slotMappable).toBe(false);

    const singleBootInfoRankPreserved = analyzeTroubleshootInput(
      [
        "[rank3] pid=42 INFO ready",
        "INFO Application startup complete.",
        "pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(singleBootInfoRankPreserved.firstFaultVerdict.rank).toBe(3);

    // R10 P1 #4: pid exit with fewer scope tags clears matching worker while preserving sibling instance
    const exitFewerScopeTags = analyzeTroubleshootInput(
      [
        "host=X instance=A [rank3] pid=42 INFO ready",
        "host=X instance=B [rank5] pid=42 INFO ready",
        "instance=A pid=42 INFO worker exited normally",
        "host=X instance=A pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(exitFewerScopeTags.firstFaultVerdict.rank).toBeNull();
    expect(
      analyzeTroubleshootInput(
        [
          "host=X instance=A [rank3] pid=42 INFO ready",
          "host=X instance=B [rank5] pid=42 INFO ready",
          "instance=A pid=42 INFO worker exited normally",
          "host=X instance=B pid=42 ERROR NPU out of memory",
        ].join("\n"),
      ).firstFaultVerdict.rank,
    ).toBe(5);

    // R10 P1 #5: command --, env printf, and printed JSON key never override real export
    for (const decoy of [
      "command -- printf '%s\\n' ASCEND_RT_VISIBLE_DEVICES=0,1",
      "env printf '%s\\n' ASCEND_RT_VISIBLE_DEVICES=0,1",
      'echo "ASCEND_RT_VISIBLE_DEVICES": "0,1"',
    ]) {
      expect(
        analyzeTroubleshootInput(
          `export ASCEND_RT_VISIBLE_DEVICES=4,5\n${decoy}\n[rank0] ERROR NPU out of memory`,
        ).visibleDevices,
      ).toEqual([4, 5]);
    }
    expect(
      analyzeTroubleshootInput(
        "export ASCEND_RT_VISIBLE_DEVICES=4,5\nenv ASCEND_RT_VISIBLE_DEVICES=0,1 python -m vllm\n[rank0] ERROR NPU out of memory",
      ).visibleDevices,
    ).toEqual([0, 1]);

    // R10 P1 #6: unsuccessful health probe phrasings never recover prior APIServer errors
    for (const badHealth of [
      "10:00:02.000 (APIServer pid=42) INFO health check not OK",
      "10:00:02.000 (APIServer pid=42) INFO health check did not pass",
      "10:00:02.000 (APIServer pid=42) INFO readiness probe unsuccessful",
    ]) {
      const r = analyzeTroubleshootInput(
        [
          "10:00:00.000 (APIServer pid=42) ERROR FileNotFoundError: missing a.json",
          "10:00:01.000 (APIServer pid=42) ERROR FileNotFoundError: missing b.json",
          badHealth,
          "10:00:05.000 [rank0] ERROR NPU out of memory",
        ].join("\n"),
      );
      expect(r.firstFaultVerdict.rank).toBeNull();
      expect(r.firstFaultVerdict.confidence).toBe("medium");
    }

    // R10 P1 #7: comma/paren/and host-memory clauses never inflate HCCL_BUFFSIZE
    for (const line of [
      "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, expected 2 GiB of host memory",
      "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL (expected 2 GiB of host memory)",
      "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL and expected 2 GiB of host memory",
    ]) {
      const r = analyzeTroubleshootInput(line);
      expect(r.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
      expect(r.findings[0]?.experimentStep).not.toContain("2048");
    }

    // R10 P1 #8: Rule 17 explicit own-host minimum beats earlier untagged minimum
    const r17ExplicitHostBeatsUntagged = analyzeTroubleshootInput(
      [
        "10:00:00 host=A INFO Host NIC inventory: eth0 UP 10.0.0.10",
        "10:00:01 host=A [rank0] ERROR RaSocketBind failed HCCL_IF_IP=10.0.0.99",
        "10:00:02 [rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL; expected 1024 MiB",
        "10:00:03 host=A [rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL; expected 128 MiB",
      ].join("\n"),
    );
    const r17OwnFinding = r17ExplicitHostBeatsUntagged.findings.find(
      (f) => f.ruleId === "hccl-link-or-ifname-fault",
    );
    expect(r17OwnFinding?.experimentStep).toContain("HCCL_BUFFSIZE=128");
    expect(r17OwnFinding?.experimentStep).not.toContain("1024");

    // R10 P1 #9: body copying from instance=B does not make instance=B the reporter
    const bodyCopyInstance = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 [rank0] ERROR NPU out of memory while copying from instance=B",
      ].join("\n"),
    );
    expect(bodyCopyInstance.firstFaultVerdict.instanceTag).toBeNull();
    expect(bodyCopyInstance.visibleDevices).toBeNull();
    expect(bodyCopyInstance.firstFaultVerdict.slotMappable).toBe(false);
    expect(bodyCopyInstance.firstFaultVerdict.confidence).toBe("medium");

    // R10 P1 #10: #85 omits activeScopeDetectedRanks without unique winner or with unknown instance
    const simultaneousUnrankedCrossInst = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 instance=A [rank1] INFO ready",
        "10:00:01 instance=A ERROR NPU out of memory",
        "10:00:01 instance=B ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(simultaneousUnrankedCrossInst.firstFaultVerdict.instanceTag).toBeNull();
    expect(simultaneousUnrankedCrossInst.visibleDevices).toBeNull();
    expect(simultaneousUnrankedCrossInst.activeScopeDetectedRanks).toBeUndefined();

    const identicalMapsUntaggedOom = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=4,5",
        "10:00:01 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(identicalMapsUntaggedOom.firstFaultVerdict.slotMappable).toBe(false);
    expect(identicalMapsUntaggedOom.firstFaultVerdict.confidence).toBe("medium");
    expect(identicalMapsUntaggedOom.activeScopeDetectedRanks).toBeUndefined();

    // R10 P2 #1, #2, #3: out-of-bounds INFO rank excluded, missing host excluded, symmetric sibling PID anchor keeps [0, 1]
    const outOfBoundsReadyExcluded = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 instance=A [rank12] INFO ready",
        "10:00:01 instance=A [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(outOfBoundsReadyExcluded.activeScopeDetectedRanks).toEqual([0]);

    const missingHostOnReadyExcluded = analyzeTroubleshootInput(
      [
        "host=X instance=A [rank0] ERROR NPU out of memory",
        "host=X instance=B [rank1] INFO ready",
        "instance=A [rank2] INFO ready",
      ].join("\n"),
    );
    expect(missingHostOnReadyExcluded.activeScopeDetectedRanks).toEqual([0]);

    const symmetricSiblingAnchor = analyzeTroubleshootInput(
      [
        "instance=A pid=100 ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B pid=200 ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 instance=A pid=100 [rank1] INFO ready",
        "10:00:01 instance=A pid=101 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(symmetricSiblingAnchor.activeScopeDetectedRanks).toEqual([0, 1]);
  });

  it("R10 scaling closure: keeps O(N log N) latency across active-scope visibility, reordered/cross-instance peer lookup, APIServer wildcard startups, host/inst PID epochs, simultaneous tie dedup, and cross-segment OOM", () => {
    const fmtClockMs = (baseSec: number, idx: number) => {
      const totalMs = baseSec * 1000 + idx;
      const sec = Math.floor(totalMs / 1000) % 60;
      const min = Math.floor(totalMs / 60_000) % 60;
      const hr = 10 + Math.floor(totalMs / 3_600_000);
      const ms = totalMs % 1000;
      return `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    };
    const buildActiveScopeVisStress = (count: number) =>
      [
        "instance=A pid=10 ASCEND_RT_VISIBLE_DEVICES=0,1",
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        ...Array.from(
          { length: count },
          (_, i) => `instance=B pid=42 group=g_${i} ASCEND_RT_VISIBLE_DEVICES=6,7`,
        ),
        "10:00:00 instance=A pid=10 [rank0] ERROR NPU out of memory",
        ...Array.from(
          { length: count },
          (_, i) => `10:00:01 instance=A pid=42 group=g_${i} [rank1] INFO ready`,
        ),
      ].join("\n");
    const buildReorderedPeerCutoffStress = (count: number) =>
      [
        "10:00:00.000 [rank0] ERROR NPU out of memory",
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(50, i)} [rank0] INFO Application startup complete.`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(30, i)} [rank1] RuntimeError: peer rank 0 exited`,
        ),
      ].join("\n");
    const buildCrossInstUntsPeerStress = (count: number) =>
      [
        ...Array.from({ length: count }, () => "instance=A [rank0] ERROR NPU out of memory"),
        ...Array.from(
          { length: count },
          (_, i) => `${fmtClockMs(20, i)} instance=B [rank1] RuntimeError: peer rank 0 exited`,
        ),
      ].join("\n");
    const buildApiDistinctInstStartupsStress = (count: number) =>
      [
        ...Array.from(
          { length: count },
          (_, i) => `10:00:00.000 instance=inst_${i} INFO Application startup complete.`,
        ),
        ...Array.from({ length: count }, (_, i) => {
          const p = 2000 + i;
          return [
            `10:00:01.000 (APIServer pid=${p}) ERROR RuntimeError: transient A`,
            `10:00:02.000 (APIServer pid=${p}) ERROR RuntimeError: transient B`,
            `10:00:03.000 (APIServer pid=${p}) INFO health check ok`,
          ].join("\n");
        }),
        "10:00:05.000 instance=inst_0 [rank0] ERROR NPU out of memory",
      ].join("\n");
    const buildSameHostOtherInstPidEpochStress = (count: number) =>
      [
        ...Array.from(
          { length: count },
          (_, i) =>
            `10:00:00.000 host=X instance=inst_${i} pid=${3000 + i} [rank0] INFO Application startup complete.`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `10:00:01.000 host=X instance=other_${i} INFO Application startup complete.`,
        ),
        "10:00:02.000 host=X instance=inst_0 pid=3000 ERROR NPU out of memory",
      ].join("\n");
    const buildSimultaneousTieStress = (count: number) =>
      Array.from({ length: count }, (_, i) => `10:00:01 [rank${i % 2}] ERROR NPU out of memory`).join("\n");
    const buildOldSegmentUntsOomStress = (count: number) =>
      [
        ...Array.from({ length: count }, () => "INFO Application startup complete."),
        "... [日志节选：下行起原行号 L10000] ...",
        ...Array.from({ length: count }, (_, i) => `${fmtClockMs(10, i)} [rank0] ERROR NPU out of memory`),
      ].join("\n");

    for (const [buildFn, checkFn, probeField] of [
      [
        buildActiveScopeVisStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.activeScopeDetectedRanks).toEqual([0]);
        },
        "visCandidateScans",
      ],
      [
        buildReorderedPeerCutoffStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.cascadeRanks).toEqual([1]);
        },
        "startupBoundarySteps",
      ],
      [
        buildCrossInstUntsPeerStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBeNull();
          expect(r.firstFaultVerdict.confidence).toBe("medium");
          expect(r.firstFaultVerdict.cascadeRanks).toEqual([]);
          expect(
            r.firstFaultVerdict.timelineEvents?.some((e) => e.rank === 1 && e.kind === "root-cause"),
          ).toBe(true);
        },
        "startupBoundarySteps",
      ],
      [
        buildApiDistinctInstStartupsStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.confidence).toBe("high");
        },
        "epochPoolScans",
      ],
      [
        buildSameHostOtherInstPidEpochStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
        },
        "pidStateCompatibilityScans",
      ],
      [
        buildSimultaneousTieStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBeNull();
          expect(r.firstFaultVerdict.confidence).toBe("medium");
        },
        "cascadeCompetitorScans",
      ],
      [
        buildOldSegmentUntsOomStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
        },
        "startupBoundarySteps",
      ],
    ] as const) {
      const s32 = buildFn(32);
      const l256 = buildFn(256);
      const pSmall = withAnalyzerScaleProbeForTest(() => analyzeTroubleshootInput(s32));
      expect(pSmall).toBeDefined();
      let ops32 = 0;
      withAnalyzerScaleProbeForTest((probe) => {
        analyzeTroubleshootInput(s32);
        ops32 = probe[probeField];
      });
      let ops256 = 0;
      const l256Res = withAnalyzerScaleProbeForTest((probe) => {
        const res = analyzeTroubleshootInput(l256);
        ops256 = probe[probeField];
        return res;
      });
      checkFn(l256Res);
      expect(ops256).toBeLessThan(Math.max(ops32, 32) * 16);

      const s = buildFn(16);
      const l = buildFn(1024);
      analyzeTroubleshootInput(s);
      analyzeTroubleshootInput(l);
      const ts0 = performance.now();
      for (let k = 0; k < 64; k += 1) analyzeTroubleshootInput(s);
      const dtS = performance.now() - ts0;
      const tl0 = performance.now();
      const lRes = analyzeTroubleshootInput(l);
      const dtL = performance.now() - tl0;
      expect(dtL).toBeLessThan(Math.max(dtS, 10) * 4);
      checkFn(lRes);
    }
  });

  it("R10 P3-1 visibility cache scaling closure: catches unmapped-PID per-entry visibility indexing regressions at 448x equal-work separation", () => {
    const buildPostVisStress = (count: number) =>
      [
        ...Array.from(
          { length: count },
          (_, i) => `10:00:00 host=node-a INFO pool_line=${i} ASCEND_RT_VISIBLE_DEVICES=0,1`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `10:00:01 host=node-a pid=${500 + i} [rank0] ERROR NPU out of memory`,
        ),
      ].join("\n");
    const buildDistinctHostVisStress = (count: number) =>
      [
        ...Array.from(
          { length: count },
          (_, i) => `10:00:00 INFO unscoped_pool_${i} ASCEND_RT_VISIBLE_DEVICES=0,1`,
        ),
        ...Array.from(
          { length: count },
          (_, i) => `10:00:01 host=node_${i} pid=${500 + i} [rank0] ERROR NPU out of memory`,
        ),
      ].join("\n");

    for (const [buildFn, checkFn] of [
      [
        buildPostVisStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.visibleDevices).toEqual([0, 1]);
          expect(r.firstFaultVerdict.rank).toBe(0);
        },
      ],
      [
        buildDistinctHostVisStress,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.visibleDevices).toEqual([0, 1]);
          expect(r.firstFaultVerdict.rank).toBe(0);
        },
      ],
    ] as const) {
      let ops32 = 0;
      withAnalyzerScaleProbeForTest((probe) => {
        analyzeTroubleshootInput(buildFn(32));
        ops32 = probe.visCandidateScans;
      });
      let ops256 = 0;
      const probe256 = withAnalyzerScaleProbeForTest((probe) => {
        const res = analyzeTroubleshootInput(buildFn(256));
        ops256 = probe.visCandidateScans;
        return res;
      });
      checkFn(probe256);
      expect(ops256).toBeLessThan(Math.max(ops32, 32) * 16);

      const s = buildFn(16);
      const l = buildFn(7168);
      analyzeTroubleshootInput(s);
      analyzeTroubleshootInput(l);
      const ts0 = performance.now();
      for (let k = 0; k < 448; k += 1) analyzeTroubleshootInput(s);
      const dtS = performance.now() - ts0;
      const tl0 = performance.now();
      const lRes = analyzeTroubleshootInput(l);
      const dtL = performance.now() - tl0;
      expect(dtL).toBeLessThan(Math.max(dtS, 10) * 4);
      checkFn(lRes);
    }
  }, 60_000);

  it("R11 closure suite: remediates all 9 P1s, 8 P2s, and deterministic P3 operation-count scaling", () => {
    // R11 P1 #1: 3rd startup still clears prior PID rank
    const thirdStartup = analyzeTroubleshootInput(
      [
        "instance=B INFO Application startup complete.",
        "instance=B [rank3] pid=42 INFO ready",
        "instance=B INFO Application startup complete.",
        "instance=B [rank3] pid=42 INFO ready",
        "instance=B INFO Application startup complete.",
        "instance=B pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(thirdStartup.firstFaultVerdict.rank).toBeNull();
    expect(thirdStartup.firstFaultVerdict.slotMappable).toBe(false);

    // R11 P1 #2: group mentioned in body prose does not select prior group PID rank
    const groupBodyProse = analyzeTroubleshootInput(
      [
        "group=B pid=42 [rank6] INFO ready",
        "group=A pid=42 [rank3] INFO ready",
        "pid=42 ERROR NPU out of memory copying from group=B",
      ].join("\n"),
    );
    expect(groupBodyProse.firstFaultVerdict.rank).toBeNull();
    expect(groupBodyProse.firstFaultVerdict.slotMappable).toBe(false);

    // R11 P1 #3: instance_id= header correctly attributes instance & chassis devices
    const instanceIdHeader = analyzeTroubleshootInput(
      [
        "instance_id=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance_id=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 [rank0] instance_id=A ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(instanceIdHeader.firstFaultVerdict.instanceTag).toBe("A");
    expect(instanceIdHeader.visibleDevices).toEqual([4, 5]);
    expect(instanceIdHeader.firstFaultVerdict.slotMappable).toBe(true);
    expect(instanceIdHeader.firstFaultVerdict.confidence).toBe("high");

    // R11 P1 #4: /usr/bin/env printf & env -u DUMMY printf do not override real export, while env -u DUMMY var=val python does
    for (const decoy of [
      "/usr/bin/env printf '%s' ASCEND_RT_VISIBLE_DEVICES=0,1",
      "env -u DUMMY printf '%s' ASCEND_RT_VISIBLE_DEVICES=0,1",
    ]) {
      expect(
        analyzeTroubleshootInput(
          `export ASCEND_RT_VISIBLE_DEVICES=4,5\n${decoy}\n10:00:00 [rank0] ERROR NPU out of memory`,
        ).visibleDevices,
      ).toEqual([4, 5]);
    }
    expect(
      analyzeTroubleshootInput(
        "export ASCEND_RT_VISIBLE_DEVICES=4,5\nenv -u DUMMY ASCEND_RT_VISIBLE_DEVICES=0,1 python -m vllm\n10:00:00 [rank0] ERROR NPU out of memory",
      ).visibleDevices,
    ).toEqual([0, 1]);

    // R11 P1 #5: explicit false/not-yet-ready/skipped probes never recover APIServer errors
    for (const badProbe of [
      "10:00:02.000 (APIServer pid=42) INFO readiness probe returned false",
      "10:00:02.000 (APIServer pid=42) INFO readiness probe not yet ready",
      "10:00:02.000 (APIServer pid=42) INFO health check skipped",
    ]) {
      const r = analyzeTroubleshootInput(
        [
          "10:00:00.000 (APIServer pid=42) ERROR FileNotFoundError: config A",
          "10:00:01.000 (APIServer pid=42) ERROR FileNotFoundError: config B",
          badProbe,
          "10:00:05.000 [rank0] ERROR NPU out of memory",
        ].join("\n"),
      );
      expect(r.firstFaultVerdict.rank).toBeNull();
      expect(r.firstFaultVerdict.confidence).toBe("medium");
    }

    // R11 P1 #6: colon and slash before host memory clause never inflate HCCL_BUFFSIZE
    for (const sep of [": ", " / ", "; "]) {
      const r = analyzeTroubleshootInput(
        `[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL${sep}expected 2 GiB of host memory`,
      );
      expect(r.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
      expect(r.findings[0]?.experimentStep).not.toContain("2048");
    }

    // R11 P1 #7: untagged fault/event in multi-instance log cannot claim physical slot or undeclared instance devices
    const multiInstUndeclaredB = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B [rank1] INFO ready",
        "10:00:01 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(multiInstUndeclaredB.visibleDevices).toBeNull();
    expect(multiInstUndeclaredB.firstFaultVerdict.slotMappable).toBe(false);
    expect(multiInstUndeclaredB.firstFaultVerdict.confidence).toBe("medium");
    expect(multiInstUndeclaredB.activeScopeDetectedRanks).toBeUndefined();

    const multiInstIdenticalEventUntagged = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=4,5",
        "10:00:01 instance=A [rank0] ERROR NPU out of memory",
        "10:00:02 [rank1] ERROR 507035",
      ].join("\n"),
    );
    expect(multiInstIdenticalEventUntagged.firstFaultVerdict.slotMappable).toBe(true);
    expect(multiInstIdenticalEventUntagged.firstFaultVerdict.timelineEvents?.[0]?.slotMappable).toBe(true);
    expect(multiInstIdenticalEventUntagged.firstFaultVerdict.timelineEvents?.[1]?.slotMappable).toBe(false);

    // R11 P1 #8: untimestamped same-rank A/B roots are paste-invariant and withhold chassis slot mapping
    const untsLinesBase = [
      "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
      "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
    ];
    for (const pair of [
      ["instance=A [rank0] ERROR NPU out of memory", "instance=B [rank0] ERROR NPU out of memory"],
      ["instance=B [rank0] ERROR NPU out of memory", "instance=A [rank0] ERROR NPU out of memory"],
    ]) {
      const r = analyzeTroubleshootInput([...untsLinesBase, ...pair].join("\n"));
      expect(r.visibleDevices).toBeNull();
      expect(r.firstFaultVerdict.instanceTag).toBeNull();
      expect(r.firstFaultVerdict.slotMappable).toBe(false);
      expect(r.firstFaultVerdict.confidence).toBe("medium");
      expect(r.activeScopeDetectedRanks).toBeUndefined();
    }

    // R11 P1 #9: simultaneous unranked A/B + later ranked AND simultaneous rank-0 A/B both keep instanceTag null
    const simUnrankedWithLater = analyzeTroubleshootInput(
      [
        ...untsLinesBase,
        "10:00:01 instance=A ERROR NPU out of memory",
        "10:00:01 instance=B ERROR NPU out of memory",
        "10:00:05 instance=A [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(simUnrankedWithLater.firstFaultVerdict.instanceTag).toBeNull();
    expect(simUnrankedWithLater.visibleDevices).toBeNull();
    expect(simUnrankedWithLater.activeScopeDetectedRanks).toBeUndefined();

    const simSameRankCrossInst = analyzeTroubleshootInput(
      [
        ...untsLinesBase,
        "10:00:01 instance=A [rank0] ERROR NPU out of memory",
        "10:00:01 instance=B [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(simSameRankCrossInst.firstFaultVerdict.instanceTag).toBeNull();
    expect(simSameRankCrossInst.visibleDevices).toBeNull();
    expect(simSameRankCrossInst.firstFaultVerdict.slotMappable).toBe(false);
    expect(simSameRankCrossInst.activeScopeDetectedRanks).toBeUndefined();

    // R11 P2 #1-#3: [Rank3, pid=42], quoted startup message, sibling PIDs in same instance A
    const compactBracketRank = analyzeTroubleshootInput(
      "[Rank3, pid=42] 10:00:01 ERROR NPU out of memory\n[rank1] 10:00:02 ERROR 507035",
    );
    expect(compactBracketRank.firstFaultVerdict.rank).toBe(3);
    expect(compactBracketRank.firstFaultVerdict.primaryEvidenceLines[0]?.timestamp).toBe("10:00:01");

    const quotedStartupEvent = analyzeTroubleshootInput(
      [
        "instance=B [rank3] pid=42 INFO ready",
        "instance=B INFO Application startup complete.",
        'instance=B INFO waiting for event "Application startup complete."',
        "instance=B pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(quotedStartupEvent.firstFaultVerdict.rank).toBe(3);

    const siblingPidsSameInstTie = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:01 instance=A pid=100 [rank0] ERROR NPU out of memory",
        "10:00:01 instance=A pid=101 [rank1] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(siblingPidsSameInstTie.firstFaultVerdict.instanceTag).toBe("A");
    expect(siblingPidsSameInstTie.visibleDevices).toEqual([4, 5]);
    expect(siblingPidsSameInstTie.activeScopeDetectedRanks).toEqual([0, 1]);

    // R11 P2 #4-#8 & P3: deterministic operation-count assertions across 8x input growth (32 -> 256)
    const buildPid42Variant = (n: number) =>
      [
        "instance=A pid=10 ASCEND_RT_VISIBLE_DEVICES=0,1",
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        ...Array.from({ length: n }, () => "pid=42 ASCEND_RT_VISIBLE_DEVICES=4,5"),
        ...Array.from(
          { length: n },
          (_, i) => `instance=B pid=42 group=g_${i} ASCEND_RT_VISIBLE_DEVICES=6,7`,
        ),
        "10:00:00 instance=A pid=10 [rank0] ERROR NPU out of memory",
        ...Array.from({ length: n }, (_, i) => `10:00:01 instance=A pid=42 group=g_${i} [rank1] INFO ready`),
      ].join("\n");
    const buildHostInstExits = (n: number) =>
      [
        ...Array.from(
          { length: n },
          (_, i) => `10:00:00 host=X instance=inst_${i} [rank0] pid=42 INFO ready`,
        ),
        ...Array.from(
          { length: n },
          (_, i) => `10:00:01 host=X instance=inst_${i} pid=42 INFO worker exited normally`,
        ),
        "10:00:02 host=X instance=inst_0 pid=42 ERROR NPU out of memory",
      ].join("\n");
    const buildCompetingPeerWaits = (n: number) =>
      [
        "10:00:00 [rank0] ERROR NPU out of memory",
        ...Array.from({ length: n }, () => "[rank3] ERROR NPU out of memory"),
        ...Array.from({ length: n }, () => "10:00:05 [rank1] ERROR EI0002 waiting for rank 0"),
      ].join("\n");

    for (const [buildFn, probeField, verifyFn] of [
      [
        buildPid42Variant,
        "visCandidateScans",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.activeScopeDetectedRanks).toEqual([0]),
      ],
      [
        buildHostInstExits,
        "pidStateCompatibilityScans",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.firstFaultVerdict.rank).toBeNull(),
      ],
      [
        buildCompetingPeerWaits,
        "cascadeCompetitorScans",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.cascadeCausalState).toBe("confirmed-after");
          expect(r.firstFaultVerdict.cascadeRanks).toEqual([1]);
        },
      ],
    ] as const) {
      let ops32 = 0;
      withAnalyzerScaleProbeForTest((probe) => {
        analyzeTroubleshootInput(buildFn(32));
        ops32 = probe[probeField];
      });
      let ops256 = 0;
      const res256 = withAnalyzerScaleProbeForTest((probe) => {
        const res = analyzeTroubleshootInput(buildFn(256));
        ops256 = probe[probeField];
        return res;
      });
      verifyFn(res256);
      expect(ops256).toBeLessThan(Math.max(ops32, 32) * 16);
    }
  });

  it("R12 closure suite: remediates all 4 P1s, 8 P2s, and 2 P3 deterministic scaling assertions", () => {
    // R12 P1 #1: untimestamped cross-instance different-rank roots are paste-invariant
    const r12VisBase = [
      "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
      "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
    ];
    for (const pair of [
      ["instance=A [rank0] ERROR NPU out of memory", "instance=B [rank1] ERROR NPU out of memory"],
      ["instance=B [rank1] ERROR NPU out of memory", "instance=A [rank0] ERROR NPU out of memory"],
    ]) {
      const r = analyzeTroubleshootInput([...r12VisBase, ...pair].join("\n"));
      expect(r.firstFaultVerdict.rank).toBeNull();
      expect(r.firstFaultVerdict.instanceTag).toBeNull();
      expect(r.visibleDevices).toBeNull();
      expect(r.firstFaultVerdict.slotMappable).toBe(false);
      expect(r.firstFaultVerdict.confidence).toBe("medium");
      expect(r.activeScopeDetectedRanks).toBeUndefined();
    }

    // R12 P1 #2: env -i printf & /usr/bin/printf & /bin/echo never override real export
    for (const decoy of [
      "env -i printf '%s' ASCEND_RT_VISIBLE_DEVICES=0,1",
      "/usr/bin/printf '%s' ASCEND_RT_VISIBLE_DEVICES=0,1",
      "/bin/echo ASCEND_RT_VISIBLE_DEVICES=0,1",
    ]) {
      expect(
        analyzeTroubleshootInput(
          `export ASCEND_RT_VISIBLE_DEVICES=4,5\n${decoy}\n10:00:00 [rank0] ERROR NPU out of memory`,
        ).visibleDevices,
      ).toEqual([4, 5]);
    }
    expect(
      analyzeTroubleshootInput(
        "export ASCEND_RT_VISIBLE_DEVICES=4,5\nenv --ignore-environment ASCEND_RT_VISIBLE_DEVICES=0,1 python -m vllm\n10:00:00 [rank0] ERROR NPU out of memory",
      ).visibleDevices,
    ).toEqual([0, 1]);

    // R12 P1 #3: unexecuted readiness/health probes never recover prior APIServer errors
    for (const badProbe of [
      "10:00:02.000 (APIServer pid=42) INFO readiness probe has not run",
      "10:00:02.000 (APIServer pid=42) INFO readiness probe not executed",
      "10:00:02.000 (APIServer pid=42) INFO health check never ran",
    ]) {
      const r = analyzeTroubleshootInput(
        [
          "10:00:00.000 (APIServer pid=42) ERROR FileNotFoundError: config A",
          "10:00:01.000 (APIServer pid=42) ERROR FileNotFoundError: config B",
          badProbe,
          "10:00:05.000 [rank0] ERROR NPU out of memory",
        ].join("\n"),
      );
      expect(r.firstFaultVerdict.rank).toBeNull();
      expect(r.firstFaultVerdict.confidence).toBe("medium");
    }

    // R12 P1 #4: /dev/shm and shared memory never inflate HCCL_BUFFSIZE
    for (const phrase of ["expected 2 GiB in /dev/shm", "expected 2 GiB of shared memory"]) {
      const r = analyzeTroubleshootInput(
        `[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL: ${phrase}`,
      );
      expect(r.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
      expect(r.findings[0]?.experimentStep).not.toContain("2048");
    }

    // R12 P2 #1-#3: [pid=42, Rank3], negative startup milestone phrases, same-chassis different-PID rank-0 tie
    const pidFirstRank = analyzeTroubleshootInput(
      "[pid=42, Rank3] 10:00:01 ERROR NPU out of memory\n[rank1] 10:00:02 ERROR 507035",
    );
    expect(pidFirstRank.firstFaultVerdict.rank).toBe(3);
    expect(pidFirstRank.firstFaultVerdict.primaryEvidenceLines[0]?.timestamp).toBe("10:00:01");

    for (const decoyStartup of [
      "instance=B INFO Application startup complete: false",
      "instance=B INFO No Application startup complete message received",
    ]) {
      const r = analyzeTroubleshootInput(
        [
          "instance=B INFO Application startup complete.",
          "instance=B [rank3] pid=42 INFO ready",
          decoyStartup,
          "instance=B pid=42 ERROR NPU out of memory",
        ].join("\n"),
      );
      expect(r.firstFaultVerdict.rank).toBe(3);
    }

    const sameInstDiffPidSameRank = analyzeTroubleshootInput(
      [
        ...r12VisBase,
        "10:00:01 instance=A pid=100 [rank0] ERROR NPU out of memory",
        "10:00:01 instance=A pid=101 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(sameInstDiffPidSameRank.firstFaultVerdict.instanceTag).toBe("A");
    expect(sameInstDiffPidSameRank.visibleDevices).toEqual([4, 5]);
    expect(sameInstDiffPidSameRank.activeScopeDetectedRanks).toEqual([0]);

    // R12 P2 #4-#8 & P3 #1-#2: deterministic operation-count scaling across N = 32 -> 256
    const tsAt = (baseMin: number, idx: number): string => {
      const totalSec = baseMin * 60 + Math.floor(idx / 100);
      const mm = Math.floor(totalSec / 60);
      const ss = totalSec % 60;
      const ms = (idx % 100) * 10;
      return `10:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    };
    const buildSplitScopeBoundaryStress = (n: number, timestampedStartups: boolean) =>
      [
        "10:00:00 host=X instance=A [rank0] ERROR NPU out of memory",
        ...Array.from({ length: n }, (_, i) =>
          timestampedStartups
            ? `${tsAt(1, i)} host=X instance=B [rank0] INFO Application startup complete.`
            : "host=X instance=B [rank0] INFO Application startup complete.",
        ),
        ...Array.from({ length: n }, (_, i) =>
          timestampedStartups
            ? `${tsAt(2, i)} host=Y instance=A [rank0] INFO Application startup complete.`
            : "host=Y instance=A [rank0] INFO Application startup complete.",
        ),
        ...Array.from(
          { length: n },
          () => "10:05:00 host=X instance=A [rank1] ERROR EI0002 waiting for rank 0",
        ),
      ].join("\n");
    const buildApiMixedWildcardHostsStress = (n: number) =>
      [
        ...Array.from(
          { length: n },
          (_, i) => `10:00:00.000 instance=inst_${i} INFO Application startup complete.`,
        ),
        ...Array.from(
          { length: n },
          (_, i) => `10:00:00.500 host=host_${i} INFO Application startup complete.`,
        ),
        ...Array.from({ length: n }, (_, i) =>
          [
            `10:00:01.000 host=host_${i} (APIServer pid=${2000 + i}) ERROR RuntimeError: transient A`,
            `10:00:02.000 host=host_${i} (APIServer pid=${2000 + i}) ERROR RuntimeError: transient B`,
            `10:00:03.000 host=host_${i} (APIServer pid=${2000 + i}) INFO health check ok`,
          ].join("\n"),
        ),
        `10:00:05.000 host=host_0 [rank0] ERROR NPU out of memory`,
      ].join("\n");
    const buildAlternatingUnscopedPid42Vis = (n: number) =>
      [
        "instance=A pid=10 ASCEND_RT_VISIBLE_DEVICES=0,1",
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        ...Array.from({ length: n }, (_, i) =>
          i % 2 === 0 ? "pid=42 ASCEND_RT_VISIBLE_DEVICES=4,5" : "pid=42 ASCEND_RT_VISIBLE_DEVICES=2,3",
        ),
        ...Array.from(
          { length: n },
          (_, i) => `instance=B pid=42 group=g_${i} ASCEND_RT_VISIBLE_DEVICES=6,7`,
        ),
        "10:00:00 instance=A pid=10 [rank0] ERROR NPU out of memory",
        ...Array.from({ length: n }, (_, i) => `10:00:01 instance=A pid=42 group=g_${i} [rank1] INFO ready`),
      ].join("\n");
    const buildHostOnlyRepeatedExits = (n: number) =>
      [
        ...Array.from(
          { length: n },
          (_, i) => `10:00:00 host=X instance=inst_${i} [rank0] pid=42 INFO ready`,
        ),
        ...Array.from({ length: n }, () => "10:00:01 host=X pid=42 INFO worker exited normally"),
        "10:00:02 host=X instance=inst_0 pid=42 ERROR NPU out of memory",
      ].join("\n");
    const buildRankMismatchStartups = (n: number) =>
      [
        ...Array.from(
          { length: n },
          (_, i) => `10:00:00 host=X instance=inst_${i} [rank0] pid=${3000 + i} INFO ready`,
        ),
        ...Array.from({ length: n }, () => "10:00:01 host=X [rank1] INFO Application startup complete."),
        "10:00:02 host=X instance=inst_0 pid=3000 ERROR NPU out of memory",
      ].join("\n");
    const buildSemiColonBuffStress = (n: number) =>
      `[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL${Array.from({ length: n }, () => "; expected 512 MiB").join("")}`;

    for (const [buildFn, probeField, verifyFn] of [
      [
        (n: number) => buildSplitScopeBoundaryStress(n, true),
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.firstFaultVerdict.cascadeRanks).toEqual([1]),
      ],
      [
        (n: number) => buildSplitScopeBoundaryStress(n, false),
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.firstFaultVerdict.cascadeRanks).toEqual([1]),
      ],
      [
        buildApiMixedWildcardHostsStress,
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => {
          expect(r.firstFaultVerdict.rank).toBe(0);
          expect(r.firstFaultVerdict.confidence).toBe("medium");
          expect(r.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(5 * 256 + 1);
        },
      ],
      [
        buildApiMixedWildcardHostsStress,
        "domainPresenceLookups",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.firstFaultVerdict.rank).toBe(0),
      ],
      [
        buildAlternatingUnscopedPid42Vis,
        "visCandidateScans",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.activeScopeDetectedRanks).toEqual([0]),
      ],
      [
        buildHostOnlyRepeatedExits,
        "pidStateCompatibilityScans",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.firstFaultVerdict.rank).toBeNull(),
      ],
      [
        buildRankMismatchStartups,
        "epochPoolScans",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.firstFaultVerdict.rank).toBe(0),
      ],
      [
        buildSemiColonBuffStress,
        "buffClauseScans",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512"),
      ],
    ] as const) {
      let ops32 = 0;
      withAnalyzerScaleProbeForTest((probe) => {
        analyzeTroubleshootInput(buildFn(32));
        ops32 = probe[probeField];
      });
      let ops256 = 0;
      const res256 = withAnalyzerScaleProbeForTest((probe) => {
        const res = analyzeTroubleshootInput(buildFn(256));
        ops256 = probe[probeField];
        return res;
      });
      verifyFn(res256);
      expect(ops256).toBeLessThan(Math.max(ops32, 32) * 16);
    }
  });

  it("R13 closure suite: remediates all 4 P1s, 5 P2s, and R13 P3 deterministic scaling assertions", () => {
    // R13 P1 #1: single-sided timestamp across distinct A/B vis domains never locks winner or device map
    const abMaps = ["instance=A ASCEND_RT_VISIBLE_DEVICES=4,5", "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7"];
    for (const pair of [
      ["instance=A [rank0] ERROR NPU out of memory", "10:00:01 instance=B [rank1] ERROR NPU out of memory"],
      ["10:00:01 instance=B [rank1] ERROR NPU out of memory", "instance=A [rank0] ERROR NPU out of memory"],
      ["10:00:01 instance=A [rank0] ERROR NPU out of memory", "instance=B [rank1] ERROR NPU out of memory"],
    ]) {
      const r = analyzeTroubleshootInput([...abMaps, ...pair].join("\n"));
      expect(r.firstFaultVerdict.rank).toBeNull();
      expect(r.firstFaultVerdict.instanceTag).toBeNull();
      expect(r.visibleDevices).toBeNull();
      expect(r.firstFaultVerdict.slotMappable).toBe(false);
      expect(r.firstFaultVerdict.confidence).toBe("medium");
      expect(r.activeScopeDetectedRanks).toBeUndefined();
    }

    // R13 P1 #2: quoted print commands never override real export
    for (const decoy of [
      '"/bin/echo" ASCEND_RT_VISIBLE_DEVICES=0,1',
      "env -i '/usr/bin/printf' '%s' ASCEND_RT_VISIBLE_DEVICES=0,1",
    ]) {
      expect(
        analyzeTroubleshootInput(
          `export ASCEND_RT_VISIBLE_DEVICES=4,5\n${decoy}\n10:00:00 [rank0] ERROR NPU out of memory`,
        ).visibleDevices,
      ).toEqual([4, 5]);
    }

    // R13 P1 #3: scheduled/queued/future probes never recover prior APIServer errors
    for (const futureProbe of [
      "10:00:02.000 (APIServer pid=42) INFO readiness probe scheduled",
      "10:00:02.000 (APIServer pid=42) INFO health check queued",
      "10:00:02.000 (APIServer pid=42) INFO readiness probe will run in 30s",
    ]) {
      const r = analyzeTroubleshootInput(
        [
          "10:00:00.000 (APIServer pid=42) ERROR FileNotFoundError: config A",
          "10:00:01.000 (APIServer pid=42) ERROR FileNotFoundError: config B",
          futureProbe,
          "10:00:05.000 [rank0] ERROR NPU out of memory",
        ].join("\n"),
      );
      expect(r.firstFaultVerdict.rank).toBeNull();
      expect(r.firstFaultVerdict.confidence).toBe("medium");
    }

    // R13 P1 #4: parenthetical non-HCCL memory qualifiers never inflate HCCL_BUFFSIZE
    for (const suffix of [": expected 2 GiB (/dev/shm)", ": expected 2 GiB (shared memory)"]) {
      const r = analyzeTroubleshootInput(
        `[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL${suffix}`,
      );
      expect(r.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
      expect(r.findings[0]?.experimentStep).not.toContain("2048");
    }
    const hcclParen = analyzeTroubleshootInput(
      "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL: expected 512 MiB (HCCL buffer)",
    );
    expect(hcclParen.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=512");

    // R13 P2 #1: trailing passive negative startup milestone never clears live rank
    const passiveNegStartup = analyzeTroubleshootInput(
      [
        "instance=B INFO Application startup complete.",
        "instance=B [rank3] pid=42 INFO ready",
        "instance=B INFO Application startup complete was never emitted",
        "instance=B pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(passiveNegStartup.firstFaultVerdict.rank).toBe(3);

    // R13 P2 #2-#5 & P3: O(N log N) scaling across compile suppression, restart EL0004/OOM, 107030 PID disjointness, and time-only >12h OOMs
    const buildCrossRankCompileCapture = (n: number) =>
      [
        ...Array.from(
          { length: n },
          () => "10:00:00 [rank1] ERROR BackendCompilerFailed: TorchAir compile failed",
        ),
        ...Array.from({ length: n }, () => "10:00:01 [rank0] ERROR RuntimeError: capture_model failed"),
      ].join("\n");
    const buildPreStartupOomPostEl0004 = (n: number) =>
      [
        ...Array.from({ length: n }, () => "10:00:00 [rank0] ERROR NPU out of memory"),
        "10:00:01 [rank0] INFO Application startup complete.",
        ...Array.from({ length: n }, () => "10:00:02 [rank0] ERROR EL0004 memory alloc failed"),
      ].join("\n");
    const buildDisjointPid107030 = (n: number) =>
      [
        ...Array.from(
          { length: n },
          (_, i) =>
            `10:00:00 [rank0] pid=${1000 + i} ERROR ACL_ERROR_RT_MEMORY_ALLOCATION mla_preprocess rtMemcpy error code 107030`,
        ),
        ...Array.from(
          { length: n },
          (_, i) => `10:00:01 [rank0] pid=${2000 + i} ERROR RuntimeError: worker aborted unexpectedly`,
        ),
      ].join("\n");
    const buildTimeOnly16hOoms = (n: number) =>
      [
        ...Array.from({ length: n }, () => "00:00:01 [rank0] INFO Application startup complete."),
        ...Array.from({ length: n }, () => "16:00:02 [rank0] ERROR NPU out of memory"),
      ].join("\n");

    for (const [buildFn, verifyFn] of [
      [
        buildCrossRankCompileCapture,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.firstFaultVerdict.rank).toBe(1),
      ],
      [
        buildPreStartupOomPostEl0004,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.firstFaultVerdict.rank).toBe(0),
      ],
      [
        buildDisjointPid107030,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.firstFaultVerdict.rank).toBe(0),
      ],
      [
        buildTimeOnly16hOoms,
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.firstFaultVerdict.rank).toBe(0),
      ],
    ] as const) {
      let ops32 = 0;
      withAnalyzerScaleProbeForTest((probe) => {
        analyzeTroubleshootInput(buildFn(32));
        ops32 = probe.startupBoundarySteps;
      });
      let ops256 = 0;
      const res256 = withAnalyzerScaleProbeForTest((probe) => {
        const res = analyzeTroubleshootInput(buildFn(256));
        ops256 = probe.startupBoundarySteps;
        return res;
      });
      verifyFn(res256);
      expect(ops256).toBeLessThan(Math.max(ops32, 32) * 16);
    }
  });

  it("R14 closure suite: remediates all 5 P1s, 8 P2s, and R14 P3 MLA corroboration coverage", () => {
    // R14 P1 #1: shell non-assignment env prefix before quoted print command never overrides export
    expect(
      analyzeTroubleshootInput(
        [
          "export ASCEND_RT_VISIBLE_DEVICES=4,5",
          'LANG=C "/usr/bin/printf" "%s" ASCEND_RT_VISIBLE_DEVICES=0,1',
          "10:00:00 [rank0] ERROR NPU out of memory",
        ].join("\n"),
      ).visibleDevices,
    ).toEqual([4, 5]);
    expect(
      analyzeTroubleshootInput(
        [
          "LANG=C ASCEND_RT_VISIBLE_DEVICES=4,5 python3 serve.py",
          "10:00:00 [rank0] ERROR NPU out of memory",
        ].join("\n"),
      ).visibleDevices,
    ).toEqual([4, 5]);

    // R14 P1 #2: passive-been-negated and future-starts-in probes never trigger false recovery
    for (const nonRecovery of [
      "10:00:02.000 (APIServer pid=42) INFO readiness probe has not been run",
      "10:00:02.000 (APIServer pid=42) INFO readiness probe starts in 30s",
    ]) {
      const r = analyzeTroubleshootInput(
        [
          "10:00:00.000 (APIServer pid=42) ERROR FileNotFoundError: config A",
          "10:00:01.000 (APIServer pid=42) ERROR FileNotFoundError: config B",
          nonRecovery,
          "10:00:05.000 [rank0] ERROR NPU out of memory",
        ].join("\n"),
      );
      expect(r.firstFaultVerdict.rank).toBeNull();
      expect(r.firstFaultVerdict.confidence).toBe("medium");
    }
    const probeOk = analyzeTroubleshootInput(
      [
        "10:00:00.000 (APIServer pid=42) ERROR FileNotFoundError: config A",
        "10:00:01.000 (APIServer pid=42) ERROR FileNotFoundError: config B",
        "10:00:02.000 (APIServer pid=42) INFO health check ok",
        "10:00:05.000 [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(probeOk.firstFaultVerdict.rank).toBe(0);
    expect(probeOk.firstFaultVerdict.confidence).toBe("high");

    // R14 P1 #3: parenthetical /dev/shm tmpfs mentioning HCCL logs never inflates HCCL_BUFFSIZE
    for (const suffix of [
      ": expected 2 GiB (/dev/shm tmpfs for HCCL worker logs)",
      ": expected 2 GiB (HCCL worker logs on /dev/shm tmpfs)",
    ]) {
      const r = analyzeTroubleshootInput(
        `[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL${suffix}`,
      );
      expect(r.findings[0]?.experimentStep).toContain("HCCL_BUFFSIZE=128");
      expect(r.findings[0]?.experimentStep).not.toContain("2048");
    }
    expect(
      analyzeTroubleshootInput(
        "[rank0] ERROR DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL: expected 512 MiB (HCCL buffer)",
      ).findings[0]?.experimentStep,
    ).toContain("HCCL_BUFFSIZE=512");

    // R14 P1 #4: single-sided timestamps between adjacent scoped compile/capture or OOM/EL0004 still deduplicate
    for (const pair of [
      [
        "[rank0] pid=42 ERROR BackendCompilerFailed: TorchAir compile failed",
        "10:00:01 [rank0] pid=42 ERROR RuntimeError: capture_model failed",
      ],
      [
        "10:00:01 [rank0] pid=42 ERROR BackendCompilerFailed: TorchAir compile failed",
        "[rank0] pid=42 ERROR RuntimeError: capture_model failed",
      ],
    ]) {
      const ids = analyzeTroubleshootInput(pair.join("\n")).findings.map((f) => f.ruleId);
      expect(ids[0]).toBe("torchair-ge-graph-compile-fault");
      expect(ids).not.toContain("graph-capture-failure");
    }
    for (const pair of [
      ["[rank0] pid=42 ERROR NPU out of memory", "10:00:01 [rank0] pid=42 ERROR EL0004 memory alloc failed"],
      ["10:00:01 [rank0] pid=42 ERROR NPU out of memory", "[rank0] pid=42 ERROR EL0004 memory alloc failed"],
    ]) {
      const ids = analyzeTroubleshootInput(pair.join("\n")).findings.map((f) => f.ruleId);
      expect(ids[0]).toBe("oom-stage-split");
      expect(ids).not.toContain("cann-driver-or-device-env-fault");
    }

    // R14 P1 #5: startup tagged for instance=B must not act as universal cutoff for untagged/instance=A lines
    const crossInstMla = analyzeTroubleshootInput(
      [
        "10:00:00 [rank0] pid=42 ERROR mla_preprocess rtMemcpy error code 107030",
        "10:00:01 instance=B [rank0] INFO Application startup complete.",
        "10:00:02 instance=A [rank0] pid=42 ERROR RuntimeError: worker aborted unexpectedly",
      ].join("\n"),
    );
    expect(crossInstMla.findings.some((f) => f.ruleId === "cann-plog-aicore-fault")).toBe(true);
    expect(crossInstMla.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(1);

    const crossInstOomEl0004 = analyzeTroubleshootInput(
      [
        "10:00:00 instance=A [rank0] ERROR NPU out of memory",
        "10:00:01 instance=B [rank0] INFO Application startup complete.",
        "10:00:02 [rank0] ERROR EL0004 memory alloc failed",
      ].join("\n"),
    );
    expect(crossInstOomEl0004.findings.map((f) => f.ruleId)).toEqual(["oom-stage-split"]);

    // R14 P2 #1 & #2: negated startup messages with noun gap or "yet to be" never reset live rank or OOM stage
    for (const negMsg of [
      "instance=B INFO Application startup complete message was never emitted",
      "instance=B INFO Application startup complete has yet to be emitted",
    ]) {
      const r = analyzeTroubleshootInput(
        [
          "instance=B INFO Application startup complete.",
          "instance=B [rank3] pid=42 INFO ready",
          negMsg,
          "instance=B pid=42 ERROR NPU out of memory",
        ].join("\n"),
      );
      expect(r.firstFaultVerdict.rank).toBe(3);
    }
    const coldStage = analyzeTroubleshootInput(
      [
        "[rank0] pid=42 INFO Starting load_model",
        "[rank0] pid=42 INFO Application startup complete was never emitted",
        "[rank0] pid=42 ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(coldStage.firstFaultVerdict.timelineEvents?.some((e) => e.phase === "device-init")).toBe(true);
    expect(coldStage.firstFaultVerdict.timelineEvents?.every((e) => e.phase !== "runtime")).toBe(true);

    // R14 P2 #3-#8 & P3 #2: O(N log N) scaling bounds across all 6 quadratic patterns + matching-PID MLA control
    const buildUnscopedCompile = (n: number) =>
      [
        ...Array.from({ length: n }, () => "10:00:00 ERROR BackendCompilerFailed: TorchAir compile failed"),
        "INFO padding line",
        ...Array.from({ length: n }, () => "10:00:01 ERROR RuntimeError: capture_model failed"),
      ].join("\n");
    const buildUnscopedOomEl0004 = (n: number) =>
      [
        ...Array.from({ length: n }, () => "10:00:00 ERROR NPU out of memory"),
        "INFO padding line",
        ...Array.from({ length: n }, () => "10:00:01 ERROR EL0004 memory alloc failed"),
      ].join("\n");
    const buildRankedStartupsUnrankedMla = (n: number) =>
      [
        ...Array.from({ length: n }, (_, i) => `10:00:00 [rank${i}] INFO Application startup complete.`),
        ...Array.from(
          { length: n },
          (_, i) => `10:00:01 pid=${1000 + i} ERROR mla_preprocess rtMemcpy error code 107030`,
        ),
        ...Array.from({ length: n }, (_, i) => `10:00:02 pid=${1000 + i} ERROR RuntimeError: worker aborted`),
      ].join("\n");
    const buildMlaNonAbortBurst = (n: number) =>
      [
        ...Array.from(
          { length: n },
          () => "10:00:00 [rank0] ERROR mla_preprocess rtMemcpy error code 107030",
        ),
        ...Array.from({ length: n }, () => "10:00:01 [rank0] ERROR FileNotFoundError: missing aux file"),
      ].join("\n");
    const buildPreEl0004PostStartupSameSecOom = (n: number) =>
      [
        ...Array.from({ length: n }, () => "10:00:00 [rank0] ERROR EL0004 memory alloc failed"),
        "10:00:01 [rank0] INFO Application startup complete.",
        ...Array.from({ length: n }, () => "10:00:01 [rank0] ERROR NPU out of memory"),
      ].join("\n");
    const buildMultiGroupSharedVisHosts = (n: number) =>
      [
        ...Array.from(
          { length: 16 },
          (_, g) => `instance=A group=g${g} pid=42 ASCEND_RT_VISIBLE_DEVICES=4,5`,
        ),
        ...Array.from({ length: n }, (_, h) => `host=h_${h} instance=A pid=42 ASCEND_RT_VISIBLE_DEVICES=4,5`),
        ...Array.from(
          { length: n },
          (_, h) => `10:00:0${h === 0 ? 0 : 1} host=h_${h} instance=A pid=42 [rank0] ERROR NPU out of memory`,
        ),
      ].join("\n");
    const buildSegmentedPeerExcerpts = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        [
          `... [日志节选：下行起原行号 L${i * 10 + 1}] ...`,
          "[rank0] ERROR NPU out of memory",
          "[rank0] INFO Application startup complete.",
          "[rank1] ERROR RuntimeError: peer rank 0 exited",
        ].join("\n"),
      ).join("\n");
    const buildSingleSegmentPeerExcerpts = (n: number) =>
      Array.from({ length: n }, () =>
        [
          "[rank0] ERROR NPU out of memory",
          "[rank0] INFO Application startup complete.",
          "[rank1] ERROR RuntimeError: peer rank 0 exited",
        ].join("\n"),
      ).join("\n");
    const buildMatchingPidMla = (n: number) =>
      [
        ...Array.from(
          { length: n },
          (_, i) => `10:00:00 [rank0] pid=${1000 + i} ERROR mla_preprocess rtMemcpy error code 107030`,
        ),
        ...Array.from(
          { length: n },
          (_, i) => `10:00:01 [rank0] pid=${1000 + i} ERROR RuntimeError: worker aborted unexpectedly`,
        ),
      ].join("\n");

    for (const [buildFn, field, verifyFn] of [
      [
        buildUnscopedCompile,
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.findings.some((f) => f.ruleId === "torchair-ge-graph-compile-fault")).toBe(true),
      ],
      [
        buildUnscopedOomEl0004,
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.findings[0]?.ruleId).toBe("oom-stage-split"),
      ],
      [
        buildRankedStartupsUnrankedMla,
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.findings.some((f) => f.ruleId === "cann-plog-aicore-fault")).toBe(true),
      ],
      [
        buildMlaNonAbortBurst,
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.firstFaultVerdict.rank).toBe(0),
      ],
      [
        buildPreEl0004PostStartupSameSecOom,
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.findings[0]?.ruleId).toBe("cann-driver-or-device-env-fault"),
      ],
      [
        buildMultiGroupSharedVisHosts,
        "visCandidateScans",
        (r: ReturnType<typeof analyzeTroubleshootInput>) => expect(r.visibleDevices).toEqual([4, 5]),
      ],
      [
        buildSegmentedPeerExcerpts,
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.findings[0]?.ruleId).toBe("oom-stage-split"),
      ],
      [
        buildSingleSegmentPeerExcerpts,
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.findings[0]?.ruleId).toBe("oom-stage-split"),
      ],
      [
        buildMatchingPidMla,
        "startupBoundarySteps",
        (r: ReturnType<typeof analyzeTroubleshootInput>) =>
          expect(r.findings.some((f) => f.ruleId === "cann-plog-aicore-fault")).toBe(true),
      ],
    ] as const) {
      let ops32 = 0;
      withAnalyzerScaleProbeForTest((probe) => {
        analyzeTroubleshootInput(buildFn(32));
        ops32 = probe[field];
      });
      let ops256 = 0;
      const res256 = withAnalyzerScaleProbeForTest((probe) => {
        const res = analyzeTroubleshootInput(buildFn(256));
        ops256 = probe[field];
        return res;
      });
      verifyFn(res256);
      expect(ops256).toBeLessThan(Math.max(ops32, 32) * 16);
    }

    let matchingPidSteps256 = 0;
    withAnalyzerScaleProbeForTest((probe) => {
      analyzeTroubleshootInput(buildMatchingPidMla(256));
      matchingPidSteps256 = probe.startupBoundarySteps;
    });
    expect(matchingPidSteps256).toBeGreaterThanOrEqual(256);
  });

  it("Post-merge seam closure: isolates groupTag in activeScopeDetectedRanks across prefill/decode groups", () => {
    const groupMixed = analyzeTroubleshootInput(
      [
        "10:00:00 group=prefill ASCEND_RT_VISIBLE_DEVICES=0,1",
        "10:00:00 group=decode ASCEND_RT_VISIBLE_DEVICES=0,1",
        "10:00:01 group=decode [rank1] INFO decode worker ready",
        "10:00:02 group=prefill [rank0] ERROR NPU out of memory",
      ].join("\n"),
    );
    expect(groupMixed.firstFaultVerdict.rank).toBe(0);
    expect(groupMixed.detectedRanks).toEqual([0, 1]);
    expect(groupMixed.activeScopeDetectedRanks).toEqual([0]);
  });
});
