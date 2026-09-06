/**
 * 最小张量：row-major Float32Array + 维度名。
 * dims 用教学符号（"S" 序列、"H" 隐藏、"n_q" 头数、"d_h" 头维、"I" 中间维、"S_k" 键序列）。
 */
export interface Tensor {
  shape: number[];
  dims: string[];
  data: Float32Array;
}

export function zeros(shape: number[], dims: string[]): Tensor {
  if (shape.length !== dims.length) throw new Error("shape 与 dims 长度不一致");
  return { shape, dims, data: new Float32Array(shape.reduce((a, b) => a * b, 1)) };
}

export function fromArray(shape: number[], dims: string[], values: ArrayLike<number>): Tensor {
  const t = zeros(shape, dims);
  if (values.length !== t.data.length) throw new Error("数据长度与 shape 不匹配");
  t.data.set(values);
  return t;
}

export function size(t: Tensor): number {
  return t.data.length;
}

export function strides(shape: number[]): number[] {
  const s = new Array<number>(shape.length);
  let acc = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    s[i] = acc;
    acc *= shape[i] ?? 1;
  }
  return s;
}

/** 三维取值 */
export function at3(t: Tensor, i: number, j: number, k: number): number {
  const s1 = t.shape[1] ?? 1;
  const s2 = t.shape[2] ?? 1;
  return t.data[(i * s1 + j) * s2 + k] ?? 0;
}

/** 视图变形（不复制数据） */
export function reshape(t: Tensor, shape: number[], dims: string[]): Tensor {
  const n = shape.reduce((a, b) => a * b, 1);
  if (n !== t.data.length) throw new Error(`reshape 大小不匹配 ${t.shape} → ${shape}`);
  return { shape, dims, data: t.data };
}

export function clone(t: Tensor): Tensor {
  return { shape: [...t.shape], dims: [...t.dims], data: new Float32Array(t.data) };
}

/** 形状的教学写法：[S,H] */
export function shapeLabel(t: { shape: number[]; dims: string[] }): string {
  return `[${t.dims.join(",")}]=[${t.shape.join("×")}]`;
}

/** 绝对值最大 */
export function absMax(t: Tensor): number {
  let m = 0;
  for (let i = 0; i < t.data.length; i++) {
    const v = Math.abs(t.data[i] ?? 0);
    if (v > m) m = v;
  }
  return m;
}
