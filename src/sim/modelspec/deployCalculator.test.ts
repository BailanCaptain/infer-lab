import { describe, expect, it } from "vitest";
import { analyzeKvPerToken, analyzeParams } from "./analyze";
import {
  ASCEND_CALC_CARDS,
  evaluateDeployPlan,
  evaluateWave3ModelGate,
  GIB,
  KIB,
  MIB,
  WAVE4_DEMO_PRESETS,
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

  it("Wave 4 解锁 MLA / CSA2 / KDA / Engram 全架构解析（支持完整 config 与内置 Wave 4 预设）", () => {
    for (const demo of WAVE4_DEMO_PRESETS) {
      const byConfig = evaluateWave3ModelGate(demo.config);
      expect(byConfig.ok).toBe(true);
      if (byConfig.ok) {
        expect(byConfig.supportedInWave3).toBe(true);
        if (byConfig.supportedInWave3) {
          expect(byConfig.wave4Features).toEqual(expect.arrayContaining([...demo.features]));
        }
      }

      const byId = evaluateWave3ModelGate(demo.id);
      expect(byId.ok && byId.supportedInWave3).toBe(true);
    }

    const glm4Lite = evaluateWave3ModelGate({
      model_type: "glm4_moe_lite",
      hidden_size: 4096,
      num_hidden_layers: 40,
      num_attention_heads: 32,
      kv_lora_rank: 512,
      qk_rope_head_dim: 0,
      qk_nope_head_dim: 128,
      v_head_dim: 128,
      vocab_size: 151552,
      torch_dtype: "bfloat16",
    });
    expect(glm4Lite.ok && glm4Lite.supportedInWave3).toBe(true);
    if (glm4Lite.ok && glm4Lite.supportedInWave3) {
      expect(glm4Lite.wave4Features).toContain("MLA");
      expect(glm4Lite.spec.layers[0]?.attention.qkRopeHeadDim).toBe(0);
    }
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
    // Qwen3-30B-A3B (~57 GiB BF16) on A2-32G: 2 cards fail, while TP1/PP3 (3 cards, ~19 GiB/card) fits
    expect(oomW.fourQuestions.q2Capacity.minCardsRecommended).toBe(3);

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

describe("Wave 4 异构注意力与条件记忆账本（MLA / CSA2 / KDA / Engram）", () => {
  const mlaPreset = WAVE4_DEMO_PRESETS.find((p) => p.id === "deepseek-v3-mla")!;
  const kdaPreset = WAVE4_DEMO_PRESETS.find((p) => p.id === "hybrid-kda-gqa")!;
  const csa2Preset = WAVE4_DEMO_PRESETS.find((p) => p.id === "csa2-sparse-mla")!;
  const engramPreset = WAVE4_DEMO_PRESETS.find((p) => p.id === "engram-conditional")!;

  it("MLA（DeepSeek-V3 61 层）：1,152 B/tok/层潜向量、TP 全量复制不切分、DCP 沿序列轴切分、mlapo 矩阵吸收强度跃升", () => {
    const tp1 = evaluateDeployPlan({
      model: mlaPreset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 1,
      ppSize: 1,
      dcpSize: 1,
      enableEp: false,
    });
    const tp8 = evaluateDeployPlan({
      model: mlaPreset.config,
      cardId: "a2-64g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      ppSize: 2,
      dcpSize: 1,
      enableEp: true,
    });
    const tp8Pp1 = evaluateDeployPlan({
      model: mlaPreset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      ppSize: 1,
      dcpSize: 1,
      enableEp: true,
    });
    const tp8Pp1Dcp2 = evaluateDeployPlan({
      model: mlaPreset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      ppSize: 1,
      dcpSize: 2,
      enableEp: true,
    });

    // 61 layers: first 3 dense + 58 MoE (256 routed experts)
    expect(tp1.spec.layers.filter((l) => l.mlp.kind === "dense")).toHaveLength(3);
    expect(tp1.spec.layers.filter((l) => l.mlp.kind === "moe")).toHaveLength(58);
    // Heterogeneous param breakdown sum === total
    const paramBreakdown = analyzeParams(tp1.spec);
    expect(paramBreakdown.items.reduce((s, x) => s + x.count, 0)).toBe(paramBreakdown.total);
    expect(paramBreakdown.total).toBeGreaterThan(600e9);

    // Exact MLA BF16 latent KV per layer = (512 + 64) * 2 B = 1,152 B; 61 layers = 70,272 B
    expect(tp1.wave4Arch.hasMla).toBe(true);
    expect(tp1.wave4Arch.mla?.latentBytesPerTokenPerLayer).toBe(1152);
    expect(tp1.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(61 * 1152);
    expect(analyzeKvPerToken(tp1.spec).bytesPerToken).toBe(61 * 1152);

    // TP CANNOT shard MLA's single shared latent KV head -> TP=1 and TP=8 hold identical per-token latent KV
    expect(tp8Pp1.inputSummary.localKvHeadsPerRank).toBe(1);
    expect(tp8Pp1.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(61 * 1152);
    expect(tp8Pp1.fourQuestions.q1Fit.warnings.some((w) => w.id === "calc-mla-tp-kv-replicated")).toBe(true);

    // DCP=2 shards along sequence axis -> exact 1/2 per-token KV per rank, clears TP replication warning
    expect(tp8Pp1Dcp2.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe((61 * 1152) / 2);
    expect(tp8Pp1Dcp2.fourQuestions.q1Fit.warnings.some((w) => w.id === "calc-mla-tp-kv-replicated")).toBe(
      false,
    );

    // MLA Decode matrix absorption (mlapo): TP=1 -> 2*128*(2*512+64)/1152 = 241.78 FLOP/B; TP=8 -> 30.22 FLOP/B
    expect(tp1.roofline.decodeKvAttnIntensityFlopsPerByte).toBeCloseTo((2 * 128 * 1088) / 1152, 1);
    expect(tp8.roofline.decodeKvAttnIntensityFlopsPerByte).toBeCloseTo((2 * 16 * 1088) / 1152, 1);
    expect(tp8.roofline.decodeKvAttnIntensityFlopsPerByte).toBeGreaterThan(25);
  });

  it("CSA2 / DSA 稀疏注意力：存储含稀疏索引器 k_cache (132 B/层)，Decode 流量从 32K 骤降至 top-2048", () => {
    const denseMla = evaluateDeployPlan({
      model: mlaPreset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      ppSize: 1,
      enableEp: true,
      decodeBatchSize: 16,
      decodeContextLen: 32768,
    });
    const csa2 = evaluateDeployPlan({
      model: csa2Preset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      ppSize: 1,
      enableEp: true,
      decodeBatchSize: 16,
      decodeContextLen: 32768,
    });

    expect(csa2.wave4Arch.hasCsa2).toBe(true);
    expect(csa2.wave4Arch.hasMla).toBe(true);
    // Indexer cache (Ascend LI INT8): 128 * 1 B + 2 B (FP16 scale) = 130 B/tok/layer; total = 1152 + 130 = 1282 B/tok/layer
    expect(csa2.wave4Arch.csa2?.indexerBytesPerTokenPerLayer).toBe(130);
    expect(csa2.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(61 * (1152 + 130));
    // Decode attention effective context drops from 32768 to 2048 -> traffic drops dramatically (> 5x)
    expect(csa2.roofline.effectiveDecodeContextLen).toBe(2048);
    expect(csa2.roofline.decodeKvTrafficBytesPerStep).toBeLessThan(
      denseMla.roofline.decodeKvTrafficBytesPerStep / 5,
    );
  });

  it("KDA / 线性注意力混合栈（24 KDA + 8 GQA）：分页 KV 仅为全注意 1/4，固定递推状态 S 与 max_model_len 无关", () => {
    const shortCtx = evaluateDeployPlan({
      model: kdaPreset.config,
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 2,
      maxModelLen: 4096,
      maxNumSeqs: 64,
    });
    const longCtx = evaluateDeployPlan({
      model: kdaPreset.config,
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 2,
      maxModelLen: 65536,
      maxNumSeqs: 64,
    });

    expect(shortCtx.wave4Arch.hasKda).toBe(true);
    expect(shortCtx.wave4Arch.kda?.linearLayerCount).toBe(24);
    expect(shortCtx.wave4Arch.kda?.fullAttnLayerCount).toBe(8);

    // Only 8 full-attention GQA layers (8 KV heads / TP=2 = 4 local KV heads, head_dim=128, 2B):
    // 8 * 2 * 4 * 128 * 2 = 16,384 B/tok (exactly 1/4 of 32-layer GQA)
    expect(shortCtx.fourQuestions.q2Capacity.perTokenPagedKvBytes).toBe(16_384);
    expect(shortCtx.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(16_384);

    // Fixed recurrent S (16 heads * 128 * 128 * 4B = 1,048,576 B) + short conv ((2048 + 4096) * 3 * 2B = 36,864 B) per KDA layer
    const expectedPerLayerSeq = 16 * 128 * 128 * 4 + (16 * 128 + 2 * 16 * 128) * 3 * 2;
    expect(shortCtx.fourQuestions.q2Capacity.perSeqFixedLinearStateBytes).toBe(24 * expectedPerLayerSeq);
    // Independent of max_model_len!
    expect(longCtx.fourQuestions.q2Capacity.perSeqFixedLinearStateBytes).toBe(
      shortCtx.fourQuestions.q2Capacity.perSeqFixedLinearStateBytes,
    );
    expect(shortCtx.fourQuestions.q2Capacity.totalFixedLinearStateBytes).toBe(64 * 24 * expectedPerLayerSeq);

    // Pure linear attention (0 full-attention layers) should work with 0 B/tok paged KV and O(1) state concurrency
    const pureLinear = evaluateDeployPlan({
      model: {
        ...kdaPreset.config,
        layer_types: ["linear_kda"],
      },
      cardId: "a2-64g",
      tpSize: 2,
      maxNumSeqs: 32,
    });
    expect(pureLinear.fourQuestions.q2Capacity.perTokenPagedKvBytes).toBe(0);
    expect(pureLinear.fourQuestions.q2Capacity.perSeqFixedLinearStateBytes).toBe(32 * expectedPerLayerSeq);
    expect(pureLinear.fourQuestions.q2Capacity.maxConcurrencyPoint).toBeGreaterThan(100);
  });

  it("Engram 条件记忆：Host DRAM 卸载（0 B NPU 权重 + Gloo edp）vs NPU HBM 常驻（按 ETP 切分 + HCCL edp）", () => {
    const offloaded = evaluateDeployPlan({
      model: engramPreset.config, // engram_dp_shared_memory: true
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 2,
    });
    const npuResident = evaluateDeployPlan({
      model: {
        ...engramPreset.config,
        engram_cpu_offload: false,
        engram_dp_shared_memory: false,
      },
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 2,
    });

    expect(offloaded.wave4Arch.hasEngram).toBe(true);
    expect(offloaded.wave4Arch.engram?.dpSharedMemory).toBe(true);
    expect(offloaded.wave4Arch.engram?.npuWeightBytesPerRank).toBe(0);
    // 2 layers * 1,292,800 * 1,280 * 2 B = 6,619,136,000 B (~6.16 GiB Host DRAM per node)
    const expectedTotalTable = 2 * 1_292_800 * 1280 * 2;
    expect(offloaded.wave4Arch.engram?.hostDramBytesPerNode).toBe(expectedTotalTable);

    // NPU resident sharded by ETP=TP=2 -> +3,309,568,000 B (~3.08 GiB) per rank in Stage 3
    expect(npuResident.wave4Arch.engram?.dpSharedMemory).toBe(false);
    expect(npuResident.wave4Arch.engram?.npuWeightBytesPerRank).toBe(expectedTotalTable / 2);
    expect(npuResident.wave4Arch.engram?.hostDramBytesPerNode).toBe(0);
    expect(npuResident.stages[2].pointEstimateBytes - offloaded.stages[2].pointEstimateBytes).toBe(
      expectedTotalTable / 2,
    );

    // Stage 5 HCCL domain accounting: dp_shared_memory=true omits HCCL edp (uses Gloo), whereas false includes HCCL edp
    expect(offloaded.hcclEstimate.logicalGroups.some((g) => g.groupName === "etp")).toBe(true);
    expect(offloaded.hcclEstimate.logicalGroups.some((g) => g.groupName === "edp")).toBe(false);
    expect(npuResident.hcclEstimate.logicalGroups.some((g) => g.groupName === "etp")).toBe(true);
    expect(npuResident.hcclEstimate.logicalGroups.some((g) => g.groupName === "edp")).toBe(true);
    expect(npuResident.hcclEstimate.totalMaterializedMiB).toBeGreaterThan(
      offloaded.hcclEstimate.totalMaterializedMiB,
    );
  });

  it("Audit Wave 6 回归：kvCacheDtype=mxfp8 仅对非 MLA 全注意力按 33/32 B 计价，MLA 回退模型 dtype (2 B) 且 CSA2/DSA 硬阻断", () => {
    // Non-MLA full attention (Qwen3-8B) on 950DT: 33/32 B/elem
    const gqaMxfp8 = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "950dt-128g",
      kvCacheDtype: "mxfp8",
      blockSize: 512,
    });
    // 36 layers * 2 * 8 kv_heads * 128 head_dim * (33/32) = 76,032 B/tok
    expect(gqaMxfp8.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(36 * 2 * 8 * 128 * (33 / 32));

    // Standard MLA (DeepSeek-V3) on 950DT with kvCacheDtype="mxfp8": falls back to 2 B/elem (1152 B/tok/layer) + surfaces caveat
    const mlaMxfp8 = evaluateDeployPlan({
      model: mlaPreset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "mxfp8",
      blockSize: 512,
      tpSize: 8,
      enableEp: true,
    });
    expect(mlaMxfp8.wave4Arch.mla?.latentBytesPerTokenPerLayer).toBe(1152);
    expect(mlaMxfp8.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(61 * 1152);
    expect(
      mlaMxfp8.fourQuestions.q1Fit.silentRewrites.some((r) => r.id === "calc-mxfp8-kv-mla-fallback"),
    ).toBe(true);

    // CSA2 / DSA sparse MLA on 950DT with kvCacheDtype="mxfp8": rejects mxfp8 (blocker) + does NOT price at 33/32 B
    const csa2Mxfp8 = evaluateDeployPlan({
      model: csa2Preset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "mxfp8",
      blockSize: 512,
      tpSize: 8,
      enableEp: true,
    });
    expect(csa2Mxfp8.wave4Arch.mla?.latentBytesPerTokenPerLayer).toBe(1152);
    expect(csa2Mxfp8.fourQuestions.q1Fit.blockers.some((b) => b.id === "calc-mxfp8-kv-unsupported-dsa")).toBe(
      true,
    );
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
    "context-parallel",
    "quantization",
    "low-precision-formats",
    "kv-cache-quantization",
    "ascend-950-architecture",
    "hccl-buffer",
    "acl-graph",
    "mla",
    "sparse-attention",
    "linear-attention",
    "kv-cache-spec",
    "engram-conditional-memory",
    "ascend-model-onboarding",
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
      ...WAVE4_DEMO_PRESETS.map((demo) =>
        evaluateDeployPlan({
          model: demo.config,
          cardId: "950dt-128g",
          tpSize: demo.recommendedTp,
          ppSize: demo.recommendedPp,
          dpSize: demo.recommendedDp,
          dcpSize: 2,
          enableEp: demo.recommendedEnableEp,
          weightPrecision: demo.recommendedPrecision,
        }),
      ),
    ];

    for (const plan of plans) {
      expect(plan.fourQuestions.q4Recommendation.relatedWikiIds.length).toBeGreaterThan(0);
      for (const id of plan.fourQuestions.q4Recommendation.relatedWikiIds) {
        expect(REGISTERED_CANONICAL_IDS.has(id)).toBe(true);
      }
    }
  });
});

describe("P1 & P2 Source-Verified Regression Suite (vllm-ascend@c09d3e20 / vllm@ced6857a)", () => {
  const mlaPreset = WAVE4_DEMO_PRESETS.find((p) => p.id === "deepseek-v3-mla")!;
  const kdaPreset = WAVE4_DEMO_PRESETS.find((p) => p.id === "hybrid-kda-gqa")!;
  const csa2Preset = WAVE4_DEMO_PRESETS.find((p) => p.id === "csa2-sparse-mla")!;
  const engramPreset = WAVE4_DEMO_PRESETS.find((p) => p.id === "engram-conditional")!;

  it("P1-1: MoE enableEp=false flattens TP × DP × PCP for routed expert sharding, active params, and GEMM shape", () => {
    const tp2Dp1NoEp = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "950dt-128g",
      weightPrecision: "bf16",
      tpSize: 2,
      dpSize: 1,
      enableEp: false,
    });
    const tp2Dp2NoEp = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "950dt-128g",
      weightPrecision: "bf16",
      tpSize: 2,
      dpSize: 2,
      enableEp: false,
    });
    const tp2Dp2Ep = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "950dt-128g",
      weightPrecision: "bf16",
      tpSize: 2,
      dpSize: 2,
      enableEp: true,
    });
    const tp2Dp2Pcp2NoEp = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "950dt-128g",
      weightPrecision: "bf16",
      tpSize: 2,
      dpSize: 2,
      pcpSize: 2,
      enableEp: false,
    });

    // Qwen3-30B-A3B routed experts: 48 * 128 * 3 * 2048 * 768 * 2B = 57,982,058,496 B = 54.0 GiB total.
    // TP=2, DP=1 -> 27.0 GiB/rank routed experts; TP=2, DP=2 (enableEp=false) -> 13.5 GiB/rank (saves exact 13.5 GiB!).
    expect(tp2Dp1NoEp.stages[2].pointEstimateBytes - tp2Dp2NoEp.stages[2].pointEstimateBytes).toBe(
      13.5 * GIB,
    );
    expect(tp2Dp2NoEp.stages[2].pointEstimateBytes).toBe(tp2Dp2Ep.stages[2].pointEstimateBytes);
    // Adding PCP=2 further halves routed experts from 13.5 GiB to 6.75 GiB (-6.75 GiB)
    expect(tp2Dp2NoEp.stages[2].pointEstimateBytes - tp2Dp2Pcp2NoEp.stages[2].pointEstimateBytes).toBe(
      6.75 * GIB,
    );
    expect(tp2Dp2NoEp.roofline.activeWeightBytesPerRank).toBeLessThan(
      tp2Dp1NoEp.roofline.activeWeightBytesPerRank,
    );
    // Expert GEMM output width N shrinks when sliced across TP*DP vs full width under EP
    expect(tp2Dp2NoEp.roofline.decodeLinearIntensityFlopsPerByte).not.toBe(
      tp2Dp2Ep.roofline.decodeLinearIntensityFlopsPerByte,
    );
  });

  it("P1-2: Deploy Calculator blocks illegal CP/DCP topologies via shared domain4 rules instead of returning pass", () => {
    // Qwen3-8B (32 Q heads, 8 KV heads) with TP=1, DCP=8 -> MUST be blocked
    const qwenBadDcp = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      tpSize: 1,
      dcpSize: 8,
    });
    expect(qwenBadDcp.fourQuestions.q1Fit.verdict).toBe("blocked");
    expect(qwenBadDcp.fourQuestions.q1Fit.blockers.some((b) => b.id === "d4-pcp-dcp-sizing")).toBe(true);

    // Qwen3-8B at TP=8, DCP=2 -> TP (8) <= numKvHeads (8), no KV replication to split -> blocked
    const qwenTp8Dcp2 = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      tpSize: 8,
      dcpSize: 2,
    });
    expect(qwenTp8Dcp2.fourQuestions.q1Fit.verdict).toBe("blocked");
    expect(qwenTp8Dcp2.fourQuestions.q1Fit.blockers.some((b) => b.id === "d4-pcp-dcp-sizing")).toBe(true);

    // Qwen3-8B at TP=16, DCP=2 -> 16 // 8 = 2 KV replicas % 2 == 0, groupSize=4 % 2 == 0 -> legal
    const qwenTp16Dcp2 = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      tpSize: 16,
      dcpSize: 2,
    });
    expect(qwenTp16Dcp2.fourQuestions.q1Fit.blockers.some((b) => b.id === "d4-pcp-dcp-sizing")).toBe(false);

    // CSA2/SFA sparse MLA at TP=8, PCP=1, DCP=2 -> SFA replicated indexer requires DCP in {1, 8} -> blocked
    const csa2BadDcp2 = evaluateDeployPlan({
      model: csa2Preset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      dcpSize: 2,
      enableEp: true,
    });
    expect(csa2BadDcp2.fourQuestions.q1Fit.verdict).toBe("blocked");
    expect(csa2BadDcp2.fourQuestions.q1Fit.blockers.some((b) => b.id === "d4-pcp-dcp-sizing")).toBe(true);

    // CSA2/SFA sparse MLA at TP=8, PCP=1, DCP=8 -> legal
    const csa2OkDcp8 = evaluateDeployPlan({
      model: csa2Preset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      dcpSize: 8,
      enableEp: true,
    });
    expect(csa2OkDcp8.fourQuestions.q1Fit.blockers.some((b) => b.id === "d4-pcp-dcp-sizing")).toBe(false);
  });

  it("P1-3 / P1-6: SFA ('dsa') replicated lightning indexer cache is NOT divided by safeDcp (INT8=274 B, BF16=400 B)", () => {
    const oneLayerDsaInt8 = evaluateDeployPlan({
      model: {
        ...csa2Preset.config,
        num_hidden_layers: 1,
        first_k_dense_replace: 1,
      },
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      dcpSize: 8,
    });
    // Main MLA latent = 1152 B -> 1152 / 8 = 144 B/tok;
    // Ascend LI INT8 = 128 * 1B + 2B (FP16 scale) = 130 B/tok replicated -> 144 + 130 = 274 B/tok
    expect(oneLayerDsaInt8.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(274);

    // Unquantized LI (BF16/FP16, omitting indexer_kv_dtype): 128 * 2B = 256 B/tok -> 144 + 256 = 400 B/tok
    const { indexer_kv_dtype: _ignored, ...csa2NoLiQuant } = csa2Preset.config as Record<string, unknown>;
    const oneLayerDsaBf16 = evaluateDeployPlan({
      model: {
        ...csa2NoLiQuant,
        num_hidden_layers: 1,
        first_k_dense_replace: 1,
      },
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      dcpSize: 8,
    });
    expect(oneLayerDsaBf16.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(400);

    const fullCsa2Dcp8 = evaluateDeployPlan({
      model: csa2Preset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      dcpSize: 8,
      enableEp: true,
    });
    expect(fullCsa2Dcp8.fourQuestions.q2Capacity.kvBytesPerTokenPerRank).toBe(61 * 274);
  });

  it("P1-4: Engram cpuOffload=true, dpSharedMemory=false puts table in Host DRAM (0 B NPU HBM), while cpuOffload=false bills NPU HBM", () => {
    const expectedTotalTable = 2 * 1_292_800 * 1280 * 2; // 6,619,136,000 B

    const sharedHost = evaluateDeployPlan({
      model: {
        ...engramPreset.config,
        engram_cpu_offload: true,
        engram_dp_shared_memory: true,
      },
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 2,
    });

    const privateHost = evaluateDeployPlan({
      model: {
        ...engramPreset.config,
        engram_cpu_offload: true,
        engram_dp_shared_memory: false,
      },
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 2,
    });

    const npuHbm = evaluateDeployPlan({
      model: {
        ...engramPreset.config,
        engram_cpu_offload: false,
        engram_dp_shared_memory: false,
      },
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 2,
    });

    // cpuOffload=true, dpSharedMemory=false -> 0 B NPU HBM, private Host DRAM per DP replica (2 * E on TP=2, DP=2, ETP=2)
    expect(privateHost.wave4Arch.engram?.npuWeightBytesPerRank).toBe(0);
    expect(privateHost.stages[2].pointEstimateBytes).toBe(sharedHost.stages[2].pointEstimateBytes);
    expect(privateHost.wave4Arch.engram?.hostDramBytesPerNode).toBe(2 * expectedTotalTable);

    // cpuOffload=false, dpSharedMemory=false -> E / ETP(2) in NPU HBM, 0 B Host DRAM
    expect(npuHbm.wave4Arch.engram?.npuWeightBytesPerRank).toBe(expectedTotalTable / 2);
    expect(npuHbm.wave4Arch.engram?.hostDramBytesPerNode).toBe(0);
    expect(npuHbm.stages[2].pointEstimateBytes - privateHost.stages[2].pointEstimateBytes).toBe(
      expectedTotalTable / 2,
    );

    // Invalid combination: dp_shared_memory=true with cpu_offload=false -> blocker
    const invalidSharedNoOffload = evaluateDeployPlan({
      model: {
        ...engramPreset.config,
        engram_cpu_offload: false,
        engram_dp_shared_memory: true,
      },
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 2,
    });
    expect(invalidSharedNoOffload.fourQuestions.q1Fit.verdict).toBe("blocked");
  });

  it("P1-5: KDA recommendMinCards uses totalFixedLinearStateBytes (maxNumSeqs) and flags unsolvable configs", () => {
    const kdaA2_32g = evaluateDeployPlan({
      model: "hybrid-kda-gqa",
      cardId: "a2-32g",
      weightPrecision: "bf16",
      tpSize: 1,
      maxModelLen: 32768,
      maxNumSeqs: 256,
    });
    expect(kdaA2_32g.fourQuestions.q2Capacity.oomStatus).toBe("insufficient_for_single_max_len_seq");
    // Must NOT recommend 1 card when 1 card fails capacity due to 256 * perSeqFixedLinearStateBytes!
    expect(kdaA2_32g.fourQuestions.q2Capacity.minCardsRecommended).toBeGreaterThanOrEqual(2);
    expect(kdaA2_32g.fourQuestions.q2Capacity.feasible).toBe(true);
    expect(kdaA2_32g.fourQuestions.q2Capacity.unsolvable).toBe(false);

    // Extreme maxNumSeqs where even 64 cards cannot hold fixed KDA state -> unsolvable: true, feasible: false
    const unsolvableKda = evaluateDeployPlan({
      model: "hybrid-kda-gqa",
      cardId: "310p-24g",
      weightPrecision: "fp16",
      tpSize: 1,
      maxModelLen: 131072,
      maxNumSeqs: 16384,
    });
    expect(unsolvableKda.fourQuestions.q2Capacity.feasible).toBe(false);
    expect(unsolvableKda.fourQuestions.q2Capacity.unsolvable).toBe(true);
  });

  it("P2-1 & P2-2: DCP physical block bytes vs virtual block global token span, plus KDA numSpecTokens threading", () => {
    // DeepSeek-V3 MLA (61 layers * 1152 B = 70,272 B local slot) at TP=8, DCP=2, blockSize=128, maxModelLen=300
    const dcpPlan = evaluateDeployPlan({
      model: mlaPreset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      dcpSize: 2,
      enableEp: true,
      blockSize: 128,
      maxModelLen: 300,
    });
    const q2 = dcpPlan.fourQuestions.q2Capacity;
    // Physical block holds 128 local slots -> 70,272 * 128 = 8,994,816 B (NOT halved!)
    expect(q2.kvBytesPerBlock).toBe(61 * 1152 * 128);
    // Virtual block spans 128 * 2 = 256 global tokens -> ceil(300 / 256) = 2 blocks (NOT ceil(300 / 128) = 3!)
    expect(q2.blocksPerMaxSeq).toBe(2);
    expect(q2.usableBlocksPoint).toBe(
      q2.rawBlocksRange[0] > 0 ? Math.floor(q2.kvPoolPointBytes / q2.kvBytesPerBlock) - 1 : 0,
    );
    expect(q2.totalKvTokenSlotsPoint).toBe(q2.usableBlocksPoint * 128 * 2);

    // KDA numSpecTokens=3 in evaluateDeployPlan: mamba_utils.py#L318 expands conv window to (convK-1+3)=6
    // and allocates 1 + numSpecTokens = 4 full state blocks per seq
    const kdaNoSpec = evaluateDeployPlan({
      model: kdaPreset.config,
      cardId: "a2-64g",
      tpSize: 2,
      maxNumSeqs: 16,
    });
    const kdaSpec3 = evaluateDeployPlan({
      model: kdaPreset.config,
      cardId: "a2-64g",
      tpSize: 2,
      maxNumSeqs: 16,
      numSpecTokens: 3,
    });
    const expectedSpec3LayerBytes = (16 * 128 * 128 * 4 + 3 * 16 * 128 * (4 - 1 + 3) * 2) * 4;
    expect(kdaSpec3.fourQuestions.q2Capacity.perSeqFixedLinearStateBytes).toBe(24 * expectedSpec3LayerBytes);
    expect(kdaSpec3.fourQuestions.q2Capacity.perSeqFixedLinearStateBytes).toBeGreaterThan(
      kdaNoSpec.fourQuestions.q2Capacity.perSeqFixedLinearStateBytes * 4,
    );
  });

  it("P2-3: GQA Roofline KV head replication at TP > numKvHeads & contiguous PP stage bottleneck", () => {
    const qwenTp16 = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      tpSize: 16,
      dcpSize: 1,
    });
    // 32 Q heads / TP=16 = 2 local Q heads; 8 KV heads replicated to 1 local KV head -> groupSize = 2 -> 2*2/2B = 2.0 FLOP/B
    expect(qwenTp16.roofline.gqaGroupSize).toBe(2);
    expect(qwenTp16.roofline.decodeKvAttnIntensityFlopsPerByte).toBeCloseTo(2.0, 2);

    // Hybrid PP=2 model: Stage 0 (layers 0..3) = heavy MoE + KDA; Stage 1 (layers 4..7) = light Dense + GQA
    const hybridPpModel = {
      model_type: "kimi_linear",
      hidden_size: 4096,
      num_hidden_layers: 8,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 8192,
      moe_intermediate_size: 2048,
      n_routed_experts: 64,
      num_experts_per_tok: 8,
      mlp_only_layers: [4, 5, 6, 7], // layers 0..3 are MoE, layers 4..7 are Dense!
      linear_kda: true,
      layer_types: [
        "linear_kda",
        "linear_kda",
        "linear_kda",
        "linear_kda",
        "full_attention",
        "full_attention",
        "full_attention",
        "full_attention",
      ],
      vocab_size: 32000,
      tie_word_embeddings: true,
      torch_dtype: "bfloat16",
    };
    const pp2Plan = evaluateDeployPlan({
      model: hybridPpModel,
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 1,
      ppSize: 2,
      enableEp: false,
      maxModelLen: 4096,
      maxNumSeqs: 16,
    });
    // Stage 0 has 4 MoE (64 experts * 3 * 4096 * 2048 * 2B = 3 GiB/layer -> ~12 GiB) + 4 KDA layers (0 B/tok paged KV).
    // Stage 1 has 4 Dense (~0.19 GiB/layer -> ~0.75 GiB) + 4 GQA layers (16 KiB/tok, 4096 tok = 64 MiB).
    // Bottleneck contiguous stage is Stage 0: weights must reflect Stage 0 (~12+ GiB) and paged KV must be Stage 0's 0 B/tok (NOT Stage 1's 16 KiB/tok mixed with Stage 0's MoE weights!).
    expect(pp2Plan.stages[2].pointEstimateBytes).toBeGreaterThan(10 * GIB);
    expect(pp2Plan.fourQuestions.q2Capacity.perTokenPagedKvBytes).toBe(0);
  });

  it("P2-4: Startup log parser keeps binary GiB quirk ONLY for Model loading / Loading model weights lines, converting SI GB accurately elsewhere", () => {
    const vllmQuirk = parseAscendStartupLog("INFO Model loading took 10.00 GB memory and 5.0 seconds");
    expect(vllmQuirk.weightsGiB).toBeCloseTo(10.0, 5);

    const ascendQuirk = parseAscendStartupLog("INFO Loading model weights took 10.00 GB");
    expect(ascendQuirk.weightsGiB).toBeCloseTo(10.0, 5);

    const siLog = [
      "Checkpoint size: 10.00 GB",
      "non_kv_cache_memory=20.00 GB",
      "torch_peak_increase=2.00 GB",
      "non_torch_increase=1.00 GB",
      "Available KV cache memory: 30.00 GB",
    ].join("\n");
    const parsedSi = parseAscendStartupLog(siLog);
    const siFactor = 1e9 / GIB; // ~0.9313225746
    expect(parsedSi.weightsGiB).toBeCloseTo(10 * siFactor, 5);
    expect(parsedSi.nonKvCacheMemoryGiB).toBeCloseTo(20 * siFactor, 5);
    expect(parsedSi.torchPeakIncreaseGiB).toBeCloseTo(2 * siFactor, 5);
    expect(parsedSi.nonTorchIncreaseGiB).toBeCloseTo(1 * siFactor, 5);
    expect(parsedSi.availableKvGiB).toBeCloseTo(30 * siFactor, 5);

    const binaryLog = "non_kv_cache_memory=20.00 GiB\nAvailable KV cache memory: 30.00 GiB";
    const parsedBin = parseAscendStartupLog(binaryLog);
    expect(parsedBin.nonKvCacheMemoryGiB).toBeCloseTo(20.0, 5);
    expect(parsedBin.availableKvGiB).toBeCloseTo(30.0, 5);
  });
});

describe("Astra Final Math Audit Regressions (P1-3..P1-7 & P2-6..P2-10)", () => {
  const csa2Preset = WAVE4_DEMO_PRESETS.find((p) => p.id === "csa2-sparse-mla")!;
  const engramPreset = WAVE4_DEMO_PRESETS.find((p) => p.id === "engram-conditional")!;

  it("P1-3: hybrid-kda-gqa on A2-32G BF16 TP2 256 seqs 32768 numSpecTokens=3 MUST fail capacity instead of fits", () => {
    const plan = evaluateDeployPlan({
      model: "hybrid-kda-gqa",
      cardId: "a2-32g",
      weightPrecision: "bf16",
      tpSize: 2,
      maxNumSeqs: 256,
      maxModelLen: 32768,
      numSpecTokens: 3,
    });
    expect(plan.fourQuestions.q2Capacity.oomStatus).not.toBe("fits");
    expect(plan.fourQuestions.q2Capacity.minCardsRecommended).not.toBeNull();
    expect(plan.fourQuestions.q2Capacity.minCardsRecommended!).toBeGreaterThan(2);
  });

  it("P1-4: heterogeneous PP (4 KDA + 4 GQA at TP1/PP2) takes min concurrency across all PP stages", () => {
    const hetero8 = {
      model_type: "kimi_linear",
      hidden_size: 4096,
      num_hidden_layers: 8,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 14336,
      linear_kda: true,
      layer_types: [
        "linear_kda",
        "linear_kda",
        "linear_kda",
        "linear_kda",
        "full_attention",
        "full_attention",
        "full_attention",
        "full_attention",
      ],
      vocab_size: 151936,
      tie_word_embeddings: true,
      torch_dtype: "bfloat16",
    };
    const plan = evaluateDeployPlan({
      model: hetero8,
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 1,
      ppSize: 2,
      maxModelLen: 32768,
      maxNumSeqs: 16,
    });
    // Stage 1 (4 GQA layers) caps full-len concurrency near ~117.76x, NOT Stage 0 KDA's ~5335x!
    expect(plan.fourQuestions.q2Capacity.maxConcurrencyPoint).toBeLessThan(200);
    expect(plan.fourQuestions.q2Capacity.maxConcurrencyPoint).toBeGreaterThan(50);
  });

  it("P1-5: min-card search finds non-power-of-two TP*PP (e.g., 3 cards TP1/PP3), never contradicts fits with unsolvable, and emits null/empty CLI when truly unsolvable", () => {
    // Qwen3-30B-A3B (~57 GiB BF16) on A2-32G: 2 cards fail, while TP1/PP3 (3 cards) fits
    const threeCardPlan = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-32g",
      weightPrecision: "bf16",
      tpSize: 1,
      ppSize: 1,
      maxModelLen: 4096,
    });
    expect(threeCardPlan.fourQuestions.q2Capacity.minCardsRecommended).toBe(3);
    expect(threeCardPlan.fourQuestions.q4Recommendation.recommendedTp).toBe(1);
    expect(threeCardPlan.fourQuestions.q4Recommendation.recommendedPp).toBe(3);

    // Explicit feasible topology (TP32/PP2 = 64 cards on A2-32G for hybrid-kda-gqa with 512 seqs & numSpecTokens=3)
    // must NEVER return fits + unsolvable=true
    const explicitFeasible = evaluateDeployPlan({
      model: "hybrid-kda-gqa",
      cardId: "a2-32g",
      weightPrecision: "bf16",
      tpSize: 32,
      ppSize: 2,
      maxModelLen: 32768,
      maxNumSeqs: 512,
      numSpecTokens: 3,
    });
    expect(explicitFeasible.fourQuestions.q2Capacity.oomStatus).toBe("fits");
    expect(explicitFeasible.fourQuestions.q2Capacity.unsolvable).toBe(false);
    expect(explicitFeasible.fourQuestions.q2Capacity.feasible).toBe(true);
    expect(explicitFeasible.fourQuestions.q2Capacity.minCardsRecommended).not.toBeNull();
    expect(explicitFeasible.fourQuestions.q2Capacity.minCardsRecommended!).toBeLessThanOrEqual(64);

    // Truly unsolvable config must stop emitting misleading recommended cards & CLI
    const unsolvable = evaluateDeployPlan({
      model: "hybrid-kda-gqa",
      cardId: "310p-24g",
      weightPrecision: "fp16",
      tpSize: 1,
      maxModelLen: 131072,
      maxNumSeqs: 16384,
    });
    expect(unsolvable.fourQuestions.q2Capacity.unsolvable).toBe(true);
    expect(unsolvable.fourQuestions.q2Capacity.minCardsRecommended).toBeNull();
    expect(unsolvable.fourQuestions.q2Capacity.minPhysicalCardsRecommended).toBeNull();
    expect(unsolvable.fourQuestions.q4Recommendation.recommendedTp).toBeNull();
    expect(unsolvable.fourQuestions.q4Recommendation.recommendedPp).toBeNull();
    expect(unsolvable.fourQuestions.q4Recommendation.cliHint).toBe("");
  });

  it("P1-7: MoE EP=off blocks when moe_intermediate_size % (tp * dp * pcp) !== 0", () => {
    // Qwen3-30B-A3B has moe_intermediate_size = 768; tp=2, dp=5, pcp=1 -> 768 % 10 !== 0
    const badNoEp = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "950dt-128g",
      weightPrecision: "bf16",
      tpSize: 2,
      dpSize: 5,
      pcpSize: 1,
      enableEp: false,
    });
    expect(badNoEp.fourQuestions.q1Fit.verdict).toBe("blocked");
    expect(
      badNoEp.fourQuestions.q1Fit.blockers.some((b) => b.id === "calc-moe-no-ep-intermediate-indivisible"),
    ).toBe(true);
  });

  it("P2-6: Engram defaults to cpu_offload=true, blocks dp_shared_memory on DP*PCP=1, and derives MRV2 node-shared DRAM", () => {
    const expectedTotalTable = 2 * 1_292_800 * 1280 * 2;
    // Omitting engram_cpu_offload and engram_dp_shared_memory -> defaults to cpu_offload=true (0 B HBM)
    const { engram_dp_shared_memory: _s, ...engramDefaultCfg } = engramPreset.config as Record<
      string,
      unknown
    >;
    const defaultOffload = evaluateDeployPlan({
      model: engramDefaultCfg,
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 1,
    });
    expect(defaultOffload.wave4Arch.engram?.cpuOffload).toBe(true);
    expect(defaultOffload.wave4Arch.engram?.npuWeightBytesPerRank).toBe(0);

    // Explicit dp_shared_memory=true with DP=1, PCP=1 -> blocker (not just warning)
    const singleMemberShared = evaluateDeployPlan({
      model: { ...engramPreset.config, engram_cpu_offload: true, engram_dp_shared_memory: true },
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 1,
      pcpSize: 1,
    });
    expect(singleMemberShared.fourQuestions.q1Fit.verdict).toBe("blocked");
    expect(
      singleMemberShared.fourQuestions.q1Fit.blockers.some((b) => b.id === "calc-engram-dp-shared-mem-dp1"),
    ).toBe(true);

    // Ascend MRV2 derivation: cpu_offload=true, dp_shared_memory=false, useV2ModelRunner=true, DP=2 -> node-shared 1x DRAM
    const mrv2Shared = evaluateDeployPlan({
      model: { ...engramPreset.config, engram_cpu_offload: true, engram_dp_shared_memory: false },
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 2,
      useV2ModelRunner: true,
    });
    expect(mrv2Shared.wave4Arch.engram?.dpSharedMemory).toBe(true);
    expect(mrv2Shared.wave4Arch.engram?.hostDramBytesPerNode).toBe(expectedTotalTable);
  });

  it("P2-7: PCP-only (dcpSize=1) on CSA2/SFA sparse MLA does NOT falsely trigger SFA DCP {2, 16} blocker", () => {
    const pcpOnlyCsa2 = evaluateDeployPlan({
      model: csa2Preset.config,
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      pcpSize: 2,
      dcpSize: 1,
      enableEp: true,
    });
    expect(pcpOnlyCsa2.fourQuestions.q1Fit.blockers.some((b) => b.id === "d4-pcp-dcp-sizing")).toBe(false);
  });

  it("P2-8: default PP layer partitioning matches upstream get_pp_indices (45 layers PP=2 -> [23, 22])", () => {
    const model45 = {
      model_type: "kimi_linear",
      hidden_size: 4096,
      num_hidden_layers: 45,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 12288,
      linear_kda: true,
      layer_types: [
        ...Array.from({ length: 23 }, () => "linear_kda"),
        ...Array.from({ length: 22 }, () => "full_attention"),
      ],
      vocab_size: 32000,
      tie_word_embeddings: true,
      torch_dtype: "bfloat16",
    };
    const plan = evaluateDeployPlan({
      model: model45,
      cardId: "a2-64g",
      tpSize: 1,
      ppSize: 2,
      maxNumSeqs: 64,
      maxModelLen: 4096,
    });
    // Under upstream get_pp_indices [23, 22]: Stage 0 holds all 23 linear_kda layers and 0 GQA layers.
    // Under the old buggy [22, 23]: Stage 0 had only 22 KDA layers and Stage 1 mixed 1 KDA + 22 GQA!
    expect(plan.inputSummary.localLayersPerRank).toBe(23);
    expect(plan.wave4Arch.kda?.localLinearLayerCount).toBe(23);
    expect(plan.wave4Arch.kda?.localFullAttnLayerCount).toBe(0);
  });

  it("P2-9: recommended CLI uses validated recommended topology without leaking stale input --decode-context-parallel-size", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      tpSize: 16,
      dcpSize: 2,
    });
    expect(plan.fourQuestions.q4Recommendation.recommendedTp).toBe(1);
    expect(plan.fourQuestions.q4Recommendation.cliHint).not.toContain("--decode-context-parallel-size");
  });

  it("P2-10: DCP physical block product formula matches LHS/RHS and Roofline uses all_gather Q heads (4 Q : 1 KV -> 4 FLOP/B)", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      tpSize: 16,
      dcpSize: 2,
      blockSize: 128,
    });
    // 32 Q heads / TP=16 = 2 local Q heads -> DCP=2 all_gather Q across DCP group -> 4 Q heads : 1 KV head -> 2 * 4 / 2B = 4.0 FLOP/B
    expect(plan.roofline.gqaGroupSize).toBe(4);
    expect(plan.roofline.decodeKvAttnIntensityFlopsPerByte).toBeCloseTo(4.0, 2);
    // Stage 6 formula must match 2.250 MiB/块 = 9.0 KiB × 256 = 18.0 KiB × 128 (NOT 9.0 KiB × 128!)
    expect(plan.stages[5].formula).toContain("2.250 MiB/块");
    expect(plan.stages[5].formula).not.toContain("9.0 KiB/tok × 128 tok/块");
    expect(plan.stages[5].formula).toMatch(/256|18\.0 KiB/);
  });
});

describe("Round 2 Verification Regressions (P1-1..P1-2 & P2-1..P2-4)", () => {
  it("P1-1: hybrid-kda-gqa on a2-32g TP=8 maxNumSeqs=1000 maxModelLen=4096 numSpecTokens=3 exceeds budget instead of fits", () => {
    const plan = evaluateDeployPlan({
      model: "hybrid-kda-gqa",
      cardId: "a2-32g",
      weightPrecision: "bf16",
      tpSize: 8,
      maxNumSeqs: 1000,
      maxModelLen: 4096,
      numSpecTokens: 3,
    });
    expect(plan.fourQuestions.q2Capacity.oomStatus).not.toBe("fits");
    expect(plan.fourQuestions.q1Fit.blockers.length).toBeGreaterThan(0);
  });

  it("P1-2: Engram min-card search validates Q1 with real shared-memory state and never recommends illegal 1-card TP=1/DP=1", () => {
    const plan = evaluateDeployPlan({
      model: "engram-conditional",
      cardId: "a2-64g",
      tpSize: 2,
      dpSize: 2,
      useV2ModelRunner: true,
    });
    const q4 = plan.fourQuestions.q4Recommendation;
    expect(plan.fourQuestions.q2Capacity.minCardsRecommended).not.toBeNull();
    expect(plan.fourQuestions.q2Capacity.minCardsRecommended!).toBeGreaterThanOrEqual(2);
    expect(q4.unsolvable).toBe(false);
    expect((q4.recommendedDp ?? 1) * (q4.recommendedPcp ?? 1)).toBeGreaterThan(1);

    const replay = evaluateDeployPlan({
      model: "engram-conditional",
      cardId: "a2-64g",
      tpSize: q4.recommendedTp!,
      ppSize: q4.recommendedPp!,
      dpSize: q4.recommendedDp ?? 1,
      pcpSize: q4.recommendedPcp ?? 1,
      dcpSize: q4.recommendedDcp ?? 1,
      useV2ModelRunner: true,
    });
    expect(replay.fourQuestions.q1Fit.blockers).toEqual([]);
    expect(replay.fourQuestions.q2Capacity.oomStatus).toBe("fits");
  });

  it("P2-1: min-card search enumerates legal DCP candidates when dcp=1 is unsolvable (1M-context MLA on a2-32g u=0.15)", () => {
    const mla1m = {
      model_type: "deepseek_v3",
      hidden_size: 4096,
      num_hidden_layers: 1,
      num_attention_heads: 32,
      num_key_value_heads: 32,
      kv_lora_rank: 1536,
      qk_nope_head_dim: 128,
      qk_rope_head_dim: 64,
      v_head_dim: 128,
      intermediate_size: 8192,
      vocab_size: 32000,
      max_position_embeddings: 1_048_576,
      torch_dtype: "bfloat16",
    };
    const plan = evaluateDeployPlan({
      model: mla1m,
      cardId: "a2-32g",
      gpuMemoryUtilization: 0.15,
      tpSize: 1,
      maxModelLen: 1_048_576,
      maxNumSeqs: 1,
    });
    const q4 = plan.fourQuestions.q4Recommendation;
    expect(plan.fourQuestions.q2Capacity.unsolvable).toBe(false);
    expect(plan.fourQuestions.q2Capacity.feasible).toBe(true);
    expect(q4.recommendedDcp).not.toBeNull();
    expect(q4.recommendedDcp!).toBeGreaterThan(1);
    expect(q4.cliHint).toContain("--decode-context-parallel-size");

    const replay = evaluateDeployPlan({
      model: mla1m,
      cardId: "a2-32g",
      gpuMemoryUtilization: q4.recommendedGpuMemoryUtilization,
      tpSize: q4.recommendedTp!,
      ppSize: q4.recommendedPp!,
      dpSize: q4.recommendedDp ?? 1,
      dcpSize: q4.recommendedDcp ?? 1,
      maxModelLen: 1_048_576,
      maxNumSeqs: 1,
    });
    expect(replay.fourQuestions.q1Fit.blockers).toEqual([]);
    expect(replay.fourQuestions.q2Capacity.oomStatus).toBe("fits");
  });

  it("P2-2: buildRecommendation keeps feasible user gpuMemoryUtilization (0.95) when default 0.90 fails capacity", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 1,
      maxModelLen: 4096,
      gpuMemoryUtilization: 0.95,
    });
    const q4 = plan.fourQuestions.q4Recommendation;
    expect(plan.fourQuestions.q2Capacity.minCardsRecommended).toBe(1);
    expect(q4.recommendedGpuMemoryUtilization).toBeCloseTo(0.95, 2);
    expect(q4.cliHint).toContain("--gpu-memory-utilization 0.95");

    const replay = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: q4.recommendedPrecision,
      tpSize: q4.recommendedTp!,
      ppSize: q4.recommendedPp!,
      dpSize: q4.recommendedDp ?? 1,
      maxModelLen: 4096,
      gpuMemoryUtilization: q4.recommendedGpuMemoryUtilization,
    });
    expect(replay.fourQuestions.q1Fit.blockers).toEqual([]);
    expect(replay.fourQuestions.q2Capacity.oomStatus).toBe("fits");
  });

  it("P1-2 (final): PCP > 1 without explicit useV2ModelRunner triggers d4-pcp-requires-mrv2 blocker and Q4 replay has zero blockers", () => {
    const plan = evaluateDeployPlan({
      model: "engram-conditional",
      cardId: "a2-64g",
      tpSize: 1,
      dpSize: 1,
      pcpSize: 2,
      useV2ModelRunner: false,
    });
    expect(plan.fourQuestions.q1Fit.verdict).toBe("blocked");
    expect(plan.fourQuestions.q1Fit.blockers.some((b) => b.id === "d4-pcp-requires-mrv2")).toBe(true);

    const q4 = plan.fourQuestions.q4Recommendation;
    expect(q4.unsolvable).toBe(false);
    expect(q4.recommendedPcp ?? 1).toBe(1);
    const replay = evaluateDeployPlan({
      model: "engram-conditional",
      cardId: "a2-64g",
      tpSize: q4.recommendedTp!,
      ppSize: q4.recommendedPp!,
      dpSize: q4.recommendedDp ?? 1,
      pcpSize: q4.recommendedPcp ?? 1,
      dcpSize: q4.recommendedDcp ?? 1,
      useV2ModelRunner: false,
    });
    expect(replay.fourQuestions.q1Fit.blockers).toEqual([]);
    expect(replay.fourQuestions.q2Capacity.oomStatus).toBe("fits");
  });

  it("P2-1 (final): DCP min-card search enumerates all valid divisors of tp (e.g. TP=3, DCP=3 for 24-head MLA)", () => {
    const mla24 = {
      model_type: "deepseek_v3",
      hidden_size: 3072,
      num_hidden_layers: 1,
      num_attention_heads: 24,
      num_key_value_heads: 24,
      kv_lora_rank: 1536,
      qk_nope_head_dim: 128,
      qk_rope_head_dim: 64,
      v_head_dim: 128,
      intermediate_size: 6144,
      vocab_size: 32000,
      max_position_embeddings: 2_000_000,
      torch_dtype: "bfloat16",
    };
    const plan = evaluateDeployPlan({
      model: mla24,
      cardId: "a2-32g",
      gpuMemoryUtilization: 0.15,
      tpSize: 1,
      maxModelLen: 1_500_000,
      maxNumSeqs: 1,
    });
    const q4 = plan.fourQuestions.q4Recommendation;
    expect(plan.fourQuestions.q2Capacity.minCardsRecommended).toBe(3);
    expect(q4.recommendedTp).toBe(3);
    expect(q4.recommendedDcp).toBe(3);
  });

  it("P2-2 (final): CLI --gpu-memory-utilization keeps >2 decimal precision when 2-decimal rounding would break fits", () => {
    // Find exact 3-decimal borderline u on Qwen3-30B-A3B BF16 a2-64g where u fits, while u rounded down to 2 decimals fails
    let borderlineU: number | null = null;
    for (let m = 931; m <= 969; m += 1) {
      if (m % 10 === 0 || m % 10 >= 5) continue; // rounds down at 2 decimals
      const u = m / 1000;
      const uDown = Number(u.toFixed(2));
      const pCur = evaluateDeployPlan({
        model: "Qwen3-30B-A3B",
        cardId: "a2-64g",
        weightPrecision: "bf16",
        tpSize: 1,
        maxModelLen: 4096,
        gpuMemoryUtilization: u,
      });
      const pDown = evaluateDeployPlan({
        model: "Qwen3-30B-A3B",
        cardId: "a2-64g",
        weightPrecision: "bf16",
        tpSize: 1,
        maxModelLen: 4096,
        gpuMemoryUtilization: uDown,
      });
      if (
        pCur.fourQuestions.q2Capacity.oomStatus === "fits" &&
        pDown.fourQuestions.q2Capacity.oomStatus !== "fits"
      ) {
        borderlineU = u;
        break;
      }
    }
    expect(borderlineU).not.toBeNull();
    const plan = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 1,
      maxModelLen: 4096,
      gpuMemoryUtilization: borderlineU!,
    });
    const q4 = plan.fourQuestions.q4Recommendation;
    const match = q4.cliHint.match(/--gpu-memory-utilization\s+([0-9.]+)/);
    expect(match).not.toBeNull();
    const cliUtil = Number(match![1]);
    expect(cliUtil).toBeCloseTo(borderlineU!, 4);
    const replay = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: q4.recommendedPrecision,
      tpSize: q4.recommendedTp!,
      ppSize: q4.recommendedPp!,
      dpSize: q4.recommendedDp ?? 1,
      maxModelLen: 4096,
      gpuMemoryUtilization: cliUtil,
    });
    expect(replay.fourQuestions.q1Fit.blockers).toEqual([]);
    expect(replay.fourQuestions.q2Capacity.oomStatus).toBe("fits");
  });
});
