// The CP chapter's scalar Q7=1 example; all queries use Q=1 and retain their causal mask.
export const RING_K = [0.5, 0.5, 1.5, 1.5, 1.5, 1.5, 0.5, 0.5].map(Math.log);
export const RING_V = [4, 8, 24, 28, 32, 36, 12, 16];
// Four-channel expansion for the 3D: [2,0,0,0] · [k,0,1,-1] / sqrt(4) = k.
// Scores and output channel 0 therefore exactly retain the chapter's scalar example.
export const RING_Q_VECTOR = [2, 0, 0, 0];
export const ringKeyVector = (position: number) => [RING_K[position]!, 0, 1, -1];
export const ringValueVector = (position: number) => {
  const value = RING_V[position]!;
  return [value, value / 2, value + 4, 40 - value];
};
export const ringVectorOutput = (query: number) => {
  const positions = Array.from({ length: query + 1 }, (_, p) => p);
  const weights = positions.map((p) => Math.exp(RING_K[p]!));
  const z = weights.reduce((sum, weight) => sum + weight, 0);
  return RING_Q_VECTOR.map(
    (_, d) => positions.reduce((sum, p) => sum + weights[p]! * ringValueVector(p)[d]!, 0) / z,
  );
};
export type RingSum = {
  max: number;
  sum: number;
  weighted: number;
  z: number;
  numerator: number;
  output: number;
};
const empty = (): RingSum => ({ max: -Infinity, sum: 0, weighted: 0, z: 0, numerator: 0, output: 0 });
function result(max: number, sum: number, weighted: number): RingSum {
  return {
    max,
    sum,
    weighted,
    z: Math.exp(max) * sum,
    numerator: Math.exp(max) * weighted,
    output: weighted / sum,
  };
}
export function ringPartial(query: number, positions: readonly number[]): RingSum {
  const valid = positions.filter((p) => p <= query);
  if (!valid.length) return empty();
  const max = Math.max(...valid.map((p) => RING_K[p]!));
  const sum = valid.reduce((s, p) => s + Math.exp(RING_K[p]! - max), 0);
  const weighted = valid.reduce((s, p) => s + Math.exp(RING_K[p]! - max) * RING_V[p]!, 0);
  return result(max, sum, weighted);
}
export function mergeRing(a: RingSum, b: RingSum): RingSum {
  if (!a.sum) return b;
  if (!b.sum) return a;
  const max = Math.max(a.max, b.max),
    scaleA = Math.exp(a.max - max),
    scaleB = Math.exp(b.max - max);
  return result(max, a.sum * scaleA + b.sum * scaleB, a.weighted * scaleA + b.weighted * scaleB);
}
