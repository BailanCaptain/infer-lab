import { describe, expect, it } from "vitest";
import {
  dpMatrixState,
  EP_FOCUS_ROW,
  REQUEST_TOKENS,
  requestHidden,
  requestIds,
  tpInput,
  tpPartial,
  tpSum,
  tpWeight,
} from "../src/app/wiki/scene-request-matrix";

describe("request matrices retain complete token rows", () => {
  it("expands IDs only after dispatch, and before model computation", () => {
    expect(dpMatrixState(1, 0.4, 0).tokenized).toBe(false);
    expect(dpMatrixState(1, 0.7, 0).tokenized).toBe(true);
    for (let stage = 0; stage < 5; stage++) expect(dpMatrixState(stage, 1, 0).embedded).toBe(0);
    expect(dpMatrixState(5, 0.3, 0)).toMatchObject({ columns: 6, computing: false });
    expect(dpMatrixState(5, 0.6, 0)).toMatchObject({ embedded: 1, computing: true });
    for (const owner of [0, 1]) {
      expect(requestIds(owner)).toHaveLength(REQUEST_TOKENS[owner]!.length);
      expect(requestHidden(owner).map((row) => row.length)).toEqual([6, 6, 6, 6]);
    }
  });
  it("TP splits columns, preserving all four token rows, then sums every output position", () => {
    const input = tpInput();
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) {
        const contributions = Array.from({ length: 8 }, (_, rank) => tpPartial(rank)[row]![col]!);
        expect(contributions.reduce((a, b) => a + b, 0)).toBe(tpSum()[row]![col]);
        expect(tpSum()[row]![col]).toBe(
          input[row]!.reduce((sum, x, rank) => sum + x * tpWeight(rank, col), 0),
        );
      }
    expect(tpSum()[0]![0]).toBe(36);
    expect(tpSum()[3]![3]).toBe(576);
    expect(
      tpSum(0)
        .flat()
        .every((x) => x === 0),
    ).toBe(true);
  });
  it("EP's vector is explicitly one row of the request matrix", () => {
    expect(REQUEST_TOKENS[0][EP_FOCUS_ROW]).toBe("一封");
    expect(requestHidden(0)[EP_FOCUS_ROW]).toHaveLength(6);
  });
});
