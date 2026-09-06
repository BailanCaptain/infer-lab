/**
 * 一步的 3D 场景布局（纯函数）：把 step.model.op 的 a / b / out 摆成能看懂"在算什么"的构图。
 * - matmul：A 左、B 上、C 右下的 L 形；按 beats 先亮 B 列、再亮 A 行、最后 C 格出现；
 * - 其余算子：输入在左（多个则上下堆叠）、输出在右。
 * 场景与相机共用这一份布局（包围盒 → 相机距离），图元长高了相机一定跟上。
 */
import { planeView } from "../../sim/timeline/plane";
import type { Highlight, Step, TensorRecord, Timeline } from "../../sim/timeline/types";
import { LAB_FOV, type ViewPreset, viewPreset } from "../camera/views";
import { frameDistance, type GridLayout, gridLayout, gridTexts } from "../primitives/layout";
import { type PlaneBox, windowRect } from "../scale";

export type SlotKey = "a" | "b" | "out";

export interface SlotSpec {
  key: SlotKey;
  /** 给标题用的角色词 */
  role: "输入" | "权重" | "输出" | "输入②";
  record: TensorRecord;
  highlight: Highlight | undefined;
  position: [number, number, number];
  box: PlaneBox;
  window: { rows: number; cols: number };
  cellSize: number;
  /** 高亮在步内的渐入区间（progress.t） */
  hiWindow: [number, number];
  layout: GridLayout;
  labelScale: number;
  /** 图元标题（角色 · 教学名） */
  title: string;
}

export interface SceneLayout {
  kind: "matmul" | "op";
  slots: SlotSpec[];
  center: [number, number, number];
  width: number;
  height: number;
}

const MATMUL_BOX: PlaneBox = { maxW: 3.6, maxH: 1.5 };
const MATMUL_WIN = { rows: 4, cols: 8 };
const OP_BOX: PlaneBox = { maxW: 4.2, maxH: 1.6 };
const OP_WIN = { rows: 6, cols: 10 };
const CELL = 0.15;
/** 图元之间的空档 */
const GUTTER = 0.65;
/** 标签随相机距离放大：距离 / 该值 = 倍数，夹在 [1, LABEL_SCALE_MAX] */
const LABEL_REF_DISTANCE = 15;
const LABEL_SCALE_MAX = 1.6;

function slot(
  key: SlotKey,
  role: SlotSpec["role"],
  record: TensorRecord,
  highlight: Highlight | undefined,
  box: PlaneBox,
  window: { rows: number; cols: number },
  hiWindow: [number, number],
  labelScale: number,
): Omit<SlotSpec, "position"> {
  const view = planeView(record, { head: highlight?.head ?? 0 });
  const title = `${role} · ${record.name}`;
  const texts = gridTexts({ record, view, rect: windowRect(view, highlight, window), title });
  return {
    title,
    key,
    role,
    record,
    highlight,
    box,
    window,
    cellSize: CELL,
    hiWindow,
    layout: gridLayout(view, highlight, box, window, CELL, labelScale, texts),
    labelScale,
  };
}

function place(s: Omit<SlotSpec, "position">, x: number, y: number): SlotSpec {
  return { ...s, position: [x, y, 0] };
}

function finish(kind: SceneLayout["kind"], slots: SlotSpec[]): SceneLayout {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const s of slots) {
    minX = Math.min(minX, s.position[0] + s.layout.left);
    maxX = Math.max(maxX, s.position[0] + s.layout.right);
    minY = Math.min(minY, s.position[1] + s.layout.bottom);
    maxY = Math.max(maxY, s.position[1] + s.layout.top);
  }
  return {
    kind,
    slots,
    center: [(minX + maxX) / 2, (minY + maxY) / 2, 0],
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function sceneLayout(step: Step, tensors: Timeline["tensors"], labelScale = 1): SceneLayout {
  const ls = labelScale;
  const op = step.model.op;
  const hl = (id: string | undefined) => step.model.highlight.find((h) => h.tensor === id);
  const rec = (id: string | undefined) => (id ? tensors[id] : undefined);

  const a = rec(op?.a);
  const b = rec(op?.b);
  const out = rec(op?.out) ?? rec(step.model.tensors[step.model.tensors.length - 1]);
  if (!out) throw new Error(`步骤 ${step.id} 没有可显示的张量`);

  if (op?.kind === "matmul" && a && b) {
    const A = slot("a", "输入", a, hl(a.id), MATMUL_BOX, MATMUL_WIN, [0.3, 0.6], ls);
    const B = slot("b", "权重", b, hl(b.id), MATMUL_BOX, MATMUL_WIN, [0, 0.3], ls);
    const C = slot("out", "输出", out, hl(out.id), MATMUL_BOX, MATMUL_WIN, [0.85, 1], ls);
    // C 在右下；B 在 C 正上方（列对齐）；A 在 C 左边（行对齐）
    const cx = 0;
    const cy = 0;
    const by = cy + C.layout.top + GUTTER - B.layout.bottom;
    const ax = cx + C.layout.left - GUTTER - A.layout.right;
    return finish("matmul", [place(A, ax, cy), place(B, cx, by), place(C, cx, cy)]);
  }

  const inputs: Omit<SlotSpec, "position">[] = [];
  if (a && a.id !== out.id) inputs.push(slot("a", "输入", a, hl(a.id), OP_BOX, OP_WIN, [0, 0.4], ls));
  if (b && b.id !== out.id) inputs.push(slot("b", "输入②", b, hl(b.id), OP_BOX, OP_WIN, [0, 0.4], ls));
  const O = slot("out", "输出", out, hl(out.id), OP_BOX, OP_WIN, [0.5, 1], ls);

  const slots: SlotSpec[] = [];
  const ox = 0;
  // 输入在左，上下堆叠；输出在右，垂直居中
  let y = 0;
  const heights = inputs.map((s) => s.layout.top - s.layout.bottom);
  const total = heights.reduce((p, h) => p + h, 0) + Math.max(0, inputs.length - 1) * GUTTER;
  y = total / 2;
  const inputRight = Math.max(0, ...inputs.map((s) => s.layout.right));
  const ix = ox + O.layout.left - GUTTER - inputRight;
  inputs.forEach((s, i) => {
    const h = heights[i] ?? 0;
    const cy = y - s.layout.top;
    slots.push(place(s, ix, cy));
    y -= h + GUTTER;
  });
  slots.push(place(O, ox, 0));
  return finish("op", slots);
}

/** 按 timeline + step id + labelScale 缓存，场景组件与相机导演拿到同一个对象 */
const cache = new WeakMap<Timeline, Map<string, SceneLayout>>();

export function getSceneLayout(step: Step, timeline: Timeline, labelScale = 1): SceneLayout {
  let m = cache.get(timeline);
  if (!m) {
    m = new Map();
    cache.set(timeline, m);
  }
  const key = `${step.id}|${labelScale.toFixed(2)}`;
  let l = m.get(key);
  if (!l) {
    l = sceneLayout(step, timeline.tensors, labelScale);
    m.set(key, l);
  }
  return l;
}

export interface ResolvedScene {
  layout: SceneLayout;
  view: ViewPreset;
  /** 相机到目标的距离 */
  distance: number;
  labelScale: number;
}

/**
 * 场景 + 相机一起求解：先按 labelScale=1 算相机距离，据此放大标签与车道，再算一次距离。
 * 场景组件与 CameraDirector 都从这里取，保证字号、车道、取景一致。
 */
export function resolveScene(step: Step, timeline: Timeline, aspect: number): ResolvedScene {
  const view = viewPreset(step.camera.view);
  const first = getSceneLayout(step, timeline, 1);
  const d1 = frameDistance(first, LAB_FOV, aspect, view.margin);
  const labelScale = Math.round(Math.min(LABEL_SCALE_MAX, Math.max(1, d1 / LABEL_REF_DISTANCE)) * 20) / 20;
  const layout = getSceneLayout(step, timeline, labelScale);
  const distance = frameDistance(layout, LAB_FOV, aspect, view.margin);
  return { layout, view, distance, labelScale };
}
