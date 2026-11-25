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

  it("Wave 1 P1-2: 1/6 partial weight-only log returns partial instead of aligned and never claims 显存账目闭环", () => {
    const graphPlan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      gpuMemoryUtilization: 0.85,
      cudagraphMode: "FULL_AND_PIECEWISE",
    });
    const oneLine = parseAscendStartupLog(
      "(EngineCore pid=100) INFO [model_runner_v1.py:4476] Loading model weights took 15.29 GB",
    );
    const partialRec = reconcileStartupLog(graphPlan, oneLine);
    expect(partialRec.overallStatus).toBe("partial");
    expect(partialRec.summary).not.toContain("显存账目闭环");
    expect(partialRec.summary).toContain("1/6");

    // Eager mode (NONE) does not log Graph capturing finished, so 4/4 core budget items reach aligned
    const eagerPlan = evaluateDeployPlan({
      model: "Qwen3-8B",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      gpuMemoryUtilization: 0.85,
      cudagraphMode: "NONE",
      enforceEager: true,
    });
    const eagerW = (eagerPlan.stages[2].pointEstimateBytes / GIB).toFixed(2);
    const eagerNonKv = (
      (eagerPlan.stages[2].pointEstimateBytes +
        eagerPlan.stages[3].pointEstimateBytes +
        eagerPlan.stages[4].pointEstimateBytes) /
      GIB
    ).toFixed(2);
    const eagerKv = (eagerPlan.stages[5].pointEstimateBytes / GIB).toFixed(2);
    const eagerTok = eagerPlan.fourQuestions.q2Capacity.totalKvTokenSlotsPoint;
    const eagerFourItems = parseAscendStartupLog(
      [
        `INFO [model_runner_v1.py:4476] Loading model weights took ${eagerW} GiB`,
        `INFO [worker.py:658] Memory profiling takes 4.10 seconds. Total non KV cache memory: ${eagerNonKv} GiB`,
        `INFO [worker.py:660] Available KV cache memory: ${eagerKv} GiB`,
        `INFO [kv_cache_utils.py:1029] NPU KV cache size: ${eagerTok.toLocaleString("en-US")} tokens`,
      ].join("\n"),
    );
    const eagerRec = reconcileStartupLog(eagerPlan, eagerFourItems);
    expect(eagerRec.overallStatus).toBe("aligned");
    expect(eagerRec.summary).toContain("4/4");

    // Missing startup Free memory on device snapshot must return partial (5/6) rather than aligned (6/6), while pre-occupied 59.50/64.00 triggers oom-risk
    const refPlan = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      gpuMemoryUtilization: 0.92,
      maxModelLen: 32768,
      maxNumBatchedTokens: 2048,
      cudagraphMode: "PIECEWISE",
      cudagraphCaptureCount: 16,
    });
    const fiveLinesNoSnapshot = [
      "INFO 11-18 10:12:04 [model_runner_v1.py:4476] Loading model weights took 15.2564 GB",
      "DEBUG 11-18 10:12:15 [worker.py:659] Memory profiling takes 11.42 seconds. Total non KV cache memory: 18.00GiB; torch peak memory increase: 2.14GiB; total consumed (from mem_get_info): 15.86GiB; weights memory: 15.26GiB.",
      "INFO 11-18 10:12:15 [worker.py:661] Available KV cache memory: 40.88 GiB",
      "INFO 11-18 10:12:16 [kv_cache_utils.py:2396] NPU KV cache size: 297,472 tokens, Maximum concurrency for 32,768 tokens per request: 9.08x",
      "INFO 11-18 10:12:35 [gpu_model_runner.py:6930] Graph capturing finished in 19 secs, took 1.28 GiB",
    ];
    const noSnapRec = reconcileStartupLog(refPlan, parseAscendStartupLog(fiveLinesNoSnapshot.join("\n")));
    expect(noSnapRec.overallStatus).toBe("partial");
    expect(noSnapRec.summary).toContain("5/6");
    expect(noSnapRec.summary).not.toContain("显存账目闭环");

    const preOccupiedLog = [
      ...fiveLinesNoSnapshot,
      "INFO 11-18 10:12:35 [worker.py:950] Free memory on device (59.50/64.00 GiB) on startup. Desired GPU memory utilization is (0.92, 58.88 GiB).",
    ].join("\n");
    const preOccupiedRec = reconcileStartupLog(refPlan, parseAscendStartupLog(preOccupiedLog));
    expect(preOccupiedRec.overallStatus).toBe("oom-risk");
  });
});
