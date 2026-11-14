import type * as Three from "three";

export type MatrixPartKind = "rms" | "mhc" | "ffn";
export type FfnStep = "gate" | "up" | "multiply" | "down";
export interface MatrixDemo {
  get(id: string): { a: Float32Array; shape: number[] };
  at(id: string, ...indices: number[]): number;
  weight(id: string, ...indices: number[]): number;
}
export interface PartTensor {
  id: string;
  name: string;
  kind: "data" | "weight";
  comp: string;
  rows: { n: number; unit: string };
  cols: number;
  shape: number[];
  deck: { n: number; kind: string } | null;
}
export interface PartBlock {
  id: string;
  t: PartTensor;
  kind: "data" | "weight";
  comp: string;
  orient: "col" | "row" | "wl" | "wt" | "rod" | "bar";
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  div: [number, number, number];
  cut: [number, number, number];
  alt: string | null;
}
export interface PartArrow {
  from: string;
  to: string;
  pts: number[][];
}
interface PartShape {
  w: number;
  h: number;
  d: number;
  div: [number, number, number];
  cut: [number, number, number];
  alt: string | null;
}
export interface PartLook {
  addBlock(scene: Three.Scene, block: PartBlock): Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  addArrow(
    scene: Three.Scene,
    points: number[][],
    options: { color: string; w: number; z: number; head?: boolean; r?: number },
  ): Three.Mesh;
  meshes: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>[];
  focus(id: string, box: [number[], number[]] | null, amount?: number): void;
  dimOne(id: string, amount: number): void;
  grow(id: string, slice: number | null, fraction?: number, axis?: number): void;
  front(id: string, axis: number, from: number, to: number, fraction: number, slice: number): void;
  setColor(component: string, colors: [string, string]): void;
}
export interface MasterParts {
  three: typeof Three;
  demo: MatrixDemo;
  tensors: Map<string, PartTensor>;
  layoutBlocks: Map<string, PartBlock>;
  layoutArrows: PartArrow[];
  epsilon: number;
  limit: number;
  shapeOf(tensor: PartTensor, orientation: string): PartShape;
  makeFlowLook(options: { px: number; minPx: number; viewH: number; fine: number; slabs: string }): PartLook;
}

export const WORDS = ["春天", "来了", "，", "花儿", "都", "开了"];
export const FFN_STEPS: { id: FfnStep; label: string }[] = [
  { id: "gate", label: "① gate 投影" },
  { id: "up", label: "② up 投影" },
  { id: "multiply", label: "③ 门控相乘" },
  { id: "down", label: "④ down 投影" },
];

export function partTensorIds(kind: MatrixPartKind, step: FfnStep): string[] {
  if (kind === "rms") return ["collapsed_attn", "gamma_attn", "x_attn"];
  if (kind === "mhc") return ["residual_mid", "pre_ffn", "collapsed_ffn"];
  if (step === "multiply") return ["gate_ffn", "up_ffn", "h_ffn"];
  if (step === "down") return ["h_ffn", "W_down", "ffn_out"];
  return ["x_ffn", `W_${step}`, `${step}_ffn`];
}

export function channelCount(kind: MatrixPartKind, step: FfnStep): number {
  return kind === "ffn" && step !== "down" ? 12288 : 4096;
}

export interface PartInspection {
  count: number;
  terms: { index: number; input: number; weight: number }[];
  calculated: number;
  stored: number;
  rms?: number;
  meanSquare?: number;
  gamma?: number;
  input?: number;
  gate?: number;
  up?: number;
}

export const RMS_GROUPS = 16;

export function rmsColumn(demo: MatrixDemo, word: number, epsilon: number) {
  const values = demo.get("collapsed_attn");
  const count = values.shape[1]!;
  const levels = [
    Array.from({ length: RMS_GROUPS }, (_, group) => {
      let sum = 0;
      for (
        let i = Math.floor((group * count) / RMS_GROUPS);
        i < Math.floor(((group + 1) * count) / RMS_GROUPS);
        i++
      )
        sum += values.a[word * count + i]! ** 2;
      return sum;
    }),
  ];
  while (levels.at(-1)!.length > 1) {
    const previous = levels.at(-1)!;
    levels.push(
      Array.from({ length: previous.length / 2 }, (_, i) => previous[i * 2]! + previous[i * 2 + 1]!),
    );
  }
  const sum = levels.at(-1)![0]!;
  const meanSquare = sum / count;
  return { count, levels, sum, meanSquare, rms: Math.sqrt(meanSquare + epsilon) };
}

export function inspectPart(
  demo: MatrixDemo,
  kind: MatrixPartKind,
  step: FfnStep,
  word: number,
  channel: number,
  epsilon: number,
  limit: number,
): PartInspection {
  if (kind === "rms") {
    const { count, meanSquare, rms } = rmsColumn(demo, word, epsilon);
    const input = demo.at("collapsed_attn", word, channel);
    const gamma = demo.weight("gamma_attn", channel);
    return {
      count,
      input,
      gamma,
      rms,
      meanSquare,
      terms: [],
      calculated: (input / rms) * gamma,
      stored: demo.at("x_attn", word, channel),
    };
  }
  if (kind === "mhc") {
    const terms = Array.from({ length: 4 }, (_, stream) => ({
      index: stream,
      input: demo.at("residual_mid", word, stream, channel),
      weight: demo.at("coef_ffn", word, stream),
    }));
    return {
      count: 4,
      terms,
      calculated: terms.reduce((sum, term) => sum + term.input * term.weight, 0),
      stored: demo.at("collapsed_ffn", word, channel),
    };
  }
  if (step === "multiply") {
    const gate = Math.min(demo.at("gate_ffn", word, channel), limit);
    const up = Math.max(-limit, Math.min(demo.at("up_ffn", word, channel), limit));
    return {
      count: 1,
      terms: [],
      gate,
      up,
      calculated: (gate / (1 + Math.exp(-gate))) * up,
      stored: demo.at("h_ffn", word, channel),
    };
  }
  const [input, weight, output] = partTensorIds(kind, step) as [string, string, string];
  const count = demo.get(input).shape[1]!;
  let calculated = 0;
  const terms: PartInspection["terms"] = [];
  for (let index = 0; index < count; index++) {
    const x = demo.at(input, word, index);
    const w = demo.weight(weight, channel, index);
    calculated += x * w;
    if (index < 3 || index === count - 1) terms.push({ index, input: x, weight: w });
  }
  return { count, terms, calculated, stored: demo.at(output, word, channel) };
}

export function layoutForPart(source: MasterParts, kind: MatrixPartKind, step: FfnStep) {
  const names: Record<string, string> = {
    collapsed_attn: "输入 x",
    gamma_attn: "参数 γ",
    x_attn: "输出 y",
    residual_mid: "4 路残差",
    pre_ffn: "本词的 4 个 pre",
    collapsed_ffn: "读出 1 路",
    x_ffn: "前馈输入 x",
    gate_ffn: "gate",
    up_ffn: "up",
    h_ffn: "门控后的 h",
    ffn_out: "前馈输出",
  };
  const blocks = partTensorIds(kind, step).map((id) => {
    const original = source.tensors.get(id === "pre_ffn" ? "coef_ffn" : id);
    if (!original) throw new Error(`找不到矩阵 ${id}`);
    const tensor: PartTensor = {
      ...original,
      id,
      name: names[id] ?? original.name,
      ...(id === "pre_ffn" ? { cols: 4, shape: [6, 4] } : {}),
    };
    const native = source.layoutBlocks.get(id === "pre_ffn" ? "coef_ffn" : id);
    if (!native) throw new Error(`找不到矩阵布局 ${id}`);
    const block: PartBlock = {
      ...native,
      id,
      t: tensor,
    };
    if (id === "pre_ffn") {
      const shape = source.shapeOf(tensor, native.orient);
      Object.assign(block, shape, { y0: native.y1 - shape.h, z0: -shape.d });
    }
    return block;
  });
  const ids = new Set(blocks.map((block) => block.id));
  const arrows = source.layoutArrows
    .map((arrow) => ({
      ...arrow,
      from: arrow.from === "coef_ffn" ? "pre_ffn" : arrow.from,
      to: arrow.to === "coef_ffn" ? "pre_ffn" : arrow.to,
      pts: arrow.pts.map((point) => [...point]),
    }))
    .filter((arrow) => ids.has(arrow.from) && ids.has(arrow.to) && arrow.to !== "pre_ffn");
  if (kind === "rms") {
    const [input, gamma, output] = blocks as [PartBlock, PartBlock, PartBlock];
    // Reposition the native blocks without flattening or stretching their geometry.
    const width = input.x1 - input.x0;
    const height = input.y1 - input.y0;
    const gammaWidth = gamma.x1 - gamma.x0;
    Object.assign(input, { x0: 0, x1: width, y0: 0, y1: height });
    Object.assign(output, { x0: width * 2, x1: width * 3 });
    output.y0 = gamma.y0 = input.y0;
    output.y1 = gamma.y1 = input.y1;
    Object.assign(gamma, { x0: width * 1.5 - gammaWidth / 2, x1: width * 1.5 + gammaWidth / 2 });
    const y = (input.y0 + input.y1) / 2;
    return {
      blocks,
      arrows: [
        {
          from: input.id,
          to: output.id,
          pts: [
            [input.x1 + 0.9, y],
            [output.x0 - 0.9, y],
          ],
        },
      ],
    };
  }
  if (kind === "ffn" && step === "up") {
    // Removing the gate projection leaves its width as empty space; move the shared input next to W_up.
    const [input, weight, output] = blocks as [PartBlock, PartBlock, PartBlock];
    const shift = weight.x1 + 8 - input.x0;
    input.x0 += shift;
    input.x1 += shift;
    arrows.push({
      from: input.id,
      to: output.id,
      pts: [
        [(input.x0 + input.x1) / 2, input.y0 - 0.9],
        [(input.x0 + input.x1) / 2, (output.y0 + output.y1) / 2],
        [output.x1 + 0.9, (output.y0 + output.y1) / 2],
      ],
    });
  }
  return { blocks, arrows };
}

export function wordFocus(block: PartBlock, word: number): [number[], number[]] {
  return block.orient === "row"
    ? [
        [0, word, 0],
        [block.div[0], word + 1, block.div[2]],
      ]
    : [
        [word, 0, 0],
        [word + 1, block.div[1], block.div[2]],
      ];
}

export function pickPartCell(
  block: PartBlock,
  fraction: { x: number; y: number },
  current: { word: number; channel: number },
  kind: MatrixPartKind,
  step: FfnStep,
) {
  const index = (value: number, count: number) => Math.min(count - 1, Math.max(0, Math.floor(value * count)));
  const word =
    block.kind === "data"
      ? index(block.orient === "row" ? fraction.y : fraction.x, block.t.rows.n)
      : current.word;
  const dotInput = kind === "ffn" && step !== "multiply" && block.id === partTensorIds(kind, step)[0];
  const channel =
    block.id === "pre_ffn" || dotInput
      ? current.channel
      : index(
          block.orient === "row" || block.orient === "wt" || block.orient === "bar" ? fraction.x : fraction.y,
          block.t.cols,
        );
  return { word, channel };
}
