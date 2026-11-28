import { describe, expect, it } from "vitest";
import { parseSourceRef, SOURCE_REF_PATTERN } from "../rules";
import {
  ASCEND_KNOB_CATALOG,
  applyKnobFixAction,
  DEFAULT_SANDBOX_CONTEXT,
  evaluateKnobRecipe,
  getKnobById,
  getKnobsByGoal,
  getKnobsByKind,
  KNOB_RECIPE_PRESETS,
  type KnobConflictFinding,
  type KnobSandboxContext,
  type KnobSelectionMap,
  resolveKnobLifecycle,
} from "./index";

const WIKI_PAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function assertFixActionResolvesFinding(
  context: KnobSandboxContext,
  selections: KnobSelectionMap,
  findingId: string,
): KnobConflictFinding {
  const before = evaluateKnobRecipe(context, selections);
  const target = before.findings.find((f) => f.id === findingId);
  expect(target, `Expected finding ${findingId} to trigger`).toBeDefined();
  expect(target?.fixAction, `Expected finding ${findingId} to provide fixAction`).toBeDefined();
  if (!target?.fixAction) {
    throw new Error(`Missing fixAction on ${findingId}`);
  }
  const fixed = applyKnobFixAction(context, selections, target.fixAction);
  const after = evaluateKnobRecipe(fixed.context, fixed.selections);
  expect(
    after.findings.some((f) => f.id === findingId),
    `Expected fixAction on ${findingId} to resolve finding`,
  ).toBe(false);
  return target;
}

describe("Ascend Knob Catalog Integrity", () => {
  it("contains 50+ source-verified knobs across env, additional_config, and cli_core with unique IDs and valid sources", () => {
    expect(ASCEND_KNOB_CATALOG.length).toBeGreaterThanOrEqual(50);

    const envKnobs = getKnobsByKind("env");
    const cfgKnobs = getKnobsByKind("additional_config");
    const cliKnobs = getKnobsByKind("cli_core");
    expect(envKnobs.length).toBeGreaterThanOrEqual(22);
    expect(cfgKnobs.length).toBeGreaterThanOrEqual(28);
    expect(cliKnobs.length).toBeGreaterThanOrEqual(4);

    const seenIds = new Set<string>();
    for (const knob of ASCEND_KNOB_CATALOG) {
      expect(knob.id.length).toBeGreaterThan(0);
      expect(seenIds.has(knob.id)).toBe(false);
      seenIds.add(knob.id);

      expect(knob.name.length).toBeGreaterThan(0);
      expect(knob.goals.length).toBeGreaterThan(0);
      expect(knob.recommendedValues.length).toBeGreaterThan(0);
      expect(knob.summaryZh.length).toBeGreaterThan(0);
      expect(knob.mechanismZh.length).toBeGreaterThan(0);
      expect(knob.tradeoffZh.length).toBeGreaterThan(0);
      expect(knob.wikiPageId).toMatch(WIKI_PAGE_ID_PATTERN);
      expect(knob.sources.length).toBeGreaterThan(0);
      for (const src of knob.sources) {
        expect(src).toMatch(SOURCE_REF_PATTERN);
        expect(parseSourceRef(src)).not.toBeNull();
      }
      if (knob.entryKind === "additional_config") {
        expect(knob.jsonPath?.length).toBeGreaterThan(0);
      }
      if (knob.entryKind === "cli_core") {
        expect(knob.cliFlag?.startsWith("--")).toBe(true);
      }
    }
  });

  it("covers all 6 tuning goals and resolves version lifecycle statuses accurately", () => {
    for (const goal of ["ttft", "tpot", "memory", "comm", "graph", "pitfall"] as const) {
      expect(getKnobsByGoal(goal).length).toBeGreaterThan(0);
    }

    const sharedEngram = getKnobById("cfg_shared_engram");
    expect(sharedEngram).not.toBeNull();
    if (sharedEngram) {
      expect(resolveKnobLifecycle(sharedEngram, "v0.30.0")).toBe("main-only");
      expect(resolveKnobLifecycle(sharedEngram, "main")).toBe("main-only");
    }

    const kvRangeEnv = getKnobById("env_kvpool_range_debug");
    expect(kvRangeEnv).not.toBeNull();
    if (kvRangeEnv) {
      expect(resolveKnobLifecycle(kvRangeEnv, "v0.30.0")).toBe("v030-only");
      expect(resolveKnobLifecycle(kvRangeEnv, "main")).toBe("retired-trap");
    }

    const retiredNz = getKnobById("env_retired_enable_nz");
    expect(retiredNz).not.toBeNull();
    if (retiredNz) {
      expect(resolveKnobLifecycle(retiredNz, "v0.30.0")).toBe("retired-trap");
      expect(resolveKnobLifecycle(retiredNz, "main")).toBe("retired-trap");
    }

    expect(getKnobById("toString")).toBeNull();
  });

  it("includes 6 curated scenario presets with clean production recipes and minefield convergence", () => {
    expect(KNOB_RECIPE_PRESETS.length).toBe(6);

    for (const preset of KNOB_RECIPE_PRESETS) {
      const result = evaluateKnobRecipe(preset.context, preset.selections);
      if (preset.id === "preset-legacy-docs-minefield") {
        expect(result.blockers.length).toBeGreaterThanOrEqual(4);
        expect(result.silentResets.length).toBeGreaterThanOrEqual(4);
        expect(result.perfTraps.length).toBeGreaterThanOrEqual(3);
      } else {
        expect(result.blockers, `Preset ${preset.id} should have zero blockers`).toHaveLength(0);
        expect(result.silentResets, `Preset ${preset.id} should have zero silent resets`).toHaveLength(0);
      }
    }

    // Converge the entire minefield recipe by applying fixActions iteratively
    const minefield = KNOB_RECIPE_PRESETS.find((p) => p.id === "preset-legacy-docs-minefield");
    expect(minefield).toBeDefined();
    if (minefield) {
      let ctx = minefield.context;
      let sel: KnobSelectionMap = minefield.selections;
      for (let i = 0; i < 20; i += 1) {
        const res = evaluateKnobRecipe(ctx, sel);
        const fixable = res.findings.find((f) => f.severity !== "synergy" && f.fixAction !== undefined);
        if (!fixable?.fixAction) break;
        const next = applyKnobFixAction(ctx, sel, fixable.fixAction);
        ctx = next.context;
        sel = next.selections;
      }
      const finalRes = evaluateKnobRecipe(ctx, sel);
      expect(finalRes.blockers).toHaveLength(0);
      expect(finalRes.silentResets).toHaveLength(0);
      expect(finalRes.perfTraps).toHaveLength(0);
    }
  });
});

describe("Ascend Knob Conflict Engine Rules & Fix Convergence", () => {
  it("1. detects retired env vars and docs-only HCCL_BUFFSIZE_EP with 1-click migration", () => {
    const fNz = assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_retired_enable_nz: "0" },
      "rule-retired-env-VLLM_ASCEND_ENABLE_NZ",
    );
    expect(fNz.severity).toBe("silent-reset");

    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_retired_enable_mlapo: "1" },
      "rule-retired-env-VLLM_ASCEND_ENABLE_MLAPO",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_retired_enable_fused_mc2: "1" },
      "rule-retired-env-VLLM_ASCEND_ENABLE_FUSED_MC2",
    );

    const epNoRaiseFix = assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_trap_hccl_buffsize_ep: 1024 },
      "rule-retired-env-HCCL_BUFFSIZE_EP",
    );
    expect(epNoRaiseFix.detail).toContain(
      "vllm 与 vllm-ascend Python/C++ 源码 0 处读取（闭源 CANN 内部行为待核）；DispatchFFNCombine 窗口校验仅读取 HCCL_BUFFSIZE",
    );
    const strippedOnly = applyKnobFixAction(
      DEFAULT_SANDBOX_CONTEXT,
      { env_trap_hccl_buffsize_ep: 1024 },
      epNoRaiseFix.fixAction!,
    );
    expect(strippedOnly.selections.env_trap_hccl_buffsize_ep).toBeUndefined();
    expect(strippedOnly.selections.env_hccl_buffsize).toBeUndefined();

    const mc2Context = {
      ...DEFAULT_SANDBOX_CONTEXT,
      soc: "A3" as const,
      modelKind: "moe" as const,
      epEnabled: true,
    };
    const epRaiseFix = assertFixActionResolvesFinding(
      mc2Context,
      { env_trap_hccl_buffsize_ep: 1024, cfg_enable_fused_mc2: 2 },
      "rule-retired-env-HCCL_BUFFSIZE_EP",
    );
    const migrated = applyKnobFixAction(
      mc2Context,
      { env_trap_hccl_buffsize_ep: 1024, cfg_enable_fused_mc2: 2 },
      epRaiseFix.fixAction!,
    );
    expect(migrated.selections.env_hccl_buffsize).toBe(1024);

    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main" },
      { env_kvpool_range_debug: "1" },
      "rule-retired-env-VLLM_ASCEND_KVPOOL_RANGE_DEBUG",
    );
  });

  it("2. blocks version-mismatched and retired additional_config keys via extra='forbid'", () => {
    const fMainOnly = assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0" },
      { cfg_shared_engram: '{"backend":"a3","endpoint":"127.0.0.1:50051"}', cfg_kv_pool_range_debug: true },
      "rule-version-mismatch-main-only",
    );
    expect(fMainOnly.severity).toBe("blocker");

    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0" },
      { env_ascend_buffer_pool: "2147483648" },
      "rule-version-mismatch-ascend-buffer-pool",
    );

    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main" },
      { cfg_profiling_chunk: true },
      "rule-version-mismatch-v030-only",
    );

    const fRetiredCfg = assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_retired_layer_sharding: '["o_proj"]', cfg_retired_weight_prefetch_config: '{"enabled":true}' },
      "rule-retired-additional-config",
    );
    expect(fRetiredCfg.severity).toBe("blocker");
  });

  it("3-6. enforces Sleep Mode guards: weight_nz_mode!=0, RFork fallback, expandable_segments, and shared_engram", () => {
    const sleepCtx: KnobSandboxContext = {
      ...DEFAULT_SANDBOX_CONTEXT,
      version: "main",
      soc: "A2",
      sleepMode: true,
      rforkEnabled: true,
    };

    const fNz = assertFixActionResolvesFinding(sleepCtx, {}, "rule-sleep-mode-weight-nz-blocker");
    expect(fNz.severity).toBe("blocker");
    expect(fNz.evidenceLevel).toBe("M");

    const fRfork = assertFixActionResolvesFinding(
      sleepCtx,
      { cfg_weight_nz_mode: 0 },
      "rule-sleep-mode-rfork-fallback",
    );
    expect(fRfork.severity).toBe("silent-reset");

    const fAlloc = assertFixActionResolvesFinding(
      { ...sleepCtx, rforkEnabled: false },
      { cfg_weight_nz_mode: 0, env_pytorch_npu_alloc_conf: "page_size:1g,expandable_segments:True" },
      "rule-sleep-mode-expandable-segments-blocker",
    );
    expect(fAlloc.severity).toBe("blocker");
    const fixedAlloc = applyKnobFixAction(
      { ...sleepCtx, rforkEnabled: false },
      { cfg_weight_nz_mode: 0, env_pytorch_npu_alloc_conf: "page_size:1g,expandable_segments:True" },
      fAlloc.fixAction!,
    );
    expect(fixedAlloc.selections.env_pytorch_npu_alloc_conf).toBe("page_size:1g");

    const fEngram = assertFixActionResolvesFinding(
      { ...sleepCtx, rforkEnabled: false },
      { cfg_weight_nz_mode: 0, cfg_shared_engram: '{"backend":"a3","endpoint":"127.0.0.1:50051"}' },
      "rule-sleep-mode-shared-engram-blocker",
    );
    expect(fEngram.severity).toBe("blocker");
  });

  it("7-8. models static_kernel / super_kernel / npugraph_ex silent resets, dependency errors, and A3 warmup", () => {
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A2", graphMode: "PIECEWISE" },
      { cfg_enable_static_kernel: true },
      "rule-static-kernel-graph-reset",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "310P", graphMode: "FULL_DECODE_ONLY" },
      { cfg_enable_static_kernel: true },
      "rule-310p-graph-reset",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", graphMode: "FULL_DECODE_ONLY" },
      { cfg_enable_static_kernel: true },
      "rule-static-kernel-a3-dual-die-warmup",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A2", graphMode: "FULL_DECODE_ONLY" },
      { cfg_enable_npugraph_ex: false, cfg_enable_static_kernel: true },
      "rule-static-kernel-missing-npugraph",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A2", graphMode: "FULL_DECODE_ONLY" },
      { cfg_enable_super_kernel: true, cfg_enable_static_kernel: false },
      "rule-super-kernel-missing-prereq",
    );
  });

  it("9-14. evaluates Fused MC2 silent resets, DEBUG TTFT trap, Engram PIECEWISE, Batch Invariant, HCCL_BUFFSIZE, and host queues", () => {
    // 9. Fused MC2 + LoRA / no EP / A3 EP>32 / shared-expert overlap
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", loraEnabled: true, epEnabled: true },
      { cfg_enable_fused_mc2: 1 },
      "rule-fused-mc2-silent-reset",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", epEnabled: false },
      { cfg_enable_fused_mc2: 1 },
      "rule-fused-mc2-silent-reset",
    );
    const a3LargeEpFix = assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", tpSize: 8, dpSize: 8, epEnabled: true },
      { cfg_enable_fused_mc2: 1 },
      "rule-fused-mc2-silent-reset",
    );
    const fixedA3 = applyKnobFixAction(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", tpSize: 8, dpSize: 8, epEnabled: true },
      { cfg_enable_fused_mc2: 1 },
      a3LargeEpFix.fixAction!,
    );
    expect(fixedA3.selections.cfg_enable_fused_mc2).toBe(2);

    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", epEnabled: true },
      { cfg_enable_fused_mc2: 1, cfg_multistream_overlap_shared_expert: true },
      "rule-fused-mc2-clears-shared-expert-overlap",
    );

    // 10. VLLM_LOGGING_LEVEL=DEBUG
    const fDebug = assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_vllm_logging_level: "DEBUG" },
      "rule-logging-debug-perf-trap",
    );
    expect(fDebug.severity).toBe("perf-trap");
    expect(fDebug.evidenceLevel).toBe("M");

    // 11. multistream_engram_overlap + PIECEWISE
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, modelKind: "engram_moe", graphMode: "PIECEWISE" },
      { cfg_multistream_engram_overlap: true },
      "rule-engram-overlap-piecewise-reset",
    );

    // 12. VLLM_BATCH_INVARIANT=1
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_vllm_batch_invariant: "1", cfg_weight_nz_mode: 1, env_hccl_deterministic: "0" },
      "rule-batch-invariant-forced-override",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_vllm_batch_invariant: "1", cfg_multistream_overlap_shared_expert: true },
      "rule-batch-invariant-throughput-tradeoff",
    );

    // 13. HCCL_BUFFSIZE < 64
    const fBuff = assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, epEnabled: true },
      { env_hccl_buffsize: 32, cfg_enable_fused_mc2: 1 },
      "rule-hccl-buffsize-too-small",
    );
    expect(fBuff.severity).toBe("blocker");

    // 14. TASK_QUEUE_ENABLE=0 & OMP_NUM_THREADS > 16
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_task_queue_enable: "0" },
      "rule-task-queue-disabled-perf-trap",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_omp_num_threads: 32 },
      "rule-omp-threads-contention-perf-trap",
    );
  });

  it("15-16. checks dynamic_eplb, shared_engram, synergies, source regex on all findings, and clean nested JSON shellCommand", () => {
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_vllm_use_v2_model_runner: "0", cfg_eplb_dynamic_eplb: true },
      "rule-dynamic-eplb-missing-env",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", tpSize: 16, dpSize: 1 },
      { cfg_shared_engram: '{"backend":"a2","endpoint":"127.0.0.1:50051"}' },
      "rule-shared-engram-constraints",
    );

    // Nested JSON + stripping retired keys + shell-safe quoting + quantized synergy gating
    const evalResult = evaluateKnobRecipe(
      {
        ...DEFAULT_SANDBOX_CONTEXT,
        soc: "A2",
        modelKind: "dense",
        dpSize: 1,
        epEnabled: false,
        sleepMode: true,
      },
      {
        env_task_queue_enable: "1",
        env_retired_enable_nz: "1",
        env_trap_hccl_buffsize_ep: 512,
        cfg_retired_layer_sharding: '["o_proj"]',
        cfg_weight_nz_mode: 0,
        cfg_enable_npugraph_ex: true,
        cfg_enable_static_kernel: true,
        cfg_fuse_norm_quant: true,
        cfg_fusion_ops_gmmswigluquant: true,
        cfg_enable_early_nz_warmup: true,
        cfg_eplb_dynamic_eplb: false,
        cfg_xlite_enabled: false,
        cfg_balance_scheduling: true,
        cli_quantization: "ascend",
      },
    );

    expect(evalResult.additionalConfigObj).toEqual({
      weight_nz_mode: 0,
      ascend_compilation_config: {
        enable_npugraph_ex: true,
        enable_static_kernel: true,
        fuse_norm_quant: true,
      },
      ascend_fusion_config: {
        fusion_ops_gmmswigluquant: true,
      },
      ascend_warmup_config: {
        enable_early_nz_warmup: true,
      },
      eplb_config: {
        dynamic_eplb: false,
      },
      xlite_graph_config: {
        enabled: false,
      },
      scheduler_config: {
        enable_balance_scheduling: true,
      },
    });
    expect(evalResult.envExports).toEqual(["export TASK_QUEUE_ENABLE=1"]);
    expect(evalResult.shellCommand).toContain(
      "# 已自动剥离当前版本不支持或已退役项: VLLM_ASCEND_ENABLE_NZ, HCCL_BUFFSIZE_EP, layer_sharding",
    );
    expect(evalResult.shellCommand).toContain("unset VLLM_ASCEND_ENABLE_NZ HCCL_BUFFSIZE_EP");
    const servePart = evalResult.shellCommand.slice(evalResult.shellCommand.indexOf("vllm serve"));
    expect(servePart).toContain("vllm serve Ascend-ModelSlim/Qwen3-8B-W8A8");
    expect(servePart).not.toContain("VLLM_ASCEND_ENABLE_NZ");
    expect(servePart).not.toContain("HCCL_BUFFSIZE_EP");
    expect(servePart).not.toContain("layer_sharding");
    expect(servePart).toContain("--additional-config '");
    expect(evalResult.synergies.some((s) => s.id === "synergy-fuse-norm-quant")).toBe(true);
    expect(evalResult.synergies.some((s) => s.id === "synergy-sleep-nz-zero")).toBe(true);
    expect(evalResult.synergies.some((s) => s.id === "synergy-static-super-kernel")).toBe(true);

    for (const f of evalResult.findings) {
      expect(f.sources.length).toBeGreaterThan(0);
      for (const s of f.sources) {
        expect(s).toMatch(SOURCE_REF_PATTERN);
      }
    }
  });

  it("17. covers additional AscendConfig mutexes, PD scheduler guards, main-only mutexes, and activeKnobs override tracking", () => {
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_enable_force_eplb: true, cfg_eplb_dynamic_eplb: true, env_dynamic_eplb: "true" },
      "rule-force-eplb-dynamic-eplb-mutex",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_mlapo_keep_prefill_weights: true, cfg_enable_mlapo: false },
      "rule-mlapo-keep-prefill-preconditions",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, modelKind: "mla_moe", pdRole: "none" },
      { cfg_enable_kv_nz: true },
      "rule-kv-nz-preconditions",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, modelKind: "dense", pdRole: "none" },
      { cfg_enable_kv_nz: true },
      "rule-kv-nz-preconditions",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_mc2_comm_alg: "hierarchy", cfg_enable_fused_mc2: 1 },
      "rule-mc2-hierarchy-fused-mutex",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, pdRole: "decode" },
      { cfg_balance_scheduling: true },
      "rule-balance-scheduling-pd-blocker",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, pdRole: "none" },
      { cfg_recompute_scheduler: true },
      "rule-recompute-scheduler-mixed-blocker",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, pdRole: "prefill" },
      { cfg_recompute_scheduler: true },
      "rule-recompute-scheduler-prefill-ignored",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", soc: "A3" },
      { cfg_enable_fused_mc2: 3 },
      "rule-fused-mc2-level3-blocker",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", soc: "A2", modelKind: "moe", tpSize: 4 },
      {
        cfg_quantized_all_reduce_config: '{"enable":true,"min_numel":16777216}',
        cfg_enable_flashcomm1: true,
      },
      "rule-quantized-ar-flashcomm-mutex",
    );
    const denseNoFlashcommMutex = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", soc: "A2", modelKind: "dense", tpSize: 4 },
      {
        cfg_quantized_all_reduce_config: '{"enable":true,"min_numel":16777216}',
        cfg_enable_flashcomm1: true,
      },
    );
    expect(denseNoFlashcommMutex.findings.some((f) => f.id === "rule-quantized-ar-flashcomm-mutex")).toBe(
      false,
    );

    const activeOverrideRes = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, graphMode: "PIECEWISE" },
      { cfg_enable_static_kernel: true },
    );
    const staticEntry = activeOverrideRes.activeKnobs.find(
      (entry) => entry.spec.id === "cfg_enable_static_kernel",
    );
    expect(staticEntry?.effectiveValue).toBe(false);
    expect(staticEntry?.overriddenByRuleId).toBe("rule-static-kernel-graph-reset");
  });
});

describe("Ascend Knob Wave-2 Fixes & Source Audits", () => {
  it("P1-1: blocks --quantization modelslim, emits ModelSlim checkpoint path for ascend, and updates 910B3 preset", () => {
    const preset910 = KNOB_RECIPE_PRESETS.find((p) => p.id === "preset-910b3-w8a8-low-latency")!;
    expect(preset910.selections.cli_quantization).toBe("ascend");
    const presetEval = evaluateKnobRecipe(preset910.context, preset910.selections);
    expect(presetEval.blockers).toHaveLength(0);
    expect(presetEval.shellCommand).toContain("vllm serve Ascend-ModelSlim/Qwen3-8B-W8A8");

    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cli_quantization: "modelslim" },
      "rule-quantization-modelslim-blocker",
    );
    const stripped = evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, { cli_quantization: "modelslim" });
    expect(stripped.cliArgs.join(" ")).not.toContain("--quantization modelslim");
    expect(stripped.shellCommand).toContain("# 已自动剥离当前版本不支持或已退役项: --quantization");
  });

  it("P1-2 & P2-6: restricts quantized_all_reduce_config to main A2 with TP<=8 and MoE FlashComm1 SP", () => {
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", soc: "A3", tpSize: 4 },
      { cfg_quantized_all_reduce_config: '{"enable":true,"min_numel":16777216}' },
      "rule-quantized-ar-a2-tp8-blocker",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", soc: "A2", tpSize: 16 },
      { cfg_quantized_all_reduce_config: '{"enable":true,"min_numel":16777216}' },
      "rule-quantized-ar-a2-tp8-blocker",
    );
    const validA2 = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", soc: "A2", tpSize: 8 },
      { cfg_quantized_all_reduce_config: '{"enable":true,"min_numel":16777216}' },
    );
    expect(validA2.blockers).toHaveLength(0);

    const engramPreset = KNOB_RECIPE_PRESETS.find((p) => p.id === "preset-deepseek-engram-multistream")!;
    expect(engramPreset.selections.cfg_quantized_all_reduce_config).toBeUndefined();
    expect(evaluateKnobRecipe(engramPreset.context, engramPreset.selections).blockers).toHaveLength(0);
  });

  it("P1-3 & P1-4: checks ppSize CLI/rules, v0.30.0 blockers, and main shared_engram invariants", () => {
    const ppEval = evaluateKnobRecipe({ ...DEFAULT_SANDBOX_CONTEXT, ppSize: 2 }, {});
    expect(ppEval.cliArgs).toContain("--pipeline-parallel-size 2");

    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0" },
      { cfg_mega_moe_max_tokens: 0 },
      "rule-v030-mega-moe-max-tokens-positive",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0", ppSize: 1 },
      { cfg_profiling_chunk: true },
      "rule-v030-profiling-chunk-requires-pp",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0", soc: "A2" },
      { cfg_mc2_comm_alg: "fullmesh_v2" },
      "rule-mc2-fullmesh-v2-requires-a3",
    );

    const engramBadCtx = {
      ...DEFAULT_SANDBOX_CONTEXT,
      version: "main" as const,
      modelKind: "dense" as const,
      ppSize: 2 as const,
      tpSize: 16 as const,
    };
    const engramFinding = assertFixActionResolvesFinding(
      engramBadCtx,
      { cfg_shared_engram: '{"backend":"a2","endpoint":"127.0.0.1:50051"}' },
      "rule-shared-engram-constraints",
    );
    expect(engramFinding.fixAction?.nextContextPatch).toMatchObject({
      modelKind: "engram_moe",
      ppSize: 1,
      tpSize: 8,
    });

    const engramCli = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", modelKind: "engram_moe", ppSize: 1, tpSize: 8 },
      { cfg_shared_engram: '{"backend":"a2","endpoint":"127.0.0.1:50051"}' },
    );
    expect(engramCli.cliArgs).toContain("--hf-overrides '{\"engram_cpu_offload\":true}'");
    expect(engramCli.cliArgs).toContain("--shutdown-timeout 120");
  });

  it("C & P2-3..P2-9: covers FP8 KV, 3 new envs, RL/shared_expert_dp/LoRA/MLAPO overrides, whitespace strip, '2' migration, and comm checks", () => {
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3" },
      { cli_kv_cache_dtype: "fp8" },
      "rule-kv-cache-dtype-fp8-requires-a5",
    );
    expect(
      evaluateKnobRecipe({ ...DEFAULT_SANDBOX_CONTEXT, soc: "A5" }, { cli_kv_cache_dtype: "fp8" }).blockers,
    ).toHaveLength(0);

    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main" },
      { env_rope_ub_size_kb: 192 },
      "rule-retired-env-VLLM_ASCEND_ROPE_UB_SIZE_KB",
    );
    const newEnvEval = evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, {
      env_rope_ub_size_kb: 192,
      env_mooncake_config_path: "/etc/vllm/mooncake.json",
      env_enable_batch_memcpy: "1",
    });
    expect(newEnvEval.envExports).toContain("export VLLM_ASCEND_ROPE_UB_SIZE_KB=192");
    expect(newEnvEval.envExports).toContain("export MOONCAKE_CONFIG_PATH=/etc/vllm/mooncake.json");
    expect(newEnvEval.envExports).toContain("export VLLM_ASCEND_ENABLE_BATCH_MEMCPY=1");

    // P2-3: whitespace around ':' in expandable_segments :True
    const wsRes = assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, sleepMode: true },
      {
        cfg_weight_nz_mode: 0,
        env_pytorch_npu_alloc_conf: "max_split_size_mb:128, expandable_segments :True",
      },
      "rule-sleep-mode-expandable-segments-blocker",
    );
    expect(
      applyKnobFixAction(
        { ...DEFAULT_SANDBOX_CONTEXT, sleepMode: true },
        { env_pytorch_npu_alloc_conf: "max_split_size_mb:128, expandable_segments :True" },
        wsRes.fixAction!,
      ).selections.env_pytorch_npu_alloc_conf,
    ).toBe("max_split_size_mb:128");

    // P2-4: preserve integer "2" on retired env migration
    const nz2Eval = evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, {
      env_retired_enable_nz: "2",
      env_retired_enable_fused_mc2: "2",
    });
    const nz2Fix = nz2Eval.findings.find((f) => f.id === "rule-retired-env-VLLM_ASCEND_ENABLE_NZ")?.fixAction;
    const mc2Fix = nz2Eval.findings.find(
      (f) => f.id === "rule-retired-env-VLLM_ASCEND_ENABLE_FUSED_MC2",
    )?.fixAction;
    expect(
      applyKnobFixAction(DEFAULT_SANDBOX_CONTEXT, { env_retired_enable_nz: "2" }, nz2Fix!).selections
        .cfg_weight_nz_mode,
    ).toBe(2);
    expect(
      applyKnobFixAction(DEFAULT_SANDBOX_CONTEXT, { env_retired_enable_fused_mc2: "2" }, mc2Fix!).selections
        .cfg_enable_fused_mc2,
    ).toBe(2);

    // P2-5: RL suppresses Sleep+NZ/alloc blockers, shared_expert_dp silent reset, LoRA bypass effectiveValue
    const rlSleep = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, sleepMode: true },
      { cfg_rl_enabled: true, cfg_weight_nz_mode: 1, env_pytorch_npu_alloc_conf: "expandable_segments:True" },
    );
    expect(rlSleep.blockers).toHaveLength(0);
    expect(rlSleep.silentResets.some((f) => f.id === "rule-rl-overrides-nz-and-alloc")).toBe(true);
    expect(rlSleep.activeKnobs.find((k) => k.spec.id === "cfg_weight_nz_mode")?.effectiveValue).toBe(0);

    const sharedDpReset = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, modelKind: "dense", epEnabled: false, tpSize: 1 },
      { cfg_enable_shared_expert_dp: true },
    );
    expect(sharedDpReset.silentResets.some((f) => f.id === "rule-shared-expert-dp-silent-reset")).toBe(true);
    expect(
      sharedDpReset.activeKnobs.find((k) => k.spec.id === "cfg_enable_shared_expert_dp")?.effectiveValue,
    ).toBe(false);

    const loraBypass = evaluateKnobRecipe(
      {
        ...DEFAULT_SANDBOX_CONTEXT,
        soc: "A3",
        modelKind: "moe",
        epEnabled: true,
        loraEnabled: true,
        tpSize: 4,
        dpSize: 2,
      },
      { cfg_enable_fused_mc2: 1 },
    );
    expect(loraBypass.activeKnobs.find((k) => k.spec.id === "cfg_enable_fused_mc2")?.effectiveValue).toBe(
      "旁路 → ALLTOALL",
    );

    // P2-7: A3 MLAPO non-decode silent reset + BF16 Sleep preset omits fuse_norm_quant synergy
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "mla_moe", pdRole: "none" },
      { cfg_enable_mlapo: true },
      "rule-mlapo-requires-decode-on-a2-a3",
    );
    const a3Preset = KNOB_RECIPE_PRESETS.find((p) => p.id === "preset-a3-large-ep-moe")!;
    expect(a3Preset.context.pdRole).toBe("decode");
    expect(evaluateKnobRecipe(a3Preset.context, a3Preset.selections).silentResets).toHaveLength(0);
    const sleepPreset = KNOB_RECIPE_PRESETS.find((p) => p.id === "preset-sleep-mode-fast-wakeup")!;
    expect(
      evaluateKnobRecipe(sleepPreset.context, sleepPreset.selections).synergies.some(
        (s) => s.id === "synergy-fuse-norm-quant",
      ),
    ).toBe(false);

    // P2-9 ①②: dynamic m=2048 plain dispatch_ffn_combine window (> 200 MiB default) + MegaMoe skips HCCL_BUFFSIZE + ASCEND_BUFFER_POOL requires FabricMem=1
    assertFixActionResolvesFinding(
      {
        ...DEFAULT_SANDBOX_CONTEXT,
        soc: "A3",
        modelKind: "moe",
        epEnabled: true,
        tpSize: 4,
        dpSize: 2,
        pdRole: "none",
      },
      { cfg_enable_fused_mc2: 1, cfg_enable_prefill_mc2: true, cli_max_num_batched_tokens: 2048 },
      "rule-hccl-buffsize-too-small",
    );
    expect(
      evaluateKnobRecipe(
        {
          ...DEFAULT_SANDBOX_CONTEXT,
          version: "main",
          soc: "A3",
          modelKind: "moe",
          epEnabled: true,
          tpSize: 4,
          dpSize: 2,
          pdRole: "none",
        },
        { cfg_enable_fused_mc2: 2, env_hccl_buffsize: 32, cli_max_num_batched_tokens: 4096 },
      ).blockers.some((b) => b.id === "rule-hccl-buffsize-too-small"),
    ).toBe(false);
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main" },
      { env_ascend_buffer_pool: "2:256" },
      "rule-ascend-buffer-pool-requires-fabric-mem",
    );

    // Wave-3 Final Audit Regressions (P1-1..P1-3 & P2-1..P2-4):
    // (1) v0.30.0 PP=1 + profiling_chunk + enable_balance_scheduling converges to PP=2 & balance_scheduling=false
    let schedCtx = {
      ...DEFAULT_SANDBOX_CONTEXT,
      version: "v0.30.0" as const,
      ppSize: 1 as const,
      pdRole: "none" as const,
    };
    let schedSel: KnobSelectionMap = { cfg_profiling_chunk: true, cfg_balance_scheduling: true };
    for (let step = 0; step < 6; step += 1) {
      const ev = evaluateKnobRecipe(schedCtx, schedSel);
      const fixable = ev.findings.find((f) => f.severity !== "synergy" && f.fixAction !== undefined);
      if (!fixable?.fixAction) break;
      const next = applyKnobFixAction(schedCtx, schedSel, fixable.fixAction);
      schedCtx = next.context as typeof schedCtx;
      schedSel = next.selections;
    }
    const schedAfter = evaluateKnobRecipe(schedCtx, schedSel);
    expect(schedAfter.blockers).toHaveLength(0);
    expect(schedCtx.ppSize).toBe(2);
    expect(schedSel.cfg_balance_scheduling).toBe(false);

    // (2) 310P floating-point CLI automatically includes --dtype float16
    const cli310p = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "310P", tpSize: 1, dpSize: 1, ppSize: 1, graphMode: "NONE" },
      {},
    );
    expect(cli310p.cliArgs).toContain("--dtype float16");

    // (3) --kv-cache-dtype int8 blocked on GQA + Mooncake PD AND on unquantized BF16 checkpoint
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A2", modelKind: "dense", pdRole: "decode" },
      { cli_kv_cache_dtype: "int8" },
      "rule-kv-cache-int8-gqa-mooncake-blocker",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A2", modelKind: "mla_moe", pdRole: "none" },
      { cli_kv_cache_dtype: "int8" },
      "rule-kv-cache-int8-requires-quant-scale",
    );

    // (4) HCCL_BUFFSIZE=32 with LoRA bypass (or Dense / EP=off) does NOT report DispatchFFNCombine blocker
    const loraSmallBuff = evaluateKnobRecipe(
      {
        ...DEFAULT_SANDBOX_CONTEXT,
        soc: "A3",
        modelKind: "moe",
        tpSize: 4,
        dpSize: 2,
        epEnabled: true,
        loraEnabled: true,
      },
      { cfg_enable_fused_mc2: 1, env_hccl_buffsize: 32 },
    );
    expect(loraSmallBuff.blockers.some((b) => b.id === "rule-hccl-buffsize-too-small")).toBe(false);
    expect(
      evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "dense", epEnabled: false },
        { cfg_enable_fused_mc2: 1, env_hccl_buffsize: 32 },
      ).findings.some((f) => f.id === "rule-hccl-buffsize-too-small"),
    ).toBe(false);

    // (5) fuse_norm_quant: no false synergy on unquantized A5 Qwen3-8B; keeps synergy on A2 W8A8 even when npugraph_ex=false
    expect(
      evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, soc: "A5", modelKind: "dense" },
        { cfg_fuse_norm_quant: true },
      ).synergies.some((s) => s.id === "synergy-fuse-norm-quant"),
    ).toBe(false);
    expect(
      evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, soc: "A2", modelKind: "dense", graphMode: "PIECEWISE" },
        { cfg_fuse_norm_quant: true, cfg_enable_npugraph_ex: false, cli_quantization: "ascend" },
      ).synergies.some((s) => s.id === "synergy-fuse-norm-quant"),
    ).toBe(true);

    // (6) MLAPO on non-MLA model (Dense Qwen3-8B + PD Decode) flags silent no-op
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "dense", pdRole: "decode" },
      { cfg_enable_mlapo: true },
      "rule-mlapo-non-mla-noop",
    );

    // (7) Broken JSON string in cfg_shared_engram is blocked & stripped from additionalConfigObj
    const brokenJsonEval = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", modelKind: "engram_moe", tpSize: 4, ppSize: 1 },
      { cfg_shared_engram: "broken JSON" },
    );
    expect(brokenJsonEval.blockers.some((b) => b.id === "rule-invalid-json-knob-cfg_shared_engram")).toBe(
      true,
    );
    expect(brokenJsonEval.additionalConfigObj.shared_engram).toBeUndefined();
  });
});

describe("Ascend Knob Wave-4 Deep-Audit Additions & Rules", () => {
  it("exposes 95 knobs including audited Wave-4 & P2-4 additions, historical anchors, and version-scoped MRv2 options", () => {
    expect(ASCEND_KNOB_CATALOG.length).toBe(95);
    const expectedNewIds = [
      "env_enable_flashcomm1",
      "env_triton_all_blocks_parallel",
      "env_expert_map_record",
      "env_retired_enable_matmul_allreduce",
      "env_retired_balance_scheduling",
      "cfg_fuse_muls_add",
      "cfg_xlite_full_mode",
      "cfg_combine_quant_mode",
      "cfg_mix_placement",
      "cfg_enable_pcp_embedding_lmhead_weight_sharding",
      "cfg_finegrained_tp_oproj",
      "cfg_finegrained_tp_mlp",
      "cfg_finegrained_tp_qkv_iproj",
      "cfg_gdn_internal_prefill_checkpoints",
      "cfg_sparse_kv_offload_enabled",
      "cfg_enable_kvpp",
      "cfg_rl_sleep_mode_extra_cleanup",
      "cli_kv_transfer_use_layerwise",
      "cfg_eplb_expert_map_record_path",
      "cfg_eplb_stair_rank_transfer_limit",
      "cfg_eplb_stair_cross_node_transfer_limit",
      "cfg_sparse_kv_offload_topk_buffer_size",
      "cfg_sparse_kv_offload_keep_device_kv_cache",
      "cli_ec_recv_buffer_tokens",
      "cli_enable_eplb",
      "cli_kv_transfer_connector",
    ];
    for (const id of expectedNewIds) {
      const knob = getKnobById(id);
      expect(knob, `Missing catalog knob ${id}`).not.toBeNull();
      for (const sha of ["2c59ff10", "2ed6cbba", "c09d3e20", "8d6180e2"] as const) {
        expect(
          knob!.sources.some((s) => s.startsWith(`vllm-ascend@${sha}:`)),
          `Expected ${id} to include anchor for ${sha}`,
        ).toBe(true);
      }
    }
    for (const knob of ASCEND_KNOB_CATALOG) {
      for (const src of knob.sources) {
        expect(src, `${knob.id} should not point to bare class header #L27/#L56/#L397`).not.toMatch(
          /ascend_config\.py#L(27|56|397)$/,
        );
      }
    }
    expect(expectedNewIds).toHaveLength(26);

    const mrv2 = getKnobById("env_vllm_use_v2_model_runner")!;
    expect(mrv2.recommendedValuesByVersion?.main?.some((rv) => rv.value === "0")).toBe(false);
    expect(mrv2.recommendedValuesByVersion?.["v0.30.0"]?.some((rv) => rv.value === "0")).toBe(true);
    const kvDtype = getKnobById("cli_kv_cache_dtype")!;
    expect(kvDtype.recommendedValues.some((rv) => rv.value === "turboquant_4bit_nc")).toBe(true);
  });

  it("blocks VLLM_USE_V2_MODEL_RUNNER=0 on main, defaults v0.30.0 unset to MRv1, and checks EPLB/STAIR/record_path", () => {
    const mainCtx = { ...DEFAULT_SANDBOX_CONTEXT, version: "main" as const };
    const fMrv1Main = assertFixActionResolvesFinding(
      mainCtx,
      { env_vllm_use_v2_model_runner: "0" },
      "rule-mrv1-removed-in-main",
    );
    expect(fMrv1Main.severity).toBe("blocker");
    const mrv1MainRes = evaluateKnobRecipe(mainCtx, { env_vllm_use_v2_model_runner: "0" });
    expect(mrv1MainRes.shellCommand).toContain("unset VLLM_USE_V2_MODEL_RUNNER");
    expect(mrv1MainRes.envExports).not.toContain("export VLLM_USE_V2_MODEL_RUNNER=0");
    expect(evaluateKnobRecipe(mainCtx, { env_vllm_use_v2_model_runner: "1" }).blockers).toHaveLength(0);

    // v0.30.0 default (unset VLLM_USE_V2_MODEL_RUNNER) runs MRv1 per patch_use_v2_model_runner.py#L27-L30
    expect(
      evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, { cfg_eplb_dynamic_eplb: false }).blockers,
    ).toHaveLength(0);
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_eplb_dynamic_eplb: true },
      "rule-dynamic-eplb-missing-env",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_expert_map_record: "1" },
      "rule-mrv1-expert-map-record-case-trap",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cli_enable_eplb: true },
      "rule-enable-eplb-requires-mrv2",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_eplb_stair_rank_transfer_limit: 4 },
      "rule-stair-config-requires-mrv2",
    );

    // v0.30.0 MRv1 also checks .json extension & env trigger for expert_map_record_path
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_eplb_expert_map_record_path: "/tmp/expert_map.txt", env_dynamic_eplb: "true" },
      "rule-eplb-record-path-not-json",
    );

    // v0.30.0 explicit MRv2 (=1) blocks legacy V1 EPLB and migrates cleanly to --enable-eplb
    const v030ExplicitMrv2Sel = {
      env_vllm_use_v2_model_runner: "1",
      cfg_eplb_dynamic_eplb: true,
      env_dynamic_eplb: "true",
      env_expert_map_record: "1",
    };
    const fV030Mrv2 = assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      v030ExplicitMrv2Sel,
      "rule-eplb-v1-controls-in-mrv2",
    );
    expect(fV030Mrv2.severity).toBe("blocker");
    const fixedMrv2 = applyKnobFixAction(DEFAULT_SANDBOX_CONTEXT, v030ExplicitMrv2Sel, fV030Mrv2.fixAction!);
    expect(fixedMrv2.selections.cli_enable_eplb).toBe(true);
    const afterV030Mrv2Fix = evaluateKnobRecipe(fixedMrv2.context, fixedMrv2.selections);
    expect(afterV030Mrv2Fix.blockers).toHaveLength(0);
    expect(afterV030Mrv2Fix.cliArgs).toContain("--enable-eplb");

    // main MRv2 filters and ignores V1 EPLB controls -> silent-reset (not blocker) and migrates to --enable-eplb
    const mainEplbSel = {
      cfg_eplb_dynamic_eplb: true,
      env_dynamic_eplb: "true",
      env_expert_map_record: "true",
    };
    const fMainEplb = assertFixActionResolvesFinding(
      mainCtx,
      mainEplbSel,
      "rule-eplb-v1-controls-ignored-in-main",
    );
    expect(fMainEplb.severity).toBe("silent-reset");
    const fixedMainEplb = applyKnobFixAction(mainCtx, mainEplbSel, fMainEplb.fixAction!);
    expect(fixedMainEplb.selections.cli_enable_eplb).toBe(true);
    expect(evaluateKnobRecipe(fixedMainEplb.context, fixedMainEplb.selections).blockers).toHaveLength(0);

    // STAIR EPLB bounds validation
    assertFixActionResolvesFinding(
      mainCtx,
      { cfg_eplb_stair_rank_transfer_limit: 0, cfg_eplb_stair_cross_node_transfer_limit: -2 },
      "rule-stair-config-invalid-range",
    );
    expect(
      evaluateKnobRecipe(mainCtx, {
        cli_enable_eplb: true,
        cfg_eplb_stair_rank_transfer_limit: 4,
        cfg_eplb_stair_cross_node_transfer_limit: 0,
      }).blockers,
    ).toHaveLength(0);

    // v0.30.0 MRv1 catches EXPERT_MAP_RECORD="1" strict lowercase "true" trap
    const fRecordCase = assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_vllm_use_v2_model_runner: "0", cfg_eplb_dynamic_eplb: true, env_expert_map_record: "1" },
      "rule-dynamic-eplb-missing-env",
    );
    const fixedRecord = applyKnobFixAction(
      DEFAULT_SANDBOX_CONTEXT,
      { env_vllm_use_v2_model_runner: "0", cfg_eplb_dynamic_eplb: true, env_expert_map_record: "1" },
      fRecordCase.fixAction!,
    );
    expect(fixedRecord.selections.env_expert_map_record).toBe("true");
    expect(evaluateKnobRecipe(fixedRecord.context, fixedRecord.selections).blockers).toHaveLength(0);
  });

  it("blocks xlite PP>1 / turboquant_4bit_nc, validates turboquant SoC/MRv1, and handles HCCL_BUFFSIZE 48MiB & uint16 limits", () => {
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, ppSize: 2 },
      { cfg_xlite_enabled: true },
      "rule-xlite-pp-blocker",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3" },
      { cfg_xlite_enabled: true, cli_kv_cache_dtype: "turboquant_4bit_nc" },
      "rule-xlite-turboquant-mutex",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, ppSize: 2 },
      { cfg_xlite_full_mode: true },
      "rule-xlite-full-mode-needs-enabled",
    );

    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A5" },
      { cli_kv_cache_dtype: "turboquant_4bit_nc" },
      "rule-kv-cache-turboquant-unsupported-soc",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "310P" },
      { cli_kv_cache_dtype: "turboquant_4bit_nc" },
      "rule-kv-cache-turboquant-unsupported-soc",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0", soc: "A3" },
      { cli_kv_cache_dtype: "turboquant_4bit_nc", env_vllm_use_v2_model_runner: "0" },
      "rule-kv-cache-turboquant-mrv1-blocker",
    );
    expect(
      evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, version: "main", soc: "A3" },
        { cli_kv_cache_dtype: "turboquant_4bit_nc" },
      ).blockers,
    ).toHaveLength(0);

    // 48 MiB satisfies moe (hidden=4096 -> 34 MiB), while mla_moe (hidden=7168 -> 52 MiB) blocks at 48 MiB and passes at 52 MiB
    const ok48Eval = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "moe", epEnabled: true },
      { cfg_enable_fused_mc2: 1, env_hccl_buffsize: 48 },
    );
    expect(ok48Eval.findings.some((f) => f.id === "rule-hccl-buffsize-too-small")).toBe(false);
    expect(ok48Eval.blockers).toHaveLength(0);

    const mla48Blocker = assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "mla_moe", epEnabled: true },
      { cfg_enable_fused_mc2: 1, env_hccl_buffsize: 48 },
      "rule-hccl-buffsize-too-small",
    );
    expect(mla48Blocker.title).toContain("52 MiB");
    expect(
      evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "mla_moe", epEnabled: true },
        { cfg_enable_fused_mc2: 1, env_hccl_buffsize: 52 },
      ).blockers,
    ).toHaveLength(0);

    // HCCL_BUFFSIZE > 65535 silently falls back to 200 MiB and triggers DispatchFFNCombine window blocker
    const overflowCtx = {
      ...DEFAULT_SANDBOX_CONTEXT,
      soc: "A3" as const,
      modelKind: "moe" as const,
      epEnabled: true,
    };
    const overflowSel = {
      env_hccl_buffsize: 65536,
      cfg_enable_fused_mc2: 1,
      cfg_enable_prefill_mc2: true,
      cli_max_num_batched_tokens: 2048,
    };
    const overflowEval = evaluateKnobRecipe(overflowCtx, overflowSel);
    expect(overflowEval.silentResets.some((f) => f.id === "rule-hccl-buffsize-uint16-overflow-reset")).toBe(
      true,
    );
    expect(overflowEval.activeKnobs.find((k) => k.spec.id === "env_hccl_buffsize")?.effectiveValue).toBe(200);
    expect(overflowEval.blockers.some((f) => f.id === "rule-hccl-buffsize-too-small")).toBe(true);
    const fOverflow = assertFixActionResolvesFinding(
      overflowCtx,
      overflowSel,
      "rule-hccl-buffsize-uint16-overflow-reset",
    );
    const afterOverflowFix = applyKnobFixAction(overflowCtx, overflowSel, fOverflow.fixAction!);
    expect(evaluateKnobRecipe(afterOverflowFix.context, afterOverflowFix.selections).blockers).toHaveLength(
      0,
    );

    // Unachievable window (>65535 MiB required) converges in 1 step by disabling cfg_enable_fused_mc2 instead of looping on 65535
    let hugeCtx = {
      ...DEFAULT_SANDBOX_CONTEXT,
      soc: "A3" as const,
      modelKind: "moe" as const,
      epEnabled: true,
    };
    let hugeSel: KnobSelectionMap = {
      env_hccl_buffsize: 65536,
      cfg_enable_fused_mc2: 1,
      cfg_enable_prefill_mc2: true,
      cli_max_num_batched_tokens: 1048576,
    };
    for (let step = 0; step < 3; step += 1) {
      const ev = evaluateKnobRecipe(hugeCtx, hugeSel);
      const fixable = ev.findings.find((f) => f.severity !== "synergy" && f.fixAction !== undefined);
      if (!fixable?.fixAction) break;
      const next = applyKnobFixAction(hugeCtx, hugeSel, fixable.fixAction);
      hugeCtx = next.context as typeof hugeCtx;
      hugeSel = next.selections;
    }
    expect(evaluateKnobRecipe(hugeCtx, hugeSel).blockers).toHaveLength(0);
    expect(hugeSel.cfg_enable_fused_mc2).toBe(0);

    // MegaMoe (level 2 or main level 3 on A5) never triggers DispatchFFNCombine HCCL_BUFFSIZE blocker
    expect(
      evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, version: "main", soc: "A5", modelKind: "mla_moe", epEnabled: true },
        { cfg_enable_fused_mc2: 3, env_hccl_buffsize: 32, cli_max_num_batched_tokens: 4096 },
      ).blockers.some((b) => b.id === "rule-hccl-buffsize-too-small"),
    ).toBe(false);
  });

  it("enforces FlashComm1/AR order, mix_placement, finegrained_tp recompute+PreemptOffload+glm5_next, sparse index_topk, EC/enum guards", () => {
    // VLLM_ASCEND_ENABLE_FLASHCOMM1=1 clears quantized_all_reduce BEFORE TP>8/A3 check (no false blocker!)
    const flashEnvA3 = evaluateKnobRecipe(
      {
        ...DEFAULT_SANDBOX_CONTEXT,
        version: "main",
        soc: "A3",
        modelKind: "moe",
        tpSize: 4,
        epEnabled: true,
      },
      {
        env_enable_flashcomm1: "1",
        cfg_quantized_all_reduce_config: '{"enable":true,"min_numel":16777216}',
      },
    );
    expect(flashEnvA3.blockers.some((b) => b.id === "rule-quantized-ar-a2-tp8-blocker")).toBe(false);
    expect(flashEnvA3.silentResets.some((s) => s.id === "rule-quantized-ar-flashcomm-mutex")).toBe(true);
    const fixedFlashA3 = applyKnobFixAction(
      {
        ...DEFAULT_SANDBOX_CONTEXT,
        version: "main",
        soc: "A3",
        modelKind: "moe",
        tpSize: 4,
        epEnabled: true,
      },
      {
        env_enable_flashcomm1: "1",
        cfg_quantized_all_reduce_config: '{"enable":true,"min_numel":16777216}',
      },
      flashEnvA3.findings.find((f) => f.id === "rule-quantized-ar-flashcomm-mutex")!.fixAction!,
    );
    expect(evaluateKnobRecipe(fixedFlashA3.context, fixedFlashA3.selections).blockers).toHaveLength(0);

    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_enable_flashcomm1: false, env_enable_flashcomm1: "1" },
      "rule-env-flashcomm1-overrides-json",
    );

    // mix_placement mutex respects effective shared_expert_dp & effective multistream_overlap_shared_expert
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, modelKind: "mla_moe", epEnabled: true, tpSize: 4 },
      { cfg_mix_placement: true, cfg_enable_shared_expert_dp: true },
      "rule-mix-placement-mutex",
    );
    expect(
      evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, modelKind: "mla_moe", epEnabled: true, tpSize: 4 },
        { cfg_mix_placement: true, cfg_enable_fused_mc2: 1, cfg_multistream_overlap_shared_expert: true },
      ).blockers.some((b) => b.id === "rule-mix-placement-mutex"),
    ).toBe(false);

    // P1-1: finegrained_tp_config requires recompute_scheduler_enable + PreemptOffloadConnector and resets safely on fix
    const fgDecodeCtx = {
      ...DEFAULT_SANDBOX_CONTEXT,
      version: "main" as const,
      modelKind: "moe" as const,
      tpSize: 1 as const,
      dpSize: 4 as const,
      pdRole: "decode" as const,
      graphMode: "FULL_DECODE_ONLY" as const,
    };
    const fFgMissingRecompute = assertFixActionResolvesFinding(
      fgDecodeCtx,
      { cfg_finegrained_tp_oproj: 2, cfg_finegrained_tp_mlp: 2 },
      "rule-finegrained-tp-preconditions",
    );
    expect(fFgMissingRecompute.title).toContain("recompute_scheduler_enable");
    expect(fFgMissingRecompute.title).toContain("PreemptOffloadConnector");
    const fixedFgReset = applyKnobFixAction(
      fgDecodeCtx,
      { cfg_finegrained_tp_oproj: 2, cfg_finegrained_tp_mlp: 2 },
      fFgMissingRecompute.fixAction!,
    );
    expect(fixedFgReset.selections.cfg_finegrained_tp_oproj).toBe(1);
    expect(fixedFgReset.selections.cfg_finegrained_tp_mlp).toBe(1);
    expect(evaluateKnobRecipe(fixedFgReset.context, fixedFgReset.selections).blockers).toHaveLength(0);

    // Full satisfied finegrained_tp exports PreemptOffloadConnector cleanly and triggers capture bound reset when >512
    const fgValidSel = {
      cfg_finegrained_tp_oproj: 2,
      cfg_finegrained_tp_mlp: 2,
      cfg_recompute_scheduler: true,
      cli_kv_transfer_connector: "MultiConnector(Mooncake+PreemptOffload)",
      cli_max_num_seqs: 256,
      cli_max_num_batched_tokens: 2048,
    };
    const fgValidEval = evaluateKnobRecipe(fgDecodeCtx, fgValidSel);
    expect(fgValidEval.blockers).toHaveLength(0);
    expect(fgValidEval.cliArgs.join(" ")).toContain("PreemptOffloadConnector");

    const fgCapSel = { ...fgValidSel, cli_max_num_seqs: 1024 };
    const fgCapEval = evaluateKnobRecipe(fgDecodeCtx, fgCapSel);
    expect(fgCapEval.silentResets.some((s) => s.id === "rule-finegrained-tp-capture-bound-reset")).toBe(true);
    expect(fgCapEval.activeKnobs.find((k) => k.spec.id === "cfg_finegrained_tp_oproj")?.effectiveValue).toBe(
      1,
    );
    assertFixActionResolvesFinding(fgDecodeCtx, fgCapSel, "rule-finegrained-tp-capture-bound-reset");

    // P1-1 (v0.30.0 >0 vs >1 split): oproj/mlp=1 checks MoE & recompute_scheduler, while >1 additionally checks PreemptOffloadConnector
    for (const modelKind of ["dense", "moe"] as const) {
      const fV030One = assertFixActionResolvesFinding(
        { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0", modelKind, tpSize: 1, dpSize: 4, pdRole: "decode" },
        { cfg_finegrained_tp_oproj: 1 },
        "rule-finegrained-tp-preconditions",
      );
      const fixedV030One = applyKnobFixAction(
        { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0", modelKind, tpSize: 1, dpSize: 4, pdRole: "decode" },
        { cfg_finegrained_tp_oproj: 1 },
        fV030One.fixAction!,
      );
      expect(fixedV030One.selections.cfg_finegrained_tp_oproj).toBe(0);
    }
    expect(
      evaluateKnobRecipe(
        {
          ...DEFAULT_SANDBOX_CONTEXT,
          version: "v0.30.0",
          modelKind: "moe",
          tpSize: 1,
          dpSize: 2,
          pdRole: "decode",
        },
        { cfg_finegrained_tp_oproj: 1, cfg_finegrained_tp_mlp: 1, cfg_recompute_scheduler: true },
      ).findings,
    ).toHaveLength(0);
    const negOprojEval = evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, { cfg_finegrained_tp_oproj: -1 });
    expect(
      negOprojEval.blockers.some((b) => b.id === "rule-invalid-number-knob-cfg_finegrained_tp_oproj"),
    ).toBe(true);
    expect(negOprojEval.additionalConfigObj.finegrained_tp_config).toBeUndefined();
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_finegrained_tp_oproj: -1 },
      "rule-invalid-number-knob-cfg_finegrained_tp_oproj",
    );

    // P1-2: qkv_iproj_tensor_parallel_size > 1 blocks on ALL non-glm5_next sandbox presets even with TP=1+Decode
    expect(
      evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, version: "main", modelKind: "dense" },
        { cfg_finegrained_tp_oproj: 1, cfg_finegrained_tp_mlp: 1, cfg_finegrained_tp_qkv_iproj: 1 },
      ).blockers,
    ).toHaveLength(0);
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0" },
      { cfg_finegrained_tp_qkv_iproj: 2, cfg_gdn_internal_prefill_checkpoints: true },
      "rule-version-mismatch-main-only",
    );
    assertFixActionResolvesFinding(
      {
        ...DEFAULT_SANDBOX_CONTEXT,
        version: "main",
        modelKind: "mla_moe",
        tpSize: 1,
        dpSize: 4,
        ppSize: 1,
        pdRole: "decode",
      },
      { cfg_finegrained_tp_qkv_iproj: 2 },
      "rule-finegrained-tp-qkv-iproj-preconditions",
    );

    // P1-3 & P2-4: sparse_kv_offload_config requires index_topk without compress_ratios (only mla_moe -> DeepSeek-V3.2-Exp)
    for (const unsupportedModel of ["dense", "moe", "engram_moe"] as const) {
      assertFixActionResolvesFinding(
        { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: unsupportedModel, pdRole: "decode", ppSize: 1 },
        { cfg_sparse_kv_offload_enabled: true },
        "rule-sparse-kv-offload-constraints",
      );
    }
    const sparseValidEval = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "mla_moe", pdRole: "decode", ppSize: 1 },
      { cfg_sparse_kv_offload_enabled: true, cfg_sparse_kv_offload_topk_buffer_size: 4096 },
    );
    expect(sparseValidEval.blockers).toHaveLength(0);
    expect(sparseValidEval.shellCommand).toContain("deepseek-ai/DeepSeek-V3.2-Exp");
    for (const hexOrSci of ["0x1", "1e0"] as const) {
      const badStrEval = evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, { cfg_finegrained_tp_oproj: hexOrSci });
      expect(
        badStrEval.blockers.some((b) => b.id === "rule-invalid-number-knob-cfg_finegrained_tp_oproj"),
      ).toBe(true);
      expect(badStrEval.additionalConfigObj.finegrained_tp_config).toBeUndefined();
    }
    for (const nonA3Soc of ["A2", "310P", "A5"] as const) {
      const nonA3Eval = evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, soc: nonA3Soc, modelKind: "mla_moe", pdRole: "decode", ppSize: 1 },
        { cfg_sparse_kv_offload_enabled: true },
      );
      expect(nonA3Eval.blockers.some((b) => b.id === "rule-sparse-kv-offload-constraints")).toBe(true);
      expect(nonA3Eval.shellCommand).not.toContain("deepseek-ai/DeepSeek-V3.2-Exp");
    }
    for (const badMainKvDtype of ["turboquant_4bit_nc", "int8"] as const) {
      const kvConflictEval = evaluateKnobRecipe(
        {
          ...DEFAULT_SANDBOX_CONTEXT,
          version: "v0.30.0",
          soc: "A3",
          modelKind: "mla_moe",
          pdRole: "decode",
          ppSize: 1,
        },
        {
          cfg_sparse_kv_offload_enabled: true,
          cli_kv_cache_dtype: badMainKvDtype,
          ...(badMainKvDtype === "turboquant_4bit_nc"
            ? { env_vllm_use_v2_model_runner: "1" }
            : { cli_quantization: "ascend" }),
        },
      );
      expect(kvConflictEval.blockers.some((b) => b.id === "rule-sparse-kv-offload-constraints")).toBe(true);
      expect(kvConflictEval.shellCommand).not.toContain("deepseek-ai/DeepSeek-V3.2-Exp");
    }
    for (const disabledBuf of [2049, 1024] as const) {
      const disabledSparseEval = evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "mla_moe", pdRole: "decode", ppSize: 1 },
        { cfg_sparse_kv_offload_enabled: false, cfg_sparse_kv_offload_topk_buffer_size: disabledBuf },
      );
      expect(disabledSparseEval.blockers).toHaveLength(0);
      expect(disabledSparseEval.additionalConfigObj.sparse_kv_offload_config).toEqual({
        enabled: false,
        topk_buffer_size: disabledBuf,
      });
    }
    const nonDivTopkEval = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "mla_moe", pdRole: "decode", ppSize: 1 },
      { cfg_sparse_kv_offload_enabled: true, cfg_sparse_kv_offload_topk_buffer_size: 2049 },
    );
    expect(nonDivTopkEval.blockers.some((b) => b.id === "rule-sparse-kv-topk-buffer-size-invalid")).toBe(
      true,
    );
    expect(nonDivTopkEval.additionalConfigObj.sparse_kv_offload_config).toEqual({ enabled: true });
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "mla_moe", pdRole: "decode", ppSize: 1 },
      { cfg_sparse_kv_offload_enabled: true, cfg_sparse_kv_offload_topk_buffer_size: 2049 },
      "rule-sparse-kv-topk-buffer-size-invalid",
    );
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "mla_moe", pdRole: "decode", ppSize: 1 },
      { cfg_sparse_kv_offload_enabled: true, cfg_sparse_kv_offload_topk_buffer_size: 1024 },
      "rule-sparse-kv-topk-buffer-size-invalid",
    );
    expect(
      evaluateKnobRecipe(
        { ...DEFAULT_SANDBOX_CONTEXT, modelKind: "moe" },
        { cfg_enable_fused_mc2: 1, env_hccl_buffsize: 48 },
      ).shellCommand,
    ).toContain("vllm serve Qwen/Qwen3-235B-A22B");
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A3", modelKind: "mla_moe", pdRole: "none", ppSize: 1 },
      { cfg_sparse_kv_offload_enabled: true, cfg_sparse_kv_offload_keep_device_kv_cache: true },
      "rule-sparse-kv-keep-device-debug-only",
    );

    // P2-3: valid upstream VLLM_LOGGING_LEVEL ERROR/CRITICAL/WARN are accepted with zero blockers
    expect(
      evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, { env_vllm_logging_level: "ERROR" }).blockers,
    ).toHaveLength(0);
    expect(
      evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, { env_vllm_logging_level: "CRITICAL" }).blockers,
    ).toHaveLength(0);

    // P2-4: ECMemcache recv_buffer_tokens bounds [2048, max_num_batched_tokens]
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cli_ec_recv_buffer_tokens: 1024, cli_max_num_batched_tokens: 4096 },
      "rule-ec-recv-buffer-tokens-out-of-range",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cli_ec_recv_buffer_tokens: 8192, cli_max_num_batched_tokens: 2048 },
      "rule-ec-recv-buffer-tokens-out-of-range",
    );
    expect(
      evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, {
        cli_ec_recv_buffer_tokens: 2048,
        cli_max_num_batched_tokens: 4096,
      }).cliArgs.join(" "),
    ).toContain('"recv_buffer_tokens":2048');

    // P2-3: Invalid programmatic enum values are blocked, stripped, and cleanly fixed
    const invalidEnumEval = evaluateKnobRecipe(DEFAULT_SANDBOX_CONTEXT, {
      cfg_enable_fused_mc2: 99,
      cfg_weight_nz_mode: 9,
    });
    expect(invalidEnumEval.additionalConfigObj.enable_fused_mc2).toBeUndefined();
    expect(invalidEnumEval.additionalConfigObj.weight_nz_mode).toBeUndefined();
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_enable_fused_mc2: 99 },
      "rule-invalid-enum-knob-cfg_enable_fused_mc2",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { cfg_weight_nz_mode: 9 },
      "rule-invalid-enum-knob-cfg_weight_nz_mode",
    );

    // kvpp, RL cleanup, gmmswigluquant, retired envs, use_layerwise, norm_quant synergy
    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, tpSize: 4, pdRole: "decode", graphMode: "FULL_DECODE_ONLY" },
      { cfg_enable_kvpp: true },
      "rule-kvpp-constraints-blocker",
    );

    const rlExtraFix = assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, sleepMode: false },
      { cfg_rl_sleep_mode_extra_cleanup: true },
      "rule-rl-extra-cleanup-needs-rl-enabled",
    );
    const fixedRlExtra = applyKnobFixAction(
      { ...DEFAULT_SANDBOX_CONTEXT, sleepMode: false },
      { cfg_rl_sleep_mode_extra_cleanup: true },
      rlExtraFix.fixAction!,
    );
    const afterRlExtra = evaluateKnobRecipe(fixedRlExtra.context, fixedRlExtra.selections);
    expect(afterRlExtra.blockers).toHaveLength(0);
    expect(afterRlExtra.silentResets).toHaveLength(0);

    assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, modelKind: "mla_moe" },
      { cfg_fusion_ops_gmmswigluquant: false, cli_quantization: "ascend" },
      "rule-gmmswigluquant-disabled-int32-trap",
    );
    assertFixActionResolvesFinding(
      DEFAULT_SANDBOX_CONTEXT,
      { env_retired_enable_matmul_allreduce: "1" },
      "rule-retired-env-VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE",
    );
    const balPdFix = assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, pdRole: "decode" },
      { env_retired_balance_scheduling: "1" },
      "rule-retired-env-VLLM_ASCEND_BALANCE_SCHEDULING",
    );
    const fixedBalPd = applyKnobFixAction(
      { ...DEFAULT_SANDBOX_CONTEXT, pdRole: "decode" },
      { env_retired_balance_scheduling: "1" },
      balPdFix.fixAction!,
    );
    expect(evaluateKnobRecipe(fixedBalPd.context, fixedBalPd.selections).blockers).toHaveLength(0);

    const layerwiseV030 = assertFixActionResolvesFinding(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "v0.30.0", pdRole: "decode" },
      { cli_kv_transfer_use_layerwise: true },
      "rule-v030-mooncake-v2-ignores-use-layerwise",
    );
    expect(layerwiseV030.severity).toBe("silent-reset");
    const layerwiseMain = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, version: "main", pdRole: "decode" },
      { cli_kv_transfer_use_layerwise: true },
    );
    expect(layerwiseMain.blockers).toHaveLength(0);
    expect(layerwiseMain.cliArgs.join(" ")).toContain('"use_layerwise":true');

    const normSyn = evaluateKnobRecipe(
      { ...DEFAULT_SANDBOX_CONTEXT, soc: "A2", modelKind: "dense" },
      { cfg_fuse_norm_quant: true, cli_quantization: "ascend" },
    ).synergies.find((s) => s.id === "synergy-fuse-norm-quant");
    expect(normSyn?.detail).toContain("W4A4_DYNAMIC");

    // Exact Pydantic v2 lax int/bool/float & CLI int & upstream CacheDType parity
    const a3DecodeCtx = {
      ...DEFAULT_SANDBOX_CONTEXT,
      version: "main" as const,
      soc: "A3" as const,
      modelKind: "mla_moe" as const,
      pdRole: "decode" as const,
    };
    assertFixActionResolvesFinding(
      a3DecodeCtx,
      { cfg_eplb_stair_rank_transfer_limit: "1." },
      "rule-stair-config-invalid-range",
    );
    const rank10Res = evaluateKnobRecipe(a3DecodeCtx, { cfg_eplb_stair_rank_transfer_limit: "1.0" });
    expect(rank10Res.blockers).toHaveLength(0);
    expect(
      (
        (rank10Res.additionalConfigObj.eplb_config as Record<string, unknown>)?.stair_config as Record<
          string,
          unknown
        >
      )?.rank_transfer_limit,
    ).toBe(1);

    const oproj10Res = evaluateKnobRecipe(a3DecodeCtx, { cfg_finegrained_tp_oproj: "1.0" });
    expect(oproj10Res.blockers).toHaveLength(0);
    expect(
      (oproj10Res.additionalConfigObj.finegrained_tp_config as Record<string, unknown>)
        ?.oproj_tensor_parallel_size,
    ).toBe(1);

    assertFixActionResolvesFinding(
      a3DecodeCtx,
      { cli_ec_recv_buffer_tokens: "2048." },
      "rule-ec-recv-buffer-tokens-out-of-range",
    );
    const badBoolRes = evaluateKnobRecipe(a3DecodeCtx, { cfg_sparse_kv_offload_enabled: 2 });
    expect(
      badBoolRes.blockers.some((b) => b.id === "rule-invalid-bool-knob-cfg_sparse_kv_offload_enabled"),
    ).toBe(true);
    expect(badBoolRes.additionalConfigObj.sparse_kv_offload_config).toBeUndefined();

    expect(evaluateKnobRecipe(a3DecodeCtx, { cli_gpu_memory_utilization: "9e-1" }).blockers).toHaveLength(0);

    for (const badKvDtype of [
      "fp8_e4m3",
      "mxfp8",
      "fp8_e5m2",
      "octave_k3v4",
      "octave_k3v3",
      "octave_k3v3_compact",
      "ultraquant_4bit",
      " bfloat16 ",
    ] as const) {
      const kvSparseRes = evaluateKnobRecipe(a3DecodeCtx, {
        cfg_sparse_kv_offload_enabled: true,
        cli_kv_cache_dtype: badKvDtype,
      });
      expect(kvSparseRes.blockers.some((b) => b.id === "rule-sparse-kv-offload-constraints")).toBe(true);
      expect(kvSparseRes.shellCommand).not.toContain("deepseek-ai/DeepSeek-V3.2-Exp");
      expect(kvSparseRes.cliArgs.join(" ")).not.toContain("' bfloat16 '");
      if (badKvDtype !== "fp8_e4m3" && badKvDtype !== "mxfp8") {
        expect(kvSparseRes.cliArgs.join(" ")).not.toContain("--kv-cache-dtype");
      }
    }

    // pdRole=none with invalid cli_kv_transfer_use_layerwise / cli_kv_transfer_connector strips cleanly without emitting --kv-transfer-config
    for (const badKvTransfer of [
      { cli_kv_transfer_use_layerwise: " true " },
      { cli_kv_transfer_use_layerwise: 2 },
      { cli_kv_transfer_connector: " PreemptOffloadConnector " },
    ] as const) {
      const kvTrRes = evaluateKnobRecipe({ ...a3DecodeCtx, pdRole: "none" }, badKvTransfer);
      expect(kvTrRes.blockers.length).toBeGreaterThan(0);
      expect(kvTrRes.cliArgs.join(" ")).not.toContain("--kv-transfer-config");
    }

    // --max-num-batched-tokens 64 alone clamps default max_num_seqs=min(128,64)=64 with 0 blockers
    expect(evaluateKnobRecipe(a3DecodeCtx, { cli_max_num_batched_tokens: 64 }).blockers).toHaveLength(0);

    // Python CLI Unicode Nd digits ("８K", "１２８", "０.９") pass on CLI while Pydantic rejects "１０"
    const cliNdRes = evaluateKnobRecipe(a3DecodeCtx, {
      cli_max_num_batched_tokens: "８K",
      cli_max_num_seqs: "１２８",
      cli_gpu_memory_utilization: "０.９",
      cli_ec_recv_buffer_tokens: 8192,
    });
    expect(cliNdRes.blockers).toHaveLength(0);
    expect(cliNdRes.cliArgs.join(" ")).toContain("--max-num-batched-tokens 8K");
    expect(cliNdRes.cliArgs.join(" ")).toContain("--max-num-seqs 128");
    expect(cliNdRes.cliArgs.join(" ")).toContain("--gpu-memory-utilization 0.9");
    expect(
      evaluateKnobRecipe(a3DecodeCtx, { cfg_eplb_stair_rank_transfer_limit: "１０" }).blockers.some(
        (b) => b.id === "rule-stair-config-invalid-range",
      ),
    ).toBe(true);

    // SharedEngramConfig & QuantizedAllReduceConfig inner validators, A2 remote Engram DP>1, and main effective MRv2
    assertFixActionResolvesFinding(
      a3DecodeCtx,
      { cfg_shared_engram: '{"backend":"a3","endpoint":"localhost"}' },
      "rule-invalid-json-knob-cfg_shared_engram",
    );
    assertFixActionResolvesFinding(
      { ...a3DecodeCtx, modelKind: "engram_moe" },
      { cfg_shared_engram: '{"backend":"a3","endpoint":"owner:29500","capacity":"65536"}' },
      "rule-invalid-json-knob-cfg_shared_engram",
    );
    expect(
      evaluateKnobRecipe(
        { ...a3DecodeCtx, modelKind: "engram_moe", tpSize: 8 },
        { cfg_shared_engram: '{"backend":"a3","endpoint":"owner:29500","capacity":65536}' },
      ).blockers,
    ).toHaveLength(0);
    assertFixActionResolvesFinding(
      { ...a3DecodeCtx, soc: "A2" },
      { cfg_quantized_all_reduce_config: '{"enable":false,"min_numel":0}' },
      "rule-invalid-json-knob-cfg_quantized_all_reduce_config",
    );
    assertFixActionResolvesFinding(
      { ...a3DecodeCtx, soc: "A2" },
      { cfg_quantized_all_reduce_config: '{"min_numel":"\\uFEFF1"}' },
      "rule-invalid-json-knob-cfg_quantized_all_reduce_config",
    );
    expect(
      evaluateKnobRecipe(
        { ...a3DecodeCtx, soc: "A2" },
        { cfg_quantized_all_reduce_config: '{"min_numel":true}' },
      ).blockers,
    ).toHaveLength(0);
    for (const validMinNumel of ["9007199254740993", "0__128", "0_0__128"] as const) {
      const qarBig = evaluateKnobRecipe(
        { ...a3DecodeCtx, soc: "A2", modelKind: "dense", tpSize: 2, epEnabled: false },
        { cfg_quantized_all_reduce_config: JSON.stringify({ enable: true, min_numel: validMinNumel }) },
      );
      expect(qarBig.blockers).toHaveLength(0);
    }
    for (const rawJsonInt of ["9007199254740993", "1000000000000000000000"] as const) {
      const rawJsonPayload = `{"enable":true,"min_numel":${rawJsonInt}}`;
      const qarUnquoted = evaluateKnobRecipe(
        { ...a3DecodeCtx, soc: "A2", modelKind: "dense", tpSize: 2, epEnabled: false },
        { cfg_quantized_all_reduce_config: rawJsonPayload },
      );
      expect(qarUnquoted.blockers).toHaveLength(0);
      expect(qarUnquoted.shellCommand).toContain(`"min_numel":${rawJsonInt}`);
      expect(JSON.stringify(qarUnquoted.additionalConfigObj)).toContain(`"min_numel":${rawJsonInt}`);
    }
    assertFixActionResolvesFinding(
      { ...a3DecodeCtx, soc: "A2", modelKind: "dense", tpSize: 2, epEnabled: false },
      { cfg_quantized_all_reduce_config: '{"enable":true,"min_numel":1e21}' },
      "rule-invalid-json-knob-cfg_quantized_all_reduce_config",
    );

    const engramPreset = KNOB_RECIPE_PRESETS.find((p) => p.id === "preset-deepseek-engram-multistream")!;
    const unsetMrv2Selections = { ...engramPreset.selections };
    delete unsetMrv2Selections.env_vllm_use_v2_model_runner;
    expect(evaluateKnobRecipe(engramPreset.context, unsetMrv2Selections).blockers).toHaveLength(0);

    const a2RemoteEngramSel = {
      ...engramPreset.selections,
      cfg_shared_engram: '{"backend":"a2","endpoint":"127.0.0.1:50051","capacity":65536}',
      cli_shutdown_timeout: 120,
    };
    assertFixActionResolvesFinding(
      { ...engramPreset.context, soc: "A2", dpSize: 1 },
      a2RemoteEngramSel,
      "rule-shared-engram-constraints",
    );
    expect(
      evaluateKnobRecipe({ ...engramPreset.context, soc: "A2", dpSize: 2 }, a2RemoteEngramSel).blockers,
    ).toHaveLength(0);

    // Underscore numeric literals, human_readable_int ("8K"), strict bool whitespace, all 37 bool knobs x 2 versions, and scheduler bounds
    const rank10Underscore = evaluateKnobRecipe(a3DecodeCtx, { cfg_eplb_stair_rank_transfer_limit: "1_0" });
    expect(rank10Underscore.blockers).toHaveLength(0);
    expect(
      (
        (rank10Underscore.additionalConfigObj.eplb_config as Record<string, unknown>)?.stair_config as Record<
          string,
          unknown
        >
      )?.rank_transfer_limit,
    ).toBe(10);

    const batched8K = evaluateKnobRecipe(a3DecodeCtx, {
      cli_max_num_batched_tokens: "8K",
      cli_ec_recv_buffer_tokens: 8192,
      cli_gpu_memory_utilization: "0.9_0",
    });
    expect(batched8K.blockers).toHaveLength(0);

    assertFixActionResolvesFinding(
      a3DecodeCtx,
      { cli_max_num_seqs: 0 },
      "rule-invalid-number-knob-cli_max_num_seqs",
    );
    assertFixActionResolvesFinding(
      a3DecodeCtx,
      { cli_max_num_batched_tokens: 0 },
      "rule-invalid-number-knob-cli_max_num_batched_tokens",
    );
    assertFixActionResolvesFinding(
      a3DecodeCtx,
      { cli_max_num_batched_tokens: 256, cli_max_num_seqs: 512 },
      "rule-scheduler-batched-tokens-lt-max-seqs",
    );
    assertFixActionResolvesFinding(
      a3DecodeCtx,
      {
        cli_max_num_batched_tokens: "10000000000000000000",
        cli_max_num_seqs: "20000000000000000000",
      },
      "rule-scheduler-batched-tokens-lt-max-seqs",
    );

    const exactLargeMultipleOf128 = evaluateKnobRecipe(a3DecodeCtx, {
      cfg_sparse_kv_offload_enabled: true,
      cfg_sparse_kv_offload_topk_buffer_size: "9007199254741120",
    });
    expect(exactLargeMultipleOf128.blockers).toHaveLength(0);
    expect(exactLargeMultipleOf128.shellCommand).toContain("9007199254741120");

    // GPT-Signoff-14 P2-1: scientific float literal 1.0000000000000001e18 preserves exact token on export
    // so upstream re-parse reads 1000000000000000128 (never mutated to 1000000000000000100)
    const mainA2DenseCtx: KnobSandboxContext = {
      ...a3DecodeCtx,
      version: "main",
      soc: "A2",
      modelKind: "dense",
      tpSize: 2,
      pdRole: "none",
    };
    const sciFloatRes = evaluateKnobRecipe(mainA2DenseCtx, {
      cfg_quantized_all_reduce_config: '{"min_numel":1.0000000000000001e18}',
    });
    expect(sciFloatRes.blockers).toHaveLength(0);
    expect(sciFloatRes.shellCommand).toContain('"min_numel":1.0000000000000001e18');
    const exportedQuantArJson =
      sciFloatRes.shellCommand.match(/"quantized_all_reduce_config":(\{[^}]+\})/)?.[1] ?? "";
    const reEvalSci = evaluateKnobRecipe(mainA2DenseCtx, {
      cfg_quantized_all_reduce_config: exportedQuantArJson,
    });
    expect(reEvalSci.blockers).toHaveLength(0);
    expect(reEvalSci.shellCommand).toContain("1.0000000000000001e18");

    // GPT-Signoff-14 P2-3: user-supplied plain object {"__exactJsonInt":"128"} cannot spoof internal number token
    const spoofObjRes = evaluateKnobRecipe(mainA2DenseCtx, {
      cfg_quantized_all_reduce_config: '{"min_numel":{"__exactJsonInt":"128"}}',
    });
    expect(
      spoofObjRes.blockers.some((b) => b.id === "rule-invalid-json-knob-cfg_quantized_all_reduce_config"),
    ).toBe(true);
    expect(spoofObjRes.shellCommand).not.toContain("__exactJsonInt");

    // GPT-Signoff-14 P2-4: lossless export of unquoted large integers & EC recv_buffer_tokens even without JSON.rawJSON
    const jsonBag = JSON as unknown as Record<string, unknown>;
    const origRawJson = jsonBag.rawJSON;
    try {
      delete jsonBag.rawJSON;
      const noRawRes = evaluateKnobRecipe(mainA2DenseCtx, {
        cfg_quantized_all_reduce_config: '{"min_numel":9007199254740993}',
        cli_max_num_batched_tokens: "9007199254740993",
        cli_ec_recv_buffer_tokens: "9007199254740993",
      });
      expect(noRawRes.blockers).toHaveLength(0);
      expect(noRawRes.shellCommand).toContain('"min_numel":9007199254740993');
      expect(noRawRes.shellCommand).not.toContain("9007199254740992");
      expect(noRawRes.shellCommand).toContain('"recv_buffer_tokens":9007199254740993}');
      expect(noRawRes.shellCommand).not.toContain('"recv_buffer_tokens":"9007199254740993"');
    } finally {
      if (origRawJson !== undefined) {
        jsonBag.rawJSON = origRawJson;
      }
    }

    // GPT-Signoff-15 P2-2: A3 Shared Engram accepts 65536, 65536.0, and 6.5536e4 while rejecting "65536"
    const mainA3EngramCtx: KnobSandboxContext = {
      ...a3DecodeCtx,
      version: "main",
      soc: "A3",
      modelKind: "engram_moe",
      tpSize: 8,
      ppSize: 1,
      sleepMode: false,
    };
    for (const validCap of ["65536", "65536.0", "6.5536e4"]) {
      const okCap = evaluateKnobRecipe(mainA3EngramCtx, {
        cfg_shared_engram: `{"backend":"a3","endpoint":"localhost:50051","capacity":${validCap}}`,
      });
      expect(okCap.blockers, `A3 capacity=${validCap} accepted`).toHaveLength(0);
    }
    const strCap = evaluateKnobRecipe(mainA3EngramCtx, {
      cfg_shared_engram: '{"backend":"a3","endpoint":"localhost:50051","capacity":"65536"}',
    });
    expect(strCap.blockers.some((b) => b.id === "rule-invalid-json-knob-cfg_shared_engram")).toBe(true);

    // GPT-Signoff-15 P2-3: quantized_all_reduce_config accepts {"enable":-0} as False
    const negZeroEn = evaluateKnobRecipe(mainA2DenseCtx, {
      cfg_quantized_all_reduce_config: '{"enable":-0}',
    });
    expect(negZeroEn.blockers).toHaveLength(0);

    // GPT-Signoff-15 P2-4 & GPT-Signoff-16 P2-1/P3-2: VLLM_ASCEND_ENABLE_FLASHCOMM1 accepts whitespace-padded bool tokens and scheduler ref points to #L309-L315
    for (const v of ["1", "true", "TRUE", "0", "false", " TRUE ", " 1 ", " false "] as const) {
      const fcRes = evaluateKnobRecipe(mainA2DenseCtx, { env_enable_flashcomm1: v });
      expect(fcRes.blockers, `flashcomm1=${v}`).toHaveLength(0);
      expect(fcRes.shellCommand).toContain("export VLLM_ASCEND_ENABLE_FLASHCOMM1=");
    }
    const fcOverrideWhitespace = evaluateKnobRecipe(mainA2DenseCtx, {
      cfg_enable_flashcomm1: false,
      env_enable_flashcomm1: " TRUE ",
    });
    expect(fcOverrideWhitespace.silentResets.some((f) => f.id === "rule-env-flashcomm1-overrides-json")).toBe(
      true,
    );
    const schedBlocker = evaluateKnobRecipe(a3DecodeCtx, {
      cli_max_num_batched_tokens: 128,
      cli_max_num_seqs: 256,
    });
    expect(
      schedBlocker.blockers.find((b) => b.id === "rule-scheduler-batched-tokens-lt-max-seqs")?.sources,
    ).toEqual(["vllm@ced6857a:vllm/config/scheduler.py#L309-L315"]);

    const spaceBoolRes = evaluateKnobRecipe(a3DecodeCtx, { cfg_sparse_kv_offload_enabled: " true " });
    expect(
      spaceBoolRes.blockers.some((b) => b.id === "rule-invalid-bool-knob-cfg_sparse_kv_offload_enabled"),
    ).toBe(true);
    expect(spaceBoolRes.additionalConfigObj.sparse_kv_offload_config).toBeUndefined();

    const boolSpecs = ASCEND_KNOB_CATALOG.filter((k) => k.valueType === "bool");
    for (const version of ["v0.30.0", "main"] as const) {
      for (const spec of boolSpecs) {
        const f = assertFixActionResolvesFinding(
          { ...a3DecodeCtx, version },
          { [spec.id]: 2 },
          `rule-invalid-bool-knob-${spec.id}`,
        );
        expect(f.severity).toBe("blocker");
      }
    }
  });
});
