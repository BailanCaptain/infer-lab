import { expect, it } from "vitest";
import { FFN, GATE_WEIGHT, UP_WEIGHT } from "../src/app/wiki/scene-compute-data";
import {
  DCP_QUERY,
  dcpChannels,
  dcpKeyVector,
  dcpValueVector,
  SP_NORMALIZED,
  SP_PARTIALS,
  SP_PROJECTED,
} from "../src/app/wiki/scene-parallel-mechanisms";
import { RESIDUAL_EXAMPLE } from "../src/app/wiki/scene-residual-data";

it("keeps four residual channels through reduction, RMSNorm and both writeback branches", () => {
  const e = RESIDUAL_EXAMPLE;
  expect(e.input.map((row) => row.length)).toEqual([4, 4, 4, 4]);
  expect(e.merged).toEqual([2, 4, 4, 8]);
  expect(e.rms).toBe(5);
  expect(e.normalized).toEqual([0.4, 0.8, 0.8, 1.6]);
  expect(e.output).toEqual([
    [1.5, 1.5, 5, 5],
    [3, 3, 6, 6],
    [4.5, 4.5, 7, 7],
    [4, 2, 8, 4],
  ]);
});

it("uses complete 4 → 6 → 4 tensors in the SwiGLU spatial example", () => {
  expect(FFN.input).toHaveLength(4);
  for (const w of [GATE_WEIGHT, UP_WEIGHT]) expect(w.map((row) => row.length)).toEqual([6, 6, 6, 6]);
  expect(FFN.gate).toHaveLength(6);
  expect(FFN.product).toHaveLength(6);
  expect(FFN.down.map((row) => row.length)).toEqual([4, 4, 4, 4, 4, 4]);
  expect(FFN.output).toHaveLength(4);
});

it("DCP keeps all four query, key, value and output channels", () => {
  expect(DCP_QUERY).toHaveLength(4);
  for (let p = 0; p < 8; p++) {
    expect(dcpKeyVector(p)).toHaveLength(4);
    expect(dcpValueVector(p)).toHaveLength(4);
  }
  expect(dcpChannels(25)).toEqual([25, 15, 12.5, 7.5]);
});

it("SP transports complete four-channel rows into local normalization and the next projection", () => {
  expect(SP_PARTIALS.flat().every((row) => row.length === 4)).toBe(true);
  expect(SP_NORMALIZED[0]).toEqual([0.2, 1.4, 1.4, 0.2]);
  expect(SP_PROJECTED[0]![0]).toBeCloseTo(1.8);
  expect(SP_PROJECTED[0]![1]).toBeCloseTo(3.2);
});
