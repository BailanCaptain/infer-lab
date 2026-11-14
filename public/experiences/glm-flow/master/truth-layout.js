// Drawing rules for one layer (prototype, 2026-09-23). The five rules the user agreed to:
//  1 one ruler   every number along a feature / weight / state axis is DIM long (256 numbers = one 2.048 cell),
//                on both sides of a weight; nothing is squeezed or stretched per block
//  2 one word    a word is one row of ROW (2 cells, A2b) in every data block; rows line up across a whole line
//  3 co-axis     a weight stands right on top of what it produces: its output side runs along the output's columns,
//                same length, same head plates; its input side stands up (the input comes earlier in reading order)
//  4 countable   heads, experts and the 4 residual streams are slices standing one behind another, touching (v8)
//                with a line between them; the
//                page puts a ruler along the depth of a head or expert stack ("64 个头", "288 个专家")
//  5 complete    every tensor of truth-spec.js gets exactly one block
// History: v3 cut heads side by side along their axis — the user found it ugly ("横着太难看了") and asked for the standing
// stack (v4): a head slab is a quarter cell thick with a gap as wide as the slab, neighbouring heads alternate shade.
// The side-by-side cut, the slab-thickness comparison and the packings the user did not take (tight / units / spine)
// were archived on 09-23 (backups/20260923-before-tidy/ holds this file with them).
// v5 (the user: "其他的还有薄片感吗"): a block without a real third axis is as deep as a word row (2 cells), so every
// word of a data block is a square bar, not a strip of paper; a block narrower or flatter than that is as deep as its
// own thinnest side (a rod, never a fin or a plank); heads that sit on a weight's standing input side (W_o) are
// stacked up that side, one band per head, instead of lying back in depth as a flat tray.
// v6 (the other two kinds of layer): experts are slices like heads (288 thin slabs, same thickness and gap); the 8
// picks of every word are whole copies like the streams (thick slabs with a gap), so they never line up one-to-one with
// expert slabs — which expert a pick is, is only known by running the model. An attention matrix has words on both
// sides, each as wide as a word row is high. The indexer's compressed key sits across the words it compresses.
// Anything thinner than MIN in truth is drawn MIN and flagged (`thin`), so the page can say "实际更细".
// v7 (09-23, borrowed from the references, the user: "1感觉还可以"): an expert stack stands in 4 tiers of 72 instead of
// one stack of 288 — 74 deep instead of 295, see EXPERT_TIERS (`experts: 1` would be the v6 single stack).
// v8 (09-24; the user: "没有矩阵感，像方片……以本层输入为例子，块之间白色太多，放大了看就像纸片"): no white inside a
// tensor. Word rows, the 4 streams, the 8 picks, heads, experts and W_o's head bands touch (SEAM, STREAM_GAP, the gap
// between slices and CUT are 0); a thin line between cells tells them apart (truth-look.js). White is left only between
// tensors, and between the 4 tiers of experts (a tier is a group of experts, not an axis). v7 is in
// backups/20260924-before-matrix/.
export const DIM = 2.048 / 256, CELL = 2.048, ROW = 2 * CELL, SEAM = 0, MIN = .12;
export const DEPTH = ROW, STREAM_GAP = 0;                        // blocks without a third axis: one word row deep; streams touch
export const depthFor = (w, h) => Math.min(DEPTH, w, h);          // …or as deep as their thinnest side: a rod, never a fin
export const HEAD_THICK = CELL / 4, HEAD_PITCH = HEAD_THICK;      // head / expert slices, touching (v4–v7: a gap as wide as a slice)
export const CUT = 0, HEAD_MIN = .4;                               // heads up a standing side (W_o): touching (v4–v7: a slit)
// spacing (v2, the user found v1 cramped): every step the same breathing room, the lines well apart; a column whose
// slabs recede in depth gets a slot as wide as it is deep, so seen from three quarters one stack never hides the next
export const GAP = 16, W_GAP = 3, P_GAP = 1.2, LINE_GAP = 44;
// v6: seen from above at three quarters, a stack D deep rises about 0.3·D on the page as it recedes (0.32 measured with
// perspective in the whole-layer view); the line above a deep stack stands that much higher (plus a gap), so the stack
// recedes into open space instead of under the next line. Never less than LINE_GAP, so the lines of L00 (stacks at most
// 65 deep) keep their v5 spacing exactly.
export const RISE = .32;
export const rowsH = n => n * ROW + (n - 1) * SEAM;
export const SLICES = new Set(['head', 'expert']), COPIES = new Set(['stream', 'pick']);
// v7 (09-23; the user picked it from the references, "专家叠成 4 排"): an expert stack stands in `experts` tiers, one
// above another up the weight's standing input side — tier 1 (experts 1–72) at the bottom, on the picks — each tier as
// many slabs deep as the tiers share out (288 / 4 = 72). Every slab keeps its true size and its gap, so every expert can
// still be counted; the stack is 74 deep instead of 295, about as deep as the 64 heads (65).
export const EXPERT_TIERS = 4, TIER_GAP = P_GAP;
export const slabsOf = b => b.pieces ? b.pieces.length : b.zs.length * (b.tiers ? b.tiers.length : 1);

// Reading order, line by line like text, in the official forward order. Each half of the layer brings its own lines.
export const LINES = {
  // KDA: q/k/v 644–650, conv 676–685, g 698, beta 699, KDA 715, output gate 731, o_norm 732, o_proj 733
  kda: { attn1: ['residual_in', 'coef_attn', 'collapsed_attn', 'x_attn', 'Q', 'K', 'V', 'Q_conv', 'K_conv', 'V_conv'],
         attn2: ['f_a', 'g', 'beta', 'core_out', 'g_a', 'gate', 'o_normed', 'attn_out', 'residual_mid'] },
  // MLA: q 1169–1170, kv 1172–1177, indexer 1183–1189 (799–879), mask 1195, attention 1205, o_proj 1217
  mla: { attn1: ['residual_in', 'coef_attn', 'collapsed_attn', 'x_attn', 'q_a', 'q_resid', 'Q', 'kv_a', 'c_kv', 'KV'],
         attn2: ['iq', 'ik_raw', 'ik', 'cg', 'pool_k', 'iscore', 'iw', 'isum', 'topk'],
         attn3: ['mask', 'attn_w', 'attn_o', 'attn_out', 'residual_mid'] },
  dense: { ffn: ['coef_ffn', 'collapsed_ffn', 'x_ffn', 'gate_ffn', 'up_ffn', 'h_ffn', 'ffn_out', 'residual_out'] },
  // MoE: router 204, routed experts 206, shared expert and the sum 207
  // (the line breaks right after the down experts, so the stack of 288 recedes at the end of its line, into open space)
  moe: { ffn1: ['coef_ffn', 'collapsed_ffn', 'x_ffn', 'logits', 'topk_i', 'topk_w', 'e_gu', 'e_h', 'e_out'],
         ffn2: ['routed', 's_gate', 's_up', 's_h', 's_out', 'ffn_out', 'residual_out'] },
};

export function layoutLayer(spec, { experts = EXPERT_TIERS } = {}) {   // experts: how many tiers an expert stack stands in
  const byId = new Map(spec.tensors.map(t => [t.id, t])), writer = new Map(), standing = new Map(), placed = new Set();
  for (const s of spec.steps) for (const w of s.writes) writer.set(w, s);
  for (const t of spec.tensors) if (t.standOn) standing.set(t.standOn, [...(standing.get(t.standOn) || []), t.id]);
  const blocks = [], TH = rowsH(spec.dims.T);
  const len = n => { const v = n * DIM; return { v: Math.max(v, MIN), thin: v < MIN, truth: v } }, words = n => ({ v: rowsH(n), thin: false, truth: rowsH(n) });
  const put = (t, x0, y0, extra = {}) => {
    const kind = t.deck?.kind, n = t.deck?.n || 1, H = SLICES.has(kind) ? n : 1, alongY = t.headAxis === 'y';
    const colW = t.colsUnit === 'token' ? rowsH(t.cols) : t.cols * DIM, perHead = colW >= HEAD_MIN || alongY;
    // one number per head (β, W_b, A_log, the indexer's per-head scores) is never split: its numbers stay side by side
    const split = H > 1 && (perHead || t.rows.unit === 'token' && t.cols > 1) && !(t.cols === 1 && !alongY);
    const inDepth = split && !alongY, flatH = inDepth ? 1 : H;   // heads on a standing input side go up that side
    const w = t.colsUnit === 'token' ? words(t.cols) : len(t.cols * (alongY ? 1 : flatH));
    const h = t.rows.unit === 'token' ? words(spec.dims.T) : t.rows.unit === 'pool' ? words(t.rows.n * t.rows.size) : len(t.rows.n * (alongY ? flatH : 1));
    if (t.rows.unit === 'pool') y0 += TH - h.v;   // across the words it compresses: the first ones, at the top
    const b = { id: t.id, t, kind: t.kind, comp: t.comp, x0, x1: x0 + w.v, y0, y1: y0 + h.v, thinW: w.thin, thinH: h.thin, trueW: w.truth, trueH: h.truth, ...extra };
    if (COPIES.has(kind)) { b.thick = depthFor(w.v, h.v); b.zs = Array.from({ length: n }, (_, i) => -i * (b.thick + STREAM_GAP)) }
    else if (inDepth) {
      const tiers = kind === 'expert' ? experts : 1, per = H / tiers;
      if (!Number.isInteger(per)) throw new Error(`${H} experts do not share out into ${tiers} tiers`);
      b.thick = HEAD_THICK; b.zs = Array.from({ length: per }, (_, i) => -i * HEAD_PITCH); b.headStack = true;
      if (tiers > 1) { b.tierH = b.y1 - b.y0; b.tiers = Array.from({ length: tiers }, (_, j) => j * (b.tierH + TIER_GAP)); b.y1 = b.y0 + tiers * b.tierH + (tiers - 1) * TIER_GAP }
    }
    else { b.thick = depthFor(w.v, h.v); b.zs = [0] }
    const per = (alongY ? h.v : w.v) / H;
    b.pieces = split && alongY && H > 1 && per >= HEAD_MIN ? Array.from({ length: H }, (_, i) =>
      ({ x0: b.x0, x1: b.x1, y0: b.y1 - (i + 1) * per + CUT / 2, y1: b.y1 - i * per - CUT / 2 })) : null;
    blocks.push(b); placed.add(t.id); return b;
  };
  // params of the step that wrote `out`, stacked on top of it: vectors first, then the matrix (weight or state); a
  // param that names another block (`standOn`, e.g. the router's bias over the 288 scores it shifts) stands there instead
  const above = (out, line) => {
    const s = writer.get(out.id), own = s ? [...s.params, ...(s.op === 'kda' ? ['state'] : [])].filter(id => !byId.get(id).standOn) : [];
    const ids = [...(standing.get(out.id) || []), ...own].filter(id => !placed.has(id));
    const vecs = ids.filter(i => byId.get(i).vector), mats = ids.filter(i => !byId.get(i).vector);
    let y = out.y1 + W_GAP;
    for (const id of [...vecs, ...mats]) { const b = put(byId.get(id), out.x0, y, { line, on: out.id }); y = b.y1 + P_GAP }
  };
  const lines = { ...LINES[spec.attnKind], ...LINES[spec.ffnKind] };
  const z0 = b => b.zs.at(-1) - b.thick, depthOf = b => -z0(b);
  const placeLine = (name, y0) => {
    let x = 0;
    for (const id of lines[name]) {
      if (x > 0) x += GAP;
      const n0 = blocks.length, b = put(byId.get(id), x, y0, { line: name }); above(b, name);
      const deep = Math.max(...blocks.slice(n0).map(depthOf));
      x = Math.max(b.x1, deep > 3 * CELL ? b.x0 + deep : b.x1);
    }
  };
  // bottom-up so each line clears the weights standing on the line below it
  let y = 0;
  for (const name of Object.keys(lines).reverse()) { const n0 = blocks.length, bs = (placeLine(name, y), blocks.slice(n0)); y = Math.max(...bs.map(b => b.y1)) + Math.max(LINE_GAP, RISE * Math.max(...bs.map(depthOf)) + GAP) }
  const boundsOf = bs => ({ x0: Math.min(...bs.map(b => b.x0)), x1: Math.max(...bs.map(b => b.x1)), y0: Math.min(...bs.map(b => b.y0)), y1: Math.max(...bs.map(b => b.y1)), z0: Math.min(...bs.map(z0)), z1: 0 });
  return { blocks, bounds: boundsOf(blocks), lines: Object.fromEntries(Object.keys(lines).map(n => [n, boundsOf(blocks.filter(b => b.line === n))])), order: lines, TH, byId, writer, experts };
}
