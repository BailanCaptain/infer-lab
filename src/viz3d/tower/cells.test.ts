import { describe, expect, it } from "vitest";
import { MASK_SENTINEL } from "../scale";
import { cellGrid, pickMerge } from "./cells";

describe("格子体数据准备", () => {
  it("merge=1 逐元素原样；merge=2 取块均值，边缘不足一块也算", () => {
    const view = { rows: 3, cols: 5, at: (r: number, c: number) => r * 10 + c };
    const g1 = cellGrid(view, 1);
    expect(g1.rows).toBe(3);
    expect(g1.cols).toBe(5);
    expect(g1.values[7]).toBe(12);
    const g2 = cellGrid(view, 2);
    expect(g2.rows).toBe(2);
    expect(g2.cols).toBe(3);
    // (0,0) 块 = {0,1,10,11} 均值 5.5
    expect(g2.values[0]).toBeCloseTo(5.5, 6);
    // 最后一列只有 c=4：{4,14} 均值 9
    expect(g2.values[2]).toBeCloseTo(9, 6);
    // 最后一行只有 r=2：{20,21} 均值 20.5
    expect(g2.values[3]).toBeCloseTo(20.5, 6);
  });

  it("块内有掩码哨兵则整格是哨兵，且不参与色阶", () => {
    const view = { rows: 2, cols: 2, at: (r: number, c: number) => (r === 1 && c === 1 ? -1e30 : 0.5) };
    const g = cellGrid(view, 2);
    expect(Math.abs(g.values[0]!)).toBeGreaterThanOrEqual(MASK_SENTINEL);
    expect(g.scale.hasMask).toBe(true);
    const g1 = cellGrid(view, 1);
    expect(g1.scale.scale).toBeCloseTo(0.5, 6);
  });

  it("pickMerge 取最小的 2 的幂使格数不超上限", () => {
    expect(pickMerge(1024, 2048, 8192)).toBe(16);
    expect(pickMerge(6, 1024, 8192)).toBe(1);
    expect(pickMerge(1024, 1024, 4096)).toBe(16);
    expect(pickMerge(6, 2048, 8192)).toBe(2);
  });
});
