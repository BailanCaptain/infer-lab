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
    expect(parsed.couplingInput.maxModelLen).toBe(32768);
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
});
