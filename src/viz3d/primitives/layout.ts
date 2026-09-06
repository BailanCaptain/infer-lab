/**
 * TensorGrid 的布局（纯函数）：平面、放大窗口、标签车道在局部坐标里的位置与总包围盒。
 * TensorGrid 用它摆东西，相机/页面用它取景——同一份数字，不会出现"图元长高了相机没跟上"。
 */
import type { Highlight } from "../../sim/timeline/types";
import { type PlaneBox, type PlaneSize, planeSize, type Rect, windowRect } from "../scale";

/** 平面与放大窗口之间的空档，同时是标签车道 */
export const GAP = 0.52;
/** 窗口上方：标题、形状两行标签占的高度 */
export const TOP_LANE = 0.72;
/** 平面下方：列维 + 最多三条说明 */
export const BOTTOM_LANE = 1.15;
/** 左右车道：行维竖排标签与窗口范围标签 */
export const SIDE_LANE = 1.4;

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
): GridLayout {
  const size = planeSize(view.rows, view.cols, box);
  const rect = windowRect(view, highlight, win);
  const winW = rect.cols * cellSize;
  const winH = rect.rows * cellSize;
  const winY = size.h / 2 + GAP + winH / 2;
  const top = winY + winH / 2 + TOP_LANE;
  const bottom = -size.h / 2 - BOTTOM_LANE;
  const halfW = Math.max(size.w / 2, winW / 2) + SIDE_LANE;
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
