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
    expect(sleepFinding?.mechanism).toContain("utils.py#L373-L386");
    expect(sleepFinding?.mechanism).toContain("并不转 NZ");
    expect(sleepFinding?.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L279-L286");
    expect(sleepFinding?.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/utils.py#L373-L386");

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

    // ASCII hyphen variant also triggers soc-310p-or-c8-compat without false positives
    const asciiErr3 = analyzeTroubleshootInput(err3Fixture.content.replaceAll("\u2011", "-"));
    expect(asciiErr3.findings.map((f) => f.ruleId)).toEqual(["soc-310p-or-c8-compat"]);
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
});
