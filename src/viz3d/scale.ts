/**
 * 3D 显示尺度：真实形状 → 屏幕上能看的平面尺寸、纹理采样、色阶、放大窗口。
 * 全是纯函数，可单测；组件只负责把结果画出来。
 *
 * 显示纵横比是**显示手段**，不是真实比例：[6,3072] 的真实行列比 512:1，
 * 按真值画只有半个像素高。这里做单调压缩，组件必须同时把真实 shape 打在标签上。
 */

/** 幂压缩指数：a^0.75，弱化极端比例但保序 */
export const ASPECT_EXP = 0.75;
/** 拐点：超过这个显示比后改用对数增长，避免所有极扁张量压成同一形状 */
export const ASPECT_KNEE = 12;
/** 拐点后的对数斜率：每翻一倍再加 25% */
export const ASPECT_KNEE_SLOPE = 0.25;
/** 平面最短边（世界单位）：再扁也要看得见纹理 */
export const MIN_SIDE = 0.4;
/** 单轴纹理上限：超过按 stride 下采样 */
export const MAX_TEX_AXIS = 1024;
/** 绝对值超过它的视为哨兵（因果掩码的 −1e30），不参与色阶 */
export const MASK_SENTINEL = 1e29;

import type { Highlight } from "../sim/timeline/types";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * 真实行列比 → 显示行列比。单调递增：不同的真实比例永远得到不同的显示比例，
 * 只是差距被压缩（170:1 → 约 17.9:1，512:1 → 约 21.5:1）。
 */
export function displayAspect(rows: number, cols: number): number {
  if (rows <= 0 || cols <= 0) return 1;
  const a = cols / rows;
  const flip = a < 1;
  const x = flip ? 1 / a : a;
  let y = x ** ASPECT_EXP;
  if (y > ASPECT_KNEE) y = ASPECT_KNEE * (1 + ASPECT_KNEE_SLOPE * Math.log2(y / ASPECT_KNEE));
  return flip ? 1 / y : y;
}

export interface PlaneBox {
  maxW: number;
  maxH: number;
  /** 最短边下限，默认 MIN_SIDE */
  minSide?: number;
}

export interface PlaneSize {
  w: number;
  h: number;
  /** 实际画出来的行列比 */
  aspect: number;
  /** 真实行列比，用于标签文案 */
  trueAspect: number;
  /** 显示比例是否被压缩（需要在标签上说明） */
  compressed: boolean;
}

/** 在给定包围盒内按压缩后的比例铺开平面。 */
export function planeSize(rows: number, cols: number, box: PlaneBox): PlaneSize {
  const aspect = displayAspect(rows, cols);
  const minSide = box.minSide ?? MIN_SIDE;
  let w = box.maxW;
  let h = w / aspect;
  if (h > box.maxH) {
    h = box.maxH;
    w = h * aspect;
  }
  w = Math.max(w, minSide);
  h = Math.max(h, minSide);
  const trueAspect = rows > 0 ? cols / rows : 1;
  return { w, h, aspect, trueAspect, compressed: Math.abs(Math.log(aspect / trueAspect)) > 0.05 };
}

export interface AxisSample {
  /** 采样后的长度 */
  count: number;
  /** 是否逐格对应（没有下采样） */
  exact: boolean;
  /** 采样下标 i → 原始下标 */
  index(i: number): number;
}

/** 按 stride 下采样一根轴（与 weightThumb 同规则）。 */
export function sampleAxis(n: number, max: number): AxisSample {
  const count = Math.max(1, Math.min(n, max));
  const exact = count === n;
  return { count, exact, index: exact ? (i) => i : (i) => Math.floor((i * n) / count) };
}

export interface ValueScale {
  /** 色阶基准：|v| = scale 时达到满色 */
  scale: number;
  /** 数据里含哨兵（掩码）值 */
  hasMask: boolean;
  /** 参与统计的样本数 */
  samples: number;
}

/**
 * 稳健色阶：忽略哨兵值，取 |v| 的 99.5 分位。
 * 直接用 absMax 会被因果掩码的 1e30 毁掉（整张图除掩码格外全黑）。
 */
export function robustScale(at: (i: number) => number, n: number, maxSamples = 4096): ValueScale {
  const step = Math.max(1, Math.ceil(n / maxSamples));
  const vals: number[] = [];
  let hasMask = false;
  for (let i = 0; i < n; i += step) {
    const v = Math.abs(at(i));
    if (!Number.isFinite(v)) continue;
    if (v >= MASK_SENTINEL) {
      hasMask = true;
      continue;
    }
    vals.push(v);
  }
  if (vals.length === 0) return { scale: 1, hasMask, samples: 0 };
  vals.sort((a, b) => a - b);
  const q = vals[Math.min(vals.length - 1, Math.floor(0.995 * (vals.length - 1)))] ?? 0;
  const max = vals[vals.length - 1] ?? 0;
  const scale = q > 0 ? q : max > 0 ? max : 1;
  return { scale, hasMask, samples: vals.length };
}

export interface Rect {
  r0: number;
  c0: number;
  rows: number;
  cols: number;
}

/** 与 sim/timeline/types 的 Highlight 同结构，这里只用行列格 */
export type Focus = Pick<Highlight, "rows" | "cols" | "cells">;

/**
 * 放大窗口的对准点：第一个高亮行 / 列 / 格。
 * 不取均值：embed.gather 高亮的 6 个词表行散布在 0..151936，均值处一个都框不住。
 */
export function focusCenter(focus: Focus | undefined): { r: number; c: number } {
  const cell = focus?.cells?.[0];
  return { r: focus?.rows?.[0] ?? cell?.[0] ?? 0, c: focus?.cols?.[0] ?? cell?.[1] ?? 0 };
}

/** 放大窗口：以高亮为中心截一块，贴边时整体夹回张量范围内。 */
export function windowRect(
  view: { rows: number; cols: number },
  focus: Focus | undefined,
  win: { rows: number; cols: number },
): Rect {
  const rows = Math.max(1, Math.min(win.rows, view.rows));
  const cols = Math.max(1, Math.min(win.cols, view.cols));
  const c = focusCenter(focus);
  const r0 = clamp(Math.round(c.r - (rows - 1) / 2), 0, view.rows - rows);
  const c0 = clamp(Math.round(c.c - (cols - 1) / 2), 0, view.cols - cols);
  return { r0, c0, rows, cols };
}

/** 窗口在全幅平面上的归一化位置（0..1，左上角为原点），用于画取景框。 */
export function rectUv(rect: Rect, view: { rows: number; cols: number }): [number, number, number, number] {
  return [
    rect.c0 / view.cols,
    rect.r0 / view.rows,
    (rect.c0 + rect.cols) / view.cols,
    (rect.r0 + rect.rows) / view.rows,
  ];
}

/** 数值文案：格值标签用，短且等宽 */
export function fmtCell(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= MASK_SENTINEL) return "−∞";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1000 || a < 0.001) return v.toExponential(1);
  return v.toFixed(a >= 10 ? 1 : 2);
}

/** 真实比例文案：512:1 / 1:8.4 */
export function fmtAspect(trueAspect: number): string {
  return trueAspect >= 1
    ? `${trueAspect.toFixed(trueAspect >= 10 ? 0 : 1)}:1`
    : `1:${(1 / trueAspect).toFixed(1)}`;
}
