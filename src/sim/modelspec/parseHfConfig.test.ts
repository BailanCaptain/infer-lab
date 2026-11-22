import { describe, expect, it } from "vitest";
import { parseHfConfig } from "./parseHfConfig";

const validQwen3 = {
  model_type: "qwen3",
  architectures: ["Qwen3ForCausalLM"],
  hidden_size: 4096,
  num_hidden_layers: 36,
  num_attention_heads: 32,
  num_key_value_heads: 8,
  head_dim: 128,
  intermediate_size: 12288,
  vocab_size: 151936,
  max_position_embeddings: 32768,
  torch_dtype: "bfloat16",
};

const validMoe = {
  model_type: "qwen3_moe",
  architectures: ["Qwen3MoeForCausalLM"],
  hidden_size: 2048,
  num_hidden_layers: 48,
  num_attention_heads: 32,
  num_key_value_heads: 4,
  head_dim: 128,
  intermediate_size: 6144,
  moe_intermediate_size: 768,
  num_experts: 128,
  num_experts_per_tok: 8,
  vocab_size: 151936,
  torch_dtype: "bfloat16",
};

describe("parseHfConfig dimension bounds and safe integer validation", () => {
  it("parses valid dense and MoE configs within bounds", () => {
    const dense = parseHfConfig(validQwen3);
    expect(dense.numLayers).toBe(36);
    expect(dense.layers).toHaveLength(36);

    const moe = parseHfConfig(validMoe);
    expect(moe.numLayers).toBe(48);
    expect(moe.layers).toHaveLength(48);
  });

  it("rejects huge or non-integer num_hidden_layers immediately without allocating giant arrays", () => {
    for (const badLayers of [0, -4, 1.5, 513, 1_000_000_000, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(() => parseHfConfig({ ...validQwen3, num_hidden_layers: badLayers })).toThrow(
        /num_hidden_layers/,
      );
    }
  });

  it("rejects out-of-range or non-integer model dimensions", () => {
    expect(() => parseHfConfig({ ...validQwen3, vocab_size: 2_000_001 })).toThrow(/vocab_size/);
    expect(() => parseHfConfig({ ...validQwen3, vocab_size: 0 })).toThrow(/vocab_size/);
    expect(() => parseHfConfig({ ...validQwen3, hidden_size: 65_537 })).toThrow(/hidden_size/);
    expect(() => parseHfConfig({ ...validQwen3, hidden_size: 128.5 })).toThrow(/hidden_size/);
    expect(() => parseHfConfig({ ...validQwen3, intermediate_size: 262_145 })).toThrow(/intermediate_size/);
    expect(() => parseHfConfig({ ...validQwen3, num_attention_heads: 513 })).toThrow(/num_attention_heads/);
    expect(() => parseHfConfig({ ...validQwen3, num_key_value_heads: 513 })).toThrow(/num_key_value_heads/);
    expect(() => parseHfConfig({ ...validMoe, moe_intermediate_size: 262_145 })).toThrow(
      /moe_intermediate_size/,
    );
    expect(() => parseHfConfig({ ...validMoe, num_experts: 4_097 })).toThrow(
      /num_experts|n_routed_experts|num_local_experts/,
    );
    expect(() => parseHfConfig({ ...validMoe, num_experts: undefined, n_routed_experts: 5_000 })).toThrow(
      /n_routed_experts/,
    );
    expect(() => parseHfConfig({ ...validMoe, num_experts: undefined, num_local_experts: 5_000 })).toThrow(
      /num_local_experts/,
    );
  });
});
