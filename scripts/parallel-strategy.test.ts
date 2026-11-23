import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { dpRequestFrame } from "../src/app/wiki/scene-hardware-story";
import {
  cpReadFrame,
  mechanismChapters,
  mechanismCue,
  mechanismFrame,
  mechanismSeconds,
  mechanismTeaching,
  PCP_EXAMPLE,
  pcpMotion,
} from "../src/app/wiki/scene-parallel-mechanisms";
import {
  DP_REQUESTS,
  dpMotion,
  EP_EXPERT_OUTPUTS,
  EP_EXPERTS,
  EP_OUTPUT,
  EP_ROUTED,
  EP_ROUTED_ROWS,
  EP_ROUTED_SCALE,
  EP_SCORES,
  EP_SHARED,
  EP_SOURCE,
  EP_WEIGHTS,
  epAccumulation,
  epMotion,
  TP_PARTIALS,
  TP_SUM,
  TP_W,
  TP_X,
  tpInputSlice,
  tpMotion,
  tpWeightSlice,
} from "../src/app/wiki/scene-parallel-strategy";
import { DATA_PARALLEL_SECONDS } from "../src/app/wiki/scene-playback";
import { dpReplyState } from "../src/app/wiki/scene-request-matrix";
import { epTransferPath } from "../src/app/wiki/wiki-parallel-strategy-renderer";

describe("TP / DP / EP scenes share the PP timeline and keep hand-checkable arithmetic", () => {
  it("chapter buttons seek to the phase they name", () => {
    for (const kind of [5, 6, 7]) {
      for (const [i, chapter] of mechanismChapters(kind).entries()) {
        const p = (chapter.start + 0.001) / mechanismSeconds(kind);
        expect(mechanismFrame(kind, p).phase).toBe(i);
        expect(mechanismCue(kind, p).chapter).toBe(i);
        expect(mechanismTeaching(kind, p).title.length).toBeGreaterThan(0);
      }
    }
  });

  it("TP: each card adds only its two input channels; the four partials sum to XW", () => {
    const full = TP_X.map((x) => [0, 1, 2, 3].map((o) => x.reduce((s, xi, c) => s + xi * TP_W[c]![o]!, 0)));
    expect(TP_SUM).toEqual(full);
    for (let g = 0; g < 4; g++) {
      expect(tpInputSlice(g)[0]).toHaveLength(2);
      expect(tpWeightSlice(g)).toHaveLength(2);
      expect(TP_PARTIALS[g]).toHaveLength(4);
    }
    // Weights land before any partial sum is written; Y returns only after the sum is complete.
    expect(tpMotion(0.25).land).toBeGreaterThan(0.9);
    expect(tpMotion(0.25).partial).toBe(0);
    expect(tpMotion(0.8).broadcast).toBe(0);
    expect(mechanismCue(5, 0.8).title).not.toContain("每卡都有完整 Y");
    expect(tpMotion(0.81).sum).toBe(1);
  });

  it("DP: A goes to DP0 on a tie, the local count then sends B to DP1, and replies return", () => {
    // At p=0.19 and p=0.39 comparison is still underway; sidebar must not reveal the winner yet.
    expect(mechanismTeaching(6, 0.19).equation).not.toContain("选定 DP0");
    expect(mechanismTeaching(6, 0.39).equation).not.toContain("选定 DP1");
    // At p=0.28 comparison has finished, but frontend has not pre-booked DP0 (+4) nor dispatched A yet.
    const aComparing = dpMotion(0.28);
    expect(aComparing.phase).toBe(1);
    expect(aComparing.scores).toEqual([0, 0]);
    expect(aComparing.route[0]).toBe(0);
    expect(mechanismCue(6, 0.28).detail).toContain("仍为 0");
    const aDecided = dpMotion(0.3);
    expect(aDecided.phase).toBe(1);
    expect(aDecided.scores).toEqual([4, 0]);
    const bArrives = dpMotion(0.4);
    expect(bArrives.phase).toBe(2);
    expect(bArrives.scores).toEqual([4, 0]);
    expect(dpMotion(0.55).scores).toEqual([4, 4]);
    const end = dpMotion(1);
    expect(end.deliver).toBe(1);
    expect(DP_REQUESTS.map((r) => r.reply)).toEqual(["好的", "缓存"]);
  });
  it("DP: the opening moves from the first second until the weights have landed", () => {
    const seconds = mechanismSeconds(6);
    const state = (t: number) => {
      const m = dpMotion(t / seconds);
      return [m.reveal, m.copy, m.cut, m.land].join();
    };
    expect(state(0.5)).not.toBe(state(0));
    // Reveal → copy → cut → land: no half-second window with a frozen picture.
    for (let t = 0; dpMotion(t / seconds).land < 1; t += 0.1)
      expect(state(t + 0.5), `frozen at ${t.toFixed(1)}s`).not.toBe(state(t));
  });

  it("DP (parallel-strategy page): the last step shows the computed result, reached without a frozen stretch", () => {
    const at = (t: number) => {
      const f = dpRequestFrame(t / DATA_PARALLEL_SECONDS);
      return [0, 1].map((owner) => dpReplyState(f.stage, f.local, owner));
    };
    // Still the orange input right before the reply step; fully the result, delivered, at the end.
    for (const s of at(0.84 * DATA_PARALLEL_SECONDS)) expect(s.result).toBe(0);
    at(DATA_PARALLEL_SECONDS).forEach((s) => {
      expect(s.result).toBe(1);
      expect(s.deliver).toBe(1);
    });
    for (let t = 0.85 * DATA_PARALLEL_SECONDS; t + 0.5 <= DATA_PARALLEL_SECONDS; t += 0.1)
      expect(JSON.stringify(at(t + 0.5)), `frozen at ${t.toFixed(1)}s`).not.toBe(JSON.stringify(at(t)));
  });

  it("EP: top-8 weights are normalized then scaled by 2.5; experts sit on card ⌊e/18⌋", () => {
    const sum = EP_SCORES.reduce((a, b) => a + b, 0);
    EP_WEIGHTS.forEach((w, i) => {
      expect(w).toBeCloseTo((EP_SCORES[i]! / sum) * EP_ROUTED_SCALE, 3);
    });
    expect(EP_WEIGHTS.reduce((a, b) => a + b, 0)).toBeCloseTo(2.5, 3);
    for (const e of EP_EXPERTS) expect(Math.floor(e.expert / 18)).toBe(e.rank);
    expect(new Set(EP_EXPERTS.map((e) => e.rank)).size).toBe(6);
    expect(EP_EXPERTS.filter((e) => e.rank === EP_SOURCE)).toHaveLength(2);
    expect(EP_EXPERTS.filter((e) => e.rank >= 8)).toHaveLength(4);
    [0, 1, 2, 3].forEach((c) => {
      expect(EP_ROUTED[c]).toBeCloseTo(
        EP_EXPERT_OUTPUTS.reduce((s, y, i) => s + EP_WEIGHTS[i]! * y[c]!, 0),
        6,
      );
    });
    expect(EP_ROUTED_ROWS[0]).toEqual(EP_ROUTED);
    EP_OUTPUT.forEach((row, r) => {
      row.forEach((x, c) => {
        expect(x).toBeCloseTo(EP_ROUTED_ROWS[r]![c]! + EP_SHARED[r]![c]!, 6);
      });
    });
  });

  it("EP: the opening deploys the 288 experts without freezing, then projects logits before MC2 prepare slice", () => {
    const seconds = mechanismSeconds(7);
    const state = (t: number) => {
      const m = epMotion(t / seconds);
      return [m.phase, m.reveal, m.cut, m.land, m.show, m.project, m.split].join();
    };
    expect(state(0.5)).not.toBe(state(0));
    for (let t = 0; epMotion(t / seconds).land < 1; t += 0.1)
      expect(state(t + 0.5), `frozen at ${t.toFixed(1)}s`).not.toBe(state(t));
  });

  it("EP: experts land in phase 0, router projects [4,288] before MC2 prepare slice, then local top-8 and TP8 finalize", () => {
    // At p=0.134 staggered bricks are still landing (land < 0.96).
    expect(epMotion(0.134).land).toBeLessThan(0.96);
    expect(epMotion(0.155).phase).toBe(0);
    expect(epMotion(0.155).land).toBe(1);
    // In phase 1, router logits projection precedes MC2 prepare slicing.
    const projecting = epMotion(0.2);
    expect(projecting.phase).toBe(1);
    expect(projecting.project).toBeGreaterThan(0);
    expect(projecting.split).toBe(0);
    expect(epMotion(0.275).phase).toBe(1);
    expect(epMotion(0.275).project).toBe(1);
    expect(epMotion(0.275).split).toBe(1);
    // Phase 2 runs local top-8 on the card's [1,288] slice.
    expect(epMotion(0.285).phase).toBe(2);
    expect(epMotion(0.285).score).toBe(0);
    const computing = epMotion(0.6);
    expect(computing.phase).toBe(4);
    expect(computing.dispatch.every((d) => d === 1)).toBe(true);
    expect(computing.combine.every((c) => c === 0)).toBe(true);
    // Phase 5: at p=0.80 (5/8 weighted) sidebar must show the running partial sum, not final 8/8 EP_ROUTED.
    expect(epAccumulation(epMotion(0.8).weigh).completed).toBeLessThan(8);
    expect(mechanismTeaching(7, 0.8).equation).toContain("5/8");
    expect(mechanismTeaching(7, 0.8).equation).not.toContain("[2.4, 1.7, 1.75, 1.75]");
    expect(mechanismCue(7, 0.8).detail).not.toContain("[2.4, 1.7, 1.75, 1.75]");
    // Phase 6: at p=0.91 crop is complete and shared expert TP8 All-Reduce is active before add.
    const sharedStage = epMotion(0.91);
    expect(sharedStage.phase).toBe(6);
    expect(sharedStage.crop).toBe(1);
    expect(sharedStage.shared).toBeGreaterThan(0);
    expect(sharedStage.add).toBe(0);
    expect(mechanismCue(7, 0.91).title).toContain("All-Reduce");
    expect(epMotion(1).add).toBe(1);
    expect(epMotion(1).writeback).toBe(1);
  });

  it("EP: dispatch has one moving copy and weighting retains each completed contribution", () => {
    for (let p = 0.4; p < 0.54; p += 0.001) {
      expect(epMotion(p).dispatch.filter((d) => d > 0 && d < 1).length).toBeLessThanOrEqual(1);
    }
    expect(epAccumulation(0).total).toEqual([0, 0, 0, 0]);
    for (let count = 1; count <= 8; count++) {
      const frame = epAccumulation(count / 8);
      for (let c = 0; c < 4; c++)
        expect(frame.total[c]).toBeCloseTo(
          EP_EXPERT_OUTPUTS.slice(0, count).reduce((sum, row, i) => sum + EP_WEIGHTS[i]! * row[c]!, 0),
          6,
        );
    }
    expect(epAccumulation(1).total).toEqual(EP_ROUTED);
  });

  it("EP: transfer routes land exactly on their slots and stay below the hardware", () => {
    for (const y of [-1.35, -2.85, -4.85]) {
      const source = new Vector3(-5.45, -0.2, 0.5),
        destination = new Vector3(3.6, y, 0.5);
      for (const [a, b] of [
        [source, destination],
        [destination, new Vector3(-0.6, y, 0.5)],
      ]) {
        const path = epTransferPath(a!, b!, 0.3);
        expect(path.getPoint(0).distanceTo(a!)).toBeLessThan(1e-6);
        expect(path.getPoint(1).distanceTo(b!)).toBeLessThan(1e-6);
        for (const p of path.getPoints(60)) {
          expect(p.y).toBeLessThanOrEqual(-0.2 + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(y - 1e-6);
          expect(p.z).toBeCloseTo(0.5, 6);
        }
      }
    }
  });

  it("EP: gathered rows enter from the side without crossing earlier rows", () => {
    for (const y of [-2.2, -2.7, -3.2, -3.7]) {
      const path = epTransferPath(new Vector3(-2, 3, 0.5), new Vector3(-4.6, y, 0.5), 0.3);
      for (const point of path.getPoints(80)) {
        if (point.x < -2.6) expect(point.y).toBeCloseTo(y, 6);
      }
    }
  });
});

describe("PCP opening", () => {
  it("rows fade in from the first second and keep moving until they land on the cards", () => {
    const seconds = mechanismSeconds(2);
    // `rows` is the per-row fade the renderer paints; split/assign move the rows.
    const state = (t: number) => {
      const m = pcpMotion(t / seconds);
      return [m.rows, m.split, m.assign].join();
    };
    expect(state(0.5)).not.toBe(state(0));
    for (let t = 0; pcpMotion(t / seconds).assign < 1; t += 0.1)
      expect(state(t + 0.5), `frozen at ${t.toFixed(1)}s`).not.toBe(state(t));
  });
});

describe("PCP running sum names the row being read", () => {
  it("while V1 is being read, the earlier sum holds V0 only and V1 appears as its own term", () => {
    const seconds = mechanismSeconds(2);
    // Scan phase 2 until card 0 is reading position 1 before it is added.
    let found = false;
    for (let t = 0; t < seconds && !found; t += 0.02) {
      const f = cpReadFrame(2, t / seconds, 0);
      if (f.running && f.position === 1 && f.pending && f.weighted) {
        found = true;
        expect(f.before.u).toBe(PCP_EXAMPLE.values[0]![0]);
        expect(f.product).toBe(PCP_EXAMPLE.values[1]![0]);
      }
    }
    expect(found).toBe(true);
  });

  it("after a row is added, before + current equals the shown total", () => {
    const f = cpReadFrame(2, 0.87, 0);
    expect(f.before.u + f.current.u).toBeCloseTo(f.total.u, 9);
    expect(f.before.z + f.current.z).toBeCloseTo(f.total.z, 9);
  });
});
