/**
 * "塔"的第一段：第 0 层注意力块的格子体布局（纯函数）。
 *
 * 坐标：1 世界单位 = 1 个元素。x = 列（特征维），y = 流向（从下往上），z = 深度（头 / K|V 切片往里叠）。
 * 张量是一面面竖立的格子墙，正面朝 +z；头张量是沿 z 叠起来的薄片。
 * 这里只描述"放在哪、多大、怎么合并"，不碰 three。
 */
import { planeView } from "../../sim/timeline/plane";
import type { TensorRecord, Timeline } from "../../sim/timeline/types";
import { pickMerge } from "./cells";

export type VolumeKind = "act" | "weight" | "kv" | "scores";

export interface Slice {
  /** 该切片的二维视图选择 */
  head: number;
  picks: number[];
}

export interface Volume {
  id: string;
  name: string;
  kind: VolumeKind;
  record: TensorRecord;
  /** 真实形状（标签） */
  shape: number[];
  /** 左下前角的世界坐标 */
  x: number;
  y: number;
  z: number;
  /** 每个切片的元素行列数 */
  rows: number;
  cols: number;
  /** 合并倍数（一格 = merge×merge 元素） */
  merge: number;
  /** 切片列表（无头维 = 1 片） */
  slices: Slice[];
  /** 切片沿 z 的间距（世界单位） */
  slicePitch: number;
  /** 一格的厚度（沿 z） */
  thickness: number;
  /** 世界包围盒尺寸 */
  w: number;
  h: number;
  d: number;
}

export interface AttentionLayout {
  volumes: Volume[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
}

/** 一个张量最多画这么多格（每切片） */
export const MAX_CELLS_PER_SLICE = 8192;
/** 行间距（沿 y） */
export const ROW_GAP = 140;
/** 并排块的间距（沿 x） */
export const COL_GAP = 160;
/** 头切片的间距：切片厚度 + 空隙 */
export const SLICE_PITCH = 24;
export const THICKNESS = 10;

function kindOf(rec: TensorRecord): VolumeKind {
  if (rec.role === "weight") return "weight";
  if (rec.role === "kv") return "kv";
  if (rec.role === "scores") return "scores";
  return "act";
}

function volume(rec: TensorRecord, name: string, slices: Slice[], x: number, y: number, z = 0): Volume {
  const first = slices[0] ?? { head: -1, picks: [] };
  const v = planeView(rec, { head: first.head >= 0 ? first.head : undefined, picks: first.picks });
  const merge = pickMerge(v.rows, v.cols, MAX_CELLS_PER_SLICE);
  const w = v.cols;
  const h = v.rows;
  const d = slices.length > 1 ? SLICE_PITCH * (slices.length - 1) + THICKNESS : THICKNESS;
  return {
    id: rec.id,
    name,
    kind: kindOf(rec),
    record: rec,
    shape: rec.shape,
    x,
    y,
    z,
    rows: v.rows,
    cols: v.cols,
    merge,
    slices,
    slicePitch: SLICE_PITCH,
    thickness: THICKNESS,
    w,
    h,
    d,
  };
}

const heads = (n: number): Slice[] => Array.from({ length: n }, (_, h) => ({ head: h, picks: [] }));
const one: Slice[] = [{ head: -1, picks: [] }];

/** 把一排块横向居中排开，返回各块的左边 x */
function rowXs(widths: number[], gap = COL_GAP): number[] {
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  const xs: number[] = [];
  let x = -total / 2;
  for (const w of widths) {
    xs.push(x);
    x += w + gap;
  }
  return xs;
}

export function attentionLayout(tl: Timeline): AttentionLayout {
  const T = tl.tensors;
  const need = (id: string): TensorRecord => {
    const r = T[id];
    if (!r) throw new Error(`时间线里没有张量 ${id}`);
    return r;
  };
  const L = `L${tl.layerIndex}`;
  const xIn = need(`${L}.x_in`);
  const wq = need(`${L}.attn.q_proj`);
  const wk = need(`${L}.attn.k_proj`);
  const wv = need(`${L}.attn.v_proj`);
  const q = need(`${L}.attn.q`);
  const k = need(`${L}.attn.k`);
  const v = need(`${L}.attn.v`);
  const qh = need(`${L}.attn.q_rope`);
  const kh = need(`${L}.attn.k_rope`);
  const vh = need(`${L}.attn.v_heads`);
  const probs = need(`${L}.attn.probs`);
  const ctx = need(`${L}.attn.ctx`);
  const wo = need(`${L}.attn.o_proj`);
  const out = need(`${L}.attn.out`);
  const kv = need(`${L}.kv.block`);

  const nq = qh.shape[1] ?? 1;
  const nkv = kh.shape[1] ?? 1;
  const vols: Volume[] = [];
  let y = 0;

  // 1. X 输入（一条）
  const xs0 = rowXs([xIn.shape[1] ?? 0]);
  vols.push(volume(xIn, "X", one, xs0[0] ?? 0, y));
  y += (xIn.shape[0] ?? 0) + ROW_GAP;

  // 2. 三面权重墙并排
  const wW = [wq.shape[1] ?? 0, wk.shape[1] ?? 0, wv.shape[1] ?? 0];
  const xs1 = rowXs(wW);
  vols.push(volume(wq, "W_q", one, xs1[0] ?? 0, y));
  vols.push(volume(wk, "W_k", one, xs1[1] ?? 0, y));
  vols.push(volume(wv, "W_v", one, xs1[2] ?? 0, y));
  y += (wq.shape[0] ?? 0) + ROW_GAP;

  // 3. Q K V 三条，与各自的墙对齐
  vols.push(volume(q, "Q", one, xs1[0] ?? 0, y));
  vols.push(volume(k, "K", one, xs1[1] ?? 0, y));
  vols.push(volume(v, "V", one, xs1[2] ?? 0, y));
  y += (q.shape[0] ?? 0) + ROW_GAP;

  // 4. 拆头：沿 z 叠片；K/V 的 KV Cache 块（K|V 两组 × n_kv 片）放在最右
  const dh = qh.shape[2] ?? 0;
  const kvSlices: Slice[] = [];
  for (let s = 0; s < 2; s++) for (let h = 0; h < nkv; h++) kvSlices.push({ head: h, picks: [s] });
  const xs3 = rowXs([dh, dh, dh, dh]);
  vols.push(volume(qh, "Q 分头 + RoPE", heads(nq), xs3[0] ?? 0, y));
  vols.push(volume(kh, "K 分头 + RoPE", heads(nkv), xs3[1] ?? 0, y));
  vols.push(volume(vh, "V 分头", heads(nkv), xs3[2] ?? 0, y));
  vols.push(volume(kv, "KV Cache 写入", kvSlices, xs3[3] ?? 0, y));
  y += (qh.shape[0] ?? 0) + ROW_GAP;

  // 5. 注意力概率：每头一片 S×S
  const S = probs.shape[1] ?? 0;
  const xs4 = rowXs([S]);
  vols.push(volume(probs, "注意力概率 softmax", heads(nq), xs4[0] ?? 0, y));
  y += S + ROW_GAP;

  // 6. 每头的上下文，再合并回 [S, n_q·d_h]
  const xs5 = rowXs([dh]);
  vols.push(volume(ctx, "P·V 每头上下文", heads(nq), xs5[0] ?? 0, y));
  y += (ctx.shape[0] ?? 0) + ROW_GAP;

  // 7. 输出投影墙
  const xs6 = rowXs([wo.shape[1] ?? 0]);
  vols.push(volume(wo, "W_o", one, xs6[0] ?? 0, y));
  y += (wo.shape[0] ?? 0) + ROW_GAP;

  // 8. 注意力输出（一条）
  const xs7 = rowXs([out.shape[1] ?? 0]);
  vols.push(volume(out, "注意力输出", one, xs7[0] ?? 0, y));
  y += out.shape[0] ?? 0;

  const bounds = {
    minX: Math.min(...vols.map((v) => v.x)),
    maxX: Math.max(...vols.map((v) => v.x + v.w)),
    minY: 0,
    maxY: y,
    minZ: Math.min(...vols.map((v) => v.z - v.d)),
    maxZ: Math.max(...vols.map((v) => v.z)),
  };
  return { volumes: vols, bounds };
}

export function volumesOverlap(a: Volume, b: Volume): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
