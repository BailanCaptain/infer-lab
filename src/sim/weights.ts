/**
 * 惰性权重：不存储、不下载。每个元素由 (张量 id, 行, 列) 哈希决定，任何位置随机访问都一致，
 * matmul 与 3D 显示读到的是同一个数。
 *
 * [A01] 教学假设：权重取均匀分布 U(−√3σ, √3σ)（方差 σ²，σ = initializer_range，HF 用 N(0, σ²) 初始化）。
 *       形状是真实模型，数值不是 checkpoint 输出，只用于观察机制。
 * 数学约定：W 的形状写作 [in, out]，y = x · W；HF 的 nn.Linear 存储为 [out, in]（转置），页面会同时标注。
 */
import { hashString, mixSeed } from "./rng";

export interface LazyWeight {
  id: string;
  /** [in, out] */
  shape: [number, number];
  dims: [string, string];
  std: number;
  seed: number;
}

export function lazyWeight(
  id: string,
  shape: [number, number],
  dims: [string, string],
  std: number,
): LazyWeight {
  return { id, shape, dims, std, seed: hashString(id) };
}

const SQRT3 = Math.sqrt(3);

/** 元素 (i, j)，i∈[0,in)，j∈[0,out) */
export function weightAt(w: LazyWeight, i: number, j: number): number {
  const cols = w.shape[1];
  const h = mixSeed(w.seed, Math.imul(i, cols) + j);
  // 32 位 → [−1, 1) → 乘 √3σ
  return ((h / 2147483648 - 1) * SQRT3 * w.std) as number;
}

/** 填充第 j 列（长度 in），供 matmul 逐列计算复用 */
export function weightColumn(w: LazyWeight, j: number, out: Float32Array): void {
  const rows = w.shape[0];
  const cols = w.shape[1];
  const seed = w.seed;
  const k = SQRT3 * w.std;
  for (let i = 0; i < rows; i++) {
    const h = mixSeed(seed, Math.imul(i, cols) + j);
    out[i] = (h / 2147483648 - 1) * k;
  }
}

/** 填充第 i 行（长度 out），供 embedding gather 使用 */
export function weightRow(w: LazyWeight, i: number, out: Float32Array): void {
  const cols = w.shape[1];
  const seed = w.seed;
  const k = SQRT3 * w.std;
  const base = Math.imul(i, cols);
  for (let j = 0; j < cols; j++) {
    const h = mixSeed(seed, base + j);
    out[j] = (h / 2147483648 - 1) * k;
  }
}

/** 下采样缩略图：最多 maxRows×maxCols，按 stride 取样（供全幅纹理平面） */
export function weightThumb(
  w: LazyWeight,
  maxRows = 96,
  maxCols = 96,
): { rows: number; cols: number; data: Float32Array } {
  const [R, C] = w.shape;
  const rows = Math.min(R, maxRows);
  const cols = Math.min(C, maxCols);
  const data = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const i = Math.floor((r * R) / rows);
    for (let c = 0; c < cols; c++) {
      const j = Math.floor((c * C) / cols);
      data[r * cols + c] = weightAt(w, i, j);
    }
  }
  return { rows, cols, data };
}
