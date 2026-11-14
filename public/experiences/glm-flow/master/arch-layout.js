// The 2D diagrams of GLM-5.3-Flash (the master, since 2026-09-24), drawn the way Sebastian Raschka's LLM Architecture Gallery draws
// a model (the user: "有很好的 2D 图……我们在这一步就把 2D 图和所有的排好……一定要排布正确，数据流动方向正确，模型不是假的").
// Borrowed from it: one column for the whole model, from the words in to the scores out, with the 45 layers as one
// box; each part of a layer drawn again, larger, in a dotted panel beside it; the numbers that matter written on the
// boxes. Not borrowed: its order (it draws RMSNorm before the mHC mixer; the official code, lines 1295–1330, merges the
// 4 streams first, then RMSNorm) and its direction (here data runs down, as in the 3D layers).
// Every panel is built from truth-spec.js: a box is a step of the official forward, an arrow runs from the step that
// writes a tensor to every step that reads it, so no arrow is invented and none is left out. Only where a box stands is
// chosen here (GRIDS: column, row, span); qa-arch.mjs checks the rest.
export const CW = 142, GX = 16, RH = 50, GY = 34;   // a column, the gap between columns, a row, the gap between rows (px)
export const PITCH_X = CW + GX, PITCH_Y = RH + GY;

// which steps each panel draws (the rest of the layer is the mHC panel and the RMSNorms)
const MHC = new Set(['mix_attn', 'collapse_attn', 'norm_attn', 'write_attn', 'mix_ffn', 'collapse_ffn', 'norm_ffn', 'write_ffn']);
export const panelSteps = (spec, half) => spec.steps.filter(s => s.half === half && !MHC.has(s.id)).map(s => s.id);

// where each box stands: [column, row, span]. `in:` / `out:` are the panel's input and output (a tensor)
export const GRIDS = {
  kda: { 'in:x_attn': [0, 0, 6],
    proj_g_a: [0, 1], proj_q: [1, 1], proj_k: [2, 1], proj_v: [3, 1], proj_f_a: [4, 1], proj_b: [5, 1],
    proj_g_b: [0, 2], conv_q: [1, 2], conv_k: [2, 2], conv_v: [3, 2], forget_gate: [4, 2],
    kda: [1, 3, 5], o_norm: [0, 4, 2], proj_o: [0, 5, 2], 'out:attn_out': [0, 6, 2] },
  mla: { 'in:x_attn': [0, 0, 6],
    proj_q_a: [0, 1], idx_k: [2, 1], idx_gate: [3, 1], idx_w: [4, 1], proj_kv_a: [5, 1],
    norm_q_a: [0, 2], idx_k_norm: [2, 2], norm_kv_a: [5, 2],
    proj_q_b: [0, 3], idx_q: [1, 3], idx_pool: [2, 3, 2], proj_kv_b: [5, 3],
    idx_score: [1, 4, 2], idx_sum: [1, 5, 2], idx_topk: [1, 6, 2], mask: [1, 7, 2],
    attn_w: [0, 8, 4], attn_v: [0, 9, 4], proj_o: [0, 10, 4], 'out:attn_out': [0, 11, 4] },
  dense: { 'in:x_ffn': [0, 0, 2], proj_gate: [0, 1], proj_up: [1, 1], swiglu: [0, 2, 2], proj_down: [0, 3, 2], 'out:ffn_out': [0, 4, 2] },
  moe: { 'in:x_ffn': [0, 0, 5],
    router: [0, 1], s_gate: [3, 1], s_up: [4, 1],
    route: [0, 2], s_swiglu: [3, 2, 2],
    expert_gu: [1, 3, 2], s_down: [3, 3, 2],
    expert_swiglu: [1, 4, 2], expert_down: [1, 5, 2], combine: [1, 6, 2], moe_sum: [1, 7, 4], 'out:ffn_out': [1, 8, 4] },
  // the mHC around a half: the 4 streams in, the 24 mixing numbers, one stream out to the half, the write-back
  mhc: { 'in:residual_in': [0, 0, 3], mix_attn: [0, 1], collapse_attn: [1, 2], 'sub': [1, 3], write_attn: [1, 4], 'out:residual_mid': [1, 5] },
};
// an arrow out of a wide box that must come down another column than its target's, to clear the boxes in between
export const VIA = { mhc: { 'in:residual_in>write_attn': 2 } };
// names on the arrows where a step writes two things, or where the name says what goes where
export const EDGE_NAMES = { topk_i: '挑中的 8 个', topk_w: '8 个权重', coef_attn: '24 个系数', q_resid: 'q_resid', KV: 'K | V', attn_out: '子层输出' };

// a panel's graph: its steps (+ the mHC panel's stand-in for the half it wraps), the tensors that come in from
// outside (one `in:` box each) and the ones it hands on (`out:`); an edge for every (writer → reader) of a tensor
export function panelGraph(spec, key) {
  const grid = GRIDS[key];
  let steps;
  if (key === 'mhc') {
    const sub = { id: 'sub', title: '子层：RMSNorm → 注意力（或前馈）', reads: ['collapsed_attn'], writes: ['attn_out'], params: [], half: 'attn', pseudo: true };
    steps = [...spec.steps.filter(s => ['mix_attn', 'collapse_attn', 'write_attn'].includes(s.id)), sub];
  } else steps = panelSteps(spec, key === 'kda' || key === 'mla' ? 'attn' : 'ffn').map(id => spec.steps.find(s => s.id === id));
  const writer = new Map(); for (const s of steps) for (const w of s.writes) writer.set(w, s.id);
  const read = new Set(steps.flatMap(s => s.reads));
  const ins = [...new Set(steps.flatMap(s => s.reads).filter(r => !writer.has(r)))];
  // handed on: written here and read by nothing here (the KDA memory S goes to the cache, not on: it is noted on its box)
  const outs = [...writer.keys()].filter(w => !read.has(w) && w !== 'state');
  const nodes = [...ins.map(t => ({ id: 'in:' + t, tensor: t, io: 'in' })), ...steps.map(s => ({ id: s.id, step: s })), ...outs.map(t => ({ id: 'out:' + t, tensor: t, io: 'out' }))];
  const edges = [];
  for (const s of steps) for (const r of s.reads) edges.push({ from: writer.has(r) ? writer.get(r) : 'in:' + r, to: s.id, tensor: r });
  for (const t of outs) edges.push({ from: writer.get(t), to: 'out:' + t, tensor: t });
  for (const n of nodes) if (!grid[n.id]) throw new Error(`${key}: no place for ${n.id}`);
  for (const id of Object.keys(grid)) if (!nodes.some(n => n.id === id)) throw new Error(`${key}: ${id} is not in the panel`);
  return { nodes, edges };
}

// boxes at their places, arrows routed: out of a box's bottom, down to just above the target's row, across, down
// into its top. A box's arrows leave / arrive at ports spread along its edge, in the order of where they go / come from,
// so arrows that fan out or in do not cross each other; each arrow into a row turns at its own height in the gap.
export function panelLayout(spec, key) {
  const { nodes, edges } = panelGraph(spec, key), grid = GRIDS[key];
  const box = {};
  for (const n of nodes) { const [c, r, span = 1] = grid[n.id]; box[n.id] = { ...n, c, r, span, x0: c * PITCH_X, x1: c * PITCH_X + span * CW + (span - 1) * GX, y0: r * PITCH_Y, y1: r * PITCH_Y + RH } }
  const cx = b => (b.x0 + b.x1) / 2;
  const outOf = id => edges.filter(e => e.from === id), inTo = id => edges.filter(e => e.to === id);
  // ports: a wide box sends an arrow straight down above its target (or down the column VIA names); a narrow one spreads
  // its arrows along its bottom in the order of their targets (for the same place, the nearer first on the side it
  // turns to). A box takes an arrow straight in when it comes down within its width, else along its top in the order
  // of the sources. Ports keep 14 px apart.
  const colX = c => c * PITCH_X + CW / 2, via = VIA[key] || {};
  const spread = (b, n, i) => { if (n === 1) return cx(b); const w = Math.min(b.x1 - b.x0 - 24, 26 * (n - 1)); return cx(b) - w / 2 + w * i / (n - 1) };
  const apart = (list, get, set, lo, hi) => { const s = [...list].sort((p, q) => get(p) - get(q)); for (let i = 1; i < s.length; i++) if (get(s[i]) < get(s[i - 1]) + 14) set(s[i], get(s[i - 1]) + 14);
    const over = s.length ? get(s.at(-1)) - hi : 0; if (over > 0) for (const e of s) set(e, Math.max(lo, get(e) - over)) };
  for (const b of Object.values(box)) {
    const out = outOf(b.id).sort((p, q) => { const P = box[p.to], Q = box[q.to], d = cx(P) - cx(Q); if (Math.abs(d) > 1) return d; const left = cx(P) < cx(b); return left ? P.r - Q.r : Q.r - P.r });
    if (b.span > 1) {
      for (const e of out) { const v = via[e.from + '>' + e.to]; e.sx = v !== undefined ? colX(v) : Math.min(Math.max(cx(box[e.to]), b.x0 + 12), b.x1 - 12) }
      apart(out, e => e.sx, (e, x) => { e.sx = x }, b.x0 + 12, b.x1 - 12);
    } else out.forEach((e, i) => { e.sx = spread(b, out.length, i) });
  }
  for (const b of Object.values(box)) {
    const inn = inTo(b.id).sort((p, q) => (p.sx - q.sx) || (box[p.from].r - box[q.from].r));
    if (inn.length === 1) { const e = inn[0]; e.tx = e.sx > b.x0 + 10 && e.sx < b.x1 - 10 ? e.sx : cx(b) }
    else if (b.span > 1) { inn.forEach((e, i) => { e.tx = e.sx > b.x0 + 10 && e.sx < b.x1 - 10 ? e.sx : b.x0 + 14 + (b.x1 - b.x0 - 28) * i / (inn.length - 1) }); apart(inn, e => e.tx, (e, x) => { e.tx = x }, b.x0 + 12, b.x1 - 12) }
    else inn.forEach((e, i) => { e.tx = spread(b, inn.length, i) });
  }
  // the height each arrow turns at: in the gap above the target's row, one step apart for the arrows into that row
  const byRow = {};
  for (const e of edges) (byRow[box[e.to].r] ||= []).push(e);
  // (two arrows going the same way whose runs overlap cross unless the one that ends farther that way turns higher:
  // going left, the one ending leftmost turns highest; going right, the one ending rightmost)
  for (const [r, list] of Object.entries(byRow)) {
    const left = list.filter(e => e.tx < e.sx - .5).sort((p, q) => q.tx - p.tx), right = list.filter(e => e.tx > e.sx + .5).sort((p, q) => p.tx - q.tx);
    for (const g of [left, right]) g.forEach((e, i) => { e.ty = +r * PITCH_Y - 8 - i * Math.min(6, (GY - 14) / Math.max(1, g.length - 1)) });
  }
  for (const e of edges) {
    const a = box[e.from], b = box[e.to], y0 = a.y1, y1 = b.y0;
    e.pts = Math.abs(e.sx - e.tx) <= .5 ? [[e.sx, y0], [e.tx, y1]] : [[e.sx, y0], [e.sx, e.ty], [e.tx, e.ty], [e.tx, y1]];
  }
  const W = Math.max(...Object.values(box).map(b => b.x1)), H = Math.max(...Object.values(box).map(b => b.y1));
  return { box, edges, W, H };
}

// the whole model, top to bottom (model-level steps from the official code; the 45 layers are one box)
export function modelColumn(tc) {
  const V = tc.vocab_size, C = tc.hidden_size, S = tc.hc_mult, n = tc.num_hidden_layers;
  const kinds = tc.layer_types.map((t, i) => [t === 'linear_attention' ? 'kda' : 'mla', tc.mlp_layer_types[i] === 'sparse' ? 'moe' : 'dense']);
  const count = f => kinds.filter(f).length;
  return {
    kinds, V, C, S, n,
    counts: { kda: count(k => k[0] === 'kda'), mla: count(k => k[0] === 'mla'), dense: count(k => k[1] === 'dense'), moe: count(k => k[1] === 'moe') },
    top: [
      { id: 'text', title: '输入的一句话', sub: '分词成 T 个词编号（词表 ' + V.toLocaleString('en') + '）', comp: null },
      { id: 'embed', title: '词表嵌入 embed_tokens', sub: `[${V}, ${C}] · 每个词查 1 行`, comp: 'embed', weight: true, src: '1447' },
      { id: 'expand', title: `复制成 ${S} 路`, sub: `[T, ${S} 路, ${C}]（mHC 的 ${S} 路残差）`, comp: 'resid', src: '1476' },
    ],
    bottom: [
      { id: 'hc_head', title: `${S} 路取平均`, sub: `[T, ${C}] · 不带权重（hc_head）`, comp: 'resid', src: '1492 · 299–303' },
      { id: 'norm', title: '最后的 RMSNorm', sub: `[${C}] 个 γ`, comp: 'norm', src: '1420 · 1492' },
      { id: 'lm_head', title: '输出层 lm_head', sub: `[${V}, ${C}] · 不和词表嵌入共用`, comp: 'embed', weight: true, src: '2115 · 2221' },
      { id: 'logits', title: '下一个词的分数', sub: `只算最后一个词：${V.toLocaleString('en')} 个分数`, comp: null },
      { id: 'pick', title: '选出下一个词', sub: 'softmax · 官方默认采样 top_p 0.95（HF generate 默认取最高分）', comp: null, src: 'generation_config.json' },
    ],
    // the MTP layer (layer 45 of the checkpoint; the HF modeling file has none — vLLM's glm5next/common/mtp.py): it
    // guesses the word after next, with the main model's vocabulary and output head (no copies in the checkpoint)
    mtp: [
      { id: 'mtp_embed', title: '句子往后挪一个词，查同一张词表', sub: '第 t 位放第 t+1 个词，末位放刚选出的词', comp: 'embed', weight: true, src: 'vLLM llm_base_proposer.py 844–847' },
      { id: 'mtp_norm', title: '两个 RMSNorm', sub: 'enorm：词向量 · hnorm：主模型最后的隐藏状态', comp: 'norm', weight: true, src: 'vLLM fused_eh_norm.py' },
      { id: 'eh_proj', title: `拼成 ${2 * C} 维 → eh_proj`, sub: `[${C}, ${2 * C}]`, comp: 'mtp', weight: true, src: 'vLLM mtp.py 95–103' },
      { id: 'mtp_layer', title: '一层 MLA + 索引器 + MoE', sub: '只有 1 路，没有 mHC · 形状和 L03 一样', comp: 'attn', weight: true, src: 'vLLM model.py 465–482' },
      { id: 'mtp_shared_norm', title: 'RMSNorm', sub: 'shared_head.norm', comp: 'norm', weight: true, src: 'vLLM mtp.py 110' },
      { id: 'mtp_head', title: '同一个 lm_head → 取最高分', sub: '草稿：再下一个词，下一步由主模型验证', comp: 'embed', weight: true, src: 'vLLM mtp.py 181–191 · llm_base_proposer.py 438–448' },
    ],
  };
}
