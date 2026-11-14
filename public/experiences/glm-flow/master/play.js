// The player (09-25, the chapter's first sample): plays the segments of segments.js on the whole model of model.html
// (?embed=1), commanded by the chapter page through postMessage (A8 口 2: "去哪、演哪段"; the page's own buttons use the
// same messages). The state is a pure function of the time: apply(seg, t) sets every block and the camera for that
// moment, so any moment can be sought, replayed and checked.
//   in:  {cmd: 'go', n} (show segment n at rest: its blocks lit, the camera there) · {cmd: 'play', n} · {cmd: 'pause'} ·
//        {cmd: 'seek', n, t} · {cmd: 'speed', v} · {cmd: 'follow', on} · {cmd: 'whole'}
//   out: {ev: 'ready', segs: {n: dur}} · {ev: 'tick', n, t, dur, beat, playing} · {ev: 'end', n}
// At rest every result of the sentence is there (MASTER-DESIGN: "结果平时摆着"); playing a segment, what it computes
// is gone at the start and grows as it is computed; what the beat does not use fades (two steps, A6).
import * as THREE from 'three';
import { SEGMENTS, durationOf } from './segments.js';
import { lid } from './model-spec.js';
import {explain} from './lesson-data.js';
import {lessonPosition,lessonProgress} from './lesson-position.js';

const FADE = .78, CAM_T = 1.4, GO_T = 1.1;
const clamp = v => Math.max(0, Math.min(1, v)), smooth = v => { v = clamp(v); return v * v * (3 - 2 * v) };

export function attachPlayer({ look, B, WB, M, ARROWS, camera, controls, fit, place, frame, label, V, host, words, demo: initialDemo }) {
  let demo = initialDemo;
  let cur = null;   // the segment in hand
  // (a layer's input is the layer before's output, one block: M.alias — L04's residual_in is L03's residual_out)
  const id = (s, x) => { if(s.global)return B[x]?x:M.alias[x]||x; const k = lid(s.layer) + ':' + x; return B[k] ? k : M.alias[k] || k };
  const layerOf = s => M.layers[s.layer];
  // ---- the camera poses of every segment (fit, then note where the camera stands)
  const snap = () => ({ p: camera.position.clone(), t: controls.target.clone() });
  const boxOf = (bs, pad = 0, zDepth = null) => ({ x0: Math.min(...bs.map(b => b.x0)) - pad, x1: Math.max(...bs.map(b => b.x1)) + pad, y0: Math.min(...bs.map(b => b.y0)) - pad, y1: Math.max(...bs.map(b => b.y1)) + pad,
    z0: zDepth ? -zDepth : Math.min(...bs.map(b => b.z0)), z1: 0 });
  const start = snap(), POSE = new Map();
  const d0 = new THREE.Vector3(), d1 = new THREE.Vector3();
  function blend(A, C, u) {   // the target moves straight, the direction turns, the distance scales
    u = smooth(u); const tg = A.t.clone().lerp(C.t, u); d0.subVectors(A.p, A.t); d1.subVectors(C.p, C.t);
    const da = d0.length(), db = d1.length(), dir = d0.normalize().lerp(d1.normalize(), u).normalize();
    camera.position.copy(tg).addScaledVector(dir, Math.exp(Math.log(da) + (Math.log(db) - Math.log(da)) * u)); controls.target.copy(tg); camera.lookAt(tg);
  }

  // ---- every segment's names (shown only while it is the segment) and the sentence's words over its word columns
  const segLabels = new Map(), WORDLS = new Map(), COMPACT_OLD = new Set([9,10,13,14,16,17,18]);
  const at = (b, where) => ({ r: [V(b.x1 + 1.4, (b.y0 + b.y1) / 2, 0), 'r'], l: [V(b.x0 - 1.4, (b.y0 + b.y1) / 2, 0), 'rr'],
    tl: [V(b.x0, b.y1 + 1.2, 0), 'tl'], tr: [V(b.x1, b.y1 + 1.2, 0), 'tr'], b: [V((b.x0 + b.x1) / 2, b.y0 - 1.2, 0), 'b'] })[where];
  for (const s of SEGMENTS) {
    const els = [];
    for (const l of s.labels || []) { const [p, cls] = at(B[id(s, l.id)], l.at); els.push(label(l.html, p, cls + ' seg', true)) }
    if (s.words) { const b = B[id(s, s.words)], w = (b.x1 - b.x0) / words.length; const ws = words.map((wd, k) => label(wd, V(b.x0 + (k + .5) * w, b.y1 + .9, 0), 't seg word')); els.push(...ws); WORDLS.set(s.n, { b, ws }) }
    for (const el of els) {el.classList.add('off');if(host.clientWidth<700&&(s.lessonData||COMPACT_OLD.has(s.n))&&!el.classList.contains('word')){el.style.maxWidth='140px';el.style.whiteSpace='normal'}}
    segLabels.set(s.n, els);
  }
  // the words over the columns: only while a column is wide enough on the screen for its word; the word being computed bold
  function marks() {
    const m = cur && WORDLS.get(cur.n); if (!m) return clip();
    const { b, ws } = m, p = x => V(x, b.y1, 0).project(camera), a = p(b.x0), c = p(b.x1), px = Math.abs(c.x - a.x) / 2 * innerWidth / words.length;
    ws.forEach((el, k) => { el.classList.toggle('now', k === word); el.classList.toggle('narrow', px < 30) }); clip();
  }
  // (every name read first, then hidden: a read after a write would lay the page out again for each name — 09-28, the
  // user: "帧数可以高一点吗？有点卡顿")
  function clip() { if (!cur) return; const els = segLabels.get(cur.n).filter(el => el.style.display !== 'none'), out = els.map(cut); els.forEach((el, i) => { if (out[i]) el.style.display = 'none' }) }
  controls.addEventListener('change', () => { if (cur && !playing && !goAnim && [...layer.children].some(e => e !== svg && e.style.display === 'block')) apply(cur, t, false); else marks() });
  // (while a segment is on, only its names: the other layers' names and the model's are for the whole view)
  const showLabels = n => { host.classList.toggle('inseg', n > 0); for (const [k, els] of segLabels) for (const el of els) el.classList.toggle('off', k !== n) };

  // the poses: each fitted to its blocks, then stepped back a little at a time (at most 8 times) until the segment's
  // names whose blocks are in the picture are whole in it (a name is wider than the block it names)
  const cut = el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) };
  for (const s of SEGMENTS) {
    showLabels(s.n);
    for (const [name, p] of Object.entries(s.poses)) {
      const selected = p.all ? WB.filter(b => b.layer === s.layer) : p.ids.map(x => B[id(s, x)]);
      // An elided vocabulary has two visible ends. Fit both, including candidate 0.
      const bs=selected.flatMap(b=>b.elided&&B[b.id+'/0']?[B[b.id+'/0'],b]:[b]),bx=boxOf(bs,p.pad||0,p.z);
      if (p.top) bx.y1 = B[id(s, p.top[0])].y0 + p.top[1];   // (world y up: the top at that block's bottom + so much)
      if (p.band) { const b = B[id(s, p.band[0])], h = b.y1 - b.y0; bx.y0 = b.y0 + p.band[1] * h; bx.y1 = b.y0 + p.band[2] * h }   // (only that part of a tall block, up and down: fractions of its height from its bottom)
      const narrowCard=host.clientWidth<700&&COMPACT_OLD.has(s.n);
      let m = p.margin || (p.sideCard || narrowCard ? .96 : .86);
      const shift = p.topReserve ? [0,-Math.min(.7,p.topReserve/host.clientHeight)] : narrowCard ? p.narrowShift || [.5,p.shift?.[1]||0] : p.sideCard && host.clientWidth < 700 ? p.narrowShift || [.5, 0] : p.shift || [0, 0];
      const gateCard = s.gn && p.sideCard;
      const poseLabels = segLabels.get(s.n).filter((el, i) => !(s.incoming || s.expert || s.focusLabels || gateCard) || p.all || p.ids.includes(s.labels?.[i]?.id));
      for (let k = 0; k < 8; k++) { fit(bx, V(...p.dir), m, shift, true); place(); if (!poseLabels.some(el => el.style.display !== 'none' && !el.classList.contains('word') && cut(el))) break; m = s.incoming || s.expert || s.focusLabels || narrowCard || gateCard ? Math.abs(shift[0]) + (m - Math.abs(shift[0])) * .92 : m * .92 }
      POSE.set(s.n + ':' + name, snap());
    }
  }
  showLabels(-1);
  camera.position.copy(start.p); controls.target.copy(start.t); camera.lookAt(start.t); controls.update();

  // ---- the rules of the ops: what grows, what is lit
  const H = b => b.div[2], gapped = b => b.headGap > 0 && b.alt === 'z';
  // grow a result to the fraction u of its whole (heads one after another for a stack of heads apart, else word by word:
  // columns from the left, a word-per-row block rows from the top)
  function growTo(bid, u) {
    const b = B[bid]; if (u >= 1) return look.grow(bid, null);
    if (gapped(b)) { const c = u * H(b); return look.grow(bid, Math.floor(c), 1) }
    look.grow(bid, 0, u, b.orient === 'row' ? 1 : 0);
  }
  // a result there up to number R of word j: the words before whole, word j up to R (for a stack of heads apart: head
  // by head, a beat of heads; every head at once, word by word, a beat of words)
  // (heads one under another, words as columns: head by head, down — the order its numbers are followed in, tracedAt)
  const headsDown = b => b.alt === 'y' && b.orient === 'col' && b.t.deck?.kind === 'head' && b.t.cols > 1;
  function fillTo(bid, j, R, how) {
    const b = B[bid], T = b.t.rows.n, per = b.t.cols, st = b.div[2] > 1 && per > 1, h = st ? Math.floor(R / per) : 0;
    if (headsDown(b)) { const n = per * b.t.deck.n, k = Math.floor(R / per); return look.downHeads(bid, k / b.t.deck.n, (k + 1) / b.t.deck.n, j / T, (j + 1) / T, (R + 1) / n) }
    const n = st ? per : b.alt === 'y' ? per * b.t.deck.n : per > 1 ? per : b.t.deck?.n || 1, r = st ? R % per : R, row = b.orient === 'row';
    look.grow(bid, gapped(b) ? (how === 'heads' ? h : -1) : 0, (j + 1) / T, row ? 1 : 0);
    look.front(bid, row ? 2 : 1, j / T, (j + 1) / T, (r + 1) / n, gapped(b) ? h : 0);
  }
  const wordBox = (b, j) => b.orient === 'row' ? [[0, j, 0], [1e9, j + 1, 1e9]] : [[j, 0, 0], [j + 1, 1e9, 1e9]];
  const sliceBox = h => [[0, 0, h], [1e9, 1e9, h + .999]];
  // one beat at its progress u: `lit` gets what it uses (a block, or a block's part), and its results grow
  // (rest: the segment done and at rest — every block a beat uses lit whole, every step of a tour)
  function run(s, beat, u, lit, rest = false) {
    s = beat.dot ? {...s, dot:beat.dot} : s;
    const op = beat.op, T = words.length;
    if (op.show) for (const x of op.show) lit(id(s, x));
    if(op.transit!==undefined){
      const ls={layer:op.transit},steps=M.layers[op.transit].steps,k=Math.min(steps.length-1,Math.floor(u*steps.length));
      for(const [i,st]of steps.entries())for(const w of st.writes)growTo(id(ls,w),rest?1:clamp(u*steps.length-i));
      for(const st of rest?steps:[steps[k]])for(const x of [...st.reads,...st.params,...st.writes])lit(id(ls,x));
    }
    if(op.last)lit('h_final',wordBox(B.h_final,5));
    if(op.lesson){
      const st=op.lesson;
      for(const x of [...st.reads,...st.params])lit(id(s,x));
      for(const x of st.writes){const bid=id(s,x),b=B[bid],shape=demo.get(x).shape,v=rest?1:op.phase==='trace'?u:op.phase==='place'?1/demo.get(x).a.length:0;growTo(bid,v);
        if(['trace','place'].includes(op.phase)&&!rest&&u<1){
          const per=shape.slice(1).reduce((a,b)=>a*b,1),i=Math.min(op.sample,demo.get(x).a.length-1);
          const q=op.phase==='trace'?lessonProgress(b,shape,Math.min(.999999,Math.floor(u*48)/48)):x==='attn_w'?{index:i,j:Math.floor(i%36/6),R:Math.floor(i/36)*6+i%6}:{index:i,j:Math.floor(i/per),R:i%per};
          if(b.elided){const count=shape.at(-1),visible=Math.round((b.x1-b.x0)/.008);look.grow(bid,0,clamp((q.index-count+visible+1)/visible),0);look.grow(bid+'/0',0,clamp((q.index+1)/visible),0)}
          else if(['pick','stream'].includes(b.t.deck?.kind)){look.grow(bid,null);look.front(bid,b.orient==='row'?4:5,q.j,Math.floor(q.R/b.t.cols),(q.R%b.t.cols+1)/b.t.cols,0)}
          else fillTo(bid,q.j,q.R,b.t.deck?.kind==='head'?'heads':'words');
        }
        if(v>0)lit(bid);if(B[bid+'/0']){if(rest||!['trace','place'].includes(op.phase))growTo(bid+'/0',v);if(v>0)lit(bid+'/0')}}
    }
    if(op.cycle){const k=Math.min(4,Math.floor(u*5)),layer=Math.min(44,Math.floor((u*5-2)*45)),ids=[['ids'],['W_embed','x0'],WB.filter(b=>b.layer>=0&&b.layer<=layer&&b.t.id==='residual_out').map(b=>b.id),['h_final','W_head','logits'],['probs','next_id']][k];for(const x of ids)lit(x)}
    if (op.merge) {
      const d=s.merge[op.merge], [j,R]=mergeIndex(s,op,u);
      for(const name of d.ins)lit(id(s,name),wordBox(B[id(s,name)],j));
      if(rest || op.phase==='trace' && u>=1) {growTo(id(s,d.out),1);lit(id(s,d.out))}
      else if(op.phase==='trace' || op.phase==='place' && u>=1) {fillTo(id(s,d.out),j,R,'words');lit(id(s,d.out),wordBox(B[id(s,d.out)],j))}
      word=rest?-1:j;
    }
    if (op.expert) {
      if (op.expert === 'select') {
        const k = Math.min(s.expert.k - 1, Math.floor(u * s.expert.k));
        lit(id(s, s.expert.indices), wordBox(B[id(s, s.expert.indices)], 0));
        lit(id(s, 'x_ffn'), wordBox(B[id(s, 'x_ffn')], 0));
        lit(id(s, 'W_gu'), sliceBox(demo.at(s.expert.indices, 0, k)));
      } else {
        const [j,k,R] = expertIndex(s, op, u), pr = expertProduct(s, op.expert, j, k), d = s.expert.stages[op.expert];
        if (d.kind === 'activation') { lit(id(s, d.w), expertWordBox(pr.W,j,k)); lit(id(s,d.x), expertWordBox(pr.X,j,k)) }
        else { lit(id(s,d.w), pr.W.t.deck?.kind === 'expert' ? sliceBox(pr.e) : null); lit(id(s,d.x), expertWordBox(pr.X,j,k)) }
        if (pr.routed) lit(id(s,s.expert.indices), wordBox(B[id(s,s.expert.indices)],j));
        if (d.weighted) lit(id(s,s.expert.weights),wordBox(B[id(s,s.expert.weights)],j));
        if (rest || op.phase === 'trace' && u >= 1) { growTo(id(s,d.out),1); lit(id(s,d.out)) }
        else if (op.phase === 'trace' || ['place','all'].includes(op.phase) && u >= 1) { fillExpert(pr,j,k,R); lit(id(s,d.out),expertWordBox(pr.O,j,k)) }
        word = rest ? -1 : j;
      }
    }
    if (op.words) {
      // (a stack of heads apart grows word by word in every head at once; 'win' k: the word and the k − 1 before it)
      const w0 = (op.w0 || 0) / T, uu = w0 + (1 - w0) * u;   // (after the words the dot product before has computed)
      // (a product followed: the word the number followed is in — heads one under another are followed head by head, a word at a time in each)
      const j = op.trace && u < 1 ? tracedAt(op, u, traceOf(s, op))[0] : Math.min(T - 1, Math.floor(uu * T));
      for (const w of [op.words].flat()) {
        const out = id(s, w), b = B[out];
        if (gapped(b) && uu < 1) look.grow(out, -1, uu, 0); else growTo(out, uu);
        lit(out); if (u < 1) word = j;
      }
      for (const [x, how, k] of op.ins) { const b = B[id(s, x)];
        if (how === 'col') lit(id(s, x), wordBox(b, j));
        else if (how === 'win') { const [c0, c1] = wordBox(b, j); c0[b.orient === 'row' ? 1 : 0] = Math.max(0, j - k + 1); lit(id(s, x), [c0, c1]) }
        else lit(id(s, x)) }
    }
    if (op.heads) {
      const c = op.from + u * op.n, h = Math.min(op.from + op.n - 1, Math.floor(c));
      for (const [w, out] of op.heads) {
        const O = id(s, out);
        const w0 = (op.w0 || 0) / words.length;   // (the words of the first head already computed by the dot product before)
        if (op.slow) look.grow(O, h, u >= 1 ? 1 : w0 + (1 - w0) * clamp(c - h)); else look.grow(O, u >= 1 ? op.from + op.n - 1 : h, 1);
        if (u >= 1 && op.from + op.n >= H(B[O])) look.grow(O, null);
        lit(O); lit(id(s, w), sliceBox(h));
      }
      const j = Math.min(T - 1, Math.floor(((op.w0 || 0) / T + (1 - (op.w0 || 0) / T) * (c - h)) * T));
      op.slow ? lit(id(s, op.x), wordBox(B[id(s, op.x)], j)) : lit(id(s, op.x));
      if (op.slow && u < 1) word = j;
    }
    // a product followed (op.trace): what it computes grows number by number up to the number followed, not a column or
    // a head at once (09-27, the user: "为啥不是算出来一个数，而是突然出来一堆蓝色的块"); the other results of the beat alike
    if (op.trace && u < 1) {
      const [j, R] = tracedAt(op, u, traceOf(s, op));
      for (const out of op.words ? [op.words].flat() : op.heads.map(([, o]) => o)) fillTo(id(s, out), j, R, op.heads ? 'heads' : 'words');
      // (KDA: each head has its own S, apart from the others: lit, only the head followed — 09-29, the user: at first one
      // blue part pointed at, then "三个蓝色一起": the whole word's column had been lit, all 64 heads)
      if (op.by === 'kda') { const h = Math.floor(R / B[id(s, op.trace[2])].t.cols);
        for (const x of ['Q_conv', 'K_conv', 'V_conv', 'g']) { const [c0, c1] = wordBox(B[id(s, x)], j); c0[1] = h; c1[1] = h + 1; lit(id(s, x), [c0, c1]) }
        lit(id(s, 'beta'), wordBox(B[id(s, 'beta')], j));
        lit(id(s, 'state'), [[0, h, 0], [1e9, h + 1, 1e9]]) }
    }
    if (op.dot || op.mix || op.conv || op.write || op.coef || op.fg || op.beta) {   // (a mix, a write: their weights are the word's own coefficients, lit as its column; a conv: the words it reads)
      const d = op.dot ? s.dot : op.mix ? s.mix : op.conv ? s.conv : op.write ? s.write : op.coef ? s.coef : op.fg ? s.fg : s.beta, ph = op.dot || op.mix || op.conv || op.write || op.coef || op.fg || op.beta, W = id(s, d.w), X = id(s, d.x), O = id(s, d.out);
      if (op.conv) { const [c0, c1] = wordBox(B[X], d.word); c0[0] = Math.max(0, d.word - d.k + 1); lit(X, [c0, c1]) } else lit(X, wordBox(B[X], d.word));
      if (op.coef) { lit(id(s, d.scale)); lit(id(s, d.base)) }   // (a coefficient: fn whole — one row of it is 1/24 of its thin height —, its scale and its base)
      if (op.fg) { const h = Math.floor(d.R / B[O].t.cols), band = [[0, h, 0], [1e9, h + 1, 1e9]];   // (the forget gate: the head's rows of W_f_b, its dt_bias, its A_log)
        lit(W, band); lit(id(s, d.bias), band); lit(id(s, d.rate), [[0, 0, h], [1e9, 1e9, h + 1]]) }
      else if (op.conv || op.coef) lit(W); else if (op.mix || op.write) lit(W, wordBox(B[W], d.word)); else B[W].div[2] > 1 && B[W].t.cols > 1 ? lit(W, sliceBox(headOf(B[W], d.R))) : lit(W);
      if (op.write) lit(id(s, d.y), wordBox(B[id(s, d.y)], d.word));
      if ((ph === 'place' || ph === 'all') && u >= 1 || rest) {   // the result: the one number there, the rest to come
        if (rest) growTo(O, 1); else fillTo(O, d.word, op.write ? d.s * B[O].t.cols + d.R : d.R, 'words');
        lit(O);
      }
    }
    if (op.kda) {   // one read-out acted out: the head's slice of the word in what each part reads; S's head; the number placed
      const d = s.kda, ph = op.kda, j = d.word, h = d.head, head = (x, w = j) => { const b = B[id(s, x)], [c0, c1] = wordBox(b, w); c0[1] = h; c1[1] = h + 1; lit(id(s, x), [c0, c1]) };
      lit(id(s, 'state'), [[0, h, 0], [1e9, h + 1, 1e9]]);
      if (ph === 'pick' || ph === 'recall') { head('K_conv'); head('V_conv'); head('g'); lit(id(s, 'beta'), wordBox(B[id(s, 'beta')], j)) }
      if (ph === 'pick' || ph === 'read' || ph === 'place') head('Q_conv');
      if (ph === 'read') head('K_conv');
      if (ph === 'place' && u >= 1 || rest) { const O = id(s, d.out); if (rest) growTo(O, 1); else fillTo(O, j, h * B[O].t.cols + d.c, 'words'); lit(O) }
      if (u < 1 && !rest) word = j;
    }
    if (op.gn) {   // the gated norm acted out: the head of the word in the gate, then in the read-out; γ; its result's head filled while placed
      const d = s.gn, ph = op.gn, j = d.word, h = d.head, O = id(s, d.out), per = B[O].t.cols, head = x => lit(id(s, x), [[j, h, 0], [j + 1, h + 1, 1e9]]);
      if (ph !== 'square' && ph !== 'mean') head(d.gate);
      if (ph !== 'gate' && ph !== 'carry') head(d.x);
      if (ph === 'scale' || ph === 'place' || rest) lit(id(s, d.g));
      if (ph === 'place' || rest) { const R = rest || u >= 1 ? per - 1 : placedAt(u, per); if (rest) growTo(O, 1); else if (R >= 0) fillTo(O, j, h * per + R, 'words'); if (R >= 0) lit(O) }
      if (u < 1 && !rest) word = j;
    }
    if (op.ew) {   // a result number by number from two at the same place: the word's two rows / columns; its own filled while placed
      const d = s.ew, O = id(s, d.out), n = B[O].t.cols, [ph, v] = op.ew === 'all' ? ewAll(u) : [op.ew, u];
      for (const x of [d.a, d.b]) lit(id(s, x), wordBox(B[id(s, x)], d.word));
      if (ph === 'place' || rest) {
        const R = rest || v >= 1 ? n - 1 : placedAt(v, n);
        if (rest) growTo(O, 1); else if (R >= 0) fillTo(O, d.word, R, 'words');
        if (R >= 0) lit(O);
      }
      if (u < 1 && !rest) word = d.word;
    }
    if (op.norm) {   // a RMSNorm acted out: the word's column; γ from the scaling on; its result's column filled while placed
      const d = s.norm, X = id(s, d.x), O = id(s, d.out), n = B[X].t.cols, [ph, v] = op.norm === 'all' ? normAll(u) : [op.norm, u];
      lit(X, wordBox(B[X], d.word)); if (!RMS_PH.includes(ph) || rest) lit(id(s, d.g));
      if (ph === 'place' || rest) {
        const R = rest || v >= 1 ? n - 1 : placedAt(v, n);
        if (rest) growTo(O, 1); else if (R >= 0) fillTo(O, d.word, R, 'words');
        if (R >= 0) lit(O);
      }
      if (u < 1 && !rest) word = d.word;
    }
    if (op.route) {
      const d = s.route, ph = op.route, { j, k } = routeAt(s, ph, u), X = id(s, d.x), I = id(s, d.indices), W = id(s, d.weights);
      lit(X, rest ? null : wordBox(B[X], j));
      if (ph === 'choose' || rest) lit(id(s, d.bias));
      if (rest) { growTo(I, 1); growTo(W, 1); lit(I); lit(W) }
      else {
        if (ph !== 'sigmoid') { fillTo(I, j, ph === 'choose' || ph === 'rest' ? k : d.k - 1, 'words'); lit(I) }
        if (ph === 'place' || ph === 'rest') { fillTo(W, j, k, 'words'); lit(W) }
        word = j;
      }
    }
    if (op.tour) {
      const steps = layerOf(s).steps.filter(st => st.half === op.tour), k = Math.min(steps.length - 1, Math.floor(u * steps.length));
      steps.forEach((st, i) => { const v = clamp(u * steps.length - i); for (const w of st.writes) growTo(id(s, w), v) });
      for (const st of rest ? steps : [steps[k]]) for (const x of [...st.reads, ...st.params, ...st.writes]) lit(id(s, x));
    }
  }
  // what a segment computes (gone before its beat, grown by it)
  const outsOf = s => {
    const o = new Set();
    for (const { op, dot } of s.beats) {
      if(op.lesson)op.lesson.writes.forEach(x=>o.add(x));
      if(op.transit!==undefined)for(const st of M.layers[op.transit].steps)for(const x of st.writes)o.add(lid(op.transit)+':'+x);
      if (op.words) for (const w of [op.words].flat()) o.add(w);
      if (op.heads) for (const [, out] of op.heads) o.add(out);
      if (op.dot) o.add((dot || s.dot).out);
      if (op.norm) o.add(s.norm.out);
      if (op.mix) o.add(s.mix.out);
      if (op.conv) o.add(s.conv.out);
      if (op.write) o.add(s.write.out);
      if (op.coef) o.add(s.coef.out);
      if (op.fg) o.add(s.fg.out);
      if (op.beta) o.add(s.beta.out);
      if (op.gn) o.add(s.gn.out);
      if (op.ew) o.add(s.ew.out);
      if (op.kda) o.add(s.kda.out);
      if (op.route) { o.add(s.route.indices); o.add(s.route.weights) }
      if (op.expert && op.expert !== 'select') o.add(s.expert.stages[op.expert].out);
      if (op.merge) o.add(s.merge[op.merge].out);
      if (op.tour) for (const st of layerOf(s).steps.filter(st => st.half === op.tour)) for (const w of st.writes) o.add(w);
    }
    return [...o].map(x => id(s, x));
  };
  const OUTS = new Map(SEGMENTS.map(s => [s.n, outsOf(s)]));

  // ---- one dot product acted out (09-26; the user: "他们就是可以看到每一列的每个数，每个矩阵中的每个数是怎么算出来的"), drawn as
  // bbycroft draws it (09-27; the user: "前端有点丑……参考是有线的"; llm-viz components/DataFlow.ts): the formula
  // `dot(row, column) = value` — the row and the column as small swatches of their colours —, thin lines from the swatches
  // to the weight's row and the input's column, a dark arrow into the result's cell. The numbers it is made of come out of
  // their places as small cells of the two colours and stand in pairs (×), each pair its value and its product beside it;
  // the products go into the formula, which gets its value; the value goes down the arrow. The formula, its name and the
  // pairs stand on one card (09-27, the user: "和 Q[6, 64 头, 128] 这个文字重叠了……用个框框起来"), put where it covers
  // no name and none of the numbers it points at. A number at the true scale is 1/128 of a cell: the cells are a readable
  // size and come from where the numbers are. Only the first 6 pairs and the last stand out; the rest are said
  // ("⋮ 其余 4089 对"). The numbers are demo/'s.
  // The beats after it that compute the rest (op.trace; 09-27, the user: "后续线也是要有的，加速就行了") keep the card,
  // its lines and its arrow on the number being computed at that moment: the formula and its value, no pairs.
  const layer = document.createElement('div'); layer.className = 'dotlayer'; host.append(layer);
  const el = (cls, html = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; layer.append(e); return e };
  // On the card, in this order: the number's name; the shapes of the whole product and of the one number (09-27, the user:
  // "框里面能不能给出是什么形状的在做运算，算出来以后又是怎么形状"); the pairs while they are there. The formula is a small
  // tab of its own on the card's side toward what it reads, and the lines, over everything, start at its swatches (09-28,
  // the user: "这个框里面的介绍把线都挡住了" — drawn under the card, they seemed to stop at its edge)
  // (on a small picture there may be no place clear of the names: the card is then like the page's other UI, and the
  // names under it hide while it is there: model.html hideUnderUI)
  const card = el('dot-card', '<div class="dot-tag"></div><div class="dot-shape all"></div><div class="dot-shape one"></div>'); card.id = 'dotcard';
  const pill = el('dot-pill', '<div class="dot-formula"></div>'); pill.id = 'dotpill';
  const SVGNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'dotlines'); layer.append(svg);
  svg.innerHTML = '<defs><marker id="dotarrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#1f1d1a"/></marker></defs>';
  const path = cls => { const e = document.createElementNS(SVGNS, 'path'); e.setAttribute('class', cls); svg.append(e); return e };
  const tag = card.querySelector('.dot-tag'), whole = card.querySelector('.all'), one = card.querySelector('.one'), formula = pill.querySelector('.dot-formula'), lxs = Array.from({length:6},() => path('dl x')), lw = path('dl w'), lx = path('dl x'), lo = path('dl o');
  const incomingPort = el('dot-incoming'), targetCell = el('dot-target'), targetName = el('dot-target-label', '写入位置');
  const sourcePorts = Array.from({length:7},()=>el('dot-source'));
  const sourceOrigins = new Map();
  const sourcePins = new Map([lw, ...lxs].map(p => [p, el('dot-anchor')]));
  const expertPlane = document.createElementNS(SVGNS,'svg'); expertPlane.setAttribute('class','dot-expert-plane'); layer.insertBefore(expertPlane,card);
  const expertEdge = document.createElementNS(SVGNS,'path'); expertPlane.append(expertEdge);
  const px = p => { const q = p.clone().project(camera); return [(q.x + 1) / 2 * host.clientWidth, (1 - q.y) / 2 * host.clientHeight] };
  // a number with 3 significant digits (a small one gets more decimals, never shows as 0.000); d: at least so many decimals
  // (a number too small for 7 decimals: 3 digits × 10 to a power — 09-29, a read-out's squares, 10⁻⁷)
  const sci = v => { if (v === 0 || Math.abs(v) >= 1e-4) return fmt(v, 4); const e = Math.floor(Math.log10(Math.abs(v))); return `${(v / 10 ** e).toFixed(2)}×10${String(e).replace('-', '⁻').replace(/\d/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}` };
  const fmt = (v, d = 3) => { const a = Math.abs(v), k = a === 0 ? d : Math.min(7, Math.max(d, 2 - Math.floor(Math.log10(a)))); return (v < 0 ? '−' : '') + a.toFixed(k) };
  const ease = v => { v = clamp(v); return v < .5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2 };
  const SHOW = [0, 1, 2, 3, 4, 5];
  // where one number stands in the 3D (the layout's rules, flow-layout.js shapeOf): a result's number i of word w (the
  // word's numbers in the official order: head after head), a weight's element [R, c] of its official [out, in]
  const along = (b, k, n, ax) => ax === 'x' ? b.x0 + (k + .5) / n * (b.x1 - b.x0) : b.y1 - (k + .5) / n * (b.y1 - b.y0);
  const slabZ = (b, h) => { const H = b.div[2]; if (H <= 1) return b.z1; const pitch = (b.z1 - b.z0) / H; return b.z1 - h * pitch - pitch / (1 + (b.headGap || 0)) / 2 };
  function dataAt(b, w, i) {
    const t = b.t, T = words.length, per = t.cols, H = t.deck?.n || 1;
    if (b.orient === 'row') return V(along(b, i, per, 'x'), along(b, w, T, 'y'), b.z1);
    const x = along(b, w, T, 'x');
    if (b.alt === 'y') return V(x, along(b, i, per * H, 'y'), b.z1);   // heads one under another: all a word's numbers down
    if (b.div[2] > 1 && per > 1) return V(x, along(b, i % per, per, 'y'), slabZ(b, Math.floor(i / per)));   // heads back in depth
    return V(x, along(b, i, per > 1 ? per : H, 'y'), b.z1);
  }
  function weightAt(b, R, c) {
    const t = b.t, per = t.cols, H = t.deck?.n || 1, nin = t.rows.n;
    if (b.orient === 'wt') return V(along(b, R, per, 'x'), along(b, c, nin, 'y'), b.z1);   // output along x, input down y
    if (t.headAxis === 'y') return V(along(b, c, nin * H, 'x'), along(b, R, per, 'y'), b.z1);   // W_o: its heads side by side along x
    if (b.alt === 'y') return V(along(b, c, nin, 'x'), along(b, R, per * H, 'y'), b.z1);          // heads one under another: all its rows down
    if (b.div[2] > 1 && per > 1) return V(along(b, c, nin, 'x'), along(b, R % per, per, 'y'), slabZ(b, Math.floor(R / per)));
    return V(along(b, c, nin, 'x'), along(b, R, per > 1 ? per : H, 'y'), b.z1);
  }
  const headOf = (b, i) => b.div[2] > 1 && b.t.cols > 1 ? Math.floor(i / b.t.cols) : 0;
  const hex = c => '#' + new THREE.Color(c).getHexString();
  // a colour on the card (the swatches, the cells): one as light as the card (a γ's pale weight colour) a step darker
  const onCard = c => { const k = new THREE.Color(c), hsl = {}; k.getHSL(hsl); return '#' + (hsl.l > .86 ? k.lerp(new THREE.Color(0x6b665c), .3) : k).getHexString() };
  const deep = c => '#' + new THREE.Color(c).lerp(new THREE.Color(0x1f1d1a), .42).getHexString();   // lines and edges: a step darker, to show on the page
  // a product [weight, input, result] of a segment: its blocks, its colours (the model's own, as tuned), its sizes
  function product(s, [w, x, out]) {
    const W = B[id(s, w)], X = B[id(s, x)], O = B[id(s, out)];
    const cw = onCard(look.palette[W.comp][1]), cx = onCard(look.palette[X.comp][0]), co = onCard(look.palette[O.comp][0]);
    return { w, x, out, W, X, O, cw, cx, co, n: demo.W.tensors[w].shape[1], N: demo.get(out).shape[1] };
  }
  // the pairs of a segment's sum of products, made once: its `dot` (a weight's row · a word's column) or its `mix` (09-28:
  // mHC's collapse — a word's streams at one place · the word's pre, a dot product of 4). What a kind gives (dotTerms,
  // mixTerms): {pr, n (terms in all), cs (the terms shown), wv, xv (their numbers), total, wAt(c), xAt(c) (where term c's
  // two numbers stand), wLine, xLine (where the lines go), oAt (the result's cell), fill(value) (the card; its height)}
  const dots = new Map();
  function sumParts(s, kind) {
    const key = kind + ':' + s.n + (kind === 'dot' ? ':' + s.dot.out : ''); if (dots.has(key)) return dots.get(key);
    const T = kind.startsWith('expert:') ? expertTerms(s,kind.slice(7)) : ({ mix: mixTerms, conv: convTerms, write: writeTerms, coef: coefTerms, fg: fgTerms, beta: betaTerms, recall: s => kdaTerms(s, 'recall'), read: s => kdaTerms(s, 'read') }[kind] || dotTerms)(s), { pr, cs } = T;
    T.pv = cs.map((c, k) => T.wv[k] * T.xv[k]);
    T.note = el('dot-note', `⋮ 其余 ${T.n - cs.length} 对`); T.sumLine = el('dot-sumline', ''); T.drop = el('dot-cell drop', '');
    T.drop.style.background = pr.co; T.drop.style.borderColor = deep(pr.co);
    T.rows = cs.map(c => ({ c, w: el('dot-cell', ''), x: el('dot-cell', ''), times: el('dot-x', '×'), txt: el('dot-txt', '') }));
    T.rows.forEach((r, k) => { const cx = T.xcol ? T.xcol(k) : pr.cx; r.w.style.background = pr.cw; r.x.style.background = cx; r.w.style.borderColor = deep(pr.cw); r.x.style.borderColor = deep(cx) });
    if (s.focusLabels && kind === 'recall' && host.clientWidth < 700) for (const r of T.rows) { r.txt.style.fontSize='10.5px'; r.txt.style.lineHeight='11px' }
    dots.set(key, T); return T;
  }
  const dotParts = s => sumParts(s, 'dot');
  function dotTerms(s) {
    const d = s.dot, pr = product(s, [d.w, d.x, d.out]), n = pr.n, R = d.R, j = d.word, cs = [...SHOW, n - 1];
    return { pr, n, cs, wv: cs.map(c => demo.weight(d.w, R, c)), xv: cs.map(c => demo.at(d.x, j, c)), total: demo.at(d.out, j, R),
      wAt: c => weightAt(pr.W, R, c), xAt: c => dataAt(pr.X, j, c), wLine: weightAt(pr.W, R, n / 2), xLine: dataAt(pr.X, j, n * .85),   // (the column: low in it, in the picture)
      oAt: dataAt(pr.O, j, R), fill: v => fillCard(pr, d.tag, j, R, v, 'dot:' + s.n + ':' + d.out) };
  }
  // a mix [coefficients, streams, result]: a word's numbers at one place in each stream, each × the word's coefficient
  // for that stream (its first k: pre), summed
  function mixProduct(s, [w, x, out]) {
    const W = B[id(s, w)], X = B[id(s, x)], O = B[id(s, out)];
    return { w, x, out, W, X, O, cw: onCard(look.palette[W.comp][0]), cx: onCard(look.palette[X.comp][0]), co: onCard(look.palette[O.comp][0]), n: X.t.cols, N: O.t.cols, k: X.t.deck.n };
  }
  const inputName = pr => cur.incoming?.includes(pr.x) ? '上一层送来的 4 路（从上方进入）' : pr.X.t.name;
  const mixWhole = pr => `<i>整块</i>${inputName(pr)} <b>[6, ${pr.k}, ${pr.n}]</b> 按 pre <b>[6, ${pr.k}]</b> 加权 → ${pr.O.t.name} <b>[6, ${pr.N}]</b>`
    + `<br>每个词：${pr.k} 路同一位置的数各乘自己那一路的 pre，再相加 = 1 个数`;
  const mixOne = (pr, j, R) => `<i>这一个</i>${wordOf(j)} ${pr.k} 路的第 ${R + 1} 个数 <b>[${pr.k}]</b> 和${wordOf(j)}的 pre <b>[${pr.k}]</b> 一对一对相乘、再加起来 → <b>1</b> 个数`;
  const mixForm = (pr, v) => `dot(<i class="sw row" style="background:${pr.cw}"></i>, <i class="sw col" style="background:${pr.cx}"></i>) = <b>${v}</b>`;
  // a causal conv [taps, input, result] (09-29): a channel's number of a word = that channel of the word and the k − 1 words
  // before it, each × one of the channel's k taps, summed, then SiLU (a word before the first: 0)
  function convProduct(s, [w, x, out]) {
    const W = B[id(s, w)], X = B[id(s, x)], O = B[id(s, out)];
    return { w, x, out, W, X, O, cw: onCard(look.palette[W.comp][1]), cx: onCard(look.palette[X.comp][0]), co: onCard(look.palette[O.comp][0]), n: demo.get(x).shape[1], N: demo.get(out).shape[1], k: W.t.rows.n };
  }
  const convWhole = pr => `<i>整块</i>${inputName(pr)} <b>[6, ${pr.n}]</b>，卷积核 <b>[${pr.n}, ${pr.k}]</b>（每个通道 ${pr.k} 个抽头）→ ${pr.O.t.name} <b>[6, ${pr.N}]</b>${headsOf(pr.O.t) ? ` = <b>${headsOf(pr.O.t)}</b>` : ''}`
    + `<br>每个词、每个通道：本词和前 ${pr.k - 1} 个词 × ${pr.k} 个抽头，相加，再 SiLU = 1 个数`;
  const convOne = (pr, j, R) => `<i>这一个</i>第 ${R + 1} 个通道上，${[...Array(pr.k).keys()].map(k => j - pr.k + 1 + k).filter(w => w >= 0).map(wordOf).join('、')}${j < pr.k - 1 ? `（前面缺 ${pr.k - 1 - j} 个词，当成 0）` : ''} <b>[${pr.k}]</b> 和这个通道的 ${pr.k} 个抽头 <b>[${pr.k}]</b> 一对一对相乘、相加，再 SiLU → <b>1</b> 个数`;
  const convForm = (pr, v) => `SiLU(dot(<i class="sw row" style="background:${pr.cw}"></i>, <i class="sw col" style="background:${pr.cx}"></i>)) = <b>${v}</b>`;
  function convTerms(s) {
    const d = s.conv, pr = convProduct(s, [d.w, d.x, d.out]), j = d.word, R = d.R, cs = [...Array(pr.k).keys()], at = k => j - pr.k + 1 + k, [src, off] = d.src;
    const wv = cs.map(k => demo.weight(src, off + R, k)), xv = cs.map(k => at(k) < 0 ? 0 : demo.at(d.x, at(k), R));
    return { pr, n: pr.k, cs, wv, xv, total: demo.at(d.out, j, R), post: { name: 'SiLU', sum: cs.reduce((a, k) => a + wv[k] * xv[k], 0) },
      rowNote: k => at(k) < 0 ? '（0）' : wordOf(at(k)),
      wAt: k => weightAt(pr.W, R, k), xAt: k => dataAt(pr.X, Math.max(0, at(k)), R), wLine: weightAt(pr.W, R, (pr.k - 1) / 2), xLine: dataAt(pr.X, j - (pr.k - 1) / 2, R),
      oAt: dataAt(pr.O, j, R), fill: v => setCard(d.tag, convWhole(pr), convOne(pr, j, R), convForm(pr, v), 'conv:' + s.n) };
  }
  // a write-back [coefficients, old streams, result, the half's output] (09-29): a number of new stream s = post_s × the
  // output's number there + the old streams' numbers there, each × comb[r, s] — 5 pairs (official 1318–1320:
  // post · y + combᵀ @ streams; the 24 coefficients: pre 4, post 4, comb 4 × 4 row by row)
  const sub = k => String(k).replace(/\d/g, c => '₀₁₂₃₄₅₆₇₈₉'[c]);
  function writeProduct(s) {
    const d = s.write, W = B[id(s, d.w)], X = B[id(s, d.x)], O = B[id(s, d.out)], Y = B[id(s, d.y)];
    // (cw: the line to the old streams; cx: the line to the output; cold: the old streams' cells)
    return { w: d.w, x: d.x, out: d.out, W, X, O, Y, cw: onCard(look.palette[X.comp][0]), cx: onCard(look.palette[Y.comp][0]), cold: onCard(look.palette[X.comp][0]), cy: onCard(look.palette[Y.comp][0]), co: onCard(look.palette[O.comp][0]),
      n: X.t.cols, N: demo.get(d.out).shape.slice(1).reduce((a, b) => a * b, 1), k: X.t.deck.n };
  }
  const writeWhole = pr => `<i>整块</i>${pr.Y.t.name} <b>[6, ${pr.n}]</b> 和旧 ${pr.k} 路 <b>[6, ${pr.k}, ${pr.n}]</b>，按 post <b>[6, ${pr.k}]</b>、comb <b>[6, ${pr.k}, ${pr.k}]</b> → ${pr.O.t.name} <b>[6, ${pr.k}, ${pr.n}]</b>`
    + `<br>新第 s 路的每个数 = post_s × ${pr.Y.t.name}这个位置的数 + 旧 ${pr.k} 路这个位置的 ${pr.k} 个数各乘 comb 第 s 列`;
  const writeOne = (pr, j, st, R) => `<i>这一个</i>${wordOf(j)} 新第 ${st + 1} 路第 ${R + 1} 个数：${pr.k + 1} 对相乘、再加起来 → <b>1</b> 个数（旧 ${pr.k} 路和系数在上面）`;
  // the formula: each swatch the colour of the block its line goes to (09-29, the user: "蓝色的块，但是对应的却是紫色" —
  // dot(▬, ▮) had two purple swatches, one of whose lines went to the blue output): post × (the output) + comb × (the old streams)
  const writeForm = (pr, v) => `post × <i class="sw col" style="background:${pr.cx}"></i> + comb × <i class="sw row" style="background:${pr.cold};width:8px;height:18px"></i> = <b>${v}</b>`;
  function writeTerms(s) {
    const d = s.write, pr = writeProduct(s), j = d.word, R = d.R, st = d.s, n = pr.n, K = pr.k, cs = [...Array(K + 1).keys()];
    const wi = k => k === 0 ? K + st : 2 * K + (k - 1) * K + st;   // (the coefficient's column: post_s; comb[r, s])
    return { pr, n: K + 1, cs, wv: cs.map(k => demo.at(d.w, j, wi(k))), xv: cs.map(k => k === 0 ? demo.at(d.y, j, R) : demo.at(d.x, j, k - 1, R)), total: demo.at(d.out, j, st, R),
      xcol: k => k === 0 ? pr.cy : pr.cold, rowNote: k => k === 0 ? `(post${sub(st + 1)}, 输出)` : `(comb${sub(k)}${sub(st + 1)}, 旧 ${k} 路)`,
      wAt: k => dataAt(pr.W, j, wi(k)), xAt: k => k === 0 ? dataAt(pr.Y, j, R) : dataAt(pr.X, j, (k - 1) * n + R),
      // (the old streams and the coefficients stand far above, out of the picture: their numbers come down from its top edge,
      // no line to them — 10-02, the camera goes only down the spine; before, it flew up for them and carried them down)
      wLine: dataAt(pr.X, j, R), xLine: dataAt(pr.Y, j, R), oAt: dataAt(pr.O, j, st * n + R),
      fill: v => setCard(d.tag, writeWhole(pr), writeOne(pr, j, st, R), writeForm(pr, v), 'write:' + s.n) };
  }
  // KDA, one read-out (09-29): number c of head h of word t = Σ_r S[r, c] · q_r, S being the head's memory once this word
  // is written into it. Acted out in two rounds on the same column c of S: recall — (S[r, c] × e^g_r) × k_r summed, what S
  // remembers for this k, and δ = (v_c − that) × β —; read — S[r, c] after the write (+ k_r × δ) × q_r summed. The numbers
  // are the page's own run of the official recurrence (demo-data.js kdaHead), equal to the file's.
  function kdaProduct(s) {
    const d = s.kda, W = B[id(s, 'state')], O = B[id(s, d.out)], Q = B[id(s, 'Q_conv')], K = B[id(s, 'K_conv')], Vv = B[id(s, 'V_conv')], G = B[id(s, 'g')], Be = B[id(s, 'beta')];
    return { w: 'state', x: 'Q_conv', out: d.out, W, X: Q, K, Vv, G, Be, O, cw: onCard(look.palette[W.comp][1]), cx: onCard(look.palette[Q.comp][0]), co: onCard(look.palette[O.comp][0]), n: O.t.cols, N: demo.get(d.out).shape[1], H: O.t.deck.n };
  }
  const kdaWhole = pr => `<i>整块</i>q、k、v、g <b>[6, ${pr.H} 头, ${pr.n}]</b>、β <b>[6, ${pr.H}]</b> → ${pr.O.t.name} <b>[6, ${pr.H} 头, ${pr.n}]</b>；记忆 S <b>[${pr.H} 头, ${pr.n}, ${pr.n}]</b> 一个词一个词地改`
    + `<br>每个词、每个头：S 衰减、对照、修正写入，再用 q 读出 ${pr.n} 个数`;
  // the tab of a KDA number: a row a block it uses (its name, what it is for, its swatch at the row's end), then the value
  const kdaStack = (pr, rows, value) => `<div class="stk">${rows.map(([t, role]) => `<div><span class="role">${role}</span> ${t} <i class="sw ex" style="background:${t === 'S' ? pr.cw : pr.cx};width:14px;height:10px"></i></div>`).join('')}<div class="val">${value}</div></div>`;
  function kdaTerms(s, kind) {
    const d = s.kda, pr = kdaProduct(s), j = d.word, h = d.head, c = d.c, n = pr.n, W = demo.kdaHead(h)[j], cs = [...SHOW, n - 1], R = h * n;
    const at = (M, r) => M[r * n + c], recall = kind === 'recall';
    const sq = (a, x) => `<i class="sw ${a}" style="background:${a === 'row' ? pr.cw : pr.cx};${a === 'col' ? '' : 'width:8px;height:18px'}"></i>`;
    const mid = R + n / 2;
    return { pr, n, cs, wv: cs.map(r => recall ? at(W.dec, r) : at(W.S, r)), xv: cs.map(r => recall ? W.k[r] : W.q[r]), total: recall ? W.mem[c] : W.o[c],
      wAt: r => weightAt(pr.W, R + r, c), xAt: r => dataAt(recall ? pr.K : pr.X, j, R + r), wLine: weightAt(pr.W, R + n / 2, c), xLine: dataAt(recall ? pr.K : pr.X, j, R + n / 2),
      oAt: dataAt(pr.O, j, R + c), extra: recall ? 22 : 0, stackOf: [pr.X, pr.K, pr.Vv, pr.G, pr.Be, pr.W, pr.O],
      // (recall: k to recall with, v and β for δ, g for the decay; read: q to read with, k for the write — each a row of the
      // tab, in the order the blocks stand down the picture, S last)
      more: () => (recall ? [[dataAt(pr.K, j, mid), pr.cx], [dataAt(pr.Vv, j, R + c), pr.cx], [dataAt(pr.G, j, mid), pr.cx], [dataAt(pr.Be, j, h), pr.cx]]
        : [[dataAt(pr.X, j, mid), pr.cx], [dataAt(pr.K, j, mid), pr.cx]]).concat([[weightAt(pr.W, mid, c), pr.cw]]),
      rowText: (k, ph, m, prod) => { const r = cs[k];
        if (recall) return `(${fmt(at(W.old, r))} × ${fmt(W.eg[r])})${s.focusLabels && host.clientWidth<700 ? "<br>" : " "}× ${fmt(W.k[r])}${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(prod)}</b></span>` : ''}`;
        return ph === 'pull' ? `${fmt(at(W.dec, r))} + ${fmt(W.k[r])} × δ → <b>${fmt(at(W.S, r))}</b>` : `${fmt(at(W.S, r))} × ${fmt(W.q[r])}${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(prod)}</b></span>` : ''}` },
      sumSay: recall ? `${n} 个乘积加起来 = S 记得的 v：<b>${fmt(W.mem[c])}</b><br>δ = (v ${fmt(W.v[c])} − ${fmt(W.mem[c])}) × β ${fmt(W.beta)} = <b>${fmt(W.delta[c])}</b>` : null,
      fill: v => setCard(d.tag, kdaWhole(pr), recall
          ? `<i>先改 S</i>第 ${h + 1} 个头 S 的第 ${c + 1} 列 <b>[${n}]</b>：每行（S × e^g）× k，相加 → S 记得的 v（1 个数）`
          : `<i>再读出</i>这一列每行先 + k × δ（修正写入），再 × q，相加 → <b>1</b> 个数`,
        kdaStack(pr, recall ? [['k', '对照'], ['v', '求 δ'], ['g', '衰减 e^g'], ['β', '求 δ'], ['S', `第 ${c + 1} 列`]] : [['q', '读出'], ['k', '修正写入'], ['S', `第 ${c + 1} 列`]],
          recall ? `S 记得的 v = <b>${v}</b>` : `读出 = <b>${v}</b>`), 'kda:' + s.n + ':' + kind) };
  }
  function mixTerms(s) {
    const d = s.mix, pr = mixProduct(s, [d.w, d.x, d.out]), j = d.word, R = d.R, cs = [...Array(pr.k).keys()];
    return { pr, n: pr.k, cs, wv: cs.map(k => demo.at(d.w, j, k)), xv: cs.map(k => demo.at(d.x, j, k, R)), total: demo.at(d.out, j, R),
      wAt: k => dataAt(pr.W, j, k), xAt: k => dataAt(pr.X, j, k * pr.n + R), wLine: dataAt(pr.W, j, (pr.k - 1) / 2), xLine: dataAt(pr.X, j, R),
      oAt: dataAt(pr.O, j, R), fill: v => setCard(d.tag, mixWhole(pr), mixOne(pr, j, R), mixForm(pr, v), 'mix:' + s.n) };
  }
  // mHC's 24 numbers of a word (09-29): its 4 streams laid end to end (16384 numbers), ÷ their rms (no γ), · fn's row R,
  // × the group's scale + the number's base; then pre: sigmoid + hc_eps; post: 2 · sigmoid; comb: its row of 4 softmax'd,
  // the 4 × 4 made doubly stochastic (Sinkhorn) — official 279–292. A dot product of 16384 pairs, acted out on a pre or a
  // post (a comb needs its 15 others: said, not acted)
  function coefProduct(s) {
    const d = s.coef, W = B[id(s, d.w)], X = B[id(s, d.x)], O = B[id(s, d.out)], Sc = B[id(s, d.scale)], Ba = B[id(s, d.base)];
    return { w: d.w, x: d.x, out: d.out, W, X, O, Sc, Ba, cw: onCard(look.palette[W.comp][1]), cx: onCard(look.palette[X.comp][0]), co: onCard(look.palette[O.comp][0]),
      per: X.t.cols, k: X.t.deck.n, n: X.t.cols * X.t.deck.n, N: O.t.cols };
  }
  // (fn [24, 16384] as drawn: a word's 4 streams one behind another, like the streams it multiplies; a stream's 4096 along x, the 24 rows down)
  const fnAt = (b, R, c) => { const per = b.t.rows.n; return V(along(b, c % per, per, 'x'), along(b, R, b.t.cols, 'y'), slabZ(b, Math.floor(c / per))) };
  const coefGroup = (R, k) => R < k ? ['pre', R, 0] : R < 2 * k ? ['post', R - k, 1] : ['comb', R - 2 * k, 2];   // (the group, the number in it, its scale)
  const coefName = (R, k) => { const [g, i] = coefGroup(R, k); return g === 'comb' ? `comb${sub(Math.floor(i / k) + 1)}${sub(i % k + 1)}` : g + sub(i + 1) };
  const coefAct = { pre: ['sigmoid(', ') + 10⁻⁶', '过 sigmoid'], post: ['2·sigmoid(', ')', '过 2·sigmoid'], comb: ['Sinkhorn(softmax(', '))', '这一行 4 个一起 softmax，4×4 再做 Sinkhorn'] };
  const coefWhole = pr => cur.incoming ? `<i>整块</i>L03 的 4 路 <b>[6, 4, 4096]</b><br>每词展平为 <b>[16384]</b>，fn <b>[24, 16384]</b> → 系数 <b>[6, 24]</b>` : `<i>整块</i>${inputName(pr)} <b>[6, ${pr.k}, ${pr.per}]</b>（每个词 ${pr.k} 路连成 <b>[${pr.n}]</b>）× fn <b>[${pr.N}, ${pr.n}]</b> → 24 个系数 <b>[6, ${pr.N}]</b>`
    + `<br>每个词：÷ 自己的 rms，和 fn 的每一行点积，× scale + base，再过各组的激活 = 1 个数`;
  const coefOne = (pr, j, R, rms) => cur.incoming ? `<i>这一个</i>${wordOf(j)}先 ÷ rms ${fmt(rms)}，与 fn 第 ${R + 1} 行做 ${pr.n} 对乘加；× scale、+ base，${coefAct[coefGroup(R, pr.k)[0]][2]} → <b>${coefName(R, pr.k)}</b>` : `<i>这一个</i>${wordOf(j)} ${pr.k} 路连成的 <b>[${pr.n}]</b> 先 ÷ 它们的 rms（${fmt(rms)}），再和 fn 第 ${R + 1} 行 <b>[${pr.n}]</b> 一对一对相乘、相加；× scale、+ base，${coefAct[coefGroup(R, pr.k)[0]][2]} → <b>1</b> 个数：${coefName(R, pr.k)}`;
  const coefForm = (pr, R, v) => { const [a, b] = coefAct[coefGroup(R, pr.k)[0]], ex = `<i class="sw ex" style="background:${pr.cw};width:10px;height:10px"></i>`;
    return `${a}base${ex} + scale${ex} × dot(<i class="sw row" style="background:${pr.cw}"></i>, <i class="sw col" style="background:${pr.cx}"></i>)${b} = <b>${v}</b>` };
  // (the base and the scale of number R, as the formula's swatches go: base, scale — left to right as they stand in the
  // picture, left of fn, so the lines do not cross; 09-29)
  // (an upright line goes to the end of fn's row, of the word's column, nearer the tab: not along the block to its middle —
  // 09-29, the user: "线都不是太好看"; fn's front edge or its back one, the column's top or its bottom)
  const coefEnds = (pr, j, R) => { const W = pr.W, mx = (W.x0 + W.x1) / 2, y = along(W, R, W.t.cols, 'y');
    return [[V(mx, y, W.z1), V(mx, y, W.z0)], [dataAt(pr.X, j, 0), dataAt(pr.X, j, pr.per - 1)]] };
  const nearer = (ends, ty) => ends.map(px).sort((a, b) => Math.abs(a[1] - ty) - Math.abs(b[1] - ty))[0];
  const coefMore = (pr, R) => [[gammaAt(pr.Ba, R), pr.cw], [gammaAt(pr.Sc, coefGroup(R, pr.k)[2]), pr.cw]];
  const coefMemo = new Map();
  function coefRms(s, j) {   // a word's 4 streams end to end: their rms (eps: rms_norm_eps, official 258)
    const d = s.coef, k = s.n + ':' + j; if (coefMemo.has(k)) return coefMemo.get(k);
    const pr = coefProduct(s); let q = 0;
    for (let c = 0; c < pr.n; c++) { const v = demo.at(d.x, j, Math.floor(c / pr.per), c % pr.per); q += v * v }
    const r = Math.sqrt(q / pr.n + d.eps); coefMemo.set(k, r); return r;
  }
  function coefTerms(s) {
    const d = s.coef, pr = coefProduct(s), j = d.word, R = d.R, n = pr.n, cs = [...SHOW, n - 1], rms = coefRms(s, j), [g, , si] = coefGroup(R, pr.k);
    if (g === 'comb') throw new Error('segment ' + s.n + ': a comb is not acted out');
    const xOf = c => demo.at(d.x, j, Math.floor(c / pr.per), c % pr.per) / rms;
    let dot = 0; for (let c = 0; c < n; c++) dot += demo.weight(d.w, R, c) * xOf(c);
    const sc = demo.weight(d.scale, si), b = demo.weight(d.base, R), z = dot * sc + b, total = demo.at(d.out, j, R);
    return { pr, n, cs, wv: cs.map(c => demo.weight(d.w, R, c)), xv: cs.map(xOf), total,
      rowNote: k => `(第 ${Math.floor(cs[k] / pr.per) + 1} 路)`, extra: 44,
      wAt: c => fnAt(pr.W, R, c), xAt: c => dataAt(pr.X, j, c), wLine: fnAt(pr.W, R, pr.per / 2), xLine: dataAt(pr.X, j, pr.per / 2),
      oAt: dataAt(pr.O, j, R), more: () => coefMore(pr, R), upright: true, ends: () => coefEnds(pr, j, R),
      sumSay: `这 ${cs.length} 个乘积 + 其余 ${n - cs.length} 个，加起来 = <b>${fmt(dot)}</b><br>base ${fmt(b)} + scale ${fmt(sc)} × ${fmt(dot)} = ${fmt(z)}<br>${coefAct[g][0]}${fmt(z)}${coefAct[g][1]} = <b>${fmt(total)}</b>`,
      fill: v => setCard(d.tag, coefWhole(pr), coefOne(pr, j, R, rms), coefForm(pr, R, v), 'coef:' + s.n) };
  }
  // KDA's forget gate (09-29): number R of word j of g = lb · sigmoid(e^A_log[h] × (f_a · W_f_b's row R + dt_bias[R])), h
  // the head R is in, lb the config's gate_lower_bound (−5) — official 320–327. A dot product of 128 pairs, then its tail
  function fgProduct(s) {
    const d = s.fg, pr = product(s, [d.w, d.x, d.out]);
    return { ...pr, Bi: B[id(s, d.bias)], Ra: B[id(s, d.rate)], per: pr.O.t.cols };
  }
  // (a rod of one number a head, its heads back in depth (A_log); one of a number a channel, its heads one under another (dt_bias))
  const rodAt = (b, i) => b.alt === 'z' ? V((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1 - (i + .5) / b.div[2] * (b.z1 - b.z0)) : V((b.x0 + b.x1) / 2, along(b, i, b.t.cols * (b.t.deck?.n || 1), 'y'), b.z1);
  const fgMore = (pr, R) => [[rodAt(pr.Bi, R), pr.cw], [rodAt(pr.Ra, Math.floor(R / pr.per)), pr.cw]];
  const fgWhole = (pr, lb) => `<i>整块</i>${inputName(pr)} <b>[6, ${pr.n}]</b> × W_f_b <b>[${pr.N}, ${pr.n}]</b> → 衰减门 g <b>[6, ${pr.N}]</b> = <b>${headsOf(pr.O.t)}</b>`
    + `<br>每个数：一次点积，+ dt_bias，× 这个头的 e^A_log，sigmoid，× (${lb})，落在 ${lb} 到 0 之间`;
  const fgOne = (pr, j, R) => `<i>这一个</i>${wordOf(j)} <b>[${pr.n}]</b> 和 W_f_b 第 ${R + 1} 行 <b>[${pr.n}]</b> 一对一对相乘、相加；+ dt_bias 第 ${R + 1} 个，× 第 ${Math.floor(R / pr.per) + 1} 个头的 e^A_log，sigmoid，× (−5) → <b>1</b> 个数`;
  // (left to right as they stand: f_a, W_f_b, dt_bias, A_log)
  const fgForm = (pr, lb, v) => { const ex = `<i class="sw ex" style="background:${pr.cw};width:10px;height:10px"></i>`;
    return `${lb}·sigmoid((dot(<i class="sw col" style="background:${pr.cx}"></i>, <i class="sw row" style="background:${pr.cw}"></i>) + dt_bias${ex}) × e^A_log${ex}) = <b>${v}</b>` };
  function fgTerms(s) {
    const d = s.fg, pr = fgProduct(s), j = d.word, R = d.R, n = pr.n, cs = [...SHOW, n - 1], h = Math.floor(R / pr.per);
    let dot = 0; for (let c = 0; c < n; c++) dot += demo.weight(d.w, R, c) * demo.at(d.x, j, c);
    const b = demo.weight(d.bias, R), e = Math.exp(demo.weight(d.rate, h)), z = e * (dot + b), total = demo.at(d.out, j, R);
    return { pr, n, cs, wv: cs.map(c => demo.weight(d.w, R, c)), xv: cs.map(c => demo.at(d.x, j, c)), total,
      wAt: c => weightAt(pr.W, R, c), xAt: c => dataAt(pr.X, j, c), wLine: weightAt(pr.W, R, n / 2), xLine: dataAt(pr.X, j, n / 2),
      oAt: dataAt(pr.O, j, R), more: () => fgMore(pr, R), extra: 66, upright: true,
      sumSay: `这 ${cs.length} 个乘积 + 其余 ${n - cs.length} 个，加起来 = <b>${fmt(dot)}</b><br>+ dt_bias ${fmt(b)}，× e^A_log ${fmt(e)} = ${fmt(z)}<br>${d.lb} × sigmoid(${fmt(z)}) = <b>${fmt(total)}</b><br><span style="color:#8a8478">用的时候 e^g = ${fmt(Math.exp(total))}：旧记忆留下 ${Math.round(Math.exp(total) * 100)}%</span>`,
      fill: v => setCard(d.tag, fgWhole(pr, d.lb), fgOne(pr, j, R), fgForm(pr, d.lb, v), 'fg:' + s.n) };
  }
  const hideDots = () => { sourceOrigins.clear(); for (const e of layer.children) if (e !== svg) e.style.display = 'none'; for (const e of svg.querySelectorAll('path.dl')) e.style.display = 'none' };
  // (at its middle; left: at its left edge, in the middle up and down)
  const put = (e, [x, y], o = 1, sc = 1, left = false) => { e.style.display = 'block'; e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.opacity = o; e.style.transform = `translate(${left ? 0 : '-50%'}, -50%) scale(${sc})` };
  // A screen-edge port names an offscreen source without duplicating its 3D tensor.
  // Both the line and the extracted values leave this same visible point.
  function incomingPoint() {
    const right = card.style.display === 'block' ? parseFloat(card.style.left) < host.clientWidth / 2 : host.clientWidth < 700;
    const x = right ? host.clientWidth - 82 : 86;
    incomingPort.innerHTML = `L${String(cur.layer - 1).padStart(2, '0')} 输出（画外）<br><b>6 词 × 4 路 × 4096</b>`;
    put(incomingPort, [x, 30]);
    return [x, 50];
  }
  function markTarget(point, color) { targetCell.style.borderColor = deep(color); put(targetCell, point) }
  function dropAlongArrow(element, v, from, to) {
    const q = lo.style.display === 'block' ? lo.getPointAtLength(lo.getTotalLength() * v) : {x:from[0]+(to[0]-from[0])*v,y:from[1]+(to[1]-from[1])*v};
    put(element,[q.x,q.y],1,1-.4*v);
  }
  // Position the caption after the model's labels have been placed this frame.
  function placeTargetName() {
    if (targetCell.style.display !== 'block') return;
    const x = parseFloat(targetCell.style.left), y = parseFloat(targetCell.style.top);
    const obstacles = [card, pill, ...host.querySelectorAll('.l.seg')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect());
    for (const [dx, dy] of [[34,0],[-34,0],[0,22],[0,-22],[34,22],[-34,22],[34,-22],[-34,-22],[54,0],[-54,0],[0,42],[0,-42],[54,42],[-54,42],[54,-42],[-54,-42],...[70,90,110].flatMap(d=>[[d,0],[-d,0],[0,d],[0,-d],[d,d],[-d,d],[d,-d],[-d,-d]])]) {
      put(targetName, [x+dx,y+dy]); const r = targetName.getBoundingClientRect();
      if (r.left >= 2 && r.right <= host.clientWidth-2 && r.top >= 2 && r.bottom <= host.clientHeight-2 && !obstacles.some(q => r.left < q.right+2 && r.right > q.left-2 && r.top < q.bottom+2 && r.bottom > q.top-2)) return;
    }
    targetName.style.display = 'none';
  }
  // a line from a to b, bowed to one side, drawn up to the fraction f of its length
  // (bow 'h': an S that leaves and arrives level — a stack tab's lines, in order, run side by side and never cross;
  // 09-29, the user of the straight ones: "很僵硬的感觉")
  function curve(e, [ax, ay], [bx, by], f = 1, bow = .18, o = 1) {
    if (bow === 'h') { const dx = (bx - ax) * .55; e.setAttribute('d', `M${ax} ${ay} C${ax + dx} ${ay} ${bx - dx} ${by} ${bx} ${by}`) }
    else if (bow === 'v') { const dy = (by - ay) * .55; e.setAttribute('d', `M${ax} ${ay} C${ax} ${ay + dy} ${bx} ${by - dy} ${bx} ${by}`) }   // (leaves and arrives upright: what it goes to above or below the tab — 09-29, the 24 coefficients)
    else { const mx = (ax + bx) / 2 - (by - ay) * bow, my = (ay + by) / 2 + (bx - ax) * bow; e.setAttribute('d', `M${ax} ${ay} Q${mx} ${my} ${bx} ${by}`) }
    e.style.display = 'block'; e.style.opacity = o;
    if (f >= 1) { e.style.strokeDasharray = ''; e.style.strokeDashoffset = 0; return }   // (drawn whole: no length to measure)
    const L = e.getTotalLength(); e.style.strokeDasharray = `${L} ${L}`; e.style.strokeDashoffset = L * (1 - clamp(f));
  }

  // the card: CW wide; as tall as its words (measured), and the pairs under them while they are there
  let CW = 360;
  const DY = 22, PAIRS = (SHOW.length + 2) * DY + 28, GAP = 56, EDGE = 12;
  // where the card stands: one of a few spots around what it is about (the result's cell for the dot acted out, the
  // result block for the rest) or a corner of the picture, the one that covers no name (or least of them) and none of
  // the numbers it points at, the nearest of those. Chosen once
  // for each beat at the beat's camera pose, so it stands still while the number it follows moves; a spot is a place
  // relative to what it is about, so the card goes with the camera.
  const SPOTS = ['r', 'l', 'ru', 'lu', 'rd', 'ld', 'u', 'd', 'TL', 'TR', 'BL', 'BR'];
  function spotAt(spot, [x0, y0, x1, y1], h) {   // (the anchor: a box on the screen; a point is a box of no size)
    const cy = (y0 + y1) / 2, cx = (x0 + x1) / 2, W = host.clientWidth, H = host.clientHeight;
    const within = (x, y) => { const X = Math.max(EDGE, Math.min(W - EDGE - CW, x)), Y = Math.max(EDGE, Math.min(H - EDGE - h, y)); return { x: X, y: Y, moved: Math.hypot(X - x, Y - y) } };
    if (typeof spot === 'object') return within(cx + spot.dx, cy + spot.dy);   // (a place found on the grid: kept from the anchor's middle)
    if (spot.length === 2 && spot === spot.toUpperCase()) return { x: spot[1] === 'L' ? EDGE : W - EDGE - CW, y: spot[0] === 'T' ? EDGE : H - EDGE - h, moved: 0 };
    const [x, y] = { r: [x1 + GAP, cy - h * .35], l: [x0 - GAP - CW, cy - h * .35], ru: [x1 + GAP, y0 - GAP - h], lu: [x0 - GAP - CW, y0 - GAP - h],
      rd: [x1 + GAP, y1 + GAP], ld: [x0 - GAP - CW, y1 + GAP], u: [cx - CW / 2, y0 - GAP - h], d: [cx - CW / 2, y1 + GAP] }[spot];
    return within(x, y);
  }
  const screenBox = b => { const ps = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].flatMap(([x, y]) => [px(V(x, y, b.z0)), px(V(x, y, b.z1))]);
    return [Math.min(...ps.map(p => p[0])), Math.min(...ps.map(p => p[1])), Math.max(...ps.map(p => p[0])), Math.max(...ps.map(p => p[1]))] };
  // does the segment a → b pass through the box [x0, y0, x1, y1] (a few points along it)?
  const crosses = ([ax, ay], [bx, by], [x0, y0, x1, y1]) => { for (let k = 1; k < 20; k++) { const f = k / 20, px = ax + (bx - ax) * f, py = ay + (by - ay) * f; if (px > x0 && px < x1 && py > y0 && py < y1) return true } return false };
  const faceBox = b => { const ps = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map(([x, y]) => px(V(x, y, b.z1)));   // (its front face only)
    return [Math.min(...ps.map(p => p[0])), Math.min(...ps.map(p => p[1])), Math.max(...ps.map(p => p[0])), Math.max(...ps.map(p => p[1]))] };
  const overArea = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const SPOT = new Map();
  // (bi: several beats — a card carried while the camera moves from pose to pose (09-29, a write-back: its sources far above
  // its result; the user: "镜头带着卡片飞下去"): a corner of the picture, the one best at all their poses)
  // (clear: for a tab whose lines leave it upright, the points they go to: the card is wholly above them or wholly below,
  // so no line runs through it or bends back round it — 10-02, the user of segment 13: "线有点乱")
  function chooseSpot(s, bi, anchor, h, points, blocks = () => [], clear = null, cardHeight = h) {
    // The previous column's off-screen input has a misleading projected box.
    // On a narrow entrance view keep the card in the space reserved on the left.
    const autoCard=s.poses[s.beats[[bi].flat()[0]].cam].autoCard;
    const coversInput=s.lessonData&&points().filter(inPic).some(([x,y])=>x>EDGE&&x<EDGE+CW&&y>EDGE&&y<EDGE+cardHeight);
    if (!autoCard && !coversInput && (s.incoming?.length || s.expert || s.focusLabels) && host.clientWidth < 700) return 'TL';
    const bis = [bi].flat(), key = `${s.n}:${bis.join('+')}:${host.clientWidth}x${host.clientHeight}`; if (SPOT.has(key)) return SPOT.get(key);
    const keep = snap(), at = [];
    for (const b of bis) {
      const P = POSE.get(s.n + ':' + s.beats[b].cam);
      camera.position.copy(P.p); controls.target.copy(P.t); camera.lookAt(P.t); camera.updateMatrixWorld(); place(); marks();   // (the names as at the pose: the words too narrow there hidden — 09-28: read as the camera stood, the spot hung on the moment before)
      const hr = host.getBoundingClientRect(), names = [...host.querySelectorAll('.l.seg')].filter(e => getComputedStyle(e).display !== 'none')
        .map(e => { const r = e.getBoundingClientRect(); return [r.left - hr.left - 6, r.top - hr.top - 6, r.right - hr.left + 6, r.bottom - hr.top + 6] });
      at.push({ names, a: anchor(), pts: points(), bls: blocks(), cl: clear ? clear().filter(inPic) : [] });
    }
    const across = (cl, y) => cl.filter(p => p[1] > y - 24 && p[1] < y + h + 24).length + (cl.some(p => p[1] <= y - 24) && cl.some(p => p[1] >= y + h + 24) ? 1 : 0);
    const scoreAt = ({ names, a, pts, bls, cl }, x, y, moved) => { const box = [x - 10, y - 10, x + CW + 10, y + h + 10];
      const pins=s.lessonData?[x,y,x+CW,y+cardHeight]:box;
      return names.reduce((v, n) => v + overArea(box, n), 0) * 50 + bls.reduce((v, n) => v + overArea(box, n), 0) * 10 + pts.filter(([u, v]) => u > pins[0] && u < pins[2] && v > pins[1] && v < pins[3]).length * 1e7
        + moved * 5 + Math.hypot(x + CW / 2 - (a[0] + a[2]) / 2, y + h / 2 - (a[1] + a[3]) / 2) + across(cl, y) * 4e3 };
    const a = at[0].a;
    let best = null;
    for (const sp of bis.length > 1 ? ['TL', 'TR', 'BL', 'BR'] : SPOTS) {
      const score = at.reduce((v, e) => { const { x, y, moved } = spotAt(sp, e.a, h); return v + scoreAt(e, x, y, moved) }, 0);
      if (!best || score < best.score) best = { sp, score };
    }
    // (none of them clear of the names, the card being tall on a small picture: anywhere in the picture, every 16 px)
    if (best.score >= 3e3 && bis.length === 1) {
      const W = host.clientWidth, H = host.clientHeight, cx = (a[0] + a[2]) / 2, cy = (a[1] + a[3]) / 2;
      for (let x = EDGE; x <= W - EDGE - CW; x += 16) for (let y = EDGE; y <= H - EDGE - h; y += 16) { const score = scoreAt(at[0], x, y, 0); if (score < best.score) best = { sp: { dx: x - cx, dy: y - cy }, score } }
    }
    camera.position.copy(keep.p); controls.target.copy(keep.t); camera.lookAt(keep.t); camera.updateMatrixWorld();
    SPOT.set(key, best.sp); return best.sp;
  }
  // the words on the card for number R of word j of a product; returns how tall they are
  // (the shapes are the official ones: a result [6, N] is also said by its heads when the model cuts it so, and an input
  // cut into heads is said as the one row a word's heads make)
  const wordOf = j => /^[\p{L}\p{N}]/u.test(words[j]) ? words[j] : `「${words[j]}」`;   // (a word that is a mark, in quotes)
  const headsOf = t => t.deck?.kind === 'head' && (!t.headsDown || t.headsCut) ? `[6, ${t.deck.n} 头, ${t.cols}]` : null;   // (headsDown: still flat in the code)
  let geo = null;   // the card and its tab as last measured: {key, h, pw, ph, row, col, val} (offsets from the tab's top left)
  // the card's words (name, the whole, this one) and the tab's formula (its swatches: .row the weight's, .col the input's;
  // either may be left out); returns how tall the card is
  function setCard(name, allH, oneH, formH, key) {
    tag.textContent = name; whole.innerHTML = allH; one.innerHTML = oneH; one.style.display = oneH ? '' : 'none'; formula.innerHTML = formH;
    formula.style.fontSize = CW < 360 ? '12px' : '';
    card.style.display = 'block'; card.style.width = CW + 'px'; card.style.height = 'auto'; pill.style.display = 'block';
    // A result replacing "?" can widen the formula and shift right-aligned swatches.
    // Token/channel labels can also wrap onto another line while tracing a result.
    const c = pill.getBoundingClientRect(), h = card.offsetHeight;
    if (geo?.key !== key || geo.pw !== c.width || geo.ph !== c.height || geo.h !== h) {
      const at = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [(r.left + r.right) / 2 - c.left, (r.top + r.bottom) / 2 - c.top, r.width / 2, r.height / 2] };
      geo = { key, h, pw: c.width, ph: c.height, row: at(formula.querySelector('.row')), col: at(formula.querySelector('.col')), val: at(formula.querySelector('b')),
        ex: [...formula.querySelectorAll('.sw.ex')].map(at) };
    }
    return geo.h;
  }
  function fillCard(pr, name, j, R, value, key) {
    const { n, N, w } = pr, X = pr.X.t, O = pr.O.t;
    return setCard(name,
      `<i>整块</i>${X.name} <b>[6, ${n}]</b>${headsOf(X) ? `（${headsOf(X)} 每个词连成一行）` : ''} × ${w}ᵀ <b>[${n}, ${N}]</b> → ${O.name} <b>[6, ${N}]</b>${headsOf(O) ? ` = <b>${headsOf(O)}</b>` : ''}`
        + `<br>每个词 × ${w} 的每一行 = 1 个数，共 6 × ${N} 个`,
      `<i>这一个</i>${wordOf(j)} <b>[${n}]</b> 和 ${w} 第 ${R + 1} 行 <b>[${n}]</b> 一对一对相乘、再加起来 → <b>1</b> 个数`,
      `dot(<i class="sw row" style="background:${pr.cw}"></i>, <i class="sw col" style="background:${pr.cx}"></i>) = <b>${value}</b>`, key);
  }
  const TAB = 10;   // (between the card and its tab)
  // the card at (x, y), h tall, and its tab on the side toward `toward` (the middle of what the formula reads and writes),
  // along that side as near it as the side allows — unless it would lie on a block (avoid: their faces on the screen)
  // and another side keeps it off them (09-28: beside a card left of the blocks it lay on the result); returns the tab's
  // box [x0, y0, x1, y1]
  function placeCard(x, y, h, o, toward, avoid = [], upright = false, pins = [], names = []) {
    put(card, [x, y], o); card.style.transform = 'none'; card.style.height = h + 'px';
    const { pw, ph } = geo, [tx, ty] = toward, dx = (tx - (x + CW / 2)) / (CW / 2), dy = (ty - (y + h / 2)) / (h / 2);
    const along = (a, lo, hi) => Math.max(lo, Math.min(hi, a)), W = host.clientWidth, H = host.clientHeight;
    const vert = s => [along(tx - pw / 2, x, x + CW - pw), s > 0 ? y + h + TAB : y - TAB - ph], side = s => [s > 0 ? x + CW + TAB : x - TAB - pw, along(ty - ph / 2, y, y + h - ph)];
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const ways = upright ? [vert(sy), vert(-sy), side(sx), side(-sx)] : Math.abs(dy) > Math.abs(dx) ? [vert(sy), side(sx), vert(-sy), side(-sx)] : [side(sx), vert(sy), vert(-sy), side(-sx)];
    let best = null;
    for (const [px0, py0] of ways) {
      const X0 = along(px0, 4, W - 4 - pw), Y0 = along(py0, 4, H - 4 - ph), box = [X0, Y0, X0 + pw, Y0 + ph];
      const on = (cur.focusLabels ? pins.filter(inPic).filter(([a,b])=>a>box[0]-8&&a<box[2]+8&&b>box[1]-8&&b<box[3]+8).length * 1e7 : 0)
        + names.reduce((v,b)=>v+overArea(box,b),0)*1e5
        + avoid.reduce((v, b) => v + overArea(box, b), 0) + overArea(box, [x, y, x + CW, y + h]) * (cur.focusLabels ? 1e6 : 100)   // keep the formula outside its card first
        + (crosses([(box[0] + box[2]) / 2, (box[1] + box[3]) / 2], toward, [x + 8, y + 8, x + CW - 8, y + h - 8]) ? 3e4 : 0);   // (09-29: its lines would run across its own card)
      if (!best || on < best.on) best = { box, on }; if (!on) break;
    }
    put(pill, [best.box[0], best.box[1]], o); pill.style.transform = 'none';
    return best.box;
  }
  // a stack tab (a row a block, 09-29 KDA) stands clear left of the blocks its rows go to, at the height of their middle,
  // so its straight lines fan out to them in order (the user: "线有点乱" — on the column, the lines ran through the tab)
  function tabLeftOf(blocks, pts, o) {
    const x1 = Math.min(...blocks.map(b => screenBox(b)[0])) - 28, ys = pts.map(p => p[1]).sort((a, b) => a - b), H = host.clientHeight;
    const X0 = Math.max(4, x1 - geo.pw), Y0 = Math.max(4, Math.min(H - 4 - geo.ph, (ys[0] + ys.at(-1)) / 2 - geo.ph / 2));
    put(pill, [X0, Y0], o); pill.style.transform = 'none';
    return [X0, Y0, X0 + geo.pw, Y0 + geo.ph];
  }
  // the lines from the tab's swatches to what they stand for (wAt: the weight's, xAt: the input's; on the screen, or null:
  // no line); the arrow from the tab's edge nearest the cell into the cell (returns where the arrow starts; ox null: none)
  // (more: [[point, colour], …] for the formula's other swatches (.sw.ex), in their order — 09-29, KDA: the user saw q, k,
  // v and g lit and moving with one line to them; every block a number uses has its swatch and its line)
  // (v: every line of the tab an upright S from its swatch's top or bottom edge, side by side in the formula's order — what
  // they go to stands above or below the tab, in that order left to right; 09-29, the user of the plain bows: "线都不是太好看")
  function lines(pr, wAt, xAt, [ox, oy], [x0, y0, x1, y1], drawn, fade, arrow, arrowOn, more = [], v = false) {
    // A layer entrance reads the preceding column's residual block; the input
    // enters from the top, as the narrative and the moving number pairs explain.
    if (cur.incoming?.includes(pr.x) && xAt && !inPic(xAt)) xAt = incomingPoint();
    if (cur.focusLabels) {
      let next=0;
      const port=(p,name,color,line)=>{
        if (!p || inPic(p)) return p;
        const e=sourcePorts[next], y=20+next++*24, left=parseFloat(card.style.left)>host.clientWidth/2, x=left?78:host.clientWidth-78;
        e.textContent=name+' · 上方';e.style.borderColor=deep(color);put(e,[x,y]);
        const point=[left?x-65:x+65,y+9];sourceOrigins.set(line,point);return point;
      };
      if(geo.row)wAt=port(wAt,pr.Y?'旧四路 / 系数':pr.W.t.name,pr.cw,lw);
      if(geo.col)xAt=port(xAt,pr.Y?pr.Y.t.name:pr.X.t.name,pr.cx,lx);
      more=more.map(([p,c,name],i)=>[geo.ex?.[i]?port(p,name||formula.querySelectorAll('.stk>div')[i]?.textContent.trim()||pr.Q?.t.name||'前面输入',c,lxs[i]):p,c]);
    }
    // A formula may sit above its card while one source is below it. Route around
    // the card's outside edge instead of drawing through the numbers.
    const link = (e, a, b, f, bow, opacity) => {
      if (cur.focusLabels) {
        // Leave a swatch through the formula's edge before routing around either
        // text box. A stack exits right, so no line runs back across its labels.
        const gap=6, stack=!!formula.querySelector('.stk'), output=e===lo;
        let exit=a;
        if(!output)exit=stack?[x1+gap,a[1]]:[a[0],b[1]<(y0+y1)/2?y0-gap:y1+gap];
        else if(a[0]===x0)exit=[x0-gap,a[1]];
        else if(a[0]===x1)exit=[x1+gap,a[1]];
        else exit=[a[0],a[1]===y0?y0-gap:y1+gap];
        const cx=parseFloat(card.style.left),cy=parseFloat(card.style.top),ch=parseFloat(card.style.height);
        const boxes=[[cx-2,cy-2,cx+CW+2,cy+ch+2],[x0-2,y0-2,x1+2,y1+2]];
        curve(e,exit,b,1,bow,opacity);
        const n=e.getTotalLength();let hit=false;
        for(let i=1;i<48;i++){const p=e.getPointAtLength(n*i/48);if(boxes.some(([l,t,r,d])=>p.x>l&&p.x<r&&p.y>t&&p.y<d)){hit=true;break}}
        let route=e.getAttribute('d');
        if(hit){
          const ways=[[exit,[exit[0],b[1]],b],[exit,[b[0],exit[1]],b]];
          for(const [l,t,r,d] of boxes){
            for(const x of [l-gap,r+gap])ways.push([exit,[x,exit[1]],[x,b[1]],b]);
            for(const y of [t-gap,d+gap])ways.push([exit,[exit[0],y],[b[0],y],b]);
          }
          const valid=ways.filter(ps=>ps.every(inPic)&&ps.slice(1).every((p,i)=>boxes.every(box=>!crosses(ps[i],p,box))));
          const length=ps=>ps.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-ps[i][0],p[1]-ps[i][1]),0);
          valid.sort((a,b)=>length(a)-length(b));
          if(valid.length)route=valid[0].map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ');
        }
        e.setAttribute('d',`M${a[0]} ${a[1]} L${exit[0]} ${exit[1]} `+route.replace(/^M[^CLQ]+/,''));
        if(f<1){const n=e.getTotalLength();e.style.strokeDasharray=`${n} ${n}`;e.style.strokeDashoffset=n*(1-clamp(f))}
        return;
      }
      curve(e, a, b, f, bow, opacity);
      const pin = (cur.incoming || cur.expert) && sourcePins.get(e);
      if (pin && f > .99) { pin.style.borderColor = e.style.stroke; put(pin, b, opacity) }
      if (card.style.display !== 'block') return;
      const x = parseFloat(card.style.left), y = parseFloat(card.style.top), h = parseFloat(card.style.height);
      const length = e.getTotalLength();
      let hit = false;
      for (let i = 1; i < 48; i++) { const p = e.getPointAtLength(length * i / 48); if (p.x > x - 3 && p.x < x + CW + 3 && p.y > y - 3 && p.y < y + h + 3) { hit = true; break } }
      if (!hit) return;
      const margin = 10 + (e === lw ? 0 : e === lx ? 1 : e === lo ? 2 : 3) * 6;
      const sides = [x - margin, x + CW + margin].filter(q => q >= 2 && q <= host.clientWidth - 2);
      const side = sides.sort((c,d) => Math.abs(a[0]-c)+Math.abs(b[0]-c)-Math.abs(a[0]-d)-Math.abs(b[0]-d))[0];
      if (side == null) return;
      const escapeY = p => p[0] > x && p[0] < x + CW ? (p[1] < y ? Math.min(p[1], y - 10) : Math.max(p[1], y + h + 10)) : p[1];
      const ay = escapeY(a), by = escapeY(b);
      e.setAttribute('d', `M${a[0]} ${a[1]} L${a[0]} ${ay} L${side} ${ay} L${side} ${by} L${b[0]} ${by} L${b[0]} ${b[1]}`);
      if (f < 1) { const n = e.getTotalLength(); e.style.strokeDasharray = `${n} ${n}`; e.style.strokeDashoffset = n * (1 - clamp(f)) }
    };
    lw.style.stroke = deep(pr.cw); lx.style.stroke = deep(pr.cx);
    const up = (sw, p) => [x0 + sw[0], y0 + sw[1] + (p[1] < y0 + sw[1] ? -sw[3] : sw[3])];   // measured swatch edge
    if (v) {
      more.forEach(([p, c], i) => { const e = lxs[i], sw = geo.ex?.[i]; if (!e || !sw || !p || !inPic(p)) return; e.style.stroke = deep(c); link(e, up(sw, p), p, drawn, 'v', fade) });
      if (geo.row && wAt && inPic(wAt)) link(lw, up(geo.row, wAt), wAt, drawn, 'v', fade);
      if (geo.col && xAt && inPic(xAt)) link(lx, up(geo.col, xAt), xAt, drawn, 'v', fade);
    } else
    more.forEach(([p, c], i) => { const e = lxs[i], sw = geo.ex?.[i]; if (!e || !sw || !p || !inPic(p)) return; e.style.stroke = deep(c); const a = [x0 + sw[0] + sw[2], y0 + sw[1]]; link(e, p[0] > a[0] + 40 ? a : [a[0] - sw[2], a[1]], p, drawn, p[0] > a[0] + 40 ? 'h' : i % 2 ? .12 : -.12, fade) });   // (a stack's rows in the order of what they go to: level S-curves side by side; a swatch in a formula, its line to something left or above: a plain bow — 09-29, an S from it looped back across the formula)
    // (a line to something out of the picture is left out: it would only run off the edge, often across the card — 09-29,
    // a write's sources far above its result)
    if (!v && geo.row && wAt && inPic(wAt)) link(lw, [x0 + geo.row[0], y0 + geo.row[1]], wAt, drawn, .22, fade);
    if (!v && geo.col && xAt && inPic(xAt)) link(lx, [x0 + geo.col[0], y0 + geo.col[1]], xAt, drawn, -.22, fade);
    if (ox == null) return null;
    const ex = Math.max(x0, Math.min(x1, ox)), ey = Math.max(y0, Math.min(y1, oy));
    if (!inPic([ox, oy])) return [ex, ey];
    if (arrow > 0 && arrowOn > 0) markTarget([ox, oy], pr.co);
    link(lo, [ex, ey], [ox, oy], arrow, 0, arrowOn);
    return [ex, ey];
  }
  // where the formula looks: the middle of the weight's row, the input's column and the cell
  // (only what is in the picture counts: a write's sources stand far above its result — 09-29, the tab went the wrong way
  // and its lines ran across the card)
  const inPic = ([a, b]) => a >= 0 && a <= host.clientWidth && b >= 0 && b <= host.clientHeight;
  // where a number out of the picture comes into it from: the top edge, above the card's column (10-02: the camera goes
  // only down the spine, what a step reads from above is not flown to; a point far outside the view projects anywhere)
  const fromAbove = (p, x) => inPic(p) ? p : [x, -30];
  const sourcePoint = (p, line, x) => inPic(p) ? p : sourceOrigins.get(line) || fromAbove(p, x);
  const towardOf = (all) => { const pts = all.filter(inPic).length ? all.filter(inPic) : all; return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] };

  // the sizes along the edges of the input and the result while the dot is acted out (09-27, the user: "不除 6 那为什么不
  // 等于 [8192, 6]……这个文字配上这个动画我都没看懂": the picture draws a word as a column, so the result looks like
  // [8192, 6]; the edges say which way the 6 words go and which way a word's numbers go): a thin line with ticks along the
  // edge, just outside the block, and what it counts. One that would lie on a name or on the card is left out.
  const DIMS = Array.from({ length: 6 }, () => ({ p: path('dl dim'), t: el('dot-dim') }));
  // (where each goes — left out, or which side and how far along — is found by reading the page once for a picture: the
  // camera where it stands, the card as tall; then the frames only draw)
  let dimsFor = null, dimsSpots = [];
  function dims(pr, o, result = true) {
    const cp = camera.position, d0 = cp.distanceTo(controls.target) * .004, q = v => Math.round(v / d0);
    const key = [pr.out, q(cp.x), q(cp.y), q(cp.z), Math.round(parseFloat(card.style.top) / 8), Math.round(parseFloat(card.style.height) / 24), host.clientWidth, host.clientHeight].join();
    const find = key !== dimsFor; if (find) { dimsFor = key; dimsSpots = [] }
    const T = words.length, cx = ([a, b, c, d]) => [(a + c) / 2, (b + d) / 2];
    const stacked = b => b.div[2] > 1 && b.t.cols > 1;
    const axes = [];
    for (const b of result ? [pr.X, pr.O] : [pr.X]) {   // a word's numbers: the word axis, its numbers (a head's), the heads
      const per = b.t.cols, H = b.t.deck?.n || 1, m = stacked(b) ? per : b.alt === 'y' ? per * H : per > 1 ? per : H;
      axes.push([b, dataAt(b, 0, 0), dataAt(b, T - 1, 0), T, `${T} 个词`]);
      const unit = b.t.deck?.kind === 'stream' ? '路' : '头';   // (the slices: a stack of streams, or of heads)
      axes.push([b, dataAt(b, 0, 0), dataAt(b, 0, m - 1), m, stacked(b) ? `每${unit} ${per} 个数` : `每个词 ${b === pr.X ? pr.n : pr.N} 个数`]);
      // (a head's numbers seen edge on, too short to mark: said with the heads)
      if (stacked(b)) { const [a0, a1] = [px(dataAt(b, 0, 0)), px(dataAt(b, 0, per - 1))], short = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) < 24;
        axes.push([b, dataAt(b, 0, 0), dataAt(b, 0, (H - 1) * per), H, short ? `${H} ${unit} × 每${unit} ${per} 个数` : `${H} ${unit}`]) }
    }
    const hr = find ? host.getBoundingClientRect() : null, taken = !find ? [] : [card, pill, ...host.querySelectorAll('.l.seg')].filter(e => e.style.display !== 'none' && getComputedStyle(e).display !== 'none')
      .map(e => { const r = e.getBoundingClientRect(); return [r.left - hr.left, r.top - hr.top, r.right - hr.left, r.bottom - hr.top] });
    const hits = (r, pad = 2) => taken.some(q => overArea([r[0] - pad, r[1] - pad, r[2] + pad, r[3] + pad], q) > 0);
    axes.forEach(([b, a, c, k, text], i) => {
      const d = DIMS[i], [ax, ay] = px(a), [bx, by] = px(c), L = Math.hypot(bx - ax, by - ay);
      if (L < 24 || k < 2) return;
      const ux = (bx - ax) / L, uy = (by - ay) / L, half = L / (k - 1) / 2;   // (from the first cell's edge to the last's)
      const [mx, my] = cx(screenBox(b)); let nx = -uy, ny = ux;
      if (nx * ((ax + bx) / 2 - mx) + ny * ((ay + by) / 2 - my) < 0) { nx = -nx; ny = -ny }   // (outside the block)
      const off = 9, p0 = [ax - ux * half + nx * off, ay - uy * half + ny * off], p1 = [bx + ux * half + nx * off, by + uy * half + ny * off];
      d.p.setAttribute('d', `M${p0[0] - nx * 4} ${p0[1] - ny * 4} L${p0[0] + nx * 4} ${p0[1] + ny * 4} M${p0[0]} ${p0[1]} L${p1[0]} ${p1[1]} M${p1[0] - nx * 4} ${p1[1] - ny * 4} L${p1[0] + nx * 4} ${p1[1] + ny * 4}`);
      d.p.style.display = 'block'; d.p.style.opacity = o; d.p.style.strokeDasharray = ''; d.p.style.strokeDashoffset = 0;
      d.t.textContent = text;
      const at = ([f, sd]) => {   // the text at f along the line, on its side sd (1: outside the block)
        const mx = nx * sd, my = ny * sd, back = sd < 0 ? 9 * 2 : 0;   // (the other side: past the line and the block's edge)
        put(d.t, [p0[0] + (p1[0] - p0[0]) * f + mx * (12 + back), p0[1] + (p1[1] - p0[1]) * f + my * (12 + back)], o);
        d.t.style.transform = `translate(${mx < -.5 ? '-100%' : mx > .5 ? '0' : '-50%'}, ${my < -.5 ? '-100%' : my > .5 ? '0' : '-50%'})`;
      };
      if (!find) { const sp = dimsSpots[i]; if (!sp) { d.p.style.display = 'none'; d.t.style.display = 'none' } else if (sp === 'noline') d.p.style.display = 'none'; else at(sp); return }
      const line = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])];
      if ((Math.abs(ux) > .9 || Math.abs(uy) > .9) && hits(line, 0)) { d.p.style.display = 'none'; dimsSpots[i] = 'noline'; return }
      // the text beside the line: at its middle, else a little along it, where it lies on nothing
      // (the text's middle on the line's side, its box kept off the line)
      let box = null;
      for (const sp of [.5, .35, .65, .2, .8].flatMap(f => [[f, 1], [f, -1]])) {   // (outside the block first, then the other side)
        at(sp);
        const r = d.t.getBoundingClientRect(), q = [r.left - hr.left, r.top - hr.top, r.right - hr.left, r.bottom - hr.top];
        if (!hits(q)) { box = q; dimsSpots[i] = sp; break }
      }
      if (!box) { d.p.style.display = 'none'; d.t.style.display = 'none' } else taken.push(box);
    });
  }

  const ALL = [['pick', .14], ['pull', .3], ['mul', .2], ['sum', .2], ['place', .16]];
  function allPhase(u) { let a = 0; for (const [ph, d] of ALL) { if (u < a + d || ph === 'place') return [ph, clamp((u - a) / d)]; a += d } }
  function dotScene(s, bi, P, phase, u) {
    camera.updateMatrixWorld();   // (the camera may have just moved: project with where it is now, not where it was drawn last)
    hideDots(); const pr = P.pr, oAt = P.oAt, [ox, oy] = px(oAt), gap = P.n > P.cs.length ? 1 : 0;   // (gap: a row for "⋮ 其余")
    const aAt = phase === 'place' || !P.aAt ? oAt : P.aAt;   // (the card stands by: the result, or where the pairs come from)
    const HEAD = P.fill(phase === 'sum' && u > .7 || phase === 'place' ? fmt(P.total) : '?'), FULL = HEAD + (P.cs.length + gap) * DY + 28 + (P.extra || 0), ROW0 = HEAD + 6;
    // (carried: one corner through every beat of it, as the camera goes from where the pairs come from to the result)
    const seq = P.carry ? s.beats.map((b, i) => b.op[P.carry] ? i : -1).filter(i => i >= 0) : bi;
    const later2 = ['fetch', 'mul', 'sum', 'place'].includes(phase), xLine = later2 && P.xLate ? P.xLate : P.xLine;
    const sp = chooseSpot(s, seq, () => { const [a, b] = px(aAt); return [a, b, a, b] }, FULL + geo.ph + TAB,   // (room for the tab too)
      () => [px(oAt), px(P.wLine), px(P.xLine), ...P.cs.slice(0, 2).map(c => px(P.wAt(c)))],
      () => [pr.W, pr.X, pr.O].map(screenBox), P.upright ? () => [px(oAt), px(P.wLine), px(xLine), ...(P.more ? P.more().map(([p]) => px(p)) : [])] : null);
    const [ax, ay] = px(aAt), { x, y } = spotAt(sp, [ax, ay, ax, ay], FULL);
    // the card: the formula alone, grown to hold the pairs while they come, back when they have gone into the formula
    const grown = phase === 'pick' ? 0 : phase === 'pull' ? ease(u * 2) : phase === 'place' ? 1 - ease(u * 2) : 1, h = HEAD + (FULL - HEAD) * grown;   // (carry, fetch: whole)
    const first = phase === 'pick' ? ease(u * 2) : 1, placed = phase === 'place' ? ease(u) : 0;
    const more = P.more ? P.more().map(([p, c]) => [px(p), c]) : [];
    let tab = placeCard(x, y, h, first, towardOf([px(aAt), px(P.wLine), px(xLine)]), [pr.W, pr.X, pr.O].map(faceBox), P.upright, [px(oAt),px(P.wLine),px(xLine),...more.map(([p])=>p)]);
    if (P.stackOf && !s.focusLabels && host.clientWidth >= 700) tab = tabLeftOf(P.stackOf, more.map(m => m[0]), first);
    later = P.dimensions === false ? null : () => dims(pr, first, false);   // (after the frame: the names where they are now)
    const drawn = phase === 'pick' ? ease(u * 1.6 - .3) : 1;
    const ty = (tab[1] + tab[3]) / 2, [wE, xE] = P.ends ? P.ends() : [];
    const [ex, ey] = lines(pr, wE ? nearer(wE, ty) : px(P.wLine), xE ? nearer(xE, ty) : px(xLine), [ox, oy], tab, drawn, 1 - placed * .7, phase === 'place' ? 1 : drawn, phase === 'place' ? 1 : .45, more, P.upright);   // (the column: low in it, in the picture)
    if (phase === 'place') {   // the value goes down the arrow into its cell
      const v = ease(u * 1.2); if (v < 1) dropAlongArrow(P.drop,v,[ex,ey],[ox,oy]);
    }
    if (phase === 'pick' || phase === 'place') return;
    const fAt = [tab[0] + geo.val[0], tab[1] + geo.val[1]], rowY = k => y + ROW0 + (gap && k >= SHOW.length ? k + 1 : k) * DY, colX = x + 24;
    if (gap) put(P.note, [colX + 52, y + ROW0 + SHOW.length * DY], phase === 'pull' ? ease(u * 2 - 1) : phase === 'mul' ? 1 : 1 - ease(u * 2), 1, true);
    P.rows.forEach((r, k) => {
      const at = rowY(k), stag = k / P.rows.length * .45;
      const out = phase === 'sum' ? ease((u - stag * .5) / .5) : 0;   // into the formula
      if (out >= 1) return;
      const v = phase === 'pull' ? ease((u - stag) / .55) : 1; if (v <= 0) return;
      // (a late number — a write's output, below — comes out of its place only after the carrying)
      const late = P.late?.(k), vx = !late ? v : later2 ? (phase === 'fetch' ? ease((u - .1) / .6) : 1) : 0;
      const [wx, wy] = sourcePoint(px(P.wAt(r.c)), P.stackOf ? lxs[P.more().length-1] : lw, colX), xp = px(P.xAt(r.c));
      const [xx, xy] = cur.incoming?.includes(pr.x) && !inPic(xp) ? incomingPoint() : sourcePoint(xp, P.stackOf ? lxs[0] : pr.Y && k > 0 ? lw : lx, colX + 34);
      const tw = [wx + (colX - wx) * v, wy + (at - wy) * v], tx = [xx + (colX + 34 - xx) * vx, xy + (at - xy) * vx];
      const toF = p => [p[0] + (fAt[0] - p[0]) * out, p[1] + (fAt[1] - p[1]) * out];
      put(r.w, toF(tw), (1 - out) * Math.min(1, v * 3), .5 + .5 * v); if (vx > 0) put(r.x, toF(tx), (1 - out) * Math.min(1, vx * 3), .5 + .5 * vx);
      if (Math.min(v, vx) > .9) put(r.times, [colX + 17, at], (1 - out) * (Math.min(v, vx) - .9) / .1);
      // beside each pair: its two numbers, then (multiplying) its product
      const m = phase === 'mul' ? ease((u - stag) / .55) : ['sum', 'place'].includes(phase) ? 1 : 0;
      const compact = CW < 360 && P.rowNote;
      r.txt.style.lineHeight = compact ? '11px' : '';
      const note = P.rowNote ? ` <span style="color:#8a8478;${compact ? 'display:block;font-size:9px' : ''}">${P.rowNote(k)}</span>` : '';
      if (v >= 1 && vx >= 1) { r.txt.innerHTML = P.rowText ? P.rowText(k, phase, m, P.pv[k]) : `${fmt(P.wv[k], 4)} × ${fmt(P.xv[k], 3)}${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(P.pv[k], 4)}</b></span>` : ''}${note}`; put(r.txt, [colX + 52, at], 1 - out, 1, true) }
      else if (v >= 1 && late) { r.txt.innerHTML = `${fmt(P.wv[k], 4)} × <span style="color:#8a8478">？${P.lateSay || ''}</span>`; put(r.txt, [colX + 52, at], 1, 1, true) }
    });
    if (phase === 'sum') { const v = ease((u - .55) / .4); if (v > 0) { P.sumLine.innerHTML = P.sumSay ? P.sumSay : P.post ? `这 ${P.cs.length} 个乘积加起来 = <b>${fmt(P.post.sum)}</b>，再过 ${P.post.name} = <b>${fmt(P.total)}</b>`
        : `这 ${P.cs.length} 个乘积${gap ? ` + 其余 ${P.n - P.cs.length} 个` : ''}，加起来 = <b>${fmt(P.total)}</b>`; put(P.sumLine, [x + 14, rowY(P.cs.length)], v, 1, true) } }
  }
  // ---- a RMSNorm acted out (09-28, after the dot: every step shows how one number comes; RMSNorm first): one word's
  // numbers squared, averaged, the root taken — the word's rms, one number —; then each number divided by it and
  // multiplied by γ's number at the same place. The card, its tab, the lines and the arrow as for the dot; the formula
  // `rms(column) = ?`, then `number ÷ rms × γ = ?`. The numbers are demo/'s (made by the official formula, eps included).
  const normProduct = (s, [g, x, out]) => { const G = B[id(s, g)], X = B[id(s, x)], O = B[id(s, out)];
    return { w: g, x, out, W: G, X, O, cw: onCard(look.palette[G.comp][1]), cx: onCard(look.palette[X.comp][0]), co: onCard(look.palette[O.comp][0]), n: X.t.cols, N: O.t.cols } };
  const gammaAt = (b, i) => V((b.x0 + b.x1) / 2, along(b, i, b.t.cols, 'y'), b.z1);   // (a rod: its numbers down)
  const rmsMemo = new Map();
  function rmsOf(x, j, n, eps) {
    const k = cur.layer + ':' + x + ':' + j; if (rmsMemo.has(k)) return rmsMemo.get(k);
    let q = 0; for (let c = 0; c < n; c++) { const v = demo.at(x, j, c); q += v * v }
    const r = { ms: q / n, rms: Math.sqrt(q / n + eps) }; rmsMemo.set(k, r); return r;
  }
  const normWhole = pr => `<i>整块</i>${inputName(pr)} <b>[6, ${pr.n}]</b> → ${pr.O.t.name} <b>[6, ${pr.N}]</b>，形状不变<br>每个词只用自己的 ${pr.n} 个数，和 γ <b>[${pr.n}]</b>`;
  const normForm = (pr, rms, value) => `<i class="sw col" style="background:${pr.cx}"></i> ÷ ${fmt(rms)} × <i class="sw row" style="background:${pr.cw};width:8px;height:18px"></i> = <b>${value}</b>`;
  const RMS_PH = ['pick', 'square', 'mean'];
  // (all: the five in one beat, for a segment that walks through it again)
  const NORM_ALL = [['pick', .1], ['square', .22], ['mean', .2], ['scale', .26], ['place', .22]];
  function normAll(u) { let a = 0; for (const [ph, d] of NORM_ALL) { if (u < a + d || ph === 'place') return [ph, clamp((u - a) / d)]; a += d } }
  // placing: the number the word's result column has filled to (the first dropped in, then the rest down the column)
  const placedAt = (u, n) => u < .3 ? -1 : Math.min(n - 1, Math.floor(clamp((u - .35) / .6) * n));
  const norms = new Map();
  function normParts(s) {
    if (norms.has(s.n)) return norms.get(s.n);
    const d = s.norm, pr = normProduct(s, [d.g, d.x, d.out]), n = pr.n, j = d.word, cs = [...SHOW, n - 1];
    const xv = cs.map(c => demo.at(d.x, j, c)), gv = cs.map(c => demo.weight(d.g, c)), yv = cs.map(c => demo.at(d.out, j, c));
    const note = el('dot-note', ''), sumLine = el('dot-sumline', ''), drop = el('dot-cell drop', '');
    drop.style.background = pr.co; drop.style.borderColor = deep(pr.co);
    const rows = cellRows(cs, pr.cw, pr.cx);
    const part = { pr, word: j, cs, xv, gv, yv, ...rmsOf(d.x, j, n, d.eps), note, sumLine, drop, rows };
    norms.set(s.n, part); return part;
  }
  // ---- a result number by number from the numbers at the same place (09-29: RMSNorm's ÷ rms × γ, SwiGLU's
  // SiLU(gate) × up): the first 6 and the last out of their places in pairs, each pair its own result; placing, the first
  // dropped into its cell, then the rest of the word's column / row filled, the lines and the arrow on the number filling.
  // E: {pr, j, n, cs, tag, whole, one(R), form(value), wAt(c), xAt(c), text(k, m) (a pair's words, m: its result shown so
  // much), value(R), points() (what the card keeps clear of), grow (the card grows in its pairing), key, rows, note, drop}
  function pairScene(s, bi, E, phase, u) {
    camera.updateMatrixWorld(); hideDots();
    const pr = E.pr, n = E.n, j = E.j, R = phase === 'place' ? Math.max(0, placedAt(u, n)) : 0, [ox, oy] = px(dataAt(pr.O, j, R));
    const HEAD = setCard(E.tag, E.whole, E.one(R), E.form(phase === 'place' ? fmt(E.value(R)) : phase === 'pair' && u > .75 ? fmt(E.value(0)) : '?'), E.key), FULL = HEAD + PAIRS, ROW0 = HEAD + 6;
    const cell0 = () => px(dataAt(pr.O, j, 0));
    const sp = chooseSpot(s, bi, () => { const [a, b] = cell0(); return [a, b, a, b] }, FULL + geo.ph + TAB, () => [cell0(), ...E.points()], () => [pr.W, pr.X, pr.O].map(screenBox));
    const [ax, ay] = cell0(), { x, y } = spotAt(sp, [ax, ay, ax, ay], FULL);
    const grown = phase === 'pick' ? 0 : phase === 'place' ? 1 - ease(u * 3) : phase === 'pair' && E.grow ? ease(u * 2) : 1, h = HEAD + (FULL - HEAD) * grown;
    const vis = phase === 'pick' ? ease(u * 2) : 1;
    const tab = placeCard(x, y, h, vis, towardOf([cell0(), ...E.points()]), [pr.W, pr.X, pr.O].map(faceBox), false, [cell0(),...E.points()]);
    const fresh = phase === 'pick' ? ease(u * 1.6 - .3) : phase === 'pair' ? ease(u * 2.5) : 1;   // (the lines of a new formula drawn)
    const [ex, ey] = lines(pr, px(E.wAt(R)), px(E.xAt(R)), [ox, oy], tab, fresh, 1, fresh, phase === 'place' ? 1 : .45);
    if (phase === 'pick') { later = () => dims(pr, vis, false); return }
    if (phase === 'place') { const v = ease(u / .3); if (v < 1) dropAlongArrow(E.drop,v,[ex,ey],[ox,oy]) }
    const rowY = k => y + ROW0 + (k < SHOW.length ? k : k + 1) * DY, colX = x + 24;
    E.note.textContent = `⋮ 其余 ${n - E.cs.length} 对`;
    put(E.note, [colX + 52, y + ROW0 + SHOW.length * DY], phase === 'pair' ? ease(u * 2 - 1) : 1 - ease(u * 3), 1, true);
    E.rows.forEach((r, k) => {   // each pair out of their places; placing, they go
      const at = rowY(k), stag = k / E.rows.length * .45;
      const back = phase === 'place' ? ease(u * 3) : 0; if (back >= 1) return;
      const v = phase === 'pair' ? ease((u - stag) / .45) : 1; if (v <= 0) return;
      const [wx, wy] = px(E.wAt(r.c)), [xx, xy] = px(E.xAt(r.c)), o = (1 - back) * Math.min(1, v * 3);
      put(r.x, [xx + (colX - xx) * v, xy + (at - xy) * v], o, .5 + .5 * v); put(r.w, [wx + (colX + 34 - wx) * v, wy + (at - wy) * v], o, .5 + .5 * v);
      if (v > .9) put(r.times, [colX + 17, at], o * (v - .9) / .1);
      const m = phase === 'pair' ? ease((u - .45 - stag * .5) / .35) : 1;
      if (v >= 1) { r.txt.innerHTML = E.text(k, m); put(r.txt, [colX + 52, at], 1 - back, 1, true) }
    });
  }
  // the pairs, made once: of a segment's norm (its scaling), of its `ew` (SwiGLU)
  const cellRows = (cs, cw, cx) => { const rows = cs.map(c => ({ c, w: el('dot-cell', ''), x: el('dot-cell', ''), times: el('dot-x', '×'), txt: el('dot-txt', '') }));
    rows.forEach(r => { r.w.style.background = cw; r.x.style.background = cx; r.w.style.borderColor = deep(cw); r.x.style.borderColor = deep(cx) }); return rows };
  const shown = (m, v) => m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(v)}</b></span>` : '';
  const pairsMade = new Map();
  function normPairs(s) {
    const key = 'norm:' + s.n; if (pairsMade.has(key)) return pairsMade.get(key);
    const P = normParts(s), pr = P.pr, n = pr.n, j = P.word, drop = el('dot-cell drop', ''); drop.style.background = pr.co; drop.style.borderColor = deep(pr.co);
    const E = { pr, j, n, cs: P.cs, tag: s.norm.tag, whole: normWhole(pr), key: `norm:${s.n}:false`,
      one: R => `<i>再算</i>${wordOf(j)} 第 ${R + 1} 个数 ÷ rms × γ 第 ${R + 1} 个 → 第 ${R + 1} 个数；${n} 个数共用这一个 rms`,
      form: v => normForm(pr, P.rms, v), wAt: c => gammaAt(pr.W, c), xAt: c => dataAt(pr.X, j, c), value: R => demo.at(pr.out, j, R),
      text: (k, m) => `${fmt(P.xv[k])} ÷ ${fmt(P.rms)} × ${fmt(P.gv[k])}${shown(m, P.yv[k])}`,
      points: () => [px(dataAt(pr.X, j, n * .85)), px(dataAt(pr.X, j, 0)), px(gammaAt(pr.W, 0))],
      rows: cellRows(P.cs, pr.cw, pr.cx), note: el('dot-note', ''), drop };
    pairsMade.set(key, E); return E;
  }
  // SwiGLU (official 87–105): h = SiLU(min(gate, lim)) × clip(up, −lim, lim), lim = swiglu_limit
  function ewProduct(s) {
    const d = s.ew, W = B[id(s, d.a)], X = B[id(s, d.b)], O = B[id(s, d.out)];
    return { w: d.a, x: d.b, out: d.out, W, X, O, cw: onCard(look.palette[W.comp][0]), cx: onCard(look.palette[X.comp][0]), co: onCard(look.palette[O.comp][0]), n: X.t.cols, N: O.t.cols, lim: d.lim };
  }
  const ewWhole = pr => `<i>整块</i>${pr.W.t.name} <b>[6, ${pr.n}]</b>、${inputName(pr)} <b>[6, ${pr.n}]</b> → ${pr.O.t.name} <b>[6, ${pr.N}]</b>，形状不变`
    + `<br>同一位置的两个数一对：SiLU(gate) × up = 1 个数（gate 先截到 ≤ ${pr.lim}，up 截到 −${pr.lim} 到 ${pr.lim}）`;
  const ewOne = (pr, j, R) => `<i>这一个</i>${wordOf(j)} 第 ${R + 1} 个数：SiLU(gate 第 ${R + 1} 个) × up 第 ${R + 1} 个 → <b>1</b> 个数`;
  const ewForm = (pr, v) => `SiLU(<i class="sw row" style="background:${pr.cw}"></i>) × <i class="sw col" style="background:${pr.cx};width:26px;height:8px"></i> = <b>${v}</b>`;
  function ewPairs(s) {
    const key = 'ew:' + s.n; if (pairsMade.has(key)) return pairsMade.get(key);
    const d = s.ew, pr = ewProduct(s), n = pr.n, j = d.word, cs = [...SHOW, n - 1], drop = el('dot-cell drop', ''); drop.style.background = pr.co; drop.style.borderColor = deep(pr.co);
    const g = cs.map(c => Math.min(demo.at(d.a, j, c), d.lim)), up = cs.map(c => Math.max(-d.lim, Math.min(d.lim, demo.at(d.b, j, c))));
    const E = { pr, j, n, cs, tag: d.tag, whole: ewWhole(pr), key, one: R => ewOne(pr, j, R), form: v => ewForm(pr, v),
      wAt: c => dataAt(pr.W, j, c), xAt: c => dataAt(pr.X, j, c), value: R => demo.at(d.out, j, R), grow: true,
      text: (k, m) => `SiLU(${fmt(g[k])}) × ${fmt(up[k])}${shown(m, demo.at(d.out, j, cs[k]))}`,
      points: () => [px(dataAt(pr.W, j, n / 2)), px(dataAt(pr.X, j, n / 2))],
      rows: cellRows(cs, pr.cw, pr.cx), note: el('dot-note', ''), drop };
    pairsMade.set(key, E); return E;
  }
  // β (09-29, official 699): head h of word j = sigmoid(RMSNorm'd x · W_b's row h), 4096 pairs. x stands far above W_b,
  // out of the picture: its numbers come down from the picture's top edge (10-02: the camera goes only down the spine),
  // the first of each pair on the card (the swatches swapped: .row the input's, .col W_b's)
  const betaWhole = pr => `<i>整块</i>${inputName(pr)} <b>[6, ${pr.n}]</b> × W_b <b>[${pr.N}, ${pr.n}]</b> → β <b>[6, ${pr.N}]</b>`
    + `<br>每个词、每个头：一次点积，再 sigmoid = 1 个数（0 到 1 之间）`;
  const betaOne = (pr, j, h) => `<i>这一个</i>${wordOf(j)} 的 <b>[${pr.n}]</b>（RMSNorm 后，在上面）和 W_b 第 ${h + 1} 行 <b>[${pr.n}]</b> 一对一对相乘、相加，再 sigmoid → <b>1</b> 个数：第 ${h + 1} 个头的 β`;
  const betaForm = (cx, cw, v) => `sigmoid(dot(<i class="sw row" style="background:${cx}"></i>, <i class="sw col" style="background:${cw}"></i>)) = <b>${v}</b>`;
  function betaTerms(s) {
    const d = s.beta, p0 = product(s, [d.w, d.x, d.out]), pr = { ...p0, cw: p0.cx, cx: p0.cw }, j = d.word, h = d.R, n = p0.n, cs = [...SHOW, n - 1];
    let dot = 0; for (let c = 0; c < n; c++) dot += demo.weight(d.w, h, c) * demo.at(d.x, j, c);
    return { pr, n, cs, wv: cs.map(c => demo.at(d.x, j, c)), xv: cs.map(c => demo.weight(d.w, h, c)), total: demo.at(d.out, j, h), extra: 22,
      wAt: c => dataAt(p0.X, j, c), xAt: c => weightAt(p0.W, h, c), wLine: dataAt(p0.X, j, n * .85), xLine: weightAt(p0.W, h, n / 2),
      oAt: dataAt(p0.O, j, h), upright: true,
      sumSay: `这 ${cs.length} 个乘积 + 其余 ${n - cs.length} 个，加起来 = <b>${fmt(dot)}</b><br>再过 sigmoid = <b>${fmt(demo.at(d.out, j, h))}</b>`,
      fill: v => setCard(d.tag, betaWhole(p0), betaOne(p0, j, h), betaForm(pr.cw, pr.cx, v), 'beta:' + s.n) };
  }
  // ---- KDA's gated norm acted out (09-29, official o_norm 341–358): number c of head h of word j = x_c ÷ rms(the head's 128)
  // × γ_c × sigmoid(gate_c) — x the read-out, gate the output gate at the same place. The gate stands far above (segment
  // 13): the camera goes up for it first and carries the card down (as the write-back; 09-29, the user chose it). Phases:
  // gate (its numbers out, each through sigmoid), carry, square, mean (the head's rms), scale (each number: 4 factors), place
  const gnMade = new Map(), gnRmsMemo = new Map();
  function gnRms(s, j, h) {
    const d = s.gn, k = s.n + ':' + j + ':' + h; if (gnRmsMemo.has(k)) return gnRmsMemo.get(k);
    const per = B[id(s, d.x)].t.cols; let q = 0; for (let c = 0; c < per; c++) { const v = demo.at(d.x, j, h * per + c); q += v * v }
    const r = { ms: q / per, rms: Math.sqrt(q / per + d.eps) }; gnRmsMemo.set(k, r); return r;
  }
  function gnParts(s) {
    if (gnMade.has(s.n)) return gnMade.get(s.n);
    const d = s.gn, X = B[id(s, d.x)], G = B[id(s, d.g)], Q = B[id(s, d.gate)], O = B[id(s, d.out)], per = X.t.cols, off = d.head * per, j = d.word, cs = [...SHOW, per - 1];
    const pr = { w: d.g, x: d.x, out: d.out, W: G, X, O, Q, cw: onCard(look.palette[G.comp][1]), cx: onCard(look.palette[X.comp][0]), cq: onCard(look.palette[Q.comp][0]), co: onCard(look.palette[O.comp][0]), n: per, N: demo.get(d.out).shape[1], per, H: O.t.deck.n };
    const sig = v => 1 / (1 + Math.exp(-v)), qv = cs.map(c => demo.at(d.gate, j, off + c));
    const mk = c => { const e = el('dot-cell', ''); e.style.background = c; e.style.borderColor = deep(c); return e };
    const drop = mk(pr.co); drop.classList.add('drop');
    const P = { pr, d, j, h: d.head, off, per, cs, xv: cs.map(c => demo.at(d.x, j, off + c)), gv: cs.map(c => demo.weight(d.g, c)), qv, sq: qv.map(sig),
      yv: cs.map(c => demo.at(d.out, j, off + c)), ...gnRms(s, j, d.head), drop, note: el('dot-note', ''), sumLine: el('dot-sumline', ''),
      rows: cs.map(c => ({ c, q: mk(pr.cq), x: mk(pr.cx), w: mk(pr.cw), txt: el('dot-txt', '') })) };
    gnMade.set(s.n, P); return P;
  }
  const gnWhole = pr => `<i>整块</i>读出 <b>[6, ${pr.H} 头, ${pr.per}]</b>、输出门 <b>[6, ${pr.H} 头, ${pr.per}]</b> → ${pr.O.t.name} <b>[6, ${pr.H} 头, ${pr.per}]</b>，形状不变`
    + `<br>每个词、每个头：自己的 ${pr.per} 个数求 rms；每个数 ÷ rms × γ <b>[${pr.per}]</b> × sigmoid(输出门同一位置的数)`;
  const gnSw = pr => ({ q: `<i class="sw ex" style="background:${pr.cq};width:10px;height:10px"></i>`, x: `<i class="sw col" style="background:${pr.cx}"></i>`, g: `<i class="sw row" style="background:${pr.cw};width:8px;height:18px"></i>` });
  const gnForm = (pr, rms, v) => { const w = gnSw(pr); return `${w.x} ÷ ${fmt(rms)} × ${w.g} × sigmoid(${w.q}) = <b>${v}</b>` };
  function gnScene(s, bi, phase, u) {
    camera.updateMatrixWorld(); hideDots();
    CW = host.clientWidth < 700 ? 300 : 360;
    const P = gnParts(s), { pr, j, off, per } = P, n = per, at = (b, c) => dataAt(b, j, off + c), sw = gnSw(pr);
    const gateP = phase === 'gate' || phase === 'carry', rmsP = phase === 'square' || phase === 'mean';
    const R = phase === 'place' ? Math.max(0, placedAt(u, n)) : 0, [ox, oy] = px(at(pr.O, R));
    const val = phase === 'place' ? fmt(demo.at(pr.out, j, off + R)) : phase === 'scale' && u > .75 ? fmt(P.yv[0]) : phase === 'mean' && u > .7 ? fmt(P.rms)
      : phase === 'carry' || phase === 'gate' && u > .8 ? fmt(P.sq[0]) : '?';
    const form = gateP ? `sigmoid(输出门${sw.q}) = <b>${val}</b>` : rmsP ? `rms(${sw.x}) = <b>${val}</b>` : gnForm(pr, P.rms, val);
    const one = gateP ? `<i>先取</i>输出门里${wordOf(j)}第 ${P.h + 1} 个头的 <b>[${n}]</b>（第 11 段算的，在上面），每个数过 sigmoid`
      : rmsP ? `<i>再算</i>${wordOf(j)}第 ${P.h + 1} 个头读出的 <b>[${n}]</b>：每个数平方，求平均，再开根号 → 这个头的 rms`
      : `<i>最后</i>第 ${R + 1} 个数 ÷ rms × γ 第 ${R + 1} 个 × sigmoid(输出门第 ${R + 1} 个) → <b>1</b> 个数；这个头的 ${n} 个数共用一个 rms`;
    const HEAD = setCard(P.d.tag, gnWhole(pr), one, form, `gn:${s.n}:${gateP ? 'g' : rmsP ? 'r' : 's'}`), FULL = HEAD + PAIRS + 22, ROW0 = HEAD + 6;
    // (one corner through all its beats, the camera going from the gate down to the read-out)
    const seq = s.beats.map((b, i) => b.op.gn ? i : -1).filter(i => i >= 0);
    const reserved = FULL + geo.ph + TAB;
    const sp = host.clientWidth < 700 ? 'TL' : chooseSpot(s, seq, () => { const [a, b] = px(at(pr.O, 0)); return [a, b, a, b] }, reserved, () => [px(at(pr.O, 0)), px(at(pr.X, 0)), px(at(pr.Q, 0)), px(gammaAt(pr.W, 0))], () => [pr.W, pr.X, pr.O, pr.Q].map(screenBox));
    const { x, y } = spotAt(sp, [0, 0, 0, 0], reserved);
    const grown = phase === 'gate' ? ease((u - .2) * 3) : phase === 'place' ? 1 - ease(u * 3) : 1, h = HEAD + (FULL - HEAD) * grown;
    const vis = phase === 'gate' ? ease(u * 5) : 1, drawn = phase === 'gate' ? ease(u * 4 - .3) : 1;
    const pts = gateP ? [px(at(pr.Q, n / 2))] : rmsP ? [px(at(pr.X, n / 2))] : [px(at(pr.X, R)), px(gammaAt(pr.W, R)), [ox, oy]];
    const tab = placeCard(x, y, h, vis, towardOf(pts), [pr.W, pr.X, pr.O, pr.Q].map(faceBox), false, pts);
    if (gateP) lines(pr, null, null, [null], tab, drawn, 1, 0, 0, [[px(at(pr.Q, n / 2)), pr.cq]]);
    else if (rmsP) lines(pr, null, px(at(pr.X, n / 2)), [null], tab, 1, 1);
    else { const [ex, ey] = lines(pr, px(gammaAt(pr.W, R)), px(at(pr.X, R)), [ox, oy], tab, 1, 1, phase === 'place' ? 1 : 0, phase === 'place' ? 1 : 0, [[px(at(pr.Q, R)), pr.cq]]);
      if (phase === 'place') { const v = ease(u / .3); if (v < 1) dropAlongArrow(P.drop,v,[ex,ey],[ox,oy]) } }
    if (phase === 'gate' && u < .2) return;
    const fAt = [tab[0] + geo.val[0], tab[1] + geo.val[1]], rowY = k => y + ROW0 + (k < SHOW.length ? k : k + 1) * DY, colX = x + 22;
    P.note.textContent = `⋮ 其余 ${n - P.cs.length} 个`;
    put(P.note, [colX + 64, y + ROW0 + SHOW.length * DY], phase === 'gate' ? ease(u * 2 - 1) : phase === 'place' ? 1 - ease(u * 3) : 1, 1, true);
    const grey = t => ` <span style="color:#8a8478">${t}</span>`;
    P.rows.forEach((r, k) => {
      const at0 = rowY(k), stag = k / P.rows.length * .3, back = phase === 'place' ? ease(u * 3) : 0; if (back >= 1) return;
      // the gate's cell: out of the gate, then kept on the card; the read-out's: out for the squares (into the formula), out again to scale; γ's: to scale
      const vq = phase === 'gate' ? ease((u - .25 - stag) / .35) : 1;
      if (vq > 0) { const [qx, qy] = sourcePoint(px(at(pr.Q, r.c)), lxs[0], colX); put(r.q, phase === 'gate' ? [qx + (colX - qx) * vq, qy + (at0 - qy) * vq] : [colX, at0], (1 - back) * Math.min(1, vq * 3), .5 + .5 * vq) }
      const vx = phase === 'square' ? ease((u - stag) / .5) : phase === 'mean' ? 1 : phase === 'scale' ? ease((u - stag) / .45) : phase === 'place' ? 1 : 0;
      const into = phase === 'mean' ? ease((u - stag * .5) / .5) : 0;
      if (vx > 0 && into < 1) { const [xx, xy] = px(at(pr.X, r.c)), t = [xx + (colX + 20 - xx) * vx, xy + (at0 - xy) * vx]; put(r.x, [t[0] + (fAt[0] - t[0]) * into, t[1] + (fAt[1] - t[1]) * into], (1 - back) * (1 - into) * Math.min(1, vx * 3), .5 + .5 * vx) }
      const vw = phase === 'scale' ? ease((u - stag) / .45) : phase === 'place' ? 1 : 0;
      if (vw > 0) { const [wx, wy] = px(gammaAt(pr.W, r.c)); put(r.w, [wx + (colX + 40 - wx) * vw, wy + (at0 - wy) * vw], (1 - back) * Math.min(1, vw * 3), .5 + .5 * vw) }
      const tx = colX + 58, sg = fmt(P.sq[k]);
      if (phase === 'gate' && vq >= 1) { const m = ease((u - .65 - stag * .5) / .25); r.txt.innerHTML = `sigmoid(${fmt(P.qv[k])})${m > 0 ? ` <span style="opacity:${m}">= <b>${sg}</b></span>` : ''}`; put(r.txt, [tx, at0], 1, 1, true) }
      else if (phase === 'carry') { r.txt.innerHTML = grey(`sigmoid(输出门) = ${sg}`); put(r.txt, [tx, at0], 1, 1, true) }
      else if (rmsP) { const m = phase === 'square' ? ease((u - .4 - stag * .5) / .35) : 1;
        r.txt.innerHTML = (vx >= 1 && into < 1 ? `<span style="opacity:${1 - into}">${fmt(P.xv[k])}²${m > 0 ? ` <span style="opacity:${m}">= <b>${sci(P.xv[k] ** 2)}</b></span>` : ''}</span>` : '') + grey(` · ${sg}`); put(r.txt, [tx, at0], 1, 1, true) }
      else if (vx >= 1 && vw >= 1) { const m = phase === 'scale' ? ease((u - .5 - stag * .5) / .3) : 1;
        r.txt.innerHTML = `${fmt(P.xv[k])} ÷ rms × ${fmt(P.gv[k])} × ${sg}${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(P.yv[k])}</b></span>` : ''}`; put(r.txt, [tx, at0], 1 - back, 1, true) }
    });
    if (phase === 'mean') { const v = ease((u - .55) / .4); if (v > 0) { P.sumLine.innerHTML = `${n} 个平方的平均 = <b>${sci(P.ms)}</b><br>rms = √(平均 + ε) = <b>${fmt(P.rms)}</b>`; put(P.sumLine, [x + 14, rowY(SHOW.length + 1) + 6], v, 1, true) } }
  }
  // a KDA beat's round and phase: pick; recall (pull, mul, sum); read (pull, mul, sum); place
  function kdaPhase(b, u) {
    if (b === 'pick') return ['recall', 'pick', u];
    if (b === 'place') return ['read', 'place', u];
    const P = [['pull', .4], ['mul', .25], ['sum', .35]]; let a = 0;
    for (const [ph, d] of P) { if (u < a + d || ph === 'sum') return [b, ph, clamp((u - a) / d)]; a += d }
  }
  const EW_ALL = [['pick', .15], ['pair', .5], ['place', .35]];
  function ewAll(u) { let a = 0; for (const [ph, d] of EW_ALL) { if (u < a + d || ph === 'place') return [ph, clamp((u - a) / d)]; a += d } }
  function normScene(s, bi, phase, u) {
    if (!RMS_PH.includes(phase)) return pairScene(s, bi, normPairs(s), phase === 'scale' ? 'pair' : phase, u);   // (the scaling: pairs)
    camera.updateMatrixWorld(); hideDots();
    const P = normParts(s), pr = P.pr, n = pr.n, j = P.word, E = normPairs(s);
    const one = `<i>先算</i>${wordOf(j)} <b>[${n}]</b> 每个数平方，求平均，再开根号 → <b>1</b> 个数：均方根 rms`;
    const form = `rms(<i class="sw col" style="background:${pr.cx}"></i>) = <b>${phase === 'mean' && u > .7 ? fmt(P.rms) : '?'}</b>`;
    const HEAD = setCard(s.norm.tag, normWhole(pr), one, form, `norm:${s.n}:true`), FULL = HEAD + PAIRS, ROW0 = HEAD + 6;
    const cell0 = () => px(dataAt(pr.O, j, 0)), col = () => px(dataAt(pr.X, j, n * .85));
    const sp = chooseSpot(s, bi, () => { const [a, b] = cell0(); return [a, b, a, b] }, FULL + geo.ph + TAB, () => [cell0(), ...E.points()], () => [pr.W, pr.X, pr.O].map(screenBox));
    const [ax, ay] = cell0(), { x, y } = spotAt(sp, [ax, ay, ax, ay], FULL);
    const grown = phase === 'pick' ? 0 : phase === 'square' ? ease(u * 2) : 1, h = HEAD + (FULL - HEAD) * grown;
    const vis = phase === 'pick' ? ease(u * 2) : 1;
    const tab = placeCard(x, y, h, vis, towardOf([cell0(), ...E.points()]), [pr.W, pr.X, pr.O].map(faceBox), false, [cell0(),...E.points()]);
    const fresh = phase === 'pick' ? ease(u * 1.6 - .3) : 1;
    lines(pr, null, col(), [null], tab, fresh, 1);
    if (phase === 'pick') { later = () => dims(pr, vis, false); return }
    const fAt = [tab[0] + geo.val[0], tab[1] + geo.val[1]], rowY = k => y + ROW0 + (k < SHOW.length ? k : k + 1) * DY, colX = x + 24;
    P.note.textContent = `⋮ 其余 ${n - P.cs.length} 个`;
    put(P.note, [colX + 24, y + ROW0 + SHOW.length * DY], { square: ease(u * 2 - 1), mean: 1 - ease(u * 2) }[phase], 1, true);
    P.rows.forEach((r, k) => {
      const at = rowY(k), stag = k / P.rows.length * .45;
      {   // the word's numbers out of its column, each squared; then the squares into the formula
        const out = phase === 'mean' ? ease((u - stag * .5) / .5) : 0; if (out >= 1) return;
        const v = phase === 'square' ? ease((u - stag) / .55) : 1; if (v <= 0) return;
        const [xx, xy] = px(dataAt(pr.X, j, r.c)), tx = [xx + (colX - xx) * v, xy + (at - xy) * v];
        put(r.x, [tx[0] + (fAt[0] - tx[0]) * out, tx[1] + (fAt[1] - tx[1]) * out], (1 - out) * Math.min(1, v * 3), .5 + .5 * v);
        const m = phase === 'square' ? ease((u - .45 - stag * .5) / .35) : 1;
        if (v >= 1) { r.txt.innerHTML = `${fmt(P.xv[k])}²${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(P.xv[k] ** 2, 4)}</b></span>` : ''}`; put(r.txt, [colX + 24, at], 1 - out, 1, true) }
      }
    });
    if (phase === 'mean') { const v = ease((u - .55) / .4); if (v > 0) { P.sumLine.innerHTML = `${n} 个平方的平均 = <b>${fmt(P.ms)}</b><br>rms = √(平均 + ε) = <b>${fmt(P.rms)}</b>`; put(P.sumLine, [x + 14, rowY(2)], v, 1, true) } }
  }
  // the number a beat computing the rest is at, by the rules its results grow by (run above): [word, number R of the word]
  function tracedAt(op, u, pr) {
    const T = words.length, per = pr.O.t.cols;
    const inWord = (f, h0, n) => { const j = Math.min(T - 1, Math.floor(f * T)); return [j, h0 + Math.min(n - 1, Math.floor((f * T - j) * n))] };
    const w0 = (op.w0 || 0) / T;
    // (heads one under another: head by head, down, and in a head word by word — 09-29, the user: "为啥在下面算完又去上面
    // 算"; every number is on its own, so any order is the same numbers; this one sweeps down once, never jumps back up)
    if (op.words && headsDown(pr.O)) { const Hn = pr.O.t.deck.n, f = clamp(u) * .9999 * Hn, h = Math.floor(f), g = (f - h) * T, j = Math.floor(g); return [j, h * per + Math.min(per - 1, Math.floor((g - j) * per))] }
    if (op.heads) { const c = op.from + clamp(u) * op.n * .9999, h = Math.floor(c); return inWord(op.slow ? w0 + (1 - w0) * (c - h) : c - h, h * per, per) }
    return inWord(w0 + (1 - w0) * clamp(u) * .9999, 0, pr.N);
  }
  const traces = new Map();
  const traceOf = (s, op) => { const key = s.n + ':' + op.trace.join(); if (!traces.has(key)) traces.set(key, ({ norm: normProduct, mix: mixProduct, conv: convProduct, write: s => writeProduct(s), ew: s => ewProduct(s), kda: s => kdaProduct(s), coef: s => coefProduct(s), fg: s => fgProduct(s), gn: s => gnParts(s).pr, beta: s => product(s, op.trace) }[op.by] || product)(s, op.trace)); return traces.get(key) };
  // (last: the last beat followed; over its last part the lines and the arrow go and the card says the rest are done,
  // so the picture does not stop all at once)
  function traceScene(s, bi, op, u, last) {
    camera.updateMatrixWorld(); hideDots();
    const pr = traceOf(s, op), [j, R] = tracedAt(op, u, pr), [ox, oy] = px(dataAt(pr.O, j, R)), norm = op.by === 'norm';
    const heads = (pr.O.div[2] > 1 || pr.O.t.headsCut) && pr.O.t.cols > 1, per = pr.O.t.cols, close = last ? ease((u - .82) / .18) : 0;
    const unit = pr.O.t.deck?.kind === 'stream' ? '路' : '个头';
    const name = `${op.trace[3]} · ${heads ? `第 ${Math.floor(R / per) + 1} ${unit} · ` : ''}${wordOf(j)} · 第 ${(heads ? R % per : R) + 1} 个数`, key = `trace:${s.n}:${bi}:${close > .5}`;
    // (a norm: the number, its γ, and the word's rms; else the weight's row and the word's column)
    const mix = op.by === 'mix', conv = op.by === 'conv', write = op.by === 'write', ew = op.by === 'ew', kda = op.by === 'kda', coef = op.by === 'coef', fg = op.by === 'fg', gn = op.by === 'gn', beta = op.by === 'beta';
    const wAt = () => px(gn ? gammaAt(pr.W, R % per) : coef ? fnAt(pr.W, R, pr.per / 2) : norm ? gammaAt(pr.W, R) : mix ? dataAt(pr.W, j, (pr.k - 1) / 2) : write ? dataAt(pr.X, j, R % per) : ew ? dataAt(pr.W, j, R)
      : kda ? weightAt(pr.W, Math.floor(R / per) * per + per / 2, R % per)
      : conv ? weightAt(pr.W, R, (pr.k - 1) / 2) : weightAt(pr.W, R, pr.n / 2));
    const xAt = () => px(gn ? dataAt(pr.X, j, R) : coef ? dataAt(pr.X, j, pr.per / 2) : conv ? dataAt(pr.X, Math.max(0, j - (pr.k - 1) / 2), R) : write ? dataAt(pr.Y, j, R % per) : kda ? dataAt(pr.X, j, Math.floor(R / per) * per + per / 2)
      : dataAt(pr.X, j, norm || mix || ew ? R : pr.n * .85));
    let HEAD;
    if (kda) HEAD = setCard(close > .5 ? '其余的数都这样算完：每个词先改 S，再用 q 读' : name, kdaWhole(pr), `<i>这一个</i>${wordOf(j)} 第 ${Math.floor(R / per) + 1} 个头：改好的 S 第 ${R % per + 1} 列 <b>[${per}]</b> 和 q <b>[${per}]</b> 一对一对相乘、相加 → <b>1</b> 个数`,
      kdaStack(pr, [['q', '读出'], ['k', '改 S'], ['v', '改 S'], ['g', '改 S'], ['β', '改 S'], ['S', `第 ${R % per + 1} 列`]], `读出 = <b>${fmt(demo.at(pr.out, j, R))}</b>`), key);
    else if (beta) HEAD = setCard(close > .5 ? '其余的都这样算完：每个词、每个头一次点积，再 sigmoid' : `β · 第 ${R + 1} 个头 · ${wordOf(j)}`, betaWhole(pr), betaOne(pr, j, R), betaForm(pr.cx, pr.cw, fmt(demo.at(pr.out, j, R))), key);
    else if (gn) { const { rms } = gnRms(s, j, Math.floor(R / per));
      HEAD = setCard(close > .5 ? '其余的数都这样算完：每个词、每个头先算自己的 rms' : name, gnWhole(pr), `<i>这一个</i>${wordOf(j)} 第 ${Math.floor(R / per) + 1} 个头的 rms = ${fmt(rms)}；第 ${R % per + 1} 个数 ÷ rms × γ × sigmoid(输出门同一位置)`, gnForm(pr, rms, fmt(demo.at(pr.out, j, R))), key) }
    else if (fg) HEAD = setCard(close > .5 ? '其余的数都这样算完：每个数一次点积，再过衰减门的尾巴' : name, fgWhole(pr, s.fg.lb), fgOne(pr, j, R), fgForm(pr, s.fg.lb, fmt(demo.at(pr.out, j, R))), key);
    else if (coef) HEAD = setCard(close > .5 ? '其余的系数都这样算完：每个词 24 次点积' : `${op.trace[3]} · ${wordOf(j)} · ${coefName(R, pr.k)}`, coefWhole(pr), coefOne(pr, j, R, coefRms(s, j)), coefForm(pr, R, fmt(demo.at(pr.out, j, R))), key);
    else if (write) HEAD = setCard(close > .5 ? `其余的数都这样算完：每个数 ${pr.k + 1} 对相乘、相加` : name, writeWhole(pr), writeOne(pr, j, Math.floor(R / per), R % per), writeForm(pr, fmt(demo.at(pr.out, j, Math.floor(R / per), R % per))), key);
    else if (ew) HEAD = setCard(close > .5 ? '其余的数都这样算完：同一位置的两个数一对' : name, ewWhole(pr), ewOne(pr, j, R), ewForm(pr, fmt(demo.at(pr.out, j, R))), key);
    else if (conv) HEAD = setCard(close > .5 ? `其余的数都这样算完：每个数 ${pr.k} 对相乘、相加，再 SiLU` : name, convWhole(pr), convOne(pr, j, R), convForm(pr, fmt(demo.at(pr.out, j, R))), key);
    else if (mix) HEAD = setCard(close > .5 ? `其余的数都这样算完：每个数 ${pr.k} 对相乘、相加` : name, mixWhole(pr), mixOne(pr, j, R), mixForm(pr, fmt(demo.at(pr.out, j, R))), key);
    else if (norm) { const { rms } = rmsOf(pr.x, j, pr.n, s.norm.eps);
      HEAD = setCard(close > .5 ? '其余的数都这样算完：每个词先算自己的 rms' : name, normWhole(pr), `<i>这一个</i>${wordOf(j)} 的 rms = ${fmt(rms)}；第 ${R + 1} 个数 ÷ rms × γ 第 ${R + 1} 个`, normForm(pr, rms, fmt(demo.at(pr.out, j, R))), key) }
    else HEAD = fillCard(pr, close > .5 ? '其余的数都这样算完：每个数一次点积' : name, j, R, fmt(demo.at(pr.out, j, R)), key);
    const outs = op.words ? [op.words].flat() : op.heads.map(([, o]) => o);
    if (close > .5) HEAD = setCard(tag.textContent, whole.innerHTML, '', `${outs.length > 1 ? outs.join('、') + ' 各' : op.trace[3] + ' 共'} ${words.length} × ${pr.N} = ${(words.length * pr.N).toLocaleString('en')} 个数`, key + ':done');
    // (the forget gate's and β's: the number goes through the whole blocks, the card wholly above them or below)
    // Reserve the moving sources and destinations for the whole trace, including a late seek.
    const tracePins = () => [wAt(), xAt(), ...(mix ? words.map((_,word) => px(dataAt(pr.W,word,(pr.k-1)/2))) : []),
      ...(mix || norm ? words.flatMap((_,word)=>Array.from({length:17},(_,i)=>px(dataAt(pr.O,word,(pr.N-1)*i/16)))) : []),
      ...(norm ? Array.from({length:17},(_,i)=>px(gammaAt(pr.W,(pr.N-1)*i/16))) : []),
      ...(norm ? words.flatMap((_,word)=>Array.from({length:17},(_,i)=>px(dataAt(pr.X,word,(pr.N-1)*i/16)))) : []),
      ...(kda ? Array.from({length:pr.H},(_,h)=>[
        ...[0,per-1].map(c=>px(weightAt(pr.W,h*per+per/2,c))),
        ...words.flatMap((_,word)=>[...[pr.X,pr.K,pr.Vv,pr.G].map(b=>px(dataAt(b,word,h*per+per/2))),px(dataAt(pr.Be,word,h)),...[0,per-1].map(c=>px(dataAt(pr.O,word,h*per+c)))])
      ]).flat() : [])];
    const sp = chooseSpot(s, bi, () => screenBox(pr.O), HEAD + geo.ph + TAB, tracePins, () => [pr.W, pr.X, pr.O].map(screenBox),
      fg || beta ? () => [pr.W, pr.X, pr.O].flatMap(b => { const [a, c, d, e] = screenBox(b); return [[(a + d) / 2, c], [(a + d) / 2, e]] }) : null);
    const { x, y } = spotAt(sp, screenBox(pr.O), HEAD + geo.ph + TAB);
    // (the tab toward the middle of the blocks, not of the number moving: it stays on one side through the beat)
    const boxes = [pr.W, pr.X, pr.O, pr.Y].filter(Boolean).map(screenBox);
    const hm = Math.floor(R / per) * per + per / 2;
    const more = kda ? [pr.X, pr.K, pr.Vv, pr.G].map(b => [px(dataAt(b, j, hm)), pr.cx]).concat([[px(dataAt(pr.Be, j, Math.floor(R / per))), pr.cx], [px(weightAt(pr.W, hm, R % per)), pr.cw]])
      : gn ? [[px(dataAt(pr.Q, j, R)), pr.cq]] : coef ? coefMore(pr, R).map(([p, c]) => [px(p), c]) : fg ? fgMore(pr, R).map(([p, c]) => [px(p), c]) : [];
    const tab = placeCard(x, y, HEAD, 1, towardOf(boxes.map(([a, c, d, e]) => [(a + d) / 2, (c + e) / 2])), [pr.W, pr.X, pr.O].map(faceBox), coef || fg || beta, [[ox,oy],wAt(),xAt(),...more.map(([p])=>p)]);
    const ends = coef && coefEnds(pr, j, R), ty = (tab[1] + tab[3]) / 2;
    lines(pr, coef ? nearer(ends[0], ty) : wAt(), coef ? nearer(ends[1], ty) : xAt(), [ox, oy], kda && !s.focusLabels && host.clientWidth >= 700 ? tabLeftOf([pr.X, pr.K, pr.Vv, pr.G, pr.Be, pr.W, pr.O], more.map(m => m[0]), 1) : tab, 1, 1 - close, 1, 1 - close, more, coef || fg || beta);
  }

  // Selected experts: k is a slot in this word's top-k, e is the actual weight slice.
  // They must never be substituted for one another (different words choose different experts).
  const expertWordBox = (b,j,k) => { const box=wordBox(b,j); if(b.t.deck?.kind==='pick'){box[0][2]=k;box[1][2]=k+.999} return box };
  const pickedAt = (b,j,c,k) => { const p=dataAt(b,j,c); if(b.t.deck?.kind==='pick')p.z=slabZ(b,k);return p };
  function expertProduct(s,stage,j=0,k=0) {
    const d=s.expert.stages[stage], W=B[id(s,d.w)],X=B[id(s,d.x)],O=B[id(s,d.out)], shape=demo.get(d.out).shape, routed=shape.length===3;
    return { ...d,W,X,O,stage,j,k,routed,e:routed?demo.at(s.expert.indices,j,k):null,K:routed?shape[1]:1,N:shape.at(-1),n:d.kind==='activation'?1:demo.W.tensors[d.w].shape.at(-1),
      cw:onCard(look.palette[W.comp][d.kind==='activation'?0:1]),cx:onCard(look.palette[X.comp][0]),co:onCard(look.palette[O.comp][0]) };
  }
  // An outline at the selected depth makes an internal weight slice visible;
  // it is an annotation of the existing stack, not a second tensor.
  function showExpertPlane(W,e,color) {
    const z=slabZ(W,e), pts=[[W.x0,W.y0],[W.x0,W.y1],[W.x1,W.y1],[W.x1,W.y0]].map(([x,y])=>px(V(x,y,z)));
    expertEdge.setAttribute('d',pts.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')+' Z');
    expertEdge.style.stroke=deep(color);expertEdge.style.fill=color;expertPlane.style.display='block';
  }
  function expertIndex(s,op,u) {
    if(op.phase!=='trace')return [0,0,0];
    const p=expertProduct(s,op.expert), i=Math.min(words.length*p.K*p.N-1,Math.floor(u*words.length*p.K*p.N));
    return [Math.floor(i/(p.K*p.N)),Math.floor(i/p.N)%p.K,i%p.N];
  }
  function fillExpert(pr,j,k,R) {
    const bid=id(cur,pr.out);
    if(!pr.routed)return fillTo(bid,j,R,'words');
    look.grow(bid,null);look.front(bid,pr.O.orient==='row'?4:5,j,k,(R+1)/pr.N,0);
  }
  function expertTerms(s,stage,j=0,k=0,R=0) {
    const pr=expertProduct(s,stage,j,k), activation=pr.kind==='activation', n=pr.n, cs=activation?[0]:[...SHOW,n-1], lim=s.expert.limit;
    const value=(name,c)=>demo.get(name).shape.length===3?demo.at(name,j,k,c):demo.at(name,j,c);
    const g=activation?value(pr.w,R):0, up=activation?value(pr.x,R+(pr.w===pr.x?pr.N:0)):0;
    const silu=v=>v/(1+Math.exp(-v)), gv=silu(Math.min(g,lim)), uv=Math.max(-lim,Math.min(lim,up));
    const weight=c=>pr.W.t.deck?.kind==='expert'?demo.weight(pr.w,pr.e,R,c):demo.weight(pr.w,R,c);
    const wAt=c=>{if(activation)return pickedAt(pr.W,j,R,k);const p=weightAt(pr.W,R,c);if(pr.W.t.deck?.kind==='expert')p.z=slabZ(pr.W,pr.e);return p};
    const xAt=c=>pickedAt(pr.X,j,activation?R+(pr.w===pr.x?pr.N:0):c,k);
    const total=value(pr.out,R), omega=pr.weighted?demo.at(s.expert.weights,j,k):null, raw=pr.weighted?demo.at('e_raw',j,k,R):total;
    const who=pr.routed?`${wordOf(j)} · 第 ${k+1} 份 → 专家 #${pr.e}`:`共享专家 · ${wordOf(j)}`;
    const shapes=pr.routed?(activation?'[6, 8, 4096] → [6, 8, 2048]':pr.weighted?'[6, 8, 2048] → [6, 8, 4096]':'[6, 4096] → [6, 8, 4096]（gate | up 各 2048）'):`[6, ${pr.X.t.cols}] → [6, ${pr.N}]`;
    const whole=`<i>整块</i>${shapes.replace(/\[[^\]]+\]/g,'<b>$&</b>')}`, one=`<i>这一个</i>${who}，${stage==='gu'?(R<pr.N/2?'gate':'up')+' 第 '+(R%(pr.N/2)+1):'第 '+(R+1)} 个数。${activation?`gate ≤ ${lim}、up 截到 ±${lim}；SiLU(gate) × up`:n+' 对乘积相加'}${pr.weighted?'，再 × 本份路由权重 '+fmt(omega):''}`;
    const form=v=>`${activation?'SiLU(':'dot('}<i class="sw row" style="background:${pr.cw}"></i>${activation?') × ':', '}<i class="sw col" style="background:${pr.cx}"></i>${activation?'':')'}${pr.weighted?` × <i class="sw ex" style="background:${onCard(look.palette.router[0])};width:10px;height:10px"></i> ${fmt(omega)}`:''} = <b>${v}</b>`;
    return {pr,n,cs,total,dimensions:false,wv:cs.map(c=>activation?gv:weight(c)),xv:cs.map(c=>activation?uv:value(pr.x,c)),wAt,xAt,
      wLine:wAt(n/2),xLine:xAt(n*.7),oAt:pickedAt(pr.O,j,R,k),
      more:pr.weighted?()=>[[dataAt(B[id(s,s.expert.weights)],j,k),onCard(look.palette.router[0])]]:null,
      sumSay:pr.weighted?`${n} 个乘积相加 = ${fmt(raw)}<br>× 路由权重 ${fmt(omega)} = <b>${fmt(total)}</b>`:activation?`SiLU(${fmt(Math.min(g,lim))}) × ${fmt(uv)} = <b>${fmt(total)}</b>`:undefined,
      rowText:activation?(_k,_phase,m)=>`SiLU(${fmt(Math.min(g,lim))}) × ${fmt(uv)}${shown(m,total)}`:null,
      fill:v=>setCard(`${pr.name} · ${who}`,whole,one,form(v),`expert:${s.n}:${stage}:${j}:${k}:${String(R).length}:${stage==='gu'&&R>=pr.N/2}`) };
  }
  function expertScene(s,bi,op,u) {
    if(op.expert==='select') {
      hideDots();camera.updateMatrixWorld();
      const k=Math.min(s.expert.k-1,Math.floor(u*s.expert.k)), e=demo.at(s.expert.indices,0,k), W=B[id(s,'W_gu')], X=B[id(s,s.expert.indices)];
      const cw=onCard(look.palette[W.comp][1]),cx=onCard(look.palette[X.comp][0]),pr={W,X,O:W,cw,cx,co:cw};
      const H=setCard(`接住第 ${s.displayNumber-1} 段：编号决定用哪一套权重`,`<i>春天</i>${Array.from({length:s.expert.k},(_,i)=>`<${i===k?'b':'span'}>#${demo.at(s.expert.indices,0,i)}</${i===k?'b':'span'}>`).join(' · ')}`,
        `<i>现在</i>第 ${k+1} 份，读取专家 #${e}。288 套权重中只用这 8 套；输入仍是春天的 4096 个数。`,
        `<i class="sw col" style="background:${cx}"></i> 编号 ${e} → <i class="sw row" style="background:${cw}"></i> 第 ${e+1} 片`,'expert:select');
      const a=weightAt(W,0,W.t.rows.n/2);a.z=slabZ(W,e);const wp=px(a),xp=px(dataAt(X,0,k));
      const spot=chooseSpot(s,bi,()=>screenBox(W),H+geo.ph+TAB,()=>[wp,xp],()=>[screenBox(W)]),{x,y}=spotAt(spot,screenBox(W),H+geo.ph+TAB);
      const tab=placeCard(x,y,H,1,towardOf([wp,xp]),[faceBox(W)]);lines(pr,wp,xp,[null,null],tab,1,1,0,0);showExpertPlane(W,e,cw);return;
    }
    if(op.phase!=='trace') { const P=sumParts(s,'expert:'+op.expert);dotScene(s,bi,P,...(op.phase==='all'?allPhase(u):[op.phase,u]));if(P.pr.W.t.deck?.kind==='expert')showExpertPlane(P.pr.W,P.pr.e,P.pr.cw);return }
    hideDots();camera.updateMatrixWorld();
    const [j,k,R]=expertIndex(s,op,u),P=expertTerms(s,op.expert,j,k,R),pr=P.pr,H=P.fill(fmt(P.total));
    const points=[px(P.wLine),px(P.xLine),px(P.oAt)],boxes=[pr.W,pr.X,pr.O];
    const spot=chooseSpot(s,bi,()=>screenBox(pr.O),H+geo.ph+TAB,()=>points,()=>boxes.map(screenBox)),{x,y}=spotAt(spot,screenBox(pr.O),H+geo.ph+TAB);
    const tab=placeCard(x,y,H,1,towardOf(points),boxes.map(faceBox));
    lines(pr,points[0],points[1],points[2],tab,1,1,1,1,P.more?P.more().map(([p,c])=>[px(p),c]):[]);
    if(pr.W.t.deck?.kind==='expert')showExpertPlane(pr.W,pr.e,pr.cw);
  }

  // Addition uses the saved, already weighted expert outputs. Read their eight
  // original slices in order, then add the shared branch at the same token/channel.
  const mergeDrop=el('dot-cell drop',''), mergeRead=el('dot-cell','');
  function mergeIndex(s,op,u) {
    const n=demo.get(s.merge[op.merge].out).shape[1],i=op.phase==='trace'?Math.min(words.length*n-1,Math.floor(u*words.length*n)):0;
    return [Math.floor(i/n),i%n];
  }
  function mergeScene(s,bi,op,u) {
    camera.updateMatrixWorld();hideDots();
    const d=s.merge[op.merge], [j,R]=mergeIndex(s,op,u), many=d.ins.length===1, K=many?demo.get(d.ins[0]).shape[1]:2;
    const W=B[id(s,d.ins[0])],X=B[id(s,d.ins.at(-1))],O=B[id(s,d.out)];
    const color=b=>onCard(look.palette[b.comp][0]),pr={W,X,O,cw:color(W),cx:color(X),co:color(O)};
    const k=op.phase==='pull'?Math.min(K-1,Math.floor(u*K)):K-1;
    const values=Array.from({length:K},(_,i)=>many?demo.at(d.ins[0],j,i,R):demo.at(d.ins[i],j,R));
    const total=demo.at(d.out,j,R), ready=['place','trace'].includes(op.phase)||op.phase==='sum'&&u>.7;
    const wAt=i=>many?pickedAt(W,j,R,i):dataAt(i===0?W:X,j,R), oAt=px(dataAt(O,j,R));
    const w=px(wAt(many?k:0)),x=many?null:px(wAt(1)),points=[oAt,w,...(x?[x]:[])],boxes=[W,X,O];
    const sw=(cls,c)=>`<i class="sw ${cls}" style="background:${c}"></i>`;
    const form=many?`Σ₈ ${sw('row',pr.cw)} = <b>${ready?fmt(total):'?'}</b>`:`共享 ${sw('col',pr.cx)} + 路由 ${sw('row',pr.cw)} = <b>${ready?fmt(total):'?'}</b>`;
    const showRows=['pull','sum'].includes(op.phase), count=op.phase==='pull'?k+1:K;
    const rows=showRows?`<table style="width:100%;margin-top:8px;border-collapse:collapse">${values.map((v,i)=>`<tr style="height:21px;opacity:${i<count?1:.3};background:${op.phase==='pull'&&i===k?'#eee7d9':'transparent'}"><td>${many?`${i+1}/8 · 专家 #${demo.at('topk_i',j,i)}`:i===0?'8 份合计':'共享专家'}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${i<count?fmt(v,5):'待取'}</td></tr>`).join('')}</table>`:'';
    const H=setCard(`${many?'8 份相加':'加上共享输出'} · ${wordOf(j)} · 第 ${R+1} 个数`,
      `<i>整块</i>${many?'[6, 8, 4096] 沿 8 份求和':'[6, 4096] + [6, 4096]'} → <b>[6, 4096]</b>`,
      `${many?'每份已经乘过路由权重；同一词、同一位置相加。':'路由合计与共享输出，同一词、同一位置相加。'}${many?`<br>连线指向第 ${k+1}/8 份 · 专家 #${demo.at('topk_i',j,k)}`:''}${rows}`,
      form,`merge:${s.n}:${op.merge}:${op.phase}:${j}:${R}:${k}`);
    const spot=chooseSpot(s,bi,()=>screenBox(O),H+geo.ph+TAB,()=>points,()=>boxes.map(screenBox));
    const pos=spotAt(spot,screenBox(O),H+geo.ph+TAB);
    let tab=placeCard(pos.x,pos.y,H,1,towardOf(points),boxes.map(faceBox),true,points);
    // Both sources are above the destination. Keep the addition between them:
    // inputs leave upward, the write arrow downward, so they cannot cross.
    const bottom=Math.max(...[...new Set([W,X])].map(screenBox).map(b=>b[3])),top=screenBox(O)[1];
    const py=Math.max(pos.y+H+TAB,(bottom+top-geo.ph)/2),px0=pos.x+CW-geo.pw;
    if(py>=bottom+12&&py+geo.ph<=top-12&&py+geo.ph<host.clientHeight-4){
      tab=[px0,py,px0+geo.pw,py+geo.ph];put(pill,[px0,py]);pill.style.transform='none';
    }
    const from=lines(pr,w,x,oAt,tab,1,1,1,op.phase==='place'?1:.5,[],true);
    if(many)showExpertPlane(W,k,pr.cw);
    if(op.phase==='pull'){
      const row=one.querySelectorAll('tr')[k].getBoundingClientRect(),v=ease((u*K-k)*1.8),a=sourcePoint(px(wAt(k)),many||k===0?lw:lx,pos.x+24),b=[row.left+row.width*.73,row.top+row.height/2];
      mergeRead.textContent=fmt(values[k],3);mergeRead.style.background=k===0||many?pr.cw:pr.cx;
      if(v<1)put(mergeRead,[a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v]);
    }
    if(op.phase==='place'&&from){mergeDrop.textContent=fmt(total);mergeDrop.style.background=pr.co;const v=ease(u*1.2);if(v<1)dropAlongArrow(mergeDrop,v,from,oAt)}
  }

  // Routing keeps the two meanings separate: biased scores select experts; unbiased scores set their weights.
  // These are views of the L04 example, never recomputed or substituted with L00 values during playback.
  function routeAt(s, phase, u) {
    const steps = phase === 'rest' ? (words.length - 1) * s.route.k : s.route.k;
    const q = Math.min(steps - 1, Math.floor(clamp(u) * steps));
    return { j: phase === 'rest' ? 1 + Math.floor(q / s.route.k) : s.dot.word, k: q % s.route.k };
  }
  const routeDrop = el('dot-cell drop', '');
  const routeRanks = new Map();
  function routeScene(s, bi, phase, u) {
    camera.updateMatrixWorld(); hideDots();
    const d = s.route, { j, k } = routeAt(s, phase, u), X = B[id(s, d.x)], W = B[id(s, d.bias)], I = B[id(s, d.indices)], O = B[id(s, d.weights)];
    const E = X.t.cols, K = d.k, key = `${s.layer}:${j}`;
    if (!routeRanks.has(key)) routeRanks.set(key, Array.from({ length: E }, (_, e) => e).sort((a, b) => demo.at('choice', j, b) - demo.at('choice', j, a) || a - b));
    const ranked = routeRanks.get(key), picks = Array.from({ length: K }, (_, n) => demo.at(d.indices, j, n));
    const sum = picks.reduce((a, e) => a + demo.at('scores', j, e), 0), e = phase === 'sigmoid' ? s.dot.R : picks[k];
    const cx = onCard(look.palette[X.comp][0]), cw = onCard(look.palette[W.comp][1]);
    const sw = (cls, c) => `<i class="sw ${cls}" style="background:${c}"></i>`;
    const table = (heads, rows) => `<div style="margin-left:-44px;text-indent:0;margin-top:8px"><table style="width:100%;border-collapse:collapse;font:11px/1.7 ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums"><thead><tr>${heads.map(h => `<th style="text-align:right;font-weight:500">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(({ cells, active, dim }) => `<tr style="background:${active ? cx + '30' : 'transparent'};opacity:${dim ? '.5' : '1'}">${cells.map(v => `<td style="text-align:right;white-space:nowrap">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    let body, form, name;
    if (phase === 'sigmoid') {
      const z = demo.at('logits', j, e), sc = demo.at('scores', j, e);
      name = `${wordOf(j)} · 专家 #${e} · 分数过 sigmoid`;
      body = `<i>这一个</i>logit = ${fmt(z, 4)}<br>s = 1 / (1 + exp(−logit)) = <b>${fmt(sc, 4)}</b><br>288 个分数各自变换；不是 softmax，不要求它们的和为 1。`;
    } else if (phase === 'choose') {
      name = `${wordOf(j)} · 按加偏置的分数挑 ${K} 个`;
      body = `<i>选择</i>s + 偏置，从高到低看前 ${K + 1} 名；第 ${K + 1} 名不入选。`
        + table(['专家', 's', '偏置', '选择分', ''], ranked.slice(0, K + 1).map((e, n) => ({ active: n === k, dim: n === K, cells: [`#${e}`, fmt(demo.at('scores', j, e), 4), fmt(demo.weight(d.bias, e), 4), fmt(demo.at('choice', j, e), 4), n <= k ? '✓' : n === K ? '未选' : ''] })));
    } else {
      name = `${wordOf(j)} · ${phase === 'place' || phase === 'rest' ? `放回第 ${k + 1} 个权重` : '用未加偏置的分数算权重'}`;
      body = `<i>权重</i>这 ${K} 个原始 s 的和 = <b>${fmt(sum, 4)}</b><br>每个 s ÷ ${fmt(sum, 4)} × ${d.scale}。偏置不参与。`
        + table(['专家', '原始 s', '÷ 和', `× ${d.scale}`], picks.map((e, n) => ({ active: n === k, cells: [`#${e}`, fmt(demo.at('scores', j, e), 4), fmt(demo.at('scores', j, e) / sum, 4), fmt(demo.at(d.weights, j, n), 4)] })))
        + `<div style="margin-top:5px;text-indent:0">${K} 个合并权重的和 = ${d.scale}；编号和权重一一配对。</div>`;
    }
    // One connector row per source/result, in the same vertical order as the model.
    // The formula sits below the table, with all lines leaving its right edge toward the model.
    const grid = rows => `<div style="display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center">${rows.join('')}</div>`;
    const source = `<span>s = ${fmt(demo.at('scores', j, e), 4)}</span>${sw('col', cx)}`;
    const putting = phase === 'choose' || phase === 'place' || phase === 'rest';
    form = phase === 'sigmoid' ? grid([`<span>sigmoid(logit) = ${fmt(demo.at('scores', j, e), 4)}</span>${sw('col', cx)}`])
      : phase === 'choose' ? grid([source, `<span>偏置 = ${fmt(demo.weight(d.bias, e), 4)}</span>${sw('row', cw)}`, `<b>s + 偏置 → top ${K} → #${e}</b>${sw('ex', cx)}`])
      : grid([source, `<b>s ÷ Σ选中 s × ${d.scale} = ${fmt(demo.at(d.weights, j, k), 4)}</b>${sw('ex', cx)}`]);
    const h = setCard(name, `<i>整块</i>[${words.length}, ${E}] → 编号、权重各 [${words.length}, ${K}]`, body, form, `route:${phase}:${j}:${CW}`);
    const output = phase === 'choose' ? I : O, pos = px(dataAt(output, j, k));
    const xp = px(dataAt(X, j, e)), wp = px(V(along(W, e, E, 'x'), W.y1, W.z1));
    const left = Math.min(...[X, W, I, O].map(b => screenBox(b)[0]));
    const x = Math.max(EDGE, left - CW - 60), y = Math.max(EDGE, Math.min(host.clientHeight * .1, host.clientHeight - h - geo.ph - TAB - EDGE));
    put(card, [x, y], 1); card.style.transform = 'none'; card.style.height = h + 'px';
    const tx = x + CW - geo.pw, ty = y + h + TAB;
    put(pill, [tx, ty], 1); pill.style.transform = 'none';
    const port = sw => [tx + sw[0] + 8, ty + sw[1]];
    const connect = (line, a, b) => {
      const exit = [Math.max(a[0], x + CW + 14), a[1]];
      curve(line, exit, b, 1, 'h');
      line.setAttribute('d', `M${a[0]} ${a[1]} L${exit[0]} ${exit[1]} ` + line.getAttribute('d').replace(/^M[^C]+/, ''));
    };
    lx.style.stroke = deep(cx); lw.style.stroke = deep(cw);
    if (inPic(xp)) connect(lx, port(geo.col), xp);
    if (phase === 'choose' && inPic(wp)) connect(lw, port(geo.row), wp);
    const start = geo.ex[0] ? port(geo.ex[0]) : null;
    if (putting && start && inPic(pos)) { connect(lo, start, pos); markTarget(pos, cx) }
    if (phase === 'place' || phase === 'rest') {
      const steps = K * (phase === 'rest' ? words.length - 1 : 1), v = ease((u * steps) % 1);
      routeDrop.style.background = cx; routeDrop.style.borderColor = deep(cx);
      if (start && v < .98) dropAlongArrow(routeDrop,v,start,pos);
    }
  }

  // Same cards and connector routing for the chapter endpoints and MLA formulas.
  // Resolve a flat numerical index to the tensor's actual token/head/channel axes.
  function lessonPoint(s,ref){
    const name=ref.id==='last_residual'?'L44:residual_out':ref.id;
    const b=B[id(s,name)],shape=ref.weight?demo.W.tensors[ref.id].shape:demo.get(ref.id).shape;
    const p=lessonPosition(b,ref.index,shape,ref.weight,B);
    return {point:px(V(p.x,p.y,p.z)),b,omitted:p.omitted,candidate:p.candidate};
  }

  const lessonCache=new Map(),lessonDrop=el('dot-cell drop',''),sentence=el('lesson-sentence','');
  function lessonScene(s,bi,op,u){
    camera.updateMatrixWorld();hideDots();
    const st=op.lesson,O=demo.get(st.writes[0]),N=O.a.length;
    // Trace representative positions in order while the entire tensor fills.
    const index=op.phase==='trace'?lessonProgress(B[id(s,st.writes[0])],O.shape,Math.min(.999999,Math.floor(u*48)/48)).index:op.sample;
    const key=`${s.n}:${st.id}:${index}`;
    if(!lessonCache.has(key))lessonCache.set(key,explain(demo,st,index));
    const e=lessonCache.get(key),ready=op.phase!=='pull',picked=e.terms.filter(t=>t.a),term=picked.length?picked[Math.min(picked.length-1,Math.floor(u*picked.length))]:null;
    const pool=st.id==='idx_pool',poolTerm=pool?e.terms[Math.min(3,Math.floor(u*4))]:null;
    const refs=(pool?[poolTerm.cg,poolTerm.ape,poolTerm.key]:op.phase==='pull'&&term?[term.a,term.b]:e.sources).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).slice(0,pool?3:2);
    const points=refs.map(r=>lessonPoint(s,r)),target=lessonPoint(s,{id:st.writes[0],index,weight:false});
    const color=b=>onCard(look.palette[b.comp][b.t.kind==='weight'?1:0]);
    const W=points[0]?.b||target.b,X=points[1]?.b||W,pr={W,X,O:target.b,cw:color(W),cx:color(X),co:color(target.b)};
    const value=v=>Math.abs(v)>1e30?'不可见':Math.abs(v)<.0001&&v!==0?v.toExponential(3):fmt(v,4);
    const rows=op.phase==='pull'?e.terms.map(t=>pool?`<div>词 ${t.c+1}：cg ${value(t.cg.value)} + ape ${value(t.ape.value)}<br>α ${value(t.alpha)} × K ${value(t.key.value)} = ${value(t.value)}</div>`:t.a?`<div>${t.c+1}：${value(t.a.value)} × ${value(t.b.value)} = ${value(t.product)}</div>`:`<div>第 ${t.c+1} 项：${value(t.value)}</div>`).join(''):'';
    const sw=(cls,c)=>`<i class="sw ${cls}" style="background:${c}"></i>`;
    const form=`<div class="stk"><div>${refs[0]?.id||st.writes[0]} ${sw('row',pr.cw)}</div>${refs[1]?`<div>${refs[1].id} ${sw('col',pr.cx)}</div>`:''}${pool?`<div>ik ${sw('ex',color(points[2].b))}</div>`:''}<div><b>${ready?value(e.result):'取数中…'}</b></div></div>`;
    const per=O.shape.slice(1).reduce((a,b)=>a*b,1),j=Math.floor(index/per),r=index%per;
    const location=st.writes[0]==='attn_w'?`第 ${Math.floor(index/36)+1} 头 · 查询 ${Math.floor(index%36/6)+1} → 键 ${index%6+1}`:O.shape[0]===6?`${wordOf(j)}${O.shape.length===3?` · 第 ${Math.floor(r/O.shape[2])+1} ${target.b.t.deck?.kind==='head'?'头':target.b.t.deck?.kind==='pick'?'份':'路'}`:''} · 第 ${r%O.shape.at(-1)+1} 个数`:`位置 ${index+1} / ${N}`;
    const h=setCard(`${st.title} · ${location}`,
      `<i>输入 → 输出</i>${st.reads.map(x=>{const d=x==='L44:residual_out'?'last_residual':x;return '['+demo.get(d).shape.join(',')+']'}).join(' + ')} → [${O.shape.join(',')}]`,
      `<b style="white-space:normal;overflow-wrap:anywhere">${e.formula}</b><br>${e.detail}${rows}${e.total>e.terms.length&&op.phase==='pull'?`<div>共 ${e.total} 项；中间 ${e.total-e.terms.length} 项省略显示，仍参加计算。</div>`:''}`,
      form,`lesson:${key}:${op.phase}:${term?.c}`);
    const pts=[target.point,...points.map(p=>p.point)],boxes=pool?[...points.map(p=>p.b),target.b]:[W,X,target.b];
    // chooseSpot temporarily moves to the beat's final camera: project sources there,
    // rather than reusing screen coordinates from the incoming camera transition.
    const sampled=pool?e.sources:op.phase==='pull'&&picked.length?picked.flatMap(t=>[t.a,t.b]):refs;
    const pins=()=>[lessonPoint(s,{id:st.writes[0],index,weight:false}).point,...sampled.map(r=>lessonPoint(s,r).point)];
    const spot=chooseSpot(s,bi,()=>screenBox(target.b),h+geo.ph+TAB,pins,()=>boxes.map(screenBox),null,h),pos=spotAt(spot,screenBox(target.b),h+geo.ph+TAB);
    const names=segLabels.get(s.n).filter(el=>!el.classList.contains('off')&&el.style.display!=='none').map(el=>{const r=el.getBoundingClientRect();return[r.left,r.top,r.right,r.bottom]});
    const tab=placeCard(pos.x,pos.y,h,1,towardOf(pts),boxes.map(faceBox),true,pts,names);
    const from=lines(pr,points[0]?.point||null,points[1]?.point||null,target.point,tab,1,1,1,ready?1:.5,pool?[[points[2].point,color(points[2].b),points[2].b.t.name]]:[],true);
    points.forEach((p,k)=>{if(p.omitted){const e=sourcePorts[5+k];e.textContent=`${refs[k].id} #${p.candidate} · 省略区`;put(e,[p.point[0],Math.max(14,p.point[1]-16)])}});
    markTarget(target.point,pr.co);
    if(target.omitted){targetName.textContent=`省略位置 · #${Math.floor(index/(st.id==='head'?1:1))}`;targetName.dataset.omitted='true'}else{targetName.textContent='写入位置';delete targetName.dataset.omitted}
    if(op.phase==='pull'&&term){const q=sourcePoint(points[0].point,lw,pos.x+20),v=ease((u*picked.length)%1);lessonDrop.textContent=value(term.a.value);lessonDrop.style.background=pr.cw;put(lessonDrop,[q[0]+(pos.x+CW/2-q[0])*v,q[1]+(pos.y+h-20-q[1])*v])}
    if(op.phase==='place'&&from){lessonDrop.textContent=value(e.result);lessonDrop.style.background=pr.co;dropAlongArrow(lessonDrop,ease(u),from,target.point)}
  }
  function transitScene(op,u=1){
    hideDots();
    const l=op.transit,record=initialDemo.chain.layers[l],steps=M.layers[l].steps,st=steps[Math.min(steps.length-1,Math.floor(u*steps.length))];
    if(!record||record.layer!==l)throw Error('Missing layer boundary '+l);
    sentence.style.cssText='display:block;position:absolute;transform:none;left:12px;right:12px;top:12px;padding:10px;background:#fffdf8;border:1px solid #b9b2a3;border-radius:10px;font-size:13px;line-height:1.8;z-index:9';
    sentence.innerHTML=`<b>${lid(l)} · 连续计算</b>　春天 / 第一路 / 第一个数<br>输入 ${fmt(record.inputSample,4)} → 本层输出 ${fmt(record.outputSample,4)}<br>${u>=1?'本层已完成':st.title}<br>输入接 ${lid(l-1)} 输出；本层输出${l===44?'交给最终归一化':'直接交给 '+lid(l+1)}。`;
    incomingPort.innerHTML=`${lid(l-1)} 输出 → ${lid(l)} 四路输入<br><b>[6, 4, 4096] · 来源入口</b>`;
    const port=[96,sentence.getBoundingClientRect().bottom+28],entry=px(dataAt(B[lid(l)+':x_attn'],0,0));
    put(incomingPort,port);lw.style.stroke='#b7a7c3';if(inPic(entry))curve(lw,[port[0]+74,port[1]],entry,1,'h');
    const target=B[lid(l)+':residual_out'];markTarget(px(dataAt(target,0,0)),'#d3cebb');targetName.textContent='写入位置';
  }
  function sequenceScene(s,op,u){
    hideDots();sentence.style.cssText='display:block;position:absolute;transform:none;left:12px;right:12px;top:12px;padding:12px;background:#fffdf8;border:1px solid #b9b2a3;border-radius:10px;font-size:13px;line-height:1.8;z-index:9';
    const ids=initialDemo.ids,next=initialDemo.ends.at('next_id',0),ws=words.map((w,j)=>`<span style="display:inline-block;padding:4px 6px;${op.token===j?'background:#decbe4':''}">${w}<br><small>${ids[j]}</small></span>`).join('');
    sentence.innerHTML=op.last?'只取最后一个位置：<b>开了 · 4096 个数</b>，已有上下文进入这个位置。':ws+(op.append||op.cycle?`<span class="appended-token" style="display:inline-block;padding:4px 6px;background:#e5d8bd;opacity:${op.append&&u<.85?.25:1}">新 token<br><small>${next}</small></span><br>长度 ${op.append&&u<.85?'6 → 7':'7'}；教学示例 ID，非模型真实预测。`:'<br>官方 tokenizer 编号；词卡与下方编号位置一一对应。');
    if(op.append){const rect=sentence.querySelector('.appended-token').getBoundingClientRect(),dest=[rect.left+rect.width/2,rect.top+rect.height/2],start=[host.clientWidth-62,host.clientHeight-50];incomingPort.innerHTML=`来自输出端<br>ID ${next}`;put(incomingPort,start);curve(lo,start,dest,1,'v');lessonDrop.textContent=String(next);lessonDrop.style.background='#E5D8BD';dropAlongArrow(lessonDrop,ease(u/.85),start,dest)}
    if(op.token!==undefined){markTarget(px(dataAt(B.ids,op.token,0)),'#E5D8BD');targetName.textContent='写入位置'}
    if(op.last){markTarget(px(dataAt(B.h_final,5,0)),'#d3cebb');targetName.textContent='读取位置'}
    if(op.cycle)sentence.innerHTML+=`<br><b>快进一轮 · 结构回顾 ${Math.min(5,Math.floor(u*5)+1)}/5</b>：${['新编号','查词表','45 层依次处理','输出头打分','再次选词'][Math.min(4,Math.floor(u*5))]}`;
  }

  // ---- the state at time t of segment s (t ≥ its length: the segment at rest, done)
  let lastLit = new Set(), word = -1, dotNow = null, later = null;
  function apply(s, t, cam = true) {
    demo = s.global ? initialDemo.ends : s.layer===0 ? initialDemo : initialDemo.layers?.[s.layer];
    if(!demo)throw Error('Missing numerical data for '+lid(s.layer));
    sentence.style.display='none';targetName.textContent='写入位置';
    CW = host.clientWidth < 700 && (s.n>=20||s.lessonData||COMPACT_OLD.has(s.n)) ? 300 : 360;
    word = -1; dotNow = null;
    const dur = durationOf(s), done = t >= dur;
    for (const m of look.meshes) { const u = m.material.uniforms; u.uGrow.value.set(1e9, 1); u.uFrontAxis.value = 0; u.uF0.value.set(1e9, 1e9, 1e9); u.uF1.value.set(-1e9, -1e9, -1e9); u.uDim.value = FADE }
    const lit = new Set(), part = new Map();
    const light = (bid, box) => { if (!look.byId.has(bid)) return; if (box) { if (!lit.has(bid)) part.set(bid, box) } else { lit.add(bid); part.delete(bid) } };
    if (!done) for (const o of OUTS.get(s.n)) look.grow(o, 0, 0);
    let acc = 0, bi = 0;
    for (const [i, beat] of s.beats.entries()) {
      if (t < acc && !done) break;
      const u = done ? 1 : clamp((t - acc) / beat.dur), now = !done && t >= acc && t < acc + beat.dur;
      if (now) bi = i;
      run(s, beat, u, done ? bid => light(bid) : now ? light : () => {}, done);
      const sum = beat.op.dot || beat.op.mix || beat.op.conv || beat.op.write || beat.op.coef || beat.op.fg || beat.op.beta;
      if (now && sum) dotNow = () => dotScene(s, i, sumParts(beat.dot ? {...s,dot:beat.dot} : s, beat.op.dot ? 'dot' : beat.op.mix ? 'mix' : beat.op.conv ? 'conv' : beat.op.write ? 'write' : beat.op.coef ? 'coef' : beat.op.fg ? 'fg' : 'beta'), ...(sum === 'all' ? allPhase(u) : [sum, u]));
      if (now && beat.op.kda) dotNow = () => { const [kind, ph, v] = kdaPhase(beat.op.kda, u); dotScene(s, i, sumParts(s, kind), ph, v) };
      if (now && beat.op.gn) dotNow = () => gnScene(s, i, beat.op.gn, u);
      if (now && beat.op.ew) dotNow = () => pairScene(s, i, ewPairs(s), ...(beat.op.ew === 'all' ? ewAll(u) : [beat.op.ew, u]));
      if (now && beat.op.norm) dotNow = () => normScene(s, i, ...(beat.op.norm === 'all' ? normAll(u) : [beat.op.norm, u]));
      if (now && beat.op.trace) dotNow = () => traceScene(s, i, beat.op, u, !s.beats[i + 1]?.op.trace);
      if (now && beat.op.route) dotNow = () => routeScene(s, i, beat.op.route, u);
      if (now && beat.op.expert) dotNow = () => expertScene(s,i,beat.op,u);
      if (now && beat.op.merge) dotNow = () => mergeScene(s,i,beat.op,u);
      if (now && beat.op.lesson) dotNow = () => lessonScene(s,i,beat.op,u);
      if (now && (beat.op.token!==undefined||beat.op.last||beat.op.append||beat.op.cycle)) dotNow=()=>sequenceScene(s,beat.op,u);
      if (now && beat.op.transit!==undefined) dotNow=()=>transitScene(beat.op,u);
      if (now && beat.op.shape) dotNow = () => { hideDots(); later = () => dims(dotParts(s).pr, 1) };
      acc += beat.dur;
    }
    // what the segment has computed so far stays lit
    // (unless the beat in hand reads only a part of it: then that part is what shows)
    if (!done) for (const o of OUTS.get(s.n)) { const u = look.byId.get(o)?.material.uniforms.uGrow.value; if (u && (u.x > 0 || u.y > 0) && !part.has(o)) light(o) }
    for (const bid of lit) look.dimOne(bid, 0);
    for (const [bid, box] of part) look.focus(bid, box, 0);
    lastParts = done ? 0 : part.size;
    const on = new Set([...lit, ...part.keys()]);
    for (const a of ARROWS) { a.m.material.color.copy(a.base); if (!(on.has(a.from) && on.has(a.to))) a.m.material.color.lerp(PAGE_COLOR, FADE) }
    lastLit = on;
    if (cam && follow) camAt(s, done ? dur : t);
    if(done&&s.beats.at(-1).op.transit!==undefined)dotNow=()=>transitScene(s.beats.at(-1).op);
    if(done&&[3,35,38].includes(s.n))dotNow=()=>sequenceScene(s,s.beats.at(-1).op,1);
    if (s.focusLabels) { const beat=s.beats[done?s.beats.length-1:bi],pose=s.poses[beat.cam],ids=beat.op.lesson?[...beat.op.lesson.writes,...pose.ids.filter(id=>beat.op.lesson.reads.includes(id))]:[...pose.ids,...(pose.labels||[]),...(s.lessonData?beat.op.show||[]:[])]; segLabels.get(s.n).forEach((el,i)=>el.classList.toggle('off',!ids.includes(s.labels[i]?.id))) }
    later = null; if (dotNow) dotNow(); else { hideDots(); if (s.incoming?.length && !done) incomingPoint() }
    frame(); marks(); if (later) later(); placeTargetName();
    return done ? s.beats.length - 1 : bi;
  }
  const PAGE_COLOR = new THREE.Color(getComputedStyle(document.body).backgroundColor);
  // the camera: each beat's pose, reached over the first CAM_T seconds of the beat (from where it stood when the
  // segment began, for the first beat)
  let entry = null;
  function camAt(s, t) {
    let acc = 0, prev = entry;
    for (const beat of s.beats) {
      const P = POSE.get(s.n + ':' + beat.cam);
      if (t < acc + beat.dur || beat === s.beats.at(-1)) { if (!prev) return blend(P, P, 1); return blend(prev, P, (t - acc) / (beat.camT || CAM_T)) }   // (camT: a longer way, taken slower)
      prev = P; acc += beat.dur;
    }
  }

  // ---- the clock
  let t = 0, playing = false, speed = 1, follow = true, last = 0, goAnim = null;
  const post = m => parent !== window && parent.postMessage(m, location.origin);
  const tick = () => { if (!cur) return; const dur = durationOf(cur); post({ ev: 'tick', n: cur.n, t: Math.min(t, dur), dur, beat: apply(cur, t, !goAnim), playing }) };
  function loop(now) {
    if (goAnim) { const u = (now - goAnim.t0) / 1000 / GO_T; blend(goAnim.from, goAnim.to, u); frame(); if (u >= 1) goAnim = null }
    if (playing) {
      t += (now - last) / 1000 * speed; last = now;
      const dur = durationOf(cur); if (t >= dur) { t = dur; playing = false; tick(); post({ ev: 'end', n: cur.n }) } else tick();
    }
    if (playing || goAnim) requestAnimationFrame(loop);
  }
  const kick = () => { last = performance.now(); requestAnimationFrame(loop) };
  // the reader turns the camera: it stops following until the next segment
  controls.addEventListener('start', () => { if (playing || goAnim) { follow = false; goAnim = null; post({ ev: 'follow', on: false }) } });
  function go(n) {
    const s = SEGMENTS.find(x => x.n === n); if (!s) return;
    // (entry: a jump into it afterwards starts from its own first pose — 09-29: `entry` was kept from the first segment
    // ever sought, so a first beat sought flew in from wherever that was)
    cur = s; t = durationOf(s); playing = false; follow = true; showLabels(n); entry = null;
    const to = POSE.get(s.n + ':' + s.beats.at(-1).cam); goAnim = { from: snap(), to, t0: performance.now() };
    apply(s, t, false); tick(); kick();
  }
  function play(n) {
    if (!cur || cur.n !== n) { go(n); goAnim = null }
    if (t >= durationOf(cur)) t = 0;
    entry = snap(); follow = true; playing = true; post({ ev: 'follow', on: true }); kick();
  }
  window.addEventListener('message', e => {
    if (e.origin !== location.origin) return; const m = e.data || {};
    if (m.cmd === 'go') go(m.n);
    else if (m.cmd === 'play') play(m.n);
    else if (m.cmd === 'pause') { playing = false; tick() }
    // (a jump into another segment starts it from its own first pose — 09-29: `entry` was kept from the first segment
    // ever sought, so its first beat flew in from wherever that was)
    else if (m.cmd === 'seek') { if (!cur || cur.n !== m.n) go(m.n); goAnim = null; playing = false; entry = entry || POSE.get(cur.n + ':' + cur.beats[0].cam); t = m.t; tick() }
    else if (m.cmd === 'speed') speed = m.v;
    else if (m.cmd === 'follow') { follow = m.on; if (follow && cur) tick() }
    else if (m.cmd === 'whole') { cur = null; playing = false; showLabels(-1); for (const x of look.meshes) { look.grow(x.userData.block.id, null); look.focus(x.userData.block.id, null); look.dimOne(x.userData.block.id, 0) } for (const a of ARROWS) a.m.material.color.copy(a.base); goAnim = { from: snap(), to: start, t0: performance.now() }; frame(); kick() }
  });
  post({ ev: 'ready', segs: Object.fromEntries(SEGMENTS.map(s => [s.n, durationOf(s)])) });
  let lastParts = 0;
  return { go, play, apply, POSE, parts: () => lastParts };
}
