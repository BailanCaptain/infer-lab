import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  DCP_EXAMPLE,
  DCP_QUERY,
  dcpKeyVector,
  dcpValueVector,
  mechanismFrame,
  mechanismSeconds,
  PP_SETUP,
  ppActivations,
  ppWriteProgress,
} from "../src/app/wiki/scene-parallel-mechanisms";
import {
  RING_K,
  RING_Q_VECTOR,
  RING_V,
  ringKeyVector,
  ringValueVector,
  ringVectorOutput,
} from "../src/app/wiki/scene-ring-data";

it("DCP retains four channels and agrees with the chapter's local and merged results", () => {
  expect(DCP_QUERY).toHaveLength(4);
  const local = [0, 1].map((card) => {
    const positions = Array.from({ length: 4 }, (_, r) => 2 * r + card);
    const weights = positions.map((p) =>
      Math.exp(DCP_QUERY.reduce((s, q, d) => s + q * dcpKeyVector(p)[d]!, 0) / Math.sqrt(4)),
    );
    const z = weights.reduce((s, w) => s + w, 0);
    expect(z).toBeCloseTo(DCP_EXAMPLE.normalizers[card]!, 10);
    const output = [0, 1, 2, 3].map(
      (d) => weights.reduce((s, w, i) => s + w * dcpValueVector(positions[i]!)[d]!, 0) / z,
    );
    expect(output[0]).toBeCloseTo(DCP_EXAMPLE.local[card]!, 10);
    expect(output[1]).toBeCloseTo(40 - DCP_EXAMPLE.local[card]!, 10);
    expect(output[2]).toBeCloseTo(DCP_EXAMPLE.local[card]! / 2, 10);
    expect(output[3]).toBeCloseTo(20 - DCP_EXAMPLE.local[card]! / 2, 10);
    return output;
  });
  expect(local[0]![0]! / 4 + (local[1]![0]! * 3) / 4).toBeCloseTo(25);
  expect(local[0]![1]! / 4 + (local[1]![1]! * 3) / 4).toBeCloseTo(15);
  expect(local[0]![2]! / 4 + (local[1]![2]! * 3) / 4).toBeCloseTo(12.5);
  expect(local[0]![3]! / 4 + (local[1]![3]! * 3) / 4).toBeCloseTo(7.5);
});

it("PP's static diagram shows all matrix values and matches each 3D stage", () => {
  const spec = parse(readFileSync("wiki/diagrams/pipeline-parallel-flow.yaml", "utf8"));
  expect(spec.grids).toHaveLength(8);
  spec.grids.forEach(
    (grid: { rows: number; cols: number; cells: { at: number[]; text: string }[] }, index: number) => {
      expect([grid.rows, grid.cols]).toEqual([4, 8]);
      expect(grid.cells).toHaveLength(32);
      const matrix = ppActivations((Math.floor(index / 2) + (index % 2)) * 2);
      grid.cells.forEach((cell) => {
        expect(Number(cell.text)).toBe(matrix[cell.at[0]!]![cell.at[1]!]!);
      });
    },
  );
});

describe("Ring retains full vectors without changing the chapter's scalar result", () => {
  it("uses four-channel QK / sqrt(d) and retains every channel through masked attention", () => {
    expect(RING_Q_VECTOR).toHaveLength(4);
    for (let p = 0; p < 8; p++) {
      const key = ringKeyVector(p);
      expect(key).toHaveLength(4);
      const score = RING_Q_VECTOR.reduce((s, q, d) => s + q * key[d]!, 0) / Math.sqrt(4);
      expect(score).toBeCloseTo(RING_K[p]!, 12);
      expect(ringValueVector(p)).toHaveLength(4);
      expect(ringValueVector(p)[0]).toBe(RING_V[p]);
    }
    for (let q = 0; q < 8; q++) {
      const output = ringVectorOutput(q);
      for (let d = 0; d < 4; d++) {
        const weights = RING_K.slice(0, q + 1).map(Math.exp);
        const expected =
          weights.reduce((sum, w, p) => sum + w * ringValueVector(p)[d]!, 0) /
          weights.reduce((a, b) => a + b, 0);
        expect(output[d]).toBeCloseTo(expected, 12);
      }
    }
    expect(ringVectorOutput(7)).toEqual([25, 12.5, 29, 15]);
  });
});

describe("PP carries the whole activation matrix", () => {
  it("preserves token rows and hidden channels through all four stages", () => {
    const input = ppActivations(0);
    expect(input).toHaveLength(4);
    expect(input.every((row) => row.length === 8)).toBe(true);
    expect(input[3]!.slice(0, 2)).toEqual([1, 0]);
    for (let stage = 0; stage < 4; stage++) {
      const a = ppActivations(stage * 2),
        b = ppActivations(stage * 2 + 2);
      b.forEach((row, r) => {
        row.forEach((value, c) => {
          expect(value).toBe(a[r]![c]! + 2);
        });
      });
      const boundary = PP_SETUP + ((1 - PP_SETUP) * (stage + 1)) / 4;
      expect(ppActivations(mechanismFrame(0, boundary - 1e-7).stage * 2 + 2)).toEqual(b);
      if (stage < 3) expect(ppActivations(mechanismFrame(0, boundary + 1e-7).stage * 2)).toEqual(b);
    }
    expect(ppActivations(8)[3]!.slice(0, 2)).toEqual([9, 8]);
  });
  it("reveals calculated cells throughout the layer interval instead of holding a blank result", () => {
    const levels = (p: number) =>
      Array.from({ length: 32 }, (_, i) => ppWriteProgress(p, Math.floor(i / 8), i % 8));
    expect(levels(0).every((x) => x === 0)).toBe(true);
    expect(levels(1).every((x) => x === 1)).toBe(true);
    for (let i = 1; i < 20; i++) {
      const previous = levels((i - 1) / 20),
        next = levels(i / 20);
      expect(next.some((x, j) => x > previous[j]!)).toBe(true);
      expect(next.every((x, j) => x >= previous[j]!)).toBe(true);
    }
    levels(1);
    expect(levels(0).every((x) => x === 0)).toBe(true);
  });
  it("unfolds the input while the opening runs, without a four-second frozen frame", () => {
    for (const kind of [0, 2, 4]) {
      const f = mechanismFrame(kind, 0.8 / mechanismSeconds(kind));
      expect(f.reveal).toBeGreaterThan(0);
      expect(f.reveal).toBeLessThan(1);
    }
  });
});
