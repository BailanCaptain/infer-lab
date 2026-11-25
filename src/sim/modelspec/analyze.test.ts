import { describe, expect, it } from "vitest";
import {
  analyzeKvPerToken,
  analyzeParams,
  indexerBytesPerTokenLayer,
  linearStateBytesPerSeqLayer,
} from "./analyze";
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
  it("解析扩容预设 Qwen3-32B 与 Qwen3-235B-A22B，同时保持 MODEL_PRESETS[0..2] 下标契约", () => {
    expect(MODEL_PRESETS.slice(0, 5).map((p) => p.id)).toEqual([
      "qwen3-0.6b",
      "qwen3-8b",
      "qwen3-30b-a3b",
      "qwen3-32b",
      "qwen3-235b-a22b",
    ]);
    const s32 = getPresetSpec("qwen3-32b");
    expect(s32.hidden).toBe(5120);
    expect(s32.numLayers).toBe(64);
    expect(s32.layers[0]?.attention).toMatchObject({
      kind: "gqa",
      numHeads: 64,
      numKvHeads: 8,
      headDim: 128,
    });
    expect(s32.unrecognized).toEqual([]);

    const s235 = getPresetSpec("qwen3-235b-a22b");
    expect(s235.hidden).toBe(4096);
    expect(s235.numLayers).toBe(94);
    expect(s235.layers[0]?.attention).toMatchObject({
      kind: "gqa",
      numHeads: 64,
      numKvHeads: 4,
      headDim: 128,
    });
    expect(s235.layers[0]?.mlp).toMatchObject({
      kind: "moe",
      numExperts: 128,
      topK: 8,
      moeIntermediate: 1536,
    });
    expect(s235.unrecognized).toEqual([]);
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
  it("KDA 投机解码（numSpecTokens > 0）：mamba_cache_mode=none 每请求预留 1 + numSpecTokens 个完整状态块", () => {
    const kdaSpec = parseHfConfig({
      model_type: "kimi_linear",
      hidden_size: 4096,
      num_hidden_layers: 4,
      num_attention_heads: 64,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 14336,
      linear_kda: true,
      linear_num_key_heads: 64,
      linear_num_value_heads: 64,
      linear_key_head_dim: 128,
      linear_value_head_dim: 128,
      linear_conv_kernel_dim: 4,
      layer_types: ["linear_kda", "linear_kda", "linear_kda", "full_attention"],
      vocab_size: 151936,
      torch_dtype: "bfloat16",
    });
    const kdaAttn = kdaSpec.layers[0]!.attention;
    const baseTp8 = linearStateBytesPerSeqLayer(kdaAttn, 8);
    const spec3Tp8 = linearStateBytesPerSeqLayer(kdaAttn, 8, 3);

    expect(baseTp8.convBytes).toBe(18_432);
    // vllm@ced6857a:mamba_utils.py#L318: conv window expands to (convKernel - 1 + numSpecTokens) = 6
    expect(spec3Tp8.convBytes).toBe(36_864);
    expect(spec3Tp8.recurrentBytes).toBe(baseTp8.recurrentBytes);
    expect(spec3Tp8.stateBlocksPerSeq).toBe(4);
    expect(spec3Tp8.singleBlockBytes).toBe(524_288 + 36_864);
    expect(spec3Tp8.totalBytes).toBe(2_244_608);

    const kvNoSpec = analyzeKvPerToken(kdaSpec, 2, 0);
    const kvWithSpec = analyzeKvPerToken(kdaSpec, 2, 3);
    const expectedTp1Spec3Layer = (64 * 128 * 128 * 4 + 3 * 64 * 128 * (4 - 1 + 3) * 2) * 4;
    expect(kvWithSpec.fixedStateBytesPerSeq).toBe(3 * expectedTp1Spec3Layer);
    expect(kvWithSpec.fixedStateBytesPerSeq).toBeGreaterThan(kvNoSpec.fixedStateBytesPerSeq * 4);
  });

  it("P1-6 / P2-4 SFA 索引缓存（Lightning Indexer）：BF16=256 B、INT8=128+2(FP16 scale)=130 B、FP8=128+4(FP32 scale)=132 B", () => {
    const baseDsaCfg = {
      model_type: "deepseek_v4",
      hidden_size: 7168,
      num_hidden_layers: 1,
      num_attention_heads: 128,
      kv_lora_rank: 512,
      qk_nope_head_dim: 128,
      qk_rope_head_dim: 64,
      v_head_dim: 128,
      uses_sfa_sparse: true,
      index_topk: 2048,
      index_head_dim: 128,
      index_n_heads: 64,
      intermediate_size: 18432,
      vocab_size: 129280,
      torch_dtype: "bfloat16",
    };
    const bf16Spec = parseHfConfig(baseDsaCfg);
    expect(indexerBytesPerTokenLayer(bf16Spec.layers[0]!.attention)).toBe(256);

    const int8Spec = parseHfConfig({ ...baseDsaCfg, indexer_kv_dtype: "int8" });
    expect(indexerBytesPerTokenLayer(int8Spec.layers[0]!.attention)).toBe(130);

    const fp8Spec = parseHfConfig({ ...baseDsaCfg, indexer_kv_dtype: "fp8" });
    expect(indexerBytesPerTokenLayer(fp8Spec.layers[0]!.attention)).toBe(132);

    const fp8E4m3Spec = parseHfConfig({ ...baseDsaCfg, indexer_kv_dtype: "float8_e4m3fn" });
    expect(indexerBytesPerTokenLayer(fp8E4m3Spec.layers[0]!.attention)).toBe(132);

    // P2-4: scale_dim=1 regardless of index_head_dim (256 -> 256+2=258 B INT8, 256+4=260 B FP8)
    const int8Dim256 = parseHfConfig({ ...baseDsaCfg, index_head_dim: 256, indexer_kv_dtype: "int8" });
    expect(indexerBytesPerTokenLayer(int8Dim256.layers[0]!.attention)).toBe(258);
    const fp8Dim256 = parseHfConfig({ ...baseDsaCfg, index_head_dim: 256, indexer_kv_dtype: "fp8" });
    expect(indexerBytesPerTokenLayer(fp8Dim256.layers[0]!.attention)).toBe(260);

    // Explicit indexerKvDtype="int8" recognized even when indexerKvElemBytes / indexerQuantEnabled are omitted
    expect(
      indexerBytesPerTokenLayer({
        kind: "dsa",
        numHeads: 128,
        numKvHeads: 1,
        headDim: 192,
        qkNorm: false,
        bias: false,
        ropeTheta: 10000,
        indexHeadDim: 128,
        indexerKvDtype: "int8",
      }),
    ).toBe(130);
  });

  it("P2-6 Engram 缺省 cpu_offload 默认为 true（Host DRAM 卸载）", () => {
    const engramSpec = parseHfConfig({
      model_type: "qwen3",
      hidden_size: 4096,
      num_hidden_layers: 4,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 12288,
      vocab_size: 32000,
      use_engram: true,
      engram_vocab_size: 100000,
      engram_hidden_size: 512,
      engram_layers: [1],
      torch_dtype: "bfloat16",
    });
    expect(engramSpec.engram?.cpuOffload).toBe(true);
    const params = analyzeParams(engramSpec);
    const engramItem = params.items.find((it) => it.id === "engram_tables");
    expect(engramItem?.label).toContain("Host DRAM 卸载");
  });
});
