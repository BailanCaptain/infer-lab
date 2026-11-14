import { describe, expect, it } from "vitest";
import { swigluTransfer } from "../src/app/wiki/scene-swiglu-structure";

describe("SwiGLU operand unfolding and return", () => {
  it("returns inputs and weights fully to their original slots after each calculation", () => {
    for (const [start, end] of [
      [0, 0.2],
      [0.2, 0.4],
      [0.4, 0.55],
      [0.55, 0.75],
      [0.75, 1],
    ]) {
      expect(swigluTransfer(start!, 1, 1).unfold).toBe(0);
      expect(swigluTransfer((start! + end!) / 2, 1, 1).unfold).toBe(1);
      expect(swigluTransfer(end! - 0.000001, 1, 1).unfold).toBe(0);
    }
  });
  it("keeps operands open until multiplication and summation finish", () => {
    for (const p of [0.176, 0.376, 0.532, 0.726, 0.97]) {
      const t = swigluTransfer(p, 0, 0);
      expect(t.unfold).toBe(1);
      expect(t.returning).toBe(0);
    }
  });
  it("folds continuously instead of fading the operands away", () => {
    for (let p = 0; p < 1; p += 0.001) {
      const a = swigluTransfer(p, 2, 1),
        b = swigluTransfer(p + 0.00001, 2, 1);
      if (a.operation !== b.operation) continue;
      expect(Math.abs(a.unfold - b.unfold)).toBeLessThan(0.003);
    }
  });
});
