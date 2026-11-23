import { describe, expect, it } from "vitest";
import { getPresetSpec } from "../modelspec/presets";
import { fromArray } from "../tensor/tensor";
import { QWEN3_TEACHING_SEGMENTS, QWEN3_VARIANTS, verifyQwen3ForwardContract } from "./qwen-teaching";
import { buildQwenMoeHandCalcExample, extractQwenMoeOptions, forwardQwenMoeBlock } from "./qwenMoeExample";

describe("Qwen3-8B 与 Qwen3-30B-A3B 教学算子与形状契约", () => {
  it("Qwen3-8B 单层前向产生完整 21 步且张量形状链与 GQA 4:1 KV Cache 字节核算严格对齐", () => {
    const report = verifyQwen3ForwardContract("kv-cache");

    // Qwen3-8B 架构规格真源核对
    expect(report.spec8b.numLayers).toBe(36);
    expect(report.spec8b.hidden).toBe(4096);
    expect(report.spec8b.intermediate).toBe(12288);
    expect(report.spec8b.numHeads).toBe(32);
    expect(report.spec8b.numKvHeads).toBe(8);
    expect(report.spec8b.headDim).toBe(128);
    expect(report.spec8b.gqaRatio).toBe(4);
    expect(report.spec8b.qkNorm).toBe(true);
    expect(report.spec8b.ropeTheta).toBe(1_000_000);
    expect(report.spec8b.vocab).toBe(151_936);
    expect(report.spec8b.tieWordEmbeddings).toBe(false);

    // GQA 4:1 KV Cache 字节核算（BF16 = 2B）：2 * 8 * 128 * 2 = 4096 B/token/层，36 层 = 147456 B/token
    expect(report.spec8b.kvBytesPerTokenLayer).toBe(4096);
    expect(report.spec8b.kvBytesPerTokenTotal).toBe(147_456);

    // 真实尺寸 forwardLayer 21 步录制与完整形状链（默认 kv-cache 预设 S=6）
    expect(report.stepCount8b).toBe(21);
    expect(report.timeline8b.steps.map((s) => s.id)).toEqual([
      "embed.gather",
      "L0.ln1",
      "L0.attn.q",
      "L0.attn.k",
      "L0.attn.v",
      "L0.attn.qknorm",
      "L0.attn.rope",
      "L0.attn.scores",
      "L0.attn.mask",
      "L0.attn.softmax",
      "L0.attn.pv",
      "L0.attn.merge",
      "L0.attn.o",
      "L0.res1",
      "L0.ln2",
      "L0.mlp.gate",
      "L0.mlp.up",
      "L0.mlp.act",
      "L0.mlp.down",
      "L0.res2",
      "L0.kv.write",
    ]);

    expect(report.shapeChain8b["L0.x_in"]).toEqual([6, 4096]);
    expect(report.shapeChain8b["L0.ln1.out"]).toEqual([6, 4096]);
    expect(report.shapeChain8b["L0.attn.q"]).toEqual([6, 4096]);
    expect(report.shapeChain8b["L0.attn.k"]).toEqual([6, 1024]);
    expect(report.shapeChain8b["L0.attn.v"]).toEqual([6, 1024]);
    expect(report.shapeChain8b["L0.attn.q_norm"]).toEqual([6, 32, 128]);
    expect(report.shapeChain8b["L0.attn.k_norm"]).toEqual([6, 8, 128]);
    expect(report.shapeChain8b["L0.attn.q_rope"]).toEqual([6, 32, 128]);
    expect(report.shapeChain8b["L0.attn.k_rope"]).toEqual([6, 8, 128]);
    expect(report.shapeChain8b["L0.attn.scores"]).toEqual([32, 6, 6]);
    expect(report.shapeChain8b["L0.attn.probs"]).toEqual([32, 6, 6]);
    expect(report.shapeChain8b["L0.attn.ctx"]).toEqual([6, 32, 128]);
    expect(report.shapeChain8b["L0.attn.ctx_merged"]).toEqual([6, 4096]);
    expect(report.shapeChain8b["L0.attn.out"]).toEqual([6, 4096]);
    expect(report.shapeChain8b["L0.res1"]).toEqual([6, 4096]);
    expect(report.shapeChain8b["L0.mlp.gate"]).toEqual([6, 12288]);
    expect(report.shapeChain8b["L0.mlp.up"]).toEqual([6, 12288]);
    expect(report.shapeChain8b["L0.mlp.act"]).toEqual([6, 12288]);
    expect(report.shapeChain8b["L0.mlp.down"]).toEqual([6, 4096]);
    expect(report.shapeChain8b["L0.res2"]).toEqual([6, 4096]);
    expect(report.shapeChain8b["L0.kv.block"]).toEqual([6, 2, 8, 128]);

    // 30B-A3B 真实前向输出形状与重归一和校验
    expect(report.moeRealOutShape).toEqual([1, 2048]);
    expect(report.moeRealWeightSum).toBeCloseTo(1.0, 6);
    expect(report.moeRealNumSharedExperts).toBe(0);
  }, 15_000);

  it("Qwen3-30B-A3B 128选8 Softmax 重归一权重和严格等于 1.0 且共享专家数为 0", () => {
    const spec30b = getPresetSpec("qwen3-30b-a3b");
    const opts = extractQwenMoeOptions(spec30b, 0);
    expect(opts.hidden).toBe(2048);
    expect(opts.numExperts).toBe(128);
    expect(opts.topK).toBe(8);
    expect(opts.moeIntermediate).toBe(768);
    expect(opts.normTopkProb).toBe(true);

    // GQA 8:1 KV Cache 核算：2 * 4 * 128 * 2 = 2048 B/token/层，48 层 = 98304 B/token
    const summary30b = QWEN3_VARIANTS["30b-a3b"];
    expect(summary30b.numLayers).toBe(48);
    expect(summary30b.gqaRatio).toBe(8);
    expect(summary30b.numSharedExperts).toBe(0);
    expect(summary30b.kvBytesPerTokenLayer).toBe(2048);
    expect(summary30b.kvBytesPerTokenTotal).toBe(98_304);

    // 多 token 实算：每个 token 的 8 个重归一权重之和严格为 1.0，且最终输出等于 8 个加权专家之和（无共享分支）
    const S = 2;
    const xData = new Float32Array(S * opts.hidden);
    for (let i = 0; i < xData.length; i++) {
      xData[i] = Math.cos(i * 0.071) * 0.3;
    }
    const res = forwardQwenMoeBlock(fromArray([S, opts.hidden], ["S", "H"], xData), opts);
    expect(res.numSharedExperts).toBe(0);
    expect(res.routerLogits.shape).toEqual([S, 128]);
    expect(res.routerProbs.shape).toEqual([S, 128]);
    expect(res.routingWeights.shape).toEqual([S, 8]);
    expect(res.expertAct.shape).toEqual([S, 8, 768]);
    expect(res.out.shape).toEqual([S, 2048]);

    for (let s = 0; s < S; s++) {
      expect(res.selectedExperts[s]).toHaveLength(8);
      expect(new Set(res.selectedExperts[s]).size).toBe(8);
      let fullProbSum = 0;
      for (let e = 0; e < 128; e++) fullProbSum += res.routerProbs.data[s * 128 + e] ?? 0;
      expect(fullProbSum).toBeCloseTo(1.0, 5);

      let top8WeightSum = 0;
      for (let k = 0; k < 8; k++) {
        const w = res.routingWeights.data[s * 8 + k] ?? 0;
        expect(w).toBeGreaterThan(0);
        top8WeightSum += w;
      }
      expect(top8WeightSum).toBeCloseTo(1.0, 6);

      // 核对前 16 个通道：out[s, h] === Σ_{k=0..7} weightedExpertOut[s, k, h]
      for (let h = 0; h < 16; h++) {
        let sumH = 0;
        for (let k = 0; k < 8; k++) {
          sumH += res.weightedExpertOut.data[(s * 8 + k) * opts.hidden + h] ?? 0;
        }
        expect(res.out.data[s * opts.hidden + h]).toBeCloseTo(sumH, 5);
      }
    }

    // 手算核对表校验
    const hand = buildQwenMoeHandCalcExample();
    expect(hand.specShapes.numSharedExperts).toBe(0);
    expect(hand.picks).toHaveLength(8);
    expect(hand.top8SumBeforeRenorm).toBeGreaterThan(0.5);
    expect(hand.top8SumBeforeRenorm).toBeLessThan(1.0);
    expect(hand.renormWeightSum).toBeCloseTo(1.0, 6);
    const manualC0 = hand.picks.reduce((acc, p) => acc + p.renormWeight * p.expertOutSlice[0], 0);
    const manualC1 = hand.picks.reduce((acc, p) => acc + p.renormWeight * p.expertOutSlice[1], 0);
    expect(hand.combinedSlice[0]).toBeCloseTo(manualC0, 6);
    expect(hand.combinedSlice[1]).toBeCloseTo(manualC1, 6);
  });

  it("教学段落目录编号连续且覆盖从分词到选词的完整前向链路", () => {
    expect(QWEN3_TEACHING_SEGMENTS.length).toBe(16);
    QWEN3_TEACHING_SEGMENTS.forEach((seg, idx) => {
      expect(seg.n).toBe(idx + 1);
      expect(seg.flow8b.length).toBeGreaterThanOrEqual(2);
      expect(seg.flow30b.length).toBeGreaterThanOrEqual(2);
      expect(seg.beats.length).toBeGreaterThanOrEqual(2);
    });
  });
});
