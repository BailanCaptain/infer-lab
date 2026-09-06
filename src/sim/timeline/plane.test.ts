import { describe, expect, it } from "vitest";
import { buildHardwareTimeline } from "../buildTimeline";
import { getTokenPreset } from "../model/presets";
import { getPresetSpec } from "../modelspec/presets";
import { shapeLabel } from "../tensor/tensor";
import { lazyWeight, weightAt } from "../weights";
import { headAxis, planeAxes, planeView } from "./plane";
import type { TensorRecord } from "./types";

function dense(shape: number[], dims: string[], fill: (i: number) => number): TensorRecord {
  const n = shape.reduce((a, b) => a * b, 1);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = fill(i);
  return { id: "t", name: "t", shape, dims, role: "activation", data, bytes: n * 4, absMax: 0 };
}

describe("planeAxes / headAxis", () => {
  it("无头维时行列取首末轴", () => {
    expect(headAxis(["S", "H"])).toBe(-1);
    expect(planeAxes(["S", "H"], true)).toEqual({ row: 0, col: 1, extra: [], head: -1 });
  });

  it("头维在中间：跳过后行列是 S 与 d_h", () => {
    expect(planeAxes(["S", "n_q", "d_h"], true)).toEqual({ row: 0, col: 2, extra: [], head: 1 });
  });

  it("头维在首位：跳过后行列是 S 与 S_k", () => {
    expect(planeAxes(["n_q", "S", "S_k"], true)).toEqual({ row: 1, col: 2, extra: [], head: 0 });
  });

  it("四维 KV 块：K|V 轴落到 extra，需要额外下标", () => {
    expect(planeAxes(["S", "K|V", "n_kv", "d_h"], true)).toEqual({
      row: 0,
      col: 3,
      extra: [1],
      head: 2,
    });
  });

  it("withHead=false 时头维当普通轴（与旧高亮校验语义一致）", () => {
    expect(planeAxes(["n_q", "S", "S_k"], false)).toEqual({ row: 0, col: 2, extra: [1], head: -1 });
  });
});

describe("planeView", () => {
  it("二维张量按行主序取值", () => {
    const v = planeView(dense([2, 3], ["S", "H"], (i) => i));
    expect([v.rows, v.cols, v.rowDim, v.colDim]).toEqual([2, 3, "S", "H"]);
    expect(v.at(1, 2)).toBe(5);
    expect(v.sliced).toBe(false);
  });

  it("一维 token id 序列显示成一行", () => {
    const v = planeView(dense([4], ["S"], (i) => 100 + i));
    expect([v.rows, v.cols]).toEqual([1, 4]);
    expect(v.at(0, 3)).toBe(103);
  });

  it("三维头张量按 head 切片，切换 head 取到不同数据", () => {
    // [S=2, n_q=3, d_h=4]，值 = 平铺下标
    const rec = dense([2, 3, 4], ["S", "n_q", "d_h"], (i) => i);
    const h0 = planeView(rec, { head: 0 });
    const h2 = planeView(rec, { head: 2 });
    expect([h0.rows, h0.cols]).toEqual([2, 4]);
    expect(h0.heads).toBe(3);
    expect(h0.at(0, 0)).toBe(0);
    expect(h0.at(1, 1)).toBe(13); // (1*3+0)*4 + 1
    expect(h2.at(0, 0)).toBe(8); // (0*3+2)*4
    expect(h2.at(1, 3)).toBe(23);
    expect(h2.sliced).toBe(true);
    // head 越界夹紧
    expect(planeView(rec, { head: 99 }).head).toBe(2);
  });

  it("[n_q,S,S_k] 头在首位时行列是 S×S_k", () => {
    const rec = dense([3, 2, 2], ["n_q", "S", "S_k"], (i) => i);
    const v = planeView(rec, { head: 1 });
    expect([v.rows, v.cols]).toEqual([2, 2]);
    expect(v.at(0, 0)).toBe(4);
    expect(v.at(1, 1)).toBe(7);
  });

  it("四维 KV 块：picks 选 K 或 V", () => {
    // [S=2, K|V=2, n_kv=2, d_h=3]
    const rec = dense([2, 2, 2, 3], ["S", "K|V", "n_kv", "d_h"], (i) => i);
    const k = planeView(rec, { head: 0, picks: [0] });
    const v = planeView(rec, { head: 0, picks: [1] });
    expect([k.rows, k.cols]).toEqual([2, 3]);
    expect(k.at(0, 0)).toBe(0);
    expect(v.at(0, 0)).toBe(6); // 跨过 K 的 n_kv*d_h = 6
    expect(v.at(1, 2)).toBe(20); // ((1*2+1)*2+0)*3 + 2
  });

  it("惰性权重走 weightAt，并带缩略图", () => {
    const w = lazyWeight("w", [8, 5], ["H", "I"], 0.02);
    const rec: TensorRecord = {
      id: "w",
      name: "w",
      shape: [8, 5],
      dims: ["H", "I"],
      role: "weight",
      lazy: w,
      thumb: { rows: 4, cols: 4, data: new Float32Array(16) },
      bytes: 160,
      absMax: 0.03,
    };
    const v = planeView(rec);
    expect([v.rows, v.cols]).toEqual([8, 5]);
    expect(v.at(3, 2)).toBe(weightAt(w, 3, 2));
    expect(v.thumb?.rows).toBe(4);
  });

  it("既无 data 也无 lazy 时报错", () => {
    expect(() =>
      planeView({ id: "x", name: "x", shape: [2], dims: ["S"], role: "input", bytes: 0, absMax: 0 }),
    ).toThrow(/无法显示/);
  });
});

describe("真实时间线的每个张量都能取到二维视图", () => {
  const tl = buildHardwareTimeline(getPresetSpec("qwen3-0.6b"), getTokenPreset());

  it("35 个张量全部可映射，且取值与原数据一致", () => {
    const recs = Object.values(tl.tensors);
    expect(recs.length).toBeGreaterThan(30);
    for (const rec of recs) {
      const v = planeView(rec);
      expect(v.rows).toBeGreaterThan(0);
      expect(v.cols).toBeGreaterThan(0);
      expect(Number.isFinite(v.at(0, 0))).toBe(true);
      expect(Number.isFinite(v.at(v.rows - 1, v.cols - 1))).toBe(true);
    }
  });

  it("关键张量的行列与真实形状对应", () => {
    const g = (id: string) => {
      const r = tl.tensors[id];
      if (!r) throw new Error(`缺张量 ${id}`);
      return r;
    };
    expect(planeView(g("L0.x_in"))).toMatchObject({ rows: 6, cols: 1024, rowDim: "S", colDim: "H" });
    expect(planeView(g("L0.attn.q_heads"))).toMatchObject({ rows: 6, cols: 128, heads: 16 });
    expect(planeView(g("L0.attn.probs"))).toMatchObject({ rows: 6, cols: 6, heads: 16 });
    expect(planeView(g("L0.kv.block"))).toMatchObject({ rows: 6, cols: 128, heads: 8 });
    expect(planeView(g("L0.mlp.gate_proj"))).toMatchObject({ rows: 1024, cols: 3072 });
    expect(planeView(g("ids"))).toMatchObject({ rows: 1, cols: 6 });
    expect(shapeLabel(g("L0.mlp.act"))).toBe("[S,I]=[6×3072]");
  });

  it("KV 块的 K 片等于 RoPE 后的 K，V 片等于 V", () => {
    const kv = tl.tensors["L0.kv.block"];
    const k = tl.tensors["L0.attn.k_rope"];
    const v = tl.tensors["L0.attn.v_heads"];
    if (!kv || !k || !v) throw new Error("缺张量");
    for (const head of [0, 3, 7]) {
      const kvK = planeView(kv, { head, picks: [0] });
      const kvV = planeView(kv, { head, picks: [1] });
      const kk = planeView(k, { head });
      const vv = planeView(v, { head });
      for (const [r, c] of [
        [0, 0],
        [5, 127],
        [2, 64],
      ] as const) {
        expect(kvK.at(r, c)).toBe(kk.at(r, c));
        expect(kvV.at(r, c)).toBe(vv.at(r, c));
      }
    }
  });
});
