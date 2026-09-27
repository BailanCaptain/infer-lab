import { describe, expect, it } from "vitest";
import { collectiveResult } from "./CollectiveDemo";

describe("集合通信教学语义", () => {
  it("收集不求和，归约不拼接，All-to-All 按目的分片重排", () => {
    const a = [1, 2, 3, 4];
    const b = [10, 20, 30, 40];
    expect(collectiveResult("All-Gather", a, b)).toEqual([
      [1, 2, 3, 4, 10, 20, 30, 40],
      [1, 2, 3, 4, 10, 20, 30, 40],
    ]);
    expect(collectiveResult("All-Reduce", a, b)).toEqual([
      [11, 22, 33, 44],
      [11, 22, 33, 44],
    ]);
    expect(collectiveResult("Reduce-Scatter", a, b)).toEqual([
      [11, 22],
      [33, 44],
    ]);
    expect(collectiveResult("All-to-All", a, b)).toEqual([
      [1, 2, 10, 20],
      [3, 4, 30, 40],
    ]);
    expect(a).toEqual([1, 2, 3, 4]);
    expect(b).toEqual([10, 20, 30, 40]);
  });
  it("Reduce-Scatter 再 All-Gather 与 All-Reduce 的结果一致", () => {
    const inputs: [number[], number[]] = [
      [-3, 5],
      [7, -2],
    ];
    const shards = collectiveResult("Reduce-Scatter", inputs[0], inputs[1]);
    expect(collectiveResult("All-Gather", shards[0], shards[1])).toEqual(
      collectiveResult("All-Reduce", inputs[0], inputs[1]),
    );
  });
});
