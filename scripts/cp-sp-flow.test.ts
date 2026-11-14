import { describe, expect, it } from "vitest";
import {
  cpReadFrame,
  mechanismChapters,
  mechanismSeconds,
  mechanismTeaching,
  PCP_QUERIES,
  ringMotion,
  spNormalization,
  spProjection,
} from "../src/app/wiki/scene-parallel-mechanisms";
import { mergeRing, RING_K, RING_V, ringPartial } from "../src/app/wiki/scene-ring-data";

describe("CP / SP data handed to the next computation", () => {
  it("SP finishes all four projected rows before expanding the two-column output", () => {
    expect(spProjection(0.963).written).toEqual([1, 1, 1, 1]);
    expect(spProjection(1).results).toHaveLength(4);
    expect(spProjection(1).results.every((row) => row.length === 2)).toBe(true);
  });
  it("keeps Q7 and Q5 in focus across both Ring rounds and retains the old contribution", () => {
    for (const p of [0.14, 0.26, 0.37, 0.5, 0.56, 0.7, 0.89]) {
      expect(cpReadFrame(4, p, 0).query).toBe(7);
      expect(cpReadFrame(4, p, 1).query).toBe(5);
    }
    const incoming = cpReadFrame(4, mechanismChapters(4)[3]!.start / mechanismSeconds(4), 0);
    expect(incoming.prior).toEqual({ u: 20, z: 2 });
    expect(incoming.added).toEqual({ u: 0, z: 0 });
    expect(incoming.total).toEqual({ u: 20, z: 2 });
    const end = cpReadFrame(4, 1, 0);
    expect(end.added).toEqual({ u: 180, z: 6 });
    expect(end.output).toBeCloseTo(25);
    expect(cpReadFrame(4, 1, 1).output).toBeCloseTo(186 / 7);
    expect(cpReadFrame(4, 1, 1).masked).toEqual([6, 7]);
  });
  it("only commits a read after score and weighted value are shown, including rewind", () => {
    const chapters = mechanismChapters(4);
    const start = chapters[1]!.start / mechanismSeconds(4),
      duration = (chapters[2]!.start - chapters[1]!.start) / mechanismSeconds(4);
    const reading = cpReadFrame(4, start + duration * 0.1, 0);
    expect(reading.position).toBe(0);
    expect(reading.added).toEqual({ u: 0, z: 0 });
    const firstDone = cpReadFrame(4, start + duration * 0.28, 0);
    expect(firstDone.added).toEqual({ u: 2, z: 0.5 });
    cpReadFrame(4, 1, 0);
    expect(cpReadFrame(4, start + duration * 0.1, 0)).toEqual(reading);
  });
  it("PCP reads collected history while DCP reads only its local history", () => {
    expect(cpReadFrame(2, 1, 0).positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(cpReadFrame(2, 1, 0).output).toBe(8);
    expect(cpReadFrame(2, 1, 1).output).toBe(6);
    expect(cpReadFrame(3, 1, 0).positions).toEqual([0, 2, 4, 6]);
    expect(cpReadFrame(3, 1, 0).output).toBe(10);
    expect(cpReadFrame(3, 1, 1).output).toBe(30);
  });
  it("SP projects the gathered normalized row with each card's own weight column", () => {
    const f = spProjection(1);
    [
      [1.8, 3.2],
      [3, 3.2],
      [3, 4],
      [2.6, 3.84],
    ].forEach((row, r) => {
      row.forEach((n, c) => {
        expect(f.results[r]![c]).toBeCloseTo(n, 12);
      });
    });
    expect(spProjection(0.81).enabled).toBe(false);
    expect(spProjection(0.82).landed).toBe(0);
    expect(spProjection(0.82).written.every((v) => v === 0)).toBe(true);
  });
  it("SP normalizes only after landing and writes both owned rows before AllGather", () => {
    const chapters = mechanismChapters(1);
    const start = chapters[2]!.start / mechanismSeconds(1);
    const end = chapters[3]!.start / mechanismSeconds(1);
    const at = (local: number) => spNormalization(start + (end - start) * local);
    const first = at(0.2);
    expect(first.rows).toEqual([0, 2]);
    expect(first.divided).toBe(0);
    expect(first.written).toEqual([0, 0, 0, 0]);
    for (let i = 0; i <= 1000; i++) {
      const f = at(i / 1000);
      if (f.divided > 0) expect(f.landed).toBe(1);
      if (f.written[f.rows[0]!]! > 0) expect(f.divided).toBe(1);
    }
    expect(at(0.56).written).toEqual([1, 0, 1, 0]);
    expect(at(0.96).written).toEqual([1, 1, 1, 1]);
    expect(spNormalization(end).written).toEqual([1, 1, 1, 1]);
    expect(at(0.2)).toEqual(first);
  });
  it("Ring includes the causal diagonal, skips future positions and matches dense attention", () => {
    for (let q = 0; q < 8; q++) {
      const a = ringPartial(q, PCP_QUERIES[0]!);
      const b = ringPartial(q, PCP_QUERIES[1]!);
      const full = mergeRing(a, b);
      const scores = RING_K.slice(0, q + 1).map(Math.exp);
      const expected = scores.reduce((n, s, p) => n + s * RING_V[p]!, 0) / scores.reduce((n, s) => n + s, 0);
      expect(full.output).toBeCloseTo(expected, 12);
      expect(mergeRing(b, a).output).toBeCloseTo(expected, 12);
    }
    expect(ringPartial(0, PCP_QUERIES[1]!).z).toBe(0);
    expect(ringPartial(7, PCP_QUERIES[0]!)).toMatchObject({ z: 2, numerator: 20, output: 10 });
    expect(ringPartial(7, PCP_QUERIES[1]!)).toMatchObject({ z: 6, numerator: 180, output: 30 });
    expect(mergeRing(ringPartial(7, PCP_QUERIES[0]!), ringPartial(7, PCP_QUERIES[1]!)).output).toBeCloseTo(
      25,
    );
  });
  it("Ring retains local accumulators during transit; remote computation waits for landing", () => {
    const start = mechanismChapters(4)[2]!.start / mechanismSeconds(4);
    const end = mechanismChapters(4)[3]!.start / mechanismSeconds(4);
    for (const p of [start, (start + end) / 2, end - 1e-7, 1, 0, start]) {
      const f = ringMotion(p);
      if (p >= start && p < end) {
        expect(f.localWritten.every((v) => v === 1)).toBe(true);
        expect(f.remoteWritten.every((v) => v === 0)).toBe(true);
      }
    }
    expect(ringMotion(end).transfer).toBe(1);
    expect(ringMotion(end).remoteWritten.every((v) => v === 0)).toBe(true);
    expect(ringMotion(1).remoteWritten.every((v) => v === 1)).toBe(true);
  });
  it("Ring exchange explanation keeps the last local query shown in the scene", () => {
    const chapters = mechanismChapters(4);
    const exchange = (chapters[2]!.start + chapters[3]!.start) / 2 / mechanismSeconds(4);
    const explanation = mechanismTeaching(4, exchange).equation;
    expect(explanation).toContain("Q7：内容20 ÷ 份额2 = 上下文10");
    expect(explanation).toContain("Q5：内容180 ÷ 份额6 = 上下文30");
  });
});
