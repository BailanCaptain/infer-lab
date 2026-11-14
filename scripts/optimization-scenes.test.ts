import { describe, expect, it } from "vitest";
import {
  LAYOUT_MATRIX,
  layoutState,
  NZ_ORDER,
  nzAddress,
  OPTIMIZATION_LESSONS,
  offloadState,
  optimizationFrame,
  QUANT,
  quantState,
  SCHEDULE_C,
  scheduleState,
} from "../src/app/wiki/scene-optimization";

const at = (kind: number, phase: number, local: number) =>
  (phase + local) / OPTIMIZATION_LESSONS[kind]!.stages.length;
describe("optimization teaching state", () => {
  it("ND/NZ moves every element once and preserves its logical coordinates", () => {
    expect(NZ_ORDER).toEqual([1, 2, 5, 6, 9, 10, 13, 14, 3, 4, 7, 8, 11, 12, 15, 16]);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) expect(NZ_ORDER[nzAddress(r, c)]).toBe(LAYOUT_MATRIX[r]![c]);
    expect(nzAddress(1, 0)).toBe(2);
    for (let block = 0; block < 4; block++) {
      expect(layoutState(at(0, block + 2, 0.69)).written).toBe(block);
      expect(layoutState(at(0, block + 2, 0.71)).written).toBe(block + 1);
    }
  });
  it("W8A8 reproduces the page's full integer calculation and isolated error", () => {
    expect(QUANT.qx).toEqual([52, -31, 127]);
    expect(QUANT.qw).toEqual([20, -127, 43]);
    expect(QUANT.products).toEqual([1040, 3937, 5461]);
    expect(QUANT.sum).toBe(10438);
    expect(QUANT.restored).toBeCloseTo(2.0876, 12);
    expect(QUANT.original).toBeCloseTo(2.0888, 12);
    expect(QUANT.error).toBeCloseTo(0.0012, 12);
    expect(quantState(at(1, 3, 0.2)).products).toBe(0);
    expect(quantState(at(1, 3, 0.99)).products).toBe(3);
    expect(quantState(at(1, 5, 0.69)).restored).toBe(false);
    expect(quantState(at(1, 5, 0.71)).restored).toBe(true);
  });
  it("offload distinguishes copied bytes, completion notification, allocation and resume", () => {
    expect(offloadState(at(2, 2, 0.75)).saved).toEqual([true, true]);
    expect(offloadState(at(2, 2, 0.75)).hostReady).toBe(false);
    expect(offloadState(at(2, 3, 0.75)).reclaimed).toBe(true);
    expect(offloadState(at(2, 3, 0.75)).saved).toEqual([true, true]);
    expect(offloadState(at(2, 5, 0.75)).loaded).toEqual([true, false]);
    expect(offloadState(at(2, 5, 0.75)).ready).toBe(false);
    expect(offloadState(at(2, 6, 0.75)).loaded).toEqual([true, true]);
    expect(offloadState(at(2, 6, 0.75)).ready).toBe(false);
    expect(offloadState(at(2, 6, 0.9)).ready).toBe(true);
    expect(offloadState(at(2, 7, 0.69)).resumed).toBe(false);
    expect(offloadState(1).resumed).toBe(true);
  });
  it("scheduling spends 8/8/4/3 positions, preserves history, and produces y0 after step 3", () => {
    expect(SCHEDULE_C.map((n) => n + 2)).toEqual([8, 8, 4, 3]);
    for (let step = 0; step < 4; step++) {
      const planned = scheduleState(at(3, step + 1, 0.3)),
        done = scheduleState(at(3, step + 1, 0.75));
      expect(planned.planned).toBe(step + 1);
      expect(planned.completed).toBe(step);
      expect(done.completed).toBe(step + 1);
      expect(done.prefix).toBe([6, 12, 14, 14][step]);
      expect(done.firstToken).toBe(step >= 2);
    }
  });
  it("phase seeks, replay and final states are pure and keep decimal boundaries", () => {
    for (let kind = 0; kind < 4; kind++)
      for (let phase = 0; phase < OPTIMIZATION_LESSONS[kind]!.stages.length; phase++) {
        expect(optimizationFrame(kind, at(kind, phase, 0)).phase).toBe(phase);
        const before = optimizationFrame(kind, at(kind, phase, 0.2));
        optimizationFrame(kind, 1);
        expect(optimizationFrame(kind, at(kind, phase, 0.2))).toEqual(before);
      }
  });
});
