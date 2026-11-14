import { describe, expect, it } from "vitest";
import { RESIDUAL_EXAMPLE as e, residualFrame, residualMotion } from "../src/app/wiki/scene-residual-data";

describe("four residual streams", () => {
  it("mixes different streams along the stream axis, without mixing channels", () => {
    expect(e.input).toEqual([
      [1, 2, 3, 4],
      [1, 2, 5, 8],
      [3, 6, 3, 8],
      [3, 6, 5, 12],
    ]);
    expect(e.merged).toEqual([2, 4, 4, 8]);
    expect(e.normalized).toEqual([0.4, 0.8, 0.8, 1.6]);
  });
  it("uses a nontrivial doubly stochastic comb and adds post-scaled sublayer output", () => {
    for (let i = 0; i < 4; i++) {
      expect(e.comb[i]!.reduce((a, b) => a + b, 0)).toBe(1);
      expect(e.comb.reduce((sum, row) => sum + row[i]!, 0)).toBe(1);
    }
    expect(e.mixed).toEqual([
      [1, 2, 4, 6],
      [2, 4, 4, 8],
      [3, 6, 4, 10],
      [2, 4, 4, 8],
    ]);
    expect(e.output).toEqual([
      [1.5, 1.5, 5, 5],
      [3, 3, 6, 6],
      [4.5, 4.5, 7, 7],
      [4, 2, 8, 4],
    ]);
  });
  it("writes each whole vector only after both branches have arrived", () => {
    for (let row = 0; row < 4; row++) {
      const before = residualMotion(3, (row + 0.65) / 4);
      const after = residualMotion(3, (row + 0.99) / 4);
      expect(before.written).toBe(row);
      expect(after.written).toBe(row + 1);
      expect(before.row).toBe(row);
      expect(after.row).toBe(row);
    }
    expect(residualMotion(3, 1).written).toBe(4);
  });
  it("keeps output and explanation on the same clock, including seeking backwards", () => {
    expect(residualFrame(3, 1).values.out).toEqual([
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
    expect(residualFrame(3, 0).values.out).toEqual(Array(16).fill("?"));
    expect(residualFrame(0, 1).values.out).toEqual(["0.4", "0.8", "0.8", "1.6"]);
    expect(residualFrame(3, 0.6).title).toContain("r₂");
  });
});
