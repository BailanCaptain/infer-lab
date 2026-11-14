import { expect, test } from "vitest";
import { causalAttention, feedForward, makeChapterLayer, normalize } from "../src/app/course/chapter-layer";
import type { MatrixDemo } from "../src/app/course/matrix-parts";

test("causal attention ignores future positions and weights sum to one", () => {
  const input = Float32Array.from({ length: 32 }, (_, i) => Math.sin(i));
  const before = causalAttention(input, 4);
  for (let token = 0; token < 4; token++) {
    const scores = Array.from(before.scores.slice(token * 4, token * 4 + token + 1));
    const max = Math.max(...scores);
    const total = scores.reduce((sum, score) => sum + Math.exp(score - max), 0);
    for (let source = 0; source <= token; source++) {
      let dot = 0;
      for (let c = 0; c < 8; c++) dot += before.q[token * 8 + c]! * before.k[source * 8 + c]!;
      expect(scores[source]).toBeCloseTo(dot / Math.sqrt(8), 8);
      expect(before.weights[token * 4 + source]).toBeCloseTo(Math.exp(scores[source]! - max) / total, 6);
    }
    for (let source = token + 1; source < 4; source++)
      expect(before.scores[token * 4 + source]).toBe(Number.NEGATIVE_INFINITY);
  }
  input.fill(30, 16);
  const after = causalAttention(input, 4);
  expect(after.delta.slice(0, 16)).toEqual(before.delta.slice(0, 16));
  for (let t = 0; t < 4; t++) {
    expect(before.weights.slice(t * 4, t * 4 + 4).reduce((a, b) => a + b)).toBeCloseTo(1, 6);
    for (let j = t + 1; j < 4; j++) expect(before.weights[t * 4 + j]).toBe(0);
    for (let c = 0; c < 8; c++) {
      let expected = 0;
      for (let j = 0; j <= t; j++) expected += before.weights[t * 4 + j]! * before.v[j * 8 + c]!;
      expect(before.mixed[t * 8 + c]).toBeCloseTo(expected, 5);
    }
  }
});

test("FFN shares weights, processes positions independently, and applies a nonlinearity", () => {
  const row = Float32Array.from({ length: 16 }, (_, i) => Math.cos(i));
  const input = Float32Array.from([...row, ...row]);
  const result = feedForward(input, 2);
  expect(result.delta.slice(0, 16)).toEqual(result.delta.slice(16));
  input.fill(20, 16);
  expect(feedForward(input, 2).delta.slice(0, 16)).toEqual(result.delta.slice(0, 16));
  expect(result.expanded.some((v) => v < 0)).toBe(true);
  expect(result.activated.every((v, i) => v === Math.max(0, result.expanded[i]!))).toBe(true);
});

test("both residual updates and the second normalization consume the previous result", () => {
  const input = Float32Array.from({ length: 48 }, (_, i) => Math.sin(i / 5));
  const gamma = new Float32Array(16).fill(1);
  const norm = normalize(input, 3, gamma, 1e-5);
  const demo = {
    get: (id: string) => ({ a: id === "collapsed_attn" ? input : norm.output, shape: [3, 16] }),
    weight: () => 1,
  } as unknown as MatrixDemo;
  const layer = makeChapterLayer({ demo, epsilon: 1e-5 });
  for (let i = 0; i < input.length; i++) {
    expect(layer.mid[i]).toBe(Math.fround(input[i]! + layer.attention.delta[i]!));
    expect(layer.output[i]).toBe(Math.fround(layer.mid[i]! + layer.ffn.delta[i]!));
  }
  expect(layer.norm2.output).toEqual(normalize(layer.mid, 3, gamma, 1e-5).output);
  expect(layer.output.every(Number.isFinite)).toBe(true);
});
