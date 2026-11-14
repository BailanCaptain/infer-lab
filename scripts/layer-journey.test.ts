import { expect, test } from "vitest";
import { makeChapterLayer, normalize } from "../src/app/course/chapter-layer";
import { journeyOperation, operationReduction } from "../src/app/course/journey-operation";
import {
  JOURNEY_NODES,
  JOURNEY_STEPS,
  journeyProjection,
  journeyTensors,
  journeyValue,
} from "../src/app/course/layer-journey";
import type { MatrixDemo } from "../src/app/course/matrix-parts";

const input = Float32Array.from({ length: 48 }, (_, i) => Math.sin(i / 5));
const normalized = normalize(input, 3, new Float32Array(16).fill(1), 1e-5).output;
const data = makeChapterLayer({
  epsilon: 1e-5,
  demo: {
    get: (id: string) => ({ a: id === "collapsed_attn" ? input : normalized, shape: [3, 16] }),
    weight: () => 1,
  } as unknown as MatrixDemo,
});

test("完整主线的每个输入先于输出产生，残差保留正确版本", () => {
  expect(JOURNEY_STEPS).toHaveLength(16);
  JOURNEY_STEPS.forEach((s, index) => {
    for (const id of s.sources)
      expect(JOURNEY_NODES.find((n) => n.id === id)!.at).toBeLessThanOrEqual(index === 0 ? 0 : index - 1);
  });
  expect(JOURNEY_STEPS[10]!.sources).toEqual(["x", "da"]);
  expect(JOURNEY_STEPS[15]!.sources).toEqual(["mid", "df"]);
});
test("六次完整投影的八组乘积覆盖全部维度，并等于真实输出", () => {
  for (const word of [0, 2])
    for (const step of [2, 3, 4, 9, 12, 14]) {
      const tensors = journeyTensors(data, word);
      const groups = journeyProjection(tensors, step, word, 11);
      expect(groups[0]!.start).toBe(0);
      expect(groups.at(-1)!.end).toBe(tensors[JOURNEY_STEPS[step]!.sources[0]!].rows);
      expect(groups.reduce((s, g) => s + g.sum, 0)).toBeCloseTo(
        journeyValue(tensors, JOURNEY_STEPS[step]!.target, word, 11),
        4,
      );
    }
});
test("未屏蔽分数与因果比例分开，最后两次更新使用同一份数值", () => {
  const tensors = journeyTensors(data, 1);
  expect(Number.isFinite(tensors.scores.values[2])).toBe(true);
  expect(tensors.alpha.values[2]).toBe(0);
  for (let d = 0; d < 16; d++) {
    const at = (id: "x" | "mid" | "da" | "df" | "y") => journeyValue(tensors, id, 1, d);
    expect(at("mid")).toBeCloseTo(at("x") + at("da"), 5);
    expect(at("y")).toBeCloseTo(at("mid") + at("df"), 5);
  }
});

test("投影的每项乘积和每轮归约都对应真实输出，换权重列会重新计算", () => {
  for (const step of [2, 3, 4, 9, 12, 14])
    for (const d of [0, 7]) {
      const op = journeyOperation(data, step, 2, d);
      expect(op.products).toHaveLength(op.a.length);
      op.products.forEach((v, i) => {
        expect(v).toBe(op.a[i]! * op.b[i]!);
      });
      const levels = operationReduction(op.products);
      const sum = op.products.reduce((s, v) => s + v, 0);
      for (const level of levels) expect(level.reduce((s, v) => s + v, 0)).toBeCloseTo(sum, 8);
      expect(sum).toBeCloseTo(op.result[d]!, 4);
    }
});

test("匹配、因果 softmax、整列乘比例、逐列相加使用同一条数据链", () => {
  for (const word of [0, 1, 2]) {
    const softmax = journeyOperation(data, 6, word, 0);
    expect(softmax.result.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    for (let j = 0; j < data.count; j++) {
      const match = journeyOperation(data, 5, word, 0, j);
      expect(match.scalar).toBeCloseTo(match.result[j]!, 7);
      expect(softmax.products[j]! / softmax.b[j]!).toBeCloseTo(softmax.result[j]!, 6);
      if (j > word) expect(softmax.result[j]).toBe(0);
      const weighted = journeyOperation(data, 7, word, 0, j);
      weighted.result.forEach((v, i) => {
        expect(v).toBeCloseTo(weighted.a[i]! * softmax.result[j]!, 7);
      });
    }
    const sum = journeyOperation(data, 8, word, 0, data.count - 1);
    const mixed = journeyTensors(data, word).mixed.values;
    sum.result.forEach((v, i) => {
      expect(v).toBeCloseTo(mixed[i]!, 6);
    });
  }
});
