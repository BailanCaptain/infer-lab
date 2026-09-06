import { describe, expect, it } from "vitest";
import { buildLayerTimeline } from "../../sim/model/forwardLayer";
import { getTokenPreset } from "../../sim/model/presets";
import { getPresetSpec } from "../../sim/modelspec/presets";
import { attentionLayout, MAX_CELLS_PER_SLICE, volumesOverlap } from "./attentionLayout";

describe("第 0 层注意力格子体布局（Qwen3-0.6B，S=6）", () => {
  const p = getTokenPreset();
  const tl = buildLayerTimeline(getPresetSpec("qwen3-0.6b"), {
    id: p.id,
    text: p.text,
    tokens: p.tokens,
    ids: p.ids,
  });
  const lay = attentionLayout(tl);
  const by = Object.fromEntries(lay.volumes.map((v) => [v.id, v]));

  it("1 单位 = 1 元素：W_q 墙 2048 宽 1024 高，X 条 1024 宽 6 高", () => {
    expect(by["L0.attn.q_proj"]?.w).toBe(2048);
    expect(by["L0.attn.q_proj"]?.h).toBe(1024);
    expect(by["L0.x_in"]?.w).toBe(1024);
    expect(by["L0.x_in"]?.h).toBe(6);
  });

  it("合并倍数让每片格数不超上限；激活不合并", () => {
    for (const v of lay.volumes) {
      expect(Math.ceil(v.rows / v.merge) * Math.ceil(v.cols / v.merge)).toBeLessThanOrEqual(
        MAX_CELLS_PER_SLICE,
      );
    }
    expect(by["L0.attn.q_proj"]?.merge).toBe(16);
    expect(by["L0.x_in"]?.merge).toBe(1);
    expect(by["L0.attn.probs"]?.merge).toBe(1);
  });

  it("头张量按头数叠片：Q 16 片、K/V 8 片、概率 16 片、KV Cache 2×8 片", () => {
    expect(by["L0.attn.q_rope"]?.slices).toHaveLength(16);
    expect(by["L0.attn.k_rope"]?.slices).toHaveLength(8);
    expect(by["L0.attn.probs"]?.slices).toHaveLength(16);
    expect(by["L0.kv.block"]?.slices).toHaveLength(16);
    expect(by["L0.kv.block"]?.slices[8]).toEqual({ head: 0, picks: [1] });
    expect(by["L0.attn.probs"]?.rows).toBe(6);
    expect(by["L0.attn.probs"]?.cols).toBe(6);
  });

  it("流向自下而上单调，块两两不重叠，Q 与 W_q 左对齐", () => {
    const order = [
      "L0.x_in",
      "L0.attn.q_proj",
      "L0.attn.q",
      "L0.attn.q_rope",
      "L0.attn.probs",
      "L0.attn.ctx",
      "L0.attn.o_proj",
      "L0.attn.out",
    ];
    const ys = order.map((id) => by[id]!.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
    for (let i = 0; i < lay.volumes.length; i++)
      for (let j = i + 1; j < lay.volumes.length; j++)
        expect(
          volumesOverlap(lay.volumes[i]!, lay.volumes[j]!),
          `${lay.volumes[i]!.id} vs ${lay.volumes[j]!.id}`,
        ).toBe(false);
    expect(by["L0.attn.q"]?.x).toBe(by["L0.attn.q_proj"]?.x);
    expect(lay.bounds.maxY).toBeGreaterThan(3000);
  });
});
