import type { MasterParts } from "./matrix-parts";

export type LayerScene = "attention" | "residual-attn" | "ffn" | "residual-ffn";
export const HEAD = 8;
export const EXPANDED = 8192;

// Fixed low-rank factors generate dense teaching weights without storing two 4096 × 8192 arrays.
function factor(index: number, rank: number, seed: number) {
  return Math.sin((index + 1) * (rank + 1) * 0.173 + seed) * Math.SQRT2;
}
export function projectionWeight(input: number, output: number, width: number, seed: number) {
  let weight = 0;
  for (let rank = 0; rank < 8; rank++) weight += factor(input, rank, seed) * factor(output, rank, seed + 2);
  return weight / Math.sqrt(width * 8);
}
export function project(input: Float32Array, count: number, outputWidth: number, seed: number) {
  const width = input.length / count;
  const result = new Float32Array(count * outputWidth);
  for (let token = 0; token < count; token++) {
    const reduced = new Float64Array(8);
    for (let rank = 0; rank < 8; rank++) {
      for (let channel = 0; channel < width; channel++)
        reduced[rank]! += (input[token * width + channel]! * factor(channel, rank, seed)) / Math.sqrt(width);
    }
    for (let channel = 0; channel < outputWidth; channel++) {
      let sum = 0;
      for (let rank = 0; rank < 8; rank++)
        sum += (reduced[rank]! * factor(channel, rank, seed + 2)) / Math.sqrt(8);
      result[token * outputWidth + channel] = sum;
    }
  }
  return result;
}

export function normalize(input: Float32Array, count: number, gamma: Float32Array, epsilon: number) {
  const width = gamma.length;
  const output = new Float32Array(input.length);
  const denominators = new Float64Array(count);
  for (let token = 0; token < count; token++) {
    let sum = 0;
    for (let c = 0; c < width; c++) sum += input[token * width + c]! ** 2;
    const rms = Math.sqrt(sum / width + epsilon);
    denominators[token] = rms;
    for (let c = 0; c < width; c++) output[token * width + c] = (input[token * width + c]! / rms) * gamma[c]!;
  }
  return { output, denominators };
}

export function causalAttention(input: Float32Array, count: number) {
  const q = project(input, count, HEAD, 1);
  const k = project(input, count, HEAD, 2);
  const v = project(input, count, HEAD, 3);
  const weights = new Float32Array(count * count);
  const matchingScores = new Float64Array(count * count).fill(Number.NEGATIVE_INFINITY);
  const mixed = new Float32Array(count * HEAD);
  for (let token = 0; token < count; token++) {
    const scores = new Float64Array(token + 1);
    for (let source = 0; source <= token; source++) {
      for (let c = 0; c < HEAD; c++)
        scores[source]! += (q[token * HEAD + c]! * k[source * HEAD + c]!) / Math.sqrt(HEAD);
    }
    const max = Math.max(...scores);
    matchingScores.set(scores, token * count);
    const sum = scores.reduce((total, score) => total + Math.exp(score - max), 0);
    for (let source = 0; source <= token; source++) {
      const weight = Math.exp(scores[source]! - max) / sum;
      weights[token * count + source] = weight;
      for (let c = 0; c < HEAD; c++) mixed[token * HEAD + c]! += weight * v[source * HEAD + c]!;
    }
  }
  return {
    q,
    k,
    scores: matchingScores,
    weights,
    v,
    mixed,
    delta: project(mixed, count, input.length / count, 4),
  };
}

export function feedForward(input: Float32Array, count: number) {
  const expanded = project(input, count, EXPANDED, 5);
  const activated = expanded.map((value) => Math.max(0, value));
  return { expanded, activated, delta: project(activated, count, input.length / count, 6) };
}

export function makeChapterLayer(source: Pick<MasterParts, "demo" | "epsilon">) {
  const original = source.demo.get("collapsed_attn");
  const [count, width] = original.shape as [number, number];
  const input = original.a;
  const norm1 = source.demo.get("x_attn").a;
  const attention = causalAttention(norm1, count);
  const mid = input.map((value, index) => value + attention.delta[index]!);
  const gamma2 = Float32Array.from({ length: width }, (_, c) => source.demo.weight("gamma_ffn", c));
  const norm2 = normalize(mid, count, gamma2, source.epsilon);
  const ffn = feedForward(norm2.output, count);
  const output = mid.map((value, index) => value + ffn.delta[index]!);
  return { count, width, input, norm1, attention, mid, gamma2, norm2, ffn, output };
}
export type ChapterLayer = ReturnType<typeof makeChapterLayer>;

const cache = new WeakMap<MasterParts, ChapterLayer>();
export function chapterLayer(source: MasterParts) {
  let data = cache.get(source);
  if (!data) {
    data = makeChapterLayer(source);
    cache.set(source, data);
  }
  return data;
}
