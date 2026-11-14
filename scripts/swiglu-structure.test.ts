import { describe, expect, it } from "vitest";
import {
  SWIGLU_STRUCTURE,
  type SwiNode,
  swigluCellPoint,
  swigluStructureState,
  swigluTensorPort,
  swigluTransfer,
} from "../src/app/wiki/scene-swiglu-structure";

describe("SwiGLU extraction stays attached to the full structure", () => {
  it("attaches structure connections to the actual outer matrix edges after layout changes", () => {
    for (const node of Object.keys(SWIGLU_STRUCTURE) as SwiNode[]) {
      const values = SWIGLU_STRUCTURE[node].values;
      const first = swigluCellPoint({ node, row: 0, col: 0 });
      const last = swigluCellPoint({ node, row: values.length - 1, col: values[0]!.length - 1 });
      expect(swigluTensorPort(node, "left")[0]).toBeCloseTo(first[0] - 0.27);
      expect(swigluTensorPort(node, "right")[0]).toBeCloseTo(last[0] + 0.27);
      expect(swigluTensorPort(node, "top")[1]).toBeCloseTo(first[1] + 0.27);
      expect(swigluTensorPort(node, "bottom")[1]).toBeCloseTo(last[1] - 0.27);
    }
  });
  it("extracts the input row and selected weight column, returning to precisely one cell", () => {
    for (const [p, input, weight, target, count] of [
      [0, "n", "W_gate", "g", 4],
      [0.2, "n", "W_up", "u", 4],
      [0.75, "h", "W_down", "delta", 6],
    ] as const) {
      const t = swigluTransfer(p, 3, 1);
      const col = weight === "W_down" ? 1 : 3;
      expect(t.inputs).toEqual(Array.from({ length: count }, (_, k) => ({ node: input, row: 0, col: k })));
      expect(t.weights).toEqual(Array.from({ length: count }, (_, k) => ({ node: weight, row: k, col })));
      expect(t.outputs).toEqual([{ node: target, row: 0, col }]);
      expect(t.extract).toBe(0);
      expect(t.returning).toBe(0);
    }
  });
  it("gates matching channels without changing their structure coordinates", () => {
    const t = swigluTransfer(0.65, 1, 0);
    for (let col = 0; col < 6; col++) {
      expect(t.inputs[col]).toEqual({ node: "u", row: 0, col });
      expect(t.weights[col]).toEqual({ node: "s", row: 0, col });
      expect(t.outputs[col]).toEqual({ node: "h", row: 0, col });
    }
  });
  it("does not write the structural result before the return reaches its destination", () => {
    expect(swigluStructureState(0.18, "g")).toBe(false);
    expect(swigluTransfer(0.19, 0, 0).returning).toBeGreaterThan(0);
    expect(swigluStructureState(0.19, "g")).toBe(false);
    expect(swigluStructureState(0.1999, "g")).toBe(true);
    expect(swigluStructureState(0.4, "u")).toBe(true);
    expect(swigluStructureState(0.75, "h")).toBe(true);
    expect(swigluStructureState(0.98, "delta")).toBe(false);
    expect(swigluStructureState(1, "delta")).toBe(true);
    // Seeking backwards clears results rather than retaining a previous playback's values.
    expect(swigluStructureState(0, "delta")).toBe(false);
    expect(swigluStructureState(0, "g")).toBe(false);
    expect(swigluStructureState(0, "W_gate")).toBe(true);
  });
});
