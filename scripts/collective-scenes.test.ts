import { describe, expect, it } from "vitest";
import {
  COLLECTIVE_INPUT,
  COLLECTIVE_STEPS,
  COLLECTIVE_SUM,
  collectiveFrame,
  collectiveSeconds,
  RANKS,
} from "../src/app/wiki/scene-collective";

const at = (kind: number, action: number, local: number) =>
  collectiveFrame(kind, (4 + (action + local) * 3.6) / collectiveSeconds(kind));
const full = RANKS.map(() => [...COLLECTIVE_SUM]);
describe("collective communication: ownership, values and handoffs", () => {
  it("chapter buttons land on the requested transfer, including decimal time boundaries", () => {
    for (let kind = 0; kind < COLLECTIVE_STEPS.length; kind++)
      for (let action = 0; action < COLLECTIVE_STEPS[kind]!.length; action++) {
        expect(at(kind, action, 0).action, `mode ${kind}, action ${action}`).toBe(action);
      }
  });
  it("all eight definitions preserve their exact input/output rank order", () => {
    const outcomes = [
      RANKS.map(() => [1, 2, 3, 4]),
      RANKS.map((r) => RANKS.map((b) => (r === b ? r + 1 : null))),
      [[1, 2, 3, 4], ...RANKS.slice(1).map(() => [null, null, null, null])],
      RANKS.map(() => [1, 2, 3, 4]),
      [COLLECTIVE_SUM, ...RANKS.slice(1).map(() => [null, null, null, null])],
      RANKS.map((r) => RANKS.map((b) => (r === b ? COLLECTIVE_SUM[r] : null))),
      full,
      RANKS.map((r) => RANKS.map((from) => COLLECTIVE_INPUT[from]![r])),
      full,
    ];
    for (const [kind, expected] of outcomes.entries())
      expect(collectiveFrame(kind, 1).output, `kind ${kind}`).toEqual(expected);
  });
  it("arrival is visible before adding; backward seeking reconstructs the same state", () => {
    for (let kind = 0; kind < COLLECTIVE_STEPS.length; kind++) {
      for (let action = 0; action < COLLECTIVE_STEPS[kind]!.length; action++) {
        const flying = at(kind, action, 0.69),
          landed = at(kind, action, 0.76),
          applied = at(kind, action, 0.9);
        expect(flying.arrived).toBe(false);
        expect(landed.arrived).toBe(true);
        expect(landed.output).toEqual(flying.output);
        expect(applied.applied).toBe(true);
        collectiveFrame(kind, 1);
        expect(at(kind, action, 0.76)).toEqual(landed);
      }
    }
  });
  it("ring sends exactly one block per rank per round and follows the page's block 0 trace", () => {
    const rounds = COLLECTIVE_STEPS[8]!.slice(4);
    expect(rounds).toHaveLength(6);
    expect(rounds.map((r) => r.transfers.length)).toEqual([4, 4, 4, 4, 4, 4]);
    for (const round of rounds)
      for (const t of round.transfers) {
        expect(t.to).toBe((t.from + 1) % 4);
        expect(t.values).toHaveLength(1);
      }
    expect(at(8, 4, 0.9).output[1]![0]).toBe(11);
    expect(at(8, 5, 0.9).output[2]![0]).toBe(111);
    expect(at(8, 6, 0.9).output[3]![0]).toBe(1111);
    expect(RANKS.map((r) => at(8, 6, 0.9).output[r]![(r + 1) % 4])).toEqual([2222, 3333, 4444, 1111]);
    expect(rounds.slice(3).every((r) => r.transfers.every((t) => t.operation === "copy"))).toBe(true);
  });
  it("All-Reduce gathers already reduced pieces; All-to-All never adds values", () => {
    const gather = COLLECTIVE_STEPS[6]!.slice(16);
    expect(gather).toHaveLength(12);
    expect(
      gather.every((s) =>
        s.transfers.every(
          (t) => t.source === "output" && t.values[0] === COLLECTIVE_SUM[t.from] && t.operation === "copy",
        ),
      ),
    ).toBe(true);
    expect(COLLECTIVE_STEPS[7]!.every((s) => s.transfers[0]!.operation === "copy")).toBe(true);
  });
});
