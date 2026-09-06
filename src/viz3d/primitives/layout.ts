/**
 * TensorGrid 的布局（纯函数）：平面、放大窗口、标签车道在局部坐标里的位置与总包围盒。
 * TensorGrid 用它摆东西，相机/页面用它取景——同一份数字，不会出现"图元长高了相机没跟上"。
 */
import { shapeLabel } from "../../sim/tensor/tensor";
import type { PlaneView } from "../../sim/timeline/plane";
import type { Highlight, TensorRecord } from "../../sim/timeline/types";
import { LABEL_SIZE, textWidth } from "../labels/sizes";
import { type PlaneBox, type PlaneSize, planeSize, type Rect, windowRect } from "../scale";

/** 一个 TensorGrid 的三行文案：标题、真实形状、窗口范围与切片 */
export interface GridTexts {
  title: string;
  shape: string;
  range: string;
}

export function gridTexts(args: {
  record: TensorRecord;
  view: PlaneView;
  rect: Rect;
  title?: string | undefined;
}): GridTexts {
  const { record, view, rect } = args;
  const rowText =
    rect.rows < view.rows
      ? `行 ${rect.r0}–${rect.r0 + rect.rows - 1} ⋯ 共 ${view.rows}`
      : `行 0–${view.rows - 1}`;
  const colText =
    rect.cols < view.cols
      ? `列 ${rect.c0}–${rect.c0 + rect.cols - 1} ⋯ 共 ${view.cols}`
      : `列 0–${view.cols - 1}`;
  const slice: string[] = [];
  if (view.heads > 0) slice.push(`头 ${view.head}/${view.heads - 1}`);
  view.axes.extra.forEach((axis, i) => {
    slice.push(`${record.dims[axis] ?? "轴"}=${view.picks[i] ?? 0}`);
  });
  return {
    title: args.title ?? record.name,
    shape: shapeLabel(record),
    range: [rowText, colText, ...slice].join(" · "),
  };
}

/** 平面与放大窗口之间的空档：窗口范围标签走这里（labelScale=1 时） */
export const GAP = 0.56;
/** 窗口上方：标题、形状两行标签 */
export const TOP_LANE = 0.76;
/** 平面下方：列维标签（长说明进 DOM，见 notes.ts） */
export const BOTTOM_LANE = 0.5;
/** 左侧：竖排行维标签 */
export const SIDE_LANE = 0.45;

export interface GridLayout {
  size: PlaneSize;
  rect: Rect;
  winW: number;
  winH: number;
  /** 窗口中心 y（平面中心为原点） */
  winY: number;
  /** 局部包围盒 */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** 包围盒中心与高宽，给相机取景 */
  centerY: number;
  height: number;
  width: number;
}

export function gridLayout(
  view: { rows: number; cols: number },
  highlight: Highlight | undefined,
  box: PlaneBox,
  win: { rows: number; cols: number },
  cellSize: number,
  /** 标签放大倍数（相机远时字要大，车道跟着变宽） */
  labelScale = 1,
  /** 标签文案：包围盒要装下最宽的一行 */
  texts?: GridTexts,
): GridLayout {
  const size = planeSize(view.rows, view.cols, box);
  const rect = windowRect(view, highlight, win);
  const winW = rect.cols * cellSize;
  const winH = rect.rows * cellSize;
  const winY = size.h / 2 + GAP * labelScale + winH / 2;
  const top = winY + winH / 2 + TOP_LANE * labelScale;
  const bottom = -size.h / 2 - BOTTOM_LANE * labelScale;
  const textW = texts
    ? Math.max(
        textWidth(texts.title, LABEL_SIZE.title * labelScale),
        textWidth(texts.shape, LABEL_SIZE.micro * labelScale),
        textWidth(texts.range, LABEL_SIZE.micro * labelScale),
      )
    : 0;
  const halfW = Math.max(size.w / 2, winW / 2, textW / 2) + SIDE_LANE * labelScale;
  return {
    size,
    rect,
    winW,
    winH,
    winY,
    top,
    bottom,
    left: -halfW,
    right: halfW,
    centerY: (top + bottom) / 2,
    height: top - bottom,
    width: halfW * 2,
  };
}

/**
 * 让相机刚好装下包围盒：沿给定方向退到能同时容纳高与宽的距离。
 * fovDeg 是竖直视场；aspect 是画布宽高比。
 */
export function frameDistance(
  layout: Pick<GridLayout, "height" | "width">,
  fovDeg: number,
  aspect: number,
  margin = 1.12,
): number {
  const halfV = Math.tan((fovDeg * Math.PI) / 360);
  const halfH = halfV * aspect;
  return Math.max(layout.height / 2 / halfV, layout.width / 2 / halfH) * margin;
}
