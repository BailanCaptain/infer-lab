// Deterministic 3D layout for Qwen3-8B (dense) and Qwen3-30B-A3B (MoE),
// reusing the GLM master coordinate convention (flow-layout.js: toWorld, ptWorld, HEAD_GAP).
import { HEAD_GAP, ptWorld, toWorld } from '../../glm-flow/master/flow-layout.js';
import { DEPTH, DIM, HEAD_THICK, MIN, ROW, depthFor } from '../../glm-flow/master/truth-layout.js';
import { QWEN_MODELS, getQwenVariant } from './qwen-spec.js';

export { HEAD_GAP, ptWorld, toWorld };

const T = 6;
const Tw = T * ROW;
const GAP_W = 8;
const GAP_V = 9;
const STAGE = 13;
const PAD = 1.0;
const P_GAP = 1.6;
const X_OUT = 0;
const CH = 18;
const XS = X_OUT + CH;
const XR = X_OUT - Tw;
const XM = XR - GAP_W - Tw;

const cells = (n) => Math.max(1, Math.round(n / 256));
const dimLen = (n) => Math.max(n * DIM, MIN * 3);

function mkBlock({ id, label, shapeText, comp, kind, orient, x0, y0, w, h, d, div, cut, alt = null, headGap = 0, deck = null, group = 'layer' }) {
  return {
    id,
    label,
    shapeText,
    comp,
    kind,
    orient,
    group,
    x0,
    x1: x0 + w,
    y0,
    y1: y0 + h,
    z0: -d,
    z1: 0,
    div,
    cut,
    alt,
    headGap,
    t: { name: label, deck, colsUnit: orient === 'col' && shapeText.includes('6×6') ? 'token' : undefined },
  };
}

function headStackDepth(nHeads, gap) {
  return Math.min(nHeads, 32) * HEAD_THICK * (1 + gap * 0.55);
}

export function layoutQwenLayer(rawVariant = '8b', { gap = HEAD_GAP, offsetX = 0, offsetY = 0 } = {}) {
  const variant = getQwenVariant(rawVariant);
  const spec = QWEN_MODELS[variant];
  const isMoe = spec.ffnKind === 'moe';
  const H = spec.hidden;
  const hH = dimLen(H);
  const hHead = Math.max(dimLen(spec.headDim) * 2.2, 3.2);
  const blocks = [];
  const arrows = [];
  const B = {};

  const add = (cfg) => {
    const b = mkBlock({ ...cfg, x0: cfg.x0 + offsetX, y0: cfg.y0 + offsetY });
    blocks.push(b);
    B[b.id] = b;
    return b;
  };
  const cx = (b) => (b.x0 + b.x1) / 2;
  const cy = (b) => (b.y0 + b.y1) / 2;
  const arrow = (from, to, pts, extra = {}) =>
    arrows.push({ from, to, pts, head: true, w: extra.spine ? 2.8 : extra.lane ? 1.5 : 2.0, comp: B[from]?.comp || 'resid', ...extra });
  const down = (a, b, extra) => arrow(a.id, b.id, [[cx(a), a.y1 + PAD], [cx(a), b.y0 - PAD]], extra);
  const across = (a, b, extra) => arrow(a.id, b.id, [[a.x1 + PAD, cy(b)], [b.x0 - PAD, cy(b)]], extra);

  const ROW_GAP = 14 + headStackDepth(spec.numHeads, gap) * 0.28;

  // 1. Single-stream residual input on right spine + Attention Pre-RMSNorm
  const rin = add({
    id: 'residual_in', label: '残差输入 X₀', shapeText: `[6, ${H}]`,
    comp: 'resid', kind: 'data', orient: 'col', group: 'attn',
    x0: XS, y0: 0, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
  });
  const xA = add({
    id: 'x_attn', label: 'Pre-RMSNorm X_n', shapeText: `[6, ${H}]`,
    comp: 'norm', kind: 'data', orient: 'col', group: 'attn',
    x0: XR, y0: 0, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
  });
  const gA = add({
    id: 'gamma_attn', label: 'γ₁', shapeText: `[${H}]`,
    comp: 'norm', kind: 'weight', orient: 'rod', group: 'attn',
    x0: XR - P_GAP - 1.6, y0: 0, w: 1.6, h: hH, d: 1.6, div: [1, cells(H), 1], cut: [0, 0, 0],
  });
  arrow('residual_in', 'x_attn', [[rin.x0 - PAD, cy(xA)], [xA.x1 + PAD, cy(xA)]], { comp: 'resid' });
  across(gA, xA, { w: 1.2 });

  // 2. GQA Q / K / V projections + Per-Head QK-Norm + RoPE (1e6)
  let y = xA.y1 + STAGE;
  const qDepth = headStackDepth(spec.numHeads, gap);
  const kvDepth = headStackDepth(spec.numKvHeads, gap);
  const wProjW = Math.min(hH, 24);
  const rows = [
    ['W_q', 'Q', 'q_norm', 'Q_norm', 'Q_rope', spec.numHeads, qDepth, `32×128`],
    ['W_k', 'K', 'k_norm', 'K_norm', 'K_rope', spec.numKvHeads, kvDepth, `${spec.numKvHeads}×128`],
    ['W_v', 'V', null, null, null, spec.numKvHeads, kvDepth, `${spec.numKvHeads}×128`],
  ];
  const X_PROJ = XM - 20;
  const X_NORM = XR - 14;
  for (const [wid, qid, nid, qnid, rid, nH, dH, tag] of rows) {
    const Wb = add({
      id: wid, label: wid, shapeText: `[${H}, ${nH}×128]`,
      comp: 'attn', kind: 'weight', orient: 'wl', group: 'attn',
      x0: X_PROJ - GAP_W - wProjW, y0: y, w: wProjW, h: hHead, d: dH,
      div: [cells(H), 1, nH], cut: [0, 0, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: nH },
    });
    const Pb = add({
      id: qid, label: `${qid} (${tag})`, shapeText: `[6, ${nH}, 128]`,
      comp: 'attn', kind: 'data', orient: 'col', group: 'attn',
      x0: X_PROJ, y0: y, w: Tw, h: hHead, d: dH,
      div: [T, 1, nH], cut: [1, 0, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: nH },
    });
    across(Wb, Pb);
    if (nid && qnid && rid) {
      const nb = add({
        id: nid, label: nid, shapeText: `[128]`,
        comp: 'norm', kind: 'weight', orient: 'rod', group: 'attn',
        x0: X_NORM - P_GAP - 1.4, y0: y, w: 1.4, h: hHead, d: 1.4, div: [1, 1, 1], cut: [0, 0, 0],
      });
      const qnb = add({
        id: qnid, label: `${qid} QK-Norm`, shapeText: `[6, ${nH}, 128]`,
        comp: 'norm', kind: 'data', orient: 'col', group: 'attn',
        x0: X_NORM, y0: y, w: Tw * 0.72, h: hHead, d: dH,
        div: [T, 1, nH], cut: [1, 0, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: nH },
      });
      const rb = add({
        id: rid, label: `${qid}' RoPE`, shapeText: `[6, ${nH}, 128]`,
        comp: 'attn', kind: 'data', orient: 'col', group: 'attn',
        x0: XR + Tw * 0.28, y0: y, w: Tw * 0.72, h: hHead, d: dH,
        div: [T, 1, nH], cut: [1, 0, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: nH },
      });
      across(Pb, nb, { w: 1.4 });
      across(qnb, rb, { w: 1.6 });
    }
    y += hHead + ROW_GAP;
  }
  arrow('x_attn', 'Q', [[cx(xA), xA.y1 + PAD], [cx(xA), xA.y1 + STAGE / 2], [cx(B.Q), xA.y1 + STAGE / 2], [cx(B.Q), B.Q.y0 - PAD]]);

  // 3. KV Cache, GQA Scores/Mask, Softmax/PV, W_o, Residual Add 1
  const kvBox = add({
    id: 'kv_cache', label: `KV Cache (${spec.kvBytesPerTokenLayer}B/层)`, shapeText: `[6, 2, ${spec.numKvHeads}, 128]`,
    comp: 'attn', kind: 'data', orient: 'col', group: 'attn',
    x0: XR, y0: y, w: Tw, h: hHead * 1.45, d: kvDepth,
    div: [T, 2, spec.numKvHeads], cut: [1, 1, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: spec.numKvHeads },
  });
  const l1 = offsetX + X_OUT + 5;
  arrow('K_rope', 'kv_cache', [[B.K_rope.x1 + PAD, cy(B.K_rope)], [l1, cy(B.K_rope)], [l1, cy(kvBox)], [kvBox.x1 + PAD, cy(kvBox)]], { lane: 1 });
  arrow('V', 'kv_cache', [[B.V.x1 + PAD, cy(B.V)], [cx(kvBox) - 4, cy(B.V)], [cx(kvBox) - 4, kvBox.y0 - PAD]], { lane: 1 });

  y = kvBox.y1 + ROW_GAP;
  const scores = add({
    id: 'attn_scores', label: `GQA 打分+掩码 (${spec.gqaRatio}:1)`, shapeText: `[32, 6, 6]`,
    comp: 'attn', kind: 'data', orient: 'col', group: 'attn',
    x0: XR, y0: y, w: Tw, h: Tw * 0.65, d: qDepth,
    div: [T, T, spec.numHeads], cut: [1, 1, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: spec.numHeads },
  });
  const l2 = offsetX + X_OUT + 11;
  arrow('Q_rope', 'attn_scores', [[B.Q_rope.x1 + PAD, cy(B.Q_rope)], [l2, cy(B.Q_rope)], [l2, cy(scores)], [scores.x1 + PAD, cy(scores)]], { lane: 2 });
  down(kvBox, scores);

  y = scores.y1 + ROW_GAP;
  const pv = add({
    id: 'attn_pv', label: 'Softmax·V 合头', shapeText: `[6, 32, 128] → [6, 4096]`,
    comp: 'attn', kind: 'data', orient: 'col', group: 'attn',
    x0: XR, y0: y, w: Tw, h: hHead * 1.4, d: qDepth,
    div: [T, 1, spec.numHeads], cut: [1, 0, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: spec.numHeads },
  });
  down(scores, pv);

  y = pv.y1 + ROW_GAP;
  const aout = add({
    id: 'attn_out', label: 'Attn 输出', shapeText: `[6, ${H}]`,
    comp: 'attn', kind: 'data', orient: 'col', group: 'attn',
    x0: XR, y0: y, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
  });
  const Wo = add({
    id: 'W_o', label: 'W_o 输出投影', shapeText: `[4096, ${H}]`,
    comp: 'attn', kind: 'weight', orient: 'wl', group: 'attn',
    x0: XR - GAP_W - 24, y0: y, w: 24, h: hH, d: DEPTH, div: [spec.numHeads, cells(H), 1], cut: [1, 0, 0], alt: 'x',
  });
  down(pv, aout);
  across(Wo, aout);

  const rmid = add({
    id: 'residual_mid', label: '残差相加① res₁', shapeText: `[6, ${H}]`,
    comp: 'resid', kind: 'data', orient: 'col', group: 'attn',
    x0: XS, y0: y, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
  });
  arrow('attn_out', 'residual_mid', [[aout.x1 + PAD, cy(aout)], [rmid.x0 - PAD, cy(rmid)]]);
  arrow('residual_in', 'residual_mid', [[cx(rin), rin.y1 + PAD], [cx(rin), rmid.y0 - PAD]], { spine: true });

  // 4. Second Pre-RMSNorm + FFN (Dense SwiGLU or 30B-A3B 128-choose-8 MoE, 0 shared experts)
  y = aout.y1 + STAGE + 6;
  const xF = add({
    id: 'x_ffn', label: 'Pre-RMSNorm X_ffn', shapeText: `[6, ${H}]`,
    comp: 'norm', kind: 'data', orient: 'col', group: 'ffn',
    x0: XR, y0: y, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
  });
  add({
    id: 'gamma_ffn', label: 'γ₂', shapeText: `[${H}]`,
    comp: 'norm', kind: 'weight', orient: 'rod', group: 'ffn',
    x0: XR - P_GAP - 1.6, y0: y, w: 1.6, h: hH, d: 1.6, div: [1, cells(H), 1], cut: [0, 0, 0],
  });
  arrow('residual_mid', 'x_ffn', [[rmid.x0 + 3, rmid.y1 + PAD], [rmid.x0 + 3, cy(xF)], [xF.x1 + PAD, cy(xF)]], { comp: 'resid', lane: 2 });

  let fout;
  if (!isMoe) {
    const ffnW = 34;
    const Wg = add({
      id: 'W_gate', label: 'W_gate', shapeText: `[4096, 12288]`,
      comp: 'dense', kind: 'weight', orient: 'wt', group: 'ffn',
      x0: XR - GAP_W - ffnW, y0: y, w: ffnW, h: hH, d: DEPTH, div: [24, cells(H), 1], cut: [0, 0, 0],
    });
    const Wu = add({
      id: 'W_up', label: 'W_up', shapeText: `[4096, 12288]`,
      comp: 'dense', kind: 'weight', orient: 'wt', group: 'ffn',
      x0: Wg.x0 - 4 - ffnW, y0: y, w: ffnW, h: hH, d: DEPTH, div: [24, cells(H), 1], cut: [0, 0, 0],
    });
    const gY = Wg.y1 + GAP_V;
    const g = add({
      id: 'gate_ffn', label: 'gate [6, 12288]', shapeText: `[6, 12288]`,
      comp: 'dense', kind: 'data', orient: 'row', group: 'ffn',
      x0: Wg.x0, y0: gY, w: ffnW, h: Tw * 0.72, d: DEPTH, div: [24, T, 1], cut: [0, 1, 0],
    });
    const u = add({
      id: 'up_ffn', label: 'up [6, 12288]', shapeText: `[6, 12288]`,
      comp: 'dense', kind: 'data', orient: 'row', group: 'ffn',
      x0: Wu.x0, y0: gY, w: ffnW, h: Tw * 0.72, d: DEPTH, div: [24, T, 1], cut: [0, 1, 0],
    });
    const hh = add({
      id: 'h_ffn', label: 'SiLU(gate)⊙up', shapeText: `[6, 12288]`,
      comp: 'dense', kind: 'data', orient: 'row', group: 'ffn',
      x0: Wg.x0, y0: g.y1 + GAP_V, w: ffnW, h: Tw * 0.72, d: DEPTH, div: [24, T, 1], cut: [0, 1, 0],
    });
    const Wd = add({
      id: 'W_down', label: 'W_down', shapeText: `[12288, 4096]`,
      comp: 'dense', kind: 'weight', orient: 'wl', group: 'ffn',
      x0: Wg.x0, y0: hh.y1 + GAP_V, w: ffnW, h: hH, d: DEPTH, div: [24, cells(H), 1], cut: [0, 0, 0],
    });
    fout = add({
      id: 'ffn_out', label: 'SwiGLU 输出', shapeText: `[6, 4096]`,
      comp: 'dense', kind: 'data', orient: 'col', group: 'ffn',
      x0: XR, y0: Wd.y0, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
    });
    arrow('x_ffn', 'gate_ffn', [[cx(xF), xF.y1 + PAD], [cx(xF), cy(g)], [g.x1 + PAD, cy(g)]]);
    down(Wg, g); down(Wu, u); down(g, hh);
    arrow('up_ffn', 'h_ffn', [[cx(u), u.y1 + PAD], [cx(u), (u.y1 + hh.y0) / 2], [hh.x0 + 6, (u.y1 + hh.y0) / 2], [hh.x0 + 6, hh.y0 - PAD]]);
    arrow('h_ffn', 'ffn_out', [[hh.x1 + PAD, cy(hh)], [cx(fout), cy(hh)], [cx(fout), fout.y0 - PAD]]);
    across(Wd, fout);
  } else {
    const rW = 18;
    const eW = 28;
    const eDepth = headStackDepth(24, gap);
    const Wr = add({
      id: 'W_router', label: 'W_router (128)', shapeText: `[2048, 128]`,
      comp: 'router', kind: 'weight', orient: 'wt', group: 'ffn',
      x0: XR - GAP_W - rW, y0: y, w: rW, h: hH, d: DEPTH, div: [8, cells(H), 1], cut: [1, 0, 0],
    });
    const Wgu = add({
      id: 'W_moe_gu', label: '128 专家 W_gate|up', shapeText: `[128, 2048, 2×768]`,
      comp: 'expert', kind: 'weight', orient: 'wt', group: 'ffn',
      x0: Wr.x0 - 16 - eW, y0: y, w: eW, h: hH, d: eDepth,
      div: [6, cells(H), 24], cut: [0, 0, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: 24 },
    });
    const rY = Wr.y1 + GAP_V + 4;
    const rl = add({
      id: 'router_logits', label: 'FP32 Softmax 128', shapeText: `[6, 128]`,
      comp: 'router', kind: 'data', orient: 'row', group: 'ffn',
      x0: Wr.x0, y0: rY, w: rW, h: Tw * 0.65, d: DEPTH, div: [8, T, 1], cut: [1, 1, 0],
    });
    const tp = add({
      id: 'topk_prob', label: 'Top-8 重归一 (Σw=1 · 0 共享)', shapeText: `[6, 8]`,
      comp: 'router', kind: 'data', orient: 'row', group: 'ffn',
      x0: Wr.x0, y0: rl.y1 + GAP_V, w: rW, h: Tw * 0.65, d: DEPTH, div: [8, T, 1], cut: [1, 1, 0],
    });
    const egu = add({
      id: 'moe_gu', label: 'Top-8 专家 gate|up', shapeText: `[6, 8, 1536]`,
      comp: 'expert', kind: 'data', orient: 'row', group: 'ffn',
      x0: Wgu.x0, y0: rY, w: eW, h: Tw * 0.65, d: headStackDepth(8, gap),
      div: [6, T, 8], cut: [0, 1, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: 8 },
    });
    const eh = add({
      id: 'moe_h', label: '8×SwiGLU (I_moe=768)', shapeText: `[6, 8, 768]`,
      comp: 'expert', kind: 'data', orient: 'row', group: 'ffn',
      x0: Wgu.x0, y0: tp.y0, w: eW, h: Tw * 0.65, d: headStackDepth(8, gap),
      div: [6, T, 8], cut: [0, 1, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: 8 },
    });
    const Wdn = add({
      id: 'W_moe_down', label: '128 专家 W_down', shapeText: `[128, 768, 2048]`,
      comp: 'expert', kind: 'weight', orient: 'wl', group: 'ffn',
      x0: Wgu.x0, y0: Math.max(eh.y1, tp.y1) + GAP_V + 4, w: eW, h: hH, d: eDepth,
      div: [6, cells(H), 24], cut: [0, 0, 1], alt: 'z', headGap: gap * 0.55, deck: { kind: 'head', n: 24 },
    });
    fout = add({
      id: 'ffn_out', label: 'MoE 加权和 (0 共享)', shapeText: `[6, 2048]`,
      comp: 'expert', kind: 'data', orient: 'col', group: 'ffn',
      x0: XR, y0: Wdn.y0, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
    });
    arrow('x_ffn', 'router_logits', [[cx(xF), xF.y1 + PAD], [cx(xF), cy(rl)], [rl.x1 + PAD, cy(rl)]]);
    down(Wr, rl); down(rl, tp); down(Wgu, egu); down(egu, eh);
    arrow('topk_prob', 'moe_gu', [[tp.x0 - PAD, cy(tp)], [egu.x1 + 6, cy(tp)], [egu.x1 + 6, cy(egu)], [egu.x1 + PAD, cy(egu)]], { w: 1.4 });
    arrow('moe_h', 'ffn_out', [[eh.x1 + PAD, cy(eh)], [cx(fout), cy(eh)], [cx(fout), fout.y0 - PAD]]);
    across(Wdn, fout);
  }

  const rout = add({
    id: 'residual_out', label: '残差相加② X₁', shapeText: `[6, ${H}]`,
    comp: 'resid', kind: 'data', orient: 'col', group: 'ffn',
    x0: XS, y0: fout.y0, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
  });
  arrow('ffn_out', 'residual_out', [[fout.x1 + PAD, cy(fout)], [rout.x0 - PAD, cy(rout)]]);
  arrow('residual_mid', 'residual_out', [[cx(rmid), rmid.y1 + PAD], [cx(rmid), rout.y0 - PAD]], { spine: true });

  const bounds = {
    x0: Math.min(...blocks.map((b) => b.x0)),
    x1: Math.max(...blocks.map((b) => b.x1)),
    y0: Math.min(...blocks.map((b) => b.y0)),
    y1: Math.max(...blocks.map((b) => b.y1)),
    z0: Math.min(...blocks.map((b) => b.z0)),
    z1: 0,
  };
  return { blocks, arrows, B, bounds, variant, spec };
}

function boxOf(list) {
  return {
    x0: Math.min(...list.map((b) => b.x0)),
    x1: Math.max(...list.map((b) => b.x1)),
    y0: Math.min(...list.map((b) => b.y0)),
    y1: Math.max(...list.map((b) => b.y1)),
    z0: Math.min(...list.map((b) => b.z0)),
    z1: Math.max(...list.map((b) => b.z1)),
  };
}

export function layoutQwenModel(rawVariant = '8b', { gap = HEAD_GAP } = {}) {
  const variant = getQwenVariant(rawVariant);
  const spec = QWEN_MODELS[variant];
  const H = spec.hidden;
  const hH = dimLen(H);
  const layer = layoutQwenLayer(variant, { gap, offsetX: 0, offsetY: 0 });
  const blocks = [...layer.blocks];
  const arrows = [...layer.arrows];
  const B = { ...layer.B };

  const add = (cfg) => {
    const b = mkBlock(cfg);
    blocks.push(b);
    B[b.id] = b;
    return b;
  };
  const cx = (b) => (b.x0 + b.x1) / 2;
  const cy = (b) => (b.y0 + b.y1) / 2;
  const arrow = (from, to, pts, extra = {}) =>
    arrows.push({ from, to, pts, head: true, w: extra.spine ? 2.8 : 2.0, comp: B[from]?.comp || 'embed', ...extra });

  // Column 0 (left of L00): Input tokens + Embedding table + X0
  const inX = layer.bounds.x0 - 52;
  const tok = add({
    id: 'token_ids', label: '输入 6 个 token ID', shapeText: `[6]`,
    comp: 'embed', kind: 'data', orient: 'col', group: 'input',
    x0: inX, y0: 0, w: Tw, h: 6.5, d: DEPTH, div: [T, 1, 1], cut: [1, 0, 0],
  });
  const Wemb = add({
    id: 'W_embed', label: '词嵌入表 E (独立)', shapeText: `[151936, ${H}]`,
    comp: 'embed', kind: 'weight', orient: 'wl', group: 'input',
    x0: inX - 30, y0: tok.y1 + 14, w: 22, h: hH * 1.25, d: DEPTH, div: [8, cells(H), 1], cut: [0, 0, 0],
  });
  const emb = add({
    id: 'embed_out', label: '词向量 X₀', shapeText: `[6, ${H}]`,
    comp: 'embed', kind: 'data', orient: 'col', group: 'input',
    x0: inX, y0: Wemb.y0, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
  });
  arrow('token_ids', 'embed_out', [[cx(tok), tok.y1 + PAD], [cx(tok), emb.y0 - PAD]]);
  arrow('W_embed', 'embed_out', [[Wemb.x1 + PAD, cy(emb)], [emb.x0 - PAD, cy(emb)]]);
  arrow('embed_out', 'residual_in', [
    [emb.x1 + PAD, cy(emb)],
    [emb.x1 + 14, cy(emb)],
    [emb.x1 + 14, -14],
    [cx(B.residual_in), -14],
    [cx(B.residual_in), B.residual_in.y0 - PAD],
  ], { comp: 'resid', spine: true });

  // Column 2 (right of L00): Homogeneous stack L01..L(N-1)
  const stackX = layer.bounds.x1 + 34;
  const stackCount = spec.numLayers - 1;
  const shownSlabs = Math.min(stackCount, 12);
  const slabH = Math.max(8, (layer.bounds.y1 - 40) / shownSlabs - 5);
  const stackComp = spec.ffnKind === 'moe' ? 'expert' : 'dense';
  const stackBlocks = [];
  for (let i = 0; i < shownSlabs; i++) {
    const sy = 10 + i * (slabH + 5);
    const layerIdx = i < shownSlabs - 1 ? i + 1 : spec.numLayers - 1;
    const id = i === 0 ? 'layer_stack' : `layer_stack_${i}`;
    const sb = add({
      id,
      label: i === 0 ? `L01..L${spec.numLayers - 1} 同构堆叠 (${stackCount} 层)` : `L${String(layerIdx).padStart(2, '0')}`,
      shapeText: `${spec.numLayers} 层同构 · ${spec.ffnKind === 'moe' ? 'GQA 8:1 + 128选8 MoE' : 'GQA 4:1 + SwiGLU'}`,
      comp: i % 2 === 0 ? 'attn' : stackComp,
      kind: 'data', orient: 'col', group: 'stack',
      x0: stackX, y0: sy, w: 30, h: slabH, d: DEPTH * 1.4,
      div: [T, 2, 1], cut: [1, 1, 0],
    });
    stackBlocks.push(sb);
    if (i > 0) {
      const prev = stackBlocks[i - 1];
      arrow(prev.id, sb.id, [[cx(prev), prev.y1 + PAD], [cx(sb), sb.y0 - PAD]], { comp: 'resid', spine: true });
    }
  }
  arrow('residual_out', 'layer_stack', [
    [B.residual_out.x1 + PAD, cy(B.residual_out)],
    [B.residual_out.x1 + 16, cy(B.residual_out)],
    [B.residual_out.x1 + 16, cy(stackBlocks[0])],
    [stackBlocks[0].x0 - PAD, cy(stackBlocks[0])],
  ], { comp: 'resid', spine: true });

  // Column 3 (right of stack): Final RMSNorm -> Independent LM Head -> Logits -> Next token
  const outX = stackX + 64;
  const fNorm = add({
    id: 'final_norm', label: `末层 RMSNorm X_${spec.numLayers}`, shapeText: `[6, ${H}]`,
    comp: 'norm', kind: 'data', orient: 'col', group: 'output',
    x0: outX, y0: 14, w: Tw, h: hH, d: DEPTH, div: [T, cells(H), 1], cut: [1, 0, 0],
  });
  const Whead = add({
    id: 'W_lm_head', label: '独立 LM Head (非绑定)', shapeText: `[${H}, 151936]`,
    comp: 'embed', kind: 'weight', orient: 'wl', group: 'output',
    x0: outX, y0: fNorm.y1 + 18, w: 22, h: hH * 1.25, d: DEPTH, div: [8, cells(H), 1], cut: [0, 0, 0],
  });
  const logits = add({
    id: 'logits', label: '全词表 Logits', shapeText: `[151936]`,
    comp: 'embed', kind: 'data', orient: 'col', group: 'output',
    x0: Whead.x1 + 10, y0: Whead.y0, w: 10, h: hH * 1.25, d: DEPTH, div: [1, cells(H), 1], cut: [0, 0, 0],
  });
  const probs = add({
    id: 'probs_next', label: 'Softmax → 下一词', shapeText: `Argmax(p[151936])`,
    comp: 'embed', kind: 'data', orient: 'col', group: 'output',
    x0: Whead.x1 + 10, y0: logits.y1 + 14, w: 12, h: 10, d: DEPTH, div: [1, 2, 1], cut: [0, 1, 0],
  });
  const lastStack = stackBlocks[stackBlocks.length - 1];
  arrow(lastStack.id, 'final_norm', [
    [lastStack.x1 + PAD, cy(lastStack)],
    [lastStack.x1 + 15, cy(lastStack)],
    [lastStack.x1 + 15, cy(fNorm)],
    [fNorm.x0 - PAD, cy(fNorm)],
  ], { comp: 'resid', spine: true });
  arrow('final_norm', 'W_lm_head', [[cx(fNorm), fNorm.y1 + PAD], [cx(Whead), Whead.y0 - PAD]], { comp: 'embed' });
  arrow('W_lm_head', 'logits', [[Whead.x1 + PAD, cy(logits)], [logits.x0 - PAD, cy(logits)]], { comp: 'embed' });
  arrow('logits', 'probs_next', [[cx(logits), logits.y1 + PAD], [cx(probs), probs.y0 - PAD]], { comp: 'embed' });

  const worldBlocks = blocks.map(toWorld);
  const worldArrows = arrows.map((a) => ({ ...a, pts: a.pts.map(ptWorld) }));
  const worldB = Object.fromEntries(worldBlocks.map((b) => [b.id, b]));
  const worldBounds = boxOf(worldBlocks);
  const groupBoxes = {
    whole: worldBounds,
    input: boxOf(worldBlocks.filter((b) => b.group === 'input')),
    attn: boxOf(worldBlocks.filter((b) => b.group === 'attn')),
    ffn: boxOf(worldBlocks.filter((b) => b.group === 'ffn')),
    stack: boxOf(worldBlocks.filter((b) => b.group === 'stack')),
    output: boxOf(worldBlocks.filter((b) => b.group === 'output')),
  };
  return { blocks: worldBlocks, arrows: worldArrows, B: worldB, bounds: worldBounds, groupBoxes, stackIds: stackBlocks.map((b) => b.id), variant, spec };
}
