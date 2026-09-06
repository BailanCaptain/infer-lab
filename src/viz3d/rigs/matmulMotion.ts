/**
 * 矩阵乘一格的动效（纯函数，可单测）：3Blue1Brown / matrixmultiplication.xyz 的画法。
 *
 * 一步之内 progress.t ∈ [0,1]：
 *   lift     A 的第 r 行、B 的第 c 列从各自平面里抽出来，飞到中间对齐（B 列转成横向）
 *   multiply 对齐的每一对数字之间冒出乘积 a_k·b_k
 *   collapse 乘积向中间收拢、相加成一个数
 *   write    这个数落进 C[r,c]
 *   sweep    C 的第 r 行其余格逐格长出来（真实值早已算好，这里只是揭示顺序）
 *
 * K 太长（1024）不能全画：取首 SHOW_HEAD 项 + ⋯ + 末 SHOW_TAIL 项，但总和用真值。
 */

export const SHOW_HEAD = 4;
export const SHOW_TAIL = 2;

/** 各阶段在 t 上的区间（与 forwardLayer 里 matmul 的 beats 0 / 0.3 / 0.85 对齐） */
export const PHASES = {
  lift: [0, 0.22],
  multiply: [0.22, 0.5],
  collapse: [0.5, 0.72],
  write: [0.72, 0.85],
  sweep: [0.85, 1],
} as const;

export type Phase = keyof typeof PHASES;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MotionCell extends Vec3 {
  /** 格子缩放（0 = 不可见） */
  scale: number;
  value: number;
  /** 这一格在真实 K 轴上的下标；-1 表示省略号占位 */
  k: number;
}

export interface MatmulMotionInput {
  /** 采样出来的 K 下标（首 SHOW_HEAD + 末 SHOW_TAIL） */
  kIndex: number[];
  /** A[r, k] */
  aRow: number[];
  /** B[k, c] */
  bCol: number[];
  /** 真实的 C[r,c]（全部 K 项之和） */
  sum: number;
  K: number;
  /** A 行在 A 平面上的起点（行中心）与行的方向长度 */
  aRowStart: Vec3;
  /** B 列在 B 平面上的起点（列中心） */
  bColStart: Vec3;
  /** 中间对齐区中心 */
  stage: Vec3;
  /** C[r,c] 在 C 平面上的位置 */
  cTarget: Vec3;
  /** 舞台上一格的边长 */
  cell: number;
}

export interface MatmulMotion {
  phase: Phase;
  /** 当前阶段内的 0..1 */
  local: number;
  a: MotionCell[];
  b: MotionCell[];
  products: MotionCell[];
  sum: MotionCell;
  /** 省略号位置（舞台上 A 行、B 列、乘积各一处），scale 0 时不画 */
  ellipsis: { a: Vec3 & { scale: number }; b: Vec3 & { scale: number }; p: Vec3 & { scale: number } };
  /** C 第 r 行揭示到的列比例 0..1（sweep 阶段用） */
  reveal: number;
  /** 已写入 C[r,c]（write 结束后） */
  written: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});

export function phaseOf(t: number): { phase: Phase; local: number } {
  const tt = clamp01(t);
  for (const [name, [s, e]] of Object.entries(PHASES) as [Phase, readonly [number, number]][]) {
    if (tt < e || name === "sweep") return { phase: name, local: e > s ? clamp01((tt - s) / (e - s)) : 1 };
  }
  return { phase: "sweep", local: 1 };
}

/** 采样 K 轴：首 SHOW_HEAD 项 + 末 SHOW_TAIL 项；K 小于等于两者之和时全取 */
export function sampleK(K: number): number[] {
  if (K <= SHOW_HEAD + SHOW_TAIL) return Array.from({ length: K }, (_, i) => i);
  return [
    ...Array.from({ length: SHOW_HEAD }, (_, i) => i),
    ...Array.from({ length: SHOW_TAIL }, (_, i) => K - SHOW_TAIL + i),
  ];
}

/** 舞台上第 i 个采样格的 x 偏移；省略号占一个格位 */
function slotX(i: number, n: number, K: number, cell: number): number {
  const hasGap = K > n;
  const slots = hasGap ? n + 1 : n;
  const gapAt = SHOW_HEAD; // 省略号在首段之后
  const slot = hasGap && i >= gapAt ? i + 1 : i;
  return (slot - (slots - 1) / 2) * cell;
}

export function matmulMotion(t: number, input: MatmulMotionInput): MatmulMotion {
  const { kIndex, aRow, bCol, sum, K, aRowStart, bColStart, stage, cTarget, cell } = input;
  const n = kIndex.length;
  const { phase, local } = phaseOf(t);
  const hasGap = K > n;
  const gapX = hasGap ? (SHOW_HEAD - (n + 1 - 1) / 2) * cell : 0;

  // 舞台上三行：A 行在上、乘积在中、B 列在下
  const rowA = stage.y + cell * 1.1;
  const rowP = stage.y;
  const rowB = stage.y - cell * 1.1;

  const tLift = phase === "lift" ? smooth(local) : 1;
  const a: MotionCell[] = kIndex.map((k, i) => {
    const target = { x: stage.x + slotX(i, n, K, cell), y: rowA, z: stage.z };
    const p = lerp3(aRowStart, target, tLift);
    return { ...p, scale: 1, value: aRow[i] ?? 0, k };
  });
  const b: MotionCell[] = kIndex.map((k, i) => {
    const target = { x: stage.x + slotX(i, n, K, cell), y: rowB, z: stage.z };
    const p = lerp3(bColStart, target, tLift);
    return { ...p, scale: 1, value: bCol[i] ?? 0, k };
  });

  // 乘积：multiply 阶段逐个冒出；collapse 阶段向中间收拢并缩小
  const tMul = phase === "multiply" ? local : phase === "lift" ? 0 : 1;
  const tCol = phase === "collapse" ? smooth(local) : phase === "lift" || phase === "multiply" ? 0 : 1;
  const products: MotionCell[] = kIndex.map((k, i) => {
    const x0 = stage.x + slotX(i, n, K, cell);
    const appear = smooth(clamp01(tMul * (n + 1) - i)); // 第 i 个在 tMul ≈ i/(n+1) 时冒出
    const x = lerp(x0, stage.x, tCol);
    return {
      x,
      y: rowP,
      z: stage.z + cell * 0.02,
      scale: appear * (1 - tCol * 0.65),
      value: (aRow[i] ?? 0) * (bCol[i] ?? 0),
      k,
    };
  });

  // 总和：collapse 末尾出现在舞台中心，write 阶段飞进 C
  const tWrite = phase === "write" ? smooth(local) : phase === "sweep" ? 1 : 0;
  const sumVisible = tCol > 0.7 || phase === "write" || phase === "sweep";
  const sumPos = lerp3({ x: stage.x, y: rowP, z: stage.z }, cTarget, tWrite);
  const sumCell: MotionCell = {
    ...sumPos,
    scale: sumVisible ? (phase === "sweep" ? 0 : 1) : 0,
    value: sum,
    k: -1,
  };

  // 省略号：舞台上 A/B/乘积三行各一个，收拢时随乘积一起消失
  const ell = (y: number, s: number) => ({ x: stage.x + gapX, y, z: stage.z, scale: hasGap ? s : 0 });
  const ellipsis = {
    a: ell(rowA, tLift),
    b: ell(rowB, tLift),
    p: ell(rowP, tMul >= 0.999 ? 1 - tCol : 0),
  };

  // A 行 / B 列在写入后回到原位（sweep 阶段淡出舞台）
  if (phase === "sweep") {
    for (const c of a) c.scale = 1 - smooth(local);
    for (const c of b) c.scale = 1 - smooth(local);
    ellipsis.a.scale *= 1 - smooth(local);
    ellipsis.b.scale *= 1 - smooth(local);
  }

  const reveal = phase === "sweep" ? smooth(local) : 0;
  return { phase, local, a, b, products, sum: sumCell, ellipsis, reveal, written: phase === "sweep" };
}
