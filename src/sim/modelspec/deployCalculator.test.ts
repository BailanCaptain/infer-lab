import { describe, expect, it } from "vitest";
import { analyzeKvPerToken, analyzeParams } from "./analyze";
import {
  ASCEND_CALC_CARDS,
  buildCurrentPlanCliHint,
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
    const refTemplates = SAMPLE_ASCEND_STARTUP_LOGS.filter((tpl) => tpl.isReferenceTemplate);
    expect(refTemplates).toHaveLength(2);
    for (const tpl of refTemplates) {
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

  it("六个 Ascend 910B3 真机实测启动日志（TP=1/2/4/8 + MoE TP4+EP4 / DP2+TP4+EP8）统一 FULL_AND_PIECEWISE 并完整提取 60.96 GiB 阶梯", () => {
    const measuredTemplates = SAMPLE_ASCEND_STARTUP_LOGS.filter((tpl) => !tpl.isReferenceTemplate);
    expect(measuredTemplates.map((tpl) => tpl.id)).toEqual([
      "real-910b3-qwen3-8b-tp1",
      "real-910b3-qwen3-8b-tp2",
      "real-910b3-qwen3-8b-tp4",
      "real-910b3-qwen3-8b-tp8",
      "real-910b3-qwen3-30b-a3b-tp4-ep4",
      "real-910b3-qwen3-30b-a3b-dp2-tp4-ep8",
    ]);
    for (const tpl of measuredTemplates) {
      expect(tpl.recommendedPlanInput.cudagraphMode).toBe("FULL_AND_PIECEWISE");
      const plan = evaluateDeployPlan(tpl.recommendedPlanInput);
      const parsed = parseAscendStartupLog(tpl.logText);
      expect(parsed.hasAnyMetric).toBe(true);
      expect(parsed.weightsGiB).not.toBeNull();
      expect(parsed.nonKvCacheMemoryGiB).not.toBeNull();
      expect(parsed.availableKvGiB).not.toBeNull();
      expect(parsed.kvCacheTokens).not.toBeNull();
      expect(parsed.aclGraphGiB).not.toBeNull();
      expect(parsed.totalDeviceGiB).toBeCloseTo(60.96, 2);

      const rec = reconcileStartupLog(plan, parsed);
      expect(rec.hcclDoubleCounted).toBe(false);
      expect(rec.byKey.weights.status).toBe("within-interval");
      expect(rec.byKey.availableKv.likelyRootCauses.join(" ")).toContain("60.96 GiB");
    }

    const tp2 = parseAscendStartupLog(
      measuredTemplates.find((tpl) => tpl.id === "real-910b3-qwen3-8b-tp2")!.logText,
    );
    expect(tp2.weightsGiB).toBeCloseTo(7.658, 3);
    expect(tp2.availableKvGiB).toBeCloseTo(43.52, 2);
    expect(tp2.kvCacheTokens).toBe(633_728);
    expect(tp2.aclGraphGiB).toBeCloseTo(2.93, 2);
    expect(tp2.nonTorchIncreaseGiB).toBeCloseTo(0.43, 2);

    const tp8 = parseAscendStartupLog(
      measuredTemplates.find((tpl) => tpl.id === "real-910b3-qwen3-8b-tp8")!.logText,
    );
    expect(tp8.weightsGiB).toBeCloseTo(1.937, 3);
    expect(tp8.availableKvGiB).toBeCloseTo(49.27, 2);
    expect(tp8.kvCacheTokens).toBe(2_869_888);
    expect(tp8.aclGraphGiB).toBeCloseTo(3.21, 2);
    expect(tp8.nonTorchIncreaseGiB).toBeCloseTo(0.44, 2);

    // TP=1 -> 2 -> 4 -> 8 固定 u=0.85 时，每卡 KV 与图显存呈单调递增阶梯
    const denseLadder = [
      "real-910b3-qwen3-8b-tp1",
      "real-910b3-qwen3-8b-tp2",
      "real-910b3-qwen3-8b-tp4",
      "real-910b3-qwen3-8b-tp8",
    ].map((id) => parseAscendStartupLog(measuredTemplates.find((tpl) => tpl.id === id)!.logText));
    expect(denseLadder.map((p) => p.availableKvGiB)).toEqual([36.29, 43.52, 47.35, 49.27]);
    expect(denseLadder.map((p) => p.kvCacheTokens)).toEqual([264_192, 633_728, 1_379_200, 2_869_888]);
    expect(denseLadder.map((p) => p.aclGraphGiB)).toEqual([2.59, 2.93, 3.1, 3.21]);
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

  it("P2-7: 多 Rank EP8 启动日志严格按进程/Rank 分桶，对调行序结果恒定、绝不跨进程混拼指标并支持显式 targetRank", () => {
    // 原始 EP8 raw #L724 (line 13: Worker_DP0_TP1_EP1, 2.64 GiB) 与 #L729 (line 18: Worker_DP1_TP1_EP5, 2.65 GiB)
    const ep1Line =
      "(Worker_DP0_TP1_EP1 pid=58357) INFO 11-23 02:50:40 [worker.py:950] Free memory on device (60.59/60.96 GiB) on startup. Desired GPU memory utilization is (0.88, 53.64 GiB). Actual usage: 7.52 GiB for weights, 0.37 GiB for peak activation, 0.55 GiB for non-torch memory, 2.64 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=45551219097` (42.42 GiB) to fit into requested memory, or `--kv-cache-memory=53007996928` (49.37 GiB) to fully utilize NPU free memory. Current KV cache memory: 45.21 GiB. After warmup: torch reserved memory 54.94 GiB, torch allocated memory 52.74 GiB.";
    const ep5Line =
      "(Worker_DP1_TP1_EP5 pid=58358) INFO 11-23 02:50:40 [worker.py:950] Free memory on device (60.58/60.96 GiB) on startup. Desired GPU memory utilization is (0.88, 53.64 GiB). Actual usage: 7.52 GiB for weights, 0.37 GiB for peak activation, 0.55 GiB for non-torch memory, 2.65 GiB for NPU graph memory. Replace gpu_memory_utilization with `--kv-cache-memory=45547135385` (42.42 GiB) to fit into requested memory, or `--kv-cache-memory=53001627648` (49.36 GiB) to fully utilize NPU free memory. Current KV cache memory: 45.21 GiB. After warmup: torch reserved memory 54.94 GiB, torch allocated memory 52.74 GiB.";

    const orderA = parseAscendStartupLog([ep1Line, ep5Line].join("\n"));
    const orderB = parseAscendStartupLog([ep5Line, ep1Line].join("\n"));

    // 对调行顺序后，选定 Rank、图显存、初始空闲显存与建议 KV 字节必须完全一致
    expect(orderA.selectedRankLabel).toBe("Worker_DP0_TP1_EP1");
    expect(orderB.selectedRankLabel).toBe("Worker_DP0_TP1_EP1");
    expect(orderA.aclGraphGiB).toBeCloseTo(2.64, 2);
    expect(orderB.aclGraphGiB).toBeCloseTo(2.64, 2);
    expect(orderA.initialFreeGiB).toBeCloseTo(60.59, 2);
    expect(orderB.initialFreeGiB).toBeCloseTo(60.59, 2);
    expect(orderA.suggestedKvMemoryBytes).toBe(45551219097);
    expect(orderB.suggestedKvMemoryBytes).toBe(45551219097);
    expect(orderA.detectedRanks).toEqual(["Worker_DP0_TP1_EP1", "Worker_DP1_TP1_EP5"]);
    expect(orderB.detectedRanks).toEqual(["Worker_DP0_TP1_EP1", "Worker_DP1_TP1_EP5"]);
    expect(orderA.rankSnapshots.map((s) => s.aclGraphGiB)).toEqual([2.64, 2.65]);
    expect(orderB.rankSnapshots.map((s) => s.aclGraphGiB)).toEqual([2.64, 2.65]);
    expect(orderA.crossRankNotes.join(" ")).toContain("2.64–2.65 GiB");
    expect(orderA.crossRankNotes.join(" ")).toContain("Worker_DP1_TP1_EP5");

    // 显式指定 targetRank 可确定性切换对账目标 Rank，同样与行序无关
    const explicitA = parseAscendStartupLog([ep1Line, ep5Line].join("\n"), {
      targetRank: "Worker_DP1_TP1_EP5",
    });
    const explicitB = parseAscendStartupLog([ep5Line, ep1Line].join("\n"), {
      targetRank: "Worker_DP1_TP1_EP5",
    });
    expect(explicitA.selectedRankLabel).toBe("Worker_DP1_TP1_EP5");
    expect(explicitB.selectedRankLabel).toBe("Worker_DP1_TP1_EP5");
    expect(explicitA.aclGraphGiB).toBeCloseTo(2.65, 2);
    expect(explicitB.aclGraphGiB).toBeCloseTo(2.65, 2);
    expect(explicitA.suggestedKvMemoryBytes).toBe(45547135385);
    expect(explicitB.suggestedKvMemoryBytes).toBe(45547135385);

    // 跨进程不混拼：Worker_DP0_TP0_EP0 仅提供 weights 与 EngineCore_DP0 提供 KV tokens，
    // 绝不能把另一个进程 Worker_DP1_TP1_EP5 的 graph/suggestedKvBytes 混入 Worker_DP0_TP0_EP0
    const mixedLines = [
      "(Worker_DP0_TP0_EP0 pid=58356) INFO 11-23 02:48:11 [model_runner_v1.py:4476] Loading model weights took 7.5152 GB",
      "(Worker_DP0_TP0_EP0 pid=58356) INFO 11-23 02:49:16 [worker.py:660] Available KV cache memory: 45.21 GiB",
      "(EngineCore_DP0 pid=57743) INFO 11-23 02:49:16 [kv_cache_utils.py:2395] NPU KV cache size: 1,975,168 tokens, Maximum concurrency for 32,768 tokens per request: 60.28x",
      "(EngineCore_DP1 pid=57744) INFO 11-23 02:49:16 [kv_cache_utils.py:2395] NPU KV cache size: 1,975,168 tokens, Maximum concurrency for 32,768 tokens per request: 60.28x",
      ep5Line,
    ];
    const ep0Only = parseAscendStartupLog(mixedLines.join("\n"), { targetRank: "Worker_DP0_TP0_EP0" });
    expect(ep0Only.weightsGiB).toBeCloseTo(7.5152, 4);
    expect(ep0Only.availableKvGiB).toBeCloseTo(45.21, 2);
    expect(ep0Only.kvCacheTokens).toBe(1_975_168);
    expect(ep0Only.aclGraphGiB).toBeNull();
    expect(ep0Only.suggestedKvMemoryBytes).toBeNull();
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

  it("P2-1: min-card search enumerates legal DCP candidates when dcp=1 is unsolvable (1M-context MLA on a2-32g u=0.15 & 9M-context at u=0.92)", () => {
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
      max_position_embeddings: 10_485_760,
      torch_dtype: "bfloat16",
    };
    const lowUtilPlan = evaluateDeployPlan({
      model: mla1m,
      cardId: "a2-32g",
      gpuMemoryUtilization: 0.15,
      tpSize: 1,
      maxModelLen: 1_048_576,
      maxNumSeqs: 1,
    });
    expect(lowUtilPlan.fourQuestions.q2Capacity.unsolvable).toBe(false);
    expect(lowUtilPlan.fourQuestions.q2Capacity.feasible).toBe(true);
    expect(lowUtilPlan.fourQuestions.q2Capacity.minCardsRecommended).toBeGreaterThan(1);

    const plan = evaluateDeployPlan({
      model: mla1m,
      cardId: "a2-32g",
      gpuMemoryUtilization: 0.92,
      tpSize: 1,
      maxModelLen: 9_437_184,
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
      maxModelLen: 9_437_184,
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
      max_position_embeddings: 20_000_000,
      torch_dtype: "bfloat16",
    };
    const lowUtilPlan = evaluateDeployPlan({
      model: mla24,
      cardId: "a2-32g",
      gpuMemoryUtilization: 0.15,
      tpSize: 1,
      maxModelLen: 1_500_000,
      maxNumSeqs: 1,
    });
    expect(lowUtilPlan.fourQuestions.q2Capacity.minCardsRecommended).toBe(3);

    const plan = evaluateDeployPlan({
      model: mla24,
      cardId: "a2-32g",
      gpuMemoryUtilization: 0.92,
      tpSize: 1,
      maxModelLen: 18_000_000,
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

describe("Wave 7 Precision & Topology Regressions (A.1–A.5)", () => {
  it("A.1: Stage 4 replicated KV head activation uses localKvHeads=1 (128 dim, NOT 512/8=64) when TP=8 > numKvHeads=4", () => {
    // Compare Qwen3-30B-A3B (32 Q, 4 KV, headDim=128, H=2048) vs a 8-KV-head model at TP=8:
    // At TP=8, BOTH have 1 local KV head (128 dim) per rank! Under the old bug, 4 KV heads got 512/8 = 64 dim (< 128 dim of 8 KV heads).
    const qwen30bTp8 = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 8,
      enableEp: true,
      maxNumBatchedTokens: 4096,
    });
    const eightKvCfg = {
      model_type: "qwen3_moe",
      hidden_size: 2048,
      num_hidden_layers: 48,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      head_dim: 128,
      moe_intermediate_size: 768,
      num_experts: 128,
      num_experts_per_tok: 8,
      vocab_size: 151936,
      torch_dtype: "bfloat16",
    };
    const eightKvTp8 = evaluateDeployPlan({
      model: eightKvCfg,
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 8,
      enableEp: true,
      maxNumBatchedTokens: 4096,
    });
    expect(qwen30bTp8.inputSummary.localKvHeadsPerRank).toBe(1);
    expect(eightKvTp8.inputSummary.localKvHeadsPerRank).toBe(1);
    // Identical H, Q/TP=512, localKvDim=128, FFN, vocab/TP -> Stage 4 torch peak must match 100%!
    expect(qwen30bTp8.stages[3].lowBytes).toBe(eightKvTp8.stages[3].lowBytes);
    expect(qwen30bTp8.stages[3].pointEstimateBytes).toBe(eightKvTp8.stages[3].pointEstimateBytes);
    expect(qwen30bTp8.stages[3].highBytes).toBe(eightKvTp8.stages[3].highBytes);
  });

  it("A.2: Quantized MoE separates residentScaleBytes from activeScaleBytes (excludes 112.5 MiB of unactivated experts' scales in TP=1 W8A8_DYNAMIC Top-8)", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 1,
      enableEp: false,
    });
    // Per expert INT8 scale = 2 * 768 * 8 + 2048 * 4 = 20,480 B; 48 layers * 120 unactivated experts = 117,964,800 B = 112.5 MiB.
    // Exact active weights + active scales for Qwen3-30B-A3B TP=1 W8A8_DYNAMIC:
    // - embed + lm_head + final_norm (BF16): (2 * 151936 * 2048 + 2048) * 2 = 1,244,663,808 B
    // - 48 layers non-quant (2*H + 2*headDim + H*128 router) * 2B: 48 * (4096 + 256 + 262144) * 2 = 25,583,616 B
    // - 48 layers attn INT8 weights (2048*4096 + 2*2048*512 + 4096*2048 = 18,874,368) + scales ((4096+1024+2048)*8 = 57,344):
    //   48 * (18,874,368 + 57,344) = 908,722,176 B
    // - 48 layers Top-8 active experts INT8 weights (8 * 3 * 2048 * 768 = 37,748,736) + active scales (8 * 20,480 = 163,840):
    //   48 * (37,748,736 + 163,840) = 1,819,803,648 B
    const expectedActiveBytes = 1_244_663_808 + 25_583_616 + 908_722_176 + 1_819_803_648;
    expect(plan.roofline.activeWeightBytesPerRank).toBe(expectedActiveBytes);
    // Resident Stage 3 weights STILL include all 128 experts + 112.5 MiB unactivated scales (~29.6+ GiB)
    expect(plan.stages[2].lowBytes).toBeGreaterThan(29 * GIB);
  });

  it("A.3: Roofline uses actual per-rank Q width (512 on TP=8, not clamped to 2048) and compares static w8a8 MoE against BF16 ridge point (~200)", () => {
    const qwen30bTp8 = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 8,
      enableEp: true,
      prefillTokens: 512,
    });
    // Actual per-rank Q projection at TP=8: M=512, K=2048, N=4096/8=512 (2B in/w/out)
    // flops = 2 * 512 * 2048 * 512 = 1,073,741,824
    // bytes = 2 * (512*2048 + 2048*512 + 512*512) = 4,718,592 -> intensity = 227.555... FLOP/B (NOT 341.3 from N=2048!)
    const expectedPrefillIntensity = (2 * 512 * 2048 * 512) / (2 * (512 * 2048 + 2048 * 512 + 512 * 512));
    expect(qwen30bTp8.roofline.prefillIntensityFlopsPerByte).toBeCloseTo(expectedPrefillIntensity, 2);

    // Static w8a8 on MoE: experts remain BF16 (2 B), so Roofline ridge point must be BF16 (~200 FLOP/B on A2-64G), NOT INT8 (400 FLOP/B)!
    const staticW8a8Moe = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "w8a8",
      tpSize: 4,
      dpSize: 4,
      enableEp: true,
      decodeBatchSize: 2048, // M_eff = (4 * 2048 * 8) / 128 = 512 (N=768) -> BF16 intensity ~268.4 FLOP/B (between 200 and 400!)
    });
    expect(staticW8a8Moe.roofline.ridgePointFlopsPerByte).toBeCloseTo(200, 1);
    expect(staticW8a8Moe.roofline.decodeLinearIntensityFlopsPerByte).toBeGreaterThan(220);
    expect(staticW8a8Moe.roofline.decodeLinearIntensityFlopsPerByte).toBeLessThan(360);
    expect(staticW8a8Moe.roofline.decodeLinearRegime).toBe("compute-bound");
  });

  it("A.4: Q4 re-runs minimal topology search with recommendedPrecision (TP=1 on A2 64G for w8a8_dynamic, 2 cards on 310P for w8a8sc_310p)", () => {
    // 1) Qwen3-30B-A3B on A2 64G when Q4 switches precision -> w8a8_dynamic fits on TP=1 (1 card)!
    const a2Fp8Main = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      version: "main",
      weightPrecision: "fp8_block",
      tpSize: 4,
      enableEp: true,
    });
    expect(a2Fp8Main.fourQuestions.q4Recommendation.recommendedPrecision).toBe("w8a8_dynamic");
    expect(a2Fp8Main.fourQuestions.q4Recommendation.feasible).toBe(true);
    expect(a2Fp8Main.fourQuestions.q4Recommendation.unsolvable).toBe(false);
    expect(a2Fp8Main.fourQuestions.q4Recommendation.recommendedTp).toBe(1);
    expect(a2Fp8Main.fourQuestions.q4Recommendation.recommendedPp).toBe(1);
    expect(a2Fp8Main.fourQuestions.q4Recommendation.cliHint).toContain("-tp 1");
    expect(a2Fp8Main.fourQuestions.q4Recommendation.cliHint).toContain("--quantization ascend");

    // Also when BF16 needs >= 4 cards on A2 64G (e.g. u=0.70, maxModelLen=131072, maxNumBatchedTokens=32768 where BF16 needs 4 cards,
    // while w8a8_dynamic fits on TP=1 on A2 64G!)
    const a2Bf16Tight = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 1,
      gpuMemoryUtilization: 0.7,
      maxModelLen: 131072,
      maxNumBatchedTokens: 32768,
    });
    // Wait: let's also check DeepSeek-V3 MLA BF16 -> w8a8_dynamic on A2 64G (BF16 unsolvable -> w8a8_dynamic feasible 16 cards!)
    const dsBf16 = evaluateDeployPlan({
      model: "deepseek-v3-mla",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 8,
      ppSize: 2,
      enableEp: true,
    });
    expect(dsBf16.fourQuestions.q4Recommendation.recommendedPrecision).toBe("w8a8_dynamic");
    expect(dsBf16.fourQuestions.q4Recommendation.feasible).toBe(true);
    expect(dsBf16.fourQuestions.q4Recommendation.unsolvable).toBe(false);
    expect(dsBf16.fourQuestions.q4Recommendation.cliHint).toContain("--quantization ascend");
    if (a2Bf16Tight.fourQuestions.q4Recommendation.recommendedPrecision === "w8a8_dynamic") {
      expect(a2Bf16Tight.fourQuestions.q4Recommendation.recommendedTp).toBeLessThan(4);
    }

    // 2) Qwen3-30B-A3B BF16 on 310P-24G -> Q4 switches to w8a8sc_310p and finds 2 logical cards (1 physical 300I DUO card, TP=2), NOT 4 cards from fp16!
    const p310Moe = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "310p-24g",
      weightPrecision: "bf16",
      tpSize: 1,
      maxModelLen: 16384,
    });
    expect(p310Moe.fourQuestions.q4Recommendation.recommendedPrecision).toBe("w8a8sc_310p");
    expect(p310Moe.fourQuestions.q4Recommendation.feasible).toBe(true);
    expect(p310Moe.fourQuestions.q4Recommendation.recommendedTp).toBe(2);
    expect(p310Moe.fourQuestions.q4Recommendation.recommendedPp).toBe(1);
    expect(p310Moe.fourQuestions.q4Recommendation.cliHint).toContain("-tp 2");
    expect(p310Moe.fourQuestions.q4Recommendation.cliHint).toContain("--dtype float16");
    expect(p310Moe.fourQuestions.q4Recommendation.cliHint).toContain("--quantization ascend");
  });

  it("A.5: Doctor handoff CLI includes non-default --max-model-len, --kv-cache-dtype, --max-num-batched-tokens, --max-num-seqs, and graph flags", () => {
    const planGraph = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "int8",
      tpSize: 2,
      maxModelLen: 16384,
      maxNumBatchedTokens: 4096,
      maxNumSeqs: 64,
      cudagraphMode: "FULL_DECODE_ONLY",
    });
    const cli = planGraph.fourQuestions.q4Recommendation.cliHint;
    expect(cli).toContain("--max-model-len 16384");
    expect(cli).toContain("--kv-cache-dtype int8");
    expect(cli).toContain("--max-num-batched-tokens 4096");
    expect(cli).toContain("--max-num-seqs 64");
    expect(cli).toContain('--compilation-config \'{"cudagraph_mode":"FULL_DECODE_ONLY"}\'');

    const planEager = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      tpSize: 1,
      enforceEager: true,
    });
    expect(planEager.fourQuestions.q4Recommendation.cliHint).toContain("--enforce-eager");
  });

  it("R2.1: Stage 4 hybrid model activation peak is permutation-invariant across layer_types and captures the widest layer", () => {
    const kdaPreset = WAVE4_DEMO_PRESETS.find((p) => p.id === "hybrid-kda-gqa")!;
    const orderA = evaluateDeployPlan({
      model: {
        ...kdaPreset.config,
        layer_types: ["linear_kda", "linear_kda", "linear_kda", "full_attention"],
      },
      cardId: "a2-64g",
      tpSize: 1,
    });
    const orderB = evaluateDeployPlan({
      model: {
        ...kdaPreset.config,
        layer_types: ["full_attention", "linear_kda", "linear_kda", "linear_kda"],
      },
      cardId: "a2-64g",
      tpSize: 1,
    });
    expect(orderA.stages[3].lowBytes).toBe(orderB.stages[3].lowBytes);
    expect(orderA.stages[3].pointEstimateBytes).toBe(orderB.stages[3].pointEstimateBytes);
    expect(orderA.stages[3].highBytes).toBe(orderB.stages[3].highBytes);
  });

  it("R2.2: Static w8a8 MoE uses INT8 bytes & INT8 ridge (400 FLOP/B) for Prefill q_proj (~387.46 < 400 memory-bound) while keeping BF16 ridge (200) for MoE experts", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "w8a8",
      tpSize: 8,
      enableEp: true,
      prefillTokens: 448,
    });
    // M=448, K=2048, N=512, INT8 actIn=1, w=1, BF16 out=2 -> 939,524,096 / 2,424,832 = 387.459... FLOP/B (< 400 INT8 ridge!)
    expect(plan.roofline.prefillIntensityFlopsPerByte).toBeCloseTo(387.46, 1);
    expect(plan.roofline.prefillRegime).toBe("memory-bound");
  });

  it("R2.3: Q4 minCards searches at recommended utilization when switching precision (1 card on low u -> 0.90) & CLI distinguishes dtype / weight_nz_mode / V2 runner", async () => {
    const { buildCurrentPlanCliHint } = await import("./deployCalculator");
    const u034Bf16 = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 1,
      maxModelLen: 16384,
      gpuMemoryUtilization: 0.34,
    });
    const q4Bf16 = u034Bf16.fourQuestions.q4Recommendation;
    expect(q4Bf16.recommendedPrecision).toBe("w8a8_dynamic");
    expect(q4Bf16.recommendedGpuMemoryUtilization).toBeCloseTo(0.9, 2);
    expect(q4Bf16.recommendedTp).toBe(1);
    expect(q4Bf16.recommendedPp).toBe(1);

    const u040Fp8Main = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      version: "main",
      weightPrecision: "fp8_block",
      tpSize: 1,
      maxModelLen: 16384,
      gpuMemoryUtilization: 0.4,
    });
    const q4Fp8 = u040Fp8Main.fourQuestions.q4Recommendation;
    expect(q4Fp8.recommendedPrecision).toBe("w8a8_dynamic");
    expect(q4Fp8.recommendedGpuMemoryUtilization).toBeCloseTo(0.9, 2);
    expect(q4Fp8.recommendedTp).toBe(1);
    expect(q4Fp8.recommendedPp).toBe(1);

    const bf16Plan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      weightNzMode: 2,
      useV2ModelRunner: true,
    });
    const fp16Plan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      weightPrecision: "fp16",
      weightNzMode: 0,
      useV2ModelRunner: false,
    });
    const cliBf16 = buildCurrentPlanCliHint(bf16Plan);
    const cliFp16 = buildCurrentPlanCliHint(fp16Plan);
    expect(cliBf16).not.toBe(cliFp16);
    expect(cliBf16).toContain("--dtype bfloat16");
    expect(cliFp16).toContain("--dtype float16");
    expect(cliBf16).toContain('"weight_nz_mode":2');
    expect(cliFp16).toContain('"weight_nz_mode":0');
    expect(cliBf16).toContain("VLLM_USE_V2_MODEL_RUNNER=1");
    expect(cliFp16).toContain("VLLM_USE_V2_MODEL_RUNNER=0");

    // Verify full round-trip fidelity through ConfigDoctor's `parseVllmServeCommand` (#68)
    const { parseVllmServeCommand } = await import("../doctor/cliParser");
    const parsedBf16 = parseVllmServeCommand(cliBf16);
    expect(parsedBf16.parseDiagnostics).toHaveLength(0);
    expect(parsedBf16.couplingInput.modelDtype).toBe("bfloat16");
    expect(parsedBf16.couplingInput.weightNzMode).toBe(2);
    expect(parsedBf16.couplingInput.useV2ModelRunner).toBe(true);

    const parsedFp16 = parseVllmServeCommand(cliFp16);
    expect(parsedFp16.parseDiagnostics).toHaveLength(0);
    expect(parsedFp16.couplingInput.modelDtype).toBe("float16");
    expect(parsedFp16.couplingInput.weightNzMode).toBe(0);
    expect(parsedFp16.couplingInput.useV2ModelRunner).toBe(false);

    // Verify `enableModelRunnerV2` alias round-trips identically
    const aliasPlan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      weightPrecision: "fp16",
      weightNzMode: 2,
      enableModelRunnerV2: true,
    });
    const parsedAlias = parseVllmServeCommand(buildCurrentPlanCliHint(aliasPlan));
    expect(parsedAlias.parseDiagnostics).toHaveLength(0);
    expect(parsedAlias.couplingInput.modelDtype).toBe("float16");
    expect(parsedAlias.couplingInput.weightNzMode).toBe(2);
    expect(parsedAlias.couplingInput.useV2ModelRunner).toBe(true);
  });

  it("R3.1: Stage 4 hybrid KDA wide V projection (linear_num_value_heads=512, linear_value_head_dim=512) bounds activation peak above single BF16 V output (8.59 GB)", () => {
    const kdaPreset = WAVE4_DEMO_PRESETS.find((p) => p.id === "hybrid-kda-gqa")!;
    const wideVKda = {
      ...kdaPreset.config,
      num_hidden_layers: 4,
      linear_num_value_heads: 512,
      linear_value_head_dim: 512,
    };
    const plan = evaluateDeployPlan({
      model: wideVKda,
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 1,
      maxNumBatchedTokens: 16384,
      maxNumSeqs: 1,
    });
    const singleVProjBytes = 16384 * 512 * 512 * 2; // 8,589,934,592 bytes
    expect(plan.stages[3].lowBytes).toBeGreaterThan(singleVProjBytes);
    expect(plan.stages[3].highBytes).toBeGreaterThan(singleVProjBytes * 1.5);
  });

  it("R3.2: Static w8a8 MoE Q3 exposes both INT8 Prefill ridge/peak (400 FLOP/B, 640 TFLOPS) & BF16 Decode MoE ridge/peak (200 FLOP/B, 320 TFLOPS) in structure and summary", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "w8a8",
      tpSize: 8,
      enableEp: true,
      prefillTokens: 448,
    });
    const r = plan.roofline as unknown as Record<string, unknown>;
    expect(r.prefillRidgePointFlopsPerByte).toBeCloseTo(400, 1);
    expect(r.prefillPeakComputeTflops).toBe(640);
    expect(Number(r.prefillAchievedTflops)).toBeGreaterThan(600);
    expect(plan.fourQuestions.q3Roofline.summary).toContain("400.0");
    expect(plan.fourQuestions.q3Roofline.summary).toContain("640");
    expect(plan.fourQuestions.q3Roofline.summary).toContain("200.0");
  });

  it("R3.3: Q4 re-searches minCards at recommendedGpuMemoryUtilization (0.90) even when starting precision already equals recommendedPrecision (w8a8_dynamic at u=0.40 -> 1 card)", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      version: "v0.30.0",
      tpSize: 1,
      maxModelLen: 16384,
      weightPrecision: "w8a8_dynamic",
      gpuMemoryUtilization: 0.4,
    });
    expect(plan.fourQuestions.q2Capacity.minCardsRecommended).toBe(2);
    const q4 = plan.fourQuestions.q4Recommendation;
    expect(q4.recommendedPrecision).toBe("w8a8_dynamic");
    expect(q4.recommendedGpuMemoryUtilization).toBeCloseTo(0.9, 2);
    expect(q4.recommendedTp).toBe(1);
    expect(q4.recommendedPp).toBe(1);
    expect(q4.cliHint).toContain("-tp 1");
    expect(q4.cliHint).toContain("--gpu-memory-utilization 0.9");
  });

  it("R3.4: buildCurrentPlanCliHint faithfully preserves VLLM_USE_V2_MODEL_RUNNER=0 when PCP > 1 and useV2ModelRunner=false so ConfigDoctor catches d4-pcp-requires-mrv2", async () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      tpSize: 2,
      pcpSize: 2,
      useV2ModelRunner: false,
    });
    const currentCli = buildCurrentPlanCliHint(plan);
    expect(currentCli).toContain("VLLM_USE_V2_MODEL_RUNNER=0");
    expect(currentCli).not.toContain("VLLM_USE_V2_MODEL_RUNNER=1");

    const { runSingleConfigDoctor } = await import("../doctor/configDoctor");
    const doc = runSingleConfigDoctor(currentCli, {
      mode: "full",
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(doc.hasBlockers).toBe(true);
    expect(doc.errors.some((e) => e.id === "d4-pcp-requires-mrv2")).toBe(true);
  });

  it("R4.1: buildCurrentPlanCliHint never silently repairs user mistakes (omits V2 env when undefined on PCP=2, keeps --block-size 128 on mxfp8, keeps --dtype bfloat16 on 310P) & Q3 summary includes prefillAchievedTflops", async () => {
    const { runSingleConfigDoctor } = await import("../doctor/configDoctor");

    // (1) P2-1: PCP=2 with useV2ModelRunner omitted (undefined) -> must NOT inject VLLM_USE_V2_MODEL_RUNNER=1
    const pcpUndefinedPlan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      tpSize: 2,
      pcpSize: 2,
    });
    expect(pcpUndefinedPlan.fourQuestions.q1Fit.blockers.some((b) => b.id === "d4-pcp-requires-mrv2")).toBe(
      true,
    );
    const pcpCli = buildCurrentPlanCliHint(pcpUndefinedPlan);
    expect(pcpCli).not.toContain("VLLM_USE_V2_MODEL_RUNNER=1");
    const pcpDoc = runSingleConfigDoctor(pcpCli, {
      mode: "full",
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(pcpDoc.errors.some((e) => e.id === "d4-pcp-requires-mrv2")).toBe(true);

    // (2) P2-2: 950dt-128g + mxfp8 + blockSize=128 + userSpecifiedBlockSize=true -> must emit --block-size 128
    const mxfp8Plan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "950dt-128g",
      kvCacheDtype: "mxfp8",
      blockSize: 128,
      userSpecifiedBlockSize: true,
    });
    expect(mxfp8Plan.fourQuestions.q1Fit.blockers.some((b) => b.id === "d3-mxfp8-c8-kv-block-size")).toBe(
      true,
    );
    const mxfp8Cli = buildCurrentPlanCliHint(mxfp8Plan);
    expect(mxfp8Cli).toContain("--block-size 128");
    const mxfp8Doc = runSingleConfigDoctor(mxfp8Cli, {
      mode: "full",
      hardwareFamily: "A5",
      version: "v0.30.0",
    });
    expect(mxfp8Doc.errors.some((e) => e.id === "d3-mxfp8-c8-kv-block-size")).toBe(true);

    // (3) P2-3: 310p-24g + bf16 -> must emit --dtype bfloat16 (NOT silently repaired to float16)
    const plan310pBf16 = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "310p-24g",
      weightPrecision: "bf16",
      tpSize: 1,
      maxModelLen: 1024,
    });
    expect(plan310pBf16.fourQuestions.q1Fit.blockers.some((b) => b.id === "calc-310p-no-bf16")).toBe(true);
    const cli310p = buildCurrentPlanCliHint(plan310pBf16);
    expect(cli310p).toContain("--dtype bfloat16");
    expect(cli310p).not.toContain("--dtype float16");
    const doc310p = runSingleConfigDoctor(cli310p, {
      mode: "full",
      hardwareFamily: "310P",
      version: "v0.30.0",
    });
    expect(doc310p.hasBlockers).toBe(true);

    // (4) Q3 summary includes achieved Prefill TFLOPS (e.g. 619.9 TFLOPS)
    const w8a8Plan = evaluateDeployPlan({
      model: "Qwen3-30B-A3B",
      cardId: "a2-64g",
      weightPrecision: "w8a8",
      tpSize: 8,
      enableEp: true,
      prefillTokens: 448,
    });
    expect(w8a8Plan.fourQuestions.q3Roofline.summary).toContain("619.9");

    // (5) 310p-24g + w8a8sc_310p -> valid 310P quantized config MUST emit --dtype float16 so Doctor passes cleanly
    const plan310pW8a8sc = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "310p-24g",
      weightPrecision: "w8a8sc_310p",
      tpSize: 1,
      maxModelLen: 1024,
    });
    const cli310pW8a8sc = buildCurrentPlanCliHint(plan310pW8a8sc);
    expect(cli310pW8a8sc).toContain("--dtype float16");
    const doc310pW8a8sc = runSingleConfigDoctor(cli310pW8a8sc, {
      mode: "full",
      hardwareFamily: "310P",
      version: "v0.30.0",
    });
    expect(doc310pW8a8sc.errors.some((e) => e.id === "d3-310p-requires-float16")).toBe(false);

    // (6) 950dt-128g + mxfp8 + blockSize=256 + explicit userSpecifiedBlockSize=false -> omits --block-size 256 (uses auto 512)
    const mxfp8AutoPlan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "950dt-128g",
      kvCacheDtype: "mxfp8",
      blockSize: 256,
      userSpecifiedBlockSize: false,
    });
    const mxfp8AutoCli = buildCurrentPlanCliHint(mxfp8AutoPlan);
    expect(mxfp8AutoCli).not.toContain("--block-size");
    const mxfp8AutoDoc = runSingleConfigDoctor(mxfp8AutoCli, {
      mode: "full",
      hardwareFamily: "A5",
      version: "v0.30.0",
    });
    expect(mxfp8AutoDoc.errors.some((e) => e.id === "d3-mxfp8-c8-kv-block-size")).toBe(false);
  });

  it("P2-7 regression: startupLogParser buckets by (workerLabel, pid) order-independently and never pairs EngineCore_DP0 with Worker_DP1", () => {
    const pid1Lines = [
      "(Worker_DP0_TP0_EP0 pid=1001) INFO 11-23 07:00:01 [worker.py:1] Loading model weights took 7.52 GB",
      "(Worker_DP0_TP0_EP0 pid=1001) INFO 11-23 07:00:02 [worker.py:2] Available KV cache memory: 45.21 GiB",
      "(Worker_DP0_TP0_EP0 pid=1001) INFO 11-23 07:00:03 [runner.py:3] Graph capturing finished in 80 secs, took 2.64 GiB",
    ];
    const pid2Lines = [
      "(Worker_DP0_TP0_EP0 pid=2002) INFO 11-23 07:00:01 [worker.py:1] Loading model weights took 7.52 GB",
      "(Worker_DP0_TP0_EP0 pid=2002) INFO 11-23 07:00:02 [worker.py:2] Available KV cache memory: 45.21 GiB",
      "(Worker_DP0_TP0_EP0 pid=2002) INFO 11-23 07:00:03 [runner.py:3] Graph capturing finished in 83 secs, took 2.95 GiB",
    ];
    const forwardParsed = parseAscendStartupLog([...pid1Lines, ...pid2Lines].join("\n"));
    const reverseParsed = parseAscendStartupLog([...pid2Lines, ...pid1Lines].join("\n"));
    expect(forwardParsed.aclGraphGiB).toBe(reverseParsed.aclGraphGiB);
    expect(forwardParsed.selectedRankLabel).toBe(reverseParsed.selectedRankLabel);
    expect(forwardParsed.rankSnapshots.length).toBe(2);

    // EngineCore_DP0 MUST NOT donate its KV token capacity to Worker_DP1_TP0_EP4
    const crossDpMismatch = [
      "(EngineCore_DP0 pid=500) INFO 11-23 07:00:05 [kv_cache_utils.py:1] NPU KV cache size: 1,975,168 tokens",
      "(Worker_DP1_TP0_EP4 pid=600) INFO 11-23 07:00:06 [worker.py:2] Available KV cache memory: 45.21 GiB",
    ].join("\n");
    const parsedCrossDp = parseAscendStartupLog(crossDpMismatch);
    expect(parsedCrossDp.kvCacheTokens).toBeNull();
  });

  it("Wave 1 P1-3: Engram dp_shared_memory derivation & validation match upstream v0.30.0 (c09d3e20) vs main (8d6180e2)", () => {
    const engramUnsharedModel = {
      ...WAVE4_DEMO_PRESETS.find((d) => d.id === "engram-conditional")!.config,
      engram_dp_shared_memory: false,
    };
    const v030NoOffload = evaluateDeployPlan({
      model: engramUnsharedModel,
      cardId: "a2-64g",
      version: "v0.30.0",
      tpSize: 2,
      dpSize: 2,
      useV2ModelRunner: true,
      engramCpuOffload: false,
    });
    expect(
      v030NoOffload.fourQuestions.q1Fit.silentRewrites.some(
        (r) => r.id === "calc-engram-mrv2-auto-dp-shared",
      ),
    ).toBe(true);
    expect(
      v030NoOffload.fourQuestions.q1Fit.blockers.some(
        (b) => b.id === "calc-engram-dp-shared-requires-cpu-offload",
      ),
    ).toBe(true);

    const mainNoOffload = evaluateDeployPlan({
      model: engramUnsharedModel,
      cardId: "a2-64g",
      version: "main",
      tpSize: 2,
      dpSize: 2,
      useV2ModelRunner: true,
      engramCpuOffload: false,
    });
    expect(
      mainNoOffload.fourQuestions.q1Fit.silentRewrites.some(
        (r) => r.id === "calc-engram-mrv2-auto-dp-shared",
      ),
    ).toBe(false);
    expect(
      mainNoOffload.fourQuestions.q1Fit.blockers.some(
        (b) => b.id === "calc-engram-dp-shared-requires-cpu-offload",
      ),
    ).toBe(false);

    // main defaults useV2ModelRunner=true when omitted (auto-deriving dp_shared_memory when cpu_offload=true), and blocks explicit useV2ModelRunner=false
    const mainAutoMrv2 = evaluateDeployPlan({
      model: engramUnsharedModel,
      cardId: "a2-64g",
      version: "main",
      tpSize: 2,
      dpSize: 2,
      engramCpuOffload: true,
    });
    expect(mainAutoMrv2.wave4Arch.engram?.dpSharedMemory).toBe(true);
    expect(mainAutoMrv2.stages[2].notes.join(" ")).toContain("dp_shared_memory=true");
    expect(
      mainAutoMrv2.fourQuestions.q1Fit.silentRewrites.some((r) => r.id === "calc-engram-mrv2-auto-dp-shared"),
    ).toBe(true);

    const mainExplicitV1 = evaluateDeployPlan({
      model: engramUnsharedModel,
      cardId: "a2-64g",
      version: "main",
      tpSize: 2,
      dpSize: 2,
      useV2ModelRunner: false,
    });
    expect(mainExplicitV1.fourQuestions.q1Fit.blockers.some((b) => b.id === "calc-main-mrv1-removed")).toBe(
      true,
    );

    // rfork tracks main@8d6180e2 and must NOT inherit v0.30.0's missing cpu_offload check
    const rforkNoOffload = evaluateDeployPlan({
      model: engramUnsharedModel,
      cardId: "a2-64g",
      version: "rfork",
      tpSize: 2,
      dpSize: 2,
      useV2ModelRunner: true,
      engramCpuOffload: false,
    });
    expect(rforkNoOffload.wave4Arch.engram?.dpSharedMemory).toBe(false);
    expect(rforkNoOffload.fourQuestions.q1Fit.blockers).toHaveLength(0);

    // v0.30.0 remediation avoids circular blockers on explicit dp_shared_memory=true + DP=2 and on PCP=2
    const v030ExplicitShareNoOffload = evaluateDeployPlan({
      model: { ...engramUnsharedModel, engram_dp_shared_memory: true },
      cardId: "a2-64g",
      version: "v0.30.0",
      tpSize: 2,
      dpSize: 2,
      useV2ModelRunner: true,
      engramCpuOffload: false,
    });
    const shareBlocker = v030ExplicitShareNoOffload.fourQuestions.q1Fit.blockers.find(
      (b) => b.id === "calc-engram-dp-shared-requires-cpu-offload",
    );
    expect(shareBlocker?.remediation).toContain("同时将 engram_dp_shared_memory 设为 false");
    expect(shareBlocker?.remediation).toContain("自动改回 true");
    expect(v030NoOffload.stages[4].notes.join(" ")).toContain("校验冲突，未进入 /dev/shm Gloo 共享");
    expect(v030NoOffload.stages[4].pointEstimateBytes).toBe(mainNoOffload.stages[4].pointEstimateBytes);

    const v030PcpNoOffload = evaluateDeployPlan({
      model: engramUnsharedModel,
      cardId: "a2-64g",
      version: "v0.30.0",
      tpSize: 2,
      pcpSize: 2,
      useV2ModelRunner: true,
      engramCpuOffload: false,
    });
    const pcpBlocker = v030PcpNoOffload.fourQuestions.q1Fit.blockers.find(
      (b) => b.id === "calc-engram-dp-shared-requires-cpu-offload",
    );
    expect(pcpBlocker?.remediation).toContain("PCP>1 强制要求 MRV2");
    expect(pcpBlocker?.remediation).not.toContain("关闭 MRV2");
  });
});
