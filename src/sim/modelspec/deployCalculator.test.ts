import { describe, expect, it } from "vitest";
import {
  ASCEND_CALC_CARDS,
  evaluateDeployPlan,
  evaluateWave3ModelGate,
  GIB,
  KIB,
  MIB,
} from "./deployCalculator";
import { parseAscendStartupLog, reconcileStartupLog, SAMPLE_ASCEND_STARTUP_LOGS } from "./startupLogParser";

describe("evaluateWave3ModelGate", () => {
  it("大小写不敏感解析内置预设（Qwen3-0.6B / Qwen3-8B / Qwen3-30B-A3B）", () => {
    for (const token of ["qwen3-0.6b", "Qwen3-8B", "qwen3-8b", "Qwen3-30B-A3B", "Qwen/Qwen3-30B-A3B"]) {
      const res = evaluateWave3ModelGate(token);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.supportedInWave3).toBe(true);
        if (res.supportedInWave3) {
          expect(res.sourceKind).toBe("preset");
        }
      }
    }
  });

  it("支持标准 Dense (mistral / gemma2) 与标准 MoE (mixtral / 含共享专家 qwen2_moe)", () => {
    const mistral = evaluateWave3ModelGate(
      JSON.stringify({
        model_type: "mistral",
        hidden_size: 4096,
        num_hidden_layers: 32,
        num_attention_heads: 32,
        num_key_value_heads: 8,
        intermediate_size: 14336,
        vocab_size: 32000,
        torch_dtype: "bfloat16",
      }),
    );
    expect(mistral.ok && mistral.supportedInWave3).toBe(true);

    const mixtral = evaluateWave3ModelGate({
      model_type: "mixtral",
      hidden_size: 4096,
      num_hidden_layers: 32,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      intermediate_size: 14336,
      num_local_experts: 8,
      num_experts_per_tok: 2,
      vocab_size: 32000,
      torch_dtype: "bfloat16",
    });
    expect(mixtral.ok && mixtral.supportedInWave3).toBe(true);
    if (mixtral.ok && mixtral.supportedInWave3) {
      expect(mixtral.spec.layers[0]?.mlp).toMatchObject({
        kind: "moe",
        numExperts: 8,
        topK: 2,
        moeIntermediate: 14336,
      });
    }

    const qwen2MoeShared = evaluateWave3ModelGate({
      model_type: "qwen2_moe",
      hidden_size: 2048,
      num_hidden_layers: 24,
      num_attention_heads: 16,
      num_key_value_heads: 4,
      intermediate_size: 5632,
      moe_intermediate_size: 1408,
      shared_expert_intermediate_size: 5632,
      num_shared_experts: 1,
      num_experts: 60,
      num_experts_per_tok: 4,
      vocab_size: 151936,
      torch_dtype: "bfloat16",
    });
    expect(qwen2MoeShared.ok && qwen2MoeShared.supportedInWave3).toBe(true);
    if (qwen2MoeShared.ok && qwen2MoeShared.supportedInWave3) {
      expect(qwen2MoeShared.spec.layers[0]?.mlp).toMatchObject({
        kind: "moe",
        numSharedExperts: 1,
        sharedIntermediate: 5632,
      });
    }
  });

  it("显式拦截 Wave 4 架构：MLA / CSA2 / KDA / Engram", () => {
    const mla = evaluateWave3ModelGate({
      model_type: "deepseek_v3",
      kv_lora_rank: 512,
      q_lora_rank: 1536,
      hidden_size: 7168,
    });
    expect(mla).toMatchObject({
      ok: true,
      supportedInWave3: false,
      blockedFeature: "MLA",
      unlockWave: "Wave 4",
      targetWikiId: "mla",
    });

    const mlaByType = evaluateWave3ModelGate({ model_type: "glm4_moe_lite" });
    expect(mlaByType).toMatchObject({
      ok: true,
      supportedInWave3: false,
      blockedFeature: "MLA",
      targetWikiId: "mla",
    });

    const csa2 = evaluateWave3ModelGate({ model_type: "qwen3", use_csa2: true });
    expect(csa2).toMatchObject({
      ok: true,
      supportedInWave3: false,
      blockedFeature: "CSA2",
      unlockWave: "Wave 4",
      targetWikiId: "kv-cache-spec",
    });

    const kda = evaluateWave3ModelGate({
      model_type: "kimi_linear",
      layer_types: ["full_attention", "linear_kda"],
    });
    expect(kda).toMatchObject({
      ok: true,
      supportedInWave3: false,
      blockedFeature: "KDA",
      unlockWave: "Wave 4",
      targetWikiId: "linear-attention",
    });

    const engram = evaluateWave3ModelGate({
      model_type: "qwen3",
      use_engram: true,
      engram_layers: [2, 10],
    });
    expect(engram).toMatchObject({
      ok: true,
      supportedInWave3: false,
      blockedFeature: "Engram",
      unlockWave: "Wave 4",
      targetWikiId: "kv-cache-spec",
    });
  });

  it("非法 JSON 或未支持的非 Wave 4 模型返回 { ok: false, error }", () => {
    expect(evaluateWave3ModelGate("{ broken json")).toMatchObject({ ok: false });
    expect(evaluateWave3ModelGate({ model_type: "unknown_custom_arch" })).toMatchObject({ ok: false });
  });
});

describe("evaluateDeployPlan（Mode A 七级显存 + Roofline 黄金用例）", () => {
  it("暴露 5 张标准昇腾卡型规格", () => {
    expect(ASCEND_CALC_CARDS.map((c) => c.id)).toEqual([
      "a2-64g",
      "a2-32g",
      "a3-die64g",
      "310p-24g",
      "950dt-128g",
    ]);
  });

  it("Qwen3-8B BF16 TP=1 @ Atlas A2 64 GiB：对齐 hf-model-anatomy / kv-cache-memory-profiling / roofline-and-metrics", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      tpSize: 1,
      gpuMemoryUtilization: 0.92,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      prefillTokens: 512,
      decodeBatchSize: 16,
      decodeContextLen: 32768,
    });

    expect(plan.stages).toHaveLength(7);
    expect(plan.stages[0].pointEstimateBytes).toBe(64 * GIB);
    expect(plan.requestedBytes / GIB).toBeCloseTo(58.88, 2);
    expect(plan.unbudgetedHeadroomBytes / GIB).toBeCloseTo(5.12, 2);

    // Stage 3: exact BF16 ND base weights 8,190,735,360 * 2 B = 16,381,470,720 B (15.26 GiB)
    expect(plan.stages[2].pointEstimateBytes).toBe(16_381_470_720);
    expect(plan.stages[2].pointEstimateBytes / GIB).toBeCloseTo(15.26, 2);

    // Stage 4: interval estimate [I]
    expect(plan.stages[3].evidenceLevel).toBe("I");
    expect(plan.stages[3].lowBytes).toBeLessThan(plan.stages[3].highBytes);

    // Stage 5: hcclAccounting single source of truth + no double-counting overlap
    expect(plan.hcclEstimate.totalMaterializedMiB).toBe(250);
    expect(plan.workspaceHcclOverlap.alreadyIncludedInProfileRun).toBe(true);
    expect(plan.workspaceHcclOverlap.underestimationSafetyBufferMiB).toBe(150);

    // Stage 6: 147,456 B = 144.0 KiB/tok, 128-tok block = 18.000 MiB, usable = raw - 1
    const q2 = plan.fourQuestions.q2Capacity;
    expect(q2.kvBytesPerTokenPerRank).toBe(147_456);
    expect(q2.kvBytesPerTokenPerRank / KIB).toBe(144);
    expect(q2.kvBytesPerBlock).toBe(18 * MIB);
    expect(q2.usableBlocksRange[0]).toBe(Math.max(0, q2.rawBlocksRange[0] - 1));
    expect(q2.oomStatus).toBe("fits");
    expect(plan.headroomStatus).toBe("safe");

    // Q3 Roofline: ridge 200 FLOP/B, prefill(512) 409.6 FLOP/B, GQA KV attn 4.0 FLOP/B, 16x32k KV = 72 GiB
    expect(plan.roofline.ridgePointFlopsPerByte).toBeCloseTo(200, 1);
    expect(plan.roofline.prefillIntensityFlopsPerByte).toBeCloseTo(409.6, 1);
    expect(plan.roofline.prefillRegime).toBe("compute-bound");
    expect(plan.roofline.decodeKvAttnIntensityFlopsPerByte).toBeCloseTo(4.0, 2);
    expect(plan.roofline.decodeKvTrafficBytesPerStep / GIB).toBeCloseTo(72.0, 1);
    expect(plan.fourQuestions.q1Fit.verdict).toBe("pass");
  });

  it("Qwen3-30B-A3B W8A8_DYNAMIC TP=4 + EP=4 @ Atlas A2 64 GiB：权重 ≈ 7.40 GiB、KV 24 KiB/tok、HCCL 450 MiB、MoE 路由稀释", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "auto",
      tpSize: 4,
      dpSize: 1,
      enableEp: true,
      gpuMemoryUtilization: 0.92,
      maxModelLen: 32768,
      decodeBatchSize: 32,
    });

    // Weights ≈ 7.40 GiB
    expect(plan.stages[2].pointEstimateBytes / GIB).toBeCloseTo(7.4, 1);
    expect(plan.stages[2].lowBytes / GIB).toBeGreaterThan(7.25);
    expect(plan.stages[2].highBytes / GIB).toBeLessThan(7.6);

    // HCCL deduplicated 450 MiB + MC2 governed by CANN HCCL_BUFFSIZE
    expect(plan.hcclEstimate.totalMaterializedMiB).toBe(450);
    expect(plan.hcclEstimate.mc2GovernedByCannBuffsize).toBe(true);

    // KV: 1 local KV head -> 24,576 B = 24.0 KiB/tok, 128-tok block = 3.000 MiB
    const q2 = plan.fourQuestions.q2Capacity;
    expect(plan.inputSummary.localKvHeadsPerRank).toBe(1);
    expect(q2.kvBytesPerTokenPerRank).toBe(24_576);
    expect(q2.kvBytesPerBlock).toBe(3 * MIB);

    // Roofline: B=32, topK=8, E=128 -> mEff=2.0; GQA 32/4=8 -> 8.0 FLOP/B
    expect(plan.roofline.moeRouterDilutedRows).toBeCloseTo(2.0, 3);
    expect(plan.roofline.decodeLinearMEff).toBeCloseTo(2.0, 3);
    expect(plan.roofline.decodeKvAttnIntensityFlopsPerByte).toBeCloseTo(8.0, 2);
  });

  it("P2-1 回归：Qwen3-30B-A3B 静态 w8a8 仅量化注意力 Linear，MoE 专家保持 2 B（显著大于 w8a8_dynamic 且接近 bf16）", () => {
    const baseInput = {
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g" as const,
      kvCacheDtype: "auto" as const,
      tpSize: 4,
      dpSize: 1,
      enableEp: true,
      gpuMemoryUtilization: 0.92,
      maxModelLen: 32768,
    };
    const bf16Plan = evaluateDeployPlan({ ...baseInput, weightPrecision: "bf16" });
    const staticW8a8Plan = evaluateDeployPlan({ ...baseInput, weightPrecision: "w8a8" });
    const dynW8a8Plan = evaluateDeployPlan({ ...baseInput, weightPrecision: "w8a8_dynamic" });

    const bf16GiB = bf16Plan.stages[2].pointEstimateBytes / GIB;
    const staticW8a8GiB = staticW8a8Plan.stages[2].pointEstimateBytes / GIB;
    const dynW8a8GiB = dynW8a8Plan.stages[2].pointEstimateBytes / GIB;

    // BF16 ≈ 14.24 GiB; 静态 w8a8 仅省去注意力线性投影 (~0.21 GiB) -> ≈ 14.03 GiB; w8a8_dynamic ≈ 7.40 GiB
    expect(bf16GiB).toBeCloseTo(14.24, 1);
    expect(staticW8a8GiB).toBeCloseTo(14.03, 1);
    expect(dynW8a8GiB).toBeCloseTo(7.4, 1);
    expect(staticW8a8GiB).toBeGreaterThan(dynW8a8GiB + 6.0);
    expect(staticW8a8GiB).toBeLessThan(bf16GiB);
    expect(
      staticW8a8Plan.fourQuestions.q1Fit.warnings.some((w) => w.id === "calc-static-w8a8-linear-only"),
    ).toBe(true);
    // 含共享专家的 MoE 在静态 w8a8 下同样保持共享专家 2 B（显著高于 w8a8_dynamic）
    const sharedMoeCfg = {
      model_type: "qwen2_moe",
      hidden_size: 2048,
      num_hidden_layers: 24,
      num_attention_heads: 16,
      num_key_value_heads: 4,
      intermediate_size: 5632,
      moe_intermediate_size: 1408,
      shared_expert_intermediate_size: 5632,
      num_shared_experts: 1,
      num_experts: 60,
      num_experts_per_tok: 4,
      vocab_size: 151936,
      torch_dtype: "bfloat16",
    };
    const sharedStatic = evaluateDeployPlan({
      model: sharedMoeCfg,
      cardId: "a2-64g",
      tpSize: 4,
      enableEp: true,
      weightPrecision: "w8a8",
    });
    const sharedDyn = evaluateDeployPlan({
      model: sharedMoeCfg,
      cardId: "a2-64g",
      tpSize: 4,
      enableEp: true,
      weightPrecision: "w8a8_dynamic",
    });
    expect(sharedStatic.stages[2].lowBytes).toBeGreaterThan(sharedDyn.stages[2].highBytes * 1.5);
  });
});

describe("evaluateDeployPlan（硬件/量化/OOM/余量边界校验）", () => {
  it("FP8_BLOCK：A2/A3 v0.30.0 静默反量化回 BF16；main 与 310P 硬报错；950DT (A5) 走 MXFP8 33/32 B", () => {
    const a2V030 = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "a2-64g",
      version: "v0.30.0",
      weightPrecision: "fp8_block",
    });
    expect(a2V030.stages[2].pointEstimateBytes).toBe(16_381_470_720);
    expect(
      a2V030.fourQuestions.q1Fit.silentRewrites.some((r) => r.id === "d3-fp8-block-non950-bf16-v030"),
    ).toBe(true);

    const a2Main = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "a2-64g",
      version: "main",
      weightPrecision: "fp8_block",
    });
    expect(a2Main.fourQuestions.q1Fit.verdict).toBe("blocked");
    expect(a2Main.fourQuestions.q1Fit.blockers.some((b) => b.id === "d3-fp8-block-non950-error-main")).toBe(
      true,
    );

    const p310 = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "310p-24g",
      version: "v0.30.0",
      weightPrecision: "fp8_block",
    });
    expect(p310.fourQuestions.q1Fit.blockers.some((b) => b.id === "d3-fp8-310p-unsupported")).toBe(true);

    const a5 = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "950dt-128g",
      version: "v0.30.0",
      weightPrecision: "fp8_block",
    });
    // MXFP8 quantized layers ~1.03125 B + BF16 embed/lm_head (~2.32 GiB) -> ~9.0 GiB (<< 15.26 GiB)
    expect(a5.stages[2].pointEstimateBytes / GIB).toBeLessThan(10.0);
    expect(a5.stages[2].pointEstimateBytes / GIB).toBeGreaterThan(8.5);

    const a5Bf16 = evaluateDeployPlan({ model: "qwen3-8b", cardId: "950dt-128g", weightPrecision: "bf16" });
    expect(a5Bf16.roofline.ridgePointFlopsPerByte).toBeCloseTo(121.5, 1);
  });

  it("310P BF16 报错；310P FP16 自动 FORCE_NZ 且 KV 预算减半；GQA C8 缺量化权重报错；MXFP8 强制 512 块长", () => {
    const p310Bf16 = evaluateDeployPlan({ model: "qwen3-0.6b", cardId: "310p-24g", weightPrecision: "bf16" });
    expect(p310Bf16.fourQuestions.q1Fit.blockers.some((b) => b.id === "calc-310p-no-bf16")).toBe(true);

    const p310Fp16 = evaluateDeployPlan({ model: "qwen3-0.6b", cardId: "310p-24g", weightPrecision: "fp16" });
    expect(p310Fp16.fourQuestions.q1Fit.verdict).not.toBe("blocked");
    expect(p310Fp16.fourQuestions.q1Fit.silentRewrites.some((r) => r.id === "calc-310p-force-nz")).toBe(true);

    const badC8 = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      kvCacheDtype: "int8",
    });
    expect(
      badC8.fourQuestions.q1Fit.blockers.some((b) => b.id === "calc-gqa-c8-requires-quant-weights"),
    ).toBe(true);

    const okC8 = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "a2-64g",
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "int8",
    });
    expect(okC8.fourQuestions.q1Fit.verdict).toBe("pass");
    expect(okC8.fourQuestions.q2Capacity.kvBytesPerTokenPerRank / KIB).toBe(72);

    const mxfpAuto = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "950dt-128g",
      kvCacheDtype: "mxfp8",
      blockSize: 128,
      userSpecifiedBlockSize: false,
    });
    expect(mxfpAuto.inputSummary.effectiveBlockSize).toBe(512);
    expect(
      mxfpAuto.fourQuestions.q1Fit.silentRewrites.some((r) => r.id === "d3-mxfp8-c8-kv-block-size"),
    ).toBe(true);

    const mxfpExplicitBad = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "950dt-128g",
      kvCacheDtype: "mxfp8",
      blockSize: 128,
      userSpecifiedBlockSize: true,
    });
    expect(
      mxfpExplicitBad.fourQuestions.q1Fit.blockers.some((b) => b.id === "d3-mxfp8-c8-kv-block-size"),
    ).toBe(true);
  });

  it("检测 TP 头整除错误、Stage 3 权重 OOM 与 Stage 7 预算外余量击穿", () => {
    const badTp = evaluateDeployPlan({ model: "qwen3-8b", cardId: "a2-64g", tpSize: 3 });
    expect(badTp.fourQuestions.q1Fit.blockers.some((b) => b.id === "calc-tp-q-heads-indivisible")).toBe(true);

    const oomW = evaluateDeployPlan({
      model: "qwen3-30b-a3b",
      cardId: "a2-32g",
      weightPrecision: "bf16",
      tpSize: 1,
    });
    expect(oomW.fourQuestions.q2Capacity.oomStatus).toBe("weights_exceed_budget");
    expect(oomW.fourQuestions.q2Capacity.minCardsRecommended).toBeGreaterThanOrEqual(4);

    const overflowStage7 = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "a2-64g",
      gpuMemoryUtilization: 0.99,
      cudagraphMode: "FULL",
      cudagraphCaptureCount: 24,
    });
    expect(overflowStage7.headroomStatus).toBe("overflow");
    expect(
      overflowStage7.fourQuestions.q1Fit.blockers.some((b) => b.id === "calc-stage7-headroom-overflow"),
    ).toBe(true);
  });
});

describe("Mode B：parseAscendStartupLog 与 reconcileStartupLog", () => {
  it("两个内置参考日志模板完整解析并与 Mode A 闭环对齐（绝不二次扣 HCCL）", () => {
    expect(SAMPLE_ASCEND_STARTUP_LOGS).toHaveLength(2);
    for (const tpl of SAMPLE_ASCEND_STARTUP_LOGS) {
      expect(tpl.isReferenceTemplate).toBe(true);
      const plan = evaluateDeployPlan(tpl.recommendedPlanInput);
      const parsed = parseAscendStartupLog(tpl.logText);
      expect(parsed.hasAnyMetric).toBe(true);
      expect(parsed.weightsGiB).not.toBeNull();
      expect(parsed.nonKvCacheMemoryGiB).not.toBeNull();
      expect(parsed.availableKvGiB).not.toBeNull();
      expect(parsed.kvCacheTokens).not.toBeNull();
      expect(parsed.aclGraphGiB).not.toBeNull();

      const rec = reconcileStartupLog(plan, parsed);
      expect(rec.hcclDoubleCounted).toBe(false);
      expect(rec.redundancyBufferMiB).toBe(150);
      expect(rec.overallStatus).toBe("aligned");
      expect(rec.items.every((it) => it.status === "within-interval")).toBe(true);
    }
  });

  it("解析多样日志格式（Model loading / GPU KV cache / MiB 录图 / 310P halved / profiling 报错）并识别漂移与 OOM 风险", () => {
    const customLog = [
      "INFO Model loading took 30.50 GiB memory and 14.210000 seconds",
      "INFO Available KV cache memory: 12.10 GiB (halved for workspace)",
      "INFO GPU KV cache size: 80,000 tokens",
      "INFO Maximum concurrency for 32,768 tokens per request: 2.44x",
      "INFO Graph capturing finished in 22 secs, took 5632 MiB",
      "AssertionError: Error in memory profiling.",
    ].join("\n");

    const parsed = parseAscendStartupLog(customLog);
    expect(parsed.weightsGiB).toBeCloseTo(30.5, 2);
    expect(parsed.weightLoadSeconds).toBeCloseTo(14.21, 2);
    expect(parsed.availableKvGiB).toBeCloseTo(12.1, 2);
    expect(parsed.kvHalvedFor310pWorkspace).toBe(true);
    expect(parsed.kvCacheTokens).toBe(80_000);
    expect(parsed.maxConcurrency).toBeCloseTo(2.44, 2);
    expect(parsed.aclGraphGiB).toBeCloseTo(5.5, 2);
    expect(parsed.detectedErrors.length).toBeGreaterThan(0);

    const plan = evaluateDeployPlan({ model: "qwen3-8b", cardId: "a2-64g", gpuMemoryUtilization: 0.92 });
    const rec = reconcileStartupLog(plan, parsed);
    expect(rec.byKey.weights.status).toBe("above-interval");
    expect(rec.byKey.aclGraph.status).toBe("oom-risk");
    expect(rec.byKey.headroomSafety.status).toBe("oom-risk");
    expect(rec.overallStatus).toBe("oom-risk");
  });
});

describe("Wiki Deep-Link Canonical ID 契约校验", () => {
  const REGISTERED_CANONICAL_IDS = new Set([
    "hf-model-anatomy",
    "kv-cache-memory-profiling",
    "roofline-and-metrics",
    "hardware-devices",
    "moe",
    "expert-parallel",
    "tensor-parallel",
    "pipeline-parallel",
    "data-parallel",
    "quantization",
    "low-precision-formats",
    "kv-cache-quantization",
    "ascend-950-architecture",
    "hccl-buffer",
    "acl-graph",
    "mla",
    "linear-attention",
    "kv-cache-spec",
  ]);

  it("所有 ASCEND_CALC_CARDS 的 wiki:* 引用与全分支 relatedWikiIds / targetWikiId 均命中已注册 canonical ID", () => {
    for (const card of ASCEND_CALC_CARDS) {
      for (const src of card.sources) {
        if (src.startsWith("wiki:")) {
          expect(REGISTERED_CANONICAL_IDS.has(src.slice(5))).toBe(true);
        }
      }
    }

    const plans = [
      evaluateDeployPlan({ model: "qwen3-8b", cardId: "a2-64g" }),
      evaluateDeployPlan({
        model: "qwen3-30b-a3b",
        cardId: "950dt-128g",
        weightPrecision: "w8a8_dynamic",
        kvCacheDtype: "int8",
        tpSize: 2,
        ppSize: 2,
        dpSize: 2,
        enableEp: true,
        cudagraphMode: "PIECEWISE",
      }),
      evaluateDeployPlan({ model: "qwen3-0.6b", cardId: "310p-24g", weightPrecision: "fp16" }),
    ];

    for (const plan of plans) {
      expect(plan.fourQuestions.q4Recommendation.relatedWikiIds.length).toBeGreaterThan(0);
      for (const id of plan.fourQuestions.q4Recommendation.relatedWikiIds) {
        expect(REGISTERED_CANONICAL_IDS.has(id)).toBe(true);
      }
    }
  });
});
