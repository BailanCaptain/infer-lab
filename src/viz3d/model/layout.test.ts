import { describe, expect, it } from "vitest";
import { getPresetSpec } from "../../sim/modelspec/presets";
import { blocksOverlap, MIN_SIDE, modelLayout, side, VOCAB_CAP } from "./layout";

describe("整模型结构布局（Qwen3-0.6B，S=6）", () => {
  const spec = getPresetSpec("qwen3-0.6b");
  const lay = modelLayout(spec, 6);

  it("形状来自 ModelSpec：W_q [1024,2048]、W_k/W_v [1024,1024]、分数 [16,6,6]、MLP [1024,3072]", () => {
    const by = Object.fromEntries(lay.blocks.map((b) => [b.id, b]));
    expect(by["L0.Wq"]?.shape).toEqual([1024, 2048]);
    expect(by["L0.Wk"]?.shape).toEqual([1024, 1024]);
    expect(by["L0.scores"]?.shape).toEqual([16, 6, 6]);
    expect(by["L0.Wgate"]?.shape).toEqual([1024, 3072]);
    expect(by["L0.Wdown"]?.shape).toEqual([3072, 1024]);
    expect(by["embed.W"]?.shape).toEqual([151936, 1024]);
    expect(by["L0.kv"]?.shape).toEqual([2, 6, 1024]);
  });

  it("同一把尺：W_q 比 W_k 深 √2 倍（列数沿流向 z），Q 与 W_q 等深，X 的深度等于 W_q 的宽度", () => {
    const by = Object.fromEntries(lay.blocks.map((b) => [b.id, b]));
    expect(by["L0.Wq"]!.d / by["L0.Wk"]!.d).toBeCloseTo(Math.SQRT2, 5);
    expect(by["L0.q"]!.d).toBeCloseTo(by["L0.Wq"]!.d, 5);
    expect(by["L0.x_in"]!.d).toBeCloseTo(by["L0.Wq"]!.w, 5);
    expect(side(6)).toBe(MIN_SIDE);
  });

  it("词表维截断到上限并打标记", () => {
    const by = Object.fromEntries(lay.blocks.map((b) => [b.id, b]));
    expect(by["embed.W"]!.w).toBe(VOCAB_CAP);
    expect(by["embed.W"]!.truncated).toBe(true);
    expect(by["lm_head"]!.d).toBe(VOCAB_CAP);
    expect(by["logits"]!.truncated).toBe(true);
  });

  it("块两两不重叠，流向沿 -z 单调（越远越小），整体居中", () => {
    for (let i = 0; i < lay.blocks.length; i++)
      for (let j = i + 1; j < lay.blocks.length; j++)
        expect(
          blocksOverlap(lay.blocks[i]!, lay.blocks[j]!),
          `${lay.blocks[i]!.id} vs ${lay.blocks[j]!.id}`,
        ).toBe(false);
    const order = [
      "tokens",
      "embed.W",
      "L0.x_in",
      "L0.Wq",
      "L0.q",
      "L0.scores",
      "L0.Wo",
      "L0.Wgate",
      "L0.Wdown",
      "L0.x_out",
      "final.norm",
      "lm_head",
      "logits",
    ];
    const zs = order.map((id) => lay.blocks.find((b) => b.id === id)!.z);
    for (let i = 1; i < zs.length; i++) expect(zs[i]!).toBeLessThan(zs[i - 1]!);
    expect(lay.bounds.minX + lay.bounds.maxX).toBeCloseTo(0, 6);
    expect(lay.bounds.minZ + lay.bounds.maxZ).toBeCloseTo(0, 6);
  });

  it("其余 27 层折成薄片叠在第 0 层之后、输出之前", () => {
    expect(lay.deck?.count).toBe(27);
    const zOut = lay.blocks.find((b) => b.id === "L0.x_out")!.z;
    const zHead = lay.blocks.find((b) => b.id === "final.norm")!.z;
    expect(lay.deck!.z0).toBeLessThan(zOut);
    expect(lay.deck!.z0 - lay.deck!.pitch * 26).toBeGreaterThan(zHead);
    expect(lay.blocks.filter((b) => b.labelSide === "front").map((b) => b.id)).toEqual([
      "L0.Wq",
      "L0.Wk",
      "L0.Wv",
      "L0.q",
      "L0.k",
      "L0.v",
      "L0.scores",
      "L0.kv",
      "L0.Wgate",
      "L0.Wup",
    ]);
    expect(lay.groups.map((g) => g.id)).toEqual(["embed", "L0.attn", "L0.mlp", "deck", "head"]);
  });

  it("Qwen3-8B 也能布局（36 层、GQA 32/8）", () => {
    const l8 = modelLayout(getPresetSpec("qwen3-8b"), 6);
    expect(l8.deck?.count).toBe(35);
    expect(l8.blocks.find((b) => b.id === "L0.scores")?.shape).toEqual([32, 6, 6]);
  });
});
