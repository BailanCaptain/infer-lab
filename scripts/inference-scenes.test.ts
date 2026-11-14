import { describe, expect, it } from "vitest";
import {
  ATTENTION,
  ATTENTION_GROUPS,
  ATTENTION_OUTPUT,
  ATTENTION_TOTAL,
  attentionSum,
  CORE_OUTPUT,
  CORE_PRODUCT,
  inferenceFrame,
  kvOwnership,
  kvSlot,
  pdHandoff,
} from "../src/app/wiki/scene-inference";

describe("inference teaching examples", () => {
  it("continues from writing into sharing before releasing either request", () => {
    const writingEnd = (3 - 1e-6) / 6;
    expect(inferenceFrame(1, writingEnd)).toMatchObject({ phase: 2, landed: true });
    expect(kvOwnership(writingEnd)).toMatchObject({ r1: true, r2: false, refs: [1, 1, 1] });
    expect(inferenceFrame(1, 0.5)).toMatchObject({ phase: 3, local: 0 });
    expect(kvOwnership(0.5)).toMatchObject({ r1: true, r2: false, refs: [1, 1, 1] });
    expect(kvOwnership(1).refs).toEqual([0, 0, 0]);
  });
  it("partitioned attention preserves all four channels and unequal partition mass", () => {
    expect(ATTENTION_TOTAL).toBeCloseTo(8);
    expect(ATTENTION_OUTPUT).toEqual([25, 15, 12.5, 7.5]);
    expect(ATTENTION_GROUPS.map((g) => attentionSum(g)[0])).toEqual([20, 180]);
    const merged = ATTENTION_OUTPUT.map((_, c) =>
      ATTENTION_GROUPS.reduce(
        (s, g) =>
          s + (attentionSum(g, true)[c]! * g.reduce((m, i) => m + ATTENTION.mass[i]!, 0)) / ATTENTION_TOTAL,
        0,
      ),
    );
    expect(merged).toEqual(ATTENTION_OUTPUT);
    expect((10 + 30) / 2).not.toEqual(ATTENTION_OUTPUT[0]);
  });
  it("maps token positions through the actual block table", () => {
    expect([0, 3, 4, 6, 8].map(kvSlot)).toEqual([28, 31, 8, 10, 36]);
  });
  it("starts cache actions immediately and keeps ownership until the visible handoff finishes", () => {
    expect(inferenceFrame(1, 0.05 / 6).travel).toBeGreaterThan(0);
    expect(inferenceFrame(1, 2.89 / 6).landed).toBe(false);
    expect(inferenceFrame(1, 2.91 / 6).landed).toBe(true);
    expect(kvOwnership(3.89 / 6).refs).toEqual([1, 1, 1]);
    expect(kvOwnership(3.91 / 6).refs).toEqual([2, 1, 1]);
    expect(kvOwnership(4.89 / 6).refs).toEqual([2, 1, 1]);
    expect(kvOwnership(4.91 / 6).refs).toEqual([1, 0, 0]);
  });
  it("retains the shared prefix until both requests release it, including when rewound", () => {
    expect(kvOwnership(0).refs).toEqual([1, 1, 1]);
    expect(kvOwnership(3.95 / 6).refs).toEqual([2, 1, 1]);
    expect(kvOwnership(4.95 / 6).refs).toEqual([1, 0, 0]);
    expect(kvOwnership(1).refs).toEqual([0, 0, 0]);
    expect(kvOwnership(3.95 / 6).refs).toEqual([2, 1, 1]);
  });
  it("waits for arrival before exposing data, releasing sources, or resuming decode", () => {
    expect(pdHandoff(2.64 / 6).received).toEqual([false, false]);
    expect(pdHandoff(2.66 / 6).received).toEqual([true, false]);
    expect(pdHandoff(3.66 / 6).received).toEqual([true, true]);
    expect(pdHandoff(4.64 / 6).released).toBe(false);
    expect(pdHandoff(4.66 / 6).released).toBe(true);
    expect(pdHandoff(5.64 / 6).resumed).toBe(false);
    expect(pdHandoff(1).resumed).toBe(true);
  });
  it("preserves the intermediate negative channel until Vector activation", () => {
    expect(CORE_PRODUCT).toEqual([5, -5]);
    expect(CORE_OUTPUT).toEqual([5, 0]);
    for (let kind = 0; kind < 4; kind++) {
      expect(inferenceFrame(kind, -1).phase).toBe(0);
      expect(inferenceFrame(kind, Number.NaN).phase).toBe(0);
      expect(inferenceFrame(kind, 1).landed).toBe(true);
    }
  });
});
