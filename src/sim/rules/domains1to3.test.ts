import { describe, expect, it } from "vitest";
import {
  calculateMc2TokensCapacity,
  evaluateDomain1Rules,
  evaluateDomain2Rules,
  evaluateDomain3Rules,
  isFusedMc2SilentlyReset,
  isMegaMoeActive,
  resolveDefaultBatchTokens,
  selectMoeCommMethod,
} from "./index";

describe("Domain 1: Parallelism & 4-Family MoE Strategy", () => {
  it("detects TP AllReduce/AllGather and PP async send/recv", () => {
    const matches = evaluateDomain1Rules({ tpSize: 8, ppSize: 2 }, "v0.30.0");
    expect(matches.some((m) => m.ruleId === "d1-tp-collective-pattern")).toBe(true);
    expect(matches.some((m) => m.ruleId === "d1-pp-async-send-recv")).toBe(true);
  });

  it("handles SP + PP>1 +rms_norm rewrite in v0.30.0 vs removal in main", () => {
    const v030Rewrite = evaluateDomain1Rules({ tpSize: 4, ppSize: 2, enableSp: true }, "v0.30.0");
    const rewriteMatch = v030Rewrite.find((m) => m.ruleId === "d1-sp-pp-rms-norm-rewrite");
    expect(rewriteMatch?.judgment).toBe("silent-rewrite");
    expect(rewriteMatch?.effectiveMutation?.customOpsAppended).toBe("+rms_norm");

    const v030Warn = evaluateDomain1Rules(
      { tpSize: 4, ppSize: 2, enableSp: true, customOps: ["-rms_norm"] },
      "v0.30.0",
    );
    expect(v030Warn.find((m) => m.ruleId === "d1-sp-pp-rms-norm-rewrite")?.judgment).toBe("warn");

    const mainMatches = evaluateDomain1Rules({ tpSize: 4, ppSize: 2, enableSp: true }, "main");
    expect(mainMatches.some((m) => m.ruleId === "d1-sp-pp-rms-norm-rewrite")).toBe(false);
    expect(mainMatches.some((m) => m.ruleId === "d1-sp-pp-removed-in-main")).toBe(true);
  });

  it("enforces Ascend SP preconditions and main FlashComm1/quantized_all_reduce exclusion", () => {
    // ADV-2a/2b: PassConfig.enable_sp does NOT activate vllm_ascend.utils.enable_sp() in v0.30.0 or rfork.
    const passSpV030 = evaluateDomain1Rules({ tpSize: 1, enableSp: true }, "v0.30.0");
    expect(passSpV030.some((m) => m.ruleId === "d1-ascend-sp-tp-gt-1")).toBe(false);
    const passSpRfork = evaluateDomain1Rules({ tpSize: 1, enableSp: true }, "rfork");
    expect(passSpRfork.some((m) => m.ruleId === "d1-ascend-sp-tp-gt-1")).toBe(false);

    const tp1V030 = evaluateDomain1Rules({ tpSize: 1, useSequenceParallelMoe: true }, "v0.30.0");
    expect(tp1V030.some((m) => m.ruleId === "d1-ascend-sp-tp-gt-1" && m.judgment === "error")).toBe(true);
    const tp1Main = evaluateDomain1Rules({ tpSize: 1, useSequenceParallelMoe: true }, "main");
    expect(tp1Main.some((m) => m.ruleId === "d1-ascend-sp-tp-gt-1" && m.judgment === "error")).toBe(true);
    const tp1Rfork = evaluateDomain1Rules({ tpSize: 1, enableFlashcomm1: true }, "rfork");
    expect(tp1Rfork.some((m) => m.ruleId === "d1-ascend-sp-tp-gt-1" && m.judgment === "error")).toBe(true);
    expect(
      evaluateDomain1Rules({ tpSize: 1, useSequenceParallelMoe: true }, "rfork").some(
        (m) => m.ruleId === "d1-ascend-sp-tp-gt-1",
      ),
    ).toBe(false);

    const moeNoEp = evaluateDomain1Rules(
      { tpSize: 4, isMoe: true, enableExpertParallel: false, useSequenceParallelMoe: true },
      "v0.30.0",
    );
    expect(moeNoEp.some((m) => m.ruleId === "d1-ascend-sp-moe-requires-ep")).toBe(true);
    expect(
      evaluateDomain1Rules(
        { tpSize: 4, isMoe: true, enableExpertParallel: false, enableSp: true },
        "v0.30.0",
      ).some((m) => m.ruleId === "d1-ascend-sp-moe-requires-ep"),
    ).toBe(false);
    expect(
      evaluateDomain1Rules(
        { tpSize: 4, isMoe: true, enableExpertParallel: false, enableSp: true },
        "rfork",
      ).some((m) => m.ruleId === "d1-ascend-sp-moe-requires-ep"),
    ).toBe(false);
    expect(
      evaluateDomain1Rules(
        { tpSize: 4, isMoe: true, enableExpertParallel: false, enableFlashcomm1: true },
        "rfork",
      ).some((m) => m.ruleId === "d1-ascend-sp-moe-requires-ep" && m.judgment === "error"),
    ).toBe(true);

    const flashDisabled = evaluateDomain1Rules(
      { tpSize: 4, ppSize: 2, isMoe: true, enableExpertParallel: true, enableFlashcomm1: true },
      "v0.30.0",
    );
    expect(flashDisabled.some((m) => m.ruleId === "d1-flashcomm1-unsupported-disable")).toBe(true);
    expect(
      evaluateDomain1Rules(
        { tpSize: 4, ppSize: 2, isMoe: true, enableExpertParallel: true, enableFlashcomm1: true },
        "rfork",
      ).some((m) => m.ruleId === "d1-flashcomm1-unsupported-disable"),
    ).toBe(false);

    const mainQuantDisable = evaluateDomain1Rules(
      {
        tpSize: 4,
        ppSize: 1,
        isMoe: true,
        enableExpertParallel: true,
        enableFlashcomm1: true,
        useSequenceParallelMoe: true,
        quantizedAllReduceEnabled: true,
      },
      "main",
    );
    expect(mainQuantDisable.some((m) => m.ruleId === "d1-flashcomm1-disables-quantized-ar")).toBe(true);

    // P3-2: d1-ascend-sp-tp-gt-1 and d1-ascend-sp-moe-requires-ep emit strictly version-scoped sources
    const expectedSpPrefix = {
      "v0.30.0": "vllm-ascend@c09d3e20:",
      main: "vllm-ascend@8d6180e2:",
      rfork: "rfork@3284850b:",
    } as const;
    for (const version of ["v0.30.0", "main", "rfork"] as const) {
      const tp1Sp = evaluateDomain1Rules(
        version === "rfork"
          ? { tpSize: 1, enableFlashcomm1: true }
          : { tpSize: 1, useSequenceParallelMoe: true },
        version,
      ).find((m) => m.ruleId === "d1-ascend-sp-tp-gt-1");
      expect(tp1Sp).toBeDefined();
      expect(tp1Sp?.sources.length).toBeGreaterThan(0);
      expect(tp1Sp?.sources.every((s) => s.startsWith(expectedSpPrefix[version]))).toBe(true);

      const moeNoEpSp = evaluateDomain1Rules(
        version === "rfork"
          ? { tpSize: 4, isMoe: true, enableExpertParallel: false, enableFlashcomm1: true }
          : { tpSize: 4, isMoe: true, enableExpertParallel: false, useSequenceParallelMoe: true },
        version,
      ).find((m) => m.ruleId === "d1-ascend-sp-moe-requires-ep");
      expect(moeNoEpSp).toBeDefined();
      expect(moeNoEpSp?.sources.length).toBeGreaterThan(0);
      expect(moeNoEpSp?.sources.every((s) => s.startsWith(expectedSpPrefix[version]))).toBe(true);
    }
  });

  it("flags cross-node RoCE PP>1 & DP>1 MoE exclusion while noting no startup Python check", () => {
    const crossNode = evaluateDomain1Rules(
      { isMoe: true, ppSize: 2, dpSize: 2, crossNodeRoce: true },
      "v0.30.0",
    );
    const err = crossNode.find((m) => m.ruleId === "d1-roce-pp-dp-moe-exclusion");
    expect(err?.judgment).toBe("error");
    expect(err?.message).toContain("NO Python startup check");

    const singleNode = evaluateDomain1Rules(
      { isMoe: true, ppSize: 2, dpSize: 2, crossNodeRoce: false },
      "v0.30.0",
    );
    expect(singleNode.some((m) => m.ruleId === "d1-roce-pp-dp-moe-exclusion")).toBe(false);
  });

  it("selects 4-family MoE communication strategies and version diffs", () => {
    // No EP -> ALLGATHER
    expect(
      selectMoeCommMethod({ isMoe: true, enableExpertParallel: false, tpSize: 4, dpSize: 2 }).method,
    ).toBe("ALLGATHER");

    // LoRA + EP -> ALLTOALL
    expect(
      selectMoeCommMethod({
        hardwareFamily: "A3",
        isMoe: true,
        enableExpertParallel: true,
        isLoraEnabled: true,
        tpSize: 4,
        dpSize: 4,
      }).method,
    ).toBe("ALLTOALL");

    // 310P -> always ALLGATHER
    expect(
      selectMoeCommMethod({
        hardwareFamily: "310P",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 8,
        dpSize: 2,
      }).method,
    ).toBe("ALLGATHER");

    // A2: <=24 experts/dev, >=16 ep, within capacity -> MC2; exceeding capacity -> ALLGATHER; rfork >512 -> ALLGATHER
    expect(
      selectMoeCommMethod({
        hardwareFamily: "A2",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 8,
        dpSize: 2,
        numExperts: 256,
        maxNumSeqs: 64,
        numTokens: 64,
      }).method,
    ).toBe("MC2");
    expect(
      selectMoeCommMethod({
        hardwareFamily: "A2",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 8,
        dpSize: 2,
        numExperts: 256,
        maxNumSeqs: 64,
        numTokens: 512,
      }).method,
    ).toBe("ALLGATHER");
    expect(
      selectMoeCommMethod(
        {
          hardwareFamily: "A2",
          isMoe: true,
          enableExpertParallel: true,
          tpSize: 8,
          dpSize: 4,
          numExperts: 513,
          numTokens: 128,
        },
        "rfork",
      ).method,
    ).toBe("ALLGATHER");

    // A3: MegaMoe / enable_fused_mc2<=32 / MC2 / ALLTOALL + silent reset
    expect(
      selectMoeCommMethod(
        {
          hardwareFamily: "A3",
          isMoe: true,
          enableExpertParallel: true,
          tpSize: 8,
          dpSize: 2,
          enableFusedMc2: 1,
        },
        "v0.30.0",
      ).method,
    ).toBe("FUSED_MC2");
    expect(
      selectMoeCommMethod({
        hardwareFamily: "A3",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 8,
        dpSize: 2,
        maxCudagraphCaptureSize: 512,
        numTokens: 2048,
      }).method,
    ).toBe("ALLTOALL");

    const resetMatches = evaluateDomain1Rules(
      {
        hardwareFamily: "A3",
        isMoe: true,
        enableExpertParallel: true,
        enableFusedMc2: 1,
        isMegaMoeSupportedByModel: true,
        isMegaMoeSupportedByConfig: false,
      },
      "v0.30.0",
    );
    expect(resetMatches.some((m) => m.ruleId === "d1-fused-mc2-silent-reset")).toBe(true);

    // A5 / 950: v0.30.0 uses world_size_across_dp (with PP), main uses world_size_across_dp // pp
    const a5V030 = selectMoeCommMethod(
      {
        hardwareFamily: "A5",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 2,
        dpSize: 2,
        ppSize: 2,
        numExpertsPerTok: 6,
        maxCudagraphCaptureSize: 256,
        numTokens: 9999,
      },
      "v0.30.0",
    );
    // world_size_across_dp = 8 > 6 -> ALLTOALL in v0.30.0
    expect(a5V030.usedWorldSizeAcrossDpBug).toBe(true);
    expect(a5V030.method).toBe("ALLTOALL");

    const a5Main = selectMoeCommMethod(
      {
        hardwareFamily: "A5",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 2,
        dpSize: 2,
        ppSize: 2,
        numExpertsPerTok: 6,
        maxCudagraphCaptureSize: 256,
        numTokens: 9999,
      },
      "main",
    );
    // ep_world_size = 4 <= 6 -> ALLGATHER in main
    expect(a5Main.usedWorldSizeAcrossDpBug).toBe(false);
    expect(a5Main.method).toBe("ALLGATHER");
  });

  it("calculates dynamic MC2 capacity across v0.30.0, main decode shapes, and rfork 4096 limit", () => {
    const capMain = calculateMc2TokensCapacity(
      {
        hardwareFamily: "A5",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 8,
        decodeCudagraphCaptureRequestSizes: [
          { numReqs: 32, queryLen: 4 },
          { numReqs: 64, queryLen: 2 },
        ],
        maxPrefillCudagraphCaptureTokens: 64,
        maxDecodeCudagraphCaptureTokens: 256,
      },
      "main",
    );
    expect(capMain.usedDecodeRequestShapes).toBe(true);
    expect(capMain.mc2TokensCapacity).toBe(128);

    const capV030Mega = calculateMc2TokensCapacity(
      {
        hardwareFamily: "A3",
        isMoe: true,
        enableExpertParallel: true,
        enableFusedMc2: 1,
        tpSize: 8,
        dpSize: 2,
        maxNumBatchedTokens: 131072,
      },
      "v0.30.0",
    );
    expect(capV030Mega.perRankLimit).toBe(16384);

    const capRfork = calculateMc2TokensCapacity(
      {
        hardwareFamily: "A3",
        isMoe: true,
        enableExpertParallel: true,
        enableFusedMc2: 1,
        enablePrefillMc2: true,
        tpSize: 8,
        dpSize: 2,
        maxNumBatchedTokens: 131072,
      },
      "rfork",
    );
    // rfork hardcodes use_cann_megamoe = False -> 512 limit
    expect(capRfork.usedMegaMoeLimit).toBe(false);
    expect(capRfork.perRankLimit).toBe(512);
  });

  it("flags idle DP dummy batch synchronization when dpSize > 1", () => {
    const matches = evaluateDomain1Rules({ dpSize: 4, isMoe: true }, "v0.30.0");
    expect(matches.some((m) => m.ruleId === "d1-idle-dp-dummy-batch")).toBe(true);
  });
});

describe("Domain 2: max_num_batched_tokens (P1-4 #1) & PP / CPP", () => {
  it("resolves 2048 (vllm_serve) / 8192 (llm_class) for ALL Ascend cards including 950DT due to NotImplementedError", () => {
    for (const family of ["A2", "A3", "310P", "A5"] as const) {
      const serve = resolveDefaultBatchTokens({ hardwareFamily: family, usageContext: "vllm_serve" });
      expect(serve.deviceMemoryFallbackTriggered).toBe(true);
      expect(serve.deviceMemoryBytes).toBe(0);
      expect(serve.finalMaxNumBatchedTokens).toBe(2048);
      expect(serve.finalMaxNumSeqs).toBe(256);

      const llm = resolveDefaultBatchTokens({ hardwareFamily: family, usageContext: "llm_class" });
      expect(llm.finalMaxNumBatchedTokens).toBe(8192);
      expect(llm.finalMaxNumSeqs).toBe(256);
    }
  });

  it("implements all 6 arg_utils branches and SP+PCP silent ceiling", () => {
    // 1. use_batched_dp_moe -> 256 (throughput doubles to 512)
    const batchedDp = resolveDefaultBatchTokens({
      useBatchedDpMoe: true,
      usageContext: "vllm_serve",
    });
    expect(batchedDp.finalMaxNumBatchedTokens).toBe(256);

    // 2. performance_mode = throughput -> x2
    const throughput = resolveDefaultBatchTokens({
      usageContext: "vllm_serve",
      performanceMode: "throughput",
    });
    expect(throughput.finalMaxNumBatchedTokens).toBe(4096);
    expect(throughput.finalMaxNumSeqs).toBe(512);

    // 3. enable_chunked_prefill = false -> max(max_model_len, cur)
    const noChunked = resolveDefaultBatchTokens({
      usageContext: "vllm_serve",
      enableChunkedPrefill: false,
      maxModelLen: 32768,
    });
    expect(noChunked.finalMaxNumBatchedTokens).toBe(32768);

    // 4. multimodal prefix-LM floor
    const mmFloor = resolveDefaultBatchTokens({
      usageContext: "vllm_serve",
      isMultimodalModel: true,
      isMmPrefixLm: true,
      minMmBatchedTokens: 4096,
      maxModelLen: 32768,
    });
    expect(mmFloor.finalMaxNumBatchedTokens).toBe(4096);

    // 5. cap by max_num_seqs * max_model_len & clamp max_num_seqs <= max_num_batched_tokens
    const capped = resolveDefaultBatchTokens({
      usageContext: "llm_class",
      maxModelLen: 16,
    });
    expect(capped.finalMaxNumBatchedTokens).toBe(256 * 16);
    expect(capped.finalMaxNumSeqs).toBe(256);

    const clampedSeqs = resolveDefaultBatchTokens({
      usageContext: "vllm_serve",
      maxNumBatchedTokens: 128,
    });
    expect(clampedSeqs.finalMaxNumSeqs).toBe(128);

    // 6. Ascend SP + PCP silent ceiling to multiple of tp * pcp (PassConfig.enable_sp does NOT trigger it)
    const spPcp = resolveDefaultBatchTokens({
      tpSize: 4,
      pcpSize: 3,
      isMoe: true,
      enableExpertParallel: true,
      enableFlashcomm1: true,
      maxNumBatchedTokens: 2050,
    });
    expect(spPcp.spPcpRounded).toBe(true);
    expect(spPcp.spPcpDivisor).toBe(12);
    expect(spPcp.finalMaxNumBatchedTokens).toBe(2052);

    // ADV-2c/2d: PassConfig.enable_sp alone must not trigger SP+PCP rounding in v0.30.0 or rfork
    const passSpV030 = resolveDefaultBatchTokens(
      { tpSize: 4, pcpSize: 3, enableSp: true, maxNumBatchedTokens: 2050 },
      "v0.30.0",
    );
    expect(passSpV030.spPcpRounded).toBe(false);
    expect(passSpV030.finalMaxNumBatchedTokens).toBe(2050);

    const passSpRfork = resolveDefaultBatchTokens(
      { tpSize: 4, pcpSize: 3, enableSp: true, maxNumBatchedTokens: 2050 },
      "rfork",
    );
    expect(passSpRfork.spPcpRounded).toBe(false);
    expect(passSpRfork.finalMaxNumBatchedTokens).toBe(2050);

    const denseDsaCpOnly = resolveDefaultBatchTokens(
      { tpSize: 4, pcpSize: 3, isQwen35Dense: true, enableDsaCp: true, maxNumBatchedTokens: 2050 },
      "v0.30.0",
    );
    expect(denseDsaCpOnly.spPcpRounded).toBe(false);
  });

  it("handles chunked-prefill decode budget, PP non-last reduction, and CPP v0.30.0 vs main", () => {
    const chunked = evaluateDomain2Rules({ maxNumBatchedTokens: 2048, numSpecTokens: 3 }, "v0.30.0");
    const chunkedMatch = chunked.find((m) => m.ruleId === "d2-chunked-prefill-decode-budget");
    expect(chunkedMatch?.effectiveMutation?.perDecodeTokenDeduction).toBe(4);

    const pp = evaluateDomain2Rules({ ppSize: 4 }, "v0.30.0");
    expect(pp.some((m) => m.ruleId === "d2-pp-non-last-stage-memory-reduction")).toBe(true);

    const cppPp1 = evaluateDomain2Rules({ profilingChunkEnabled: true, ppSize: 1 }, "v0.30.0");
    expect(cppPp1.some((m) => m.ruleId === "d2-cpp-requires-pp-gt-1" && m.judgment === "error")).toBe(true);

    const cppClamp = evaluateDomain2Rules(
      { profilingChunkEnabled: true, ppSize: 2, maxNumBatchedTokens: 2048, profilingMinChunk: 4096 },
      "v0.30.0",
    );
    expect(cppClamp.some((m) => m.ruleId === "d2-cpp-min-chunk-clamp")).toBe(true);
    expect(cppClamp.some((m) => m.ruleId === "d2-cpp-quadratic-chunk-2x-4x")).toBe(true);

    const cppMain = evaluateDomain2Rules({ profilingChunkEnabled: true, ppSize: 2 }, "main");
    expect(cppMain.some((m) => m.ruleId === "d2-cpp-removed-in-main" && m.judgment === "error")).toBe(true);
  });
});

describe("Domain 3: Native FP8 / MXFP8 & Hybrid KV Quantization", () => {
  it("rejects native FP8 without weight_block_size or with non-dynamic activation_scheme", () => {
    const noBlock = evaluateDomain3Rules({ quantMethod: "fp8", hasWeightBlockSize: false }, "v0.30.0");
    expect(
      noBlock.some((m) => m.ruleId === "d3-fp8-missing-weight-block-size" && m.judgment === "error"),
    ).toBe(true);

    const staticAct = evaluateDomain3Rules(
      { quantMethod: "fp8", hasWeightBlockSize: true, activationScheme: "static" },
      "v0.30.0",
    );
    expect(
      staticAct.some((m) => m.ruleId === "d3-fp8-non-dynamic-activation" && m.judgment === "error"),
    ).toBe(true);
  });

  it("models block-wise FP8 on 950 vs A2/A3 silent-rewrite (v0.30.0) / error (main) vs 310P unsupported", () => {
    const a5Normal = evaluateDomain3Rules(
      { quantMethod: "fp8", hasWeightBlockSize: true, hardwareFamily: "A5", inFeatures: 4096 },
      "v0.30.0",
    );
    expect(
      a5Normal.find((m) => m.ruleId === "d3-fp8-block-950-mxfp8")?.effectiveMutation?.resolvedWeightFormat,
    ).toBe("mxfp8");

    const a5Kvb = evaluateDomain3Rules(
      { quantMethod: "fp8", hasWeightBlockSize: true, hardwareFamily: "A5", isKvBProj: true },
      "v0.30.0",
    );
    expect(
      a5Kvb.find((m) => m.ruleId === "d3-fp8-block-950-mxfp8")?.effectiveMutation?.bytesPerElemApprox,
    ).toBe(2);

    for (const family of ["A2", "A3"] as const) {
      const v030Matches = evaluateDomain3Rules(
        { quantMethod: "fp8", hasWeightBlockSize: true, hardwareFamily: family },
        "v0.30.0",
      );
      const dequantMatch = v030Matches.find((m) => m.ruleId === "d3-fp8-block-non950-bf16-v030");
      expect(dequantMatch?.judgment).toBe("silent-rewrite");
      expect(dequantMatch?.effectiveMutation?.resolvedWeightFormat).toBe("bfloat16");
      expect(dequantMatch?.effectiveMutation?.bytesPerElemApprox).toBe(2);

      const mainMatches = evaluateDomain3Rules(
        { quantMethod: "fp8", hasWeightBlockSize: true, hardwareFamily: family },
        "main",
      );
      expect(
        mainMatches.some((m) => m.ruleId === "d3-fp8-block-non950-error-main" && m.judgment === "error"),
      ).toBe(true);
    }

    // P2-1: 310P uses QuantizationBackendFamily.COMPATIBILITY (does not register AscendFp8Config; FP16 dtype),
    // so native FP8 has no Ascend execution path and is unsupported (never silently dequantized to BF16).
    const p310V030 = evaluateDomain3Rules(
      { quantMethod: "fp8", hasWeightBlockSize: true, hardwareFamily: "310P" },
      "v0.30.0",
    );
    expect(p310V030.some((m) => m.ruleId === "d3-fp8-block-non950-bf16-v030")).toBe(false);
    expect(p310V030.some((m) => m.judgment === "silent-rewrite")).toBe(false);
    const p310V030Err = p310V030.find((m) => m.ruleId === "d3-fp8-310p-unsupported");
    expect(p310V030Err?.judgment).toBe("error");
    expect(p310V030Err?.message).toContain("COMPATIBILITY");
    expect(p310V030Err?.message).toContain("AscendFp8Config");
    expect(p310V030Err?.message).toContain("FP16");
    expect(p310V030Err?.sources).toContain("vllm-ascend@c09d3e20:vllm_ascend/platform.py#L341-L349");
    expect(p310V030Err?.sources).toContain(
      "vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L310-L332",
    );

    const p310Main = evaluateDomain3Rules(
      { quantMethod: "fp8", hasWeightBlockSize: true, hardwareFamily: "310P" },
      "main",
    );
    expect(p310Main.some((m) => m.ruleId === "d3-fp8-block-non950-error-main")).toBe(false);
    const p310MainErr = p310Main.find((m) => m.ruleId === "d3-fp8-310p-unsupported");
    expect(p310MainErr?.judgment).toBe("error");
    expect(p310MainErr?.sources).toContain("vllm-ascend@8d6180e2:vllm_ascend/platform.py#L425-L433");
    expect(p310MainErr?.sources).toContain(
      "vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L417-L440",
    );

    // 310P rejects native FP8 via COMPATIBILITY backend even without weight_block_size or with static activation
    const p310NoBlock = evaluateDomain3Rules(
      { quantMethod: "fp8", hasWeightBlockSize: false, activationScheme: "static", hardwareFamily: "310P" },
      "v0.30.0",
    );
    expect(p310NoBlock).toHaveLength(1);
    expect(p310NoBlock[0]?.ruleId).toBe("d3-fp8-310p-unsupported");
    expect(p310NoBlock[0]?.judgment).toBe("error");
  });

  it("validates W8A8_MIX scheme and MXFP8 C8 KV 512-multiple block_size", () => {
    const dNode = evaluateDomain3Rules({ quantScheme: "W8A8_MIX", kvRole: "kv_consumer" }, "v0.30.0");
    expect(dNode[0]?.effectiveMutation?.w8a8MixRuntimePath).toBe("static-w8a8");

    const typo = evaluateDomain3Rules({ quantScheme: "W8A8_PDMIX" }, "v0.30.0");
    expect(typo[0]?.judgment).toBe("error");

    const c8UserErr = evaluateDomain3Rules(
      { cacheDtype: "mxfp8", blockSize: 128, userSpecifiedBlockSize: true },
      "v0.30.0",
    );
    expect(c8UserErr[0]?.judgment).toBe("error");

    const c8AutoRewrite = evaluateDomain3Rules(
      { cacheDtype: "mxfp8", blockSize: 128, userSpecifiedBlockSize: false },
      "v0.30.0",
    );
    expect(c8AutoRewrite[0]?.judgment).toBe("silent-rewrite");
    expect(c8AutoRewrite[0]?.effectiveMutation?.blockSize).toBe(512);
  });

  it("checks TurboQuant 4-bit Route A (SFA) and Route B (DeepSeek V4) across v0.30.0 and main", () => {
    // Route A: CP allowed, rejects enableSparseSfaC8 & xlite
    const routeAGood = evaluateDomain3Rules(
      {
        cacheDtype: "turboquant_4bit_nc",
        hardwareFamily: "A3",
        modelDtype: "bfloat16",
        usesSfaSparse: true,
        kvLoraRank: 512,
        qkRopeHeadDim: 64,
        pcpSize: 2,
      },
      "v0.30.0",
    );
    expect(routeAGood.length).toBe(0);

    const routeABad = evaluateDomain3Rules(
      {
        cacheDtype: "turboquant_4bit_nc",
        hardwareFamily: "A5",
        modelDtype: "float16",
        usesSfaSparse: true,
        enableSparseSfaC8: true,
        xliteEnabled: true,
      },
      "v0.30.0",
    );
    expect(routeABad.some((m) => m.ruleId === "d3-turboquant-common-preconditions")).toBe(true);
    expect(routeABad.some((m) => m.ruleId === "d3-turboquant-route-a-sfa")).toBe(true);

    // Route B: MRV2 required in v0.30.0, removed in main
    const routeBV030 = evaluateDomain3Rules(
      {
        cacheDtype: "turboquant_4bit_nc",
        hardwareFamily: "A2",
        modelDtype: "bfloat16",
        usesSfaSparse: false,
        modelType: "deepseek_v4",
        headDim: 512,
        qkRopeHeadDim: 64,
        indexTopk: 1024,
        indexerKvDtype: "int8",
        numAttentionHeads: 64,
        tpSize: 4,
        useV2ModelRunner: false,
      },
      "v0.30.0",
    );
    expect(routeBV030.some((m) => m.ruleId === "d3-turboquant-route-b-mrv2-v030")).toBe(true);

    const routeBMain = evaluateDomain3Rules(
      {
        cacheDtype: "turboquant_4bit_nc",
        hardwareFamily: "A2",
        modelDtype: "bfloat16",
        usesSfaSparse: false,
        modelType: "deepseek_v4",
        headDim: 512,
        qkRopeHeadDim: 64,
        indexTopk: 1024,
        indexerKvDtype: "int8",
        numAttentionHeads: 64,
        tpSize: 4,
        useV2ModelRunner: false,
      },
      "main",
    );
    expect(routeBMain.length).toBe(0);
  });

  it("ADV-6a/6b: excludes absent Domain 3 rules from rfork while keeping W8A8_MIX rfork dispatch", () => {
    expect(
      evaluateDomain3Rules(
        {
          cacheDtype: "turboquant_4bit_nc",
          hardwareFamily: "A5",
          modelDtype: "float16",
          usesSfaSparse: true,
          enableSparseSfaC8: true,
          xliteEnabled: true,
          useV2ModelRunner: false,
        },
        "rfork",
      ),
    ).toHaveLength(0);
    expect(
      evaluateDomain3Rules(
        { quantMethod: "fp8", hasWeightBlockSize: false, activationScheme: "static", hardwareFamily: "A3" },
        "rfork",
      ),
    ).toHaveLength(0);
    expect(
      evaluateDomain3Rules({ quantMethod: "fp8", hasWeightBlockSize: true, hardwareFamily: "A3" }, "rfork"),
    ).toHaveLength(0);
    expect(
      evaluateDomain3Rules({ quantMethod: "fp8", hasWeightBlockSize: true, hardwareFamily: "A5" }, "rfork"),
    ).toHaveLength(0);
    expect(
      evaluateDomain3Rules({ quantMethod: "fp8", hasWeightBlockSize: true, hardwareFamily: "310P" }, "rfork"),
    ).toHaveLength(0);
    expect(
      evaluateDomain3Rules({ cacheDtype: "mxfp8", blockSize: 128, userSpecifiedBlockSize: true }, "rfork"),
    ).toHaveLength(0);

    const mixRfork = evaluateDomain3Rules({ quantScheme: "W8A8_MIX", kvRole: "kv_consumer" }, "rfork");
    expect(mixRfork).toHaveLength(1);
    expect(mixRfork[0]?.ruleId).toBe("d3-w8a8-mix-pd-dispatch");
    expect(mixRfork[0]?.effectiveMutation?.w8a8MixRuntimePath).toBe("static-w8a8");
    expect(mixRfork[0]?.sources).toContain(
      "rfork@3284850b:vllm_ascend/quantization/methods/w8a8_pdmix.py#L37-L93",
    );

    const mixMain = evaluateDomain3Rules({ quantScheme: "W8A8_MIX", kvRole: "kv_consumer" }, "main");
    expect(mixMain[0]?.sources).toContain("vllm@c84273be:vllm/config/kv_transfer.py#L155-L157");
  });

  it("remediates P1/P2 findings in Domains 1–3 and MoE comm selection", () => {
    // P1-A: A2 uses integer floor division (399 // 16 = 24 <= 24 -> MC2)
    expect(
      selectMoeCommMethod(
        {
          hardwareFamily: "A2",
          isMoe: true,
          enableExpertParallel: true,
          tpSize: 8,
          dpSize: 2,
          numExperts: 399,
          numTokens: 64,
        },
        "v0.30.0",
      ).method,
    ).toBe("MC2");

    // P1-B: A5 with enableFusedMc2=1 & isMegaMoeSupportedByConfig=false (omitted isMegaMoeSupportedByModel)
    const a5ResetInput = {
      hardwareFamily: "A5" as const,
      isMoe: true,
      enableExpertParallel: true,
      enableFusedMc2: 1 as const,
      isMegaMoeSupportedByConfig: false,
      tpSize: 8,
      dpSize: 2,
      numTokens: 64,
    };
    expect(isFusedMc2SilentlyReset(a5ResetInput, "v0.30.0")).toBe(true);
    expect(selectMoeCommMethod(a5ResetInput, "v0.30.0").method).toBe("MC2");
    expect(
      evaluateDomain1Rules(a5ResetInput, "v0.30.0").some((m) => m.ruleId === "d1-fused-mc2-silent-reset"),
    ).toBe(true);
    expect(
      selectMoeCommMethod(
        { ...a5ResetInput, isMegaMoeSupportedByConfig: true, cannOpsTransformerAvailable: false },
        "main",
      ).method,
    ).toBe("MC2");

    // P2-1: rfork _dispatch_v2_tokens_capacity when enableFusedMc2=1 & ep > 32
    expect(
      selectMoeCommMethod(
        {
          hardwareFamily: "A3",
          isMoe: true,
          enableExpertParallel: true,
          enableFusedMc2: 1,
          enablePrefillMc2: true,
          tpSize: 8,
          dpSize: 8,
          maxNumBatchedTokens: 8192,
          cudagraphCaptureSizes: [128],
          maxCudagraphCaptureSize: 128,
          numTokens: 512,
        },
        "rfork",
      ).method,
    ).toBe("ALLTOALL");

    // P2-1: main cudagraphCaptureSizes=[] disables decode_cudagraph_capture_request_sizes, and floor division
    const emptyCgMain = calculateMc2TokensCapacity(
      {
        hardwareFamily: "A5",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 8,
        maxNumSeqs: 32,
        uniformDecodeQueryLen: 1,
        cudagraphCaptureSizes: [],
        decodeCudagraphCaptureRequestSizes: [{ numReqs: 64, queryLen: 4 }],
      },
      "main",
    );
    expect(emptyCgMain.usedDecodeRequestShapes).toBe(false);
    expect(emptyCgMain.mc2TokensCapacity).toBe(32);

    const floorCapMain = calculateMc2TokensCapacity(
      {
        hardwareFamily: "A5",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 1,
        cudagraphCaptureSizes: [16, 32, 64],
        decodeCudagraphCaptureRequestSizes: [{ numReqs: 32, queryLen: 4 }],
        maxDecodeCudagraphCaptureTokens: 102,
      },
      "main",
    );
    expect(floorCapMain.mc2TokensCapacity).toBe(100);

    // ADV-5: maxDecodeCudagraphCaptureTokens=0 falls back to maxBatched (Python `0 or max_num_batched_tokens`)
    const zeroDecodeCapMain = calculateMc2TokensCapacity(
      {
        hardwareFamily: "A5",
        isMoe: true,
        enableExpertParallel: true,
        tpSize: 8,
        maxNumBatchedTokens: 2048,
        cudagraphCaptureSizes: [16, 32, 64],
        decodeCudagraphCaptureRequestSizes: [
          { numReqs: 32, queryLen: 4 },
          { numReqs: 64, queryLen: 2 },
        ],
        maxDecodeCudagraphCaptureTokens: 0,
      },
      "main",
    );
    expect(zeroDecodeCapMain.mc2TokensCapacity).toBe(128);

    // P2-2: PassConfig.enable_sp ignored on main; FlashComm1 + useSequenceParallelMoe with pp=2 disables quantized_ar on main
    expect(
      evaluateDomain1Rules({ tpSize: 1, enableSp: true }, "main").some(
        (m) => m.ruleId === "d1-ascend-sp-tp-gt-1",
      ),
    ).toBe(false);
    expect(
      evaluateDomain1Rules(
        {
          tpSize: 4,
          ppSize: 2,
          dpSize: 2,
          isMoe: true,
          enableExpertParallel: true,
          enableFlashcomm1: true,
          useSequenceParallelMoe: true,
          quantizedAllReduceEnabled: true,
        },
        "main",
      ).some((m) => m.ruleId === "d1-flashcomm1-disables-quantized-ar"),
    ).toBe(true);

    // ADV-1c & ADV-4: dpSize=1 + omitted useSequenceParallelMoe still fires d1-flashcomm1-disables-quantized-ar; explicit false disables it
    expect(
      evaluateDomain1Rules(
        {
          tpSize: 4,
          dpSize: 1,
          ppSize: 1,
          isMoe: true,
          enableExpertParallel: true,
          enableFlashcomm1: true,
          quantizedAllReduceEnabled: true,
        },
        "main",
      ).some((m) => m.ruleId === "d1-flashcomm1-disables-quantized-ar"),
    ).toBe(true);
    expect(
      evaluateDomain1Rules(
        {
          tpSize: 4,
          dpSize: 1,
          ppSize: 1,
          isMoe: true,
          enableExpertParallel: true,
          enableFlashcomm1: true,
          useSequenceParallelMoe: false,
          quantizedAllReduceEnabled: true,
        },
        "main",
      ).some((m) => m.ruleId === "d1-flashcomm1-disables-quantized-ar"),
    ).toBe(false);

    // ADV-1a/1b: SP+PCP rounding applies for DP=1 too (patch_parallel_config.py overrides ParallelConfig.use_sequence_parallel_moe)
    expect(
      resolveDefaultBatchTokens({
        tpSize: 4,
        dpSize: 2,
        ppSize: 1,
        pcpSize: 3,
        isMoe: true,
        enableExpertParallel: true,
        enableFlashcomm1: true,
        maxNumBatchedTokens: 2050,
      }).spPcpRounded,
    ).toBe(true);
    const dp1V030 = resolveDefaultBatchTokens(
      {
        tpSize: 4,
        dpSize: 1,
        pcpSize: 3,
        isMoe: true,
        enableExpertParallel: true,
        useSequenceParallelMoe: true,
        maxNumBatchedTokens: 2050,
      },
      "v0.30.0",
    );
    expect(dp1V030.spPcpRounded).toBe(true);
    expect(dp1V030.finalMaxNumBatchedTokens).toBe(2052);

    const dp1Main = resolveDefaultBatchTokens(
      {
        tpSize: 4,
        dpSize: 1,
        pcpSize: 3,
        isMoe: true,
        enableExpertParallel: true,
        enableFlashcomm1: true,
        maxNumBatchedTokens: 2050,
      },
      "main",
    );
    expect(dp1Main.spPcpRounded).toBe(true);
    expect(dp1Main.finalMaxNumBatchedTokens).toBe(2052);

    // ADV-11: tpSize=0 normalizes to 1 (no SP+PCP rounding)
    const tpZeroBatch = resolveDefaultBatchTokens(
      {
        tpSize: 0,
        pcpSize: 3,
        isMoe: true,
        enableExpertParallel: true,
        enableFlashcomm1: true,
        maxNumBatchedTokens: 2050,
      },
      "v0.30.0",
    );
    expect(tpZeroBatch.spPcpRounded).toBe(false);
    expect(tpZeroBatch.finalMaxNumBatchedTokens).toBe(2050);

    // P2-3: d2-cpp-min-chunk-clamp checks pre-SP+PCP max_num_batched_tokens (2050 < 2051 even if rounded to 2052)
    const cppPreSpClamp = evaluateDomain2Rules(
      {
        profilingChunkEnabled: true,
        ppSize: 2,
        tpSize: 4,
        pcpSize: 3,
        isMoe: true,
        enableExpertParallel: true,
        useSequenceParallelMoe: true,
        maxNumBatchedTokens: 2050,
        profilingMinChunk: 2051,
      },
      "v0.30.0",
    );
    expect(
      cppPreSpClamp.find((m) => m.ruleId === "d2-cpp-min-chunk-clamp")?.effectiveMutation?.profilingMinChunk,
    ).toBe(2050);

    // P2-4: W8A8_MIX treats kv_both as static-w8a8 (is_kv_consumer)
    const kvBothMix = evaluateDomain3Rules(
      { quantScheme: "W8A8_MIX", kvConnector: "MooncakeConnector", kvRole: "kv_both" },
      "v0.30.0",
    );
    expect(kvBothMix[0]?.effectiveMutation?.w8a8MixRuntimePath).toBe("static-w8a8");

    // P2-5: tpSize<=0 consistency, blockSize=0 error on mxfp8, and maxModelLen=0 guard
    const tpZeroInput = {
      hardwareFamily: "A3" as const,
      isMoe: true,
      enableExpertParallel: true,
      enableFusedMc2: 1 as const,
      tpSize: 0,
      dpSize: 16,
    };
    expect(isMegaMoeActive(tpZeroInput, "v0.30.0")).toBe(true);
    expect(selectMoeCommMethod(tpZeroInput, "v0.30.0").method).toBe("FUSED_MC2");

    const blockZeroErr = evaluateDomain3Rules(
      { cacheDtype: "mxfp8", blockSize: 0, userSpecifiedBlockSize: true },
      "v0.30.0",
    );
    expect(blockZeroErr.some((m) => m.ruleId === "d3-mxfp8-c8-kv-block-size" && m.judgment === "error")).toBe(
      true,
    );

    const zeroModelLen = resolveDefaultBatchTokens({ maxModelLen: 0 }, "v0.30.0");
    expect(zeroModelLen.finalMaxNumBatchedTokens).toBe(2048);
    expect(zeroModelLen.finalMaxNumSeqs).toBe(256);
  });
});
