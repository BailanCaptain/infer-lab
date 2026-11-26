import { describe, expect, it } from "vitest";
import { classifyEnvVar, evaluateCouplingRules } from "../rules";
import { inferModelHints, parseVllmServeCommand } from "./cliParser";
import { DEFERRED_ADVANCED_BRIDGE_PROMPT, runPdConfigDoctor, runSingleConfigDoctor } from "./configDoctor";
import { FULL_SINGLE_DOCTOR_PRESETS, MINIMAL_DOCTOR_PRESETS, PD_DOCTOR_PRESETS } from "./presets";

describe("vllm serve CLI + Env + JSON Parser (cliParser.ts)", () => {
  it("parses multi-line bash continuations, comments, exports, inline envs, and quoted JSON flags", () => {
    const cmd = `
      # Comment line
      source /usr/local/Ascend/ascend-toolkit/set_env.sh
      export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3 # inline comment
      export HCCL_BUFFSIZE=1024
      VLLM_USE_V2_MODEL_RUNNER=1 vllm serve /models/Qwen3-30B-A3B-W8A8 \\
        --served-model-name qwen3-moe \\
        -tp 4 \\
        --enable-expert-parallel \\
        --quantization=ascend \\
        --max-model-len 16384 \\
        --max-num-batched-tokens 8192 \\
        --gpu-memory-utilization 0.90 \\
        -cc '{"cudagraph_mode":"FULL_DECODE_ONLY","cudagraph_capture_sizes":[1,2,4,8]}' \\
        --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":true,"enable_static_kernel":true}}' \\
        --port 8080 &
    `;
    const parsed = parseVllmServeCommand(cmd);
    expect(parsed.parseDiagnostics).toHaveLength(0);
    expect(parsed.shellPreamble).toHaveLength(1);
    expect(parsed.visibleDevices).toEqual([0, 1, 2, 3]);
    expect(parsed.envVars.HCCL_BUFFSIZE).toBe("1024");
    expect(parsed.envVars.VLLM_USE_V2_MODEL_RUNNER).toBe("1");
    expect(parsed.model).toBe("/models/Qwen3-30B-A3B-W8A8");
    expect(parsed.servedModelName).toBe("qwen3-moe");
    expect(parsed.port).toBe(8080);
    expect(parsed.gpuMemoryUtilization).toBe(0.9);
    expect(parsed.requiredLocalRanks).toBe(4);
    expect(parsed.couplingInput.tpSize).toBe(4);
    expect(parsed.couplingInput.enableExpertParallel).toBe(true);
    expect(parsed.couplingInput.isMoe).toBe(true);
    expect(parsed.couplingInput.numExperts).toBe(128);
    expect(parsed.couplingInput.numExpertsPerTok).toBe(8);
    expect(parsed.couplingInput.numKvHeads).toBe(4);
    expect(parsed.couplingInput.useV2ModelRunner).toBe(true);
    expect(parsed.couplingInput.cudagraphMode).toBe("FULL_DECODE_ONLY");
    expect(parsed.couplingInput.enableNpugraphEx).toBe(true);
    expect(parsed.couplingInput.enableStaticKernel).toBe(true);
  });

  it("surfaces structured parse errors for broken JSON, invalid numbers, unterminated quotes, and K8s VLLM_PORT URI", () => {
    const broken = `
      export VLLM_PORT=tcp://10.96.0.1:8000
      vllm serve /models/Qwen3-8B \\
        -tp nope \\
        --gpu-memory-utilization 1.2 \\
        --additional-config '{"enable_npugraph_ex": true,}'
    `;
    const parsed = parseVllmServeCommand(broken);
    const codes = parsed.parseDiagnostics.map((d) => d.code);
    expect(codes).toContain("parse-invalid-vllm-port");
    expect(codes).toContain("parse-invalid-number");
    expect(codes).toContain("parse-invalid-range");
    expect(codes).toContain("parse-invalid-json");

    const unterminated = `vllm serve /models/Qwen3-8B --compilation-config '{"cudagraph_mode":"FULL"`;
    expect(
      parseVllmServeCommand(unterminated).parseDiagnostics.some((d) => d.code === "parse-unterminated-quote"),
    ).toBe(true);
  });

  it("infers accurate model hints from Qwen3-8B, Qwen3-30B-A3B, -FP8, and -W8A8 paths", () => {
    const dense = inferModelHints("/root/.cache/Qwen3-8B");
    expect(dense.isMoe).toBe(false);
    expect(dense.numAttentionHeads).toBe(32);
    expect(dense.numKvHeads).toBe(8);

    const moe = inferModelHints("Qwen/Qwen3-30B-A3B-FP8");
    expect(moe.isMoe).toBe(true);
    expect(moe.numExperts).toBe(128);
    expect(moe.numExpertsPerTok).toBe(8);
    expect(moe.numAttentionHeads).toBe(32);
    expect(moe.numKvHeads).toBe(4);
    expect(moe.quantMethod).toBe("fp8");
    expect(moe.hasWeightBlockSize).toBe(true);
  });
});

describe("Wave 2 Source-Verified Rule Alignments (GQA C8, 310P dtype, Retired vs Deprecated Env)", () => {
  it("blocks GQA --kv-cache-dtype int8 without ModelSlim --quantization ascend (attention_v1.py#L570-L587)", () => {
    const blocked = evaluateCouplingRules(
      { useMla: false, cacheDtype: "int8", modelDtype: "bfloat16" },
      "v0.30.0",
    );
    const match = blocked.errors.find((m) => m.ruleId === "d3-gqa-c8-requires-quant-weights");
    expect(match).toBeDefined();
    expect(match?.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L570-L587");

    const ok = evaluateCouplingRules(
      { useMla: false, cacheDtype: "int8", quantMethod: "ascend", enableC8Quant: true },
      "v0.30.0",
    );
    expect(ok.errors.some((m) => m.ruleId === "d3-gqa-c8-requires-quant-weights")).toBe(false);
  });

  it("blocks Ascend 310P on BF16 or missing --dtype float16 even with W8A8SC --quantization ascend", () => {
    const missingFloat16 = runSingleConfigDoctor(`vllm serve /models/Qwen3-8B-W8A8SC --quantization ascend`, {
      mode: "minimal",
      hardwareFamily: "310P",
      version: "v0.30.0",
    });
    expect(missingFloat16.errors.some((f) => f.id === "d3-310p-requires-float16")).toBe(true);

    const withFloat16 = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-8B-W8A8SC --quantization ascend --dtype float16 --gpu-memory-utilization 0.90`,
      { mode: "minimal", hardwareFamily: "310P", version: "v0.30.0" },
    );
    expect(withFloat16.errors.some((f) => f.id === "d3-310p-requires-float16")).toBe(false);
  });

  it("distinguishes 0-read retired env vars from VLLM_ASCEND_ENABLE_FLASHCOMM1 live os.getenv fallback and unknown HCCL_BUFFSIZE_EP", () => {
    for (const retired of [
      "VLLM_ASCEND_ENABLE_NZ",
      "VLLM_ASCEND_ENABLE_MLAPO",
      "VLLM_ASCEND_ENABLE_FUSED_MC2",
      "MSMONITOR_USE_DAEMON",
    ]) {
      const c = classifyEnvVar(retired, "v0.30.0");
      expect(c.judgment).toBe("retired");
      expect(c.evidenceLevel).toBe("C");
      expect(c.replacement).toContain("--additional-config");
    }

    const fc1 = classifyEnvVar("VLLM_ASCEND_ENABLE_FLASHCOMM1", "v0.30.0");
    expect(fc1.judgment).toBe("deprecated-fallback");
    expect(fc1.evidenceLevel).toBe("C");
    expect(fc1.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L747-L750");
    expect(fc1.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1016-L1022");

    const unknown = classifyEnvVar("HCCL_BUFFSIZE_EP", "v0.30.0");
    expect(unknown.judgment).toBe("unknown");
    expect(unknown.ruleJudgment).toBe("unknown");
    expect(unknown.evidenceLevel).toBe("I");

    const report = runSingleConfigDoctor(
      `export VLLM_ASCEND_ENABLE_NZ=0
export VLLM_ASCEND_ENABLE_FLASHCOMM1=1
export HCCL_BUFFSIZE_EP=512
vllm serve /models/Qwen3-8B --gpu-memory-utilization 0.90`,
      { mode: "minimal", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(report.warnings.some((f) => f.id === "d5-retired-ascend-env-var")).toBe(true);
    expect(report.warnings.some((f) => f.id === "d5-deprecated-flashcomm1-env-fallback")).toBe(true);
    expect(report.unknowns.some((f) => f.id === "d5-cann-env-var-classification")).toBe(true);
    expect(report.errors.some((f) => f.message.includes("HCCL_BUFFSIZE_EP"))).toBe(false);
  });
});

describe("Strict Zero DAG Inversion in minimal mode vs full mode", () => {
  it("defers P/D, super_kernel, static_kernel, FA3, and PCP/DCP in minimal mode without emitting domain4/advanced findings", () => {
    const advancedCmd = `
      export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
      vllm serve /models/Qwen3-8B \\
        -tp 2 --pcp-size 2 --dcp-size 2 \\
        --attention-backend FA3 \\
        --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \\
        --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":false,"enable_super_kernel":true},"recompute_scheduler_enable":true}' \\
        --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer"}'
    `;
    const minReport = runSingleConfigDoctor(advancedCmd, {
      mode: "minimal",
      hardwareFamily: "A2",
      version: "v0.30.0",
    });

    expect(minReport.findings.some((f) => f.domain === "cp-pd")).toBe(false);
    expect(
      minReport.findings.some(
        (f) =>
          f.id.includes("super") ||
          f.id.includes("static-kernel") ||
          f.id.includes("fa3") ||
          f.id.includes("pcp") ||
          f.id.includes("mooncake") ||
          f.id.includes("recompute"),
      ),
    ).toBe(false);
    expect(minReport.deferredAdvancedFeatures.length).toBeGreaterThanOrEqual(4);
    expect(minReport.deferredAdvancedPrompt).toBe(DEFERRED_ADVANCED_BRIDGE_PROMPT);
    expect(minReport.moeCommSelection).toBeNull();
    expect(minReport.hcclEstimate).toBeNull();

    // Same command in full mode surfaces all advanced coupling errors & rewrites
    const fullReport = runSingleConfigDoctor(advancedCmd, {
      mode: "full",
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(fullReport.deferredAdvancedFeatures).toHaveLength(0);
    expect(fullReport.deferredAdvancedPrompt).toBeNull();
    expect(fullReport.errors.some((f) => f.id === "d4-pcp-requires-mrv2")).toBe(true);
    expect(fullReport.errors.some((f) => f.id === "d5-fa3-full-decode-only-error")).toBe(true);
    expect(fullReport.errors.some((f) => f.id === "d5-solo-super-or-static-kernel-error")).toBe(true);
    expect(fullReport.silentRewrites.some((f) => f.id === "d4-recompute-scheduler-p-node-disable")).toBe(
      true,
    );
    expect(fullReport.hcclEstimate).not.toBeNull();
  });
});

describe("P/D Dual-Instance Joint Mode (runPdConfigDoctor)", () => {
  it("detects Mooncake TP_P % TP_D != 0, D-node PP != 1, and P-node recompute_scheduler in pitfall preset", () => {
    const pitfall = PD_DOCTOR_PRESETS.find((p) => p.health === "pitfall")!;
    const report = runPdConfigDoctor(pitfall.prefillCommand, pitfall.decodeCommand, {
      hardwareFamily: pitfall.hardwareFamily,
      decodeHardwareFamily: pitfall.decodeHardwareFamily,
      version: pitfall.version,
    });

    expect(report.hasBlockers).toBe(true);
    expect(
      report.crossInstanceFindings.some(
        (f) => f.id === "d4-mooncake-tp-p-divisible-tp-d" && f.judgment === "error",
      ),
    ).toBe(true);
    expect(report.decode.errors.some((f) => f.id === "d4-mooncake-decode-pp-eq-1")).toBe(true);
    expect(report.prefill.silentRewrites.some((f) => f.id === "d4-recompute-scheduler-p-node-disable")).toBe(
      true,
    );
  });

  it("passes healthy P/D preset with zero blockers", () => {
    const healthy = PD_DOCTOR_PRESETS.find((p) => p.health === "healthy")!;
    const report = runPdConfigDoctor(healthy.prefillCommand, healthy.decodeCommand, {
      hardwareFamily: healthy.hardwareFamily,
      decodeHardwareFamily: healthy.decodeHardwareFamily,
      version: healthy.version,
    });

    expect(report.hasBlockers).toBe(false);
    expect(report.crossInstanceFindings).toHaveLength(0);
    expect(report.errors).toHaveLength(0);
  });

  it("catches mismatched kv_connector, block_size, kv_cache_dtype, GQA+C8 MooncakeConnectorV1, and P-node sparse_kv_offload", () => {
    const pCmd = `
      vllm serve /models/Qwen3-8B-W8A8-C8 \\
        -tp 4 --quantization ascend --block-size 128 --kv-cache-dtype int8 \\
        --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer"}' \\
        --additional-config '{"sparse_kv_offload_config":{"enabled":true}}'
    `;
    const dCmd = `
      vllm serve /models/Qwen3-8B-W8A8-C8 \\
        -tp 2 --quantization ascend --block-size 64 --kv-cache-dtype auto \\
        --kv-transfer-config '{"kv_connector":"MooncakeLayerwiseConnector","kv_role":"kv_consumer"}'
    `;
    const report = runPdConfigDoctor(pCmd, dCmd, {
      hardwareFamily: "A3",
      version: "v0.30.0",
    });

    expect(report.crossInstanceFindings.some((f) => f.id === "pd-connector-mismatch")).toBe(true);
    expect(report.crossInstanceFindings.some((f) => f.id === "pd-block-size-mismatch")).toBe(true);
    expect(report.crossInstanceFindings.some((f) => f.id === "pd-kv-cache-dtype-mismatch")).toBe(true);
    expect(report.prefill.errors.some((f) => f.id === "d4-mooncake-gqa-c8-forbidden")).toBe(true);
    expect(report.prefill.errors.some((f) => f.id === "d4-sparse-kv-offload-constraints")).toBe(true);
  });

  it("P1 regression: blocks P/D and single commands when kv_connector is set without mandatory kv_role", () => {
    const pMissingRole = `vllm serve /models/Qwen3-8B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1"}'`;
    const dMissingRole = `vllm serve /models/Qwen3-8B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1"}'`;

    const pdReport = runPdConfigDoctor(pMissingRole, dMissingRole, {
      hardwareFamily: "A3",
      version: "v0.30.0",
    });
    expect(pdReport.hasBlockers).toBe(true);
    expect(pdReport.errors.length).toBeGreaterThan(0);
    expect(pdReport.prefill.hasBlockers).toBe(true);
    expect(pdReport.decode.hasBlockers).toBe(true);
    expect(
      pdReport.errors.some(
        (f) => (f.remediation ?? "").includes("kv_producer") && (f.remediation ?? "").includes("kv_consumer"),
      ),
    ).toBe(true);

    const singleReport = runSingleConfigDoctor(pMissingRole, {
      mode: "full",
      hardwareFamily: "A3",
      version: "v0.30.0",
    });
    expect(singleReport.hasBlockers).toBe(true);
    expect(singleReport.errors.some((f) => f.id === "d4-kv-connector-missing-kv-role")).toBe(true);
  });

  it("P2-3 regression: raw kv_transfer_config missing kv_role cannot be masked by override, enforces case-sensitive kv_role literal, and cites L130-L140", () => {
    const expectedSource = "vllm@ced6857a:vllm/config/kv_transfer.py#L130-L140";
    const pMissingRole = `vllm serve /models/Qwen3-8B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1"}'`;
    const dValid = `vllm serve /models/Qwen3-8B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer"}'`;

    // 1. prefillTraitOverride.kvRole must NOT mask missing kv_role in raw --kv-transfer-config JSON
    const pdMaskedAttempt = runPdConfigDoctor(pMissingRole, dValid, {
      hardwareFamily: "A3",
      version: "v0.30.0",
      prefillTraitOverride: { kvRole: "kv_producer" },
    });
    expect(pdMaskedAttempt.hasBlockers).toBe(true);
    expect(pdMaskedAttempt.prefill.hasBlockers).toBe(true);
    const missingCross = pdMaskedAttempt.crossInstanceFindings.find((f) => f.id === "pd-missing-kv-role");
    expect(missingCross?.judgment).toBe("error");
    expect(missingCross?.sources).toContain(expectedSource);
    const missingSingle = pdMaskedAttempt.prefill.errors.find(
      (f) => f.id === "d4-kv-connector-missing-kv-role",
    );
    expect(missingSingle?.sources).toContain(expectedSource);

    // 2. Uppercase "KV_PRODUCER" must be rejected (upstream Literal is strictly case-sensitive)
    const pUpperRole = `vllm serve /models/Qwen3-8B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"KV_PRODUCER"}'`;
    const singleUpper = runSingleConfigDoctor(pUpperRole, {
      mode: "full",
      hardwareFamily: "A3",
      version: "v0.30.0",
    });
    expect(singleUpper.hasBlockers).toBe(true);
    const upperErr = singleUpper.errors.find((f) => f.id === "d4-kv-role-invalid-literal");
    expect(upperErr).toBeDefined();
    expect(upperErr?.sources).toContain(expectedSource);

    const pdUpper = runPdConfigDoctor(pUpperRole, dValid, {
      hardwareFamily: "A3",
      version: "v0.30.0",
    });
    expect(pdUpper.hasBlockers).toBe(true);
    expect(pdUpper.prefill.hasBlockers).toBe(true);
    expect(pdUpper.prefill.errors.some((f) => f.id === "d4-kv-role-invalid-literal")).toBe(true);
  });
});

describe("Curated Doctor Presets (minimal & full)", () => {
  it("validates all 3 minimal presets match expected healthy/pitfall outcomes", () => {
    const [healthyA2, pitfall310p, pitfallFp8] = MINIMAL_DOCTOR_PRESETS;
    expect(healthyA2).toBeDefined();
    expect(pitfall310p).toBeDefined();
    expect(pitfallFp8).toBeDefined();

    const rHealthy = runSingleConfigDoctor(healthyA2!.command, {
      mode: "minimal",
      hardwareFamily: healthyA2!.hardwareFamily,
      version: healthyA2!.version,
    });
    expect(rHealthy.hasBlockers).toBe(false);
    expect(rHealthy.batchTokensResolution.finalMaxNumBatchedTokens).toBe(2048);
    expect(rHealthy.deferredAdvancedFeatures).toHaveLength(0);

    const r310p = runSingleConfigDoctor(pitfall310p!.command, {
      mode: "minimal",
      hardwareFamily: pitfall310p!.hardwareFamily,
      version: pitfall310p!.version,
    });
    expect(r310p.hasBlockers).toBe(true);
    expect(r310p.errors.some((f) => f.id === "d3-310p-requires-float16")).toBe(true);
    expect(r310p.errors.some((f) => f.id === "env-visible-devices-mismatch")).toBe(true);
    expect(r310p.warnings.some((f) => f.id === "d5-retired-ascend-env-var")).toBe(true);

    const rFp8 = runSingleConfigDoctor(pitfallFp8!.command, {
      mode: "minimal",
      hardwareFamily: pitfallFp8!.hardwareFamily,
      version: pitfallFp8!.version,
    });
    expect(rFp8.hasBlockers).toBe(false);
    expect(rFp8.silentRewrites.some((f) => f.id === "d3-fp8-block-non950-bf16-v030")).toBe(true);
    expect(rFp8.unknowns.some((f) => f.id === "d5-cann-env-var-classification")).toBe(true);
    expect(rFp8.warnings.some((f) => f.id === "doc-high-gpu-mem-util")).toBe(true);
  });

  it("validates full single-instance healthy and pitfall presets", () => {
    const [healthyMoe, pitfallPiecewise] = FULL_SINGLE_DOCTOR_PRESETS;
    expect(healthyMoe).toBeDefined();
    expect(pitfallPiecewise).toBeDefined();

    const rHealthy = runSingleConfigDoctor(healthyMoe!.command, {
      mode: "full",
      hardwareFamily: healthyMoe!.hardwareFamily,
      version: healthyMoe!.version,
    });
    expect(rHealthy.hasBlockers).toBe(false);
    expect(rHealthy.moeCommSelection?.method).toBe("MC2");
    expect(rHealthy.hcclEstimate).not.toBeNull();

    const rPitfall = runSingleConfigDoctor(pitfallPiecewise!.command, {
      mode: "full",
      hardwareFamily: pitfallPiecewise!.hardwareFamily,
      version: pitfallPiecewise!.version,
    });
    expect(rPitfall.hasBlockers).toBe(true);
    expect(rPitfall.silentRewrites.some((f) => f.id === "d5-graph-mode-resets-npugraph-ex")).toBe(true);
    expect(rPitfall.errors.some((f) => f.id === "d3-gqa-c8-requires-quant-weights")).toBe(true);
    expect(rPitfall.effectiveRewrites.some((row) => row.ruleId === "d5-graph-mode-resets-npugraph-ex")).toBe(
      true,
    );
  });
});

describe("Wave 3 Review Remediations (P2-2, P2-3, P2-4, P3-2, P3-3)", () => {
  it("P2-2: parses nested Mooncake kv_connector_extra_config.prefill.tp_size / decode.tp_size in single-instance mode", () => {
    const cmd = `
      vllm serve /models/Qwen3-30B-A3B-W8A8 \\
        --tensor-parallel-size 4 --enable-expert-parallel --quantization ascend \\
        --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer","kv_connector_extra_config":{"prefill":{"tp_size":4,"dp_size":1},"decode":{"tp_size":3,"dp_size":1}}}'
    `;
    const parsed = parseVllmServeCommand(cmd);
    expect(parsed.couplingInput.prefillTpSize).toBe(4);
    expect(parsed.couplingInput.decodeTpSize).toBe(3);

    const report = runSingleConfigDoctor(cmd, {
      mode: "full",
      hardwareFamily: "A3",
      version: "v0.30.0",
    });
    expect(report.errors.some((f) => f.id === "d4-mooncake-tp-p-divisible-tp-d")).toBe(true);
  });

  it("P2-3: unknown or boolean flags placed before <model> do not swallow the model path", () => {
    const cmd = `vllm serve --disable-log-requests --some-custom-flag /models/Qwen3-30B-A3B -tp 4 --enable-expert-parallel`;
    const parsed = parseVllmServeCommand(cmd);
    expect(parsed.model).toBe("/models/Qwen3-30B-A3B");
    expect(parsed.couplingInput.isMoe).toBe(true);
    expect(parsed.couplingInput.tpSize).toBe(4);
    expect(parsed.couplingInput.maxModelLen).toBe(40960);
  });

  it("P2-4: preserves additional_config.enable_fused_mc2=2/3 and triggers FUSED_MC2 dispatch", () => {
    const cmd2 = `
      vllm serve /models/Qwen3-30B-A3B-W8A8 -tp 4 --enable-expert-parallel --quantization ascend \\
        --additional-config '{"enable_fused_mc2": 2}'
    `;
    const parsed2 = parseVllmServeCommand(cmd2);
    expect(parsed2.couplingInput.enableFusedMc2).toBe(2);
    const report2 = runSingleConfigDoctor(cmd2, {
      mode: "full",
      hardwareFamily: "A3",
      version: "v0.30.0",
    });
    expect(report2.moeCommSelection?.method).toBe("FUSED_MC2");

    const cmd3 = `
      vllm serve /models/Qwen3-30B-A3B-W8A8 -tp 4 --enable-expert-parallel --quantization ascend \\
        --additional-config '{"enable_fused_mc2": 3}'
    `;
    expect(parseVllmServeCommand(cmd3).couplingInput.enableFusedMc2).toBe(3);
  });

  it("P3-2: blocks GQA C8 INT8 with non-32-multiple --block-size (e.g. 16)", () => {
    const cmd = `
      vllm serve /models/Qwen3-8B-W8A8-C8 --quantization ascend --kv-cache-dtype int8 --block-size 16
    `;
    const report = runSingleConfigDoctor(cmd, {
      mode: "full",
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(report.errors.some((f) => f.id === "d3-gqa-c8-block-size-multiple-32")).toBe(true);
  });

  it("P3-3: handles nohup wrapper, shell redirections, --underscore_flags, and 16k/32k integer suffixes", () => {
    const cmd = `
      nohup env ASCEND_RT_VISIBLE_DEVICES=0,1 vllm serve /models/Qwen3-8B \\
        --tensor_parallel_size 2 \\
        --max_model_len 32k \\
        --max_num_batched_tokens 16K \\
        --gpu_memory_utilization 0.90 > serve.log 2>&1 &
    `;
    const parsed = parseVllmServeCommand(cmd);
    expect(parsed.parseDiagnostics).toHaveLength(0);
    expect(parsed.visibleDevices).toEqual([0, 1]);
    expect(parsed.model).toBe("/models/Qwen3-8B");
    expect(parsed.couplingInput.tpSize).toBe(2);
    // Per upstream vllm/utils/argparse_utils.py#L29-L72: lowercase 'k' = 1000 (decimal), uppercase 'K' = 1024 (binary)
    expect(parsed.couplingInput.maxModelLen).toBe(32000);
    expect(parsed.couplingInput.maxNumBatchedTokens).toBe(16384);
    expect(parsed.gpuMemoryUtilization).toBe(0.9);
  });

  it("Audit Wave 6 regressions: forwards enableSleepMode, rejects enable_fused_mc2=3 on v0.30.0, and does not tag GLM-4.5/4.7 as MLA", () => {
    // Bug 2: cliParser forwards enableSleepMode to couplingInput
    const withSleep = parseVllmServeCommand(
      `PYTORCH_NPU_ALLOC_CONF=page_size:1g,expandable_segments:True vllm serve /models/Qwen3-8B --enable-sleep-mode --additional-config '{"rl_config":{"enabled":true}}'`,
    );
    expect(withSleep.enableSleepMode).toBe(true);
    expect(withSleep.couplingInput.enableSleepMode).toBe(true);

    const noSleep = parseVllmServeCommand(
      `PYTORCH_NPU_ALLOC_CONF=page_size:1g,expandable_segments:True vllm serve /models/Qwen3-8B --additional-config '{"rl_config":{"enabled":true}}'`,
    );
    expect(noSleep.enableSleepMode).toBe(false);
    expect(noSleep.couplingInput.enableSleepMode).toBe(false);

    // Bug 3: enable_fused_mc2=3 rejected on v0.30.0, accepted on main
    const cmd3 = `vllm serve /models/Qwen3-30B-A3B-W8A8 -tp 4 --enable-expert-parallel --quantization ascend --additional-config '{"enable_fused_mc2": 3}'`;
    const rV030 = runSingleConfigDoctor(cmd3, { mode: "full", hardwareFamily: "A5", version: "v0.30.0" });
    expect(rV030.errors.some((f) => f.id === "d1-fused-mc2-3-main-only")).toBe(true);
    const rMain = runSingleConfigDoctor(cmd3, { mode: "full", hardwareFamily: "A5", version: "main" });
    expect(rMain.errors.some((f) => f.id === "d1-fused-mc2-3-main-only")).toBe(false);
    expect(rMain.moeCommSelection?.method).toBe("FUSED_MC2");

    // Bug 4: GLM-4.5 / GLM-4.7 are GQA/MHA (useMla: false), while GLM-5 / GLM-5.3-Flash are MLA (useMla: true)
    const glm45 = inferModelHints("zai-org/GLM-4.5");
    expect(glm45.isMoe).toBe(true);
    expect(glm45.useMla).toBe(false);

    const glm47 = inferModelHints("/models/GLM-4.7-W8A8");
    expect(glm47.isMoe).toBe(true);
    expect(glm47.useMla).toBe(false);

    const glm5 = inferModelHints("zai-org/GLM-5");
    expect(glm5.isMoe).toBe(true);
    expect(glm5.useMla).toBe(true);

    const glm53 = inferModelHints("/models/GLM-5.3-Flash");
    expect(glm53.isMoe).toBe(true);
    expect(glm53.useMla).toBe(true);

    // GLM-4.5 with GQA C8 int8 without --quantization ascend MUST NOT skip d3-gqa-c8-requires-quant-weights
    const glm45C8 = runSingleConfigDoctor(`vllm serve /models/GLM-4.5 -tp 4 --kv-cache-dtype int8`, {
      mode: "full",
      hardwareFamily: "A3",
      version: "v0.30.0",
    });
    expect(glm45C8.errors.some((f) => f.id === "d3-gqa-c8-requires-quant-weights")).toBe(true);
  });

  it("WS4 promoted parameter CLI-to-ConfigDoctor end-to-end checks across v0.30.0 and main", () => {
    // 1. Passing main-only shared_engram / quantized_all_reduce_config / runtime_config on v0.30.0 triggers error even in minimal mode
    const mainOnlyOnV030 = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-8B --additional-config '{"quantized_all_reduce_config":{"enable":true},"kv_pool_range_debug":true}'`,
      { mode: "minimal", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(mainOnlyOnV030.hasBlockers).toBe(true);
    expect(mainOnlyOnV030.errors.some((f) => f.id === "d5-main-only-additional-config-keys")).toBe(true);

    // 2. quantized_all_reduce_config on main: errors on A3, passes on A2 with TP=8
    const qarCmd = `vllm serve /models/Qwen3-32B -tp 8 --additional-config '{"quantized_all_reduce_config":{"enable":true,"min_numel":16777216}}'`;
    const qarA3 = runSingleConfigDoctor(qarCmd, { mode: "full", hardwareFamily: "A3", version: "main" });
    expect(qarA3.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(true);
    const qarA2 = runSingleConfigDoctor(qarCmd, { mode: "full", hardwareFamily: "A2", version: "main" });
    expect(qarA2.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(false);

    // 3. shared_engram A5: omitting --shutdown-timeout defaults to 0 and errors; DP=1 errors; -tp 4 -dp 2 --shutdown-timeout 120 passes; -pp 2 errors
    const seDefaultTimeout = runSingleConfigDoctor(
      `vllm serve /models/DeepSeek-V4.1-Flash -tp 4 -dp 2 --additional-config '{"shared_engram":{"backend":"a5","endpoint":"10.0.0.8:29500"}}'`,
      { mode: "full", hardwareFamily: "A5", version: "main" },
    );
    expect(seDefaultTimeout.errors.some((f) => f.id === "d5-shared-engram-constraints")).toBe(true);

    const seMissingDp = runSingleConfigDoctor(
      `vllm serve /models/DeepSeek-V4.1-Flash --shutdown-timeout 120 --additional-config '{"shared_engram":{"backend":"a5","endpoint":"10.0.0.8:29500"}}'`,
      { mode: "full", hardwareFamily: "A5", version: "main" },
    );
    expect(seMissingDp.errors.some((f) => f.id === "d5-shared-engram-constraints")).toBe(true);

    const seBadPp = runSingleConfigDoctor(
      `vllm serve /models/DeepSeek-V4.1-Flash -tp 4 -pp 2 -dp 2 --shutdown-timeout 120 --additional-config '{"shared_engram":{"backend":"a5","endpoint":"10.0.0.8:29500"}}'`,
      { mode: "full", hardwareFamily: "A5", version: "main" },
    );
    expect(seBadPp.errors.some((f) => f.id === "d5-shared-engram-constraints")).toBe(true);

    const seOk = runSingleConfigDoctor(
      `vllm serve /models/DeepSeek-V4.1-Flash -tp 4 -dp 2 --shutdown-timeout 120 --additional-config '{"shared_engram":{"backend":"a5","endpoint":"10.0.0.8:29500"}}'`,
      { mode: "full", hardwareFamily: "A5", version: "main" },
    );
    expect(seOk.errors.some((f) => f.id === "d5-shared-engram-constraints")).toBe(false);

    // 4. runtime_config_hot_reload rejects numeric interval (3) AND float literal (1.0), allows manual_dump: null, and VLLM_ASCEND_KVPOOL_RANGE_DEBUG warns as retired on main
    const rcBad = runSingleConfigDoctor(
      `export VLLM_ASCEND_KVPOOL_RANGE_DEBUG=1
vllm serve /models/Qwen3-8B --additional-config '{"runtime_config_hot_reload":1.0}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(rcBad.errors.some((f) => f.id === "d5-runtime-config-constraints")).toBe(true);
    expect(rcBad.warnings.some((f) => f.id === "d5-retired-ascend-env-var")).toBe(true);

    const rcNullDump = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-8B --additional-config '{"runtime_config":{"dump":{"manual_dump":null}}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(rcNullDump.findings.some((f) => f.id === "d5-runtime-config-constraints")).toBe(false);

    // 5. Kimi-K3 Latent-MoE blocks enable_fused_mc2=3 on main even on A5
    const kimiMc2 = runSingleConfigDoctor(
      `vllm serve /models/Kimi-K3 -tp 8 --enable-expert-parallel --additional-config '{"enable_fused_mc2":3,"enable_shared_expert_dp":true}'`,
      { mode: "full", hardwareFamily: "A5", version: "main" },
    );
    expect(kimiMc2.errors.some((f) => f.id === "d1-megamoe-shared-expert-fusion-constraints")).toBe(true);

    // 6. Dotted --additional-config.<path> & --additional_config.<path>, strict quantized_all_reduce_config sub-keys, rfork/vllm_omni, and --enable-dbo
    const dottedCmd = `vllm serve /models/Qwen3-32B -tp 4 --additional_config.quantized_all_reduce_config.enable true --additional-config.runtime_config_hot_reload=1.0`;
    const dottedRes = runSingleConfigDoctor(dottedCmd, {
      mode: "full",
      hardwareFamily: "A2",
      version: "main",
    });
    expect(dottedRes.parsed.unknownFlags).toHaveLength(0);
    expect(dottedRes.effectiveInput.quantizedAllReduceEnabled).toBe(true);
    expect(dottedRes.errors.some((f) => f.id === "d5-runtime-config-constraints")).toBe(true);

    const qarBoolBad = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-32B -tp 4 --additional-config '{"quantized_all_reduce_config":true}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(qarBoolBad.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(true);

    const qarUnknownSubkey = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-32B -tp 4 --additional-config '{"quantized_all_reduce_config":{"enabled":true,"quant_dtype":"fp8"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(qarUnknownSubkey.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(true);

    const mainOnlyRfork = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-8B --additional-config '{"kv_pool_range_debug":true}'`,
      { mode: "full", hardwareFamily: "A2", version: "rfork" },
    );
    expect(mainOnlyRfork.hasBlockers).toBe(false);
    expect(mainOnlyRfork.silentRewrites.some((f) => f.id === "d5-main-only-additional-config-keys")).toBe(
      true,
    );

    const mainOnlyOmni = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-8B --additional-config '{"kv_pool_range_debug":true}'`,
      {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelTraitOverride: { vllmOmniAvailable: true },
      },
    );
    expect(mainOnlyOmni.hasBlockers).toBe(false);
    expect(mainOnlyOmni.silentRewrites.some((f) => f.id === "d5-main-only-additional-config-keys")).toBe(
      true,
    );

    const gdnDbo = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-Next-80B-A3B -tp 4 --mamba-cache-mode align --enable-dbo --additional-config '{"gdn_internal_prefill_checkpoints":true}'`,
      { mode: "full", hardwareFamily: "A3", version: "main" },
    );
    expect(gdnDbo.warnings.some((f) => f.id === "d5-gdn-prefill-checkpoints-constraints")).toBe(true);

    // 7. Non-strict Pydantic bool ("on"/"NO"/1) on quantized_all_reduce_config.enable, lax int ("65536") & nullability on shared_engram, fractional binary suffix "1.5K", and --ubatch-size message
    const qarIntBool = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-32B -tp 4 --additional-config '{"quantized_all_reduce_config":{"enable":"on","min_numel":"32768"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(qarIntBool.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(false);
    expect(qarIntBool.effectiveInput.quantizedAllReduceEnabled).toBe(true);
    expect(qarIntBool.effectiveInput.quantizedAllReduceMinNumel).toBe(32768);

    const qarNoBool = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-32B -tp 4 --additional-config '{"quantized_all_reduce_config":{"enable":"NO"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(qarNoBool.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(false);
    expect(qarNoBool.effectiveInput.quantizedAllReduceEnabled).toBe(false);

    const seStrCap = runSingleConfigDoctor(
      `vllm serve /models/DeepSeek-V4 -tp 4 -dp 2 --shutdown-timeout 15 --enable-expert-parallel --additional-config '{"shared_engram":{"backend":"a2","endpoint":"10.0.0.1:29661","capacity":"65536"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(seStrCap.errors.some((f) => f.id === "d5-shared-engram-constraints")).toBe(false);
    expect(seStrCap.effectiveInput.sharedEngramCapacity).toBe(65536);

    const qarInvalidStr = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-32B -tp 4 --additional-config '{"quantized_all_reduce_config":{"enable":"maybe"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(qarInvalidStr.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(true);

    const qarWhitespaceBool = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-32B -tp 4 --additional-config '{"quantized_all_reduce_config":{"enable":" on "}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(qarWhitespaceBool.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(true);

    const qarUnderscoreAndDotZeroInt = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-32B -tp 4 --additional-config '{"quantized_all_reduce_config":{"enable":true,"min_numel":"32_768"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(qarUnderscoreAndDotZeroInt.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(false);
    expect(qarUnderscoreAndDotZeroInt.effectiveInput.quantizedAllReduceMinNumel).toBe(32768);

    const qarDotZeroInt = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-32B -tp 4 --additional-config '{"quantized_all_reduce_config":{"enable":true,"min_numel":"32768.0"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(qarDotZeroInt.errors.some((f) => f.id === "d1-quantized-ar-constraints")).toBe(false);
    expect(qarDotZeroInt.effectiveInput.quantizedAllReduceMinNumel).toBe(32768);

    const envV2OnInvalid = runSingleConfigDoctor(
      `VLLM_USE_V2_MODEL_RUNNER=on vllm serve Qwen/Qwen3-8B -tp 2`,
      {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
      },
    );
    expect(envV2OnInvalid.effectiveInput.useV2ModelRunner).toBeUndefined();
    expect(envV2OnInvalid.errors.some((f) => f.message.includes("VLLM_USE_V2_MODEL_RUNNER='on'"))).toBe(true);

    const envBatchInvOnInvalid = runSingleConfigDoctor(
      `VLLM_BATCH_INVARIANT=on vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(envBatchInvOnInvalid.errors.some((f) => f.message.includes("VLLM_BATCH_INVARIANT='on'"))).toBe(
      true,
    );

    const superKernelOn = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"ascend_compilation_config":{"enable_super_kernel":"on","enable_static_kernel":false}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(superKernelOn.errors.some((f) => f.id === "d5-solo-super-or-static-kernel-error")).toBe(true);

    const superKernelInvalidInt = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"ascend_compilation_config":{"enable_super_kernel":2,"enable_static_kernel":false}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(superKernelInvalidInt.errors.some((f) => f.id === "parse-invalid-json-type")).toBe(true);

    const rlTrainCons = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' --additional-config '{"rl_config":{"enabled":"on","enable_training_consistency":"yes"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(rlTrainCons.errors.some((f) => f.id === "d5-fa3-full-decode-only-error")).toBe(true);

    const profOmittedEnabledV030 = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"scheduler_config":{"profiling_chunk_config":{"min_chunk":512}}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(profOmittedEnabledV030.errors.some((f) => f.id === "d2-cpp-requires-pp-gt-1")).toBe(false);

    const profOmittedEnabledMain = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"scheduler_config":{"profiling_chunk_config":{"min_chunk":512}}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(profOmittedEnabledMain.errors.some((f) => f.id === "d2-cpp-removed-in-main")).toBe(true);

    const nestedSchedPrecedence = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B -pp 2 --additional-config '{"enable_balance_scheduling":"off","scheduler_config":{"enable_balance_scheduling":"on","profiling_chunk_config":{"enabled":true}}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(nestedSchedPrecedence.errors.some((f) => f.id === "d2-cpp-balance-mutex")).toBe(true);

    const pyIntUnderscoreAndBig = runSingleConfigDoctor(
      `VLLM_BATCH_INVARIANT=1_0 VLLM_USE_V2_MODEL_RUNNER=9007199254740992 vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(pyIntUnderscoreAndBig.errors.some((f) => f.id === "parse-invalid-number")).toBe(false);
    expect(pyIntUnderscoreAndBig.effectiveInput.vllmBatchInvariant).toBe(true);
    expect(pyIntUnderscoreAndBig.effectiveInput.useV2ModelRunner).toBe(true);

    const shellDefaultExpand = runSingleConfigDoctor(
      `BATCH=0\nVLLM_BATCH_INVARIANT=\${BATCH:-0} VLLM_USE_V2_MODEL_RUNNER=\${UNSET_MRV2:-1} vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(shellDefaultExpand.errors.some((f) => f.id === "parse-invalid-number")).toBe(false);
    expect(shellDefaultExpand.effectiveInput.vllmBatchInvariant).toBe(false);
    expect(shellDefaultExpand.effectiveInput.useV2ModelRunner).toBe(true);

    const singleQuotedLiteralEnv = runSingleConfigDoctor(
      `BATCH=0\nVLLM_BATCH_INVARIANT='\${BATCH:-0}' vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(singleQuotedLiteralEnv.errors.some((f) => f.id === "parse-invalid-number")).toBe(true);

    const trailingExportDoesNotMaskServeEnv = runSingleConfigDoctor(
      `VLLM_USE_V2_MODEL_RUNNER=on vllm serve Qwen/Qwen3-8B -tp 2\nexport VLLM_USE_V2_MODEL_RUNNER=0`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(
      trailingExportDoesNotMaskServeEnv.errors.some((f) =>
        f.message.includes("VLLM_USE_V2_MODEL_RUNNER='on'"),
      ),
    ).toBe(true);

    const passConfigSpNull = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B -tp 2 --compilation-config '{"pass_config":{"enable_sp":null}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(passConfigSpNull.errors.some((f) => f.id === "parse-invalid-json-type")).toBe(false);

    const passConfigNullItself = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B -tp 2 --compilation-config '{"pass_config":null}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(passConfigNullItself.errors.some((f) => f.id === "parse-invalid-json-type")).toBe(true);

    const rforkProfStringOff = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"scheduler_config":{"profiling_chunk_config":{"enabled":"off"}}}'`,
      { mode: "full", hardwareFamily: "A2", version: "rfork" },
    );
    expect(rforkProfStringOff.errors.some((f) => f.id === "d2-cpp-requires-pp-gt-1")).toBe(true);

    const v030SparseKvScalar = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"sparse_kv_offload_config":"off"}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(v030SparseKvScalar.errors.some((f) => f.id === "parse-invalid-json-type")).toBe(true);

    const v030ProfWrongEnableKey = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B -pp 2 --additional-config '{"scheduler_config":{"profiling_chunk_config":{"enable":true}}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(v030ProfWrongEnableKey.errors.some((f) => f.id === "parse-invalid-json-type")).toBe(true);
    expect(v030ProfWrongEnableKey.effectiveInput.profilingChunkEnabled).toBeUndefined();

    const v030TopLevelDyntra = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"dyntra_lb_config":{}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(v030TopLevelDyntra.errors.some((f) => f.id === "parse-invalid-json-type")).toBe(true);

    const envQuotedAssignWrapper = runSingleConfigDoctor(
      `env 'VLLM_USE_V2_MODEL_RUNNER=on' vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(envQuotedAssignWrapper.parsed.model).toBe("Qwen/Qwen3-8B");
    expect(envQuotedAssignWrapper.effectiveInput.tpSize).toBe(2);
    expect(
      envQuotedAssignWrapper.errors.some((f) => f.message.includes("VLLM_USE_V2_MODEL_RUNNER='on'")),
    ).toBe(true);

    const quotedFallbackInBrace = runSingleConfigDoctor(
      `VLLM_BATCH_INVARIANT=\${BATCH:-'1'} vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(quotedFallbackInBrace.errors.some((f) => f.id === "parse-invalid-number")).toBe(false);
    expect(quotedFallbackInBrace.effectiveInput.vllmBatchInvariant).toBe(true);

    const chainedInlinePrefix = runSingleConfigDoctor(
      `BATCH=0 VLLM_BATCH_INVARIANT=\${BATCH:-1} vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(chainedInlinePrefix.errors.some((f) => f.id === "parse-invalid-number")).toBe(false);
    expect(chainedInlinePrefix.effectiveInput.vllmBatchInvariant).toBe(false);

    const unexportedStandaloneVar = runSingleConfigDoctor(
      `VLLM_BATCH_INVARIANT=on\nvllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(unexportedStandaloneVar.errors.some((f) => f.id === "parse-invalid-number")).toBe(false);
    expect(unexportedStandaloneVar.effectiveInput.vllmBatchInvariant).toBeUndefined();

    const laterExportMarksPriorShellVar = runSingleConfigDoctor(
      `VLLM_BATCH_INVARIANT=on\nexport VLLM_BATCH_INVARIANT\nvllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(laterExportMarksPriorShellVar.errors.some((f) => f.id === "parse-invalid-number")).toBe(true);

    const setAllexportWindow = runSingleConfigDoctor(
      `set -a\nVLLM_BATCH_INVARIANT=on\nset +a\nvllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(setAllexportWindow.errors.some((f) => f.id === "parse-invalid-number")).toBe(true);

    const doubleQuotedFallbackInsideDoubleQuotes = runSingleConfigDoctor(
      `VLLM_BATCH_INVARIANT="\${BATCH:-"1"}" vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(doubleQuotedFallbackInsideDoubleQuotes.errors.some((f) => f.id === "parse-invalid-number")).toBe(
      false,
    );
    expect(doubleQuotedFallbackInsideDoubleQuotes.effectiveInput.vllmBatchInvariant).toBe(true);

    const multiVarExportOrder = runSingleConfigDoctor(
      `export BATCH=on VLLM_BATCH_INVARIANT=\${BATCH:-1}\nvllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(multiVarExportOrder.errors.some((f) => f.id === "parse-invalid-number")).toBe(false);
    expect(multiVarExportOrder.effectiveInput.vllmBatchInvariant).toBe(true);

    const assignDefaultSideEffectPersists = runSingleConfigDoctor(
      `A=0 X=\${BATCH:=on}\nVLLM_BATCH_INVARIANT=\${BATCH:-1} vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(assignDefaultSideEffectPersists.errors.some((f) => f.id === "parse-invalid-number")).toBe(true);

    const profArbitraryTypoSubkey = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B -pp 2 --additional-config '{"scheduler_config":{"profiling_chunk_config":{"enabld":true}}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(profArbitraryTypoSubkey.errors.some((f) => f.id === "parse-invalid-json-type")).toBe(true);

    const topLevelDyntraWithOmni = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"dyntra_lb_config":{}}'`,
      {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
        modelTraitOverride: { vllmOmniAvailable: true },
      },
    );
    expect(topLevelDyntraWithOmni.hasBlockers).toBe(false);
    expect(topLevelDyntraWithOmni.warnings.some((f) => f.id === "parse-invalid-json-type")).toBe(true);

    const rforkPrefillMc2Truthiness = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"enable_prefill_mc2":2}'`,
      { mode: "full", hardwareFamily: "A2", version: "rfork" },
    );
    expect(rforkPrefillMc2Truthiness.errors.some((f) => f.id === "parse-invalid-json-type")).toBe(false);
    expect(rforkPrefillMc2Truthiness.effectiveInput.enablePrefillMc2).toBe(true);

    const rforkPrefillMc2StringOff = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"enable_prefill_mc2":"off"}'`,
      { mode: "full", hardwareFamily: "A2", version: "rfork" },
    );
    expect(rforkPrefillMc2StringOff.errors.some((f) => f.id === "parse-invalid-json-type")).toBe(false);
    expect(rforkPrefillMc2StringOff.effectiveInput.enablePrefillMc2).toBe(true);

    const dynSpecTypoV030 = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"dynamic_spec_config":{"methd":"dspark"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(dynSpecTypoV030.hasBlockers).toBe(true);

    const kvTraceTypoMain = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"kv_trace":{"enabld":true}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(kvTraceTypoMain.hasBlockers).toBe(true);

    const sparseFusedOpV030 = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"sparse_kv_offload_config":{"enabled":false,"fused_op_type":"fused_copy_sfa"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(sparseFusedOpV030.hasBlockers).toBe(true);

    const omniTopLevelProfMain = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"profiling_chunk_config":{"enabled":false}}'`,
      {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
        modelTraitOverride: { vllmOmniAvailable: true },
      },
    );
    expect(omniTopLevelProfMain.hasBlockers).toBe(false);
    expect(omniTopLevelProfMain.warnings.some((f) => f.id === "parse-invalid-json-type")).toBe(true);

    const omniMainKeyInvalidValOnV030 = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"kv_pool_range_debug":"typo"}'`,
      {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelTraitOverride: { vllmOmniAvailable: true },
      },
    );
    expect(omniMainKeyInvalidValOnV030.hasBlockers).toBe(false);

    const fuseNormQuantBadBool = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"ascend_compilation_config":{"fuse_norm_quant":2}}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(fuseNormQuantBadBool.hasBlockers).toBe(true);

    const emptyVarThenSideEffect = runSingleConfigDoctor(
      `BATCH= X=\${BATCH:=on}\nVLLM_BATCH_INVARIANT=\${BATCH:-1} vllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(emptyVarThenSideEffect.errors.some((f) => f.id === "parse-invalid-number")).toBe(true);

    const cmdArgsExpandBeforePrefixSideEffects = runSingleConfigDoctor(
      `A=0 X=\${BATCH:=1} vllm serve Qwen/Qwen3-8B -tp \${BATCH:-2}`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(cmdArgsExpandBeforePrefixSideEffects.effectiveInput.tpSize).toBe(2);

    const firstAssignWordExpandedOnce = runSingleConfigDoctor(
      `VLLM_BATCH_INVARIANT=\${BATCH:+on}\${BATCH:=1} vllm serve Qwen/Qwen3-8B`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(firstAssignWordExpandedOnce.hasBlockers).toBe(false);
    expect(firstAssignWordExpandedOnce.effectiveInput.vllmBatchInvariant).toBe(true);

    const groupedSetEoAllexport = runSingleConfigDoctor(
      `set -eo allexport\nVLLM_BATCH_INVARIANT=on\nset +eo allexport\nvllm serve Qwen/Qwen3-8B -tp 2`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(groupedSetEoAllexport.errors.some((f) => f.id === "parse-invalid-number")).toBe(true);

    const seNullCap = runSingleConfigDoctor(
      `vllm serve /models/DeepSeek-V4 -tp 4 -dp 2 --shutdown-timeout 15 --enable-expert-parallel --additional-config '{"shared_engram":{"backend":"a2","endpoint":"10.0.0.1:29661","capacity":null}}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(seNullCap.errors.some((f) => f.id === "d5-shared-engram-constraints")).toBe(true);

    const seDecimalK = runSingleConfigDoctor(
      `vllm serve /models/DeepSeek-V4 -tp 4 -dp 2 --shutdown-timeout 15 --enable-expert-parallel --additional-config.shared_engram.backend a2 --additional-config.shared_engram.endpoint 10.0.0.1:29661 --additional-config.shared_engram.capacity 25.6k`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(seDecimalK.errors.some((f) => f.id === "d5-shared-engram-constraints")).toBe(false);
    expect(seDecimalK.effectiveInput.sharedEngramCapacity).toBe(25600);

    const seFractionalBinaryK = runSingleConfigDoctor(
      `vllm serve /models/DeepSeek-V4 -tp 4 -dp 2 --shutdown-timeout 15 --enable-expert-parallel --additional-config.shared_engram.backend a2 --additional-config.shared_engram.endpoint 10.0.0.1:29661 --additional-config.shared_engram.capacity 1.5K`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(seFractionalBinaryK.errors.some((f) => f.id === "d5-shared-engram-constraints")).toBe(true);

    const gdnUbatchOnly = runSingleConfigDoctor(
      `vllm serve /models/Qwen3-Next-80B-A3B -tp 4 --mamba-cache-mode align --no-enable-dbo --ubatch-size 2 --additional-config '{"gdn_internal_prefill_checkpoints":true}'`,
      { mode: "full", hardwareFamily: "A3", version: "main" },
    );
    const gdnUbatchWarn = gdnUbatchOnly.warnings.find(
      (f) => f.id === "d5-gdn-prefill-checkpoints-constraints",
    );
    expect(gdnUbatchWarn).toBeDefined();
    expect(gdnUbatchWarn?.message).toContain("--ubatch-size=2");
    expect(gdnUbatchWarn?.message).not.toContain("已开启 --enable-dbo");
  });

  it("enforces @model_validator enum/range constraints, factory-discarded key exemptions, Pydantic lax coercion, and POSIX IFS/special-builtin rules", () => {
    // 1. @model_validator enum & range constraints across AscendConfig and @config sub-configs
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"dynamic_spec_config":{"method":"dsparkk"}}'`,
        { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"eplb_config":{"load_collection_phase":"both"}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config '{"weight_nz_mode":3}'`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
      }).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"rejection_sampler_config":{"enable_block_verify":true}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"eplb_config":{"stair_config":{"load_window_bins":1}}}'`,
        { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
      ).hasBlockers,
    ).toBe(true);

    // 2. Factory-discarded _NON_USER_INPUT_KEYS & overridden legacy scheduler keys do not trigger false blockers
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"enable_balance_scheduling":"typo","scheduler_config":{"enable_balance_scheduling":false}}'`,
        { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config '{"pd_tp_ratio":"auto"}'`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config '{"kvpp_config":{"bad":1}}'`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
      }).hasBlockers,
    ).toBe(false);

    // 3. dump_config: null is accepted as None, while quantized_all_reduce_config: null fails on main
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config '{"dump_config":null}'`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
      }).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"quantized_all_reduce_config":null}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);

    // 4. Pydantic lax float/int coercion: hex string rejected, underscored decimal accepted, bool->int coerced
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"scheduler_config":{"short_request_first_config":{"long_max_wait_ms":"0x10"}}}'`,
        { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"scheduler_config":{"short_request_first_config":{"long_max_wait_ms":"1_000"}}}'`,
        { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
      ).hasBlockers,
    ).toBe(false);
    const boolWeightNz = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"weight_nz_mode":false}'`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(boolWeightNz.hasBlockers).toBe(false);
    expect(boolWeightNz.effectiveInput.weightNzMode).toBe(0);

    // 5. POSIX §2.6.5 IFS field splitting on unquoted expansions even with prefix assignments
    const ifsSplitWithPrefix = runSingleConfigDoctor(
      `TP_ARGS='-tp 4'\nA=0 vllm serve Qwen/Qwen3-8B $TP_ARGS`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(ifsSplitWithPrefix.effectiveInput.tpSize).toBe(4);

    // 6. Prefix side-effect ${VAR:=val} updates already-staged childEnv entries
    const prefixSideEffectOverwritesEmpty = runSingleConfigDoctor(
      `VLLM_BATCH_INVARIANT= X=\${VLLM_BATCH_INVARIANT:=1} vllm serve Qwen/Qwen3-8B`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(prefixSideEffectOverwritesEmpty.hasBlockers).toBe(false);
    expect(prefixSideEffectOverwritesEmpty.effectiveInput.vllmBatchInvariant).toBe(true);

    // 7. POSIX §2.14 `set` stops option scanning at first positional operand and runs even with prefix assignments
    const setPositionalOperandNotFlag = runSingleConfigDoctor(
      `set hello -eo allexport\nVLLM_BATCH_INVARIANT=on\nvllm serve Qwen/Qwen3-8B`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(setPositionalOperandNotFlag.hasBlockers).toBe(false);

    const setWithPrefixAssignment = runSingleConfigDoctor(
      `A=1 set -eo allexport\nVLLM_BATCH_INVARIANT=on\nvllm serve Qwen/Qwen3-8B`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(setWithPrefixAssignment.errors.some((f) => f.id === "parse-invalid-number")).toBe(true);
  });

  it("closes upstream version-specific validators, IFS/unset/quoted-fallback POSIX semantics, FlashComm1 OR precedence, and MLA/PD preconditions", () => {
    // 1. mega_moe_max_tokens=0 allowed on main (auto-compute), rejected on v0.30.0 & rfork
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config '{"mega_moe_max_tokens":0}'`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config '{"mega_moe_max_tokens":0}'`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
      }).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config '{"mega_moe_max_tokens":0}'`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "rfork",
      }).hasBlockers,
    ).toBe(true);

    // 2. STAIR rejects booleans via @field_validator("*", mode="before")
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"eplb_config":{"stair_config":{"rank_transfer_limit":true}}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);

    // 3. dynamic_eplb requires DYNAMIC_EPLB=true/1 or EXPERT_MAP_RECORD=true
    expect(
      runSingleConfigDoctor(
        `DYNAMIC_EPLB=0 EXPERT_MAP_RECORD=false vllm serve Qwen/Qwen3-8B --additional-config '{"eplb_config":{"dynamic_eplb":true}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `DYNAMIC_EPLB=1 vllm serve Qwen/Qwen3-8B --additional-config '{"eplb_config":{"dynamic_eplb":true}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);

    // 4. Lax integers propagate to effectiveInput & rules; arbitrary-precision int & +Infinity accepted
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-30B-A3B -dp 2 --additional-config '{"finegrained_tp_config":{"oproj_tensor_parallel_size":true}}'`,
        { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
      ).errors.some((f) => f.id === "d4-finegrained-tp-requires-recompute"),
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-30B-A3B -dp 10 --additional-config '{"finegrained_tp_config":{"oproj_tensor_parallel_size":"1_0"}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).errors.some((f) => f.id === "d4-finegrained-tp-requires-recompute"),
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"short_request_first_config":{"threshold":"9007199254740992"},"rejection_sampler_config":{"posterior_alpha":"Infinity"}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);

    // 5. quantized_all_reduce_config: null blocks in minimal mode too
    const minNullQar = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"quantized_all_reduce_config":null}'`,
      { mode: "minimal", hardwareFamily: "A2", version: "main" },
    );
    expect(minNullQar.hasBlockers).toBe(true);
    expect(minNullQar.parsed.parseDiagnostics.length).toBeGreaterThan(0);

    // 6. Custom IFS, quoted fallback inside ${CFG:-'...'}, unset -f vs unset TP
    expect(
      runSingleConfigDoctor(`IFS=,; TP_ARGS=-tp,4; A=0 vllm serve Qwen/Qwen3-8B $TP_ARGS`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
      }).effectiveInput.tpSize,
    ).toBe(4);
    const quotedFallback = runSingleConfigDoctor(
      `unset CFG; vllm serve Qwen/Qwen3-8B --additional-config \${CFG:-'{"weight_nz_mode": 2}'}`,
      { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(quotedFallback.hasBlockers).toBe(false);
    expect(quotedFallback.effectiveInput.weightNzMode).toBe(2);
    expect(
      runSingleConfigDoctor(
        `export VLLM_BATCH_INVARIANT=on; unset -f VLLM_BATCH_INVARIANT; vllm serve Qwen/Qwen3-8B`,
        { mode: "full", hardwareFamily: "A2", version: "v0.30.0" },
      ).errors.some((f) => f.id === "parse-invalid-number"),
    ).toBe(true);
    const unsetTpConcat = runSingleConfigDoctor(`unset TP; vllm serve Qwen/Qwen3-8B -tp \${TP}4`, {
      mode: "full",
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(unsetTpConcat.hasBlockers).toBe(false);
    expect(unsetTpConcat.effectiveInput.tpSize).toBe(4);

    // 7. rfork specific behaviors, FlashComm1 OR precedence, nested hot-reload, untrimmed shared_engram, and --max-model-len 1k/1.5k
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"profiling_chunk_config":{"smooth_factor":0}}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"rl_config":null,"short_request_first_config":false}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"rejection_sampler_config":{"enable_entropy_verify":1}}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `VLLM_ASCEND_ENABLE_FLASHCOMM1=1 vllm serve Qwen/Qwen3-30B-A3B -tp 2 --enable-expert-parallel --additional-config '{"enable_flashcomm1":false}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).effectiveInput.enableFlashcomm1,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"finegrained_tp_config":{"qkv_iproj_tensor_parallel_size":2}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"enable_mlapo":false,"mlapo_keep_prefill_weights":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config '{"enable_kv_nz":true}'`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"dump_config":{"runtime_config_hot_reload":1.5},"runtime_config_hot_reload":false}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(
        `vllm serve /models/DeepSeek-V4 -tp 4 -dp 2 --shutdown-timeout 15 --enable-expert-parallel --additional-config '{"shared_engram":{"backend":" a2 ","endpoint":"host:1234"}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve /models/DeepSeek-V4 -tp 4 -dp 2 --shutdown-timeout 15 --enable-expert-parallel --additional-config '{"shared_engram":{"backend":"a2","endpoint":"host:1234 "}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    const len1k = runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --max-model-len 1k`, {
      mode: "full",
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(len1k.hasBlockers).toBe(false);
    expect(len1k.effectiveInput.maxModelLen).toBe(1000);
    const len15k = runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --max-model-len 1.5k`, {
      mode: "full",
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(len15k.hasBlockers).toBe(false);
    expect(len15k.effectiveInput.maxModelLen).toBe(1500);
  });

  it("enforces POSIX IFS mixed delimiters, unset prefix scope, plain-int max-num-seqs, rfork int()/float() & BigInt ranges, and model-specific MLA/MoE preconditions", () => {
    // 1. POSIX §2.6.5 adjacent IFS whitespace + non-whitespace delimiter ('-tp ,4' -> ['-tp', '4'])
    const ifsMixed = runSingleConfigDoctor(`IFS=' ,'; X='-tp ,4'; vllm serve Qwen/Qwen3-8B $X`, {
      mode: "full",
      hardwareFamily: "A2",
      version: "main",
    });
    expect(ifsMixed.hasBlockers).toBe(false);
    expect(ifsMixed.effectiveInput.tpSize).toBe(4);
    expect(
      runSingleConfigDoctor(`IFS=' ,'; X=',4'; vllm serve Qwen/Qwen3-8B -tp $X`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).hasBlockers,
    ).toBe(true);

    // 2. Prefix assignment on non-special command does NOT clear unsetNames in parent shell
    const unsetPrefix = runSingleConfigDoctor(
      `TP=2; unset TP; TP=8 true; vllm serve Qwen/Qwen3-8B -tp \${TP-4}`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(unsetPrefix.hasBlockers).toBe(false);
    expect(unsetPrefix.effectiveInput.tpSize).toBe(4);

    // 3. --max-num-seqs is plain int (1.5k rejected)
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --max-num-seqs 1.5k`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
      }).hasBlockers,
    ).toBe(true);

    // 4. enable_kv_nz: kv_both + connector passes; kv_consumer without connector fails
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V3 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_both"}' --additional-config '{"enable_kv_nz":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V3 --kv-transfer-config '{"kv_role":"kv_consumer"}' --additional-config '{"enable_kv_nz":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);

    // 5. qkv_iproj_tensor_parallel_size: rejects Qwen3-30B-A3B and GLM-5.3-Flash non-divisor 3, accepts divisor 2
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-30B-A3B -dp 2 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"scheduler_config":{"recompute_scheduler_enable":true},"finegrained_tp_config":{"qkv_iproj_tensor_parallel_size":2}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve zai-org/GLM-5.3-Flash -dp 3 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"scheduler_config":{"recompute_scheduler_enable":true},"finegrained_tp_config":{"qkv_iproj_tensor_parallel_size":3}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve zai-org/GLM-5.3-Flash -dp 2 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"scheduler_config":{"recompute_scheduler_enable":true},"finegrained_tp_config":{"qkv_iproj_tensor_parallel_size":2}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);

    // 6. enable_force_eplb + dynamic_eplb: ignored on dense Llama-3.1-8B, rejected on MoE
    expect(
      runSingleConfigDoctor(
        `DYNAMIC_EPLB=1 vllm serve meta-llama/Llama-3.1-8B --additional-config '{"enable_force_eplb":true,"eplb_config":{"dynamic_eplb":true}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(
        `DYNAMIC_EPLB=1 vllm serve Qwen/Qwen3-30B-A3B --additional-config '{"enable_force_eplb":true,"eplb_config":{"dynamic_eplb":true}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);

    // 7. mix_placement evaluates effective resolved shared_expert_dp and multistream_overlap_shared_expert
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-30B-A3B -tp 1 --additional-config '{"mix_placement":true,"enable_shared_expert_dp":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-30B-A3B -tp 2 --enable-expert-parallel --additional-config '{"mix_placement":true,"enable_shared_expert_dp":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);

    // 8. mc2_comm_alg fullmesh_v2 rejected on A5; hierarchy rejected when numExperts + num_redundant_experts > 512
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-30B-A3B -tp 4 --enable-expert-parallel --additional-config '{"mc2_comm_alg":"fullmesh_v2"}'`,
        { mode: "full", hardwareFamily: "A5", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `DYNAMIC_EPLB=1 vllm serve deepseek-ai/DeepSeek-V3 -tp 4 --enable-expert-parallel --additional-config '{"mc2_comm_alg":"hierarchy","eplb_config":{"dynamic_eplb":true,"num_redundant_experts":300}}'`,
        { mode: "full", hardwareFamily: "A3", version: "main" },
      ).hasBlockers,
    ).toBe(true);

    // 9. DeepSeek-V3.2 inferred as DSA sparse MLA (indexTopk=2048): rejects enable_kv_nz and topk_buffer_size < 2048
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V3.2 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"enable_kv_nz":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V3.2 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"sparse_kv_offload_config":{"enabled":true,"topk_buffer_size":1024}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);

    // 10 & 11. rfork fidelity: hierarchy override, bool policy_type, ignored dyntra_lb_config, 1.0 mega_moe, int()/float() coercion
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"enable_mc2_hierarchy_comm":true,"mc2_comm_alg":"unused","eplb_config":{"eplb_policy_type":true},"scheduler_config":{"dyntra_lb_config":{"start_step":-1}}}'`,
        { mode: "full", hardwareFamily: "A3", version: "rfork" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config '{"mega_moe_max_tokens":1.0}'`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "rfork",
      }).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"profiling_chunk_config":{"min_chunk":0.5}}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"profiling_chunk_config":{"min_chunk":"1.0"}}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork" },
      ).hasBlockers,
    ).toBe(true);
    const rforkUnderscoreChunk = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B -pp 2 --max-num-batched-tokens 8192 --additional-config '{"profiling_chunk_config":{"enabled":true,"min_chunk":"4_096"}}'`,
      { mode: "full", hardwareFamily: "A2", version: "rfork" },
    );
    expect(rforkUnderscoreChunk.hasBlockers).toBe(false);
    expect(rforkUnderscoreChunk.effectiveInput.profilingMinChunk).toBe(4096);

    // 12. Unquoted raw JSON > 2^53 precision, --max-num-seqs 1_024, FlexibleArgumentParser dotted replacement, DeepSeek/GLM/Llama-4/rfork sparse & fused_mc2 checks
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"scheduler_config":{"dyntra_lb_config":{"start_step":9007199254740992,"end_step":9007199254740993}}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config '{"scheduler_config":{"dyntra_lb_config":{"start_step":9007199254740993,"end_step":9007199254740992}}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    const maxSeqsUnderscore = runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --max-num-seqs 1_024`, {
      mode: "full",
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(maxSeqsUnderscore.hasBlockers).toBe(false);
    expect(maxSeqsUnderscore.effectiveInput.maxNumSeqs).toBe(1024);

    // Dotted --additional-config.<path> replaces earlier regular --additional-config JSON per vllm FlexibleArgumentParser
    const dottedReplacesJson = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"enable_kv_nz":true}' --additional-config.weight_nz_mode 1`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(dottedReplacesJson.hasBlockers).toBe(false);
    expect(dottedReplacesJson.effectiveInput.enableKvNz).toBeUndefined();
    expect(dottedReplacesJson.effectiveInput.weightNzMode).toBe(1);

    // DeepSeek-V4-Flash (compress_ratios -> usesSfaSparse=false) allows enable_kv_nz; GLM-5 (index_topk=2048) rejects enable_kv_nz
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V4-Flash --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"enable_kv_nz":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(
        `vllm serve zai-org/GLM-5 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"enable_kv_nz":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);

    // Llama-4-Scout-17B-16E MoE rejects enable_force_eplb + dynamic_eplb; GLM-5.3-Flash (288 experts) + 256 redundant > 512 rejects hierarchy
    expect(
      runSingleConfigDoctor(
        `DYNAMIC_EPLB=1 vllm serve meta-llama/Llama-4-Scout-17B-16E --additional-config '{"enable_force_eplb":true,"eplb_config":{"dynamic_eplb":true}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `DYNAMIC_EPLB=1 vllm serve zai-org/GLM-5.3-Flash -tp 4 --enable-expert-parallel --additional-config '{"mc2_comm_alg":"hierarchy","eplb_config":{"dynamic_eplb":true,"num_redundant_experts":256}}'`,
        { mode: "full", hardwareFamily: "A3", version: "main" },
      ).hasBlockers,
    ).toBe(true);

    // Sparse offload: rfork rejects dram_size_per_dp_GB='1.0' and topk_buffer_size=1024; main accepts topk_buffer_size=-1 and kv_both
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V3.2 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"sparse_kv_offload_config":{"enabled":true,"dram_size_per_dp_GB":"1.0"}}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V3.2 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"sparse_kv_offload_config":{"enabled":true,"topk_buffer_size":1024}}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V3.2 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_both"}' --additional-config '{"sparse_kv_offload_config":{"enabled":true,"topk_buffer_size":-1}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);

    // rfork VLLM_ASCEND_ENABLE_FUSED_MC2=1 clears multistream_overlap_shared_expert, classifies env as deprecated-fallback, and rejects null/2/'1'/MiniMax-M3
    const rfFusedMix = runSingleConfigDoctor(
      `VLLM_ASCEND_ENABLE_FUSED_MC2=1 vllm serve Qwen/Qwen3-30B-A3B -tp 2 --enable-expert-parallel --additional-config '{"mix_placement":true,"multistream_overlap_shared_expert":true}'`,
      { mode: "full", hardwareFamily: "A2", version: "rfork" },
    );
    expect(rfFusedMix.hasBlockers).toBe(false);
    expect(rfFusedMix.effectiveInput.multistreamOverlapSharedExpert).toBe(false);
    expect(
      rfFusedMix.envClassifications.find((e) => e.name === "VLLM_ASCEND_ENABLE_FUSED_MC2")?.judgment,
    ).toBe("deprecated-fallback");

    for (const badOverride of ["null", "2", '"1"']) {
      expect(
        runSingleConfigDoctor(
          `VLLM_ASCEND_ENABLE_FUSED_MC2=1 vllm serve Qwen/Qwen3-30B-A3B -tp 2 --enable-expert-parallel --additional-config '{"enable_fused_mc2":${badOverride}}'`,
          { mode: "full", hardwareFamily: "A2", version: "rfork" },
        ).hasBlockers,
      ).toBe(true);
    }
    expect(
      runSingleConfigDoctor(`VLLM_ASCEND_ENABLE_FUSED_MC2=1 vllm serve MiniMax/MiniMax-M3 -tp 2`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "rfork",
      }).hasBlockers,
    ).toBe(true);

    // Underscore in suffixed int rejected (1_0k), empty dotted segment rejected, DeepSeek-V4-Pro compress_ratios, GLM-5.3-Flash rfork kv_nz, rfork SFA C8 + offload, omitted topk_buffer_size default
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --max-model-len 1_0k`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "v0.30.0",
      }).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve Qwen/Qwen3-8B --additional-config.scheduler_config..enable_balance_scheduling true`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V4-Pro --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"enable_kv_nz":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V4-Pro --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"sparse_kv_offload_config":{"enabled":true}}'`,
        { mode: "full", hardwareFamily: "A2", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve zai-org/GLM-5.3-Flash --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"enable_kv_nz":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V3.2 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"sparse_kv_offload_config":{"enabled":true},"enable_sparse_sfa_c8":true}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `vllm serve deepseek-ai/DeepSeek-V3.2 --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}' --additional-config '{"sparse_kv_offload_config":{"enabled":true}}'`,
        { mode: "full", hardwareFamily: "A2", version: "rfork", modelTraitOverride: { indexTopk: 8192 } },
      ).hasBlockers,
    ).toBe(true);

    // enable_fused_mc2=2/3 clears overlap before mix_placement; MiniMax-M3 rejects mode 1 on v0.30.0/main; V4-Pro 384 experts; --additional-config. 1 & 0_1; & subshell & /models/A\ #B
    const mainFused2Mix = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-30B-A3B -tp 2 --enable-expert-parallel --additional-config '{"enable_fused_mc2":2,"mix_placement":true,"multistream_overlap_shared_expert":true}'`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(mainFused2Mix.hasBlockers).toBe(false);
    expect(mainFused2Mix.effectiveInput.multistreamOverlapSharedExpert).toBe(false);
    expect(
      runSingleConfigDoctor(`vllm serve MiniMax/MiniMax-M3 --additional-config.enable_fused_mc2 1`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(
        `DYNAMIC_EPLB=1 vllm serve deepseek-ai/DeepSeek-V4-Pro -tp 4 --enable-expert-parallel --additional-config '{"mc2_comm_alg":"hierarchy","eplb_config":{"dynamic_eplb":true,"num_redundant_experts":256}}'`,
        { mode: "full", hardwareFamily: "A3", version: "main" },
      ).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config. 1`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).hasBlockers,
    ).toBe(true);
    expect(
      runSingleConfigDoctor(`vllm serve Qwen/Qwen3-8B --additional-config.enable_fused_mc2 0_1`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "rfork",
      }).hasBlockers,
    ).toBe(false);
    expect(
      runSingleConfigDoctor(`export TP=2; export TP=4 & vllm serve Qwen/Qwen3-8B -tp $TP`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).effectiveInput.tpSize,
    ).toBe(2);
    const escapedHash = runSingleConfigDoctor(`vllm serve /models/A\\ #B --enforce-eager`, {
      mode: "full",
      hardwareFamily: "A2",
      version: "main",
    });
    expect(escapedHash.parsed.model).toBe("/models/A #B");
    expect(escapedHash.parsed.enforceEager).toBe(true);

    // Consecutive comment lines ending in backslash must not swallow following command
    const multiComments = runSingleConfigDoctor(`# a \\\n# b \\\nvllm serve /m --enforce-eager`, {
      mode: "full",
      hardwareFamily: "A2",
      version: "main",
    });
    expect(multiComments.parsed.model).toBe("/m");

    // Unknown command before || must not short-circuit vllm serve
    const unknownOrServe = runSingleConfigDoctor(`test -z x || vllm serve /m --enforce-eager`, {
      mode: "full",
      hardwareFamily: "A2",
      version: "main",
    });
    expect(unknownOrServe.parsed.model).toBe("/m");
    expect(unknownOrServe.parsed.matchedStatementIndex).toBe(1);

    // Whole background AND-OR list (`TP=4 && true &`) must stay isolated in subshell
    const bgAndOr = runSingleConfigDoctor(`TP=2; TP=4 && true & vllm serve /m -tp "$TP"`, {
      mode: "full",
      hardwareFamily: "A2",
      version: "main",
    });
    expect(bgAndOr.effectiveInput.tpSize).toBe(2);

    // Parent directory name containing `-pro` must not misclassify DeepSeek-V4-Flash as 384-expert Pro
    const flashUnderProDir = runSingleConfigDoctor(
      `DYNAMIC_EPLB=1 vllm serve /models/npu-pro/DeepSeek-V4-Flash -tp 4 --enable-expert-parallel --additional-config '{"mc2_comm_alg":"hierarchy","eplb_config":{"dynamic_eplb":true,"num_redundant_experts":256}}'`,
      { mode: "full", hardwareFamily: "A3", version: "main" },
    );
    expect(flashUnderProDir.effectiveInput.numExperts).toBe(256);
    expect(flashUnderProDir.hasBlockers).toBe(false);

    // HF snapshot hash path still detects DeepSeek-V4-Pro (384 experts) from ancestor repo segment
    const proSnapshotPath = runSingleConfigDoctor(
      `vllm serve /cache/models--deepseek-ai--DeepSeek-V4-Pro/snapshots/0123456789abcdef`,
      { mode: "full", hardwareFamily: "A3", version: "main" },
    );
    expect(proSnapshotPath.effectiveInput.numExperts).toBe(384);

    // Static test -n / -z evaluation skips unreachable || export branch, but preserves unset $X & malformed `[`
    const testNonEmptyOrExport = runSingleConfigDoctor(
      `MODEL=/m; test -n "$MODEL" || export VLLM_ASCEND_ENABLE_NZ=2; vllm serve "$MODEL"`,
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(testNonEmptyOrExport.parsed.envVars.VLLM_ASCEND_ENABLE_NZ).toBeUndefined();
    expect(
      runSingleConfigDoctor(`test -n "$UNSET_IN_SCRIPT" || export VLLM_ASCEND_ENABLE_NZ=2; vllm serve /m`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).parsed.envVars.VLLM_ASCEND_ENABLE_NZ,
    ).toBe("2");
    expect(
      runSingleConfigDoctor(`[ -n x || export VLLM_ASCEND_ENABLE_NZ=2; vllm serve /m`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).parsed.envVars.VLLM_ASCEND_ENABLE_NZ,
    ).toBe("2");
    expect(
      runSingleConfigDoctor(`test -n '$X' || export VLLM_ASCEND_ENABLE_NZ=2; vllm serve /m`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).parsed.envVars.VLLM_ASCEND_ENABLE_NZ,
    ).toBeUndefined();
    expect(
      runSingleConfigDoctor(`test -n "\${X:-fallback}" || export VLLM_ASCEND_ENABLE_NZ=2; vllm serve /m`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).parsed.envVars.VLLM_ASCEND_ENABLE_NZ,
    ).toBeUndefined();
    expect(
      runSingleConfigDoctor(`X=ok; test -n "\${X:-$Y}" || export VLLM_ASCEND_ENABLE_NZ=2; vllm serve /m`, {
        mode: "full",
        hardwareFamily: "A2",
        version: "main",
      }).parsed.envVars.VLLM_ASCEND_ENABLE_NZ,
    ).toBeUndefined();
    expect(
      runSingleConfigDoctor(`vllm serve /models/DeepSeek-V4-Flash/DeepSeek-V4-Pro`, {
        mode: "full",
        hardwareFamily: "A3",
        version: "main",
      }).effectiveInput.numExperts,
    ).toBe(384);
  });

  it("Wave 2 Polish: flags --enable-sleep-mode without weight_nz_mode=0 and VLLM_LOGGING_LEVEL=DEBUG latency penalty", () => {
    const badSleepAndDebug = runSingleConfigDoctor(
      "VLLM_LOGGING_LEVEL=DEBUG vllm serve Qwen/Qwen3-8B --enable-sleep-mode",
      { mode: "minimal", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(badSleepAndDebug.errors.some((f) => f.id === "d5-sleep-mode-requires-nz-disabled")).toBe(true);
    expect(badSleepAndDebug.warnings.some((f) => f.id === "env-debug-logging-latency")).toBe(true);

    const okSleepExplicitNz0 = runSingleConfigDoctor(
      `VLLM_LOGGING_LEVEL=INFO vllm serve Qwen/Qwen3-8B --enable-sleep-mode --additional-config '{"weight_nz_mode":0}'`,
      { mode: "minimal", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(okSleepExplicitNz0.errors.some((f) => f.id === "d5-sleep-mode-requires-nz-disabled")).toBe(false);
    expect(okSleepExplicitNz0.warnings.some((f) => f.id === "env-debug-logging-latency")).toBe(false);

    const okSleepViaRl = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-8B --enable-sleep-mode --additional-config '{"rl_config":{"enabled":true}}'`,
      { mode: "full", hardwareFamily: "A3", version: "v0.30.0" },
    );
    expect(okSleepViaRl.errors.some((f) => f.id === "d5-sleep-mode-requires-nz-disabled")).toBe(false);

    // VLLM_BATCH_INVARIANT=1 forces weight_nz_mode=0 upstream (batch_invariant.py#L102-L109)
    const okSleepBatchInvariant = runSingleConfigDoctor(
      "VLLM_BATCH_INVARIANT=1 vllm serve Qwen/Qwen3-8B --enable-sleep-mode",
      { mode: "minimal", hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(okSleepBatchInvariant.errors.some((f) => f.id === "d5-sleep-mode-requires-nz-disabled")).toBe(
      false,
    );

    // Ascend 310P with explicit weight_nz_mode=0 emits a layout policy warn (not a false wake_up ValueError)
    const warn310pSleep = runSingleConfigDoctor(
      `vllm serve Qwen/Qwen3-0.6B --enable-sleep-mode --additional-config '{"weight_nz_mode":0}'`,
      { mode: "minimal", hardwareFamily: "310P", version: "v0.30.0" },
    );
    expect(warn310pSleep.errors.some((f) => f.id === "d5-sleep-mode-requires-nz-disabled")).toBe(false);
    expect(warn310pSleep.warnings.some((f) => f.id === "d5-sleep-mode-requires-nz-disabled")).toBe(true);

    // DEBUG + --enforce-eager omits ACLGraph data_ptr() replay claim
    const debugEager = runSingleConfigDoctor(
      "VLLM_LOGGING_LEVEL=DEBUG vllm serve Qwen/Qwen3-8B --enforce-eager",
      { mode: "minimal", hardwareFamily: "A2", version: "v0.30.0" },
    );
    const debugFinding = debugEager.warnings.find((f) => f.id === "env-debug-logging-latency");
    expect(debugFinding?.message).toContain("当前已关闭图回放");
    expect(debugFinding?.message).not.toContain("data_ptr()");
  });
});
