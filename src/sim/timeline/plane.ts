/**
 * 张量 → 二维平面视图：高亮校验与 3D 显示共用的轴选择规则（单一真相源）。
 *
 * 规则（与 validate.ts 的高亮判定同源）：
 * - 带头维（dims 里名为 n_q / n_kv 的轴）时跳过头维；
 * - 在剩余轴中取首轴为行、末轴为列；
 * - 中间多余的轴（如 KV Cache 的 K|V 轴）必须显式给下标，默认取 0。
 *
 * 这样 [S,n_q,d_h] 取某个头后是 [S,d_h]，[n_q,S,S_k] 取某个头后是 [S,S_k]，
 * [S,K|V,n_kv,d_h] 取某个头与 K/V 后是 [S,d_h]。
 */
import { strides } from "../tensor/tensor";
import { weightAt } from "../weights";
import type { TensorRecord } from "./types";

/** 教学维度名中表示「头」的符号（见 tensor.ts 的 dims 约定） */
export const HEAD_DIMS: ReadonlySet<string> = new Set(["n_q", "n_kv"]);

/** 头维所在轴，无则 -1 */
export function headAxis(dims: readonly string[]): number {
  return dims.findIndex((d) => HEAD_DIMS.has(d));
}

export interface PlaneAxes {
  /** 行轴下标 */
  row: number;
  /** 列轴下标 */
  col: number;
  /** 行列与头维之外、需要额外下标的轴 */
  extra: number[];
  /** 头维轴下标；未启用或不存在时为 -1 */
  head: number;
}

/** withHead=true 时跳过头维取行列轴；false 时把头维当普通轴（与旧的高亮校验语义一致）。 */
export function planeAxes(dims: readonly string[], withHead: boolean): PlaneAxes {
  const head = withHead ? headAxis(dims) : -1;
  const axes = dims.map((_, i) => i).filter((i) => i !== head);
  const row = axes[0] ?? 0;
  const col = axes[axes.length - 1] ?? row;
  return { row, col, extra: axes.slice(1, -1), head };
}

export interface PlaneView {
  rows: number;
  cols: number;
  rowDim: string;
  colDim: string;
  /** 行列取值；权重走 weightAt 随机访问，稠密张量走 data */
  at(r: number, c: number): number;
  /** 权重的下采样缩略图（全幅平面纹理用），稠密张量没有 */
  thumb?: { rows: number; cols: number; data: Float32Array } | undefined;
  /** 头维长度；无头维为 0 */
  heads: number;
  /** 实际使用的头下标；无头维为 -1 */
  head: number;
  axes: PlaneAxes;
  /** extra 轴实际取的下标，与 axes.extra 一一对应 */
  picks: number[];
  /** 该视图是否只是整张张量的一个切片 */
  sliced: boolean;
}

/**
 * 把任意登记张量映射成一个二维视图。
 * sel.head 越界时夹到合法范围；sel.picks 按 axes.extra 顺序给出，缺省为 0。
 */
export function planeView(
  rec: TensorRecord,
  sel: { head?: number | undefined; picks?: number[] | undefined } = {},
): PlaneView {
  const dims = rec.dims;
  const shape = rec.shape;

  // 惰性权重：没有 data，逐元素随机访问；缩略图给全幅纹理用
  if (rec.lazy) {
    const [rows, cols] = rec.lazy.shape;
    const w = rec.lazy;
    return {
      rows,
      cols,
      rowDim: dims[0] ?? "行",
      colDim: dims[1] ?? "列",
      at: (r, c) => weightAt(w, r, c),
      thumb: rec.thumb,
      heads: 0,
      head: -1,
      axes: { row: 0, col: 1, extra: [], head: -1 },
      picks: [],
      sliced: false,
    };
  }

  const data = rec.data;
  if (!data) throw new Error(`张量 ${rec.id} 既无 data 也无 lazy，无法显示`);

  // 一维张量（token id 序列）当成一行
  if (shape.length === 1) {
    const cols = shape[0] ?? 0;
    return {
      rows: 1,
      cols,
      rowDim: "单行",
      colDim: dims[0] ?? "列",
      at: (_r, c) => data[c] ?? 0,
      heads: 0,
      head: -1,
      axes: { row: 0, col: 0, extra: [], head: -1 },
      picks: [],
      sliced: false,
    };
  }

  const hasHead = headAxis(dims) >= 0;
  const axes = planeAxes(dims, hasHead);
  const st = strides(shape);
  const heads = axes.head >= 0 ? (shape[axes.head] ?? 0) : 0;
  const head = heads > 0 ? Math.min(Math.max(sel.head ?? 0, 0), heads - 1) : -1;
  const picks = axes.extra.map((axis, i) =>
    Math.min(Math.max(sel.picks?.[i] ?? 0, 0), (shape[axis] ?? 1) - 1),
  );

  let base = head >= 0 ? head * (st[axes.head] ?? 0) : 0;
  axes.extra.forEach((axis, i) => {
    base += (picks[i] ?? 0) * (st[axis] ?? 0);
  });
  const rs = st[axes.row] ?? 1;
  const cs = st[axes.col] ?? 1;

  return {
    rows: shape[axes.row] ?? 0,
    cols: shape[axes.col] ?? 0,
    rowDim: dims[axes.row] ?? "行",
    colDim: dims[axes.col] ?? "列",
    at: (r, c) => data[base + r * rs + c * cs] ?? 0,
    heads,
    head,
    axes,
    picks,
    sliced: head >= 0 || axes.extra.length > 0,
  };
}
