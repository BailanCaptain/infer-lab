import { type ChapterLayer, HEAD, type LayerScene, projectionWeight } from "./chapter-layer";

export type Panel = { name: string; columns: number; rows: number; ink: number; weight?: boolean };
export type Column = { panel: number; column: number; values: Float32Array };
export type ColumnStage = {
  panels: Panel[];
  mode: "add" | "weight" | "sum" | "norm" | "relu" | "project";
  inputs: Column[];
  outputs: Column[];
  coefficients?: number[];
  seed?: number;
};
export function projectionTerms(stage: ColumnStage, dimension: number) {
  const values = stage.inputs[0]!.values;
  return Array.from(values, (input, j) => {
    const weight = projectionWeight(j, dimension, values.length, stage.seed!);
    return { input, weight, product: input * weight };
  });
}
/** Contiguous blocks account for every input dimension in a projected scalar. */
export function projectionGroups(stage: ColumnStage, dimension: number, count = 8) {
  const terms = projectionTerms(stage, dimension);
  return Array.from({ length: count }, (_, group) => {
    const start = Math.floor((group * terms.length) / count);
    const end = Math.floor(((group + 1) * terms.length) / count);
    let sum = 0;
    for (let i = start; i < end; i++) sum += terms[i]!.product;
    return { start, end, sum };
  });
}
export function formatLayerValue(number: number) {
  const magnitude = Math.abs(number);
  if (magnitude > 0 && magnitude < 0.000001) return number.toExponential(2);
  return number.toFixed(magnitude > 0 && magnitude < 0.01 ? 6 : 3).replace(/^-0\.000$/, "0.000");
}
export const SCENE_STEPS: Record<LayerScene, string[]> = {
  attention: ["读取内容列", "整列乘比例", "按维度累加", "投影并写回"],
  "residual-attn": ["取出两列", "逐维对齐", "整列相加", "写回 X′"],
  ffn: ["整列归一化", "W₁ 展开", "逐维 ReLU", "W₂ 收回"],
  "residual-ffn": ["取出两列", "逐维对齐", "整列相加", "写回 Y"],
};
const attentionSeconds = [11, 11, 11, 24];
const attentionDuration = attentionSeconds.reduce((sum, seconds) => sum + seconds, 0);
export const RESIDUAL_TIMING = { aligned: 0.22, add: 0.38, write: 0.82, end: 0.98 };
export function layerStepStart(kind: LayerScene, step: number) {
  if (kind.startsWith("residual"))
    return [0, RESIDUAL_TIMING.aligned, RESIDUAL_TIMING.add, RESIDUAL_TIMING.write][step]!;
  if (kind === "attention")
    return attentionSeconds.slice(0, step).reduce((sum, seconds) => sum + seconds, 0) / attentionDuration;
  return step / 4;
}
export function layerFrame(kind: LayerScene, progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  if (kind !== "ffn") {
    let phase = 0;
    while (phase < 3 && clamped >= layerStepStart(kind, phase + 1)) phase++;
    return {
      phase,
      amount:
        (clamped - layerStepStart(kind, phase)) /
        ((phase === 3 ? 1 : layerStepStart(kind, phase + 1)) - layerStepStart(kind, phase)),
    };
  }
  const position = clamped * 4;
  const phase = Math.min(3, Math.floor(position));
  return { phase, amount: position - phase };
}
export const LAYER_DURATION: Record<LayerScene, number> = {
  "residual-attn": 30000,
  "residual-ffn": 30000,
  attention: attentionDuration * 1000,
  ffn: 96000,
};
export function visibleGroups(rows: number) {
  return rows <= 16 ? rows : Math.ceil(rows / 256);
}
export function columnRange(rows: number, group: number) {
  const count = visibleGroups(rows);
  return [Math.floor((group * rows) / count), Math.floor(((group + 1) * rows) / count)] as const;
}
export function columnStages(data: ChapterLayer, kind: LayerScene, word: number): ColumnStage[] {
  const { count, width } = data;
  const p = (name: string, rows: number, ink: number, columns = count, weight = false): Panel => ({
    name,
    rows,
    ink,
    columns,
    weight,
  });
  const c = (values: Float32Array, rows: number, panel: number, column = word): Column => ({
    values: values.subarray(column * rows, (column + 1) * rows),
    panel,
    column,
  });
  const projection = (
    input: Float32Array,
    output: Float32Array,
    rows: number,
    outRows: number,
    name: string,
    weight: string,
    result: string,
    seed: number,
  ): ColumnStage => ({
    mode: "project",
    seed,
    panels: [p(name, rows, 0), p(weight, rows, 1, outRows, true), p(result, outRows, 2)],
    inputs: [c(input, rows, 0)],
    outputs: [c(output, outRows, 2)],
  });
  if (kind.startsWith("residual")) {
    const first = kind === "residual-attn";
    return [
      {
        mode: "add",
        panels: first
          ? [p("保留的 X", width, 0), p("注意力 ΔA", width, 2), p("更新后的 X′", width, 2)]
          : [p("保留的 X′", width, 0), p("前馈 ΔF", width, 2), p("本层输出 Y", width, 2)],
        inputs: [
          c(first ? data.input : data.mid, width, 0),
          c(first ? data.attention.delta : data.ffn.delta, width, 1),
        ],
        outputs: [c(first ? data.mid : data.output, width, 2)],
      },
    ];
  }
  if (kind === "attention") {
    const inputs = Array.from({ length: word + 1 }, (_, j) => c(data.attention.v, HEAD, 0, j));
    const coefficients = inputs.map(({ column }) => data.attention.weights[word * count + column]!);
    const outputs = inputs.map(
      (input, j): Column => ({ panel: 2, column: j, values: input.values.map((v) => v * coefficients[j]!) }),
    );
    const weighted: ColumnStage = {
      mode: "weight",
      panels: [p("内容 V", HEAD, 0), p("混合比例 α", 1, 2), p("加权内容", HEAD, 2)],
      inputs,
      outputs,
      coefficients,
    };
    const projected = projection(
      data.attention.mixed,
      data.attention.delta,
      HEAD,
      width,
      "汇总内容",
      "输出权重 Wₒ",
      "注意力 ΔA",
      4,
    );
    // The animation follows one query; keep its summary distinct from the full output matrix.
    projected.panels[0]!.columns = 1;
    projected.inputs[0]!.column = 0;
    return [
      weighted,
      weighted,
      {
        mode: "sum",
        panels: [p("加权内容", HEAD, 2), p("", 0, 0, 0), p("汇总内容", HEAD, 2, 1)],
        inputs: outputs.map((column) => ({ ...column, panel: 0 })),
        outputs: [
          { panel: 2, column: 0, values: data.attention.mixed.subarray(word * HEAD, (word + 1) * HEAD) },
        ],
      },
      projected,
    ];
  }
  const expanded = data.ffn.expanded.length / count;
  return [
    {
      mode: "norm",
      panels: [p("更新后的 X′", width, 0), p("逐维增益 γ₂", width, 1, 1), p("支路输入 N₂", width, 2)],
      inputs: [c(data.mid, width, 0), { panel: 1, column: 0, values: data.gamma2 }],
      outputs: [c(data.norm2.output, width, 2)],
      coefficients: [data.norm2.denominators[word]!],
    },
    projection(
      data.norm2.output,
      data.ffn.expanded,
      width,
      expanded,
      "支路输入 N₂",
      "展开权重 W₁",
      "中间表示 H",
      5,
    ),
    {
      mode: "relu",
      panels: [p("激活前 H", expanded, 0), p("", 0, 0, 0), p("ReLU 后 H₊", expanded, 2)],
      inputs: [c(data.ffn.expanded, expanded, 0)],
      outputs: [c(data.ffn.activated, expanded, 2)],
    },
    projection(
      data.ffn.activated,
      data.ffn.delta,
      expanded,
      width,
      "ReLU 后 H₊",
      "收回权重 W₂",
      "前馈 ΔF",
      6,
    ),
  ];
}
