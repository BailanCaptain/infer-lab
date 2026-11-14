import { type ChapterLayer, projectionWeight } from "./chapter-layer";
import { JOURNEY_NODES, JOURNEY_STEPS, type JourneyNode, journeyTensors } from "./layer-journey";

export type JourneyPanel = { id: string; name: string; rows: number; columns: number; parameter?: boolean };
export function journeyOperation(
  data: ChapterLayer,
  step: number,
  word: number,
  dimension: number,
  lane = 0,
) {
  const tensors = journeyTensors(data, word);
  const current = JOURNEY_STEPS[step]!;
  const panel = (id: JourneyNode): JourneyPanel => ({
    id,
    name: JOURNEY_NODES.find((n) => n.id === id)!.name,
    rows: tensors[id].rows,
    columns: tensors[id].positions,
  });
  const column = (id: JourneyNode, token = word) => {
    const t = tensors[id];
    return Array.from(
      t.values.slice(
        (t.positions === 1 ? 0 : token) * t.rows,
        ((t.positions === 1 ? 0 : token) + 1) * t.rows,
      ),
    );
  };
  const target = panel(current.target);
  const d = Math.min(dimension, target.rows - 1);
  let first = panel(current.sources[0]!);
  let second: JourneyPanel | null = null;
  let a = column(current.sources[0]!);
  let b: number[] = [];
  let result = column(current.target);
  let products: number[] = [];
  let mode: "copy" | "project" | "match" | "softmax" | "weight" | "sum" | "add" | "relu" = "copy";
  let symbol = "→",
    scale = 1;
  const seeds: Record<number, [number, string]> = {
    2: [1, "Wq"],
    3: [2, "Wk"],
    4: [3, "Wv"],
    9: [4, "Wₒ"],
    12: [5, "W₁"],
    14: [6, "W₂"],
  };
  if (seeds[step]) {
    mode = "project";
    symbol = "×";
    const [seed, name] = seeds[step];
    second = { id: name, name, rows: a.length, columns: result.length, parameter: true };
    b = a.map((_, i) => projectionWeight(i, d, a.length, seed));
    products = a.map((v, i) => v * b[i]!);
  } else if (step === 5) {
    mode = "match";
    symbol = "×";
    scale = 1 / Math.sqrt(8);
    first = panel("q");
    second = panel("k");
    a = column("q");
    b = column("k", lane);
    products = a.map((v, i) => v * b[i]!);
    result = Array.from(tensors.scores.values);
  } else if (step === 6) {
    mode = "softmax";
    symbol = "÷";
    a = Array.from(tensors.scores.values);
    const max = Math.max(...a.slice(0, word + 1));
    products = a.map((v, i) => (i > word ? 0 : Math.exp(v - max)));
    const sum = products.reduce((s, v) => s + v, 0);
    b = a.map(() => sum);
    result = Array.from(tensors.alpha.values);
  } else if (step === 7) {
    mode = "weight";
    symbol = "×";
    first = panel("v");
    second = panel("alpha");
    a = column("v", lane);
    b = a.map(() => tensors.alpha.values[lane]!);
    result = a.map((v, i) => v * b[i]!);
  } else if (step === 8) {
    mode = "sum";
    symbol = "+";
    a = Array.from({ length: 8 }, (_, i) => {
      let sum = 0;
      for (let j = 0; j < lane; j++) sum += tensors.weighted.values[j * 8 + i]!;
      return sum;
    });
    b = column("weighted", lane);
    result = a.map((v, i) => v + b[i]!);
  } else if (step === 10 || step === 15) {
    mode = "add";
    symbol = "+";
    second = panel(current.sources[1]!);
    b = column(current.sources[1]!);
  } else if (step === 13) {
    mode = "relu";
    symbol = "max";
  }
  return {
    first,
    second,
    target,
    a,
    b,
    result,
    products,
    mode,
    symbol,
    scale,
    dimension: d,
    lane,
    scalar: products.reduce((s, v) => s + v, 0) * scale,
  };
}

/** A reduction tree accounts for every term; no sampled dimension stands in for a sum. */
export function operationReduction(values: number[]) {
  const groups = Math.min(16, values.length);
  const levels = [
    Array.from({ length: groups }, (_, g) => {
      let total = 0;
      for (
        let i = Math.floor((g * values.length) / groups);
        i < Math.floor(((g + 1) * values.length) / groups);
        i++
      )
        total += values[i]!;
      return total;
    }),
  ];
  while (levels.at(-1)!.length > 1) {
    const last = levels.at(-1)!;
    levels.push(
      Array.from({ length: Math.ceil(last.length / 2) }, (_, i) => last[i * 2]! + (last[i * 2 + 1] ?? 0)),
    );
  }
  return levels;
}
