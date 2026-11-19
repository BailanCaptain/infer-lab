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
});
