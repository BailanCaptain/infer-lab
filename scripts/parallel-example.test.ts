import { describe, expect, it } from "vitest";
import { parallelGroups, pipelineCell, splitProjection } from "../src/app/course/parallel-example";

describe("并行教学中的守恒与依赖", () => {
  it("任意输入的列拼接和行归约恢复同一个未切分答案", () => {
    for (const x of [
      [1, 2],
      [-3, 4],
      [0, 0],
      [9, -9],
    ]) {
      const r = splitProjection(x);
      expect(r.columns.flat()).toEqual(r.complete);
      expect(r.partial[0]!.map((v, i) => v + r.partial[1]![i]!)).toEqual(r.complete);
    }
    expect(splitProjection([1, 2]).complete).toEqual([5, 1, 3, -2]);
  });
  it("每种布局都只使用同一批 16 个 rank，分组互不重叠", () => {
    for (const mode of ["tp", "pp", "dp"] as const) {
      const groups = parallelGroups(mode);
      expect(groups.flat()).toEqual(Array.from({ length: 16 }, (_, i) => i));
      expect(new Set(groups.flat()).size).toBe(16);
    }
  });
  it("每个批次顺序经过全部四段，未到达或已离开时为空闲", () => {
    for (const batches of [1, 4]) {
      let busy = 0;
      for (let stage = 0; stage < 4; stage++)
        for (let tick = 0; tick < batches + 3; tick++) {
          const cell = pipelineCell(stage, tick, batches);
          if (cell !== null) {
            expect(tick).toBe(stage + cell);
            busy++;
          }
        }
      expect(busy).toBe(batches * 4);
      expect(pipelineCell(3, 2, batches)).toBeNull();
      expect(pipelineCell(3, 3, batches)).toBe(0);
    }
  });
});
