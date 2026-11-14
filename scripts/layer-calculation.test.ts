import { expect, test } from "vitest";
import { makeChapterLayer, normalize, project, projectionWeight } from "../src/app/course/chapter-layer";
import {
  columnRange,
  columnStages,
  layerFrame,
  layerStepStart,
  projectionGroups,
  projectionTerms,
  visibleGroups,
} from "../src/app/course/layer-calculation";
import type { MatrixDemo } from "../src/app/course/matrix-parts";

const input = Float32Array.from({ length: 48 }, (_, i) => Math.sin(i / 5));
const norm = normalize(input, 3, new Float32Array(16).fill(1), 1e-5);
const demo = {
  get: (id: string) => ({ a: id === "collapsed_attn" ? input : norm.output, shape: [3, 16] }),
  weight: () => 1,
} as unknown as MatrixDemo;
const data = makeChapterLayer({ demo, epsilon: 1e-5 });
test("residual navigation agrees with extraction, addition and writeback boundaries", () => {
  for (const kind of ["residual-attn", "residual-ffn"] as const) {
    expect(layerStepStart(kind, 3)).toBe(0.82);
    expect(layerFrame(kind, 0.4).phase).toBe(2);
    expect(layerFrame(kind, 0.8).phase).toBe(2);
    expect(layerFrame(kind, 0.83).phase).toBe(3);
  }
});
test("computed activations do not use the fixed-parameter color", () => {
  expect(columnStages(data, "attention", 2)[0]!.panels[1]!.ink).not.toBe(1);
  for (const kind of ["residual-attn", "residual-ffn"] as const)
    expect(columnStages(data, kind, 2)[0]!.panels[1]!.ink).not.toBe(1);
});
test("FFN displayed blocks include every product exactly once and sum to the real output", () => {
  for (const stage of columnStages(data, "ffn", 2).filter((s) => s.mode === "project")) {
    const groups = projectionGroups(stage, 7);
    expect(groups[0]!.start).toBe(0);
    expect(groups.at(-1)!.end).toBe(stage.inputs[0]!.values.length);
    groups.slice(1).forEach((g, i) => {
      expect(g.start).toBe(groups[i]!.end);
    });
    expect(groups.reduce((sum, g) => sum + g.sum, 0)).toBeCloseTo(stage.outputs[0]!.values[7]!, 5);
  }
});
test("a first animation timestamp preceding the effect cannot address a negative stage", () => {
  expect(layerFrame("attention", -0.0001)).toEqual({ phase: 0, amount: 0 });
});
test("the native groups cover the complete vector, without skipping or mixing dimensions", () => {
  for (const width of [8, 16, 4096, 8192]) {
    const ranges = Array.from({ length: visibleGroups(width) }, (_, i) => columnRange(width, i));
    expect(ranges[0]![0]).toBe(0);
    expect(ranges.at(-1)![1]).toBe(width);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i]![0]).toBe(ranges[i - 1]![1]);
  }
});
test("both residuals take and write complete columns from the same position", () => {
  for (const kind of ["residual-attn", "residual-ffn"] as const) {
    const stage = columnStages(data, kind, 2)[0]!;
    expect(stage.inputs.map((c) => c.values.length)).toEqual([16, 16]);
    expect(stage.outputs[0]!.column).toBe(2);
    const [a, b] = stage.inputs;
    const expected = kind === "residual-attn" ? data.mid : data.output;
    for (let i = 0; i < 16; i++) {
      expect(Math.fround(a!.values[i]! + b!.values[i]!)).toBe(expected[32 + i]);
      expect(stage.outputs[0]!.values[i]).toBe(expected[32 + i]);
    }
  }
});
test("attention weights every dimension of every visible column and excludes future columns", () => {
  const stages = columnStages(data, "attention", 1),
    weighted = stages[1]!;
  expect(weighted.inputs).toHaveLength(2);
  for (let j = 0; j < 2; j++)
    for (let c = 0; c < 8; c++)
      expect(weighted.outputs[j]!.values[c]).toBe(
        Math.fround(weighted.inputs[j]!.values[c]! * weighted.coefficients![j]!),
      );
  const summed = stages[2]!;
  for (let c = 0; c < 8; c++) {
    const sum = summed.inputs.reduce((s, input) => s + input.values[c]!, 0);
    expect(sum).toBeCloseTo(summed.outputs[0]!.values[c]!, 5);
  }
});

test("one query's summary remains one column when entering output projection", () => {
  for (const word of [0, 1, 2]) {
    const stages = columnStages(data, "attention", word);
    expect(stages[3]!.panels[0]!.columns).toBe(1);
    expect(stages[3]!.inputs[0]!.column).toBe(0);
    expect(stages[3]!.inputs[0]!.values).toEqual(stages[2]!.outputs[0]!.values);
    expect(stages[3]!.outputs[0]!.column).toBe(word);
  }
});

test("the eight visible products account for the selected output dimension", () => {
  const stage = columnStages(data, "attention", 2)[3]!;
  for (const dimension of [0, 7, 15]) {
    const terms = projectionTerms(stage, dimension);
    expect(terms).toHaveLength(8);
    expect(terms.map((term) => term.input)).toEqual(Array.from(stage.inputs[0]!.values));
    for (const [j, term] of terms.entries()) {
      expect(term.weight).toBe(projectionWeight(j, dimension, 8, 4));
      expect(term.product).toBe(term.input * term.weight);
    }
    expect(Math.fround(terms.reduce((sum, term) => sum + term.product, 0))).toBe(
      stage.outputs[0]!.values[dimension],
    );
  }
});
test("FFN preserves complete column data through normalization, expansion, ReLU and projection", () => {
  const stages = columnStages(data, "ffn", 2);
  expect(stages.map((s) => s.outputs[0]!.values.length)).toEqual([16, 8192, 8192, 16]);
  expect(stages[1]!.panels[1]).toMatchObject({ weight: true, rows: 16, columns: 8192 });
  expect(stages[3]!.panels[1]).toMatchObject({ weight: true, rows: 8192, columns: 16 });
  for (const stage of [stages[1]!, stages[3]!, columnStages(data, "attention", 2)[3]!])
    expect(project(stage.inputs[0]!.values, 1, stage.outputs[0]!.values.length, stage.seed!)).toEqual(
      stage.outputs[0]!.values,
    );
  const relu = stages[2]!;
  expect(relu.inputs[0]!.values.some((n) => n < 0)).toBe(true);
  expect(relu.inputs[0]!.values.some((n) => n > 0)).toBe(true);
  for (let c = 0; c < 8192; c++)
    expect(relu.outputs[0]!.values[c]).toBe(Math.max(0, relu.inputs[0]!.values[c]!));
  for (let c = 0; c < 16; c++)
    expect(stages[0]!.outputs[0]!.values[c]).toBe(
      Math.fround((data.mid[32 + c]! / data.norm2.denominators[2]!) * data.gamma2[c]!),
    );
});
test("every input dimension participates in each projected output, using the existing weight matrix", () => {
  for (const width of [8, 16, 4096, 8192]) {
    const values = Float32Array.from({ length: width }, (_, i) => Math.sin(i / 5)),
      output = project(values, 1, 4, 5);
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let j = 0; j < width; j++) sum += values[j]! * projectionWeight(j, c, width, 5);
      expect(Math.fround(sum)).toBe(output[c]);
    }
  }
});
