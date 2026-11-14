import { computeWindow, FFN, GATE_WEIGHT, swigluTimeline, UP_WEIGHT } from "./scene-compute-data";

// Coordinates of the complete FFN, also used as the exact extraction and writeback endpoints.
export const SWIGLU_STRUCTURE = {
  n: { title: "输入 n", at: [0, 8.3, 0], values: [FFN.input], ready: 0 },
  W_gate: { title: "gate 门控路", at: [2.4, 4.5, 0], values: GATE_WEIGHT, ready: 0 },
  W_up: { title: "up 内容路", at: [-2.4, 4.5, 0], values: UP_WEIGHT, ready: 0 },
  g: { title: "门控原值 g", at: [2.4, 2.3, 0], values: [FFN.gate], ready: 0.198 },
  u: { title: "内容向量 u", at: [-2.4, 2.3, 0], values: [FFN.up], ready: 0.398 },
  s: { title: "s = SiLU(g)", at: [2.4, 0.1, 0], values: [FFN.silu], ready: 0.5485 },
  h: { title: "h = s ⊙ u", at: [0, -1.3, 0], values: [FFN.product], ready: 0.748 },
  W_down: { title: "输出权重 W_down", at: [0, -4.7, 0], values: FFN.down, ready: 0 },
  delta: { title: "输出 Δ", at: [0, -7.5, 0], values: [FFN.output], ready: 0.9975 },
} satisfies Record<string, { title: string; at: number[]; values: number[][]; ready: number }>;
export type SwiNode = keyof typeof SWIGLU_STRUCTURE;
export type SwiCell = { node: SwiNode; row: number; col: number };
export const SWIGLU_START = { gate: 0, up: 0.2, silu: 0.4, multiply: 0.55, down: 0.75 };

export function swigluCellPoint({ node, row, col }: SwiCell): [number, number, number] {
  const { at, values } = SWIGLU_STRUCTURE[node];
  return [
    at[0]! + (col - (values[0]!.length - 1) / 2) * 0.62,
    at[1]! + ((values.length - 1) / 2 - row) * 0.62,
    at[2]!,
  ];
}

export function swigluStructureState(p: number, node: SwiNode) {
  return p + 1e-9 >= SWIGLU_STRUCTURE[node].ready;
}

/** Tensor boundary, derived from the same grid and cell size as extraction coordinates. */
export function swigluTensorPort(
  node: SwiNode,
  side: "left" | "right" | "top" | "bottom",
): [number, number, number] {
  const { at, values } = SWIGLU_STRUCTURE[node];
  const dx = (values[0]!.length - 1) * 0.31 + 0.27,
    dy = (values.length - 1) * 0.31 + 0.27;
  return [
    at[0]! + (side === "left" ? -dx : side === "right" ? dx : 0),
    at[1]! + (side === "bottom" ? -dy : side === "top" ? dy : 0),
    at[2]!,
  ];
}

export function swigluTransfer(p: number, channel: number, output: number) {
  const t = swigluTimeline(p),
    down = t.operation === "down";
  const col = down ? output : channel;
  let inputs: SwiCell[], weights: SwiCell[], outputs: SwiCell[];
  if (t.operation === "silu" || t.operation === "multiply") {
    inputs = Array.from({ length: FFN.gate.length }, (_, col) => ({
      node: t.operation === "silu" ? "g" : "u",
      row: 0,
      col,
    }));
    weights = t.operation === "silu" ? [] : inputs.map(({ col }) => ({ node: "s", row: 0, col }));
    outputs = inputs.map(({ col }) => ({ node: t.operation === "silu" ? "s" : "h", row: 0, col }));
  } else {
    inputs = Array.from({ length: down ? FFN.product.length : FFN.input.length }, (_, k) => ({
      node: down ? "h" : "n",
      row: 0,
      col: k,
    }));
    weights = inputs.map((_, k) => ({
      node: down ? "W_down" : t.operation === "up" ? "W_up" : "W_gate",
      row: k,
      col,
    }));
    outputs = [{ node: down ? "delta" : t.operation === "up" ? "u" : "g", row: 0, col }];
  }
  const extract = computeWindow(t.local, 0.02, 0.2),
    returning = computeWindow(t.local, 0.9, 0.99);
  return {
    ...t,
    inputs,
    weights,
    outputs,
    extract,
    returning,
    unfold: extract * (1 - returning),
  };
}
