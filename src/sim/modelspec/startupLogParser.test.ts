import { describe, expect, it } from "vitest";
import { evaluateDeployPlan } from "./deployCalculator";
import { parseAscendStartupLog, reconcileStartupLog } from "./startupLogParser";

const GIB = 1024 ** 3;

describe("startupLogParser P2 regressions", () => {
  it("P2-1: treats MB as decimal SI even on upstream GB-as-GiB weight loading lines", () => {
    const expectedDecimal1000MbGiB = (1000 * 1e6) / GIB;

    const vllmMb = parseAscendStartupLog("INFO Model loading took 1000 MB memory and 1.2 seconds");
    expect(vllmMb.weightsGiB).toBeCloseTo(expectedDecimal1000MbGiB, 6);
    expect(vllmMb.weightsGiB).not.toBeCloseTo(1000 / 1024, 3);

    const ascendMb = parseAscendStartupLog("INFO Loading model weights took 1000 MB");
    expect(ascendMb.weightsGiB).toBeCloseTo(expectedDecimal1000MbGiB, 6);

    // Binary MiB stays binary (1024 MiB = 1 GiB)
    const binaryMib = parseAscendStartupLog("INFO Model loading took 1024 MiB memory");
    expect(binaryMib.weightsGiB).toBeCloseTo(1.0, 6);

    // Known upstream GB quirk remains binary GiB on these two log lines
    const vllmGbQuirk = parseAscendStartupLog("INFO Model loading took 10.00 GB memory and 5.0 seconds");
    expect(vllmGbQuirk.weightsGiB).toBeCloseTo(10.0, 6);

    const ascendGbQuirk = parseAscendStartupLog("INFO Loading model weights took 7.4012 GB");
    expect(ascendGbQuirk.weightsGiB).toBeCloseTo(7.4012, 4);
  });

  it("P2-2: aligns reconciliation minimum KV threshold with Stage 6 fixed linear state + single max-len seq + null block", () => {
    const plan = evaluateDeployPlan({
      model: "hybrid-kda-gqa",
      cardId: "a2-32g",
      weightPrecision: "bf16",
      tpSize: 1,
      maxModelLen: 32768,
      maxNumSeqs: 256,
    });

    expect(plan.fourQuestions.q2Capacity.oomStatus).toBe("insufficient_for_single_max_len_seq");
    expect(plan.fourQuestions.q2Capacity.totalFixedLinearStateBytes / GIB).toBeGreaterThan(12);

    const parsed = parseAscendStartupLog("INFO [worker.py:661] Available KV cache memory: 9.60 GiB");
    const rec = reconcileStartupLog(plan, parsed);

    expect(rec.byKey.availableKv.status).toBe("oom-risk");
    expect(rec.byKey.availableKv.status).not.toBe("within-interval");
    expect(rec.overallStatus).toBe("oom-risk");
    expect(rec.byKey.availableKv.likelyRootCauses.some((c) => c.includes("门槛") || c.includes("固定"))).toBe(
      true,
    );
  });

  it("P2-3: heterogeneous PP (4 KDA + 4 GQA at TP=1, PP=2) reconciles NPU KV cache size against paged PP stages instead of 0", () => {
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
      maxModelLen: 4096,
      maxNumSeqs: 256,
    });
    expect(plan.fourQuestions.q2Capacity.perTokenPagedKvBytes).toBe(0);
    expect(plan.fourQuestions.q2Capacity.totalKvTokenSlotsPoint).toBeGreaterThan(3_000_000);

    const parsed = parseAscendStartupLog("INFO NPU KV cache size: 3,493,376 tokens");
    const rec = reconcileStartupLog(plan, parsed);
    expect(rec.byKey.kvTokens.status).toBe("within-interval");
    expect(rec.byKey.kvTokens.likelyRootCauses).toEqual([]);
  });

  it("P2-3 (final): aligns NPU KV cache size reconciliation with upstream get_kv_cache_capacity floor(maxConc * maxModelLen) for non-multiple maxModelLen=129", () => {
    const plan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      blockSize: 128,
      maxModelLen: 129,
    });
    const parsed = parseAscendStartupLog("INFO NPU KV cache size: 150,736 tokens");
    const rec = reconcileStartupLog(plan, parsed);
    expect(rec.byKey.kvTokens.status).toBe("within-interval");
    expect(rec.byKey.kvTokens.predictedPoint).toBeGreaterThan(140_000);
    expect(rec.byKey.kvTokens.predictedPoint).toBeLessThan(165_000);
  });
});
