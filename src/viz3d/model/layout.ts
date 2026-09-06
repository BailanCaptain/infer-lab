/**
 * 整模型结构布局：ModelSpec → 一组放在同一个 3D 空间里的块（纯函数，可单测）。
 *
 * 画面纪律（对照 bbycroft / Transformer Explainer 定下的）：
 * - 一个模型 = 一个物体。数据从相机这边（+z）流向远处（−z）：近处是输入与第 0 层，远处是折叠的其余层与输出，
 *   透视自然把焦点放在第 0 层。并行分支沿 x 排开；矩阵行数沿 x、列数沿 z（流向）。
 * - 体量用干净的单色块表示，不逐值着色；边长按元素数开平方压缩，所有张量共用同一把尺，才能互相比较。
 * - 第 0 层展开，其余层折成一叠竖立的薄片，只表达"重复 N−1 次"。
 * - 注意力分数 [n_q,S,S] 用高度表示头数，是画面里唯一"真的"用到 y 的地方。
 */
import type { ModelSpec } from "../../sim/modelspec/types";
import { attnKvDim, attnQDim } from "../../sim/modelspec/types";

export type BlockKind = "act" | "weight" | "kv" | "scores" | "norm";

export interface Block {
  id: string;
  /** 教学名（中文短标签，≤ 8 字）*/
  name: string;
  kind: BlockKind;
  /** 真实形状（写在标签上） */
  shape: number[];
  /** 参数量/元素数 */
  elements: number;
  /** 中心位置（块底面在 y=0） */
  x: number;
  z: number;
  /** 沿 x 的宽、沿 z 的深、沿 y 的高（世界单位） */
  w: number;
  d: number;
  h: number;
  /** 展示被截断（词表维太大） */
  truncated?: boolean;
  /** 标签位置：单独一列的块放右侧（+x），并行分支的块放前方（+z） */
  labelSide: "right" | "front";
  /** 属于哪一组（用于左栏与镜头） */
  group: string;
}

export interface LayerDeck {
  /** 折叠层数（numLayers − 1） */
  count: number;
  /** 第一张薄片（最近的一张）的中心 z */
  z0: number;
  /** 薄片间距（沿 −z） */
  pitch: number;
  /** 薄片沿 x 的宽、沿 z 的厚、沿 y 的高 */
  w: number;
  d: number;
  h: number;
  x: number;
  label: string;
}

export interface GroupRange {
  id: string;
  name: string;
  /** 沿流向的范围（z，minZ 远、maxZ 近） */
  minZ: number;
  maxZ: number;
}

export interface ModelLayout {
  blocks: Block[];
  deck: LayerDeck | null;
  /** 包围盒（y 从 0 到 maxH） */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; maxH: number };
  groups: GroupRange[];
}

/** 边长 = SIDE_K · n^0.5，最短 MIN_SIDE；词表维单独截断到 VOCAB_CAP */
export const SIDE_K = 0.09;
export const MIN_SIDE = 0.34;
export const VOCAB_CAP = 5;
/** 沿流向的块间距：要放得下前方标签的两行字 */
export const GAP = 1.15;
/** 并行分支间距 */
export const LANE_GAP = 0.95;
export const H_ACT = 0.1;
export const H_WEIGHT = 0.22;
export const H_KV = 0.22;
export const H_NORM = 0.16;
/** 每个注意力头在分数块上的高度 */
export const H_PER_HEAD = 0.09;
export const DECK_PITCH = 0.4;
export const DECK_D = 0.14;
export const DECK_H = 2.2;

export function side(n: number): number {
  return Math.max(MIN_SIDE, SIDE_K * Math.sqrt(n));
}

type Draft = Omit<Block, "x" | "z" | "labelSide">;

interface Cursor {
  /** 下一列的近端 z（越走越小） */
  z: number;
}

/** 放一列：一个块（标签在右）或几条并行分支（标签在前方，沿 x 排开） */
function place(blocks: Block[], cur: Cursor, items: Draft[]): { minZ: number; maxZ: number } {
  const colD = Math.max(...items.map((b) => b.d));
  const z = cur.z - colD / 2;
  const totalW = items.reduce((a, b) => a + b.w, 0) + LANE_GAP * (items.length - 1);
  let x = -totalW / 2;
  for (const b of items) {
    x += b.w / 2;
    blocks.push({ ...b, x, z, labelSide: items.length === 1 ? "right" : "front" });
    x += b.w / 2 + LANE_GAP;
  }
  const maxZ = cur.z;
  cur.z -= colD + GAP;
  return { minZ: cur.z + GAP, maxZ };
}

export function modelLayout(spec: ModelSpec, seq: number): ModelLayout {
  const layer = spec.layers[0];
  if (!layer) throw new Error("模型没有层");
  const H = spec.hidden;
  const attn = layer.attention;
  const qDim = attnQDim(attn);
  const kvDim = attnKvDim(attn);
  const S = seq;
  const blocks: Block[] = [];
  const groups: GroupRange[] = [];
  const cur: Cursor = { z: 0 };

  const draft = (
    kind: BlockKind,
    id: string,
    name: string,
    shape: number[],
    group: string,
    h: number,
  ): Draft => ({
    id,
    name,
    kind,
    shape,
    elements: shape.reduce((a, b) => a * b, 1),
    /* 行数沿 x，列数沿 z（流向） */
    w: side(shape[0] ?? 1),
    d: side(shape[1] ?? 1),
    h,
    group,
  });
  const act = (id: string, name: string, shape: number[], group: string) =>
    draft("act", id, name, shape, group, H_ACT);
  const weight = (id: string, name: string, shape: number[], group: string) =>
    draft("weight", id, name, shape, group, H_WEIGHT);
  const norm = (id: string, name: string, group: string): Draft => ({
    ...draft("norm", id, name, [H], group, H_NORM),
    w: MIN_SIDE * 0.6,
    d: side(H),
  });

  /* 词嵌入：[vocab, H]，词表维截断 */
  {
    const g: GroupRange = { id: "embed", name: "词嵌入", minZ: 0, maxZ: cur.z };
    const tok = act("tokens", "输入 token", [S, 1], g.id);
    tok.d = MIN_SIDE * 0.6;
    place(blocks, cur, [tok]);
    const emb = weight("embed.W", "词表嵌入", [spec.vocab, H], g.id);
    emb.w = Math.min(emb.w, VOCAB_CAP);
    emb.truncated = true;
    place(blocks, cur, [emb]);
    g.minZ = place(blocks, cur, [act("L0.x_in", "X 输入", [S, H], g.id)]).minZ;
    groups.push(g);
  }

  /* 第 0 层：注意力 */
  {
    const g: GroupRange = { id: "L0.attn", name: "第 0 层 · 注意力", minZ: 0, maxZ: cur.z };
    place(blocks, cur, [norm("L0.ln1", "RMSNorm", g.id)]);
    place(blocks, cur, [
      weight("L0.Wq", "W_q", [H, qDim], g.id),
      weight("L0.Wk", "W_k", [H, kvDim], g.id),
      weight("L0.Wv", "W_v", [H, kvDim], g.id),
    ]);
    place(blocks, cur, [
      act("L0.q", "Q", [S, qDim], g.id),
      act("L0.k", "K", [S, kvDim], g.id),
      act("L0.v", "V", [S, kvDim], g.id),
    ]);
    const scores: Draft = {
      id: "L0.scores",
      name: "注意力分数",
      kind: "scores",
      shape: [attn.numHeads, S, S],
      elements: attn.numHeads * S * S,
      w: Math.max(side(S), 0.8),
      d: Math.max(side(S), 0.8),
      h: attn.numHeads * H_PER_HEAD,
      group: g.id,
    };
    /* KV Cache：本层 K、V 的缓存，蓝色块与分数并排 */
    const kv: Draft = {
      id: "L0.kv",
      name: "KV Cache",
      kind: "kv",
      shape: [2, S, kvDim],
      elements: 2 * S * kvDim,
      w: side(S) * 2 + 0.3,
      d: side(kvDim),
      h: H_KV,
      group: g.id,
    };
    place(blocks, cur, [scores, kv]);
    place(blocks, cur, [act("L0.attn_out", "注意力输出", [S, qDim], g.id)]);
    place(blocks, cur, [weight("L0.Wo", "W_o", [qDim, H], g.id)]);
    g.minZ = place(blocks, cur, [act("L0.x_mid", "X + 注意力", [S, H], g.id)]).minZ;
    groups.push(g);
  }

  /* 第 0 层：MLP */
  {
    const g: GroupRange = { id: "L0.mlp", name: "第 0 层 · MLP", minZ: 0, maxZ: cur.z };
    const I = layer.mlp.kind === "dense" ? layer.mlp.intermediate : layer.mlp.moeIntermediate;
    place(blocks, cur, [norm("L0.ln2", "RMSNorm", g.id)]);
    place(blocks, cur, [weight("L0.Wgate", "W_gate", [H, I], g.id), weight("L0.Wup", "W_up", [H, I], g.id)]);
    place(blocks, cur, [act("L0.act", "SiLU(gate)·up", [S, I], g.id)]);
    place(blocks, cur, [weight("L0.Wdown", "W_down", [I, H], g.id)]);
    g.minZ = place(blocks, cur, [act("L0.x_out", "X 输出", [S, H], g.id)]).minZ;
    groups.push(g);
  }

  /* 其余层：一叠薄片，宽度盖住第 0 层的横向范围 */
  let deck: LayerDeck | null = null;
  const layerBlocks = blocks.filter((b) => b.group.startsWith("L0."));
  const layerMinX = Math.min(...layerBlocks.map((b) => b.x - b.w / 2));
  const layerMaxX = Math.max(...layerBlocks.map((b) => b.x + b.w / 2));
  if (spec.numLayers > 1) {
    const count = spec.numLayers - 1;
    const g: GroupRange = { id: "deck", name: `第 1–${spec.numLayers - 1} 层`, minZ: 0, maxZ: cur.z };
    deck = {
      count,
      z0: cur.z - DECK_D / 2,
      pitch: DECK_PITCH,
      w: layerMaxX - layerMinX,
      d: DECK_D,
      h: DECK_H,
      x: (layerMinX + layerMaxX) / 2,
      label: `× ${count} 层（同样的结构）`,
    };
    cur.z -= DECK_D + DECK_PITCH * (count - 1) + GAP;
    g.minZ = cur.z + GAP;
    groups.push(g);
  }

  /* 输出：最终 RMSNorm、lm_head [H, vocab]（截断）、logits */
  {
    const g: GroupRange = { id: "head", name: "输出", minZ: 0, maxZ: cur.z };
    place(blocks, cur, [norm("final.norm", "RMSNorm", g.id)]);
    const lm = weight(
      "lm_head",
      spec.tieWordEmbeddings ? "lm_head（共享嵌入）" : "lm_head",
      [H, spec.vocab],
      g.id,
    );
    lm.d = Math.min(lm.d, VOCAB_CAP);
    lm.truncated = true;
    place(blocks, cur, [lm]);
    const logits = act("logits", "下一 token 分布", [S, spec.vocab], g.id);
    logits.d = Math.min(logits.d, VOCAB_CAP);
    logits.truncated = true;
    g.minZ = place(blocks, cur, [logits]).minZ;
    groups.push(g);
  }

  const minX = Math.min(...blocks.map((b) => b.x - b.w / 2));
  const maxX = Math.max(...blocks.map((b) => b.x + b.w / 2));
  const minZ = Math.min(...blocks.map((b) => b.z - b.d / 2));
  const maxZ = Math.max(...blocks.map((b) => b.z + b.d / 2));
  const maxH = Math.max(DECK_H, ...blocks.map((b) => b.h));
  /* 把整体居中到原点 */
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  for (const b of blocks) {
    b.x -= cx;
    b.z -= cz;
  }
  if (deck) {
    deck.x -= cx;
    deck.z0 -= cz;
  }
  for (const g of groups) {
    g.minZ -= cz;
    g.maxZ -= cz;
  }
  return {
    blocks,
    deck,
    bounds: { minX: minX - cx, maxX: maxX - cx, minZ: minZ - cz, maxZ: maxZ - cz, maxH },
    groups,
  };
}

/** 包围盒是否两两相交（布局回归用） */
export function blocksOverlap(a: Block, b: Block): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6;
}
