import { describe, expect, it } from "vitest";
import {
  COMPUTE_INPUT,
  COMPUTE_OUTPUT,
  COMPUTE_PRODUCTS,
  COMPUTE_WEIGHT,
  computePhase,
  computeWindow,
  FFN,
  GATE_WEIGHT,
  matmulTimeline,
  SWIGLU_DOWN_SUMS,
  swigluFocus,
  UP_WEIGHT,
} from "../src/app/wiki/scene-compute-data";
import { spatialTeaching } from "../src/app/wiki/scene-teaching";
import { sceneNodeValues } from "../src/app/wiki/wiki-data-renderer";

describe("spatial computation represents the article's complete arithmetic", () => {
  it("retains signed contributions and their exact cumulative sums in down", () => {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 6; k++) {
        expect(SWIGLU_DOWN_SUMS[j]![k + 1]! - SWIGLU_DOWN_SUMS[j]![k]!).toBeCloseTo(
          FFN.product[k]! * FFN.down[k]![j]!,
        );
      }
      expect(swigluFocus(1, 0, j).sum).toBeCloseTo(FFN.output[j]!);
    }
  });
  it("makes every contribution before accumulation, one at a time, and can rewind", () => {
    for (let n = 0; n <= 100; n++) {
      const t = matmulTimeline(n / 100);
      expect(t.added).toBeLessThanOrEqual(t.made);
      expect(t.arrivals.filter((x) => x > 0 && x < 1).length).toBeLessThanOrEqual(1);
      expect(t.reductions.filter((x) => x > 0 && x < 1).length).toBeLessThanOrEqual(1);
      if (t.reductions.some((x) => x > 0)) expect(t.made).toBe(3);
    }
    expect(
      [0.67, 0.75, 0.87].map((p) =>
        COMPUTE_PRODUCTS[0]![0]!.slice(0, matmulTimeline(p * 0.25).added).reduce((a, b) => a + b, 0),
      ),
    ).toEqual([2, 2, 8]);
    expect(matmulTimeline(1).added).toBe(3);
    expect(matmulTimeline(0).made).toBe(0);
    expect(matmulTimeline(0).added).toBe(0);
    expect([0.2, 0.29, 0.36, 0.43].map((p) => matmulTimeline(p).column)).toEqual([0, 1, 2, 3]);
  });
  it("writes the mHC results and restores earlier request states when seeking backwards", () => {
    expect(sceneNodeValues("model-compute", 0, 1).out).toEqual(["0.4", "0.8", "0.8", "1.6"]);
    expect(sceneNodeValues("model-compute", 3, 1).out).toEqual([
      "1.5",
      "1.5",
      "5",
      "5",
      "3",
      "3",
      "6",
      "6",
      "4.5",
      "4.5",
      "7",
      "7",
      "4",
      "2",
      "8",
      "4",
    ]);
    expect(sceneNodeValues("model-compute", 3, 0).out).toEqual(Array(16).fill("?"));
  });
  it("each depth line contracts to exactly one output; token rows stay independent", () => {
    expect(COMPUTE_OUTPUT).toEqual([
      [8, 6, 5, 7],
      [5, 2, 2, 3],
      [2, 7, 2, 5],
    ]);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 4; j++) {
        expect(COMPUTE_PRODUCTS[i]![j]).toEqual(COMPUTE_INPUT[i]!.map((x, k) => x * COMPUTE_WEIGHT[k]![j]!));
      }
  });
  it("both projections, the gate, paired multiplication and down connect without invented values", () => {
    const round = (n: number) => Number(n.toFixed(2));
    const project = (row: number[], weight: number[][]) =>
      weight[0]!.map((_, j) => round(row.reduce((sum, x, k) => sum + x * weight[k]![j]!, 0)));
    expect(project(FFN.input, GATE_WEIGHT)).toEqual(FFN.gate);
    expect(project(FFN.input, UP_WEIGHT)).toEqual(FFN.up);
    expect(FFN.gate.map((g) => round(g * Number((1 / (1 + Math.exp(-g))).toFixed(3))))).toEqual(FFN.silu);
    expect(FFN.silu.map((s, j) => round(s * FFN.up[j]!))).toEqual(FFN.product);
    expect(project(FFN.product, FFN.down)).toEqual(FFN.output);
    expect(FFN.product[0]).toBeGreaterThan(FFN.up[0]!);
    expect(Math.abs(FFN.product[1]!)).toBeLessThan(Math.abs(FFN.up[1]!) * 0.1);
    expect(Math.sign(FFN.product[1]!)).not.toBe(Math.sign(FFN.up[1]!));
  });
  it("scrubbing is bounded and headings follow the same stages as geometry", () => {
    for (const step of [1, 2])
      for (const p of [0, 0.15, 0.29, 0.48, 0.5, 0.74, 0.87, 1]) {
        const phase = computePhase(step, p);
        expect(phase).toBeGreaterThanOrEqual(0);
        expect(phase).toBeLessThan(4);
        expect(spatialTeaching(step, p).title).toBeTruthy();
      }
    expect(computeWindow(0, 0.2, 0.8)).toBe(0);
    expect(computeWindow(1, 0.2, 0.8)).toBe(1);
    expect(computeWindow(0.5, 0.2, 0.8)).toBeCloseTo(0.5);
  });
});
