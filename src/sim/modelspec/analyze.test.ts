import { describe, expect, it } from "vitest";
import { analyzeKvPerToken, analyzeParams } from "./analyze";
import { parseHfConfig, UnsupportedModelError } from "./parseHfConfig";
import { getPresetSpec, MODEL_PRESETS } from "./presets";

describe("parseHfConfig（Qwen3）", () => {
  it("解析 Qwen3-0.6B：GQA 16/8，qkNorm，tie embeddings，无未识别字段", () => {
    const s = getPresetSpec("qwen3-0.6b");
    expect(s.hidden).toBe(1024);
    expect(s.numLayers).toBe(28);
    expect(s.layers[0]?.attention).toMatchObject({
      kind: "gqa",
      numHeads: 16,
      numKvHeads: 8,
      headDim: 128,
      qkNorm: true,
    });
    expect(s.layers[0]?.mlp).toMatchObject({ kind: "dense", intermediate: 3072 });
    expect(s.tieWordEmbeddings).toBe(true);
    expect(s.unrecognized).toEqual([]);
  });
  it("解析 Qwen3-30B-A3B：48 层全部 MoE，128 专家 top-8", () => {
    const s = getPresetSpec("qwen3-30b-a3b");
    expect(s.layers.every((l) => l.mlp.kind === "moe")).toBe(true);
    expect(s.layers[0]?.mlp).toMatchObject({ kind: "moe", numExperts: 128, topK: 8, moeIntermediate: 768 });
    expect(s.unrecognized).toEqual([]);
  });
  it("mlp_only_layers 与 decoder_sparse_step 决定 dense/MoE 交错", () => {
    const raw = {
      ...(MODEL_PRESETS[2]?.raw as object),
      decoder_sparse_step: 2,
      mlp_only_layers: [0],
    } as Record<string, unknown>;
    const s = parseHfConfig(raw);
    expect(s.layers[0]?.mlp.kind).toBe("dense"); // mlp_only
    expect(s.layers[1]?.mlp.kind).toBe("moe"); // (1+1)%2==0
    expect(s.layers[2]?.mlp.kind).toBe("dense"); // (2+1)%2!=0
  });
  it("不支持的 model_type 抛错并携带类型名", () => {
    expect(() => parseHfConfig({ model_type: "glm5_next", architectures: ["X"] })).toThrow(
      UnsupportedModelError,
    );
  });
  it("text_config 嵌套时从内层取字段", () => {
    const inner = MODEL_PRESETS[0]?.raw as object;
    const s = parseHfConfig({ architectures: ["Wrapped"], text_config: inner });
    expect(s.hidden).toBe(1024);
  });
});

describe("analyzeParams 对照官方公布参数量（误差 < 1%）", () => {
  for (const p of MODEL_PRESETS) {
    it(p.name, () => {
      const s = getPresetSpec(p.id);
      const r = analyzeParams(s);
      const rel = (a: number, b: number) => Math.abs(a - b) / b;
      expect(rel(r.total, p.official.totalParams)).toBeLessThan(0.01);
      if (p.official.nonEmbeddingParams)
        expect(rel(r.nonEmbedding, p.official.nonEmbeddingParams)).toBeLessThan(0.01);
      if (p.official.activatedParams) expect(rel(r.active, p.official.activatedParams)).toBeLessThan(0.02);
      // 逐项之和 = 总量
      expect(r.items.reduce((s, x) => s + x.count, 0)).toBe(r.total);
    });
  }
  it("dense 模型 active == total", () => {
    const r = analyzeParams(getPresetSpec("qwen3-8b"));
    expect(r.active).toBe(r.total);
  });
});

describe("analyzeKvPerToken", () => {
  it("Qwen3-8B：每层 2×8×128×2 B = 4096 B，36 层 = 147456 B/token", () => {
    const r = analyzeKvPerToken(getPresetSpec("qwen3-8b"));
    expect(r.perLayer[0]?.bytes).toBe(4096);
    expect(r.bytesPerToken).toBe(4096 * 36);
  });
  it("Qwen3-30B-A3B：4 个 KV 头，每层 2048 B，48 层", () => {
    const r = analyzeKvPerToken(getPresetSpec("qwen3-30b-a3b"));
    expect(r.bytesPerToken).toBe(2 * 4 * 128 * 2 * 48);
  });
});
