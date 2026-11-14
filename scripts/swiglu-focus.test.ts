import { describe, expect, it } from "vitest";
import { FFN, GATE_WEIGHT, swigluFocus, swigluTimeline, UP_WEIGHT } from "../src/app/wiki/scene-compute-data";
import { swigluStructureState } from "../src/app/wiki/scene-swiglu-structure";

describe("SwiGLU focus retains the matrix coordinates", () => {
  it("does not announce a product before it is formed, and distinguishes a pending sum from a completed result", () => {
    const multiplying = swigluFocus(0.045, 1, 0);
    expect(multiplying.calculation).toBe("multiply");
    expect(multiplying.equation).toBe("0.85 × (−1) = …");
    expect(swigluFocus(0.105, 1, 0).calculation).toBe("products");
    const summing = swigluFocus(0.96, 0, 0);
    expect(summing.calculation).toBe("sum");
    expect(summing.equation).toBe("3.73 − 0.29 → 3.44");
    expect(summing.sum).toBeCloseTo(3.73);
    const complete = swigluFocus(0.973, 0, 0);
    expect(complete.calculation).toBe("complete");
    expect(complete.equation).toBe("3.73 − 0.07 + 0.06 + 0.01 + 0 − 0.29 = 3.44");
  });
  it("keeps the same active pair in the diagram and equation through the multiplication/sum handoff", () => {
    expect(swigluFocus(0.1, 0, 0).active).toBe(3);
    expect(swigluFocus(0.108, 0, 0).active).toBe(3);
    expect(swigluFocus(0.12, 0, 0).active).toBe(0);
    expect(swigluFocus(0.88, 0, 0).active).toBe(5);
    expect(swigluFocus(0.9, 0, 0).active).toBe(0);
    expect(swigluFocus(1, 0, 0).active).toBe(5);
  });
  it("keeps the partial sum in the enlarged view until the completed result returns", () => {
    const f = swigluFocus(0.15, 0, 0);
    expect(f.sum).toBeCloseTo(1.98);
    expect(swigluStructureState(0.15, "g")).toBe(false);
    const done = swigluFocus(0.199, 0, 0);
    expect(swigluStructureState(0.199, "g")).toBe(true);
    expect(done.sum).toBeCloseTo(FFN.gate[0]!);
    expect(done.output).toEqual(FFN.gate);
  });
  it("takes the whole input row and exactly the selected weight column", () => {
    for (const [p, weights] of [
      [0.1, GATE_WEIGHT],
      [0.3, UP_WEIGHT],
    ] as const) {
      for (let j = 0; j < 6; j++) {
        const f = swigluFocus(p, j, 0);
        expect(f.input).toEqual(FFN.input);
        expect(f.weights).toEqual(weights);
        expect(f.column).toBe(j);
        expect(f.products).toEqual(FFN.input.map((n, k) => n * weights[k]![j]!));
        expect(f.products.reduce((a, b) => a + b, 0)).toBeCloseTo(f.output[j]!);
      }
    }
  });
  it("finishes gate then up, before using either as a gate input", () => {
    expect(swigluTimeline(0).operation).toBe("gate");
    expect(swigluTimeline(0.2).operation).toBe("up");
    expect(swigluTimeline(0.4).operation).toBe("silu");
    expect(swigluTimeline(0.55).operation).toBe("multiply");
    expect(swigluTimeline(0.75).operation).toBe("down");
    for (let n = 0; n <= 1000; n++) {
      const t = swigluTimeline(n / 1000);
      if (t.reductions.some((x) => x > 0)) expect(t.arrivals.every((x) => x === 1)).toBe(true);
    }
  });
  it("down switches the selected column, including zero and negative contributions", () => {
    for (let j = 0; j < 4; j++) {
      const f = swigluFocus(1, 3, j);
      expect(f.input).toEqual(FFN.product);
      expect(f.column).toBe(j);
      expect(f.products).toEqual(FFN.product.map((n, k) => n * FFN.down[k]![j]!));
      expect(f.sum).toBeCloseTo(FFN.output[j]!);
    }
    expect(swigluFocus(0, 0, 0).sum).toBe(0);
  });
});
