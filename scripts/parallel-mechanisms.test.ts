import { describe, expect, it } from "vitest";
import {
  DCP_CONTRIBUTIONS,
  DCP_OUTPUT,
  DCP_WEIGHTS,
  dcpMergeFrame,
  mechanismChapters,
  mechanismCue,
  mechanismFrame,
  mechanismSeconds,
  PARTITIONS,
  PCP_EXAMPLE,
  PCP_QUERIES,
  PP_SETUP,
  pcpMotion,
  SP_NORMALIZED,
  SP_PARTIALS,
  SP_RMS,
  SP_SUM,
} from "../src/app/wiki/scene-parallel-mechanisms";

describe("parallel teaching examples match the chapter arithmetic", () => {
  it("DCP explains receiving, weighting and the completed answer at their actual boundaries", () => {
    const at = (local: number) => dcpMergeFrame(0.72 + 0.28 * local);
    expect(at(0.2).landed).toBeLessThan(1);
    expect(at(0.4)).toMatchObject({ landed: 1, weighted: false, complete: false });
    expect(at(0.7)).toMatchObject({ landed: 1, weighted: true, complete: false });
    expect(at(0.9)).toMatchObject({ weighted: true, complete: true });
    expect(dcpMergeFrame(0.6)).toMatchObject({ enabled: false, weighted: false, complete: false });
  });
  it("chapter review seeks to the same ownership phase as the animation, including PP setup", () => {
    for (let kind = 0; kind < 5; kind++) {
      const chapters = mechanismChapters(kind);
      for (const [i, chapter] of chapters.entries()) {
        const p = (chapter.start + 0.001) / mechanismSeconds(kind);
        expect(mechanismCue(kind, p).chapter).toBe(i);
        const frame = mechanismFrame(kind, p);
        expect(kind === 0 ? (frame.setup ? 0 : frame.stage + 1) : frame.phase).toBe(i);
      }
      expect(mechanismCue(kind, 1).chapter).toBe(chapters.length - 1);
      expect(mechanismCue(kind, 0).chapter).toBe(0);
    }
  });
  it("PP narration does not claim computation while the previous output is still arriving", () => {
    const stageStart = PP_SETUP + (1 - PP_SETUP) / 4;
    expect(mechanismCue(0, stageStart + 0.01).title).toContain("接收");
    expect(mechanismCue(0, stageStart + 0.01).detail).toContain("[3, 2]");
    const stageDuration = (1 - PP_SETUP) / 4;
    expect(mechanismCue(0, stageStart + stageDuration * 0.4).title).toContain("第2层");
    expect(mechanismCue(0, stageStart + stageDuration * 0.7).title).toContain("第3层");
  });
  it("PP transfers the previous stage output unchanged before any new calculation", () => {
    for (let stage = 1; stage < 4; stage++) {
      const start = PP_SETUP + ((1 - PP_SETUP) * stage) / 4;
      const previous = mechanismFrame(0, start - 0.000001);
      const next = mechanismFrame(0, start + 0.000001);
      expect(previous.output).toEqual(next.input);
      expect(next.first).toBe(0);
      expect(next.second).toBe(0);
      expect(mechanismFrame(0, PP_SETUP + ((1 - PP_SETUP) * (stage + 0.26)) / 4).receive).toBe(1);
    }
    expect(mechanismFrame(0, 1).output).toEqual([9, 8]);
  });
  it("partitions whole layers or complete rows, never drops or duplicates an owned item", () => {
    expect(PARTITIONS.map((p) => p.groups)).toEqual([
      [
        [0, 1],
        [2, 3],
        [4, 5],
        [6, 7],
      ],
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 1, 6, 7],
        [2, 3, 4, 5],
      ],
      [
        [0, 2, 4, 6],
        [1, 3, 5, 7],
      ],
    ]);
    for (const partition of PARTITIONS) {
      expect(partition.groups.flat().sort((a, b) => a - b)).toEqual(
        Array.from({ length: partition.count }, (_, i) => i),
      );
    }
    expect(PARTITIONS[1]!.columns).toBe(4);
    expect(PARTITIONS[2]!.columns).toBe(4);
    expect(PARTITIONS[3]!.columns).toBe(4);
  });
  it("PP cannot compute until layer placement has finished, including after backward seek", () => {
    for (const p of [0.1, 1, 0, 0.05, PP_SETUP / 2]) {
      const f = mechanismFrame(0, p);
      if (p < PP_SETUP) {
        expect(f.setup).toBe(true);
        expect(f.first).toBe(0);
        expect(f.second).toBe(0);
      }
    }
  });
  it("SP sums each channel before local RMSNorm; AllGather must not sum normalized rows", () => {
    expect(SP_SUM).toEqual([
      [1, 7, 7, 1],
      [7, 1, 1, 7],
      [5, 5, 5, 5],
      [17, 31, 31, 17],
    ]);
    expect(SP_RMS).toEqual([5, 5, 5, 25]);
    expect(SP_NORMALIZED).toEqual([
      [0.2, 1.4, 1.4, 0.2],
      [1.4, 0.2, 0.2, 1.4],
      [1, 1, 1, 1],
      [0.68, 1.24, 1.24, 0.68],
    ]);
    expect(SP_PARTIALS[0]![0]!.map((x) => x / Math.sqrt(5))).not.toEqual(SP_NORMALIZED[0]);
  });
  it("PCP assigns every query once, retains causal diagonals and balances valid pairs", () => {
    expect(PCP_QUERIES.flat().sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(PCP_QUERIES.map((rows) => rows.reduce((n, q) => n + q + 1, 0))).toEqual([18, 18]);
  });
  it("PCP waits for local placement and KV exchange, then retains each output on its owner", () => {
    const chapters = mechanismChapters(2);
    const placement = chapters[1]!.start / mechanismSeconds(2);
    const computation = chapters[2]!.start / mechanismSeconds(2);
    const writeback = chapters[3]!.start / mechanismSeconds(2);
    expect(pcpMotion(placement).gather).toBe(0);
    expect(pcpMotion(computation).gather).toBe(1);
    for (let q = 0; q < 8; q++) {
      expect(pcpMotion(computation).written[q]).toBe(0);
      expect(pcpMotion(writeback - 1e-8).written[q]).toBeCloseTo(1);
      expect(pcpMotion(writeback).written[q]).toBe(1);
      expect(pcpMotion(1).written[q]).toBe(1);
      expect(pcpMotion(0).written[q]).toBe(0);
    }
  });
  it("PCP rank-local causal attention matches the unsplit calculation", () => {
    const { queries, keys, values, outputs } = PCP_EXAMPLE;
    for (const positions of PCP_QUERIES) {
      for (const q of positions) {
        const scores = keys.slice(0, q + 1).map((k) => k.reduce((s, x, d) => s + x * queries[q]![d]!, 0) / 2);
        const z = scores.reduce((s, x) => s + Math.exp(x), 0);
        const result = Array.from({ length: 4 }, (_, d) =>
          scores.reduce((s, x, p) => s + (Math.exp(x) / z) * values[p]![d]!, 0),
        );
        result.forEach((n, d) => {
          expect(n).toBeCloseTo(outputs[q]![d]!);
        });
        expect(outputs[q]).toEqual([q + 1, q + 2, q + 3, q + 4]);
      }
    }
  });
  it("DCP merges normalized local outputs using their normalizers, not sum or average", () => {
    expect(DCP_WEIGHTS).toEqual([0.25, 0.75]);
    expect(DCP_CONTRIBUTIONS).toEqual([2.5, 22.5]);
    expect(DCP_OUTPUT).toBe(25);
    const lse = Math.log(Math.exp(Math.log(2)) + Math.exp(Math.log(6)));
    expect(10 * Math.exp(Math.log(2) - lse) + 30 * Math.exp(Math.log(6) - lse)).toBeCloseTo(DCP_OUTPUT);
  });
});
