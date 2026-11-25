import { describe, expect, it } from "vitest";
import { classifyEnvVar, evaluateCouplingRules } from "./index";

describe("Promoted Parameter Validation Rules (v0.30.0 vs main)", () => {
  it("blocks main-only additional_config keys on v0.30.0 while allowing them on main", () => {
    const input = {
      mainOnlyAdditionalConfigKeys: [
        "shared_engram",
        "quantized_all_reduce_config",
        "runtime_config",
        "runtime_config_hot_reload",
        "runtime_config_path",
        "gdn_internal_prefill_checkpoints",
        "kv_pool_range_debug",
        "megamoe_shared_expert_fusion",
      ],
    };

    const v030 = evaluateCouplingRules(input, "v0.30.0");
    const err = v030.errors.find((m) => m.ruleId === "d5-main-only-additional-config-keys");
    expect(err).toBeDefined();
    expect(err?.message).toContain("shared_engram");
    expect(err?.message).toContain("kv_pool_range_debug");
    expect(err?.remediation).toContain("VLLM_ASCEND_KVPOOL_RANGE_DEBUG=1");

    const main = evaluateCouplingRules(input, "main");
    expect(main.errors.some((m) => m.ruleId === "d5-main-only-additional-config-keys")).toBe(false);

    const v030Omni = evaluateCouplingRules({ ...input, vllmOmniAvailable: true }, "v0.30.0");
    expect(v030Omni.errors.some((m) => m.ruleId === "d5-main-only-additional-config-keys")).toBe(false);
    expect(v030Omni.silentRewrites.some((m) => m.ruleId === "d5-main-only-additional-config-keys")).toBe(
      true,
    );

    const rfork = evaluateCouplingRules(input, "rfork");
    expect(rfork.errors.some((m) => m.ruleId === "d5-main-only-additional-config-keys")).toBe(false);
    expect(rfork.silentRewrites.some((m) => m.ruleId === "d5-main-only-additional-config-keys")).toBe(true);
  });

  it("validates quantized_all_reduce_config on main: A2-only, tp_size <= 8, min_numel >= 1, and FlashComm1/SP silent disable", () => {
    const badTpAndDevice = evaluateCouplingRules(
      {
        hardwareFamily: "A3",
        tpSize: 16,
        quantizedAllReduceEnabled: true,
        quantizedAllReduceMinNumel: 0,
      },
      "main",
    );
    const err = badTpAndDevice.errors.find((m) => m.ruleId === "d1-quantized-ar-constraints");
    expect(err).toBeDefined();
    expect(err?.message).toContain("min_numel");
    expect(err?.message).toContain("TP=16");
    expect(err?.message).toContain("A3");

    // When FlashComm1 + MoE SP silently disables quantized_all_reduce_config.enable=False, neither TP>8 nor non-A2 raises error
    const spSilentlyDisables = evaluateCouplingRules(
      {
        hardwareFamily: "A3",
        tpSize: 16,
        isMoe: true,
        enableExpertParallel: true,
        enableFlashcomm1: true,
        quantizedAllReduceEnabled: true,
      },
      "main",
    );
    expect(spSilentlyDisables.errors.some((m) => m.ruleId === "d1-quantized-ar-constraints")).toBe(false);
    expect(
      spSilentlyDisables.silentRewrites.some((m) => m.ruleId === "d1-flashcomm1-disables-quantized-ar"),
    ).toBe(true);

    const validA2 = evaluateCouplingRules(
      {
        hardwareFamily: "A2",
        tpSize: 8,
        quantizedAllReduceEnabled: true,
        quantizedAllReduceMinNumel: 16777216,
      },
      "main",
    );
    expect(validA2.errors.some((m) => m.ruleId === "d1-quantized-ar-constraints")).toBe(false);
  });

  it("validates MegaMoE shared-expert fusion (enable_fused_mc2=3) across hardware, cann_ops_transformer, mc2=2 overwrite, Latent-MoE, and TP>1 SEDP", () => {
    const nonA5 = evaluateCouplingRules(
      { hardwareFamily: "A3", isMoe: true, tpSize: 8, enableFusedMc2: 3 },
      "main",
    );
    expect(nonA5.errors.some((m) => m.ruleId === "d1-megamoe-shared-expert-fusion-constraints")).toBe(true);

    // Even with cannOpsTransformerAvailable=false, enable_fused_mc2=3 sets megamoe_shared_expert_fusion=True BEFORE package check and still raises NotImplementedError on non-A5!
    const nonA5NoCann = evaluateCouplingRules(
      {
        hardwareFamily: "A3",
        isMoe: true,
        tpSize: 8,
        enableFusedMc2: 3,
        cannOpsTransformerAvailable: false,
      },
      "main",
    );
    expect(nonA5NoCann.errors.some((m) => m.ruleId === "d1-megamoe-shared-expert-fusion-constraints")).toBe(
      true,
    );

    // enable_fused_mc2=2 overwrites hand-written megamoe_shared_expert_fusion=true back to False (silent-rewrite, NOT error even on A3)
    const mc2Eq2Overwrite = evaluateCouplingRules(
      {
        hardwareFamily: "A3",
        isMoe: true,
        tpSize: 8,
        enableFusedMc2: 2,
        megamoeSharedExpertFusion: true,
      },
      "main",
    );
    expect(
      mc2Eq2Overwrite.errors.some((m) => m.ruleId === "d1-megamoe-shared-expert-fusion-constraints"),
    ).toBe(false);
    expect(
      mc2Eq2Overwrite.silentRewrites.some((m) => m.ruleId === "d1-megamoe-shared-expert-fusion-constraints"),
    ).toBe(true);

    const latentMoe = evaluateCouplingRules(
      {
        hardwareFamily: "A5",
        isMoe: true,
        hasRoutedExpertHiddenSize: true,
        tpSize: 8,
        enableFusedMc2: 3,
      },
      "main",
    );
    expect(latentMoe.errors.some((m) => m.ruleId === "d1-megamoe-shared-expert-fusion-constraints")).toBe(
      true,
    );

    const missingSedp = evaluateCouplingRules(
      { hardwareFamily: "A5", isMoe: true, tpSize: 8, enableFusedMc2: 3 },
      "main",
    );
    expect(missingSedp.warnings.some((m) => m.ruleId === "d1-megamoe-shared-expert-fusion-constraints")).toBe(
      true,
    );

    const healthyA5 = evaluateCouplingRules(
      {
        hardwareFamily: "A5",
        isMoe: true,
        tpSize: 8,
        enableFusedMc2: 3,
        enableSharedExpertDp: true,
      },
      "main",
    );
    expect(healthyA5.matches.some((m) => m.ruleId === "d1-megamoe-shared-expert-fusion-constraints")).toBe(
      false,
    );
  });

  it("validates shared_engram sub-keys and A3 vs A2/A5 backend preconditions on main", () => {
    const badA3 = evaluateCouplingRules(
      {
        sharedEngramConfigured: true,
        sharedEngramBackend: "a3",
        sharedEngramEndpoint: "10.0.0.8:29500",
        sharedEngramCapacity: 131072,
        useV2ModelRunner: false,
      },
      "main",
    );
    const errA3 = badA3.errors.find((m) => m.ruleId === "d5-shared-engram-constraints");
    expect(errA3).toBeDefined();
    expect(errA3?.message).toContain("A2/A5 专属子键");
    expect(errA3?.message).toContain("Model Runner V2");

    const badA5 = evaluateCouplingRules(
      {
        sharedEngramConfigured: true,
        sharedEngramBackend: "a5",
        sharedEngramEndpoint: "invalid-endpoint",
        sharedEngramListenPort: 29600,
        sharedEngramLocalCommRes: "hixl://local",
        shutdownTimeout: 0,
      },
      "main",
    );
    const errA5 = badA5.errors.find((m) => m.ruleId === "d5-shared-engram-constraints");
    expect(errA5).toBeDefined();
    expect(errA5?.message).toContain("host:port");
    expect(errA5?.message).toContain("互斥");
    expect(errA5?.message).toContain("--shutdown-timeout > 0");

    const goodA5 = evaluateCouplingRules(
      {
        sharedEngramConfigured: true,
        sharedEngramBackend: "a5",
        sharedEngramEndpoint: "10.0.0.8:29500",
        sharedEngramCapacity: 65536,
        tpSize: 4,
        dpSize: 2,
        shutdownTimeout: 120,
      },
      "main",
    );
    expect(goodA5.errors.some((m) => m.ruleId === "d5-shared-engram-constraints")).toBe(false);

    const badParallelism = evaluateCouplingRules(
      {
        sharedEngramConfigured: true,
        sharedEngramBackend: "a3",
        sharedEngramEndpoint: "10.0.0.8:29500",
        tpSize: 4,
        ppSize: 2,
      },
      "main",
    );
    expect(badParallelism.errors.some((m) => m.ruleId === "d5-shared-engram-constraints")).toBe(true);
  });

  it("warns on multistream_engram_overlap only for PIECEWISE / FULL_AND_PIECEWISE (allowing FULL_DECODE_ONLY) and checks GDN --enable-dbo", () => {
    const piecewiseOverlap = evaluateCouplingRules(
      { multistreamEngramOverlap: true, cudagraphMode: "PIECEWISE" },
      "v0.30.0",
    );
    expect(
      piecewiseOverlap.warnings.some((m) => m.ruleId === "d5-multistream-engram-overlap-cudagraph-gate"),
    ).toBe(true);

    const fullDecodeOnlyOverlap = evaluateCouplingRules(
      { multistreamEngramOverlap: true, cudagraphMode: "FULL_DECODE_ONLY" },
      "v0.30.0",
    );
    expect(
      fullDecodeOnlyOverlap.warnings.some((m) => m.ruleId === "d5-multistream-engram-overlap-cudagraph-gate"),
    ).toBe(false);

    const fullOverlap = evaluateCouplingRules(
      { multistreamEngramOverlap: true, cudagraphMode: "FULL" },
      "v0.30.0",
    );
    expect(
      fullOverlap.warnings.some((m) => m.ruleId === "d5-multistream-engram-overlap-cudagraph-gate"),
    ).toBe(false);

    const gdnWithPdAndDbo = evaluateCouplingRules(
      {
        gdnInternalPrefillCheckpoints: true,
        mambaCacheMode: "align",
        useUbatching: true,
        kvConnector: "MooncakeConnectorV1",
      },
      "main",
    );
    const gdnWarn = gdnWithPdAndDbo.warnings.find(
      (m) => m.ruleId === "d5-gdn-prefill-checkpoints-constraints",
    );
    expect(gdnWarn).toBeDefined();
    expect(gdnWarn?.message).toContain("--enable-dbo");
  });

  it("validates Runtime Guard startup fields and VLLM_ASCEND_KVPOOL_RANGE_DEBUG version transition", () => {
    const badRuntime = evaluateCouplingRules(
      {
        runtimeConfigHotReloadInvalidValue: 5,
        runtimeConfigInvalidType: "list",
      },
      "main",
    );
    expect(badRuntime.errors.some((m) => m.ruleId === "d5-runtime-config-constraints")).toBe(true);

    const manualWithoutHotReload = evaluateCouplingRules(
      {
        runtimeConfigConfigured: true,
        runtimeConfigManualDumpSet: true,
        runtimeConfigHotReload: false,
      },
      "main",
    );
    expect(manualWithoutHotReload.warnings.some((m) => m.ruleId === "d5-runtime-config-constraints")).toBe(
      true,
    );

    expect(classifyEnvVar("VLLM_ASCEND_KVPOOL_RANGE_DEBUG", "v0.30.0").judgment).toBe("known-read");
    const retiredMain = classifyEnvVar("VLLM_ASCEND_KVPOOL_RANGE_DEBUG", "main");
    expect(retiredMain.judgment).toBe("retired");
    expect(retiredMain.replacement).toContain("kv_pool_range_debug");
  });

  it("enforces prototype-safe dotted CLI parsing, human_readable_int suffixes, scientific floats, and strict subkey schemas", async () => {
    const { setDottedRecordValue } = await import("../doctor/cliParser");
    const { runSingleConfigDoctor } = await import("../doctor/configDoctor");

    // 1. Prototype-pollution & inherited-object write guard
    const inheritedProto = Object.freeze({ options: Object.freeze({ existing: 1 }) });
    const recordWithProto = Object.create(inheritedProto) as Record<string, unknown>;
    expect(() => setDottedRecordValue(recordWithProto, ["options", "mode"], "fast")).not.toThrow();
    expect(Object.hasOwn(recordWithProto, "options")).toBe(true);
    expect(setDottedRecordValue(recordWithProto, ["__proto__", "polluted"], true)).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    // 2. quantized_all_reduce_config.enable non-bool & shared_engram extra="forbid"
    const badQarEnable = runSingleConfigDoctor(
      "vllm serve Qwen/Qwen3-8B -tp 2 --additional-config.quantized_all_reduce_config.enable maybe",
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(badQarEnable.hasBlockers).toBe(true);

    const badSeExtra = runSingleConfigDoctor(
      'vllm serve /models/ds-v41 -tp 4 --additional-config \'{"shared_engram":{"backend":"a3","endpoint":"localhost:1234","unknown":1}}\'',
      { mode: "full", hardwareFamily: "A3", version: "main" },
    );
    expect(badSeExtra.hasBlockers).toBe(true);

    // 3. Scientific float 1e0 rejected on runtime_config_hot_reload; 1k accepted on min_numel
    const sciFloat = runSingleConfigDoctor(
      "vllm serve Qwen/Qwen3-8B --additional-config.runtime_config_hot_reload 1e0",
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(sciFloat.hasBlockers).toBe(true);

    const humanInt = runSingleConfigDoctor(
      "vllm serve Qwen/Qwen3-8B -tp 2 --additional-config.quantized_all_reduce_config.min_numel 1k",
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(humanInt.hasBlockers).toBe(false);

    // 4. Dotted flags appended after regular --additional-config (ba15685a precedence)
    const mixedOrder = runSingleConfigDoctor(
      "vllm serve Qwen/Qwen3-8B --additional-config.runtime_config_hot_reload true --additional-config '{\"runtime_config_hot_reload\":3}'",
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(mixedOrder.hasBlockers).toBe(false);

    // 5. Fractional --shutdown-timeout 0.5 rejected; --ubatch-size 2 triggers GDN warning
    const fracShutdown = runSingleConfigDoctor("vllm serve Qwen/Qwen3-8B --shutdown-timeout 0.5", {
      mode: "full",
      hardwareFamily: "A2",
      version: "main",
    });
    expect(fracShutdown.hasBlockers).toBe(true);

    const gdnUbatch = runSingleConfigDoctor(
      "vllm serve Qwen/Qwen3-Next-80B --dtype bfloat16 --mamba-cache-mode align --ubatch-size 2 --additional-config '{\"gdn_internal_prefill_checkpoints\":true}'",
      { mode: "full", hardwareFamily: "A2", version: "main" },
    );
    expect(gdnUbatch.warnings.some((w) => w.id === "d5-gdn-prefill-checkpoints-constraints")).toBe(true);
  });
});
