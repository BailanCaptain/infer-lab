export const MATMUL_INPUT = [2, 1, 3];
export const MATMUL_WEIGHT = [
  [1, 0, 2, 1],
  [0, 3, 1, 2],
  [2, 1, 0, 1],
];
export const MATMUL_OUTPUT = MATMUL_WEIGHT[0]!.map((_, col) =>
  MATMUL_INPUT.reduce((sum, x, row) => sum + x * MATMUL_WEIGHT[row]![col]!, 0),
);
// The article rounds at each step; the spatial view and the equations share that example.
export const SWIGLU_EXAMPLE = {
  input: [0.85, 1.13],
  gate: [1.98, -4.24, 0.28, 1.13],
  up: [1.13, 1.98, -1.7, -1.41],
  silu: [1.74, -0.06, 0.16, 0.85],
  product: [1.97, -0.12, -0.27, -1.2],
  down: [
    [1, 0],
    [1, 1],
    [-1, 1],
    [1, -1],
  ],
  output: [0.92, 0.81],
};

// Article examples; SwiGLU rounds at each step exactly as the accompanying calculation.
export const COMPUTE_INPUT = [MATMUL_INPUT, [1, 0, 2], [0, 2, 1]];
export const COMPUTE_WEIGHT = MATMUL_WEIGHT;
export const COMPUTE_PRODUCTS = COMPUTE_INPUT.map((row) =>
  MATMUL_WEIGHT[0]!.map((_, j) => row.map((x, k) => x * MATMUL_WEIGHT[k]![j]!)),
);
export const COMPUTE_OUTPUT = COMPUTE_PRODUCTS.map((row) =>
  row.map((terms) => terms.reduce((a, b) => a + b, 0)),
);
export const GATE_WEIGHT = [
  [1, -1, -1, 0, 1, 0],
  [1, -3, 1, 1, 0, 1],
  [1, 0, 1, -1, 1, 1],
  [0, 1, 1, 1, -1, 1],
];
export const UP_WEIGHT = [
  [0, 1, -2, 1, 1, -1],
  [1, 1, 0, -2, -1, 1],
  [1, 1, -1, 1, 1, 0],
  [0, 0, 1, -1, 1, 1],
];
const round = (n: number) => Number(n.toFixed(2));
const project = (x: number[], w: number[][]) =>
  w[0]!.map((_, j) => round(x.reduce((sum, n, k) => sum + n * w[k]![j]!, 0)));
// The spatial example has complete 4 → 6 → 4 tensors; the article also retains its smaller hand calculation.
const ffnInput = [0.85, 1.13, 0.5, -0.75];
const ffnGate = project(ffnInput, GATE_WEIGHT);
const ffnUp = project(ffnInput, UP_WEIGHT);
const ffnSilu = ffnGate.map((g) => round(g * Number((1 / (1 + Math.exp(-g))).toFixed(3))));
const ffnProduct = ffnSilu.map((s, j) => round(s * ffnUp[j]!));
const ffnDown = [
  [1, 0, 1, -1],
  [1, 1, 0, 1],
  [-1, 1, 1, 0],
  [1, -1, 1, 1],
  [0, 1, -1, 1],
  [1, 0, 1, -1],
];
export const FFN = {
  input: ffnInput,
  gate: ffnGate,
  up: ffnUp,
  silu: ffnSilu,
  product: ffnProduct,
  down: ffnDown,
  output: project(ffnProduct, ffnDown),
};
export const SPATIAL_COMPUTE_SECONDS = 24;
export const SWIGLU_SECONDS = 32;
export function computeWindow(p: number, a: number, b: number) {
  const t = Math.max(0, Math.min(1, (p - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function computePhase(step: number, progress: number) {
  return step === 1 ? matmulTimeline(progress).phase : swigluTimeline(progress).phase;
}

// One contribution at a time. Geometry and the adjacent readout use the same clock.
const matmulCellRange = (index: number) => ({
  start: index === 0 ? 0 : 0.25 + ((index - 1) * 0.75) / 11,
  duration: index === 0 ? 0.25 : 0.75 / 11,
});
export function matmulProgress(row: number, column: number, local: number) {
  const { start, duration } = matmulCellRange(row * 4 + column);
  // A selected completed cell must remain inside its interval, not select the next cell.
  return start + duration * Math.min(0.999999, Math.max(0, local));
}
export function matmulTimeline(p: number) {
  const index = p < 0.25 ? 0 : Math.min(11, 1 + Math.floor((p - 0.25) / (0.75 / 11) + 1e-9));
  const { start, duration } = matmulCellRange(index);
  const local = Math.max(0, Math.min(1, (p - start) / duration));
  const row = Math.floor(index / 4),
    column = index % 4;
  const phase = [0.14, 0.58, 0.86].filter((boundary) => local >= boundary).length;
  p = local;
  const arrivals = [0, 1, 2].map((k) => computeWindow(p, 0.14 + k * 0.13, 0.24 + k * 0.13));
  const reductions = [0, 1, 2].map((k) => computeWindow(p, 0.58 + k * 0.08, 0.66 + k * 0.08));
  const made = arrivals.filter((n) => n === 1).length;
  const added = reductions.filter((n) => n === 1).length;
  const active = phase === 1 ? Math.min(2, Math.floor((p - 0.14) / 0.13)) : Math.min(2, added);
  return { row, column, index, local, phase, arrivals, reductions, made, added, active };
}

export function swigluTimeline(p: number) {
  const index = [0.2, 0.4, 0.55, 0.75].filter((boundary) => p >= boundary).length;
  const start = [0, 0.2, 0.4, 0.55, 0.75][index]!;
  const duration = [0.2, 0.2, 0.15, 0.2, 0.25][index]!;
  const local = Math.max(0, Math.min(1, (p - start) / duration));
  const operation = ["gate", "up", "silu", "multiply", "down"][index]!;
  const count = index === 4 ? FFN.product.length : FFN.input.length;
  const arrivals = Array.from({ length: count }, (_, k) =>
    computeWindow(local, 0.2 + k * (0.3 / count), 0.2 + (k + 1) * (0.3 / count)),
  );
  const reductions = Array.from({ length: count }, (_, k) =>
    computeWindow(local, 0.56 + k * (0.32 / count), 0.56 + (k + 1) * (0.32 / count)),
  );
  const made = arrivals.filter((n) => n === 1).length,
    added = reductions.filter((n) => n === 1).length;
  return {
    phase: Math.max(0, index - 1),
    operation,
    local,
    arrivals,
    reductions,
    made,
    added,
    active: Math.min(count - 1, local >= 0.56 ? added : made),
    gateReady: p >= 0.2 || (index === 0 && reductions.every((n) => n === 1)),
    upReady: p >= 0.4 || (index === 1 && reductions.every((n) => n === 1)),
    silu: computeWindow(p, 0.43, 0.5),
    pair: computeWindow(p, 0.59, 0.68),
    downSum: index === 4 ? reductions[count - 1]! : 0,
  };
}

const displayNumber = (n: number, digits = 2) => String(Number(n.toFixed(digits))).replace("-", "−");
export const formatComputeProduct = (a: number, b: number, digits = 2) =>
  [a, b].map((n) => (n < 0 ? `(${displayNumber(n, digits)})` : displayNumber(n, digits))).join(" × ");
export const formatComputeSum = (terms: number[]) =>
  terms
    .map((n, i) => (i ? `${n < 0 ? "−" : "+"} ${displayNumber(Math.abs(n))}` : displayNumber(n)))
    .join(" ") || "0";

/** The morph is a geometric transition; only its completed value is a multiplication result. */
export function swigluGateState(p: number) {
  const t = swigluTimeline(p),
    silu = t.operation === "silu";
  const amount = silu ? t.silu : t.pair;
  const channels = (silu ? FFN.gate : FFN.up).map((before, i) => {
    const factor = silu ? Number((1 / (1 + Math.exp(-before))).toFixed(3)) : FFN.silu[i]!;
    const result = (silu ? FFN.silu : FFN.product)[i]!;
    return {
      before,
      factor,
      result,
      shapeValue: before + (result - before) * amount,
      displayValue: amount === 1 ? result : null,
      effect: `${Math.abs(factor) > 1 ? "放大" : "压小"}${factor < 0 ? "并变号" : ""}`,
    };
  });
  return { silu, amount, complete: amount === 1, channels };
}

/** One selected output cell, shared by matrix highlighting, connectors and the arithmetic panel. */
export function swigluFocus(p: number, channel: number, output: number) {
  const t = swigluTimeline(p),
    down = t.operation === "down";
  const input = down ? FFN.product : FFN.input;
  const weights = down ? FFN.down : t.operation === "up" ? UP_WEIGHT : GATE_WEIGHT;
  const result = down ? FFN.output : t.operation === "up" ? FFN.up : FFN.gate;
  const column = down ? output : channel;
  const products = input.map((n, k) => n * weights[k]![column]!);
  const sum = products.slice(0, t.added).reduce((a, b) => a + b, 0);
  const calculation =
    t.local < 0.2
      ? "prepare"
      : t.made < input.length
        ? "multiply"
        : t.local < 0.56
          ? "products"
          : t.added < input.length
            ? "sum"
            : "complete";
  const equation =
    calculation === "sum"
      ? `${formatComputeSum([sum, products[t.active]!])} → ${displayNumber(sum + products[t.active]!)}`
      : calculation === "complete"
        ? `${formatComputeSum(products)} = ${displayNumber(sum)}`
        : calculation === "products"
          ? `${input.length} 项乘积已就绪`
          : `${formatComputeProduct(input[t.active]!, weights[t.active]![column]!)} = …`;
  return { ...t, input, weights, output: result, column, products, sum, calculation, equation };
}

export const SWIGLU_DOWN_SUMS = FFN.output.map((_, j) => {
  const sums = [0];
  FFN.product.forEach((n, k) => {
    sums.push(Number((sums.at(-1)! + n * FFN.down[k]![j]!).toFixed(2)));
  });
  return sums;
});

export function matmulOutputState(timeline: ReturnType<typeof matmulTimeline>, i: number, j: number) {
  const active = i === timeline.row && j === timeline.column;
  const cellIndex = i * 4 + j;
  const complete = cellIndex < timeline.index || (cellIndex === timeline.index && timeline.added === 3);
  const reveal = active ? timeline.added / 3 : complete ? 1 : 0;
  const value = active
    ? COMPUTE_PRODUCTS[i]![j]!.slice(0, timeline.added).reduce((sum, term) => sum + term, 0)
    : COMPUTE_OUTPUT[i]![j]!;
  return { active, reveal, value };
}
