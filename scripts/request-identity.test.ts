import { describe, expect, it } from "vitest";
import { requestCellPairs, requestCells, requestVector } from "../src/app/wiki/scene-request-identity";

describe("request data keeps its identity across layouts", () => {
  const vertical = [
    ["p₀", "0"],
    ["p₁", "1"],
    ["p₂", "2"],
    ["p₃", "3"],
  ];
  const horizontal = [
    ["p₀", "p₁", "p₂", "p₃"],
    ["0", "1", "2", "3"],
  ];
  it("keeps ID and position colors together when rows become columns", () => {
    const source = requestCells(vertical);
    const target = requestCells(horizontal);
    const pairs = requestCellPairs(source, target);
    expect(pairs.map((p) => p.to)).toEqual([0, 4, 1, 5, 2, 6, 3, 7]);
    for (const { from, to } of pairs) {
      expect(target[to]!.identity).toBe(source[from]!.identity);
      expect(target[to]!.tone).toBe(source[from]!.tone);
    }
    expect(new Set(source.map((c) => c.identity))).toHaveLength(4);
  });
  it("retains the position identity through embedding, hidden state and norm", () => {
    for (let i = 0; i < 4; i++) {
      for (const kind of ["e", "h", "z"] as const) {
        const row = requestCells([requestVector(kind, i)]);
        expect(row.every((cell) => cell.identity === `p${"₀₁₂₃"[i]}`)).toBe(true);
        expect(row.every((cell) => cell.tone === i)).toBe(true);
      }
    }
  });
  it("matches every component during a horizontal-to-vertical rearrangement", () => {
    const row = requestVector("z", 3);
    const source = requestCells([row]);
    const target = requestCells(row.map((v) => [v]));
    expect(requestCellPairs(source, target)).toEqual(row.map((_, i) => ({ from: i, to: i })));
  });
  it("keeps confirmed and draft tokens distinct through decode handoff", () => {
    const source = requestCells([
      ["y₀", "d₁?", "d₂?", "d₃?"],
      ["4", "5", "6", "7"],
    ]);
    const target = requestCells([
      ["y₀", "4"],
      ["d₁?", "5"],
      ["d₂?", "6"],
      ["d₃?", "7"],
    ]);
    const pairs = requestCellPairs(source, target);
    expect(pairs).toHaveLength(8);
    expect(pairs.every(({ from, to }) => source[from]!.identity === target[to]!.identity)).toBe(true);
    expect(source[0]!.tone).not.toBe(source[1]!.tone);
    expect(requestCells([["—"], ["空"]]).every((c) => c.identity === "")).toBe(true);
  });
  it("does not disguise an embedding lookup or a rejected draft as a transfer", () => {
    expect(requestCellPairs(requestCells([["y₀"]]), requestCells([["E[y₀]"]]))).toEqual([]);
    expect(requestCellPairs(requestCells([["d₂?"]]), requestCells([["y₂"]]))).toEqual([]);
  });
});
