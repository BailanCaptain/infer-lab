import { describe, expect, it } from "vitest";
import {
  calculateDpBufferSizeMiB,
  classifyEnvVar,
  DOCS_ONLY_UNKNOWN_ASCEND_VARS,
  DOCS_ONLY_UNKNOWN_HCCL_VARS,
  estimateHcclDomainMemory,
  evaluateDomain4Rules,
  evaluateDomain5Rules,
  HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB,
  resolveReuseDomain,
} from "./index";

describe("Domain 4: CP Three Routes & PD Disaggregation Constraints", () => {
  it("flags Ulysses/Ring as architectural only and enforces PCP->MRV2 & FULL cudagraph exclusion", () => {
    const ulysses = evaluateDomain4Rules({ cpRoute: "ulysses" }, "v0.30.0");
    expect(ulysses.some((m) => m.ruleId === "d4-ulysses-ring-no-runtime-flags")).toBe(true);

    const pcpNoMrv2 = evaluateDomain4Rules(
      { pcpSize: 2, useV2ModelRunner: false, cudagraphMode: "FULL" },
      "v0.30.0",
    );
    expect(pcpNoMrv2.some((m) => m.ruleId === "d4-pcp-requires-mrv2" && m.judgment === "error")).toBe(true);
    expect(
      pcpNoMrv2.some((m) => m.ruleId === "d4-pcp-full-cudagraph-unsupported" && m.judgment === "error"),
    ).toBe(true);
  });

  it("handles DSA-CP on MRV2 version diff (error in v0.30.0 vs allowed in main)", () => {
    const v030 = evaluateDomain4Rules({ enableDsaCp: true, useV2ModelRunner: true }, "v0.30.0");
    expect(v030.some((m) => m.ruleId === "d4-dsa-cp-mrv2-v030" && m.judgment === "error")).toBe(true);

    const main = evaluateDomain4Rules({ enableDsaCp: true, useV2ModelRunner: true }, "main");
    expect(main.some((m) => m.ruleId === "d4-dsa-cp-mrv2-v030")).toBe(false);
  });

  it("enforces PCP + DCP sizing and GQA/MQA divisibility", () => {
    const badGqa = evaluateDomain4Rules(
      { tpSize: 4, pcpSize: 2, dcpSize: 4, useV2ModelRunner: true, useMla: false, numKvHeads: 2 },
      "v0.30.0",
    );
    expect(badGqa.some((m) => m.ruleId === "d4-pcp-dcp-sizing" && m.judgment === "error")).toBe(true);

    const validMla = evaluateDomain4Rules(
      { tpSize: 4, pcpSize: 2, dcpSize: 8, useV2ModelRunner: true, useMla: true },
      "v0.30.0",
    );
    expect(validMla.some((m) => m.ruleId === "d4-pcp-dcp-sizing")).toBe(false);

    // GQA (tp // numKvHeads) % dcp !== 0: 48Q / 4KV at TP=24 (kvReplicas=6) with DCP=4 -> 6 % 4 !== 0 -> error
    const nonDivisibleKvReplica = evaluateDomain4Rules(
      { tpSize: 24, pcpSize: 1, dcpSize: 4, useMla: false, numAttentionHeads: 48, numKvHeads: 4 },
      "v0.30.0",
    );
    expect(
      nonDivisibleKvReplica.some((m) => m.ruleId === "d4-pcp-dcp-sizing" && m.judgment === "error"),
    ).toBe(true);

    // Missing mandatory kv_role when kv_connector is set -> error citing L130-L140
    const missingRole = evaluateDomain4Rules({ kvConnector: "MooncakeConnectorV1" }, "v0.30.0");
    const missingRoleMatch = missingRole.find(
      (m) => m.ruleId === "d4-kv-connector-missing-kv-role" && m.judgment === "error",
    );
    expect(missingRoleMatch).toBeDefined();
    expect(missingRoleMatch?.sources).toContain("vllm@ced6857a:vllm/config/kv_transfer.py#L130-L140");

    // Case-sensitive kv_role literal check: uppercase "KV_PRODUCER" must also error citing L130-L140
    const upperRole = evaluateDomain4Rules(
      { kvConnector: "MooncakeConnectorV1", kvRole: "KV_PRODUCER" as unknown as "kv_producer" },
      "v0.30.0",
    );
    const upperRoleMatch = upperRole.find(
      (m) => m.ruleId === "d4-kv-connector-missing-kv-role" && m.judgment === "error",
    );
    expect(upperRoleMatch).toBeDefined();
    expect(upperRoleMatch?.sources).toContain("vllm@ced6857a:vllm/config/kv_transfer.py#L130-L140");
  });

  it("enforces MooncakeConnectorV1 D-node PP=1, PCP=1, TP_P%TP_D==0, and GQA+C8 rules", () => {
    const dNodeBad = evaluateDomain4Rules(
      {
        kvConnector: "MooncakeConnectorV1",
        kvRole: "kv_consumer",
        ppSize: 2,
        pcpSize: 2,
        useV2ModelRunner: true,
        prefillTpSize: 8,
        decodeTpSize: 3,
        enableC8Quant: true,
        useMla: false,
      },
      "v0.30.0",
    );
    expect(dNodeBad.some((m) => m.ruleId === "d4-mooncake-decode-pp-eq-1")).toBe(true);
    expect(dNodeBad.some((m) => m.ruleId === "d4-mooncake-decode-pcp-eq-1")).toBe(true);
    expect(dNodeBad.some((m) => m.ruleId === "d4-mooncake-pp-pcp-mutex")).toBe(true);
    expect(dNodeBad.some((m) => m.ruleId === "d4-mooncake-tp-p-divisible-tp-d")).toBe(true);
    expect(dNodeBad.some((m) => m.ruleId === "d4-mooncake-gqa-c8-forbidden")).toBe(true);

    const layerwiseOk = evaluateDomain4Rules(
      {
        kvConnector: "MooncakeLayerwiseConnector",
        kvRole: "kv_consumer",
        ppSize: 1,
        pcpSize: 1,
        prefillTpSize: 8,
        decodeTpSize: 4,
        enableC8Quant: true,
        useMla: false,
      },
      "v0.30.0",
    );
    expect(layerwiseOk.length).toBe(0);
  });

  it("enforces recompute_scheduler_enable and sparse_kv_offload_config D-node rules", () => {
    const pNode = evaluateDomain4Rules({ recomputeSchedulerEnable: true, kvRole: "kv_producer" }, "v0.30.0");
    expect(
      pNode.some(
        (m) => m.ruleId === "d4-recompute-scheduler-p-node-disable" && m.judgment === "silent-rewrite",
      ),
    ).toBe(true);

    const kvBoth = evaluateDomain4Rules({ recomputeSchedulerEnable: true, kvRole: "kv_both" }, "v0.30.0");
    expect(
      kvBoth.some((m) => m.ruleId === "d4-recompute-scheduler-non-d-node-error" && m.judgment === "error"),
    ).toBe(true);

    const fgTp = evaluateDomain4Rules(
      { oprojTensorParallelSize: 1, recomputeSchedulerEnable: false },
      "v0.30.0",
    );
    expect(fgTp.some((m) => m.ruleId === "d4-finegrained-tp-requires-recompute")).toBe(true);

    const sparseOffload = evaluateDomain4Rules(
      { sparseKvOffloadEnabled: true, hardwareFamily: "A5", ppSize: 2, kvRole: "kv_producer" },
      "v0.30.0",
    );
    expect(
      sparseOffload.some((m) => m.ruleId === "d4-sparse-kv-offload-constraints" && m.judgment === "error"),
    ).toBe(true);
  });
});

describe("Domain 5: Graph Compilation, Scheduler Overrides, RLConfig & P1-4 #2 Env Vars", () => {
  it("enforces FA3 PIECEWISE requirement and 950 custom_ops version diff", () => {
    const fa3 = evaluateDomain5Rules(
      { attentionBackend: "FA3", cudagraphMode: "FULL_DECODE_ONLY" },
      "v0.30.0",
    );
    expect(fa3.some((m) => m.ruleId === "d5-fa3-full-decode-only-error" && m.judgment === "error")).toBe(
      true,
    );

    const a5V030 = evaluateDomain5Rules({ hardwareFamily: "A5" }, "v0.30.0");
    expect(
      a5V030.find((m) => m.ruleId === "d5-950-custom-ops-disabled-v030")?.effectiveMutation
        ?.runtimeCustomOpsEnabled,
    ).toBe(false);

    const a5Main = evaluateDomain5Rules({ hardwareFamily: "A5" }, "main");
    expect(
      a5Main.find((m) => m.ruleId === "d5-950-custom-ops-enabled-main")?.effectiveMutation
        ?.runtimeCustomOpsEnabled,
    ).toBe(true);
  });

  it("models static_kernel / super_kernel / npugraph_ex interactions across chips and graph modes", () => {
    const omittedSuper = evaluateDomain5Rules(
      {
        hardwareFamily: "A3",
        enableNpugraphEx: true,
        enableStaticKernel: true,
        cudagraphMode: "FULL_DECODE_ONLY",
      },
      "v0.30.0",
    );
    expect(
      omittedSuper.find((m) => m.ruleId === "d5-static-kernel-defaults-super-kernel")?.effectiveMutation
        ?.enableSuperKernel,
    ).toBe(true);
    expect(omittedSuper.some((m) => m.ruleId === "d5-graph-mode-resets-npugraph-ex")).toBe(false);

    const downgrade310P = evaluateDomain5Rules(
      { hardwareFamily: "310P", enableNpugraphEx: true, enableStaticKernel: true },
      "v0.30.0",
    );
    expect(
      downgrade310P.some(
        (m) => m.ruleId === "d5-310p-npugraph-ex-downgrade" && m.judgment === "silent-rewrite",
      ),
    ).toBe(true);

    const soloSuper = evaluateDomain5Rules(
      { hardwareFamily: "A3", enableNpugraphEx: true, enableStaticKernel: false, enableSuperKernel: true },
      "v0.30.0",
    );
    expect(
      soloSuper.some((m) => m.ruleId === "d5-solo-super-or-static-kernel-error" && m.judgment === "error"),
    ).toBe(true);

    const piecewiseReset = evaluateDomain5Rules(
      {
        hardwareFamily: "A3",
        enableNpugraphEx: true,
        enableStaticKernel: true,
        enableSuperKernel: true,
        cudagraphMode: "FULL_AND_PIECEWISE",
      },
      "v0.30.0",
    );
    expect(piecewiseReset.some((m) => m.ruleId === "d5-graph-mode-resets-npugraph-ex")).toBe(true);

    const fullPreserved = evaluateDomain5Rules(
      {
        hardwareFamily: "A3",
        enableNpugraphEx: true,
        enableStaticKernel: true,
        enableSuperKernel: true,
        cudagraphMode: "FULL",
      },
      "v0.30.0",
    );
    expect(fullPreserved.some((m) => m.ruleId === "d5-graph-mode-resets-npugraph-ex")).toBe(false);
  });

  it("models scheduler override chain and RLConfig allocator/NZ mutations", () => {
    const schedV030 = evaluateDomain5Rules(
      {
        kvRole: "kv_consumer",
        recomputeSchedulerEnable: true,
        profilingChunkEnabled: true,
        batchJobSchedEnabled: true,
      },
      "v0.30.0",
    );
    expect(
      schedV030.find((m) => m.ruleId === "d5-scheduler-override-chain-v030")?.effectiveMutation
        ?.effectiveSchedulerCls,
    ).toBe("BatchJobAwareScheduler");

    // rfork: no dyntra_lb in platform.py#L671-L719, so dyntraLbEnabled does not trigger override chain
    expect(
      evaluateDomain5Rules({ dyntraLbEnabled: true, batchJobSchedEnabled: true }, "rfork").some(
        (m) => m.ruleId === "d5-scheduler-override-chain-v030",
      ),
    ).toBe(false);
    expect(
      evaluateDomain5Rules({ dyntraLbEnabled: true, profilingChunkEnabled: true }, "rfork").some(
        (m) => m.ruleId === "d5-scheduler-override-chain-v030",
      ),
    ).toBe(false);

    const schedRfork = evaluateDomain5Rules(
      {
        kvRole: "kv_consumer",
        recomputeSchedulerEnable: true,
        profilingChunkEnabled: true,
        batchJobSchedEnabled: true,
      },
      "rfork",
    );
    const schedRforkMatch = schedRfork.find((m) => m.ruleId === "d5-scheduler-override-chain-v030");
    expect(schedRforkMatch?.effectiveMutation?.effectiveSchedulerCls).toBe("BatchJobAwareScheduler");
    expect(schedRforkMatch?.sources).toEqual(["rfork@3284850b:vllm_ascend/platform.py#L671-L719"]);

    const schedDyntraV030 = evaluateDomain5Rules(
      { dyntraLbEnabled: true, batchJobSchedEnabled: true },
      "v0.30.0",
    );
    const schedDyntraV030Match = schedDyntraV030.find((m) => m.ruleId === "d5-scheduler-override-chain-v030");
    expect(schedDyntraV030Match).toBeDefined();
    expect(schedDyntraV030Match?.sources.every((s) => s.startsWith("vllm-ascend@c09d3e20:"))).toBe(true);

    const schedMain = evaluateDomain5Rules(
      {
        kvRole: "kv_consumer",
        recomputeSchedulerEnable: true,
        batchJobSchedEnabled: true,
      },
      "main",
    );
    expect(
      schedMain.find((m) => m.ruleId === "d5-scheduler-override-chain-main")?.effectiveMutation
        ?.effectiveSchedulerCls,
    ).toBe("BatchJobAwareScheduler");

    const rl = evaluateDomain5Rules(
      {
        rlEnabled: true,
        enableSleepMode: true,
        weightNzMode: 1,
        pytorchNpuAllocConf: "page_size:1g,expandable_segments:True",
      },
      "v0.30.0",
    );
    const rlMatch = rl.find((m) => m.ruleId === "d5-rl-config-disables-nz-and-expandable-segments");
    expect(rlMatch?.effectiveMutation?.weightNzMode).toBe(0);
    expect(rlMatch?.effectiveMutation?.pytorchNpuAllocConf).toBe("page_size:1g");
  });

  it("P1-4 #2: classifies HCCL_BUFFSIZE_EP and all docs-only HCCL/ASCEND vars as 'unknown' (never 'error')", () => {
    const buffsizeEp = classifyEnvVar("HCCL_BUFFSIZE_EP", "v0.30.0");
    expect(buffsizeEp.judgment).toBe("unknown");
    expect(buffsizeEp.ruleJudgment).toBe("unknown");
    expect(buffsizeEp.evidenceLevel).toBe("I");

    for (const v of [...DOCS_ONLY_UNKNOWN_HCCL_VARS, ...DOCS_ONLY_UNKNOWN_ASCEND_VARS]) {
      const res = classifyEnvVar(v, "v0.30.0");
      expect(res.ruleJudgment).toBe("unknown");
      expect(res.evidenceLevel).toBe("I");
    }

    // ASCEND_BUFFER_POOL version diff: unknown in v0.30.0, known-read in main
    expect(classifyEnvVar("ASCEND_BUFFER_POOL", "v0.30.0").ruleJudgment).toBe("unknown");
    expect(classifyEnvVar("ASCEND_BUFFER_POOL", "main").judgment).toBe("known-read");
    expect(classifyEnvVar("HCCL_BUFFSIZE", "v0.30.0").judgment).toBe("known-read");

    const envMatches = evaluateDomain5Rules({ envVars: { HCCL_BUFFSIZE_EP: "2048" } }, "v0.30.0");
    expect(envMatches).toHaveLength(1);
    expect(envMatches[0]?.judgment).toBe("unknown");
    expect(envMatches[0]?.evidenceLevel).toBe("I");
  });
});

describe("P1-4 #3: Full HCCL Domain Accounting & profile_run Overlap", () => {
  it("computes DP buffer formula max(ceil((dp+1)*4 / 1MiB), 50) and reuse domains", () => {
    expect(calculateDpBufferSizeMiB(1)).toBe(50);
    expect(calculateDpBufferSizeMiB(128)).toBe(50);
    expect(calculateDpBufferSizeMiB(20_000_000)).toBe(77);

    expect(resolveReuseDomain("mc2")).toBe("mc2");
    expect(resolveReuseDomain("eplb")).toBe("eplb");
    expect(resolveReuseDomain("dynamic_eplb")).toBe("dynamic_eplb");
    expect(resolveReuseDomain("tp:0")).toBe("shared");
  });

  it("deduplicates shared HCCL groups, includes 100/1 MiB & main domains, and documents profile_run overlap", () => {
    // When tp=8, pp=1, dp=1, pcp=1, dcp=1: world/tp/ep share identical ranks [0..7] -> deduplicated
    const singleNodeMoE = estimateHcclDomainMemory(
      { tpSize: 8, ppSize: 1, dpSize: 1, isMoe: true, dynamicEplb: true, sleepModeExtraCleanup: true },
      "v0.30.0",
    );
    expect(singleNodeMoE.deduplicatedGroupCount).toBeGreaterThan(0);
    expect(singleNodeMoE.logicalGroups.find((g) => g.groupName === "tp")?.deduplicatedInto).toBe("world");
    expect(singleNodeMoE.logicalGroups.find((g) => g.groupName === "mc2")?.bufferSizeMiB).toBeNull();
    expect(singleNodeMoE.logicalGroups.find((g) => g.groupName === "dynamic_eplb")?.bufferSizeMiB).toBe(100);
    expect(
      singleNodeMoE.logicalGroups.find((g) => g.groupName === "sleep_lifecycle_anchor")?.bufferSizeMiB,
    ).toBe(1);
    expect(singleNodeMoE.mc2GovernedByCannBuffsize).toBe(true);
    expect(singleNodeMoE.profileRunOverlap.alreadyIncludedInProfileRun).toBe(true);
    expect(singleNodeMoE.profileRunOverlap.initSnapshotPrecedesDistributedInit).toBe(true);
    expect(singleNodeMoE.profileRunOverlap.underestimationSafetyBufferMiB).toBe(
      HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB,
    );
    expect(
      singleNodeMoE.profileRunOverlap.anchors.some((a) => a.includes("vllm_ascend/_310p/worker_310p.py")),
    ).toBe(true);

    // Main adds pp_broadcast, pp_single_stage, qkv_iproj_tp
    const mainPp = estimateHcclDomainMemory(
      { tpSize: 8, ppSize: 2, dpSize: 2, isMoe: true, qkvIprojTensorParallelSize: 4 },
      "main",
    );
    expect(mainPp.logicalGroups.some((g) => g.groupName === "pp_broadcast")).toBe(true);
    expect(mainPp.logicalGroups.some((g) => g.groupName === "pp_single_stage")).toBe(true);
    expect(mainPp.logicalGroups.some((g) => g.groupName === "qkv_iproj_tp")).toBe(true);
    expect(mainPp.logicalGroups.find((g) => g.groupName === "world")?.source).toContain(
      "c84273be:vllm/distributed/parallel_state.py#L1876",
    );
    expect(mainPp.logicalGroups.find((g) => g.groupName === "tp")?.source).toContain(
      "c84273be:vllm/distributed/parallel_state.py#L2232",
    );
    expect(mainPp.logicalGroups.find((g) => g.groupName === "mc2")?.source).toContain(
      "8d6180e2:vllm_ascend/distributed/parallel_state.py#L195",
    );
  });

  it("remediates P1/P2/P3 findings in Domain 4, Domain 5, and HCCL rank-set deduplication", () => {
    // HCCL dedup 1: single-rank [0] groups pp/pcp/dcp deduplicate under shared -> 551 MiB
    const singleRankDedup = estimateHcclDomainMemory(
      {
        tpSize: 8,
        ppSize: 1,
        dpSize: 1,
        pcpSize: 1,
        dcpSize: 1,
        isMoe: true,
        dynamicEplb: true,
        sleepModeExtraCleanup: true,
      },
      "v0.30.0",
    );
    expect(singleRankDedup.logicalGroups.find((g) => g.groupName === "dcp")?.ranksSignature).toBe("[0]");
    expect(singleRankDedup.logicalGroups.find((g) => g.groupName === "pcp")?.deduplicatedInto).toBe("dcp");
    expect(singleRankDedup.logicalGroups.find((g) => g.groupName === "pp")?.deduplicatedInto).toBe("dcp");
    expect(singleRankDedup.totalMaterializedMiB).toBe(551);

    // HCCL dedup 2: dcp == tp deduplicates into tp
    const dcpEqTp = estimateHcclDomainMemory(
      { tpSize: 2, ppSize: 1, dpSize: 4, pcpSize: 1, dcpSize: 2 },
      "v0.30.0",
    );
    expect(dcpEqTp.logicalGroups.find((g) => g.groupName === "dcp")?.ranksSignature).toBe("[0,1]");
    expect(dcpEqTp.logicalGroups.find((g) => g.groupName === "dcp")?.deduplicatedInto).toBe("tp");

    // HCCL dedup 3: fine-grained DP-axis otp uses [0, 2] and does NOT deduplicate into tp [0, 1]
    const otpDpStride = estimateHcclDomainMemory(
      { tpSize: 2, ppSize: 1, dpSize: 2, oprojTensorParallelSize: 2 },
      "v0.30.0",
    );
    const otpGroup = otpDpStride.logicalGroups.find((g) => g.groupName === "otp");
    expect(otpGroup?.ranksSignature).toBe("[0,2]");
    expect(otpGroup?.deduplicatedInto).toBeUndefined();

    // Domain 4 P1/P2/P3: rfork & main DSA-CP scope, rfork finegrained_tp, pcp==1 SFA indexer, numKvHeads=0, MHA C8, DSpark/topk
    expect(
      evaluateDomain4Rules({ enableDsaCp: true, pcpSize: 2, useV2ModelRunner: true }, "main"),
    ).toHaveLength(0);
    expect(
      evaluateDomain4Rules({ enableDsaCp: true, pcpSize: 2, useV2ModelRunner: true }, "rfork").some(
        (m) => m.ruleId === "d4-dsa-cp-mrv2-v030" || m.ruleId === "d4-dsa-cp-pcp-mutex",
      ),
    ).toBe(false);

    const rforkEmbedTp = evaluateDomain4Rules(
      { embeddingTensorParallelSize: 2, recomputeSchedulerEnable: false },
      "rfork",
    );
    expect(rforkEmbedTp.some((m) => m.ruleId === "d4-finegrained-tp-requires-recompute")).toBe(true);
    expect(
      evaluateDomain4Rules({ mlpTensorParallelSize: 2, recomputeSchedulerEnable: false }, "rfork"),
    ).toHaveLength(0);

    const sfaPcp1 = evaluateDomain4Rules(
      { tpSize: 8, pcpSize: 1, dcpSize: 4, useMla: true, sfaDcpReplicatedIndexer: true },
      "v0.30.0",
    );
    expect(sfaPcp1.some((m) => m.ruleId === "d4-pcp-dcp-sizing" && m.judgment === "error")).toBe(true);

    const zeroKvHeads = evaluateDomain4Rules(
      { tpSize: 4, dcpSize: 2, useMla: false, numKvHeads: 0 },
      "v0.30.0",
    );
    expect(zeroKvHeads.find((m) => m.ruleId === "d4-pcp-dcp-sizing")?.message).not.toContain("Infinity");

    const mhaMooncake = evaluateDomain4Rules(
      {
        kvConnector: "MooncakeConnectorV1",
        enableC8Quant: true,
        useMla: false,
        numAttentionHeads: 32,
        numKvHeads: 32,
      },
      "v0.30.0",
    );
    expect(mhaMooncake.some((m) => m.ruleId === "d4-mooncake-gqa-c8-forbidden")).toBe(false);

    const sparseDsparkTopk = evaluateDomain4Rules(
      {
        sparseKvOffloadEnabled: true,
        kvRole: "kv_consumer",
        indexTopk: 2048,
        topkBufferSize: 1024,
        speculativeMethod: "dspark",
        useV2ModelRunner: false,
      },
      "v0.30.0",
    );
    const sparseMsg =
      sparseDsparkTopk.find((m) => m.ruleId === "d4-sparse-kv-offload-constraints")?.message ?? "";
    expect(sparseMsg).toContain("DSpark");
    expect(sparseMsg).toContain("topk_buffer_size");

    // Domain 5 P1/P2/Minor: rfork parity, short_request_first ValueError mutex, static_kernel contradiction, RL no-op
    expect(evaluateDomain5Rules({ rlEnabled: true }, "rfork")).toHaveLength(0);
    expect(evaluateDomain5Rules({ enableStaticKernel: true, enableNpugraphEx: false }, "rfork")).toHaveLength(
      0,
    );
    expect(evaluateDomain5Rules({ rlEnabled: true, weightNzMode: 0 }, "v0.30.0")).toHaveLength(0);

    const staticPiecewise = evaluateDomain5Rules(
      { hardwareFamily: "A3", enableNpugraphEx: true, enableStaticKernel: true, cudagraphMode: "PIECEWISE" },
      "v0.30.0",
    );
    expect(staticPiecewise.some((m) => m.ruleId === "d5-static-kernel-defaults-super-kernel")).toBe(false);
    expect(staticPiecewise.some((m) => m.ruleId === "d5-graph-mode-resets-npugraph-ex")).toBe(true);

    const srfBatchConflict = evaluateDomain5Rules(
      { shortRequestFirstEnabled: true, batchJobSchedEnabled: true },
      "v0.30.0",
    );
    expect(
      srfBatchConflict.some(
        (m) => m.ruleId === "d5-short-request-first-scheduler-mutex" && m.judgment === "error",
      ),
    ).toBe(true);
    expect(srfBatchConflict.some((m) => m.ruleId === "d5-scheduler-override-chain-v030")).toBe(false);

    const srfCppRfork = evaluateDomain5Rules(
      { shortRequestFirstEnabled: true, profilingChunkEnabled: true },
      "rfork",
    );
    expect(
      srfCppRfork.some(
        (m) => m.ruleId === "d5-short-request-first-scheduler-mutex" && m.judgment === "error",
      ),
    ).toBe(true);
    expect(srfCppRfork.some((m) => m.ruleId === "d5-scheduler-override-chain-v030")).toBe(false);

    // P2 (ANOMALY_DYNTRA_CPP_V030): dyntra_lb + profiling_chunk_config raises ValueError in v0.30.0
    for (const dyntraCppInput of [
      { dyntraLbEnabled: true, profilingChunkEnabled: true },
      { dyntraLbEnabled: true, profilingChunkEnabled: true, kvRole: "kv_consumer" as const },
    ]) {
      const dyntraCpp = evaluateDomain5Rules(dyntraCppInput, "v0.30.0");
      const dyntraErr = dyntraCpp.find((m) => m.ruleId === "d5-dyntra-lb-profiling-chunk-mutex");
      expect(dyntraErr?.judgment).toBe("error");
      expect(dyntraErr?.sources).toEqual(["vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1086-L1114"]);
      expect(dyntraCpp.some((m) => m.ruleId === "d5-scheduler-override-chain-v030")).toBe(false);
    }

    const dyntraCppBatch = evaluateDomain5Rules(
      { dyntraLbEnabled: true, profilingChunkEnabled: true, batchJobSchedEnabled: true },
      "v0.30.0",
    );
    expect(
      dyntraCppBatch.some((m) => m.ruleId === "d5-dyntra-lb-profiling-chunk-mutex" && m.judgment === "error"),
    ).toBe(true);
    const dyntraCppBatchOverride = dyntraCppBatch.find(
      (m) => m.ruleId === "d5-scheduler-override-chain-v030",
    );
    expect(dyntraCppBatchOverride?.message ?? "").not.toContain("dyntra_lb");
    expect(dyntraCppBatchOverride?.effectiveMutation?.effectiveSchedulerCls).not.toBe(
      "ProfilingChunkScheduler",
    );
    expect(
      evaluateDomain5Rules({ dyntraLbEnabled: true, profilingChunkEnabled: true }, "main").some(
        (m) => m.ruleId === "d5-scheduler-override-chain-main",
      ),
    ).toBe(false);

    // P3-1 (ANOMALY_SRF_D_NODE_V030): short_request_first + kv_role='kv_consumer' raises ValueError across all 3 versions
    const expectedSrfSources = {
      "v0.30.0": ["vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1052-L1069"],
      main: ["vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1237-L1254"],
      rfork: ["rfork@3284850b:vllm_ascend/platform.py#L648-L670"],
    } as const;
    for (const version of ["v0.30.0", "main", "rfork"] as const) {
      const srfDNode = evaluateDomain5Rules(
        { shortRequestFirstEnabled: true, profilingChunkEnabled: true, kvRole: "kv_consumer" },
        version,
      );
      const srfErr = srfDNode.find((m) => m.ruleId === "d5-short-request-first-scheduler-mutex");
      expect(srfErr?.judgment).toBe("error");
      expect(srfErr?.sources).toEqual(expectedSrfSources[version]);
      expect(
        srfDNode.some(
          (m) =>
            m.ruleId === "d5-scheduler-override-chain-v030" ||
            m.ruleId === "d5-scheduler-override-chain-main",
        ),
      ).toBe(false);
    }

    const srfRecomputeChain = evaluateDomain5Rules(
      {
        shortRequestFirstEnabled: true,
        recomputeSchedulerEnable: true,
        profilingChunkEnabled: true,
        kvRole: "kv_consumer",
      },
      "v0.30.0",
    );
    expect(
      srfRecomputeChain.some(
        (m) => m.ruleId === "d5-short-request-first-scheduler-mutex" && m.judgment === "error",
      ),
    ).toBe(true);
    expect(
      srfRecomputeChain.find((m) => m.ruleId === "d5-scheduler-override-chain-v030")?.message ?? "",
    ).not.toContain("short_request_first");
  });

  it("Audit Wave 6 regressions: RLConfig Step 10 re-appends expandable_segments when !enableSleepMode, and fused_mc2 hint mentions 3 (main)", () => {
    // Bug 2: enableSleepMode=true keeps expandable_segments stripped
    const rlWithSleep = evaluateDomain5Rules(
      {
        rlEnabled: true,
        enableSleepMode: true,
        weightNzMode: 1,
        pytorchNpuAllocConf: "page_size:1g,expandable_segments:True",
      },
      "v0.30.0",
    );
    const matchSleep = rlWithSleep.find(
      (m) => m.ruleId === "d5-rl-config-disables-nz-and-expandable-segments",
    );
    expect(matchSleep?.effectiveMutation?.weightNzMode).toBe(0);
    expect(matchSleep?.effectiveMutation?.pytorchNpuAllocConf).toBe("page_size:1g");

    // Bug 2: enableSleepMode=false -> Step 10 _set_pytorch_npu_alloc_env() re-appends expandable_segments:True
    const rlNoSleep = evaluateDomain5Rules(
      {
        rlEnabled: true,
        enableSleepMode: false,
        weightNzMode: 1,
        pytorchNpuAllocConf: "page_size:1g,expandable_segments:True",
      },
      "v0.30.0",
    );
    const matchNoSleep = rlNoSleep.find(
      (m) => m.ruleId === "d5-rl-config-disables-nz-and-expandable-segments",
    );
    expect(matchNoSleep?.effectiveMutation?.weightNzMode).toBe(0);
    expect(matchNoSleep?.effectiveMutation?.pytorchNpuAllocConf).toBe(
      "page_size:1g,expandable_segments:True",
    );
    expect(matchNoSleep?.message).toContain("_set_pytorch_npu_alloc_env");

    // Bug 3: retired VLLM_ASCEND_ENABLE_FUSED_MC2 hint includes 3 (main)
    const retiredFused = classifyEnvVar("VLLM_ASCEND_ENABLE_FUSED_MC2", "v0.30.0");
    expect(retiredFused.replacement).toContain("3");
    expect(retiredFused.replacement).toContain("main");
  });
});
