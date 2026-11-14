import { describe, expect, it } from "vitest";
import { formatComputeProduct, swigluGateState } from "../src/app/wiki/scene-compute-data";

describe("SwiGLU gates whole aligned channel vectors", () => {
  it("does not present an interpolated shape as the product of a fixed coefficient", () => {
    const changing = swigluGateState(0.65);
    expect(changing.complete).toBe(false);
    expect(changing.channels[1]!.displayValue).toBeNull();
    expect(changing.channels[1]!.result).toBe(-0.07);
    const complete = swigluGateState(0.69);
    expect(complete.channels.map((c) => c.displayValue)).toEqual([3.73, -0.07, -0.06, 0.01, -0.99, -0.29]);
  });
  it("preserves each channel and distinguishes amplification, sign change and suppression", () => {
    const { channels } = swigluGateState(0.69);
    expect(channels.map((c) => c.effect)).toEqual([
      "放大",
      "压小并变号",
      "压小",
      "压小并变号",
      "放大",
      "压小",
    ]);
    for (const c of channels) expect(c.result).toBeCloseTo(c.before * c.factor, 2);
    expect(channels[1]!.before).toBe(2.48);
    expect(channels[1]!.factor).toBe(-0.03);
  });
  it("computes SiLU coefficients from their own gate inputs and retains their signs", () => {
    const { channels } = swigluGateState(0.51);
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: rounded sigmoid(0.88), not sqrt(1/2).
    expect(channels.map((c) => c.factor)).toEqual([0.923, 0.007, 0.507, 0.47, 0.891, 0.707]);
    expect(formatComputeProduct(channels[1]!.before, channels[1]!.factor, 3)).toBe("(−4.99) × 0.007");
    expect(channels.map((c) => c.displayValue)).toEqual([2.29, -0.03, 0.02, -0.06, 1.87, 0.62]);
    for (const c of channels) expect(Math.sign(c.result)).toBe(Math.sign(c.before));
  });
});
