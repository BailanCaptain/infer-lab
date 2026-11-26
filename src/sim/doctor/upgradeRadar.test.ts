import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSourceRef, type RuleVersion } from "../rules/types";
import { parseVllmServeCommand } from "./cliParser";
import {
  analyzePdUpgradeRadar,
  analyzeSingleUpgradeRadar,
  LEGACY_V023_MIGRATION_SAMPLE_CMD,
  UPGRADE_RADAR_COMMITS,
  UPGRADE_RADAR_HONEST_BOUNDARY_NOTE,
} from "./upgradeRadar";

describe("upgradeRadar deterministic version migration shockwave engine", () => {
  it("preserves sim-layer purity and never pollutes RuleVersion with legacy versions", () => {
    const src = readFileSync(resolve(__dirname, "upgradeRadar.ts"), "utf-8");
    expect(src).not.toMatch(/from\s+["']react/);
    expect(src).not.toMatch(/from\s+["']zustand/);
    expect(src).not.toMatch(/from\s+["'](?:\.\.\/)+(?:app|content)\//);

    const validRuleVersions: readonly RuleVersion[] = ["v0.30.0", "main", "rfork"];
    expect(validRuleVersions).not.toContain("v0.23.0");
    expect(validRuleVersions).not.toContain("v0.26.0rc");
    expect(UPGRADE_RADAR_COMMITS).toEqual({
      "v0.23.0": "2c59ff10",
      "v0.26.0rc": "2ed6cbba",
      "v0.30.0": "c09d3e20",
      main: "8d6180e2",
    });
  });

  it("triggers all 4 shockwave categories on LEGACY_V023_MIGRATION_SAMPLE_CMD with valid source refs", () => {
    for (const fromVersion of ["v0.23.0", "v0.26.0rc"] as const) {
      for (const toVersion of ["v0.30.0", "main"] as const) {
        const report = analyzeSingleUpgradeRadar(LEGACY_V023_MIGRATION_SAMPLE_CMD, {
          fromVersion,
          toVersion,
        });
        expect(report.fromCommit).toBe(UPGRADE_RADAR_COMMITS[fromVersion]);
        expect(report.toCommit).toBe(UPGRADE_RADAR_COMMITS[toVersion]);
        expect(report.hasBreakingErrors).toBe(true);
        expect(report.counts.breakingError).toBeGreaterThanOrEqual(1);
        expect(report.counts.silentNoop).toBeGreaterThanOrEqual(2);
        expect(report.counts.behaviorChanged).toBeGreaterThanOrEqual(2);
        expect(report.counts.legacyCounterproductive).toBe(1);

        for (const item of report.items) {
          expect(item.sources.length).toBeGreaterThan(0);
          for (const ref of item.sources) {
            expect(parseSourceRef(ref)).not.toBeNull();
          }
        }
      }
    }
  });

  it("detects breaking-error for removed keys, main-only removals, and unknown/misspelled keys with vllm_omni note", () => {
    const cmdRemoved = `vllm serve Qwen/Qwen3-8B --additional-config '{"weight_prefetch_config":{"enabled":true},"layer_sharding":["o_proj"],"enable_reduce_sample":true,"typo_unknown_switch":1,"ascend_compilation_config":{"fuse_allreduce_rms":true}}'`;
    const r030 = analyzeSingleUpgradeRadar(cmdRemoved, {
      fromVersion: "v0.23.0",
      toVersion: "v0.30.0",
    });
    const ids030 = r030.items.map((i) => i.id);
    expect(ids030).toContain("radar-removed-key-weight-prefetch-config");
    expect(ids030).toContain("radar-removed-key-layer-sharding");
    expect(ids030).toContain("radar-removed-key-enable-reduce-sample");
    expect(ids030).toContain("radar-unknown-top-key-typo_unknown_switch");
    expect(ids030).toContain("radar-unknown-subkey-ascend_compilation_config-fuse_allreduce_rms");
    for (const item of r030.items) {
      expect(item.severity).toBe("breaking-error");
      expect(item.targetBehavior).toContain("vllm_omni");
    }

    // dynamic_spec_config & top-level profiling_chunk_config: allowed / behavior-changed on v0.30.0, breaking-error on main
    const cmdMainDiff = `vllm serve Qwen/Qwen3-8B -pp 2 --additional-config '{"dynamic_spec_config":{"method":"dspark"},"profiling_chunk_config":{"enabled":true}}'`;
    const onV030 = analyzeSingleUpgradeRadar(cmdMainDiff, {
      fromVersion: "v0.26.0rc",
      toVersion: "v0.30.0",
    });
    expect(onV030.counts.breakingError).toBe(0);
    expect(onV030.items.map((i) => i.id)).toContain("radar-scheduler-top-level-profiling_chunk_config");

    const onMain = analyzeSingleUpgradeRadar(cmdMainDiff, {
      fromVersion: "v0.26.0rc",
      toVersion: "main",
    });
    expect(onMain.counts.breakingError).toBe(2);
    expect(onMain.items.map((i) => i.id)).toContain("radar-removed-key-dynamic-spec-config");
    expect(onMain.items.map((i) => i.id)).toContain("radar-removed-key-profiling-chunk-config-main");
  });

  it("detects all 9 retired 0-read environment variables as silent-noop with concrete replacements", () => {
    const envBlock = [
      "export VLLM_ASCEND_ENABLE_NZ=0",
      "export VLLM_ASCEND_ENABLE_MLAPO=0",
      "export VLLM_ASCEND_ENABLE_FUSED_MC2=1",
      "export MSMONITOR_USE_DAEMON=1",
      "export VLLM_ASCEND_BALANCE_SCHEDULING=1",
      "export VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK=0",
      "export VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE=1",
      "export VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE=2",
      "export VLLM_ASCEND_MLA_FIA_SPLIT=1",
      'vllm serve Qwen/Qwen3-8B --compilation-config \'{"cudagraph_mode":"FULL_DECODE_ONLY"}\'',
    ].join("\n");

    const rep = analyzeSingleUpgradeRadar(envBlock, {
      fromVersion: "v0.26.0rc",
      toVersion: "v0.30.0",
    });
    expect(rep.counts.silentNoop).toBe(9);
    expect(rep.counts.breakingError).toBe(0);
    const nzItem = rep.items.find((i) => i.subject === "VLLM_ASCEND_ENABLE_NZ");
    expect(nzItem?.remediation).toContain('"weight_nz_mode": 0');
    const mlapoItem = rep.items.find((i) => i.subject === "VLLM_ASCEND_ENABLE_MLAPO");
    expect(mlapoItem?.remediation).toContain('"enable_mlapo": false');
    const fiaItem = rep.items.find((i) => i.subject === "VLLM_ASCEND_MLA_FIA_SPLIT");
    expect(fiaItem?.legacyBehavior).toContain("2ed6cbba");
  });

  it("detects FlashComm1 precedence flip and legacy top-level scheduler migration as behavior-changed", () => {
    const flipCmd = `VLLM_ASCEND_ENABLE_FLASHCOMM1=1 vllm serve Qwen/Qwen3-30B-A3B -tp 4 --enable-expert-parallel --additional-config '{"enable_flashcomm1":false,"recompute_scheduler_enable":true,"scheduler_config":{"recompute_scheduler_enable":false}}'`;
    const rep = analyzeSingleUpgradeRadar(flipCmd, {
      fromVersion: "v0.23.0",
      toVersion: "v0.30.0",
    });
    const fc1 = rep.items.find((i) => i.id === "radar-flashcomm1-precedence-inversion");
    expect(fc1?.severity).toBe("behavior-changed");
    expect(fc1?.legacyBehavior).toContain("2c59ff10");
    expect(fc1?.targetBehavior).toContain("逻辑或");

    const sched = rep.items.find((i) => i.id === "radar-scheduler-top-level-recompute_scheduler_enable");
    expect(sched?.severity).toBe("behavior-changed");
    expect(sched?.title).toContain("覆盖忽略");

    // No precedence inversion when JSON enable_flashcomm1 is true
    const alignedCmd = `VLLM_ASCEND_ENABLE_FLASHCOMM1=1 vllm serve Qwen/Qwen3-8B --additional-config '{"enable_flashcomm1":true}'`;
    const alignedRep = analyzeSingleUpgradeRadar(alignedCmd, {
      fromVersion: "v0.23.0",
      toVersion: "v0.30.0",
    });
    expect(alignedRep.items.find((i) => i.id === "radar-flashcomm1-precedence-inversion")).toBeUndefined();
  });

  it("detects --enforce-eager and cudagraph_mode=NONE as legacy-counterproductive, supports P/D scopes, and reports honest boundary on clean commands", () => {
    const pdRep = analyzePdUpgradeRadar(
      `vllm serve Qwen/Qwen3-30B-A3B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer"}' --additional-config '{"layer_sharding":["o_proj"]}'`,
      `vllm serve Qwen/Qwen3-30B-A3B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer"}' --compilation-config '{"cudagraph_mode":"NONE"}'`,
      { fromVersion: "v0.23.0", toVersion: "main" },
    );
    expect(pdRep.topology).toBe("pd");
    expect(pdRep.items.map((i) => `${i.scope}:${i.severity}`)).toEqual([
      "prefill:breaking-error",
      "decode:legacy-counterproductive",
    ]);

    const cleanRep = analyzeSingleUpgradeRadar(
      `export ASCEND_RT_VISIBLE_DEVICES=0\nvllm serve Qwen/Qwen3-8B --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' --additional-config '{"weight_nz_mode":1}'`,
      { fromVersion: "v0.23.0", toVersion: "v0.30.0" },
    );
    expect(cleanRep.counts.total).toBe(0);
    expect(cleanRep.hasBreakingErrors).toBe(false);
    expect(cleanRep.recommendedSingleCommand).toBeUndefined();
    expect(cleanRep.honestBoundaryNote).toBe(UPGRADE_RADAR_HONEST_BOUNDARY_NOTE);
    expect(cleanRep.honestBoundaryNote).toContain("vllm_omni");
  });

  it("detects v0.26.0rc -> v0.30.0/main enable_shared_expert_dp default flip under MoE + EP + FlashComm1", () => {
    const fc1JsonCmd =
      "vllm serve Qwen/Qwen3-30B-A3B -tp 4 --enable-expert-parallel --additional-config '{\"enable_flashcomm1\":true}'";
    for (const toVersion of ["v0.30.0", "main"] as const) {
      const rep = analyzeSingleUpgradeRadar(fc1JsonCmd, {
        fromVersion: "v0.26.0rc",
        toVersion,
      });
      const item = rep.items.find((i) => i.id === "radar-shared-expert-dp-default-flip");
      expect(item).toBeDefined();
      expect(item?.severity).toBe("behavior-changed");
      expect(item?.legacyBehavior).toContain("2ed6cbba");
      expect(item?.remediation).toContain('"enable_shared_expert_dp": true');
      expect(rep.recommendedSingleCommand).toBeDefined();
      expect(rep.recommendedSingleCommand).toContain('"enable_shared_expert_dp":true');
      const recheck = analyzeSingleUpgradeRadar(rep.recommendedSingleCommand!, {
        fromVersion: "v0.26.0rc",
        toVersion,
      });
      expect(recheck.counts.total).toBe(0);
    }

    // Also triggers when FlashComm1 enabled via env var without JSON override
    const fc1EnvCmd =
      "export VLLM_ASCEND_ENABLE_FLASHCOMM1=1\nvllm serve Qwen/Qwen3-30B-A3B -tp 4 --enable-expert-parallel";
    const envRep = analyzeSingleUpgradeRadar(fc1EnvCmd, {
      fromVersion: "v0.26.0rc",
      toVersion: "v0.30.0",
    });
    expect(envRep.items.some((i) => i.id === "radar-shared-expert-dp-default-flip")).toBe(true);

    // Does NOT trigger on v0.23.0, when explicitly set, or when FlashComm1 is false
    expect(
      analyzeSingleUpgradeRadar(fc1JsonCmd, { fromVersion: "v0.23.0", toVersion: "v0.30.0" }).items.some(
        (i) => i.id === "radar-shared-expert-dp-default-flip",
      ),
    ).toBe(false);
    expect(
      analyzeSingleUpgradeRadar(
        'vllm serve Qwen/Qwen3-30B-A3B -tp 4 --enable-expert-parallel --additional-config \'{"enable_flashcomm1":true,"enable_shared_expert_dp":false}\'',
        { fromVersion: "v0.26.0rc", toVersion: "v0.30.0" },
      ).items.some((i) => i.id === "radar-shared-expert-dp-default-flip"),
    ).toBe(false);
  });

  it("strictly rejects unknown keys in nested Pydantic sub-configs (eplb_config, xlite_graph_config, finegrained_tp_config, rl_config, scheduler nested)", () => {
    const badNestedCmd = `vllm serve Qwen/Qwen3-30B-A3B --additional-config '${JSON.stringify({
      eplb_config: { dynamic_eplb: false, dynamic_eplbb: true, stair_config: { bad_stair: 1 } },
      xlite_graph_config: { enabled: true, bad_xlite: 1 },
      finegrained_tp_config: { oproj_tensor_parallel_size: 2, bad_tp: 4 },
      rl_config: { enabled: false, bad_rl: true },
      ascend_warmup_config: { enable_early_kernel_warmup: false, bad_warm: true },
      rejection_sampler_config: { enable_entropy_verify: false, bad_rej: true },
      sparse_kv_offload_config: { enabled: false, bad_offload: 1 },
      scheduler_config: { short_request_first_config: { enabled: false, bad_srf: 1 } },
    })}'`;

    const rep = analyzeSingleUpgradeRadar(badNestedCmd, {
      fromVersion: "v0.26.0rc",
      toVersion: "v0.30.0",
    });
    const ids = rep.items.map((i) => i.id);
    expect(ids).toContain("radar-unknown-subkey-eplb_config-dynamic_eplbb");
    expect(ids).toContain("radar-unknown-subkey-eplb_config.stair_config-bad_stair");
    expect(ids).toContain("radar-unknown-subkey-xlite_graph_config-bad_xlite");
    expect(ids).toContain("radar-unknown-subkey-finegrained_tp_config-bad_tp");
    expect(ids).toContain("radar-unknown-subkey-rl_config-bad_rl");
    expect(ids).toContain("radar-unknown-subkey-ascend_warmup_config-bad_warm");
    expect(ids).toContain("radar-unknown-subkey-rejection_sampler_config-bad_rej");
    expect(ids).toContain("radar-unknown-subkey-sparse_kv_offload_config-bad_offload");
    expect(ids).toContain("radar-unknown-subkey-scheduler_config.short_request_first_config-bad_srf");
    expect(rep.counts.breakingError).toBe(9);
    for (const item of rep.items) {
      expect(item.severity).toBe("breaking-error");
    }

    // Valid nested configs on main produce zero breaking errors
    const validMainNestedCmd = `vllm serve Qwen/Qwen3-30B-A3B --additional-config '${JSON.stringify({
      eplb_config: { dynamic_eplb: false, stair_config: { load_window_bins: 64 } },
      xlite_graph_config: { enabled: true, full_mode: false },
      finegrained_tp_config: { qkv_iproj_tensor_parallel_size: 2 },
      quantized_all_reduce_config: { enable: true, min_numel: 32768 },
    })}'`;
    const validRep = analyzeSingleUpgradeRadar(validMainNestedCmd, {
      fromVersion: "v0.26.0rc",
      toVersion: "main",
    });
    expect(validRep.counts.total).toBe(0);

    // Removed subkeys (quant_dtype on main@8d6180e2, fused_op_type on v0.30.0@c09d3e20) are rejected
    const badQarMain = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-30B-A3B --additional-config '{"quantized_all_reduce_config":{"enable":true,"quant_dtype":"int8"}}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(badQarMain.items.map((i) => i.id)).toContain(
      "radar-unknown-subkey-quantized_all_reduce_config-quant_dtype",
    );

    const badSparseV030 = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-30B-A3B --additional-config '{"sparse_kv_offload_config":{"enabled":true,"fused_op_type":"fused_copy_sfa"}}'`,
      { fromVersion: "v0.26.0rc", toVersion: "v0.30.0" },
    );
    expect(badSparseV030.items.map((i) => i.id)).toContain(
      "radar-unknown-subkey-sparse_kv_offload_config-fused_op_type",
    );
  });

  it("generates recommendedSingleCommand and recommendedPdCommands that re-validate with zero shockwave items", () => {
    const legacyRep = analyzeSingleUpgradeRadar(LEGACY_V023_MIGRATION_SAMPLE_CMD, {
      fromVersion: "v0.23.0",
      toVersion: "v0.30.0",
    });
    expect(legacyRep.recommendedSingleCommand).toBeDefined();
    const rec = legacyRep.recommendedSingleCommand!;
    expect(rec).toContain("export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3");
    expect(rec).not.toContain("VLLM_ASCEND_ENABLE_NZ");
    expect(rec).not.toContain("VLLM_ASCEND_ENABLE_MLAPO");
    expect(rec).not.toContain("VLLM_ASCEND_ENABLE_FLASHCOMM1");
    expect(rec).not.toContain("weight_prefetch_config");
    expect(rec).not.toContain("--enforce-eager");
    expect(rec).toContain('"cudagraph_mode":"FULL_DECODE_ONLY"');
    expect(rec).toContain('"weight_nz_mode":0');
    expect(rec).toContain('"enable_mlapo":false');
    expect(rec).toContain('"scheduler_config":{"enable_balance_scheduling":true}');

    const recheck = analyzeSingleUpgradeRadar(rec, {
      fromVersion: "v0.23.0",
      toVersion: "v0.30.0",
    });
    expect(recheck.counts.total).toBe(0);
    expect(recheck.hasBreakingErrors).toBe(false);

    const pdRep = analyzePdUpgradeRadar(
      `vllm serve Qwen/Qwen3-30B-A3B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer"}' --additional-config '{"layer_sharding":["o_proj"]}'`,
      `vllm serve Qwen/Qwen3-30B-A3B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer"}' --compilation-config '{"cudagraph_mode":"NONE"}'`,
      { fromVersion: "v0.23.0", toVersion: "main" },
    );
    expect(pdRep.recommendedPdCommands).toBeDefined();
    expect(pdRep.recommendedPdCommands?.prefillCommand).not.toContain("layer_sharding");
    expect(pdRep.recommendedPdCommands?.decodeCommand).toContain('"cudagraph_mode":"FULL_DECODE_ONLY"');
    const pdRecheck = analyzePdUpgradeRadar(
      pdRep.recommendedPdCommands!.prefillCommand,
      pdRep.recommendedPdCommands!.decodeCommand,
      { fromVersion: "v0.23.0", toVersion: "main" },
    );
    expect(pdRecheck.counts.total).toBe(0);

    const cleanPd = analyzePdUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer"}'`,
      `vllm serve Qwen/Qwen3-8B --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer"}'`,
      { fromVersion: "v0.23.0", toVersion: "main" },
    );
    expect(cleanPd.counts.total).toBe(0);
    expect(cleanPd.recommendedPdCommands).toBeUndefined();

    // Round-2 P2-8 + Round-3 env quoting closure: preserve "$MODEL_DIR" expansion AND single-quoted export MODEL='$BASE/model' literal semantics
    const varRep = analyzeSingleUpgradeRadar(
      `export MODEL='$BASE/model'\nvllm serve "$MODEL_DIR" --enforce-eager`,
      {
        fromVersion: "v0.23.0",
        toVersion: "v0.30.0",
      },
    );
    expect(varRep.recommendedSingleCommand).toBeDefined();
    expect(varRep.recommendedSingleCommand).toContain("export MODEL='$BASE/model'");
    expect(varRep.recommendedSingleCommand).toContain('vllm serve "$MODEL_DIR"');
    expect(varRep.recommendedSingleCommand).not.toContain("'$MODEL_DIR'");

    // Wave 1 P2-5: dynamic_spec_config from v0.26.0rc -> main cites 2ed6cbba legacy source (never c09d3e20 as v0.26.0rc)
    const dynSpecFrom026 = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"dynamic_spec_config":{"method":"dspark"}}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    const dynItem = dynSpecFrom026.items.find((i) => i.id === "radar-removed-key-dynamic-spec-config");
    expect(dynItem).toBeDefined();
    expect(dynItem?.sources.some((s) => s.startsWith("vllm-ascend@2ed6cbba:"))).toBe(true);
    expect(dynItem?.sources.some((s) => s.startsWith("vllm-ascend@c09d3e20:"))).toBe(false);
    expect(dynItem?.legacyBehavior).toContain(".get()");
  });

  it("handles prototype keys safely, ignores factory-discarded/shadowed subconfigs, strips dotted breaking flags, and preserves shell vars & env -i", () => {
    // 1. Prototype key {"toString":1} does not crash and reports unknown top-level key
    const protoRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"toString":1}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(protoRep.counts.breakingError).toBe(1);
    expect(protoRep.items[0]?.id).toBe("radar-unknown-top-key-toString");

    // 2. Factory-discarded kvpp_config and shadowed top-level short_request_first_config do not trigger breaking-error
    const kvppRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"kvpp_config":{"bad":1}}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(kvppRep.counts.breakingError).toBe(0);

    const shadowedSrfRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"short_request_first_config":{"bad":1},"scheduler_config":{"short_request_first_config":{}}}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(shadowedSrfRep.counts.breakingError).toBe(0);

    // 3. Dotted --additional-config.layer_sharding true is removed from recommendedSingleCommand
    const dottedRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --additional-config.layer_sharding true`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(dottedRep.counts.breakingError).toBe(1);
    expect(dottedRep.recommendedSingleCommand).toBeDefined();
    expect(dottedRep.recommendedSingleCommand).not.toContain("layer_sharding");
    expect(
      analyzeSingleUpgradeRadar(dottedRep.recommendedSingleCommand!, {
        fromVersion: "v0.26.0rc",
        toVersion: "main",
      }).counts.total,
    ).toBe(0);

    // 4. Standalone shell variable TP=4 and env -i wrapper survive reconstruction without corruption
    const shellVarRep = analyzeSingleUpgradeRadar(`TP=4; vllm serve Qwen/Qwen3-8B -tp $TP --enforce-eager`, {
      fromVersion: "v0.26.0rc",
      toVersion: "main",
    });
    expect(shellVarRep.recommendedSingleCommand).toContain("TP=4");
    expect(
      analyzeSingleUpgradeRadar(shellVarRep.recommendedSingleCommand!, {
        fromVersion: "v0.26.0rc",
        toVersion: "main",
      }).counts.total,
    ).toBe(0);

    const envIgnoreRep = analyzeSingleUpgradeRadar(`env -i vllm serve Qwen/Qwen3-8B --enforce-eager`, {
      fromVersion: "v0.26.0rc",
      toVersion: "main",
    });
    expect(envIgnoreRep.recommendedSingleCommand).not.toContain("vllm serve -i vllm serve");
    expect(envIgnoreRep.recommendedSingleCommand).toMatch(/^env -i vllm serve Qwen\/Qwen3-8B/);

    // 5. Statement order, env -i / env -u isolation, and valid dotted --additional-config.<path> shell fallback preservation
    const orderRep = analyzeSingleUpgradeRadar(
      `TP=2; N=$TP; TP=4; vllm serve Qwen/Qwen3-8B -tp $N --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(orderRep.recommendedSingleCommand).toBeDefined();
    expect(parseVllmServeCommand(orderRep.recommendedSingleCommand!).couplingInput.tpSize).toBe(2);

    const exportEnvIgnoreRep = analyzeSingleUpgradeRadar(
      `export VLLM_BATCH_INVARIANT=1; env -i vllm serve Qwen/Qwen3-8B --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(exportEnvIgnoreRep.recommendedSingleCommand).toBeDefined();
    expect(parseVllmServeCommand(exportEnvIgnoreRep.recommendedSingleCommand!).envVars).toEqual({});

    const envUnsetRep = analyzeSingleUpgradeRadar(
      `export VLLM_BATCH_INVARIANT=1; env -u VLLM_BATCH_INVARIANT vllm serve Qwen/Qwen3-8B --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(envUnsetRep.recommendedSingleCommand).toContain("env -u VLLM_BATCH_INVARIANT");
    expect(
      parseVllmServeCommand(envUnsetRep.recommendedSingleCommand!).envVars.VLLM_BATCH_INVARIANT,
    ).toBeUndefined();

    const dottedFallbackRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --additional-config '{"enable_balance_scheduling":true}' --additional-config.weight_nz_mode \${NZ:-1} --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(dottedFallbackRep.recommendedSingleCommand).toContain(
      `--additional-config.weight_nz_mode \${NZ:-1}`,
    );
    const parsedRecon = parseVllmServeCommand(`NZ=2; ${dottedFallbackRep.recommendedSingleCommand!}`, {
      version: "main",
    });
    expect(parsedRecon.couplingInput.weightNzMode).toBe(2);

    // 6. Comment newline boundary, && guard, trailing assignment, command-local prefix assignment, in-place ${NZ:=2}, and invalid dotted paths/subkeys
    const commentRep = analyzeSingleUpgradeRadar(
      `export TP=2 # ranks\nvllm serve Qwen/Qwen3-8B -tp $TP --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    const parsedComment = parseVllmServeCommand(commentRep.recommendedSingleCommand!, { version: "main" });
    expect(parsedComment.model).toBe("Qwen/Qwen3-8B");
    expect(parsedComment.couplingInput.tpSize).toBe(2);

    const andGuardRep = analyzeSingleUpgradeRadar(`check_npu && vllm serve Qwen/Qwen3-8B --enforce-eager`, {
      fromVersion: "v0.26.0rc",
      toVersion: "main",
    });
    expect(andGuardRep.recommendedSingleCommand).toMatch(/^check_npu && vllm serve Qwen\/Qwen3-8B/);

    const andGuardDeadRep = analyzeSingleUpgradeRadar(`false && vllm serve Qwen/Qwen3-8B --enforce-eager`, {
      fromVersion: "v0.26.0rc",
      toVersion: "main",
    });
    expect(andGuardDeadRep.items).toEqual([]);
    expect(andGuardDeadRep.recommendedSingleCommand).toBeUndefined();

    const trailingAssignRep = analyzeSingleUpgradeRadar(
      `TP=2; vllm serve Qwen/Qwen3-8B -tp $TP --enforce-eager; TP=8`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(parseVllmServeCommand(trailingAssignRep.recommendedSingleCommand!).couplingInput.tpSize).toBe(2);
    expect(trailingAssignRep.recommendedSingleCommand).toMatch(/;\s*TP=8$/);

    const localPrefixRep = analyzeSingleUpgradeRadar(
      `TP=2; TP=8 vllm serve Qwen/Qwen3-8B -tp $TP --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(parseVllmServeCommand(localPrefixRep.recommendedSingleCommand!).couplingInput.tpSize).toBe(2);

    const inPlaceDottedSideEffectRep = analyzeSingleUpgradeRadar(
      `unset NZ; vllm serve Qwen/Qwen3-8B --additional-config.weight_nz_mode \${NZ:=2} -tp \${NZ:-1} --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(
      parseVllmServeCommand(inPlaceDottedSideEffectRep.recommendedSingleCommand!).couplingInput.tpSize,
    ).toBe(2);

    for (const invalidDottedCmd of [
      `vllm serve Qwen/Qwen3-8B --additional-config.weight_nz_mode.typo 1 --enforce-eager`,
      `vllm serve Qwen/Qwen3-8B --additional-config.scheduler_config '{"typo":1}' --enforce-eager`,
      `vllm serve Qwen/Qwen3-8B --additional-config.scheduler_config.enable_balance_scheduling.typo 1 --enforce-eager`,
      `vllm serve Qwen/Qwen3-8B --additional-config.scheduler_config..enable_balance_scheduling true --enforce-eager`,
    ]) {
      const rep = analyzeSingleUpgradeRadar(invalidDottedCmd, {
        fromVersion: "v0.26.0rc",
        toVersion: "main",
      });
      expect(rep.recommendedSingleCommand).toBeDefined();
      expect(
        parseVllmServeCommand(rep.recommendedSingleCommand!, { version: "main" }).parseDiagnostics,
      ).toEqual([]);
    }

    // 7. Migrated sibling into preserved dotted parent, lossless >2^53 JSON rebuild, || guard, dropped export in &&; list, multi-serve last match, nohup + &, and comment trailing backslash
    const siblingDottedRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --additional-config.enable_balance_scheduling true --additional-config.scheduler_config '{"recompute_scheduler_enable":true}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    const parsedSibling = parseVllmServeCommand(siblingDottedRep.recommendedSingleCommand!, {
      version: "main",
    });
    expect(parsedSibling.couplingInput.enableBalanceScheduling).toBe(true);
    expect(parsedSibling.couplingInput.recomputeSchedulerEnable).toBe(true);

    const bigIntRebuildRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --enforce-eager --additional-config '{"scheduler_config":{"dyntra_lb_config":{"start_step":9007199254740992,"end_step":9007199254740993}}}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(bigIntRebuildRep.recommendedSingleCommand).toContain("9007199254740993");
    expect(
      parseVllmServeCommand(bigIntRebuildRep.recommendedSingleCommand!, { version: "main" }).parseDiagnostics,
    ).toEqual([]);

    const orGuardRep = analyzeSingleUpgradeRadar(`false || vllm serve Qwen/Qwen3-8B --enforce-eager`, {
      fromVersion: "v0.26.0rc",
      toVersion: "main",
    });
    expect(orGuardRep.recommendedSingleCommand).toMatch(/^false \|\| vllm serve Qwen\/Qwen3-8B/);

    expect(
      analyzeSingleUpgradeRadar(`false && export VLLM_ASCEND_ENABLE_NZ=2; vllm serve Qwen/Qwen3-8B`, {
        fromVersion: "v0.26.0rc",
        toVersion: "main",
      }).counts.total,
    ).toBe(0);
    const droppedAndSemiRep = analyzeSingleUpgradeRadar(
      `check_ready && export VLLM_ASCEND_ENABLE_NZ=2; vllm serve Qwen/Qwen3-8B --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(droppedAndSemiRep.recommendedSingleCommand).toMatch(
      /^check_ready && :;\s*vllm serve Qwen\/Qwen3-8B/,
    );
    const deadAndExportRep = analyzeSingleUpgradeRadar(
      `false && export VLLM_ASCEND_ENABLE_NZ=2; vllm serve Qwen/Qwen3-8B --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(deadAndExportRep.recommendedSingleCommand).not.toContain("weight_nz_mode");

    const twoServeRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --enforce-eager; vllm serve Qwen/Qwen3-32B --additional-config.enable_balance_scheduling true`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(parseVllmServeCommand(twoServeRep.recommendedSingleCommand!).model).toBe("Qwen/Qwen3-32B");

    const bgNohupRep = analyzeSingleUpgradeRadar(
      `nohup -- vllm serve Qwen/Qwen3-8B --enforce-eager & false &`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(bgNohupRep.recommendedSingleCommand).toMatch(
      /^nohup -- vllm serve Qwen\/Qwen3-8B[\s\S]*& false &$/,
    );

    const setsidRep = analyzeSingleUpgradeRadar(`setsid -f vllm serve Qwen/Qwen3-8B --enforce-eager &`, {
      fromVersion: "v0.26.0rc",
      toVersion: "main",
    });
    expect(setsidRep.recommendedSingleCommand).toMatch(/^setsid -f vllm serve Qwen\/Qwen3-8B[\s\S]*&$/);

    const varCmdRep = analyzeSingleUpgradeRadar(
      `CMD=vllm; vllm serve Qwen/Qwen3-32B; $CMD serve Qwen/Qwen3-8B --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(varCmdRep.recommendedSingleCommand).toContain(
      "vllm serve Qwen/Qwen3-32B; $CMD serve Qwen/Qwen3-8B",
    );

    const demotedExportRep = analyzeSingleUpgradeRadar(
      `export VLLM_ASCEND_ENABLE_NZ=2 && vllm serve Qwen/Qwen3-8B -tp "$VLLM_ASCEND_ENABLE_NZ"`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(parseVllmServeCommand(demotedExportRep.recommendedSingleCommand!).couplingInput.tpSize).toBe(2);
    expect(
      analyzeSingleUpgradeRadar(demotedExportRep.recommendedSingleCommand!, {
        fromVersion: "v0.26.0rc",
        toVersion: "main",
      }).counts.total,
    ).toBe(0);

    const sidecarBgRep = analyzeSingleUpgradeRadar(
      `sidecar & export VLLM_ASCEND_ENABLE_NZ=2; vllm serve Qwen/Qwen3-8B`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(sidecarBgRep.recommendedSingleCommand).toMatch(/^sidecar & vllm serve Qwen\/Qwen3-8B/);

    const wordContRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --max-num-seqs 1\\\n024 --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(parseVllmServeCommand(wordContRep.recommendedSingleCommand!).couplingInput.maxNumSeqs).toBe(1024);

    const arrBigIntRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --enforce-eager --compilation-config '{"cudagraph_capture_sizes":[9007199254740992,9007199254740993]}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(arrBigIntRep.recommendedSingleCommand).toContain("[9007199254740992,9007199254740993]");

    const envPlusDottedParentRep = analyzeSingleUpgradeRadar(
      `export VLLM_ASCEND_BALANCE_SCHEDULING=1; vllm serve Qwen/Qwen3-8B --additional-config.scheduler_config '{"recompute_scheduler_enable":true}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    const parsedEnvPlusParent = parseVllmServeCommand(envPlusDottedParentRep.recommendedSingleCommand!, {
      version: "main",
    });
    expect(parsedEnvPlusParent.couplingInput.recomputeSchedulerEnable).toBe(true);
    expect(parsedEnvPlusParent.couplingInput.enableBalanceScheduling).toBe(true);

    const envVsExplicitFalseRep = analyzeSingleUpgradeRadar(
      `export VLLM_ASCEND_BALANCE_SCHEDULING=1; vllm serve Qwen/Qwen3-8B --additional-config.enable_balance_scheduling false`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(
      parseVllmServeCommand(envVsExplicitFalseRep.recommendedSingleCommand!, { version: "main" })
        .couplingInput.enableBalanceScheduling,
    ).toBe(false);

    const cleanedMigratedChildRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --additional-config.short_request_first_config '{"enabled":true,"typo":1}' --additional-config.scheduler_config '{"recompute_scheduler_enable":true}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(
      parseVllmServeCommand(cleanedMigratedChildRep.recommendedSingleCommand!, { version: "main" })
        .parseDiagnostics,
    ).toEqual([]);

    const soloNestedTypoRep = analyzeSingleUpgradeRadar(
      `vllm serve Qwen/Qwen3-8B --additional-config.scheduler_config.enable_balance_scheduling.typo 1`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(soloNestedTypoRep.counts.breakingError).toBe(1);
    expect(soloNestedTypoRep.recommendedSingleCommand).toBeDefined();
    expect(
      parseVllmServeCommand(soloNestedTypoRep.recommendedSingleCommand!, { version: "main" })
        .parseDiagnostics,
    ).toEqual([]);

    const commentBackslashRep = analyzeSingleUpgradeRadar(
      `export TP=2 # ranks \\\nvllm serve Qwen/Qwen3-8B -tp $TP --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(parseVllmServeCommand(commentBackslashRep.recommendedSingleCommand!).couplingInput.tpSize).toBe(2);

    // Mixed export under false && must keep TP=8 guarded by false &&
    const mixedGuardedExportRep = analyzeSingleUpgradeRadar(
      `false && export VLLM_ASCEND_ENABLE_NZ=2 TP=8; vllm serve /m -tp "\${TP:-\${VLLM_ASCEND_ENABLE_NZ:-1}}" --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(parseVllmServeCommand(mixedGuardedExportRep.recommendedSingleCommand!).couplingInput.tpSize).toBe(
      1,
    );

    // Dynamic setsid option variable must rewrite the matched serve statement in-place without phantom vllm serve
    const dynSetsidRep = analyzeSingleUpgradeRadar(`OPT=-f; setsid "$OPT" vllm serve /m --enforce-eager`, {
      fromVersion: "v0.26.0rc",
      toVersion: "main",
    });
    expect(dynSetsidRep.recommendedSingleCommand).toContain('setsid "$OPT" vllm serve /m');
    expect(parseVllmServeCommand(dynSetsidRep.recommendedSingleCommand!).model).toBe("/m");

    // Dead vllm serve branch behind false && must not get a migration command even with retired export
    const deadWithExportRep = analyzeSingleUpgradeRadar(
      `export VLLM_ASCEND_ENABLE_NZ=2; false && vllm serve /m`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(deadWithExportRep.recommendedSingleCommand).toBeUndefined();

    // set -a must not re-export demoted retired variable into vllm serve env
    const setADemoteRep = analyzeSingleUpgradeRadar(
      `set -a; export VLLM_ASCEND_ENABLE_NZ=2; vllm serve /m -tp "$VLLM_ASCEND_ENABLE_NZ"`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    const parsedSetADemote = parseVllmServeCommand(setADemoteRep.recommendedSingleCommand!, {
      version: "main",
    });
    expect(parsedSetADemote.couplingInput.tpSize).toBe(2);
    expect(parsedSetADemote.envVars.VLLM_ASCEND_ENABLE_NZ).toBeUndefined();
    expect(
      analyzeSingleUpgradeRadar(setADemoteRep.recommendedSingleCommand!, {
        fromVersion: "v0.26.0rc",
        toVersion: "main",
      }).items,
    ).toEqual([]);

    // Dotted JSON array must preserve >2^53 integers losslessly
    const dottedArrBigIntRep = analyzeSingleUpgradeRadar(
      `vllm serve /m --additional-config.pa_shape_list '[9007199254740993]' --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(dottedArrBigIntRep.recommendedSingleCommand).toContain("9007199254740993");

    // Scheduler migration warning must not mask strict type errors, and invalid fields must be stripped cleanly
    const schedTypeErrRep = analyzeSingleUpgradeRadar(
      `vllm serve /m --additional-config.short_request_first_config.enabled bad --additional-config.scheduler_config '{}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(schedTypeErrRep.counts.breakingError).toBeGreaterThanOrEqual(1);
    expect(
      parseVllmServeCommand(schedTypeErrRep.recommendedSingleCommand!, { version: "main" }).parseDiagnostics,
    ).toEqual([]);

    const qarBadFieldRep = analyzeSingleUpgradeRadar(
      `vllm serve /m --additional-config.quantized_all_reduce_config.min_numel bad`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(qarBadFieldRep.counts.breakingError).toBe(1);
    expect(
      parseVllmServeCommand(qarBadFieldRep.recommendedSingleCommand!, { version: "main" }).parseDiagnostics,
    ).toEqual([]);

    const qarBadPlusUnknownRep = analyzeSingleUpgradeRadar(
      `vllm serve /m --additional-config '{"quantized_all_reduce_config":{"min_numel":"bad","wrong":1}}'`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(qarBadPlusUnknownRep.counts.breakingError).toBeGreaterThanOrEqual(2);
    expect(
      parseVllmServeCommand(qarBadPlusUnknownRep.recommendedSingleCommand!, { version: "main" })
        .parseDiagnostics,
    ).toEqual([]);

    // Statically skipped `false && set -a` must not trigger allexport wrapping; `true || export ...` stays guarded
    const skippedSetARep = analyzeSingleUpgradeRadar(
      `false && set -a; export VLLM_ASCEND_ENABLE_NZ=2; HCCL_BUFFSIZE=64; vllm serve /m -tp "$VLLM_ASCEND_ENABLE_NZ"`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    const parsedSkippedSetA = parseVllmServeCommand(skippedSetARep.recommendedSingleCommand!, {
      version: "main",
    });
    expect(parsedSkippedSetA.couplingInput.tpSize).toBe(2);
    expect(parsedSkippedSetA.envVars.HCCL_BUFFSIZE).toBeUndefined();

    const skippedOrExportRep = analyzeSingleUpgradeRadar(
      `true || export VLLM_ASCEND_ENABLE_NZ=2 TP=8; vllm serve /m -tp "\${TP:-\${VLLM_ASCEND_ENABLE_NZ:-1}}" --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(
      parseVllmServeCommand(skippedOrExportRep.recommendedSingleCommand!, { version: "main" }).couplingInput
        .tpSize,
    ).toBe(1);

    // Migrating valid top-level scheduler key must survive even when old scheduler_config was invalid scalar
    const migratedOverBadSchedRep = analyzeSingleUpgradeRadar(
      `vllm serve /m --additional-config.enable_balance_scheduling true --additional-config.scheduler_config bad`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    const parsedMigratedOverBad = parseVllmServeCommand(migratedOverBadSchedRep.recommendedSingleCommand!, {
      version: "main",
    });
    expect(parsedMigratedOverBad.parseDiagnostics).toEqual([]);
    expect(parsedMigratedOverBad.couplingInput.enableBalanceScheduling).toBe(true);

    // Duplicate dotted JSON array preserves >2^53 integers across merged elements
    const mergedArrBigIntRep = analyzeSingleUpgradeRadar(
      `vllm serve /m --additional-config.pa_shape_list '[9007199254740993]' --additional-config.pa_shape_list '[1]' --enforce-eager`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(mergedArrBigIntRep.recommendedSingleCommand).toContain("9007199254740993");

    // 3-valued logic: `test -z x && true || export ...` stays reachable and gets cleaned
    const threeValuedAndOrRep = analyzeSingleUpgradeRadar(
      `test -z x && true || export VLLM_ASCEND_ENABLE_NZ=2; vllm serve /m`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    expect(
      analyzeSingleUpgradeRadar(threeValuedAndOrRep.recommendedSingleCommand!, {
        fromVersion: "v0.26.0rc",
        toVersion: "main",
      }).items,
    ).toEqual([]);

    // Replacing BigInt scalar scheduler_config with synthesized dict clears stale UNSAFE_JSON_INTS
    const migratedOverBigIntSchedRep = analyzeSingleUpgradeRadar(
      `vllm serve /m --additional-config.enable_balance_scheduling true --additional-config.scheduler_config 9007199254740993`,
      { fromVersion: "v0.26.0rc", toVersion: "main" },
    );
    const parsedMigratedOverBigInt = parseVllmServeCommand(
      migratedOverBigIntSchedRep.recommendedSingleCommand!,
      { version: "main" },
    );
    expect(parsedMigratedOverBigInt.parseDiagnostics).toEqual([]);
    expect(parsedMigratedOverBigInt.couplingInput.enableBalanceScheduling).toBe(true);
  });
});
