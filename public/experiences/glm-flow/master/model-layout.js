// The whole model laid out (the master, since 2026-09-25): every layer exactly as flow-layout.js lays it out alone, placed on one
// page, with the two ends. The rules, all from the one-layer layout (a word is a column, numbers run down; weights left
// of their results, or above them in a feed-forward; results on the output line; the residual spine on the right;
// arrows: weights from the left, data from the top or the right) — plus three for the whole:
//  - fold by the config's pattern: the layers run down a column, one column per period of the attention kinds
//    (GLM: KDA, KDA, KDA, MLA → 4 layers a column, 12 columns), so the same kind of layer stands in the same row, and the
//    whole comes out about square (a single column of 45 is about a hundred times taller than wide). Rows are as tall
//    as their tallest layer; each layer's output line and spine stand at its column's
//  - one spine: layer i's input is layer i−1's output (the modeling loop hands it on), so the spine is not drawn twice:
//    each layer's spine arrow comes from the layer above (from the foot of the previous column, round the gap between
//    the columns and over the top), and the layer's mHC reads it off that arrow
//  - the ends on the same rules: the vocabulary left of the word vectors it gives (the words' ids above them), 4 streams
//    into layer 0; under the last column the 4 streams averaged, RMSNorm, the output head above its scores as wide
//    (as a feed-forward's weight: its 154880 outputs along x), softmax, the next word; under that the MTP layer, whose
//    output comes back into the same output head along the left
// The MTP's look-up in the vocabulary is not drawn (the vocabulary is at the top of the page; its arrow would cross
// the whole model): the pages name it (on the 2D diagram, in the MTP's first box).
import { layoutFlow, shapeOf, HEAD_GAP, X_OUT, CH, GAP_W, GAP_V, STAGE, PAD, P_GAP } from './flow-layout.js';
import { ROW, CELL } from './truth-layout.js';
import { lid } from './model-spec.js';

export const COL_GAP = 64, ROW_GAP_L = 40, TOP_GAP = 28;
// a tensor as long as the vocabulary, elided: its two ends, ELIDE_GAP apart, the whole as long as the longest weight
// drawn whole (each end a whole number of cells)
export const ELIDE_GAP = 8;

// the period of the attention kinds (the smallest p with kind[i] = kind[i + p] everywhere); a model with one kind of
// layer (p = 1) folds into about √N columns instead
export function foldOf(kinds) {
  const n = kinds.length;
  for (let p = 2; p <= n / 2; p++) if (kinds.every((k, i) => i + p >= n || kinds[i + p] === k)) return p;
  return Math.ceil(Math.sqrt(n));
}

export function layoutModel(M, { heads = 'z', elide = true, gap = HEAD_GAP } = {}) {
  const { N, T } = M.dims, Tw = T * ROW, blocks = [], arrows = [], B = {};
  const per = M.layers.map(s => layoutFlow(s, { heads, gap }));
  const P = foldOf(M.layers.slice(0, N).map(s => s.attnKind)), COLS = Math.ceil(N / P);
  const col = i => Math.floor(i / P), row = i => i % P;
  // rows: as tall as their tallest layer; columns: side by side, COL_GAP apart
  const hOf = L => L.bounds.y1 - L.bounds.y0;
  const rowH = Array.from({ length: P }, (_, r) => Math.max(...per.slice(0, N).filter((_, i) => row(i) === r).map(hOf)));
  const rowTop = rowH.map((_, r) => rowH.slice(0, r).reduce((a, h) => a + h + ROW_GAP_L, 0));
  const rowsBottom = rowTop[P - 1] + rowH[P - 1];
  const colX = [0];   // where each column's output line ends (its layers' X_OUT)
  for (let j = 1; j < COLS; j++) {
    const prev = per.slice(0, N).filter((_, i) => col(i) === j - 1), next = per.slice(0, N).filter((_, i) => col(i) === j);
    colX.push(colX[j - 1] + Math.max(...prev.map(L => L.bounds.x1)) + COL_GAP - Math.min(...next.map(L => L.bounds.x0)));
  }
  const gapX = j => colX[j] + Math.max(...per.slice(0, N).filter((_, i) => col(i) === j).map(L => L.bounds.x1)) + COL_GAP / 2;   // the gap right of column j
  const cx = b => (b.x0 + b.x1) / 2, cy = b => (b.y0 + b.y1) / 2;
  const arrow = (from, to, pts, extra = {}) => arrows.push({ from, to, pts, head: true, w: extra.spine ? 3 : extra.lane ? 1.6 : 2, ...extra });

  // ---- the layers, each moved into place (layer i ≥ 1: its input block is the previous layer's output, not drawn again)
  const placed = [];
  per.forEach((L, i) => {
    const mtp = i >= N;
    const dx = mtp ? null : colX[col(i)], dy = mtp ? null : rowTop[row(i)] - L.bounds.y0;
    placed.push({ L, dx, dy });
  });
  function put(i, L, dx, dy) {
    const pre = lid(i) + ':', skip = i >= 1 && i < N ? 'residual_in' : null;
    for (const b of L.blocks) if (b.id !== skip) { const nb = { ...b, id: pre + b.id, local: b.id, layer: i, x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0 + dy, y1: b.y1 + dy }; blocks.push(nb); B[nb.id] = nb }
    const rin = L.B.residual_in, sx = cx(rin) + dx;
    for (const a of L.arrows) {
      const pts = a.pts.map(([x, y]) => [x + dx, y + dy]);
      let from = pre + a.from, bridge = false, joins = a.joins;
      if (skip && a.from === 'residual_in') {
        from = M.alias[pre + 'residual_in'];
        if (a.spine) { pts.shift(); bridge = true }             // the spine arrow: its start comes from the layer above (below)
        else { pts[0] = [sx, pts[0][1]]; joins = 'spine' }      // the mHC's two reads: off the spine arrow, where it runs down
      }
      arrows.push({ ...a, pts, from, to: pre + a.to, layer: i, bridge, joins });
    }
  }
  for (let i = 0; i < N; i++) put(i, per[i], placed[i].dx, placed[i].dy);
  // the spine from each layer to the next: straight down a column, or from the foot of one column round to the top of
  // the next (down under the column, right into the gap, up it, right over the next column's top, down its spine)
  const yUnder = rowsBottom + 12, yOver = -TOP_GAP / 2;
  for (let i = 1; i < N; i++) {
    const a = arrows.find(x => x.layer === i && x.bridge), end = a.pts.at(-1), out = B[lid(i - 1) + ':residual_out'], sx = cx(out);
    if (col(i) === col(i - 1)) a.pts = [[sx, out.y1 + PAD], ...a.pts];
    else a.pts = [[sx, out.y1 + PAD], [sx, yUnder], [gapX(col(i - 1)), yUnder], [gapX(col(i - 1)), yOver], [end[0], yOver], ...a.pts];
    delete a.bridge;
  }

  // ---- in: the words' ids → the vocabulary → the word vectors → 4 streams into layer 0 (column 0, above its top)
  const endShape = (id, o) => { const t = M.ends.tensors.find(x => x.id === id); return { t, s: shapeOf(t, o, heads, gap) } };
  const place = (id, o, x0, y0, extra = {}) => {
    const { t, s } = endShape(id, o), b = { id, t, kind: t.kind, comp: t.comp, orient: o, x0, x1: x0 + s.w, y0, y1: y0 + s.h, z0: -s.d, z1: 0, ...s, end: true, ...extra };
    if (B[id]) throw new Error('placed twice: ' + id); blocks.push(b); B[id] = b; return b;
  };
  const wOf = (id, o) => endShape(id, o).s.w, hOfE = (id, o) => endShape(id, o).s.h;
  // the tensors as long as the vocabulary (154880 words: 1239 at true scale, six layers wide; nothing else on the page
  // runs that length) are drawn elided (the user, 09-25: "词表可以用省略的画法，不然太突兀了"; then "下面缩放到跟其他
  // 权重的最长宽一致？"): their two ends, true in height and in the size of a cell (elided, not scaled: a cell stays 256
  // numbers), with a gap for the words left out; the whole as long as the longest weight of the layers (W_o of a
  // sparse-attention layer, 16384 along its input), and the same for all of them, since they are the same length.
  // `vocab(id, o, x1, y0)`: right edge at x1; the right end is the tensor's block (its arrows start and end there), the
  // left end is `id/0`. elide false: whole.
  const widest = Math.max(...per.flatMap(L => L.blocks.filter(b => b.kind === 'weight').map(b => b.x1 - b.x0)));
  const PIECE = Math.floor((widest - ELIDE_GAP) / 2 / CELL) * CELL;
  function vocab(id, o, x1, y0) {
    if (!elide) return place(id, o, x1 - wOf(id, o), y0);
    const { t, s } = endShape(id, o);
    const piece = (k, a) => { const b = { id: k ? id : id + '/0', tensor: id, t, kind: t.kind, comp: t.comp, orient: o, ...s, x0: a, x1: a + PIECE, y0, y1: y0 + s.h, z0: -s.d, z1: 0,
      w: PIECE, div: [PIECE / CELL, s.div[1], s.div[2]], end: true, elided: true, piece: k }; if (B[b.id]) throw new Error('placed twice: ' + b.id); blocks.push(b); B[b.id] = b; return b };
    piece(0, x1 - 2 * PIECE - ELIDE_GAP); return piece(1, x1 - PIECE);
  }
  const left = b => B[b.id + '/0'] || b;   // an elided tensor's left end (or the tensor, whole)
  const onLineAt = (X, id, y, extra) => place(id, 'col', X - Tw, y, { line: 'out', ...extra });
  const rin0 = B[lid(0) + ':residual_in'];
  const x0 = onLineAt(colX[0], 'x0', rin0.y0 - TOP_GAP - hOfE('x0', 'col'));
  // the vocabulary, elided (see vocab()): the arrow into the word vectors comes from its right end
  const Wemb = vocab('W_embed', 'wl', x0.x0 - GAP_W, x0.y0);
  const ids = place('ids', 'col', x0.x0, x0.y0 - GAP_V - hOfE('ids', 'col'));
  arrow('ids', 'x0', [[cx(ids), ids.y1 + PAD], [cx(ids), x0.y0 - PAD]]);
  arrow('W_embed', 'x0', [[Wemb.x1 + PAD, cy(x0)], [x0.x0 - PAD, cy(x0)]]);
  arrow('x0', rin0.id, [[x0.x1 + PAD, cy(x0)], [cx(rin0), cy(x0)], [cx(rin0), rin0.y0 - PAD]], { spine: true, w: 3 });

  // ---- out: under the last column
  const XL = colX[col(N - 1)], outN = B[lid(N - 1) + ':residual_out'];
  const hm = onLineAt(XL, 'h_mean', rowsBottom + STAGE * 2);
  arrow(outN.id, 'h_mean', [[cx(outN), outN.y1 + PAD], [cx(outN), cy(hm)], [hm.x1 + PAD, cy(hm)]], { spine: true, w: 3 });
  const hf = onLineAt(XL, 'h_final', hm.y1 + STAGE);
  place('gamma_final', 'rod', hf.x0 - P_GAP - wOf('gamma_final', 'rod'), hf.y0);
  arrow('h_mean', 'h_final', [[cx(hm), hm.y1 + PAD], [cx(hm), hf.y0 - PAD]]);
  // the output head and its rows of scores, elided alike (see vocab()): as wide as each other, end over end
  const Wh = vocab('W_head', 'wt', hf.x0 - GAP_W, hf.y0);
  const lg = vocab('logits', 'row', Wh.x1, Wh.y1 + GAP_V), pr = vocab('probs', 'row', Wh.x1, lg.y1 + GAP_V);
  const nid = place('next_id', 'col', pr.x1 - ROW, pr.y1 + GAP_V);
  arrow('W_head', 'logits', [[cx(Wh), Wh.y1 + PAD], [cx(Wh), lg.y0 - PAD]]);
  arrow('logits', 'probs', [[cx(lg), lg.y1 + PAD], [cx(lg), pr.y0 - PAD]]);
  arrow('probs', 'next_id', [[cx(nid), pr.y1 + PAD], [cx(nid), nid.y0 - PAD]]);

  // ---- the MTP layer, under the output head, in the last column: the hidden states (normed) and the next word's
  // vectors (normed) → eh_proj, left of the MTP layer's input on its spine
  const hn = onLineAt(XL, 'h_n', nid.y1 + STAGE);
  place('gamma_h', 'rod', hn.x0 - P_GAP - wOf('gamma_h', 'rod'), hn.y0);
  arrow('h_final', 'h_n', [[cx(hf), hf.y1 + PAD], [cx(hf), hn.y0 - PAD]]);
  arrow('h_final', 'logits', [[cx(hf), cy(lg)], [lg.x1 + PAD, cy(lg)]], { joins: 'h_final>h_n' });   // off the arrow down to h_n
  const em = onLineAt(XL, 'e_mtp', hn.y1 + STAGE), en = onLineAt(XL, 'e_n', em.y1 + STAGE);
  place('gamma_e', 'rod', en.x0 - P_GAP - wOf('gamma_e', 'rod'), en.y0);
  const yk = (hn.y1 + em.y0) / 2;
  arrow('next_id', 'e_mtp', [[cx(nid), nid.y1 + PAD], [cx(nid), yk], [em.x0 + Tw * .3, yk], [em.x0 + Tw * .3, em.y0 - PAD]]);
  arrow('e_mtp', 'e_n', [[cx(em), em.y1 + PAD], [cx(em), en.y0 - PAD]]);
  const K = N, LM = per[K], mrin = LM.B.residual_in;
  const mdx = XL, mdy = en.y1 + STAGE - mrin.y0;
  put(K, LM, mdx, mdy);
  const r45 = B[lid(K) + ':residual_in'];
  const Weh = place('W_eh', 'wl', r45.x0 - GAP_W - wOf('W_eh', 'wl'), r45.y0);
  arrow('W_eh', r45.id, [[Weh.x1 + PAD, cy(r45)], [r45.x0 - PAD, cy(r45)]]);
  const xa = r45.x0 + Tw * .35, xb = r45.x0 + Tw * .7;
  arrow('e_n', r45.id, [[en.x1 + PAD, cy(en)], [xa, cy(en)], [xa, r45.y0 - PAD]]);
  arrow('h_n', r45.id, [[hn.x1 + PAD, cy(hn)], [xb, cy(hn)], [xb, r45.y0 - PAD]]);
  // …its output → RMSNorm → the same output head (its arrow down the left) → the draft
  const mb = Math.max(...blocks.filter(b => b.layer === K).map(b => b.y1)), mout = B[lid(K) + ':residual_out'];
  const hmt = onLineAt(XL, 'h_mtp', mb + STAGE);
  place('gamma_sh', 'rod', hmt.x0 - P_GAP - wOf('gamma_sh', 'rod'), hmt.y0);
  arrow(mout.id, 'h_mtp', [[cx(mout), mout.y1 + PAD], [cx(mout), cy(hmt)], [hmt.x1 + PAD, cy(hmt)]], { spine: true, w: 3 });
  const lm = vocab('logits_mtp', 'row', Wh.x1, hmt.y1 + GAP_V), dr = place('draft_id', 'col', lm.x1 - ROW, lm.y1 + GAP_V);
  arrow('h_mtp', 'logits_mtp', [[cx(hmt), hmt.y1 + PAD], [cx(hmt), cy(lm)], [lm.x1 + PAD, cy(lm)]]);
  const Wh0 = left(Wh), xl = Wh0.x0 - 8;   // (from the head's left end, into the scores' left end)
  arrow('W_head', 'logits_mtp', [[Wh0.x0 - PAD, cy(Wh)], [xl, cy(Wh)], [xl, cy(lm)], [left(lm).x0 - PAD, cy(lm)]], { lane: 1 });
  arrow('logits_mtp', 'draft_id', [[cx(dr), lm.y1 + PAD], [cx(dr), dr.y0 - PAD]]);

  for (const t of M.ends.tensors) if (!B[t.id]) throw new Error('not placed: ' + t.id);
  const bounds = { x0: Math.min(...blocks.map(b => b.x0)), x1: Math.max(...blocks.map(b => b.x1)), y0: Math.min(...blocks.map(b => b.y0)), y1: Math.max(...blocks.map(b => b.y1)), z0: Math.min(...blocks.map(b => b.z0)), z1: 0 };
  return { blocks, arrows, B, bounds, elide, widest, PIECE, P, COLS, colX, rowTop, rowH, rowsBottom, per, T, Tw, heads };
}
