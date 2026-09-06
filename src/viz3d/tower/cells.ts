/**
 * 格子体的数据准备（纯函数）：把一个二维视图按 merge×merge 合并成格子，每格取块均值，
 * 并给出色阶。1 世界单位 = 1 个元素；合并后一格边长 = merge 单位，所以体量永远按真实维度画。
 */
import type { PlaneView } from "../../sim/timeline/plane";
import { MASK_SENTINEL, robustScale, type ValueScale } from "../scale";

export interface CellGrid {
  /** 合并后的行列数 */
  rows: number;
  cols: number;
  /** 每格代表 merge×merge 个元素（1 = 不合并） */
  merge: number;
  /** 行优先的格值（块均值；块内含掩码哨兵则整格为哨兵） */
  values: Float32Array;
  scale: ValueScale;
}

/** 选合并倍数：让格数不超过 maxCells，且是 2 的幂（1/2/4/8/16/32） */
export function pickMerge(rows: number, cols: number, maxCells: number): number {
  let m = 1;
  while (Math.ceil(rows / m) * Math.ceil(cols / m) > maxCells && m < 64) m *= 2;
  return m;
}

export function cellGrid(view: Pick<PlaneView, "rows" | "cols" | "at">, merge: number): CellGrid {
  const rows = Math.ceil(view.rows / merge);
  const cols = Math.ceil(view.cols / merge);
  const values = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const r0 = r * merge;
    const r1 = Math.min(view.rows, r0 + merge);
    for (let c = 0; c < cols; c++) {
      const c0 = c * merge;
      const c1 = Math.min(view.cols, c0 + merge);
      let sum = 0;
      let n = 0;
      let masked = false;
      for (let i = r0; i < r1 && !masked; i++)
        for (let j = c0; j < c1; j++) {
          const v = view.at(i, j);
          if (Math.abs(v) >= MASK_SENTINEL) {
            masked = true;
            break;
          }
          sum += v;
          n++;
        }
      values[r * cols + c] = masked ? -MASK_SENTINEL * 10 : n ? sum / n : 0;
    }
  }
  const scale = robustScale((i) => values[i] ?? 0, values.length);
  return { rows, cols, merge, values, scale };
}
