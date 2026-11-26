import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSourceRef, type RuleVersion } from "../rules/types";
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
});
