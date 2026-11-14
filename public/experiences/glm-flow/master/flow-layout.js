// One layer laid out the way bbycroft.net/llm lays out GPT (the master, since 2026-09-24). All three kinds of layer of the config:
// KDA + dense feed-forward (L00–L02), KDA + MoE (31 layers), sparse attention MLA + indexer + MoE (L03, L07, … L43).
// The user: "bbycroft 的排布就特别好，也是真实权重，但是他能对齐的都对齐了，他也是按照真实的计算对齐的"; "你看他的输出一直在
// 一条线上，权重都是从左到右，有组织的，你看他的箭头！"; "QKV 这些头正式布局的时候别竖着放，横着放，跟参考一样"; layer 0
// approved ("对对对，就是这个感觉"), then "为啥其他的不排……一定要排布正确，数据流动方向正确，模型不是假的".
// Its rules (src/llm/GptModelLayout.ts, src/llm/components/Arrow.ts), kept at our true scale (256 numbers = one 2.048
// cell, a word = ROW):
//  - a word is a column running along x; a tensor's numbers run down y; heads (and streams, and the 8 picks of every
//    word) run back in depth, so a head is a flat plate lying one behind another, as bbycroft's Q / K / V weights are
//  - the residual stream is a spine on the right; each half of the layer leaves it at the top and comes back into it
//    at the bottom (arrows to the right)
//  - results sit on one output line, right-aligned at X_OUT next to the spine; a weight sits left of its result at the
//    same height (its output side down y, its input side along x), head slice for head slice; weights point right
//  - a feed-forward's hidden runs along x under its weights, as bbycroft's MLP does, so both of its matmuls line up on
//    both sides: every weight that reads the RMSNorm output is as tall as it (4096), its result as wide as the weight,
//    and the down projection as wide as the hidden it reads and as tall as its output
//  - data comes into a result from above or from the right, weights from the left; the projections of the attention's
//    input are one group (one arrow in), a row each: weight → result (→ its own small step → result); results needed
//    further down reach it on lanes right of the output line, nested so that no two arrows cross
// Layout coordinates here run down (y grows downward, as in bbycroft); `toWorld` flips them for three.js.
import { DIM, ROW, MIN, DEPTH, HEAD_THICK, depthFor } from './truth-layout.js';

export const DEEP_GAP = 18, X_OUT = 0, CH = 18, GAP_W = 8, GAP_V = 8, STAGE = 12, TIGHT = 2, P_GAP = 1.2, PAD = .9, LANE1 = 5, LANE2 = 11;
// a stack of experts is as deep as a stack of 64 heads (288 slices, each 64/288 of a head's thickness): one stack,
// true in x and y, so an expert's input side lines up with the RMSNorm output it reads (v7's 4 tiers stood up that side)
export const HEAD_STACK = 64 * HEAD_THICK;
// heads stand apart (09-25; the user: "留缝好"): the room between two heads, in head thicknesses. 3 keeps the whole model's
// proportions (7 made it tall and narrow, its layer names ran together); 0 = the heads touching (?slabs=touch)
export const HEAD_GAP = 3;
const cells = n => Math.max(1, Math.round(n / 256));
const len = n => { const v = n * DIM; return { v: Math.max(v, MIN), thin: v < MIN, truth: v } };
const exact = v => ({ v, thin: false, truth: v });

// the extents of a tensor in an orientation:
//  'col' data, a word per column: T words along x, its numbers down y, heads / streams / picks back in depth
//        (an attention matrix: its other words down y, a word as tall as it is wide; the indexer's compressed keys:
//        one per group of words, across the words it compresses)
//  'row' data, a word per row (a feed-forward's hidden): its numbers along x, T words down y, picks back in depth
//  'wl'  a weight left of its result: input along x, output down y (per head), heads / experts back in depth
//  'wt'  a weight above its result (a feed-forward): output along x, input down y, experts back in depth
//  'rod' a vector left of what it scales: one number wide, its numbers down y, heads back in depth
//  'bar' a vector over a word-per-row block: its numbers along x, one number tall
// `cut`: the axes with lines — only where the model really splits the tensor (words, heads, streams, picks, experts).
// A cell of 256 numbers stays the ruler of every size, but draws no line (09-25; the user: "你都画出来 4096 了，切的意义
// 是啥……这样让人看的好疑惑": the 16 cells of a 4096 read as 16 pieces, and nothing in the model cuts there)
export function shapeOf(t, o, HX = 'z', gap = 0) {
  const Tn = t.rows.n, Tw = Tn * ROW;   // words (a data tensor's rows); the layer's own T for every tensor of a layer
  const deck = t.deck, H = deck?.n || 1, heads = deck && (deck.kind === 'head' || deck.kind === 'expert'), perHead = heads && t.cols > 1;
  // heads back in depth; one number per head (β, W_b) stays one block with its H numbers down y — except as a rod
  // (A_log: one number per head, back in depth beside the heads it scales); W_o's heads run along its input (x)
  // (the switch is about heads: experts stay back in depth either way)
  // (t.headsDown: this tensor's heads down y whatever HX — one still flat in the code, cut into heads only later)
  const hd = t.headsDown && deck?.kind === 'head';
  const inDepth = ((HX === 'z' && !hd) || deck?.kind === 'expert') && heads && (perHead || o === 'rod'), down = (HX === 'y' || hd) && deck?.kind === 'head' && perHead && t.headAxis !== 'y';
  const slice = deck?.kind === 'expert' ? HEAD_STACK / H : HEAD_THICK * (1 + gap);   // gap: room between heads, in head thicknesses (09-25 trial)
  const back = !deck || t.headAxis === 'y' ? null : heads ? (inDepth ? H * slice : null) : H * DEPTH;
  const along = heads && !perHead ? H : down ? t.cols * H : t.cols;                     // one number per head: its H numbers down y; heads down y: all of them
  const rowsDown = down ? H : null;                                                     // …then one cell row per head
  const z = back ? H : 1;
  let w, h, div, cut;
  if (o === 'col') {
    const pool = t.rows.unit === 'pool';
    w = pool ? exact(t.rows.n * t.rows.size * ROW) : exact(Tw);
    h = t.colsUnit === 'token' ? exact(t.cols * ROW) : len(along);
    div = [pool ? t.rows.n : Tn, t.colsUnit === 'token' ? t.cols : rowsDown || cells(along), z]; cut = [1, t.colsUnit === 'token' || rowsDown ? 1 : 0];
  }
  else if (o === 'row') { w = len(t.cols); h = exact(Tw); div = [cells(t.cols), Tn, z]; cut = [0, 1] }
  else if (o === 'wl') {
    if (t.headAxis === 'y') { w = len(t.rows.n * H); h = len(t.cols); div = [H, cells(t.cols), 1]; cut = [1, 0] }   // W_o: its 64 heads side by side along its input
    else { w = len(t.rows.n); h = len(along); div = [cells(t.rows.n), rowsDown || cells(along), z]; cut = [0, rowsDown ? 1 : 0] }
  }
  else if (o === 'wt') { w = len(t.cols); h = len(t.rows.n); div = [cells(t.cols), cells(t.rows.n), z]; cut = [0, 0] }
  else if (o === 'rod') { w = len(t.taps ? t.rows.n : 1); h = len(down ? t.cols * H : t.cols); div = [1, rowsDown || cells(t.cols), z]; cut = [0, rowsDown ? 1 : 0] }   // a conv kernel: its 4 taps along x
  else if (o === 'bar') { w = len(t.cols); h = len(1); div = [cells(t.cols), 1, 1]; cut = [0, 0] }
  const d = back || depthFor(w.v, h.v); cut.push(div[2] > 1 ? 1 : 0);
  const alt = t.headAxis === 'y' ? 'x' : down ? 'y' : back ? 'z' : null;
  return { w: w.v, h: h.v, d, div, cut, alt, thinW: w.thin, thinH: h.thin, trueW: w.truth, trueH: h.truth, headGap: back && deck?.kind === 'head' ? gap : 0 };
}

// heads: 'y' — a head is a flat band, the 64 bands one under another in the plane, facing the reader (nothing hides
// anything); 'z' — a head is a flat plate, the 64 plates one behind another in depth (bbycroft's way; at GLM's true
// scale a head is 128 numbers, so the plates are thin and, seen from above, stack up)
// ROW_GAP: between the rows of a group. Heads back in depth make a row 32.8 deep; seen from the page's camera (about
// 20° above) a plate that deep rises about 12 on the screen, so rows of plates stand far enough apart not to hide
// each other's plates; bands facing the reader need only the ordinary gap
export function layoutFlow(spec, { heads: HX = 'z', gap = HEAD_GAP } = {}) {
  // (with room between heads the plates run deeper and rise higher on the screen: the rows stand that much further apart)
  const ROW_GAP = HX === 'z' ? 15 + .32 * 64 * HEAD_THICK * gap : GAP_V;
  const T = spec.dims.T, Tw = T * ROW, byId = new Map(spec.tensors.map(t => [t.id, t])), blocks = [], arrows = [], B = {};
  const XS = X_OUT + CH, XR = X_OUT - Tw, XM = XR - GAP_W - Tw;   // the spine, the output line, the middle column

  const shape = (t, o) => shapeOf(t, o, HX, gap);
  function put(id, o, x0, y0, extra = {}) {
    const t = byId.get(id); if (!t) throw new Error('no tensor ' + id); if (B[id]) throw new Error('placed twice: ' + id);
    const s = shape(t, o), b = { id, t, kind: t.kind, comp: t.comp, orient: o, x0, x1: x0 + s.w, y0, y1: y0 + s.h, z0: -s.d, z1: 0, ...s, ...extra };
    blocks.push(b); B[id] = b; return b;
  }
  const w = (id, o) => shape(byId.get(id), o).w;
  const leftOf = (id, o, of, gap, extra) => put(id, o, of.x0 - gap - w(id, o), of.y0, extra);
  const onLine = (id, y, extra) => put(id, 'col', XR, y, { line: 'out', ...extra });
  const cx = b => (b.x0 + b.x1) / 2, cy = b => (b.y0 + b.y1) / 2;
  const bottom = bs => Math.max(...bs.filter(Boolean).map(b => b.y1));
  // an arrow: a path of points (layout coordinates), from a block to a block; `head` false for a lane's stubs
  const arrow = (from, to, pts, extra = {}) => arrows.push({ from, to, pts, head: true, w: extra.spine ? 3 : extra.lane ? 1.6 : 2, ...extra });
  const down = (a, b, extra) => arrow(a.id, b.id, [[cx(a), a.y1 + PAD], [cx(a), b.y0 - PAD]], extra);                  // straight down the line
  const across = (a, b, extra) => arrow(a.id, b.id, [[a.x1 + PAD, cy(b)], [b.x0 - PAD, cy(b)]], extra);                // a weight into its result
  // small parameters standing right against a result, right to left (a conv kernel, a norm's γ, W_f_b …)
  const against = (r, pids) => {
    let x = r.x0 - .8; const ps = [];
    for (const pid of [...pids].reverse()) { const t = byId.get(pid), o = t.kind === 'weight' && !t.vector && !t.taps ? 'wl' : 'rod'; const p = put(pid, o, x - w(pid, o), r.y0, { grp: r.grp }); ps.unshift(p); x = p.x0 - .4 }
    return ps;
  };
  // results further down reach their consumer on a lane right of the output line: each source's stub joins the lane,
  // the lane runs down and comes into the target from the right (lanes nest, so no stub crosses another lane)
  const lane = (srcs, t, x, n) => {
    for (const s of srcs.slice(1)) arrow(s.id, t.id, [[s.x1 + PAD, cy(s)], [x, cy(s)]], { head: false, lane: n });
    arrow(srcs[0].id, t.id, [[srcs[0].x1 + PAD, cy(srcs[0])], [x, cy(srcs[0])], [x, cy(t)], [t.x1 + PAD, cy(t)]], { lane: n });
  };

  // ---- the head of a half: the spine's 4 streams → 24 mixing numbers → 1 stream → RMSNorm (on the output line)
  function mhcHead(site, input, y0, fromSpine) {
    const coef = onLine(`coef_${site}`, y0), fn = leftOf(`fn_${site}`, 'wl', coef, GAP_W);
    const scale = leftOf(`scale_${site}`, 'rod', fn, P_GAP); leftOf(`base_${site}`, 'rod', scale, P_GAP);
    const col = onLine(`collapsed_${site}`, coef.y1 + 4), x = onLine(`x_${site}`, col.y1 + STAGE);
    leftOf(`gamma_${site}`, 'rod', x, P_GAP);
    fromSpine(coef, col);
    arrow(`fn_${site}`, coef.id, [[fn.x1 + PAD, cy(coef)], [coef.x0 - PAD, cy(coef)]], { w: 1.2 });
    arrow(coef.id, col.id, [[cx(coef), coef.y1 + .3], [cx(coef), col.y0 - .3]], { w: 1.2 });
    down(col, x);
    return x;
  }
  // ---- the head of a half in the MTP layer (one stream, no mHC): the RMSNorm on the line reads the spine straight, off
  // a split beside the spine's own arrow (as the feed-forward half's mHC reads the spine)
  function plainHead(site, input, y0) {
    const x = onLine(`x_${site}`, y0), split = input.x0 + 3;
    leftOf(`gamma_${site}`, 'rod', x, P_GAP);
    arrow(input.id, x.id, [[split, input.y1 + PAD], [split, cy(x)], [x.x1 + PAD, cy(x)]], { lane: 3, w: 2 });
    return x;
  }
  // ---- the tail of a half: its output on the line → back into the spine
  function writeBack(out, prev, id) {
    const r = put(id, 'col', XS, out.y0, { line: 'spine' });
    arrow(out.id, id, [[out.x1 + PAD, cy(out)], [r.x0 - PAD, cy(out)]]);
    arrow(prev.id, id, [[cx(prev), prev.y1 + PAD], [cx(prev), r.y0 - PAD]], { spine: true });
    return r;
  }

  // ---- attention, linear (KDA): the six projections of x_attn, one group: each row weight → result (→ its own small
  // step → result on the line); the five inputs of the KDA step gathered by one lane, the output gate on an outer lane
  function kda(xA) {
    let y = xA.y1 + STAGE;
    const ROWS = [['W_g_a', 'g_a', ['W_g_b'], 'gate'], ['W_q', 'Q', ['conv_q'], 'Q_conv'], ['W_k', 'K', ['conv_k'], 'K_conv'], ['W_v', 'V', ['conv_v'], 'V_conv'],
                  ['W_f_a', 'f_a', ['W_f_b', 'dt_bias', 'A_log'], 'g'], ['W_b', 'beta', [], null]];
    const group = [];
    for (const [wid, mid, pids, rid] of ROWS) {
      const m = put(mid, 'col', XM, y, { line: 'mid', grp: true }), wb = leftOf(wid, 'wl', m, GAP_W, { grp: true });
      across(wb, m);
      let r = null;
      if (rid) { r = onLine(rid, y, { grp: true }); const ps = against(r, pids); arrow(mid, ps[0].id, [[m.x1 + PAD, cy(m)], [ps[0].x0 - PAD, cy(m)]], { into: rid }) }
      group.push({ m, r, wb }); y = Math.max(m.y1, r ? r.y1 : 0, wb.y1) + ROW_GAP;
    }
    const top = group[0].m;
    arrow('x_attn', 'g_a', [[cx(xA), xA.y1 + PAD], [cx(xA), (xA.y1 + top.y0) / 2], [cx(top), (xA.y1 + top.y0) / 2], [cx(top), top.y0 - PAD]]);
    // the KDA step one row gap below the group, so the deep plates of core_out stay clear of the stub from beta
    const core = onLine('core_out', y), S = put('state', 'wl', XM + Tw - w('state', 'wl'), y);   // S: 64 heads × [128, 128], back in depth
    arrow('state', 'core_out', [[S.x1 + PAD, cy(core)], [core.x0 - PAD, cy(core)]]);
    const ins = ['Q_conv', 'K_conv', 'V_conv', 'g', 'beta'].map(id => B[id]), l1 = X_OUT + LANE1;
    for (const b of ins) arrow(b.id, 'core_out', [[b.x1 + PAD, cy(b)], [l1, cy(b)]], { head: false, lane: 1 });
    arrow(ins[0].id, 'core_out', [[l1, cy(ins[0])], [l1, cy(core)], [core.x1 + PAD, cy(core)]], { lane: 1 });
    const on = onLine('o_normed', core.y1 + ROW_GAP);
    leftOf('gamma_o', 'rod', on, P_GAP);
    down(core, on);
    const gate = B.gate, l2 = X_OUT + LANE2;
    arrow('gate', 'o_normed', [[gate.x1 + PAD, cy(gate)], [l2, cy(gate)], [l2, cy(on)], [on.x1 + PAD, cy(on)]], { lane: 2 });
    const aout = onLine('attn_out', on.y1 + ROW_GAP), Wo = leftOf('W_o', 'wl', aout, GAP_W);
    down(on, aout); across(Wo, aout);
    return aout;
  }

  // ---- attention, sparse (MLA with its DSA indexer). Two columns in the middle, since K V and Q are each squeezed
  // first (to 512 / 1536 numbers), normed, then spread into the 64 heads. The group, a row each (all read x_attn):
  //   KV   W_kv_a → kv_a → γ → c_kv → W_kv_b → K|V (line)
  //   iw   W_iw → the indexer's per-head weights (middle)
  //   cg   W_cg → the pool's gate scores (middle), down into the pool below
  //   ik   W_ik → the indexer's K → LayerNorm → ape → one K per 4 words (line)
  //   Q    W_q_a → q_a → γ → q_resid (second middle column), which runs down that column to W_iq and W_q_b
  // then down the line: the indexer's Q, its scores, their sum, the top k, the mask, Q, the attention weights, the
  // attention output, W_o. Lanes, inner to outer: pool → scores, iw → sum, K|V and the mask → weights, K|V → output
  function mla(xA) {
    const XC2 = XR - GAP_W - w('W_q_b', 'wl') - .8 - Tw, XC1 = XC2 - 3 - GAP_W - Tw;   // second, first middle column
    let y = xA.y1 + STAGE;
    const row = (wid, mid, x, extra = {}) => { const m = put(mid, 'col', x, y, { line: 'mid', grp: true, ...extra }), wb = put(wid, 'wl', XC1 - GAP_W - w(wid, 'wl'), y, { grp: true }); across(wb, m); return m };
    const into = (m, r, pids) => { const ps = against(r, pids); arrow(m.id, ps[0].id, [[m.x1 + PAD, cy(m)], [ps[0].x0 - PAD, cy(m)]], { into: r.id }) };
    const next = bs => { y = bottom(bs) + ROW_GAP };
    // KV
    const kv_a = row('W_kv_a', 'kv_a', XC1), c_kv = put('c_kv', 'col', XC2, y, { line: 'mid', grp: true }), KV = onLine('KV', y, { grp: true });
    into(kv_a, c_kv, ['gamma_kv_a']); into(c_kv, KV, ['W_kv_b']);
    next([kv_a, c_kv, KV, B.W_kv_a]);
    // iw
    const iw = row('W_iw', 'iw', XC1); next([iw, B.W_iw]);
    // cg, then ik and the pool
    const cg = row('W_cg', 'cg', XC1); next([cg, B.W_cg]);
    const ik_raw = row('W_ik', 'ik_raw', XC1), ik = put('ik', 'col', XC2, y, { line: 'mid', grp: true }), pool = put('pool_k', 'col', XR, y, { line: 'pool', grp: true });
    into(ik_raw, ik, ['ln_w', 'ln_b']); into(ik, pool, ['ape']);
    arrow('cg', 'pool_k', [[cg.x1 + PAD, cy(cg)], [cx(pool), cy(cg)], [cx(pool), pool.y0 - PAD]]);
    next([ik_raw, ik, pool, B.W_ik]);
    // Q
    const q_a = row('W_q_a', 'q_a', XC1), q_resid = put('q_resid', 'col', XC2, y, { line: 'mid', grp: true });
    into(q_a, q_resid, ['gamma_q_a']);
    next([q_a, q_resid, B.W_q_a]);
    arrow('x_attn', 'kv_a', [[cx(xA), xA.y1 + PAD], [cx(xA), (xA.y1 + kv_a.y0) / 2], [cx(kv_a), (xA.y1 + kv_a.y0) / 2], [cx(kv_a), kv_a.y0 - PAD]]);
    // down the line
    const onNext = (id, extra) => { const b = onLine(id, y, extra); y = b.y1 + ROW_GAP; return b };
    const iq = onNext('iq'), W_iq = against(iq, ['W_iq'])[0];
    const iscore = onNext('iscore'), isum = onNext('isum'), topk = onNext('topk'), mask = onNext('mask');
    const Q = onNext('Q'), W_q_b = against(Q, ['W_q_b'])[0];
    const attn_w = onNext('attn_w'), attn_o = onNext('attn_o');
    const aout = onLine('attn_out', y), Wo = leftOf('W_o', 'wl', aout, GAP_W);
    // q_resid down its column, into W_iq and into W_q_b
    for (const [wt, r] of [[W_iq, iq], [W_q_b, Q]]) arrow('q_resid', wt.id, [[cx(q_resid), q_resid.y1 + PAD], [cx(q_resid), cy(r)], [wt.x0 - PAD, cy(r)]], { into: r.id });
    down(iq, iscore); down(iscore, isum); down(isum, topk); down(topk, mask); down(Q, attn_w); down(attn_w, attn_o); down(attn_o, aout); across(Wo, aout);
    lane([pool], iscore, X_OUT + 3, 1);
    lane([iw], isum, X_OUT + 6, 2);
    lane([KV, mask], attn_w, X_OUT + 9, 3);
    lane([KV], attn_o, X_OUT + 12, 4);
    return aout;
  }

  // ---- feed-forward, dense SwiGLU (bbycroft's MLP): W_gate | W_up as tall as the RMSNorm output; gate | up under them;
  // SiLU(gate) × up; W_down as wide as that, and as tall as its output on the line
  function dense(xF) {
    const Wg = leftOf('W_gate', 'wt', xF, GAP_W), Wu = leftOf('W_up', 'wt', Wg, TIGHT);
    const g = put('gate_ffn', 'row', Wg.x0, Wg.y1 + GAP_V), u = put('up_ffn', 'row', Wu.x0, Wu.y1 + GAP_V);
    const hh = put('h_ffn', 'row', Wg.x0, g.y1 + GAP_V), Wd = put('W_down', 'wl', Wg.x0, hh.y1 + GAP_V);
    const fout = onLine('ffn_out', Wd.y0);
    arrow('x_ffn', 'gate_ffn', [[cx(xF), xF.y1 + PAD], [cx(xF), cy(g)], [g.x1 + PAD, cy(g)]]);
    arrow('W_gate', 'gate_ffn', [[cx(Wg), Wg.y1 + PAD], [cx(Wg), g.y0 - PAD]]);
    arrow('W_up', 'up_ffn', [[cx(Wu), Wu.y1 + PAD], [cx(Wu), u.y0 - PAD]]);
    down(g, hh);
    const mid = (g.y1 + hh.y0) / 2, into = hh.x0 + 8;
    arrow('up_ffn', 'h_ffn', [[cx(u), u.y1 + PAD], [cx(u), mid], [into, mid], [into, hh.y0 - PAD]]);
    arrow('h_ffn', 'ffn_out', [[hh.x1 + PAD, cy(hh)], [cx(fout), cy(hh)], [cx(fout), fout.y0 - PAD]]);
    across(Wd, fout);
    return fout;
  }

  // ---- feed-forward, MoE: the four weights that read the RMSNorm output stand in one row, each as tall as it (4096),
  // right to left: the router, the 288 routed experts' gate | up (one stack back in depth), the shared expert's gate
  // and up; each one's result right under it, a word per row. Then, as in the dense MLP: the routed experts' hidden
  // under their gate | up, their down projection under that, the shared expert's likewise one row lower (so its result
  // clears the routed experts' down). The router's scores → the router's bias → which 8 experts and their 8 weights:
  // the picks go into the experts' gate | up from the right, the weights join the hidden on its way to the down.
  function moe(xF) {
    const G = ROW_GAP;
    // the expert stacks (288 experts, 8 picks) are 32.8 deep; seen from the page's camera their right side shows about
    // 12 wide, so the router's column stands clear of it (DEEP_GAP), not hidden in the stack's side
    const Wr = leftOf('W_router', 'wt', xF, GAP_W), Wgu = leftOf('W_gu', 'wt', Wr, DEEP_GAP);
    const Wsg = leftOf('W_s_gate', 'wt', Wgu, GAP_W), Wsu = leftOf('W_s_up', 'wt', Wsg, TIGHT);
    const y1 = Wr.y1 + G;
    const logits = put('logits', 'row', Wr.x0, y1), egu = put('e_gu', 'row', Wgu.x0, y1);
    const sg = put('s_gate', 'row', Wsg.x0, y1), su = put('s_up', 'row', Wsu.x0, y1);
    // the router's bias stands on the two results of the choice (it shifts the scores only for choosing)
    const bias = put('e_bias', 'bar', logits.x0, logits.y1 + G);
    const y2 = bias.y1 + .8;
    // (the bias shifts the scores only for choosing, modeling 174–176: it stands on the choice, topk_i; the 8 weights
    // come from the unbiased scores, so topk_w stands right of the bias and takes its own arrow from the scores)
    const ti = put('topk_i', 'row', logits.x0, y2), tw = put('topk_w', 'row', logits.x1 + 1.5, y2);
    const eh = put('e_h', 'row', egu.x0, y2), sh = put('s_h', 'row', sg.x0, y2);
    const y3 = Math.max(eh.y1, ti.y1, sh.y1) + G;
    const Wdn = put('W_dn', 'wl', eh.x0, y3), eout = onLine('e_out', y3);
    const Wsd = put('W_s_down', 'wl', sh.x0, Wdn.y1 + G), sout = put('s_out', 'col', Wsd.x1 + GAP_W, Wsd.y0);
    const routed = onLine('routed', eout.y1 + G);
    const fout = onLine('ffn_out', Math.max(routed.y1, sout.y1) + G);
    // arrows
    arrow('x_ffn', 'logits', [[cx(xF), xF.y1 + PAD], [cx(xF), cy(logits)], [logits.x1 + PAD, cy(logits)]]);
    for (const [a, b] of [[Wr, logits], [Wgu, egu], [Wsg, sg], [Wsu, su]]) arrow(a.id, b.id, [[cx(a), a.y1 + PAD], [cx(a), b.y0 - PAD]]);
    arrow('logits', 'e_bias', [[cx(logits), logits.y1 + PAD], [cx(logits), bias.y0 - PAD]], { into: 'topk_i', w: 1.2 });
    arrow('logits', 'topk_w', [[logits.x1 + PAD, logits.y1 - 2], [cx(tw), logits.y1 - 2], [cx(tw), tw.y0 - PAD]], { w: 1.2 });
    const lx = egu.x1 + DEEP_GAP / 2;   // the corridor between the experts and the router
    arrow('topk_i', 'e_gu', [[ti.x0 - PAD, cy(ti)], [lx, cy(ti)], [lx, cy(egu)], [egu.x1 + PAD, cy(egu)]], { w: 1.2 });
    arrow('e_gu', 'e_h', [[cx(eh), egu.y1 + PAD], [cx(eh), eh.y0 - PAD]]);
    // the hidden on its way to the down projection's result; the 8 weights join it
    const yj = (Math.max(eh.y1, tw.y1) + y3) / 2, xh = eh.x1 + 4;
    arrow('e_h', 'e_out', [[eh.x1 + PAD, cy(eh)], [xh, cy(eh)], [xh, yj], [cx(eout), yj], [cx(eout), eout.y0 - PAD]]);
    arrow('topk_w', 'e_out', [[cx(tw), tw.y1 + PAD], [cx(tw), yj]], { head: false, lane: 5, w: 1.2 });
    across(Wdn, eout);
    down(sg, sh);
    const mid = (sg.y1 + sh.y0) / 2, into = sh.x0 + 4;
    arrow('s_up', 's_h', [[cx(su), su.y1 + PAD], [cx(su), mid], [into, mid], [into, sh.y0 - PAD]]);
    const xs = sh.x1 + 4, ys = (Wdn.y1 + Wsd.y0) / 2;
    arrow('s_h', 's_out', [[sh.x1 + PAD, cy(sh)], [xs, cy(sh)], [xs, ys], [cx(sout), ys], [cx(sout), sout.y0 - PAD]]);
    across(Wsd, sout);
    down(eout, routed); down(routed, fout);
    arrow('s_out', 'ffn_out', [[cx(sout), sout.y1 + PAD], [cx(sout), cy(fout)], [fout.x0 - PAD, cy(fout)]]);
    return fout;
  }

  // ---- the layer: the attention half, then the feed-forward half
  // (the MTP layer has one stream and no mHC: spec.mhc false)
  const rin = put('residual_in', 'col', XS, 0, { line: 'spine' });
  const xA = spec.mhc === false ? plainHead('attn', rin, rin.y1 + STAGE) : mhcHead('attn', rin, 0, (coef, col) => {
    arrow('residual_in', coef.id, [[rin.x0 - PAD, cy(coef)], [coef.x1 + PAD, cy(coef)]], { w: 1.2 });
    arrow('residual_in', col.id, [[rin.x0 - PAD, cy(col)], [col.x1 + PAD, cy(col)]]);
  });
  const aout = spec.attnKind === 'kda' ? kda(xA) : mla(xA);
  const rmid = writeBack(aout, rin, 'residual_mid');
  const split = rmid.x0 + 3;
  const xF = spec.mhc === false ? plainHead('ffn', rmid, aout.y1 + STAGE) : mhcHead('ffn', rmid, aout.y1 + STAGE, (coef, col) => {
    arrow('residual_mid', col.id, [[split, rmid.y1 + PAD], [split, cy(col)], [col.x1 + PAD, cy(col)]], { lane: 3, w: 2 });
    arrow('residual_mid', coef.id, [[split, cy(coef)], [coef.x1 + PAD, cy(coef)]], { lane: 3, w: 1.2 });   // a branch off the split
  });
  const fout = spec.ffnKind === 'dense' ? dense(xF) : moe(xF);
  writeBack(fout, rmid, 'residual_out');

  // every tensor of the layer, exactly once
  for (const t of spec.tensors) if (!B[t.id]) throw new Error('not placed: ' + t.id);
  const bounds = { x0: Math.min(...blocks.map(b => b.x0)), x1: Math.max(...blocks.map(b => b.x1)), y0: Math.min(...blocks.map(b => b.y0)), y1: Math.max(...blocks.map(b => b.y1)), z0: Math.min(...blocks.map(b => b.z0)), z1: 0 };
  return { blocks, arrows, B, bounds, T, Tw, X_OUT, XS, XR, XM, heads: HX };
}

// layout (y down) → world (y up): a block's box and an arrow's points
export const toWorld = b => ({ ...b, y0: -b.y1, y1: -b.y0 });
export const ptWorld = ([x, y]) => [x, -y];
