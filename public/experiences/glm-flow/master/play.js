// The player: plays the 40 segments of segments.js on the whole model of model.html (?embed=1), commanded by
// chapter.html through postMessage. State is a pure function of (seg, t): apply(seg, t) deterministically derives
// block uniforms, batched arrow dimming, camera pose, and computation lens overlays with zero per-frame layout thrashing.
import * as THREE from 'three';
import { SEGMENTS, durationOf } from './segments.js';
import { ACCENTS, PAGE } from './flow-colors.js';
import { lid } from './model-spec.js';
import { explain } from './lesson-data.js';
import { lessonPosition, lessonProgress } from './lesson-position.js';

const FADE = .78, OVERVIEW_FADE = .30, CAM_T = 1.4, GO_T = 1.05;
const clamp = v => Math.max(0, Math.min(1, v)), smooth = v => { v = clamp(v); return v * v * (3 - 2 * v) };

export function attachPlayer({ look, B, WB, M, ARROWS, arrowBatch, ELIDED_GAPS, camera, controls, fit, place, hideUnderUI, labels: viewLabels, frame, label, V, host, words, wordIds, demo: initialDemo, setAfterRender, setOnResize }) {
  let demo = initialDemo;
  let cur = null;
  let stageW = host.clientWidth || 800, stageH = host.clientHeight || 600, hostLeft = 0, hostTop = 0;
  const syncHostMetrics = () => {
    stageW = host.clientWidth || stageW;
    stageH = host.clientHeight || stageH;
    const hr = host.getBoundingClientRect();
    hostLeft = hr.left; hostTop = hr.top;
  };
  syncHostMetrics();

  const IDS = wordIds || [105087, 100325, 3837, 121267, 98401, 103349];
  const entryByEl = new Map((viewLabels || []).map(l => [l.el, l]));
  const regLabel = (html, p, cls = 'c', nudge = false) => {
    const e = label(html, p, cls, nudge);
    if (viewLabels?.length) entryByEl.set(e, viewLabels.at(-1));
    return e;
  };
  const rectOfLabel = e => {
    const ent = entryByEl.get(e);
    if (ent) return ent.vis ? ent.rect : null;
    if (e.style.display === 'none') return null;
    const r = e.getBoundingClientRect();
    return r.width > 0 ? { left: r.left - hostLeft, right: r.right - hostLeft, top: r.top - hostTop, bottom: r.bottom - hostTop } : null;
  };

  const id = (s, x) => { if (s.global) return B[x] ? x : M.alias[x] || x; const k = lid(s.layer) + ':' + x; return B[k] ? k : M.alias[k] || k };
  const layerOf = s => M.layers[s.layer];

  // ---- camera poses (computed lazily per segment on first visit; cached until viewport resize)
  const snap = () => ({ p: camera.position.clone(), t: controls.target.clone() });
  const boxOf = (bs, pad = 0, zDepth = null) => ({
    x0: Math.min(...bs.map(b => b.x0)) - pad, x1: Math.max(...bs.map(b => b.x1)) + pad,
    y0: Math.min(...bs.map(b => b.y0)) - pad, y1: Math.max(...bs.map(b => b.y1)) + pad,
    z0: zDepth ? -zDepth : Math.min(...bs.map(b => b.z0)), z1: 0,
  });
  const start = snap(), rawPose = new Map(), fittedSegs = new Set();
  const d0 = new THREE.Vector3(), d1 = new THREE.Vector3();
  function blend(A, C, u) {
    u = smooth(u);
    const tg = A.t.clone().lerp(C.t, u);
    d0.subVectors(A.p, A.t); d1.subVectors(C.p, C.t);
    const da = d0.length(), db = d1.length(), dir = d0.normalize().lerp(d1.normalize(), u).normalize();
    camera.position.copy(tg).addScaledVector(dir, Math.exp(Math.log(da) + (Math.log(db) - Math.log(da)) * u));
    controls.target.copy(tg); camera.lookAt(tg);
  }

  // ---- segment names & word column headers
  const segLabels = new Map(), WORDLS = new Map(), COMPACT_OLD = new Set([9, 10, 13, 14, 16, 17, 18]);
  const atAnchor = (b, where, leftBound = b) => {
    const fullX0 = b.elided && B[b.id + '/0'] ? B[b.id + '/0'].x0 : leftBound.x0;
    return ({
      r: [V(b.x1 + 1.8, (b.y0 + b.y1) / 2, b.z0), 'r'],
      l: [V(fullX0 - 1.8, (b.y0 + b.y1) / 2, 0), 'rr'],
      tl: [V(fullX0, b.y1 + 1.8, b.z0), 'tl'],
      tr: [V(b.x1, b.y1 + 1.8, b.z0), 'tr'],
      t: [V((fullX0 + b.x1) / 2, b.y1 + 2.4, b.z0), 't'],
      b: [V((fullX0 + b.x1) / 2, b.y0 - 4.2, 0), 'b'],
    })[where];
  };

  function syncCompactLabelStyles() {
    const narrow = stageW < 700;
    for (const s of SEGMENTS) {
      if (!(s.lessonData || COMPACT_OLD.has(s.n))) continue;
      for (const e of segLabels.get(s.n) || []) {
        if (e.classList.contains('word')) continue;
        e.style.maxWidth = narrow ? '140px' : '';
        e.style.whiteSpace = narrow ? 'normal' : '';
      }
    }
  }

  for (const s of SEGMENTS) {
    const els = [];
    for (const l of s.labels || []) {
      const blk = B[id(s, l.id)], fnSpan = l.at === 'l' && /^fn_(attn|ffn)$/.test(l.id);
      const lb = fnSpan ? (B[id(s, l.id.replace('fn_', 'base_'))] || blk) : blk;
      const [p, cls] = fnSpan
        ? [V(lb.x0, blk.y1 + 2.2, blk.z0), 'tl']
        : l.id === 'o_normed' && l.at === 'r'
          ? [V(blk.x1 + 9.6, (blk.y0 + blk.y1) / 2, blk.z0), 'r']
          : l.id === 'topk_i' && l.at === 'r'
            ? [V(blk.x1 + 1.8, blk.y0 - 2.2, blk.z0), 'r']
            : atAnchor(blk, l.at, lb);
      els.push(regLabel(l.html, p, cls + ' seg', true));
    }
    if (s.words) {
      const b = B[id(s, s.words)], w = (b.x1 - b.x0) / words.length;
      const ws = words.map((wd, k) => regLabel(wd, V(b.x0 + (k + .5) * w, b.y1 + (s.n === 3 || s.words === 'ids' ? 2.6 : 1.18), 0), 't seg word'));
      els.push(...ws);
      WORDLS.set(s.n, { b, ws });
    }
    for (const e of els) e.classList.add('off');
    segLabels.set(s.n, els);
  }
  syncCompactLabelStyles();

  const microStage = () => stageW < 500 && stageH < 380;
  const cutRect = r => r && (r.left < 4 || r.top < 4 || r.right > stageW - 4 || r.bottom > stageH - 4);
  function clip() {
    if (!cur) return;
    for (const e of segLabels.get(cur.n)) {
      const ent = entryByEl.get(e);
      if (ent?.vis && cutRect(ent.rect)) { e.style.display = 'none'; ent.vis = false }
    }
  }
  const _mA = new THREE.Vector3(), _mC = new THREE.Vector3();
  function syncWordClasses() {
    const m = cur && WORDLS.get(cur.n);
    if (!m) return;
    // Segment 3 draws its own rich word + token-ID badges above B.ids
    if (cur.n === 3) { m.ws.forEach(e => e.classList.add('narrow')); return }
    const { b, ws } = m;
    _mA.set(b.x0, b.y1, 0).project(camera);
    _mC.set(b.x1, b.y1, 0).project(camera);
    const colPx = Math.abs(_mC.x - _mA.x) / 2 * stageW / words.length;
    const micro = microStage();
    ws.forEach((e, k) => {
      const isNow = k === word;
      const hide = micro ? (!isNow || colPx < 10) : colPx < 14;
      e.classList.toggle('now', isNow);
      e.classList.toggle('stag', !hide && !micro && colPx < 21 && k % 2 === 1);
      e.classList.toggle('compact', !hide && colPx < 29 && (micro || colPx >= 21 || k % 2 === 0));
      e.classList.toggle('narrow', hide);
    });
  }
  function marks() {
    syncWordClasses();
    place();
    clip();
  }

  let shownSegN = -1;
  const showLabels = n => {
    host.classList.toggle('inseg', n > 0);
    if (shownSegN === n) return;
    if (shownSegN > 0 && segLabels.has(shownSegN)) for (const e of segLabels.get(shownSegN)) e.classList.add('off');
    if (n > 0 && segLabels.has(n)) for (const e of segLabels.get(n)) e.classList.remove('off');
    shownSegN = n;
  };

  function ensurePoses(s) {
    if (fittedSegs.has(s.n)) return;
    fittedSegs.add(s.n);
    const keepCam = snap(), prevShown = shownSegN;
    const wasFar = host.classList.contains('far'), wasUltra = host.classList.contains('ultrafar');
    host.classList.remove('far', 'ultrafar');
    showLabels(s.n);
    // Ensure segment's own labels are un-off during pose measurement
    for (const e of segLabels.get(s.n)) e.classList.remove('off');
    for (const [name, p] of Object.entries(s.poses)) {
      const selected = p.all ? WB.filter(b => b.layer === s.layer) : p.allLayer !== undefined ? WB.filter(b => b.layer === p.allLayer) : p.ids.map(x => B[id(s, x)]);
      const bs = selected.flatMap(b => b.elided && B[b.id + '/0'] ? [B[b.id + '/0'], b] : [b]);
      const bx = boxOf(bs, p.pad || 0, p.z);
      if (p.top) bx.y1 = B[id(s, p.top[0])].y0 + p.top[1];
      if (p.band) { const b = B[id(s, p.band[0])], h = b.y1 - b.y0; bx.y0 = b.y0 + p.band[1] * h; bx.y1 = b.y0 + p.band[2] * h }
      const micro = microStage();
      const narrowCard = !micro && stageW < 700 && COMPACT_OLD.has(s.n);
      const m = micro ? Math.min(.92, p.margin || .92) : p.margin || (p.sideCard || narrowCard ? .95 : .86);
      const shift = micro && !p.all && p.allLayer === undefined
        ? [0, -.26]
        : p.topReserve
          ? [0, -Math.min(.62, p.topReserve / stageH)]
          : narrowCard
            ? p.narrowShift || [.5, p.shift?.[1] || 0]
            : p.sideCard && stageW < 700
              ? p.narrowShift || [.5, 0]
              : p.shift || [0, 0];
      const sh = [...shift];
      let zoom = 1;
      const poseLabels = segLabels.get(s.n).filter((e, i) => {
        if (e.classList.contains('word')) return false;
        const lid0 = s.labels?.[i]?.id;
        if (p.poseShowLabels) return p.poseShowLabels.includes(lid0);
        return p.all || p.allLayer !== undefined || p.ids?.includes(lid0) || p.labels?.includes(lid0);
      });
      for (let k = 0; k < 16; k++) {
        fit(bx, V(...p.dir), m, sh, true, zoom);
        place();
        if (!poseLabels.some(e => cutRect(rectOfLabel(e))) || zoom <= .64) break;
        zoom = Math.max(.64, zoom * .93);
        if (Math.abs(sh[0]) > .12) sh[0] *= .9;
      }
      rawPose.set(s.n + ':' + name, snap());
    }
    if (wasFar) host.classList.add('far');
    if (wasUltra) host.classList.add('ultrafar');
    showLabels(prevShown);
    camera.position.copy(keepCam.p); controls.target.copy(keepCam.t); camera.lookAt(keepCam.t); controls.update();
  }

  const getPose = (s, name) => { ensurePoses(s); return rawPose.get(s.n + ':' + name) };
  const POSE = new Proxy(rawPose, {
    get(target, prop) {
      if (prop === 'get') return key => {
        if (!target.has(key) && typeof key === 'string') {
          const n = +key.split(':')[0], s = SEGMENTS.find(x => x.n === n);
          if (s) ensurePoses(s);
        }
        return target.get(key);
      };
      const val = Reflect.get(target, prop);
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  // ---- dirty-tracked uniform wrappers (touch ~15 blocks per frame instead of all 3,004 meshes)
  let allFaded = false, curBaseFade = FADE;
  const dirtyBlocks = new Set();
  const markDirty = bid => { if (look.byId.has(bid)) dirtyBlocks.add(bid) };
  const resetDirtyBlocks = baseFade => {
    if (!allFaded || Math.abs(baseFade - curBaseFade) > 1e-4) {
      if (look.resetAll) look.resetAll(baseFade);
      else for (const m of look.meshes) {
        const u = m.material.uniforms;
        u.uGrow.value.set(1e9, 1); u.uFrontAxis.value = 0;
        u.uF0.value.set(1e9, 1e9, 1e9); u.uF1.value.set(-1e9, -1e9, -1e9);
        u.uDim.value = baseFade; u.uRecv.value = 0;
      }
      dirtyBlocks.clear();
      allFaded = true; curBaseFade = baseFade;
      return;
    }
    for (const bid of dirtyBlocks) {
      if (look.resetOne) { look.resetOne(bid, baseFade); continue }
      const m = look.byId.get(bid); if (!m) continue;
      const u = m.material.uniforms;
      u.uGrow.value.set(1e9, 1); u.uFrontAxis.value = 0;
      u.uF0.value.set(1e9, 1e9, 1e9); u.uF1.value.set(-1e9, -1e9, -1e9);
      u.uDim.value = baseFade; u.uRecv.value = 0;
    }
    dirtyBlocks.clear();
  };
  const growB = (bid, k = null, f = 1, axis = 0) => { markDirty(bid); look.grow(bid, k, f, axis) };
  const frontB = (bid, axis, from, to, f, slice) => { markDirty(bid); look.front(bid, axis, from, to, f, slice) };
  const downHeadsB = (bid, h0, h1, w0, w1, r) => { markDirty(bid); look.downHeads(bid, h0, h1, w0, w1, r) };
  const focusB = (bid, box = null, dimIn = 0) => { markDirty(bid); look.focus(bid, box, dimIn) };
  const dimOneB = (bid, v) => { markDirty(bid); look.dimOne(bid, v) };
  const recvB = (bid, v) => { markDirty(bid); look.setRecv(bid, v); if (B[bid + '/0']) { markDirty(bid + '/0'); look.setRecv(bid + '/0', v) } };

  // ---- ops: what grows, what is lit
  const H = b => b.div[2], gapped = b => b.headGap > 0 && b.alt === 'z';
  function growTo(bid, u) {
    const b = B[bid]; if (!b) return;
    if (b.elided && B[bid + '/0']) {
      if (u >= 1) { growB(bid + '/0', null); return growB(bid, null) }
      if (u <= 0) { growB(bid + '/0', 0, 0, b.orient === 'row' ? 1 : 0); return growB(bid, 0, 0, b.orient === 'row' ? 1 : 0) }
      const ax = b.orient === 'row' ? 1 : 0;
      growB(bid + '/0', 0, clamp(u * 2), ax);
      return growB(bid, 0, clamp(u * 2 - 1), ax);
    }
    if (u >= 1) return growB(bid, null);
    if (u <= 0) return growB(bid, 0, 0, b.orient === 'row' ? 1 : 0);
    if (gapped(b)) { const c = u * H(b), k = Math.floor(c); return growB(bid, k, Math.max(1e-4, c - k)) }
    growB(bid, 0, u, b.orient === 'row' ? 1 : 0);
  }
  const headsDown = b => b.alt === 'y' && b.orient === 'col' && b.t.deck?.kind === 'head' && b.t.cols > 1;
  function fillTo(bid, j, R, how) {
    const b = B[bid], T = b.t.rows.n, per = b.t.cols, st = b.div[2] > 1 && per > 1, h = st ? Math.floor(R / per) : 0;
    if (headsDown(b)) { const n = per * b.t.deck.n, k = Math.floor(R / per); return downHeadsB(bid, k / b.t.deck.n, (k + 1) / b.t.deck.n, j / T, (j + 1) / T, (R + 1) / n) }
    const n = st ? per : b.alt === 'y' ? per * b.t.deck.n : per > 1 ? per : b.t.deck?.n || 1, r = st ? R % per : R, row = b.orient === 'row';
    growB(bid, gapped(b) ? (how === 'heads' ? h : -1) : 0, (j + 1) / T, row ? 1 : 0);
    frontB(bid, row ? 2 : 1, j / T, (j + 1) / T, (r + 1) / n, gapped(b) ? h : 0);
  }
  const wordBox = (b, j) => b.orient === 'row' ? [[0, j, 0], [1e9, j + 1, 1e9]] : [[j, 0, 0], [j + 1, 1e9, 1e9]];
  const sliceBox = h => [[0, 0, h], [1e9, 1e9, h + .999]];

  function run(s, beat, u, lit, rest = false) {
    s = beat.dot ? { ...s, dot: beat.dot } : s;
    const op = beat.op, T = words.length;
    if (op.show) for (const x of op.show) lit(id(s, x));
    if (op.layerWhole !== undefined) {
      for (const b of WB) if (b.layer === op.layerWhole) lit(b.id);
    }
    if (op.overview) {
      for (const b of WB) if (b.t?.id === 'residual_out' || b.t?.id === 'residual_in') lit(b.id);
      for (const eid of ['h_mean', 'h_final', 'logits', 'probs']) lit(eid);
    }
    if (op.token !== undefined) {
      const bid = id(s, 'ids');
      lit(bid); lit('x0');
      if (rest) growTo(bid, 1);
      else {
        const landed = clamp((u - .40) / .34);
        growTo(bid, (op.token + landed) / T);
        word = op.token;
      }
    }
    if (op.transit !== undefined) {
      const ls = { layer: op.transit }, steps = M.layers[op.transit].steps, k = Math.min(steps.length - 1, Math.floor(u * steps.length));
      for (const [i, st] of steps.entries()) for (const w of st.writes) growTo(id(ls, w), rest ? 1 : clamp(u * steps.length - i));
      for (const st of rest ? steps : [steps[k]]) for (const x of [...st.reads, ...st.params, ...st.writes]) lit(id(ls, x));
    }
    if (op.last) { lit('h_final', wordBox(B.h_final, 5)); word = rest ? -1 : 5 }
    if (op.lesson) {
      const st = op.lesson;
      for (const x of [...st.reads, ...st.params]) lit(id(s, x));
      for (const x of st.writes) {
        const bid = id(s, x), b = B[bid], shape = demo.get(x).shape, v = rest ? 1 : op.phase === 'trace' ? u : op.phase === 'place' ? 1 / demo.get(x).a.length : 0;
        growTo(bid, v);
        if (['trace', 'place'].includes(op.phase) && !rest && u < 1) {
          const per = shape.slice(1).reduce((a, b1) => a * b1, 1), i = Math.min(op.sample, demo.get(x).a.length - 1);
          const q = op.phase === 'trace' ? lessonProgress(b, shape, Math.min(.999999, Math.floor(u * 48) / 48)) : x === 'attn_w' ? { index: i, j: Math.floor(i % 36 / 6), R: Math.floor(i / 36) * 6 + i % 6 } : { index: i, j: Math.floor(i / per), R: i % per };
          if (b.elided) {
            const count = shape.at(-1), visible = Math.round((b.x1 - b.x0) / .008);
            growB(bid, 0, clamp((q.index - count + visible + 1) / visible), 0);
            growB(bid + '/0', 0, clamp((q.index + 1) / visible), 0);
          } else if (['pick', 'stream'].includes(b.t.deck?.kind)) {
            growB(bid, null);
            frontB(bid, b.orient === 'row' ? 4 : 5, q.j, Math.floor(q.R / b.t.cols), (q.R % b.t.cols + 1) / b.t.cols, 0);
          } else fillTo(bid, q.j, q.R, b.t.deck?.kind === 'head' ? 'heads' : 'words');
          if (shape[0] === T) word = q.j;
        } else if (!rest && shape[0] === T) {
          const per = shape.slice(1).reduce((a, b1) => a * b1, 1);
          word = Math.floor(Math.min(op.sample || 0, demo.get(x).a.length - 1) / per);
        }
        lit(bid);
      }
    }
    if (op.cycle) {
      const k = Math.min(4, Math.floor(u * 5)), layer = Math.min(44, Math.floor((u * 5 - 2) * 45));
      const ids = [['ids'], ['W_embed', 'x0'], WB.filter(b => b.layer >= 0 && b.layer <= layer && b.t.id === 'residual_out').map(b => b.id), ['h_final', 'W_head', 'logits'], ['probs', 'next_id']][k];
      for (const x of ids) lit(x);
    }
    if (op.merge) {
      const d = s.merge[op.merge], [j, R] = mergeIndex(s, op, u);
      for (const name of d.ins) lit(id(s, name), wordBox(B[id(s, name)], j));
      lit(id(s, d.out));
      if (rest || op.phase === 'trace' && u >= 1) growTo(id(s, d.out), 1);
      else if (op.phase === 'trace' || op.phase === 'place' && u >= 1) fillTo(id(s, d.out), j, R, 'words');
      word = rest ? -1 : j;
    }
    if (op.expert) {
      if (op.expert === 'select') {
        const k = Math.min(s.expert.k - 1, Math.floor(u * s.expert.k));
        lit(id(s, s.expert.indices), wordBox(B[id(s, s.expert.indices)], 0));
        lit(id(s, 'x_ffn'), wordBox(B[id(s, 'x_ffn')], 0));
        lit(id(s, 'W_gu'), sliceBox(demo.at(s.expert.indices, 0, k)));
      } else {
        const [j, k, R] = expertIndex(s, op, u), pr = expertProduct(s, op.expert, j, k), d = s.expert.stages[op.expert];
        if (d.kind === 'activation') { lit(id(s, d.w), expertWordBox(pr.W, j, k)); lit(id(s, d.x), expertWordBox(pr.X, j, k)) }
        else { lit(id(s, d.w), pr.W.t.deck?.kind === 'expert' ? sliceBox(pr.e) : null); lit(id(s, d.x), expertWordBox(pr.X, j, k)) }
        if (pr.routed) lit(id(s, s.expert.indices), wordBox(B[id(s, s.expert.indices)], j));
        if (d.weighted) lit(id(s, s.expert.weights), wordBox(B[id(s, s.expert.weights)], j));
        lit(id(s, d.out));
        if (rest || op.phase === 'trace' && u >= 1) growTo(id(s, d.out), 1);
        else if (op.phase === 'trace' || ['place', 'all'].includes(op.phase) && u >= 1) fillExpert(pr, j, k, R);
        word = rest ? -1 : j;
      }
    }
    if (op.words) {
      const w0 = (op.w0 || 0) / T, uu = w0 + (1 - w0) * u;
      const j = op.trace && u < 1 ? tracedAt(op, u, traceOf(s, op))[0] : Math.min(T - 1, Math.floor(uu * T));
      for (const w of [op.words].flat()) {
        const out = id(s, w), b = B[out];
        if (gapped(b) && uu < 1) growB(out, -1, uu, 0); else growTo(out, uu);
        lit(out); if (u < 1) word = j;
      }
      for (const [x, how, k] of op.ins) {
        const b = B[id(s, x)];
        if (how === 'col') lit(id(s, x), wordBox(b, j));
        else if (how === 'win') { const [c0, c1] = wordBox(b, j); c0[b.orient === 'row' ? 1 : 0] = Math.max(0, j - k + 1); lit(id(s, x), [c0, c1]) }
        else lit(id(s, x));
      }
    }
    if (op.heads) {
      const c = op.from + u * op.n, h = Math.min(op.from + op.n - 1, Math.floor(c));
      for (const [w, out] of op.heads) {
        const O = id(s, out);
        const w0 = (op.w0 || 0) / words.length;
        if (op.slow) growB(O, h, u >= 1 ? 1 : w0 + (1 - w0) * clamp(c - h)); else growB(O, u >= 1 ? op.from + op.n - 1 : h, 1);
        if (u >= 1 && op.from + op.n >= H(B[O])) growB(O, null);
        lit(O); lit(id(s, w), sliceBox(h));
      }
      const j = Math.min(T - 1, Math.floor(((op.w0 || 0) / T + (1 - (op.w0 || 0) / T) * (c - h)) * T));
      op.slow ? lit(id(s, op.x), wordBox(B[id(s, op.x)], j)) : lit(id(s, op.x));
      if (op.slow && u < 1) word = j;
    }
    if (op.trace && u < 1) {
      const [j, R] = tracedAt(op, u, traceOf(s, op));
      for (const out of op.words ? [op.words].flat() : op.heads.map(([, o]) => o)) fillTo(id(s, out), j, R, op.heads ? 'heads' : 'words');
      if (op.by === 'kda') {
        const h = Math.floor(R / B[id(s, op.trace[2])].t.cols);
        for (const x of ['Q_conv', 'K_conv', 'V_conv', 'g']) { const [c0, c1] = wordBox(B[id(s, x)], j); c0[1] = h; c1[1] = h + 1; lit(id(s, x), [c0, c1]) }
        lit(id(s, 'beta'), wordBox(B[id(s, 'beta')], j));
        lit(id(s, 'state'), [[0, h, 0], [1e9, h + 1, 1e9]]);
      }
    }
    if (op.dot || op.mix || op.conv || op.write || op.coef || op.fg || op.beta) {
      const d = op.dot ? s.dot : op.mix ? s.mix : op.conv ? s.conv : op.write ? s.write : op.coef ? s.coef : op.fg ? s.fg : s.beta;
      const ph = op.dot || op.mix || op.conv || op.write || op.coef || op.fg || op.beta, W = id(s, d.w), X = id(s, d.x), O = id(s, d.out);
      if (op.conv) { const [c0, c1] = wordBox(B[X], d.word); c0[0] = Math.max(0, d.word - d.k + 1); lit(X, [c0, c1]) } else lit(X, wordBox(B[X], d.word));
      if (op.coef) { lit(id(s, d.scale)); lit(id(s, d.base)) }
      if (op.fg) {
        const h = Math.floor(d.R / B[O].t.cols), band = [[0, h, 0], [1e9, h + 1, 1e9]];
        lit(W, band); lit(id(s, d.bias), band); lit(id(s, d.rate), [[0, 0, h], [1e9, 1e9, h + 1]]);
      } else if (op.conv || op.coef) lit(W);
      else if (op.mix || op.write) lit(W, wordBox(B[W], d.word));
      else B[W].div[2] > 1 && B[W].t.cols > 1 ? lit(W, sliceBox(headOf(B[W], d.R))) : lit(W);
      if (op.write) lit(id(s, d.y), wordBox(B[id(s, d.y)], d.word));
      lit(O);
      if ((ph === 'place' || ph === 'all') && u >= 1 || rest) {
        if (rest) growTo(O, 1); else fillTo(O, d.word, op.write ? d.s * B[O].t.cols + d.R : d.R, 'words');
      }
    }
    if (op.kda) {
      const d = s.kda, ph = op.kda, j = d.word, h = d.head, head = (x, w = j) => { const b = B[id(s, x)], [c0, c1] = wordBox(b, w); c0[1] = h; c1[1] = h + 1; lit(id(s, x), [c0, c1]) };
      lit(id(s, 'state'), [[0, h, 0], [1e9, h + 1, 1e9]]);
      if (ph === 'pick' || ph === 'recall') { head('K_conv'); head('V_conv'); head('g'); lit(id(s, 'beta'), wordBox(B[id(s, 'beta')], j)) }
      if (ph === 'pick' || ph === 'read' || ph === 'place') head('Q_conv');
      if (ph === 'read') head('K_conv');
      const O = id(s, d.out); lit(O);
      if (ph === 'place' && u >= 1 || rest) { if (rest) growTo(O, 1); else fillTo(O, j, h * B[O].t.cols + d.c, 'words') }
      if (u < 1 && !rest) word = j;
    }
    if (op.gn) {
      const d = s.gn, ph = op.gn, j = d.word, h = d.head, O = id(s, d.out), per = B[O].t.cols, head = x => lit(id(s, x), [[j, h, 0], [j + 1, h + 1, 1e9]]);
      if (ph !== 'square' && ph !== 'mean') head(d.gate);
      if (ph !== 'gate' && ph !== 'carry') head(d.x);
      if (ph === 'scale' || ph === 'place' || rest) lit(id(s, d.g));
      lit(O);
      if (ph === 'place' || rest) { const R = rest || u >= 1 ? per - 1 : placedAt(u, per); if (rest) growTo(O, 1); else if (R >= 0) fillTo(O, j, h * per + R, 'words') }
      if (u < 1 && !rest) word = j;
    }
    if (op.ew) {
      const d = s.ew, O = id(s, d.out), n = B[O].t.cols, [ph, v] = op.ew === 'all' ? ewAll(u) : [op.ew, u];
      for (const x of [d.a, d.b]) lit(id(s, x), wordBox(B[id(s, x)], d.word));
      lit(O);
      if (ph === 'place' || rest) {
        const R = rest || v >= 1 ? n - 1 : placedAt(v, n);
        if (rest) growTo(O, 1); else if (R >= 0) fillTo(O, d.word, R, 'words');
      }
      if (u < 1 && !rest) word = d.word;
    }
    if (op.norm) {
      const d = s.norm, X = id(s, d.x), O = id(s, d.out), n = B[X].t.cols, [ph, v] = op.norm === 'all' ? normAll(u) : [op.norm, u];
      lit(X, wordBox(B[X], d.word)); if (!RMS_PH.includes(ph) || rest) lit(id(s, d.g));
      lit(O);
      if (ph === 'place' || rest) {
        const R = rest || v >= 1 ? n - 1 : placedAt(v, n);
        if (rest) growTo(O, 1); else if (R >= 0) fillTo(O, d.word, R, 'words');
      }
      if (u < 1 && !rest) word = d.word;
    }
    if (op.route) {
      const d = s.route, ph = op.route, { j, k } = routeAt(s, ph, u), X = id(s, d.x), I = id(s, d.indices), W = id(s, d.weights);
      lit(X, rest ? null : wordBox(B[X], j));
      if (ph === 'choose' || rest) lit(id(s, d.bias));
      lit(I); lit(W);
      if (rest) { growTo(I, 1); growTo(W, 1) }
      else {
        if (ph !== 'sigmoid') fillTo(I, j, ph === 'choose' || ph === 'rest' ? k : d.k - 1, 'words');
        if (ph === 'place' || ph === 'rest') fillTo(W, j, k, 'words');
        word = j;
      }
    }
    if (op.tour) {
      const steps = layerOf(s).steps.filter(st => st.half === op.tour), k = Math.min(steps.length - 1, Math.floor(u * steps.length));
      steps.forEach((st, i) => { const v = clamp(u * steps.length - i); for (const w of st.writes) growTo(id(s, w), v) });
      for (const st of rest ? steps : [steps[k]]) for (const x of [...st.reads, ...st.params, ...st.writes]) lit(id(s, x));
    }
  }

  const outsOf = s => {
    const o = new Set();
    for (const { op, dot } of s.beats) {
      if (op.token !== undefined) o.add('ids');
      if (op.lesson) op.lesson.writes.forEach(x => o.add(x));
      if (op.transit !== undefined) for (const st of M.layers[op.transit].steps) for (const x of st.writes) o.add(lid(op.transit) + ':' + x);
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

  // ---- Computation Lens DOM & Haloed SVG Connector Engine (zero getTotalLength / getPointAtLength DOM syncs!)
  const layer = document.createElement('div'); layer.className = 'dotlayer'; host.append(layer);
  const el = (cls, html = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; layer.append(e); return e };
  const card = el('dot-card', '<div class="dot-tag"></div><div class="dot-shape all"></div><div class="dot-shape one"></div>'); card.id = 'dotcard';
  const pill = el('dot-pill', '<div class="dot-formula"></div>'); pill.id = 'dotpill';
  const SVGNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'dotlines'); layer.append(svg);
  svg.innerHTML = '<defs><marker id="dotarrow" viewBox="0 0 10 10" refX="8.2" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto"><path id="dotarrow-path" d="M1.2 1.6 L8.8 5 L1.2 8.4 L2.6 5 Z" fill="#24352f" stroke="rgba(252,252,250,.92)" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke"/></marker></defs>';
  const haloGroup = document.createElementNS(SVGNS, 'g'), strokeGroup = document.createElementNS(SVGNS, 'g');
  svg.append(haloGroup, strokeGroup);
  const makeLine = (cls, withHalo = true) => {
    const e = document.createElementNS(SVGNS, 'path');
    e.setAttribute('class', cls);
    strokeGroup.append(e);
    if (withHalo) {
      const h = document.createElementNS(SVGNS, 'path');
      h.setAttribute('class', 'dl-halo' + (cls.includes(' o') ? ' o' : ''));
      haloGroup.append(h);
      e._halo = h;
    }
    e._pts = []; e._cum = [0]; e._len = 0;
    return e;
  };
  const tag = card.querySelector('.dot-tag'), whole = card.querySelector('.all'), one = card.querySelector('.one'), formula = pill.querySelector('.dot-formula');
  const lxs = Array.from({ length: 6 }, () => makeLine('dl x')), lw = makeLine('dl w'), lx = makeLine('dl x'), lo = makeLine('dl o');
  const ALL_LINES = [...lxs, lw, lx, lo];
  const incomingPort = el('dot-incoming'), targetCell = el('dot-target', '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.4 4.9V1.4H4.9M9.1 1.4H12.6V4.9M12.6 9.1V12.6H9.1M4.9 12.6H1.4V9.1" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>'), targetName = el('dot-target-label', '写入位置');
  const sourcePorts = Array.from({ length: 8 }, () => el('dot-source'));
  const sourceOrigins = new Map(), sourceBoxes = new Map();
  const sourcePins = new Map([lw, lx, ...lxs].map(p => [p, el('dot-anchor')]));
  const tokBadges = Array.from({ length: 6 }, (_, j) => el('tok-badge', `<b>${words[j]}</b><i>${IDS[j]}</i>`));
  const expertPlane = document.createElementNS(SVGNS, 'svg'); expertPlane.setAttribute('class', 'dot-expert-plane'); layer.insertBefore(expertPlane, card);
  const expertEdge = document.createElementNS(SVGNS, 'path'); expertPlane.append(expertEdge);

  // Pure-JS polyline/Bezier evaluation & exact arc-length prefix slicing (leading-tip arrowhead growth, zero micro-stubs)
  function syncPathData(e, d, pts, f = 1, o = 1) {
    const cum = [0];
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      cum.push(len);
    }
    e._pts = pts; e._cum = cum; e._len = len;
    if (f <= .04 || o <= .01 || len <= .5) { hideLine(e); return }
    let outD = d;
    const effLen = e === lo && targetState && len > 22 ? len - 8.5 : e === lo && targetState && len > 14 ? len - 6.5 : len;
    const target = effLen * clamp(f);
    if (target < len - .2 && pts.length >= 2) {
      let sub = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        if (cum[i] >= target) {
          const seg = Math.max(1e-6, cum[i] - cum[i - 1]), t0 = (target - cum[i - 1]) / seg;
          const tx = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t0;
          const ty = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t0;
          sub += ` L${tx.toFixed(1)} ${ty.toFixed(1)}`;
          break;
        }
        sub += ` L${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
      }
      outD = sub;
    }
    e.setAttribute('d', outD);
    e.style.display = 'block'; e.style.opacity = o;
    e.style.strokeDasharray = ''; e.style.strokeDashoffset = '0';
    if (e._halo) {
      e._halo.setAttribute('d', outD);
      e._halo.style.display = 'block';
      e._halo.style.opacity = o;
      e._halo.style.strokeDasharray = '';
      e._halo.style.strokeDashoffset = '0';
    }
  }
  function hideLine(e) {
    e.style.display = 'none'; e._len = 0;
    if (e._halo) e._halo.style.display = 'none';
  }
  function pointAtLen(e, s) {
    const pts = e._pts, cum = e._cum, n = pts.length;
    if (!n) return { x: 0, y: 0 };
    if (s <= 0 || n === 1) return { x: pts[0][0], y: pts[0][1] };
    if (s >= cum[n - 1]) return { x: pts[n - 1][0], y: pts[n - 1][1] };
    let lo0 = 0, hi0 = n - 1;
    while (lo0 + 1 < hi0) { const mid = (lo0 + hi0) >> 1; if (cum[mid] <= s) lo0 = mid; else hi0 = mid }
    const seg = Math.max(1e-6, cum[hi0] - cum[lo0]), t = (s - cum[lo0]) / seg;
    return { x: pts[lo0][0] + (pts[hi0][0] - pts[lo0][0]) * t, y: pts[lo0][1] + (pts[hi0][1] - pts[lo0][1]) * t };
  }
  function buildBezierSpec([ax, ay], [bx, by], bow = .18, steps = 36) {
    const pts = [];
    if (bow === 'h') {
      const dx = (bx - ax) * .55, c1x = ax + dx, c2x = bx - dx;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        pts.push([u * u * u * ax + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * bx, u * u * u * ay + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * by]);
      }
      return { d: `M${ax} ${ay} C${c1x} ${ay} ${c2x} ${by} ${bx} ${by}`, pts };
    }
    if (bow === 'v') {
      const dy = (by - ay) * .55, c1y = ay + dy, c2y = by - dy;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        pts.push([u * u * u * ax + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * bx, u * u * u * ay + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * by]);
      }
      return { d: `M${ax} ${ay} C${ax} ${c1y} ${bx} ${c2y} ${bx} ${by}`, pts };
    }
    if (bow === 'vhL' || bow === 'vhR') {
      const c1y = ay + (by - ay) * .52, c2x = bow === 'vhL' ? Math.max(8, Math.min(ax, bx) - 64) : Math.min(stageW - 8, Math.max(ax, bx) + 64);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        pts.push([u * u * u * ax + 3 * u * u * t * ax + 3 * u * t * t * c2x + t * t * t * bx, u * u * u * ay + 3 * u * u * t * c1y + 3 * u * t * t * by + t * t * t * by]);
      }
      return { d: `M${ax} ${ay} C${ax} ${c1y} ${c2x} ${by} ${bx} ${by}`, pts };
    }
    if (bow === 'archL' || bow === 'archR') {
      const sx = bow === 'archL' ? Math.max(8, Math.min(ax, bx) - 52) : Math.min(stageW - 8, Math.max(ax, bx) + 52);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        pts.push([u * u * u * ax + 3 * u * u * t * sx + 3 * u * t * t * sx + t * t * t * bx, u * u * u * ay + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * by]);
      }
      return { d: `M${ax} ${ay} C${sx} ${ay} ${sx} ${by} ${bx} ${by}`, pts };
    }
    if (!bow) {
      return { d: `M${ax} ${ay} L${bx} ${by}`, pts: [[ax, ay], [bx, by]] };
    }
    const mx = (ax + bx) / 2 - (by - ay) * bow, my = (ay + by) / 2 + (bx - ax) * bow;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      pts.push([u * u * ax + 2 * u * t * mx + t * t * bx, u * u * ay + 2 * u * t * my + t * t * by]);
    }
    return { d: `M${ax} ${ay} Q${mx} ${my} ${bx} ${by}`, pts };
  }
  function curve(e, a, b, f = 1, bow = .18, o = 1) {
    const spec = buildBezierSpec(a, b, bow);
    syncPathData(e, spec.d, spec.pts, f, o);
  }

  const _vp = new THREE.Vector3();
  const px = p => {
    _vp.copy(p).applyMatrix4(camera.matrixWorldInverse);
    if (_vp.z >= -camera.near) return [stageW / 2 + (_vp.x >= 0 ? 1e5 : -1e5), stageH / 2 + (-_vp.y >= 0 ? 1e5 : -1e5)];
    const q = _vp.copy(p).project(camera);
    return [(q.x + 1) / 2 * stageW, (1 - q.y) / 2 * stageH];
  };

  const sci = v => { if (v === 0 || Math.abs(v) >= 1e-4) return fmt(v, 4); const e = Math.floor(Math.log10(Math.abs(v))); return `${(v / 10 ** e).toFixed(2)}×10${String(e).replace('-', '⁻').replace(/\d/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}` };
  const fmt = (v, d = 3) => { const a = Math.abs(v), k = a === 0 ? d : Math.min(7, Math.max(d, 2 - Math.floor(Math.log10(a)))); return (v < 0 ? '−' : '') + a.toFixed(k) };
  const ease = v => { v = clamp(v); return v < .5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2 };
  const SHOW = [0, 1, 2, 3, 4, 5];

  const along = (b, k, n, ax) => ax === 'x' ? b.x0 + (k + .5) / n * (b.x1 - b.x0) : b.y1 - (k + .5) / n * (b.y1 - b.y0);
  const slabZ = (b, h) => { const Hn = b.div[2]; if (Hn <= 1) return b.z1; const pitch = (b.z1 - b.z0) / Hn; return b.z1 - h * pitch - pitch / (1 + (b.headGap || 0)) / 2 };
  function dataAt(b, w, i) {
    const t = b.t, T = words.length, per = t.cols, Hn = t.deck?.n || 1;
    if (b.orient === 'row') return V(along(b, i, per, 'x'), along(b, w, T, 'y'), b.z1);
    const x = along(b, w, T, 'x');
    if (b.alt === 'y') return V(x, along(b, i, per * Hn, 'y'), b.z1);
    if (b.div[2] > 1 && per > 1) return V(x, along(b, i % per, per, 'y'), slabZ(b, Math.floor(i / per)));
    return V(x, along(b, i, per > 1 ? per : Hn, 'y'), b.z1);
  }
  function weightAt(b, R, c) {
    const t = b.t, per = t.cols, Hn = t.deck?.n || 1, nin = t.rows.n;
    if (b.orient === 'wt') return V(along(b, R, per, 'x'), along(b, c, nin, 'y'), b.z1);
    if (t.headAxis === 'y') return V(along(b, c, nin * Hn, 'x'), along(b, R, per, 'y'), b.z1);
    if (b.alt === 'y') return V(along(b, c, nin, 'x'), along(b, R, per * Hn, 'y'), b.z1);
    if (b.div[2] > 1 && per > 1) return V(along(b, c, nin, 'x'), along(b, R % per, per, 'y'), slabZ(b, Math.floor(R / per)));
    return V(along(b, c, nin, 'x'), along(b, R, per > 1 ? per : Hn, 'y'), b.z1);
  }
  const headOf = (b, i) => b.div[2] > 1 && b.t.cols > 1 ? Math.floor(i / b.t.cols) : 0;
  const onCard = c => { const k = new THREE.Color(c), hsl = {}; k.getHSL(hsl); return '#' + (hsl.l > .86 ? k.lerp(new THREE.Color(0x4a5852), .26) : k).getHexString() };
  const deep = c => '#' + new THREE.Color(c).lerp(new THREE.Color(0x1b2421), .42).getHexString();

  function product(s, [w, x, out]) {
    const W = B[id(s, w)], X = B[id(s, x)], O = B[id(s, out)];
    const cw = onCard(look.palette[W.comp][1]), cx = onCard(look.palette[X.comp][0]), co = onCard(look.palette[O.comp][0]);
    return { w, x, out, W, X, O, cw, cx, co, n: demo.W.tensors[w].shape[1], N: demo.get(out).shape[1] };
  }

  const dots = new Map();
  function sumParts(s, kind) {
    const key = kind + ':' + s.n + (kind === 'dot' ? ':' + s.dot.out : ''); if (dots.has(key)) return dots.get(key);
    const T = kind.startsWith('expert:') ? expertTerms(s, kind.slice(7)) : ({ mix: mixTerms, conv: convTerms, write: writeTerms, coef: coefTerms, fg: fgTerms, beta: betaTerms, recall: s0 => kdaTerms(s0, 'recall'), read: s0 => kdaTerms(s0, 'read') }[kind] || dotTerms)(s), { pr, cs } = T;
    T.pv = cs.map((c, k) => T.wv[k] * T.xv[k]);
    T.note = el('dot-note', `⋮ 其余 ${T.n - cs.length} 对`); T.sumLine = el('dot-sumline', ''); T.drop = el('dot-cell drop', '');
    T.drop.style.background = pr.co; T.drop.style.borderColor = deep(pr.co);
    T.rows = cs.map(c => ({ c, w: el('dot-cell', ''), x: el('dot-cell', ''), times: el('dot-x', '×'), txt: el('dot-txt', '') }));
    T.rows.forEach((r, k) => { const cx = T.xcol ? T.xcol(k) : pr.cx; r.w.style.background = pr.cw; r.x.style.background = cx; r.w.style.borderColor = deep(pr.cw); r.x.style.borderColor = deep(cx) });
    if (s.focusLabels && kind === 'recall' && stageW < 700) for (const r of T.rows) { r.txt.style.fontSize = '10.5px'; r.txt.style.lineHeight = '11px' }
    dots.set(key, T); return T;
  }
  const dotParts = s => sumParts(s, 'dot');
  function dotTerms(s) {
    const d = s.dot, pr = product(s, [d.w, d.x, d.out]), n = pr.n, R = d.R, j = d.word, cs = [...SHOW, n - 1];
    return { pr, n, cs, wv: cs.map(c => demo.weight(d.w, R, c)), xv: cs.map(c => demo.at(d.x, j, c)), total: demo.at(d.out, j, R),
      wAt: c => weightAt(pr.W, R, c), xAt: c => dataAt(pr.X, j, c), wLine: weightAt(pr.W, R, n / 2), xLine: dataAt(pr.X, j, n * .85),
      oAt: dataAt(pr.O, j, R), fill: v => fillCard(pr, d.tag, j, R, v, 'dot:' + s.n + ':' + d.out) };
  }
  function mixProduct(s, [w, x, out]) {
    const W = B[id(s, w)], X = B[id(s, x)], O = B[id(s, out)];
    return { w, x, out, W, X, O, cw: onCard(look.palette[W.comp][0]), cx: onCard(look.palette[X.comp][0]), co: onCard(look.palette[O.comp][0]), n: X.t.cols, N: O.t.cols, k: X.t.deck.n };
  }
  const inputName = pr => cur?.incoming?.includes(pr.x) ? '上一层送来的 4 路（从上方进入）' : pr.X.t.name;
  const mixWhole = pr => `<i>整块</i>${inputName(pr)} <b>[6, ${pr.k}, ${pr.n}]</b> 按 pre <b>[6, ${pr.k}]</b> 加权 → ${pr.O.t.name} <b>[6, ${pr.N}]</b>`
    + `<br>每个词：${pr.k} 路同一位置的数各乘自己那一路的 pre，再相加 = 1 个数`;
  const mixOne = (pr, j, R) => `<i>这一个</i>${wordOf(j)} ${pr.k} 路的第 ${R + 1} 个数 <b>[${pr.k}]</b> 和${wordOf(j)}的 pre <b>[${pr.k}]</b> 一对一对相乘、再加起来 → <b>1</b> 个数`;
  const mixForm = (pr, v) => `dot(<i class="sw row" style="background:${pr.cw}"></i>, <i class="sw col" style="background:${pr.cx}"></i>) = <b>${v}</b>`;

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

  const sub = k => String(k).replace(/\d/g, c => '₀₁₂₃₄₅₆⁷⁸⁹'[c]);
  function writeProduct(s) {
    const d = s.write, W = B[id(s, d.w)], X = B[id(s, d.x)], O = B[id(s, d.out)], Y = B[id(s, d.y)];
    return { w: d.w, x: d.x, out: d.out, W, X, O, Y, cw: onCard(look.palette[X.comp][0]), cx: onCard(look.palette[Y.comp][0]), cold: onCard(look.palette[X.comp][0]), cy: onCard(look.palette[Y.comp][0]), co: onCard(look.palette[O.comp][0]),
      wName: '旧四路 / post·comb', xName: Y.t.name,
      n: X.t.cols, N: demo.get(d.out).shape.slice(1).reduce((a, b) => a * b, 1), k: X.t.deck.n };
  }
  const writeWhole = pr => `<i>整块</i>${pr.Y.t.name} <b>[6, ${pr.n}]</b> 和旧 ${pr.k} 路 <b>[6, ${pr.k}, ${pr.n}]</b>，按 post <b>[6, ${pr.k}]</b>、comb <b>[6, ${pr.k}, ${pr.k}]</b> → ${pr.O.t.name} <b>[6, ${pr.k}, ${pr.n}]</b>`
    + `<br>新第 s 路的每个数 = post_s × ${pr.Y.t.name}这个位置的数 + 旧 ${pr.k} 路这个位置的 ${pr.k} 个数各乘 comb 第 s 列`;
  const writeOne = (pr, j, st, R) => `<i>这一个</i>${wordOf(j)} 新第 ${st + 1} 路第 ${R + 1} 个数：${pr.k + 1} 对相乘、再加起来 → <b>1</b> 个数（旧 ${pr.k} 路和系数在上面）`;
  const writeForm = (pr, v) => `post × <i class="sw col" style="background:${pr.cx}"></i> + comb × <i class="sw row" style="background:${pr.cold};width:8px;height:18px"></i> = <b>${v}</b>`;
  function writeTerms(s) {
    const d = s.write, pr = writeProduct(s), j = d.word, R = d.R, st = d.s, n = pr.n, K = pr.k, cs = [...Array(K + 1).keys()];
    const wi = k => k === 0 ? K + st : 2 * K + (k - 1) * K + st;
    return { pr, n: K + 1, cs, wv: cs.map(k => demo.at(d.w, j, wi(k))), xv: cs.map(k => k === 0 ? demo.at(d.y, j, R) : demo.at(d.x, j, k - 1, R)), total: demo.at(d.out, j, st, R),
      xcol: k => k === 0 ? pr.cy : pr.cold, rowNote: k => k === 0 ? `(post${sub(st + 1)}, 输出)` : `(comb${sub(k)}${sub(st + 1)}, 旧 ${k} 路)`,
      wAt: k => dataAt(pr.W, j, wi(k)), xAt: k => k === 0 ? dataAt(pr.Y, j, R) : dataAt(pr.X, j, (k - 1) * n + R),
      wLine: dataAt(pr.X, j, R), xLine: dataAt(pr.Y, j, R), oAt: dataAt(pr.O, j, st * n + R),
      fill: v => setCard(d.tag, writeWhole(pr), writeOne(pr, j, st, R), writeForm(pr, v), 'write:' + s.n) };
  }

  function kdaProduct(s) {
    const d = s.kda, W = B[id(s, 'state')], O = B[id(s, d.out)], Q = B[id(s, 'Q_conv')], K = B[id(s, 'K_conv')], Vv = B[id(s, 'V_conv')], G = B[id(s, 'g')], Be = B[id(s, 'beta')];
    return { w: 'state', x: 'Q_conv', out: d.out, W, X: Q, K, Vv, G, Be, O, cw: onCard(look.palette[W.comp][1]), cx: onCard(look.palette[Q.comp][0]), co: onCard(look.palette[O.comp][0]), n: O.t.cols, N: demo.get(d.out).shape[1], H: O.t.deck.n };
  }
  const kdaWhole = pr => `<i>整块</i>q、k、v、g <b>[6, ${pr.H} 头, ${pr.n}]</b>、β <b>[6, ${pr.H}]</b> → ${pr.O.t.name} <b>[6, ${pr.H} 头, ${pr.n}]</b>；记忆 S <b>[${pr.H} 头, ${pr.n}, ${pr.n}]</b> 一个词一个词地改`
    + `<br>每个词、每个头：S 衰减、对照、修正写入，再用 q 读出 ${pr.n} 个数`;
  const kdaStack = (pr, rows, value) => `<div class="stk">${rows.map(([t0, role]) => `<div><span class="role">${role}</span> ${t0} <i class="sw ex" style="background:${t0 === 'S' ? pr.cw : pr.cx};width:14px;height:10px"></i></div>`).join('')}<div class="val">${value}</div></div>`;
  function kdaTerms(s, kind) {
    const d = s.kda, pr = kdaProduct(s), j = d.word, h = d.head, c = d.c, n = pr.n, W = demo.kdaHead(h)[j], cs = [...SHOW, n - 1], R = h * n;
    const at = (Mat, r) => Mat[r * n + c], recall = kind === 'recall';
    const mid = R + n / 2;
    return { pr, n, cs, wv: cs.map(r => recall ? at(W.dec, r) : at(W.S, r)), xv: cs.map(r => recall ? W.k[r] : W.q[r]), total: recall ? W.mem[c] : W.o[c],
      wAt: r => weightAt(pr.W, R + r, c), xAt: r => dataAt(recall ? pr.K : pr.X, j, R + r), wLine: weightAt(pr.W, R + n / 2, c), xLine: dataAt(recall ? pr.K : pr.X, j, R + n / 2),
      oAt: dataAt(pr.O, j, R + c), extra: recall ? 22 : 0, stackOf: [pr.X, pr.K, pr.Vv, pr.G, pr.Be, pr.W, pr.O],
      more: () => (recall ? [[dataAt(pr.K, j, mid), pr.cx, 'k'], [dataAt(pr.Vv, j, R + c), pr.cx, 'v'], [dataAt(pr.G, j, mid), pr.cx, 'g'], [dataAt(pr.Be, j, h), pr.cx, 'β']]
        : [[dataAt(pr.X, j, mid), pr.cx, 'q'], [dataAt(pr.K, j, mid), pr.cx, 'k']]).concat([[weightAt(pr.W, mid, c), pr.cw, '记忆 S']]),
      rowText: (k, ph, m, prod) => {
        const r = cs[k];
        if (recall) return `(${fmt(at(W.old, r))} × ${fmt(W.eg[r])})${s.focusLabels && stageW < 700 ? '<br>' : ' '}× ${fmt(W.k[r])}${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(prod)}</b></span>` : ''}`;
        return ph === 'pull' ? `${fmt(at(W.dec, r))} + ${fmt(W.k[r])} × δ → <b>${fmt(at(W.S, r))}</b>` : `${fmt(at(W.S, r))} × ${fmt(W.q[r])}${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(prod)}</b></span>` : ''}`;
      },
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
  function coefProduct(s) {
    const d = s.coef, W = B[id(s, d.w)], X = B[id(s, d.x)], O = B[id(s, d.out)], Sc = B[id(s, d.scale)], Ba = B[id(s, d.base)];
    return { w: d.w, x: d.x, out: d.out, W, X, O, Sc, Ba, cw: onCard(look.palette[W.comp][1]), cx: onCard(look.palette[X.comp][0]), co: onCard(look.palette[O.comp][0]),
      per: X.t.cols, k: X.t.deck.n, n: X.t.cols * X.t.deck.n, N: O.t.cols };
  }
  const fnAt = (b, R, c) => { const per = b.t.rows.n; return V(along(b, c % per, per, 'x'), along(b, R, b.t.cols, 'y'), slabZ(b, Math.floor(c / per))) };
  const coefGroup = (R, k) => R < k ? ['pre', R, 0] : R < 2 * k ? ['post', R - k, 1] : ['comb', R - 2 * k, 2];
  const coefName = (R, k) => { const [g, i] = coefGroup(R, k); return g === 'comb' ? `comb${sub(Math.floor(i / k) + 1)}${sub(i % k + 1)}` : g + sub(i + 1) };
  const coefAct = { pre: ['sigmoid(', ') + 10⁻⁶', '过 sigmoid'], post: ['2·sigmoid(', ')', '过 2·sigmoid'], comb: ['Sinkhorn(softmax(', '))', '这一行 4 个一起 softmax，4×4 再做 Sinkhorn'] };
  const coefWhole = pr => cur?.incoming ? `<i>整块</i>L03 的 4 路 <b>[6, 4, 4096]</b><br>每词展平为 <b>[16384]</b>，fn <b>[24, 16384]</b> → 系数 <b>[6, 24]</b>` : `<i>整块</i>${inputName(pr)} <b>[6, ${pr.k}, ${pr.per}]</b>（每个词 ${pr.k} 路连成 <b>[${pr.n}]</b>）× fn <b>[${pr.N}, ${pr.n}]</b> → 24 个系数 <b>[6, ${pr.N}]</b>`
    + `<br>每个词：÷ 自己的 rms，和 fn 的每一行点积，× scale + base，再过各组的激活 = 1 个数`;
  const coefOne = (pr, j, R, rms) => cur?.incoming ? `<i>这一个</i>${wordOf(j)}先 ÷ rms ${fmt(rms)}，与 fn 第 ${R + 1} 行做 ${pr.n} 对乘加；× scale、+ base，${coefAct[coefGroup(R, pr.k)[0]][2]} → <b>${coefName(R, pr.k)}</b>` : `<i>这一个</i>${wordOf(j)} ${pr.k} 路连成的 <b>[${pr.n}]</b> 先 ÷ 它们的 rms（${fmt(rms)}），再和 fn 第 ${R + 1} 行 <b>[${pr.n}]</b> 一对一对相乘、相加；× scale、+ base，${coefAct[coefGroup(R, pr.k)[0]][2]} → <b>1</b> 个数：${coefName(R, pr.k)}`;
  const coefForm = (pr, R, v) => { const [a, b] = coefAct[coefGroup(R, pr.k)[0]], ex = `<i class="sw ex" style="background:${pr.cw};width:10px;height:10px"></i>`;
    return `${a}base${ex} + scale${ex} × dot(<i class="sw row" style="background:${pr.cw}"></i>, <i class="sw col" style="background:${pr.cx}"></i>)${b} = <b>${v}</b>` };
  const coefEnds = (pr, j, R) => { const W = pr.W, mx = (W.x0 + W.x1) / 2, y = along(W, R, W.t.cols, 'y');
    return [[V(mx, y, W.z1), V(mx, y, W.z0)], [dataAt(pr.X, j, 0), dataAt(pr.X, j, pr.per - 1)]] };
  const nearer = (ends, ty) => ends.map(px).sort((a, b) => Math.abs(a[1] - ty) - Math.abs(b[1] - ty))[0];
  const coefMore = (pr, R) => [[gammaAt(pr.Ba, R), pr.cw, 'base'], [gammaAt(pr.Sc, coefGroup(R, pr.k)[2]), pr.cw, 'scale']];
  const coefMemo = new Map();
  function coefRms(s, j) {
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

  function fgProduct(s) {
    const d = s.fg, pr = product(s, [d.w, d.x, d.out]);
    return { ...pr, Bi: B[id(s, d.bias)], Ra: B[id(s, d.rate)], per: pr.O.t.cols };
  }
  const rodAt = (b, i) => b.alt === 'z' ? V((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1 - (i + .5) / b.div[2] * (b.z1 - b.z0)) : V((b.x0 + b.x1) / 2, along(b, i, b.t.cols * (b.t.deck?.n || 1), 'y'), b.z1);
  const fgMore = (pr, R) => [[rodAt(pr.Bi, R), pr.cw, 'dt_bias'], [rodAt(pr.Ra, Math.floor(R / pr.per)), pr.cw, 'A_log']];
  const fgWhole = (pr, lb) => `<i>整块</i>${inputName(pr)} <b>[6, ${pr.n}]</b> × W_f_b <b>[${pr.N}, ${pr.n}]</b> → 衰减门 g <b>[6, ${pr.N}]</b> = <b>${headsOf(pr.O.t)}</b>`
    + `<br>每个数：一次点积，+ dt_bias，× 这个头的 e^A_log，sigmoid，× (${lb})，落在 ${lb} 到 0 之间`;
  const fgOne = (pr, j, R) => `<i>这一个</i>${wordOf(j)} <b>[${pr.n}]</b> 和 W_f_b 第 ${R + 1} 行 <b>[${pr.n}]</b> 一对一对相乘、相加；+ dt_bias 第 ${R + 1} 个，× 第 ${Math.floor(R / pr.per) + 1} 个头的 e^A_log，sigmoid，× (−5) → <b>1</b> 个数`;
  const fgForm = (pr, lb, v) => { const ex = `<i class="sw ex" style="background:${pr.cw};width:10px;height:10px"></i>`;
    return `${lb}·sigmoid((dot(<i class="sw col" style="background:${pr.cx}"></i>, <i class="sw row" style="background:${pr.cw}"></i>) + dt_bias${ex}) × e^A_log${ex}) = <b>${v}</b>` };
  function fgTerms(s) {
    const d = s.fg, pr = fgProduct(s), j = d.word, R = d.R, n = pr.n, cs = [...SHOW, n - 1], h = Math.floor(R / pr.per);
    let dot = 0; for (let c = 0; c < n; c++) dot += demo.weight(d.w, R, c) * demo.at(d.x, j, c);
    const b = demo.weight(d.bias, R), e = Math.exp(demo.weight(d.rate, h)), z = e * (dot + b), total = demo.at(d.out, j, R);
    return { pr, n, cs, wv: cs.map(c => demo.weight(d.w, R, c)), xv: cs.map(c => demo.at(d.x, j, c)), total,
      wAt: c => weightAt(pr.W, R, c), xAt: c => dataAt(pr.X, j, c), wLine: weightAt(pr.W, R, n / 2), xLine: dataAt(pr.X, j, n / 2),
      oAt: dataAt(pr.O, j, R), more: () => fgMore(pr, R), extra: 66, upright: true,
      sumSay: `这 ${cs.length} 个乘积 + 其余 ${n - cs.length} 个，加起来 = <b>${fmt(dot)}</b><br>+ dt_bias ${fmt(b)}，× e^A_log ${fmt(e)} = ${fmt(z)}<br>${d.lb} × sigmoid(${fmt(z)}) = <b>${fmt(total)}</b><br><span style="color:#5c6963">用的时候 e^g = ${fmt(Math.exp(total))}：旧记忆留下 ${Math.round(Math.exp(total) * 100)}%</span>`,
      fill: v => setCard(d.tag, fgWhole(pr, d.lb), fgOne(pr, j, R), fgForm(pr, d.lb, v), 'fg:' + s.n) };
  }

  let cardState = null, pillState = null, targetState = null, targetFade = 1;
  const hideDots = () => {
    sourceOrigins.clear(); sourceBoxes.clear();
    cardState = null; pillState = null; targetState = null; targetFade = 1;
    for (const e of layer.children) if (e !== svg) e.style.display = 'none';
    for (const e of ALL_LINES) hideLine(e);
    for (const d of DIMS) hideLine(d.p);
  };
  const put = (e, [x, y], o = 1, sc = 1, left = false) => {
    e._px = x; e._py = y;
    e.style.display = 'block'; e.style.left = x + 'px'; e.style.top = y + 'px';
    e.style.opacity = o; e.style.transform = `translate(${left ? 0 : '-50%'}, -50%) scale(${sc})`;
  };
  function incomingPoint() {
    const right = cardState ? cardState[0] < stageW / 2 : stageW < 700;
    const x = right ? stageW - 86 : 88;
    incomingPort.innerHTML = `L${String(cur.layer - 1).padStart(2, '0')} 输出（画外）<br><b>6 词 × 4 路 × 4096</b>`;
    put(incomingPort, [x, 30]);
    return [x, 50];
  }
  function markTarget(point, color, targetBlock = null) {
    if (!inPic(point)) return null;
    let [px0, py0] = point;
    const blk = targetBlock || WORDLS.get(cur?.n)?.b;
    if (blk && blk.orient !== 'row') {
      const fTop = Math.max(px(V(blk.x0, blk.y1, blk.z1))[1], px(V(blk.x1, blk.y1, blk.z1))[1]);
      const fBot = Math.min(px(V(blk.x0, blk.y0, blk.z1))[1], px(V(blk.x1, blk.y0, blk.z1))[1]);
      const fL = Math.min(px(V(blk.x0, blk.y1, blk.z1))[0], px(V(blk.x0, blk.y0, blk.z1))[0]);
      const fR = Math.max(px(V(blk.x1, blk.y1, blk.z1))[0], px(V(blk.x1, blk.y0, blk.z1))[0]);
      if (fBot - fTop > 22 && px0 >= fL - 8 && px0 <= fR + 8 && py0 >= fTop - 6 && py0 <= fBot + 6) {
        py0 = Math.max(fTop + 7.5, Math.min(fBot - 7.5, py0));
      }
    }
    if (cur && WORDLS.has(cur.n)) {
      for (const wEl of WORDLS.get(cur.n).ws) {
        const wr = rectOfLabel(wEl);
        if (wr && px0 + 7.5 > wr.left - 1 && px0 - 7.5 < wr.right + 1 && py0 - 7.5 < wr.bottom + 1.5 && py0 + 7.5 > wr.top - 1) {
          py0 = Math.max(py0, wr.bottom + 8.5);
        }
      }
    }
    const adj = [px0, py0];
    const boxes = [cardState, pillState].filter(Boolean);
    if (boxes.some(([l, t0, r0, b0]) => adj[0] > l - 5 && adj[0] < r0 + 5 && adj[1] > t0 - 5 && adj[1] < b0 + 5)) {
      targetCell.style.display = 'none'; targetState = null; return null;
    }
    const dc = deep(color);
    targetCell.style.color = dc;
    targetCell.style.borderColor = dc;
    put(targetCell, adj);
    targetState = adj;
    return adj;
  }
  const runW = el('dot-cell drop', ''), runX = el('dot-cell drop', '');
  function glideOnLine(runner, line, text, bg, prog) {
    if (prog <= .03 || prog >= .96 || !line || line.style.display !== 'block' || line._len < 16) {
      runner.style.display = 'none';
      return;
    }
    if (runner._txt !== text) { runner.textContent = text; runner._txt = text; runner._cw = 0; runner._ch = 0 }
    runner.style.background = bg;
    runner.style.borderColor = deep(bg);
    runner.style.display = 'block';
    const dw = (runner._cw || (runner._cw = runner.offsetWidth || 44)) / 2 + 4, dh = 13;
    const L = line._len, avoid = [pillState, cardState].filter(Boolean);
    const hits = p0 => p0.x - dw < 5 || p0.x + dw > stageW - 5 || p0.y - dh < 5 || p0.y + dh > stageH - 5
      || avoid.some(([l, t0, r0, b0]) => p0.x + dw > l && p0.x - dw < r0 && p0.y + dh > t0 && p0.y - dh < b0);
    let sDock = Math.min(L * .4, Math.max(dw, dh) + 4);
    for (; sDock < L * .85; sDock += 6) if (!hits(pointAtLen(line, sDock))) break;
    let sStart = L;
    for (; sStart > sDock + 6; sStart -= 6) if (!hits(pointAtLen(line, sStart))) break;
    const pt = pointAtLen(line, Math.min(L, Math.max(sDock, sDock + (sStart - sDock) * (1 - prog))));
    const op = prog < .12 ? prog / .12 : prog > .84 ? (.96 - prog) / .12 : 1;
    put(runner, [Math.max(dw + 5, Math.min(stageW - dw - 5, pt.x)), Math.max(dh + 5, Math.min(stageH - dh - 5, pt.y))], op);
  }
  function dropAlongArrow(element, v, from, to) {
    let q;
    if (lo.style.display === 'block' && lo._len > 4) {
      const L = lo._len;
      element.style.display = 'block';
      const dw = (element._cw || (element._cw = element.offsetWidth || 28)) / 2 + 4, dh = 14;
      const avoid = [pillState, cardState].filter(Boolean);
      let sDock = Math.min(L * .42, Math.max(dw, dh) + 2);
      for (; sDock < L * .75; sDock += 6) {
        const p0 = pointAtLen(lo, sDock);
        if (!avoid.some(([l, t0, r0, b0]) => p0.x + dw > l && p0.x - dw < r0 && p0.y + dh > t0 && p0.y - dh < b0)) break;
      }
      q = pointAtLen(lo, Math.min(L, sDock + (L - sDock) * v));
    } else {
      q = { x: from[0] + (to[0] - from[0]) * v, y: from[1] + (to[1] - from[1]) * v };
    }
    if (v > .52) targetFade = Math.min(targetFade, clamp((.74 - v) / .22));
    if (v > .72 && targetCell.style.display === 'block') targetCell.style.opacity = String(clamp((.96 - v) / .24));
    put(element, [q.x, q.y], 1, 1 - .32 * v);
  }

  let targetNameSize = { txt: '', w: 0, h: 0 };
  function placeTargetName() {
    if (!targetState || targetCell.style.display !== 'block' || targetFade <= .05) { targetName.style.display = 'none'; return }
    const [x, y] = targetState;
    const txt = targetName.textContent || '';
    if (targetNameSize.txt !== txt || targetNameSize.w <= 0) {
      targetName.style.display = 'block';
      targetNameSize = { txt, w: targetName.offsetWidth || 54, h: targetName.offsetHeight || 18 };
    }
    const hw = targetNameSize.w / 2, hh = targetNameSize.h / 2;
    const obstacles = [[x - 8, y - 8, x + 8, y + 8]];
    if (cardState) obstacles.push(cardState);
    if (pillState) obstacles.push(pillState);
    for (let i = 0; i < layer.children.length; i++) {
      const dEl = layer.children[i];
      if (dEl.style.display !== 'block' || !dEl.classList.contains('drop') || !dEl.textContent) continue;
      const t = dEl.textContent;
      if (dEl._txt !== t || !dEl._cw || !dEl._ch) { dEl._txt = t; dEl._cw = dEl.offsetWidth || 28; dEl._ch = dEl.offsetHeight || 18 }
      const dhw = dEl._cw / 2 + 3, dhh = dEl._ch / 2 + 3;
      if (dEl._px !== undefined) obstacles.push([dEl._px - dhw, dEl._py - dhh, dEl._px + dhw, dEl._py + dhh]);
    }
    if (cur) {
      for (const e of segLabels.get(cur.n) || []) {
        const r = rectOfLabel(e);
        if (r) obstacles.push([r.left, r.top, r.right, r.bottom]);
      }
    }
    const activeLinePts = ALL_LINES.filter(p => p.style.display === 'block' && p._pts?.length >= 2 && +(p.style.opacity || 1) >= .1).map(p => p._pts);
    const dx1 = hw + 15, dx2 = hw + 32, dy1 = hh + 13, dy2 = hh + 28;
    const offsets = [[dx1, 0], [-dx1, 0], [0, dy1], [0, -dy1], [dx1, dy1], [-dx1, dy1], [dx1, -dy1], [-dx1, -dy1], [dx2, 0], [-dx2, 0], [0, dy2], [0, -dy2], [dx2, dy1], [-dx2, dy1], [dx2, -dy1], [-dx2, -dy1]];
    for (const [dx, dy] of offsets) {
      const cx = x + dx, cy = y + dy, l = cx - hw, r0 = cx + hw, t0 = cy - hh, b0 = cy + hh;
      if (l < 4 || r0 > stageW - 4 || t0 < 4 || b0 > stageH - 4) continue;
      if (obstacles.some(([ol, ot, or, ob]) => l < or + 2 && r0 > ol - 2 && t0 < ob + 2 && b0 > ot - 2)) continue;
      const padBox = [l - 3, t0 - 3, r0 + 3, b0 + 3];
      if (activeLinePts.some(pts => pts.slice(1).some((p, i) => segHitsBox(pts[i], p, padBox)))) continue;
      put(targetName, [cx, cy], targetFade);
      return;
    }
    targetName.style.display = 'none';
  }

  let CW = 360;
  const DY = 22, PAIRS = (SHOW.length + 2) * DY + 28, GAP = 56, EDGE = 12;
  const shortStage = () => stageH < 500, dyOf = () => shortStage() ? 15 : DY, tabGap = () => shortStage() ? 8 : 14, edgeOf = () => shortStage() ? 6 : EDGE, pairsOf = () => shortStage() ? 5 * 15 + 16 : PAIRS;
  const SPOTS = ['r', 'l', 'ru', 'lu', 'rd', 'ld', 'u', 'd', 'TL', 'TR', 'BL', 'BR'];
  function spotAt(spot, [x0, y0, x1, y1], h) {
    const cy = (y0 + y1) / 2, cx = (x0 + x1) / 2, W = stageW, H0 = stageH, ed = edgeOf();
    const within = (x, y) => { const X = Math.max(ed, Math.min(W - ed - CW, x)), Y = Math.max(ed, Math.min(H0 - ed - h, y)); return { x: X, y: Y, moved: Math.hypot(X - x, Y - y) } };
    if (typeof spot === 'object') return within(cx + spot.dx, cy + spot.dy);
    if (spot.length === 2 && spot === spot.toUpperCase()) return { x: spot[1] === 'L' ? ed : Math.max(ed, W - ed - CW), y: spot[0] === 'T' ? ed : Math.max(ed, H0 - ed - h), moved: 0 };
    const [x, y] = { r: [x1 + GAP, cy - h * .35], l: [x0 - GAP - CW, cy - h * .35], ru: [x1 + GAP, y0 - GAP - h], lu: [x0 - GAP - CW, y0 - GAP - h],
      rd: [x1 + GAP, y1 + GAP], ld: [x0 - GAP - CW, y1 + GAP], u: [cx - CW / 2, y0 - GAP - h], d: [cx - CW / 2, y1 + GAP] }[spot];
    return within(x, y);
  }
  const screenBox = b => {
    const ps = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].flatMap(([x, y]) => [px(V(x, y, b.z0)), px(V(x, y, b.z1))]);
    return [Math.min(...ps.map(p => p[0])), Math.min(...ps.map(p => p[1])), Math.max(...ps.map(p => p[0])), Math.max(...ps.map(p => p[1]))];
  };
  const crosses = ([ax, ay], [bx, by], [x0, y0, x1, y1]) => { for (let k = 1; k < 20; k++) { const f = k / 20, px0 = ax + (bx - ax) * f, py0 = ay + (by - ay) * f; if (px0 > x0 && px0 < x1 && py0 > y0 && py0 < y1) return true } return false };
  const faceBox = b => {
    const ps = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map(([x, y]) => px(V(x, y, b.z1)));
    return [Math.min(...ps.map(p => p[0])), Math.min(...ps.map(p => p[1])), Math.max(...ps.map(p => p[0])), Math.max(...ps.map(p => p[1]))];
  };
  const overArea = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const SPOT = new Map();

  function activeSegLabelBoxes(padX = 3, padY = 2, includeWords = false) {
    if (!cur) return [];
    const out = [];
    for (const e of segLabels.get(cur.n) || []) {
      if (!includeWords && e.classList.contains('word')) continue;
      const r = rectOfLabel(e);
      if (r) out.push([r.left - padX, r.top - padY, r.right + padX, r.bottom + padY]);
    }
    return out;
  }

  function chooseSpot(s, bi, anchor, h, points, blocks = () => [], clear = null, cardHeight = h) {
    if (microStage()) return 'TL';
    const autoCard = s.poses[s.beats[[bi].flat()[0]].cam]?.autoCard;
    const coversInput = s.lessonData && points().filter(inPic).some(([x, y]) => x > EDGE && x < EDGE + CW && y > EDGE && y < EDGE + cardHeight);
    if (!autoCard && !coversInput && (s.incoming?.length || s.expert || s.focusLabels) && stageW < 700) return 'TL';
    const bis = [bi].flat(), key = `${s.n}:${bis.join('+')}:${stageW}x${stageH}`;
    if (SPOT.has(key)) return SPOT.get(key);
    const keep = snap(), at = [];
    for (const b of bis) {
      const P = getPose(s, s.beats[b].cam);
      camera.position.copy(P.p); controls.target.copy(P.t); camera.lookAt(P.t); camera.updateMatrixWorld(); marks();
      const names = activeSegLabelBoxes(6, 6, true);
      at.push({ names, a: anchor(), pts: points(), bls: blocks(), cl: clear ? clear().filter(inPic) : [] });
    }
    const across = (cl, y) => cl.filter(p => p[1] > y - 24 && p[1] < y + h + 24).length + (cl.some(p => p[1] <= y - 24) && cl.some(p => p[1] >= y + h + 24) ? 1 : 0);
    const scoreAt = ({ names, a, pts, bls, cl }, x, y, moved) => {
      const box = [x - 10, y - 10, x + CW + 10, y + h + 10];
      const pins = s.lessonData ? [x, y, x + CW, y + cardHeight] : box;
      const cc = [x + CW / 2, y + h / 2];
      let wireCross = 0;
      for (const p0 of pts) {
        if (!inPic(p0)) continue;
        for (const bl of bls) {
          if (p0[0] >= bl[0] - 8 && p0[0] <= bl[2] + 8 && p0[1] >= bl[1] - 8 && p0[1] <= bl[3] + 8) continue;
          const shrink = [bl[0] + 6, bl[1] + 6, bl[2] - 6, bl[3] - 6];
          if (shrink[2] > shrink[0] && shrink[3] > shrink[1] && segHitsBox(cc, p0, shrink)) wireCross += 950;
        }
      }
      return names.reduce((v, n) => v + overArea(box, n), 0) * 50 + bls.reduce((v, n) => v + overArea(box, n), 0) * 10
        + pts.filter(([u, v]) => u > pins[0] && u < pins[2] && v > pins[1] && v < pins[3]).length * 1e7
        + moved * 5 + Math.hypot(cc[0] - (a[0] + a[2]) / 2, cc[1] - (a[1] + a[3]) / 2) + across(cl, y) * 4e3 + wireCross;
    };
    const a = at[0].a;
    let best = null;
    for (const sp of bis.length > 1 ? ['TL', 'TR', 'BL', 'BR'] : SPOTS) {
      const score = at.reduce((v, e) => { const { x, y, moved } = spotAt(sp, e.a, h); return v + scoreAt(e, x, y, moved) }, 0);
      if (!best || score < best.score) best = { sp, score };
    }
    if (best.score >= 3e3 && bis.length === 1) {
      const cx = (a[0] + a[2]) / 2, cy = (a[1] + a[3]) / 2;
      for (let x = EDGE; x <= stageW - EDGE - CW; x += 20) for (let y = EDGE; y <= stageH - EDGE - h; y += 20) {
        const score = scoreAt(at[0], x, y, 0);
        if (score < best.score) best = { sp: { dx: x - cx, dy: y - cy }, score };
      }
    }
    camera.position.copy(keep.p); controls.target.copy(keep.t); camera.lookAt(keep.t); camera.updateMatrixWorld();
    marks();
    SPOT.set(key, best.sp); return best.sp;
  }

  const wordOf = j => /^[\p{L}\p{N}]/u.test(words[j]) ? words[j] : `「${words[j]}」`;
  const headsOf = t => t.deck?.kind === 'head' && (!t.headsDown || t.headsCut) ? `[6, ${t.deck.n} 头, ${t.cols}]` : null;
  let geo = null, activeComp = null, lastCardSig = '';

  function setCard(name, allH, oneH, formH, key) {
    const segComp = activeComp || (cur ? (cur.rows?.some(r => r.includes('kda')) ? 'kda' : cur.rows?.some(r => r.includes('attn')) ? 'attn' : cur.rows?.some(r => r.includes('expert')) ? 'expert' : cur.rows?.some(r => r.includes('dense')) ? 'dense' : cur.rows?.some(r => r.includes('norm')) ? 'norm' : cur.rows?.some(r => r.includes('embed') || r.includes('lm_head') || r.includes('pick') || r.includes('text')) ? 'embed' : 'resid') : 'kda');
    const outStroke = deep(ACCENTS[segComp] || '#286151');
    card.style.setProperty('--dot-accent', ACCENTS[segComp] || '#286151');
    layer.style.setProperty('--dot-out', outStroke);
    const arrowHead = svg.querySelector('#dotarrow-path'); if (arrowHead) arrowHead.setAttribute('fill', outStroke);
    const sig = `${name}|${allH}|${oneH}|${formH}|${CW}|${shortStage() ? 1 : 0}`;
    card.style.display = 'block'; card.style.width = CW + 'px'; pill.style.display = 'block';
    if (sig !== lastCardSig || !geo) {
      lastCardSig = sig;
      tag.textContent = name; whole.innerHTML = allH; one.innerHTML = oneH; one.style.display = oneH ? '' : 'none'; formula.innerHTML = formH;
      formula.style.fontSize = shortStage() ? '11px' : CW < 360 ? '12px' : '';
      card.style.height = 'auto';
      const gk = key + ':' + CW + ':' + (shortStage() ? 1 : 0) + ':' + formH.length + ':' + oneH.length;
      if (geo?.key !== gk) {
        const c = pill.getBoundingClientRect(), h = card.offsetHeight;
        const at = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [(r.left + r.right) / 2 - c.left, (r.top + r.bottom) / 2 - c.top, r.width / 2, r.height / 2] };
        geo = { key: gk, h, pw: c.width, ph: c.height, row: at(formula.querySelector('.row')), col: at(formula.querySelector('.col')), val: at(formula.querySelector('b')),
          ex: [...formula.querySelectorAll('.sw.ex')].map(at) };
      }
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

  function placeCard(x, y, h, o, toward, avoid = [], upright = false, pins = [], names = null) {
    if (!names) names = activeSegLabelBoxes(2, 2, true);
    const W = stageW, H0 = stageH, ed = edgeOf(), tb = tabGap();
    h = Math.min(h, Math.max(60, H0 - 2 * ed));
    put(card, [x, y], o); card.style.transform = 'none'; card.style.height = h + 'px';
    cardState = [x, y, x + CW, y + h];
    const { pw, ph } = geo, [tx, ty] = toward, dx = (tx - (x + CW / 2)) / (CW / 2), dy = (ty - (y + h / 2)) / (h / 2);
    const cl = (a, lo0, hi0) => Math.max(lo0, Math.min(hi0, a));
    const vert = s => [cl(tx - pw / 2, x, x + CW - pw), s > 0 ? y + h + tb : y - tb - ph];
    const side = s => [s > 0 ? x + CW + tb : x - tb - pw, cl(ty - ph / 2, y, y + h - ph)];
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const ways = upright ? [vert(sy), vert(-sy), side(sx), side(-sx)] : Math.abs(dy) > Math.abs(dx) ? [vert(sy), side(sx), vert(-sy), side(-sx)] : [side(sx), vert(sy), vert(-sy), side(-sx)];
    let best = null;
    for (const [px0, py0] of ways) {
      const X0 = cl(px0, 4, W - 4 - pw), Y0 = cl(py0, 4, H0 - 4 - ph), box = [X0, Y0, X0 + pw, Y0 + ph];
      const hitCard = overArea(box, [x - 4, y - 4, x + CW + 4, y + h + 4]);
      const on = pins.filter(inPic).filter(([a, b]) => a > box[0] - 8 && a < box[2] + 8 && b > box[1] - 8 && b < box[3] + 8).length * 1e7
        + names.reduce((v, b) => v + overArea(box, b), 0) * 1e5
        + avoid.reduce((v, b) => v + overArea(box, b), 0) + (hitCard > 0 ? 1e9 : 0) + hitCard * 1e6
        + (crosses([(box[0] + box[2]) / 2, (box[1] + box[3]) / 2], toward, [x + 8, y + 8, x + CW - 8, y + h - 8]) ? 3e4 : 0);
      if (!best || on < best.on) best = { box, on };
      if (!on) break;
    }
    put(pill, [best.box[0], best.box[1]], o); pill.style.transform = 'none';
    pillState = best.box;
    return best.box;
  }

  function tabLeftOf(blocks, pts, o) {
    const x1 = Math.min(...blocks.map(b => screenBox(b)[0])) - 28, ys = pts.map(p => p[1]).sort((a, b) => a - b);
    const X0 = Math.max(4, x1 - geo.pw), Y0 = Math.max(4, Math.min(stageH - 4 - geo.ph, (ys[0] + ys.at(-1)) / 2 - geo.ph / 2));
    put(pill, [X0, Y0], o); pill.style.transform = 'none';
    pillState = [X0, Y0, X0 + geo.pw, Y0 + geo.ph];
    return pillState;
  }

  const segHitsBox = ([ax, ay], [bx, by], [x0, y0, x1, y1]) => {
    if ((ax <= x0 && bx <= x0) || (ax >= x1 && bx >= x1) || (ay <= y0 && by <= y0) || (ay >= y1 && by >= y1)) return false;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    if (Math.abs(dx) < 1e-6) { if (ax <= x0 || ax >= x1) return false }
    else {
      const inv = 1 / dx;
      let r0 = (x0 - ax) * inv, r1 = (x1 - ax) * inv;
      if (r0 > r1) { const tmp = r0; r0 = r1; r1 = tmp }
      if (r0 > t0) t0 = r0;
      if (r1 < t1) t1 = r1;
      if (t0 >= t1 - 1e-4) return false;
    }
    if (Math.abs(dy) < 1e-6) { if (ay <= y0 || ay >= y1) return false }
    else {
      const inv = 1 / dy;
      let r0 = (y0 - ay) * inv, r1 = (y1 - ay) * inv;
      if (r0 > r1) { const tmp = r0; r0 = r1; r1 = tmp }
      if (r0 > t0) t0 = r0;
      if (r1 < t1) t1 = r1;
      if (t0 >= t1 - 1e-4) return false;
    }
    return t0 < t1 - 1e-4;
  };
  const ptInBox = ([x, y], [l, t0, r, d]) => x > l && x < r && y > t0 && y < d;
  const ptsClearBoxes = (pts, boxes, startGrace = 3, endGrace = 1.2) => {
    if (pts.length < 2) return true;
    const s0 = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (b[0] < 2 || b[0] > stageW - 2 || b[1] < 2 || b[1] > stageH - 2) return false;
      let p0 = a, p1 = b;
      if (i === 1 && startGrace > 0) {
        const L = Math.hypot(b[0] - s0[0], b[1] - s0[1]);
        if (L <= startGrace) continue;
        const t0 = startGrace / L;
        p0 = [s0[0] + (b[0] - s0[0]) * t0, s0[1] + (b[1] - s0[1]) * t0];
      }
      if (i === pts.length - 1 && endGrace > 0) {
        const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        if (L <= endGrace) continue;
        const t1 = (L - endGrace) / L;
        p1 = [p0[0] + (p1[0] - p0[0]) * t1, p0[1] + (p1[1] - p0[1]) * t1];
      }
      for (let k = 0; k < boxes.length; k++) if (segHitsBox(p0, p1, boxes[k])) return false;
    }
    return true;
  };
  const isSmoothPts = pts => {
    for (let i = 1; i < pts.length - 1; i++) {
      const ux = pts[i][0] - pts[i - 1][0], uy = pts[i][1] - pts[i - 1][1];
      const vx = pts[i + 1][0] - pts[i][0], vy = pts[i + 1][1] - pts[i][1];
      const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      if (lu > 1.5 && lv > 1.5 && (ux * vx + uy * vy) / (lu * lv) < .78) return false;
    }
    return true;
  };
  function simplifyCollinear(pts) {
    const dedup = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > .5);
    if (dedup.length < 3) return dedup;
    const out = [dedup[0]];
    for (let i = 1; i < dedup.length - 1; i++) {
      const a = out.at(-1), c = dedup[i], n = dedup[i + 1];
      const ux = c[0] - a[0], uy = c[1] - a[1], vx = n[0] - c[0], vy = n[1] - c[1];
      const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      if (lu > 1e-4 && lv > 1e-4 && (ux * vx + uy * vy) / (lu * lv) > .996) continue;
      out.push(c);
    }
    out.push(dedup.at(-1));
    return out;
  }
  function roundedPolySpec(pts, rad = 22) {
    const clean = simplifyCollinear(pts);
    if (clean.length < 2) return { d: `M${pts[0][0]} ${pts[0][1]}`, pts: [pts[0]] };
    let d = `M${clean[0][0]} ${clean[0][1]}`;
    const sampled = [clean[0]];
    for (let i = 1; i < clean.length - 1; i++) {
      const a = clean[i - 1], c = clean[i], n = clean[i + 1];
      const la = Math.hypot(c[0] - a[0], c[1] - a[1]), ln = Math.hypot(n[0] - c[0], n[1] - c[1]);
      const r = Math.min(rad, la * .46, ln * .46);
      if (r < 2) { d += ` L${c[0]} ${c[1]}`; sampled.push(c); continue }
      const p0 = [c[0] - (c[0] - a[0]) / la * r, c[1] - (c[1] - a[1]) / la * r];
      const p1 = [c[0] + (n[0] - c[0]) / ln * r, c[1] + (n[1] - c[1]) / ln * r];
      d += ` L${p0[0]} ${p0[1]} Q${c[0]} ${c[1]} ${p1[0]} ${p1[1]}`;
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, u = 1 - t;
        sampled.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
      }
    }
    const last = clean.at(-1);
    d += ` L${last[0]} ${last[1]}`;
    sampled.push(last);
    return { d, pts: sampled };
  }
  function buildStemBezierSpec(start, exit, b, mode, steps = 40) {
    const sl = Math.hypot(exit[0] - start[0], exit[1] - start[1]);
    if (sl < .5) return buildBezierSpec(start, b, typeof mode === 'number' ? mode : .18, steps);
    const ux = (exit[0] - start[0]) / sl, uy = (exit[1] - start[1]) / sl;
    const dx = b[0] - start[0], dy = b[1] - start[1], dist = Math.hypot(dx, dy);
    if (dist < 8) return { d: `M${start[0]} ${start[1]} L${b[0]} ${b[1]}`, pts: [start, b] };
    let h1 = Math.max(18, Math.min(132, dist * .42));
    let c1x = start[0] + ux * h1, c1y = start[1] + uy * h1, c2x, c2y;
    if (mode === 's') {
      if (Math.abs(ux) > .5) {
        h1 = Math.max(22, Math.min(150, Math.abs(dx) * .52));
        c1x = start[0] + ux * h1; c1y = start[1];
        c2x = b[0] - Math.sign(dx || ux) * Math.max(20, Math.abs(dx) * .38); c2y = b[1];
      } else {
        h1 = Math.max(22, Math.min(150, Math.abs(dy) * .52));
        c1x = start[0]; c1y = start[1] + uy * h1;
        c2x = b[0]; c2y = b[1] - Math.sign(dy || uy) * Math.max(20, Math.abs(dy) * .38);
      }
    } else if (mode === 'vhL' || mode === 'vhR') {
      c2x = mode === 'vhL' ? Math.max(10, Math.min(start[0], b[0]) - 64) : Math.min(stageW - 10, Math.max(start[0], b[0]) + 64);
      c2y = b[1];
    } else if (mode === 'archL' || mode === 'archR') {
      const sx = mode === 'archL' ? Math.max(10, Math.min(start[0], b[0]) - 60) : Math.min(stageW - 10, Math.max(start[0], b[0]) + 60);
      if (Math.abs(ux) > .5 && (sx - start[0]) * ux > 8) { c1x = sx; c1y = start[1] }
      c2x = sx; c2y = b[1];
    } else if (mode === 'archU' || mode === 'archD') {
      const sy = mode === 'archU' ? Math.max(10, Math.min(start[1], b[1]) - 56) : Math.min(stageH - 10, Math.max(start[1], b[1]) + 56);
      if (Math.abs(uy) > .5 && (sy - start[1]) * uy > 8) { c1x = start[0]; c1y = sy }
      c2x = b[0]; c2y = sy;
    } else {
      const k = typeof mode === 'number' ? mode : 0;
      c2x = b[0] - dx * .28 - dy * k;
      c2y = b[1] - dy * .28 + dx * k;
    }
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      pts.push([
        u * u * u * start[0] + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * b[0],
        u * u * u * start[1] + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b[1],
      ]);
    }
    return { d: `M${start[0]} ${start[1]} C${c1x} ${c1y} ${c2x} ${c2y} ${b[0]} ${b[1]}`, pts };
  }

  const nudgeOutOfBoxes = (pt, ref, boxes) => {
    let [px0, py0] = pt;
    for (let pass = 0; pass < 3; pass++) {
      const hit = boxes.find(bx => ptInBox([px0, py0], bx));
      if (!hit) break;
      const [l, t0, r, d] = hit, m = 12;
      const cands = [
        [l - m, py0], [r + m, py0], [px0, t0 - m], [px0, d + m],
      ].filter(([cx, cy]) => cx >= 6 && cx <= stageW - 6 && cy >= 6 && cy <= stageH - 6 && !boxes.some(bx => ptInBox([cx, cy], bx)));
      if (!cands.length) return null;
      cands.sort((a, b0) => (Math.hypot(a[0] - pt[0], a[1] - pt[1]) + Math.hypot(a[0] - ref[0], a[1] - ref[1]) * .25)
        - (Math.hypot(b0[0] - pt[0], b0[1] - pt[1]) + Math.hypot(b0[0] - ref[0], b0[1] - ref[1]) * .25));
      [px0, py0] = cands[0];
    }
    return boxes.some(bx => ptInBox([px0, py0], bx)) ? null : [px0, py0];
  };

  const boxKey = bs => {
    let s = '';
    for (let i = 0; i < bs.length; i++) {
      const q = bs[i];
      s += `${Math.round(q[0] * 2)},${Math.round(q[1] * 2)},${Math.round(q[2] * 2)},${Math.round(q[3] * 2)};`;
    }
    return s;
  };
  function solveRoute(start, exit, b, bow, boxes, fallbackBoxes = null, hintMode = null) {
    if (boxes.some(bx => ptInBox(b, bx))) {
      const nudged = nudgeOutOfBoxes(b, exit, boxes);
      if (nudged && Math.hypot(nudged[0] - b[0], nudged[1] - b[1]) <= 16) b = nudged;
      else if (fallbackBoxes) return solveRoute(start, exit, b, bow, fallbackBoxes, null, hintMode);
      else if (nudged) b = nudged;
      else return null;
    }
    const hasStem = Math.hypot(exit[0] - start[0], exit[1] - start[1]) > .5;
    if (!boxes.some(bx => ptInBox(exit, bx))) {
      if (hasStem) {
        const bNum = typeof bow === 'number' ? bow : .18;
        const modes = hintMode !== null
          ? [...new Set([hintMode, 's', bNum, -bNum, 0, .28, -.28, .46, -.46, 'archU', 'archD', 'archL', 'archR', 'vhL', 'vhR'])]
          : [...new Set(['s', bNum, -bNum, 0, .28, -.28, .46, -.46, 'archU', 'archD', 'archL', 'archR', 'vhL', 'vhR'])];
        for (const md of modes) {
          const spec = buildStemBezierSpec(start, exit, b, md, 40);
          if (ptsClearBoxes(spec.pts, boxes, 3.2, 1.2) && isSmoothPts(spec.pts)) return spec;
        }
      } else {
        for (const bw of [...new Set([bow, -bow, bow ? bow * 1.85 : .22, bow ? -bow * 1.85 : -.22, .46, -.46, 'vhL', 'vhR', 'archL', 'archR', 'h', 'v', .68, -.68])]) {
          const spec = buildBezierSpec(exit, b, bw, 40);
          if (ptsClearBoxes(spec.pts, boxes, 3.2, 1.2) && isSmoothPts(spec.pts)) return spec;
        }
      }
    }
    const W = stageW, H0 = stageH, sUx = hasStem ? exit[0] - start[0] : 0, sUy = hasStem ? exit[1] - start[1] : 0;
    const minL = Math.min(...boxes.map(q => q[0])), minT = Math.min(...boxes.map(q => q[1]));
    const maxR = Math.max(...boxes.map(q => q[2])), maxD = Math.max(...boxes.map(q => q[3]));
    const clX = v => Math.max(6, Math.min(W - 6, v)), clY = v => Math.max(6, Math.min(H0 - 6, v));
    const dedupCoord = arr => {
      const sorted = [...arr].sort((a, b0) => a - b0), out = [];
      for (let i = 0; i < sorted.length; i++) if (!out.length || sorted[i] - out[out.length - 1] > 2.5) out.push(sorted[i]);
      return out;
    };
    const xs = dedupCoord([exit[0], b[0], 12, W - 12, ...boxes.flatMap(([l, , r]) => [clX(l - 4), clX(r + 4), clX(l - 12), clX(r + 12)]), clX(minL - 14), clX(maxR + 14)]);
    const ys = dedupCoord([exit[1], b[1], 12, H0 - 12, ...boxes.flatMap(([, t0, , d]) => [clY(t0 - 4), clY(d + 4), clY(t0 - 12), clY(d + 12)]), clY(minT - 14), clY(maxD + 14)]);
    const segClear = (p0, p1) => {
      for (let i = 0; i < boxes.length; i++) if (segHitsBox(p0, p1, boxes[i])) return false;
      return true;
    };
    const fwdOk = ps => { if (!hasStem) return true; for (let i = 1; i < ps.length; i++) { const dx = ps[i][0] - exit[0], dy = ps[i][1] - exit[1]; if (Math.hypot(dx, dy) > .5) return dx * sUx + dy * sUy >= -.05 } return true };
    const clearPath = ps => {
      if (!fwdOk(ps)) return false;
      for (let i = 1; i < ps.length; i++) if (!segClear(ps[i - 1], ps[i])) return false;
      return true;
    };
    const cost = ps => {
      let s0 = (ps.length - 2) * 10;
      for (let i = 1; i < ps.length; i++) s0 += Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][1] - ps[i - 1][1]);
      return s0;
    };
    const pickBest = cands => {
      const clearWays = cands.filter(clearPath).map(ps => [cost(ps), hasStem ? [start, ...ps] : ps]).sort((a, b0) => a[0] - b0[0]);
      for (let k = 0; k < Math.min(clearWays.length, 18); k++) {
        for (const rad of [24, 15, 8]) {
          const spec = roundedPolySpec(clearWays[k][1], rad);
          if (ptsClearBoxes(spec.pts, boxes, 3.2, 1.2) && isSmoothPts(spec.pts)) return { spec, clearWays };
        }
      }
      return { spec: null, clearWays };
    };
    // Phase 1: fast 1-bend & 2-bend orthogonal paths (avoids O(N^2) 3-bend grid whenever a simpler clear path exists)
    const fastWays = [[exit, b], [exit, [exit[0], b[1]], b], [exit, [b[0], exit[1]], b]];
    for (const x of xs) fastWays.push([exit, [x, exit[1]], [x, b[1]], b]);
    for (const y of ys) fastWays.push([exit, [exit[0], y], [b[0], y], b]);
    const p1 = pickBest(fastWays);
    if (p1.spec) return p1.spec;
    // Phase 2: pruned 3-bend paths (skip first segments that already collide or reverse the stem)
    const ways3 = [];
    const xsFromExit = xs.filter(x => (!hasStem || Math.abs(x - exit[0]) <= .5 || (x - exit[0]) * sUx >= -.05) && segClear(exit, [x, exit[1]]));
    const ysFromExit = ys.filter(y => (!hasStem || Math.abs(y - exit[1]) <= .5 || (y - exit[1]) * sUy >= -.05) && segClear(exit, [exit[0], y]));
    const ysToB = ys.filter(y => segClear([b[0], y], b));
    const xsToB = xs.filter(x => segClear([x, b[1]], b));
    for (const x of xsFromExit) for (const y of ysToB) ways3.push([exit, [x, exit[1]], [x, y], [b[0], y], b]);
    for (const y of ysFromExit) for (const x of xsToB) ways3.push([exit, [exit[0], y], [x, y], [x, b[1]], b]);
    const p2 = pickBest(ways3);
    if (p2.spec) return p2.spec;
    if (fallbackBoxes) return solveRoute(start, exit, b, bow, fallbackBoxes, null, hintMode);
    const bestRaw = p1.clearWays[0] || p2.clearWays[0];
    return bestRaw ? roundedPolySpec(bestRaw[1], 14) : null;
  }

  // Adaptive smooth Bezier routing first (avoids stiff 90-degree stair-steps through blocks!), with wide-radius rounded fallback
  function routeClean(e, start, exit, b, f, bow, opacity, boxes, fallbackBoxes = null, hintMode = null) {
    const rKey = `${Math.round(start[0] * 2)},${Math.round(start[1] * 2)}:${Math.round(exit[0] * 2)},${Math.round(exit[1] * 2)}:${Math.round(b[0] * 2)},${Math.round(b[1] * 2)}:${bow}:${stageW}x${stageH}:${boxKey(boxes)}|${fallbackBoxes ? boxKey(fallbackBoxes) : ''}`;
    let spec;
    if (e._routeKey === rKey) {
      spec = e._routeSpec;
    } else {
      spec = solveRoute(start, exit, b, bow, boxes, fallbackBoxes, hintMode);
      e._routeKey = rKey;
      e._routeSpec = spec;
    }
    if (spec) syncPathData(e, spec.d, spec.pts, f, opacity);
    else hideLine(e);
  }

  function lines(pr, wAt, xAt, [ox, oy], [x0, y0, x1, y1], drawn, fade, arrow, arrowOn, more = [], v = false) {
    if (cur?.incoming?.includes(pr.x) && xAt && !inPic(xAt)) xAt = incomingPoint();
    // Universal directional off-screen source badges across ALL segments (fixes zero-line & wrong-side bugs in s13/s15/s16/s19/s30/s31/s36)
    let nextPort = 0;
    const port = (p, name, color, line) => {
      if (!p || inPic(p)) return p;
      const e = sourcePorts[nextPort];
      if (!e) return p;
      const dirTag = p[1] < 0 ? '上方' : p[1] > stageH ? '下方' : p[0] < 0 ? '左侧' : '右侧';
      const labelTxt = name.includes('·') ? name : `${name} · ${dirTag}`;
      if (e._txt !== labelTxt) { e.textContent = labelTxt; e._txt = labelTxt; e._w = 0; e._h = 0 }
      e.style.borderColor = deep(color);
      e.style.display = 'block';
      if (!e._w) { e._w = e.offsetWidth || 120; e._h = e.offsetHeight || 22 }
      const hw = Math.max(58, e._w / 2 + 4), hh = e._h / 2 + 2;
      const preferLeft = p[0] < 0 || (p[0] <= stageW && (cardState ? cardState[0] > stageW / 2 : false));
      const pBox = [x0 - 4, y0 - 4, x1 + 4, y1 + 4];
      const takenP = [cardState, pBox, ...sourceBoxes.values()].filter(Boolean);
      const freeSlot = (cx0, cy0) => cx0 - hw >= 4 && cx0 + hw <= stageW - 4 && cy0 - hh >= 4 && cy0 + hh <= stageH - 4
        && !takenP.some(([l, t0, r0, b0]) => cx0 - hw < r0 + 4 && cx0 + hw > l - 4 && cy0 - hh < b0 + 4 && cy0 + hh > t0 - 4);
      let sx = preferLeft ? hw + 8 : stageW - hw - 8;
      let sy = p[1] < 0 ? hh + 6 : p[1] > stageH ? stageH - hh - 6 : Math.max(hh + 8, Math.min(stageH - hh - 8, p[1]));
      if (p[1] < 0 || p[1] > stageH) {
        let placed = false;
        for (let row = 0; row < 3 && !placed; row++) {
          const ry = p[1] < 0 ? hh + 6 + row * 28 : stageH - hh - 6 - row * 28;
          for (let col = 0; col < 5; col++) {
            const rx = preferLeft ? hw + 8 + col * (hw * 2 + 10) : stageW - hw - 8 - col * (hw * 2 + 10);
            if (freeSlot(rx, ry)) { sx = rx; sy = ry; placed = true; break }
          }
        }
      } else if (!freeSlot(sx, sy)) {
        for (let dy = 0; dy <= 120; dy += 28) {
          if (freeSlot(sx, sy + dy)) { sy += dy; break }
          if (freeSlot(sx, sy - dy)) { sy -= dy; break }
          const altX = preferLeft ? stageW - hw - 8 : hw + 8;
          if (freeSlot(altX, sy + dy)) { sx = altX; sy += dy; break }
        }
      }
      nextPort++;
      put(e, [sx, sy]);
      sourceBoxes.set(line, [sx - hw, sy - hh, sx + hw, sy + hh]);
      const attach = p[0] < 0 ? [sx + hw - 2, sy] : p[0] > stageW ? [sx - hw + 2, sy] : [sx, sy + (p[1] < 0 ? hh - 1 : -hh + 1)];
      sourceOrigins.set(line, attach);
      return attach;
    };
    if (geo.row) wAt = port(wAt, pr.wName || (pr.Y ? '旧四路 / 系数' : pr.W?.t?.name || '权重'), pr.cw, lw);
    if (geo.col && !(cur?.incoming?.includes(pr.x))) xAt = port(xAt, pr.xName || (pr.Y ? pr.Y.t.name : pr.X?.t?.name || '输入'), pr.cx, lx);
    more = more.map(([p, c, name], i) => [geo.ex?.[i] ? port(p, name || formula.querySelectorAll('.stk>div')[i]?.textContent.trim() || pr.Q?.t?.name || '前面输入', c, lxs[i]) : p, c]);

    const pillBox = [x0 - 2, y0 - 2, x1 + 2, y1 + 2], boxes = [pillBox];
    let cardBox = null;
    if (cardState) {
      cardBox = [cardState[0] - 2, cardState[1] - 2, cardState[2] + 2, cardState[3] + 2];
      boxes.unshift(cardBox);
    }
    const labelBoxes = activeSegLabelBoxes(2.5, 2, true);
    const rawHit = ([x, y], [l, t0, r, d]) => x > l + 2 && x < r - 2 && y > t0 + 1.5 && y < d - 1.5;
    const obstaclesFor = (line, a, b, isOut = false) => {
      const extra = labelBoxes.filter(lb => !rawHit(b, lb) && !rawHit(a, lb));
      for (const [ln, sbx] of sourceBoxes) if (ln !== line) extra.push(sbx);
      if (!isOut && targetState && !rawHit(b, [targetState[0] - 8, targetState[1] - 8, targetState[0] + 8, targetState[1] + 8])) {
        extra.push([targetState[0] - 8, targetState[1] - 8, targetState[0] + 8, targetState[1] + 8]);
      }
      return extra.length ? boxes.concat(extra) : boxes;
    };
    const stack = !!formula.querySelector('.stk');
    const pickPort = (a, b, bow, isOut = false, isStackRight = false, isStackLeft = false, obs = boxes) => {
      const gap = 5, ax = Math.max(x0 + 2, Math.min(x1 - 2, a[0])), ay = Math.max(y0 + 2, Math.min(y1 - 2, a[1]));
      const cands = isOut
        ? (b[1] > y1 + 10 ? [[[ax, y1], [ax, y1 + gap]]] : b[1] < y0 - 10 ? [[[ax, y0], [ax, y0 - gap]]] : b[0] > (x0 + x1) / 2 ? [[[x1, ay], [x1 + gap, ay]]] : [[[x0, ay], [x0 - gap, ay]]])
            .concat([[[ax, y1], [ax, y1 + gap]], [[x1, ay], [x1 + gap, ay]], [[x0, ay], [x0 - gap, ay]], [[ax, y0], [ax, y0 - gap]]])
        : isStackRight ? [[[x1, ay], [x1 + gap, ay]], [[ax, y1], [ax, y1 + gap]], [[ax, y0], [ax, y0 - gap]], [[x0, ay], [x0 - gap, ay]]]
        : isStackLeft ? [[[x0, ay], [x0 - gap, ay]], [[ax, y1], [ax, y1 + gap]], [[ax, y0], [ax, y0 - gap]], [[x1, ay], [x1 + gap, ay]]]
        : (b[1] < (y0 + y1) / 2
            ? [[[ax, y0], [ax, y0 - gap]], [[ax, y1], [ax, y1 + gap]], [[x1, ay], [x1 + gap, ay]], [[x0, ay], [x0 - gap, ay]]]
            : [[[ax, y1], [ax, y1 + gap]], [[ax, y0], [ax, y0 - gap]], [[x1, ay], [x1 + gap, ay]], [[x0, ay], [x0 - gap, ay]]]);
      const valid = cands.filter(([st, ex]) => ex[0] >= 3 && ex[0] <= stageW - 3 && ex[1] >= 3 && ex[1] <= stageH - 3 && obs.every(bx => !ptInBox(ex, bx)) && (!cardBox || !segHitsBox(st, ex, cardBox)));
      const allowed = valid.filter(([st]) => !(obs !== boxes && !isOut && !isStackLeft && !isStackRight && Math.abs(st[0] - a[0]) > 90));
      for (const [st, ex] of allowed) {
        for (const md of ['s', typeof bow === 'number' ? bow : 0, .24, -.24, 'archU', 'archD', 'vhL', 'vhR', 'archL', 'archR']) {
          const spec = buildStemBezierSpec(st, ex, b, md, 24);
          if (ptsClearBoxes(spec.pts, obs, 3.2, 1.2) && isSmoothPts(spec.pts)) return [st, ex, md];
        }
      }
      if (allowed.length) return [allowed[0][0], allowed[0][1], null];
      if (obs !== boxes) return pickPort(a, b, bow, isOut, isStackRight, isStackLeft, boxes);
      const fb = valid[0] || cands[0];
      return [fb[0], fb[1], null];
    };
    const link = (e, a, b, f, bow, opacity, isOut = false, sr = false, sl = false) => {
      const otherSrc = [...sourceBoxes.entries()].filter(([ln]) => ln !== e).map(([, sbx]) => sbx);
      const minBoxes = otherSrc.length ? boxes.concat(otherSrc) : boxes;
      const obs = obstaclesFor(e, a, b, isOut);
      const pKey = `${Math.round(a[0] * 2)},${Math.round(a[1] * 2)}:${Math.round(b[0] * 2)},${Math.round(b[1] * 2)}:${bow}:${isOut ? 1 : 0}:${sr ? 1 : 0}:${sl ? 1 : 0}:${Math.round(x0 * 2)},${Math.round(y0 * 2)},${Math.round(x1 * 2)},${Math.round(y1 * 2)}:${stageW}x${stageH}:${boxKey(obs)}`;
      let portRes;
      if (e._portKey === pKey) portRes = e._portRes;
      else { portRes = pickPort(a, b, bow, isOut, sr, sl, obs); e._portKey = pKey; e._portRes = portRes }
      const [st, ex, hintMode] = portRes;
      routeClean(e, st, ex, b, f, bow, opacity, obs, obs !== minBoxes ? minBoxes : null, hintMode);
      const pin = !isOut && !sourceOrigins.has(e) && sourcePins.get(e);
      if (pin && f > .65 && opacity > .25 && e.style.display === 'block') {
        pin.style.background = e.style.stroke;
        put(pin, b, opacity);
      }
    };
    lw.style.stroke = deep(pr.cw); lx.style.stroke = deep(pr.cx);
    if (v) {
      more.forEach(([p, c], i) => { const e = lxs[i], sw = geo.ex?.[i]; if (!e || !sw || !p || !inPic(p)) return; e.style.stroke = deep(c); link(e, [x0 + sw[0], y0 + sw[1]], p, drawn, stack ? 'h' : 'v', fade, false, stack && p[0] >= (x0 + x1) / 2, stack && p[0] < (x0 + x1) / 2) });
      if (geo.row && wAt && inPic(wAt)) link(lw, [x0 + geo.row[0], y0 + geo.row[1]], wAt, drawn, stack ? 'h' : 'v', fade, false, stack && wAt[0] >= (x0 + x1) / 2, stack && wAt[0] < (x0 + x1) / 2);
      if (geo.col && xAt && inPic(xAt)) link(lx, [x0 + geo.col[0], y0 + geo.col[1]], xAt, drawn, stack ? 'h' : 'v', fade, false, stack && xAt[0] >= (x0 + x1) / 2, stack && xAt[0] < (x0 + x1) / 2);
    } else {
      more.forEach(([p, c], i) => { const e = lxs[i], sw = geo.ex?.[i]; if (!e || !sw || !p || !inPic(p)) return; e.style.stroke = deep(c); const a = [x0 + sw[0] + sw[2], y0 + sw[1]], toRight = p[0] > (x0 + x1) / 2; link(e, toRight ? a : [x0 + sw[0] - sw[2], y0 + sw[1]], p, drawn, stack ? 'h' : i % 2 ? .14 : -.14, fade, false, toRight && stack, !toRight && stack) });
      if (geo.row && wAt && inPic(wAt)) link(lw, [x0 + geo.row[0], y0 + geo.row[1]], wAt, drawn, .20, fade, false, stack && wAt[0] >= (x0 + x1) / 2, stack && wAt[0] < (x0 + x1) / 2);
      if (geo.col && xAt && inPic(xAt)) link(lx, [x0 + geo.col[0], y0 + geo.col[1]], xAt, drawn, -.20, fade, false, stack && xAt[0] >= (x0 + x1) / 2, stack && xAt[0] < (x0 + x1) / 2);
    }
    if (ox == null) return null;
    // Prefer bottom/value anchor of #dotpill for output write arrow so it stays visually separated from input read ports
    const valCx = geo.val ? x0 + geo.val[0] : (x0 + x1) / 2, valCy = geo.val ? y0 + geo.val[1] : y1;
    const ex = Math.max(x0 + 4, Math.min(x1 - 4, ox > x1 + 24 ? x1 : ox < x0 - 24 ? x0 : valCx));
    const ey = Math.max(y0 + 4, Math.min(y1 - 4, oy > y1 + 12 ? y1 : oy < y0 - 12 ? y0 : valCy));
    if (!inPic([ox, oy])) return [ex, ey];
    if (arrow > 0 && arrowOn > 0) {
      const tgtPt = markTarget([ox, oy], pr.co, pr.O) || [ox, oy];
      link(lo, [ex, ey], tgtPt, arrow, Math.hypot(tgtPt[0] - ex, tgtPt[1] - ey) > 130 ? .10 : 0, arrowOn, true);
    }
    return [ex, ey];
  }

  const inPic = ([a, b]) => a >= 0 && a <= stageW && b >= 0 && b <= stageH;
  const fromAbove = (p, x) => inPic(p) ? p : [x, 14];
  const sourcePoint = (p, line, x) => inPic(p) ? p : sourceOrigins.get(line) || fromAbove(p, x);
  const towardOf = all => { const pts = all.filter(inPic).length ? all.filter(inPic) : all; return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] };

  // Smooth quadratic trajectory around card/pill obstacles so flying cells never cross formula pills or card headers
  function swoopAround([sx, sy], [tx, ty], t, avoidBoxes) {
    if (t <= 0) return [sx, sy];
    if (t >= 1) return [tx, ty];
    let hitL = 1e9, hitT = 1e9, hitR = -1e9, hitB = -1e9, anyHit = false;
    for (const bx of avoidBoxes) {
      if (!bx) continue;
      const padBx = [bx[0] - 24, bx[1] - 12, bx[2] + 24, bx[3] + 12];
      if (!ptInBox([tx, ty], padBx) && segHitsBox([sx, sy], [tx, ty], padBx)) {
        anyHit = true;
        hitL = Math.min(hitL, padBx[0]); hitT = Math.min(hitT, padBx[1]);
        hitR = Math.max(hitR, padBx[2]); hitB = Math.max(hitB, padBx[3]);
      }
    }
    if (anyHit) {
      const sideX = Math.abs(sx - hitL) + Math.abs(tx - hitL) <= Math.abs(sx - hitR) + Math.abs(tx - hitR)
        ? Math.max(12, hitL - 14) : Math.min(stageW - 12, hitR + 14);
      const cy = (sy + ty) / 2, u1 = 1 - t;
      return [u1 * u1 * sx + 2 * u1 * t * sideX + t * t * tx, u1 * u1 * sy + 2 * u1 * t * cy + t * t * ty];
    }
    return [sx + (tx - sx) * t, sy + (ty - sy) * t];
  }

  // ---- Dimension rulers along tensor edges (strictly viewport-clamped so labels are never sliced at screen borders!)
  const DIMS = Array.from({ length: 6 }, () => ({ p: makeLine('dl dim', false), t: el('dot-dim'), tw: 0, th: 0, txt: '' }));
  let dimsFor = null, dimsSpots = [];
  function dims(pr, o, result = true) {
    const cp = camera.position, d00 = cp.distanceTo(controls.target) * .004, q = v => Math.round(v / Math.max(1e-4, d00));
    const dimLinePts = ALL_LINES.filter(p => p.style.display === 'block' && p._pts?.length >= 2 && +(p.style.opacity || 1) >= .15).map(p => p._pts);
    const lineSig = dimLinePts.map(pts => `${Math.round(pts[0][0] / 6)}:${Math.round(pts[0][1] / 6)}>${Math.round(pts.at(-1)[0] / 6)}:${Math.round(pts.at(-1)[1] / 6)}`).join('|');
    const key = [cur?.n, word, pr.out, result ? 1 : 0, q(cp.x), q(cp.y), q(cp.z), cardState ? Math.round(cardState[1] / 8) : -1, cardState ? Math.round((cardState[3] - cardState[1]) / 24) : -1, pillState ? `${Math.round(pillState[0] / 8)}:${Math.round(pillState[1] / 8)}` : -1, lineSig, stageW, stageH].join();
    const find = key !== dimsFor; if (find) { dimsFor = key; dimsSpots = [] }
    const T = words.length, cx = ([a, b, c, d]) => [(a + c) / 2, (b + d) / 2];
    const stacked = b => b.div[2] > 1 && b.t.cols > 1;
    const axes = [];
    for (const b of result ? [pr.X, pr.O] : [pr.X]) {
      const per = b.t.cols, Hn = b.t.deck?.n || 1, m = stacked(b) ? per : b.alt === 'y' ? per * Hn : per > 1 ? per : Hn;
      axes.push([b, 'words', T, `${T} 个词`]);
      const unit = b.t.deck?.kind === 'stream' ? '路' : '头';
      axes.push([b, 'cols', m, stacked(b) ? `每${unit} ${per} 个数` : `每个词 ${b === pr.X ? pr.n : pr.N} 个数`]);
      if (stacked(b)) {
        const [a0, a1] = [px(dataAt(b, 0, 0)), px(dataAt(b, 0, per - 1))], short = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) < 24;
        axes.push([b, 'depth', Hn, short ? `${Hn} ${unit} × 每${unit} ${per} 个数` : `${Hn} ${unit}`]);
      }
    }
    const litBoxes = !find ? [] : look.meshes.filter(m => m.visible && (m.material.uniforms.uDim.value < .5 || m.material.uniforms.uF0.value.x <= m.material.uniforms.uF1.value.x)).map(m => screenBox(m.userData.block));
    const taken = !find ? [] : [cardState, pillState, targetState ? [targetState[0] - 10, targetState[1] - 10, targetState[0] + 10, targetState[1] + 10] : null, ...activeSegLabelBoxes(3, 3, true), ...litBoxes].filter(Boolean);
    const inBounds = (r, pad = 6) => r[0] >= pad && r[1] >= pad && r[2] <= stageW - pad && r[3] <= stageH - pad;
    const hits = (r, pad = 2) => !inBounds(r, 5) || taken.some(q0 => overArea([r[0] - pad, r[1] - pad, r[2] + pad, r[3] + pad], q0) > 0)
      || dimLinePts.some(pts => pts.slice(1).some((p, k0) => segHitsBox(pts[k0], p, [r[0] - 2, r[1] - 2, r[2] + 2, r[3] + 2])));
    const lineClear = (p0, p1) => p0[0] >= 5 && p0[0] <= stageW - 5 && p0[1] >= 5 && p0[1] <= stageH - 5 && p1[0] >= 5 && p1[0] <= stageW - 5 && p1[1] >= 5 && p1[1] <= stageH - 5
      && taken.every(bx => !segHitsBox(p0, p1, [bx[0] + 1, bx[1] + 1, bx[2] - 1, bx[3] - 1]));
    const drawRuler = (d, text, { p0, p1, nx, ny, f }) => {
      d.p.setAttribute('d', `M${p0[0] - nx * 3.5} ${p0[1] - ny * 3.5} L${p0[0] + nx * 3.5} ${p0[1] + ny * 3.5} M${p0[0]} ${p0[1]} L${p1[0]} ${p1[1]} M${p1[0] - nx * 3.5} ${p1[1] - ny * 3.5} L${p1[0] + nx * 3.5} ${p1[1] + ny * 3.5}`);
      d.p.style.display = 'block'; d.p.style.opacity = o; d.p.style.strokeDasharray = ''; d.p.style.strokeDashoffset = 0;
      if (d.txt !== text || d.tw <= 0) { d.t.textContent = text; d.t.style.display = 'block'; d.tw = d.t.offsetWidth || 68; d.th = d.t.offsetHeight || 20; d.txt = text }
      const px0 = p0[0] + (p1[0] - p0[0]) * f + nx * 8, py0 = p0[1] + (p1[1] - p0[1]) * f + ny * 8;
      const txA = nx < -.35 ? -1 : nx > .35 ? 0 : -.5, tyA = ny < -.35 ? -1 : ny > .35 ? 0 : -.5;
      put(d.t, [px0, py0], o);
      d.t.style.transform = `translate(${txA * 100}%, ${tyA * 100}%)`;
      return [px0 + txA * d.tw, py0 + tyA * d.th, px0 + (txA + 1) * d.tw, py0 + (tyA + 1) * d.th];
    };

    axes.forEach(([b, kind, k, text], i) => {
      const d = DIMS[i]; if (!d) return;
      if (k < 2) { hideLine(d.p); d.t.style.display = 'none'; return }
      if (!find) {
        const sp = dimsSpots[i];
        if (!sp) { hideLine(d.p); d.t.style.display = 'none' } else drawRuler(d, text, sp);
        return;
      }
      const sb = screenBox(b), [mx, my] = cx(sb), cands = [];
      const pushEdge = (a2, b2, extraOff = 10) => {
        const L0 = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
        if (L0 < 20) return;
        let nx0 = -(b2[1] - a2[1]) / L0, ny0 = (b2[0] - a2[0]) / L0;
        if (nx0 * ((a2[0] + b2[0]) / 2 - mx) + ny0 * ((a2[1] + b2[1]) / 2 - my) < 0) { nx0 = -nx0; ny0 = -ny0 }
        cands.push([[a2[0] + nx0 * extraOff, a2[1] + ny0 * extraOff], [b2[0] + nx0 * extraOff, b2[1] + ny0 * extraOff], nx0, ny0]);
      };
      const horizWords = kind === 'words' && b.orient !== 'row', horizCols = kind === 'cols' && b.orient === 'row';
      if (horizWords || horizCols) {
        const tZ = px(V(b.x0, b.y1, b.z0))[1] < px(V(b.x0, b.y1, b.z1))[1] ? b.z0 : b.z1;
        const bZ = px(V(b.x0, b.y0, b.z0))[1] > px(V(b.x0, b.y0, b.z1))[1] ? b.z0 : b.z1;
        const tA = px(V(b.x0, b.y1, tZ)), tB = px(V(b.x1, b.y1, tZ));
        let extraTop = 10;
        if (horizWords && WORDLS.get(cur?.n)?.b === b) {
          for (const wEl of WORDLS.get(cur.n).ws) { const wr = rectOfLabel(wEl); if (wr) extraTop = Math.max(extraTop, Math.min(tA[1], tB[1]) - wr.top + 10) }
        }
        pushEdge(tA, tB, extraTop);
        pushEdge(px(V(b.x0, b.y0, bZ)), px(V(b.x1, b.y0, bZ)), 10);
      } else if (kind === 'words' || kind === 'cols') {
        const lZ = px(V(b.x0, b.y1, b.z0))[0] < px(V(b.x0, b.y1, b.z1))[0] ? b.z0 : b.z1;
        const rZ = px(V(b.x1, b.y1, b.z0))[0] > px(V(b.x1, b.y1, b.z1))[0] ? b.z0 : b.z1;
        pushEdge(px(V(b.x0, b.y1, lZ)), px(V(b.x0, b.y0, lZ)), 10);
        pushEdge(px(V(b.x1, b.y1, rZ)), px(V(b.x1, b.y0, rZ)), 10);
      } else {
        for (const [xC, yC] of [[b.x0, b.y1], [b.x1, b.y1], [b.x1, b.y0]]) pushEdge(px(V(xC, yC, b.z1)), px(V(xC, yC, b.z0)), 10);
      }
      let chosen = null, chosenBox = null;
      for (const [p0, p1, nx, ny] of cands) {
        if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 24 || !lineClear(p0, p1)) continue;
        for (const f of [.5, .35, .65, .22, .78]) {
          const cand = { p0, p1, nx, ny, f }, q0 = drawRuler(d, text, cand);
          if (!hits(q0)) { chosen = cand; chosenBox = q0; break }
        }
        if (chosen) break;
      }
      if (!chosen) { hideLine(d.p); d.t.style.display = 'none'; dimsSpots[i] = null }
      else {
        dimsSpots[i] = chosen;
        taken.push(chosenBox, [Math.min(chosen.p0[0], chosen.p1[0]) - 4, Math.min(chosen.p0[1], chosen.p1[1]) - 4, Math.max(chosen.p0[0], chosen.p1[0]) + 4, Math.max(chosen.p0[1], chosen.p1[1]) + 4]);
      }
    });
  }

  const ALL = [['pick', .14], ['pull', .3], ['mul', .2], ['sum', .2], ['place', .16]];
  function allPhase(u) { let a = 0; for (const [ph, d] of ALL) { if (u < a + d || ph === 'place') return [ph, clamp((u - a) / d)]; a += d } }
  function dotScene(s, bi, P, phase, u) {
    camera.updateMatrixWorld();
    hideDots();
    const pr = P.pr, oAt = P.oAt, [ox, oy] = px(oAt), gap = P.n > P.cs.length ? 1 : 0;
    const aAt = phase === 'place' || !P.aAt ? oAt : P.aAt;
    const sh = shortStage(), micro = microStage(), dy = dyOf(), tb = tabGap(), visIdx = micro ? [] : sh && P.rows.length > 5 ? [0, 1, 2, P.rows.length - 1] : P.rows.map((_, i) => i), gapPos = sh && P.rows.length > 5 ? 3 : SHOW.length;
    const HEAD = P.fill(phase === 'sum' && u > .7 || phase === 'place' ? fmt(P.total) : '?'), FULL = micro ? HEAD : HEAD + (visIdx.length + gap) * dy + (sh ? 16 : 28) + Math.round((P.extra || 0) * (sh ? .68 : 1)), ROW0 = HEAD + (sh ? 4 : 6);
    const seq = P.carry ? s.beats.map((b, i) => b.op[P.carry] ? i : -1).filter(i => i >= 0) : bi;
    const later2 = ['fetch', 'mul', 'sum', 'place'].includes(phase), xLine = later2 && P.xLate ? P.xLate : P.xLine;
    const sp = chooseSpot(s, seq, () => { const [a, b] = px(aAt); return [a, b, a, b] }, FULL + geo.ph + tb,
      () => [px(oAt), px(P.wLine), px(P.xLine), ...P.cs.slice(0, 2).map(c => px(P.wAt(c)))],
      () => [pr.W, pr.X, pr.O].map(screenBox), P.upright ? () => [px(oAt), px(P.wLine), px(xLine), ...(P.more ? P.more().map(([p]) => px(p)) : [])] : null);
    const [ax, ay] = px(aAt), { x, y } = spotAt(sp, [ax, ay, ax, ay], FULL + geo.ph + tb);
    const sumHtml = P.sumSay ? P.sumSay : P.post ? `这 ${P.cs.length} 个乘积加起来 = <b>${fmt(P.post.sum)}</b>，再过 ${P.post.name} = <b>${fmt(P.total)}</b>`
      : `这 ${P.cs.length} 个乘积${gap ? ` + 其余 ${P.n - P.cs.length} 个` : ''}，加起来 = <b>${fmt(P.total)}</b>`;
    const sumLineCount = (sumHtml.match(/<br>/g) || []).length + 1;
    const sumH = sumLineCount * (sh ? 15 : 21) + 4;
    const collapse = phase === 'sum' ? ease((u - .58) / .38) : 0, sumCardH = micro ? HEAD : HEAD + sumH + (sh ? 10 : 14);
    const h = micro || phase === 'pick' ? HEAD : phase === 'pull' ? HEAD + (FULL - HEAD) * ease(u * 2) : phase === 'sum' ? FULL + (sumCardH - FULL) * collapse : phase === 'place' ? HEAD + (sumCardH - HEAD) * (1 - ease(u * 2)) : FULL;
    const first = phase === 'pick' ? ease(u * 2) : 1, placed = phase === 'place' ? ease(u) : 0;
    const more = P.more ? P.more().map(([p, c, nm]) => [px(p), c, nm]) : [];
    let tab = placeCard(x, y, h, first, towardOf([px(aAt), px(P.wLine), px(xLine)]), [pr.W, pr.X, pr.O].map(faceBox), P.upright, [px(oAt), px(P.wLine), px(xLine), ...more.map(([p]) => p)]);
    if (P.stackOf && !s.focusLabels && stageW >= 700 && !sh) tab = tabLeftOf(P.stackOf, more.map(m => m[0]), first);
    later = P.dimensions === false || micro ? null : () => dims(pr, first, false);
    const drawn = phase === 'pick' ? ease(u * 1.6 - .3) : 1;
    const showOutArrow = phase === 'place' ? 1 : phase === 'sum' ? ease((u - .45) / .5) : 0;
    const ty = (tab[1] + tab[3]) / 2, [wE, xE] = P.ends ? P.ends() : [];
    const [ex, ey] = lines(pr, wE ? nearer(wE, ty) : px(P.wLine), xE ? nearer(xE, ty) : px(xLine), [ox, oy], tab, drawn, 1 - placed * .7, showOutArrow, phase === 'place' ? 1 : .75, more, P.upright);
    if (showOutArrow <= 0 && inPic([ox, oy])) markTarget([ox, oy], pr.co, pr.O);
    if (phase === 'pull') {
      const kIdx = Math.min(P.wv.length - 1, Math.floor(u * 2 * P.wv.length) % P.wv.length), prog = ease((u * 2) % 1);
      glideOnLine(runW, P.stackOf ? lxs[P.more().length - 1] : lw, fmt(P.wv[kIdx], 3), pr.cw, prog);
      glideOnLine(runX, P.stackOf ? lxs[0] : lx, fmt(P.xv[kIdx], 3), P.xcol ? P.xcol(kIdx) : pr.cx, prog);
    }
    if (phase === 'place') {
      const v = ease(u * 1.2);
      P.drop.textContent = fmt(P.total, 3);
      if (v < 1) dropAlongArrow(P.drop, v, [ex, ey], [ox, oy]);
    } else P.drop.textContent = '';
    if (micro || phase === 'pick' || phase === 'place') return;
    const rowY = vi => y + ROW0 + (gap && vi >= gapPos ? vi + 1 : vi) * dy, colX = x + (sh ? 18 : 24);
    const sy1 = y + HEAD + sumH / 2, sumDest = [colX + 22, sy1];
    if (gap) { P.note.textContent = `⋮ 其余 ${P.n - visIdx.length} 对`; put(P.note, [colX + (sh ? 42 : 52), y + ROW0 + gapPos * dy], phase === 'pull' ? ease((u - .84) / .16) : phase === 'mul' ? 1 : 1 - ease(u * 2), 1, true) }
    visIdx.forEach((k, vi) => {
      const r = P.rows[k], at = rowY(vi), stag = vi / visIdx.length * .45;
      const out = phase === 'sum' ? ease((u - stag * .5) / .5) : 0;
      if (out >= 1) return;
      const v = phase === 'pull' ? ease((u - stag) / .55) : 1; if (v <= 0) return;
      const late = P.late?.(k), vx = !late ? v : later2 ? (phase === 'fetch' ? ease((u - .1) / .6) : 1) : 0;
      const tw = [colX - (1 - v) * 8, at], tx = [colX + (sh ? 26 : 34) - (1 - vx) * 8, at];
      const toS = p => [p[0] + (sumDest[0] - p[0]) * out, p[1] + (sumDest[1] - p[1]) * out];
      put(r.w, toS(tw), (1 - out) * Math.min(1, v * 2.6), .72 + .28 * v);
      if (vx > 0) put(r.x, toS(tx), (1 - out) * Math.min(1, vx * 2.6), .72 + .28 * vx);
      if (Math.min(v, vx) > .85) put(r.times, [colX + (sh ? 13 : 17), at + (sumDest[1] - at) * out], (1 - out) * clamp((Math.min(v, vx) - .85) / .15));
      const m = phase === 'mul' ? ease((u - stag) / .55) : ['sum', 'place'].includes(phase) ? 1 : 0;
      const compact = (CW < 360 || sh) && P.rowNote;
      r.txt.style.lineHeight = compact ? '11px' : '';
      const note = P.rowNote ? ` <span style="color:#5c6963;${compact ? 'display:block;font-size:9px' : ''}">${P.rowNote(k)}</span>` : '';
      const txOff = colX + (sh ? 42 : 52);
      if (v >= .92 && vx >= .92) { r.txt.innerHTML = P.rowText ? P.rowText(k, phase, m, P.pv[k]) : `${fmt(P.wv[k], 4)} × ${fmt(P.xv[k], 3)}${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(P.pv[k], 4)}</b></span>` : ''}${note}`; put(r.txt, [txOff, at], (1 - out) * clamp((Math.min(v, vx) - .92) / .08), 1, true) }
      else if (v >= .92 && late) { r.txt.innerHTML = `${fmt(P.wv[k], 4)} × <span style="color:#5c6963">？${P.lateSay || ''}</span>`; put(r.txt, [txOff, at], 1, 1, true) }
    });
    if (phase === 'sum') { const v = ease((u - .55) / .4); if (v > 0) { P.sumLine.innerHTML = sumHtml; const sy0 = rowY(visIdx.length); put(P.sumLine, [x + 14, sy0 + (sy1 - sy0) * collapse], v, 1, true) } }
  }

  const normProduct = (s, [g, x, out]) => {
    const G = B[id(s, g)], X = B[id(s, x)], O = B[id(s, out)];
    return { w: g, x, out, W: G, X, O, cw: onCard(look.palette[G.comp][1]), cx: onCard(look.palette[X.comp][0]), co: onCard(look.palette[O.comp][0]), n: X.t.cols, N: O.t.cols };
  };
  const gammaAt = (b, i) => V((b.x0 + b.x1) / 2, along(b, i, b.t.cols, 'y'), b.z1);
  const rmsMemo = new Map();
  function rmsOf(x, j, n, eps) {
    const k = cur.layer + ':' + x + ':' + j; if (rmsMemo.has(k)) return rmsMemo.get(k);
    let q = 0; for (let c = 0; c < n; c++) { const v = demo.at(x, j, c); q += v * v }
    const r = { ms: q / n, rms: Math.sqrt(q / n + eps) }; rmsMemo.set(k, r); return r;
  }
  const normWhole = pr => `<i>整块</i>${inputName(pr)} <b>[6, ${pr.n}]</b> → ${pr.O.t.name} <b>[6, ${pr.N}]</b>，形状不变<br>每个词只用自己的 ${pr.n} 个数，和 γ <b>[${pr.n}]</b>`;
  const normForm = (pr, rms, value) => `<i class="sw col" style="background:${pr.cx}"></i> ÷ ${fmt(rms)} × <i class="sw row" style="background:${pr.cw};width:8px;height:18px"></i> = <b>${value}</b>`;
  const RMS_PH = ['pick', 'square', 'mean'];
  const NORM_ALL = [['pick', .1], ['square', .22], ['mean', .2], ['scale', .26], ['place', .22]];
  function normAll(u) { let a = 0; for (const [ph, d] of NORM_ALL) { if (u < a + d || ph === 'place') return [ph, clamp((u - a) / d)]; a += d } }
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

  function pairScene(s, bi, E, phase, u) {
    camera.updateMatrixWorld(); hideDots();
    const pr = E.pr, n = E.n, j = E.j, R = phase === 'place' ? Math.max(0, placedAt(u, n)) : 0, [ox, oy] = px(dataAt(pr.O, j, R));
    const sh = shortStage(), micro = microStage(), dy = dyOf(), tb = tabGap(), visIdx = micro ? [] : sh && E.rows.length > 5 ? [0, 1, 2, E.rows.length - 1] : E.rows.map((_, i) => i), gapPos = sh && E.rows.length > 5 ? 3 : SHOW.length;
    const HEAD = setCard(E.tag, E.whole, E.one(R), E.form(phase === 'place' ? fmt(E.value(R)) : phase === 'pair' && u > .75 ? fmt(E.value(0)) : '?'), E.key), FULL = micro ? HEAD : HEAD + pairsOf(), ROW0 = HEAD + (sh ? 4 : 6);
    const cell0 = () => px(dataAt(pr.O, j, 0));
    const sp = chooseSpot(s, bi, () => { const [a, b] = cell0(); return [a, b, a, b] }, FULL + geo.ph + tb, () => [cell0(), ...E.points()], () => [pr.W, pr.X, pr.O].map(screenBox));
    const [ax, ay] = cell0(), { x, y } = spotAt(sp, [ax, ay, ax, ay], FULL + geo.ph + tb);
    const grown = micro || phase === 'pick' ? 0 : phase === 'place' ? 1 - ease(u * 3) : phase === 'pair' && E.grow ? ease(u * 2) : 1, h = HEAD + (FULL - HEAD) * grown;
    const vis = phase === 'pick' ? ease(u * 2) : 1;
    const tab = placeCard(x, y, h, vis, towardOf([cell0(), ...E.points()]), [pr.W, pr.X, pr.O].map(faceBox), false, [cell0(), ...E.points()]);
    const fresh = phase === 'pick' ? ease(u * 1.6 - .3) : phase === 'pair' ? ease(u * 2.5) : 1;
    const showOut = phase === 'place' ? 1 : phase === 'pair' ? ease((u - .65) / .35) : 0;
    const [ex, ey] = lines(pr, px(E.wAt(R)), px(E.xAt(R)), [ox, oy], tab, fresh, 1, showOut, phase === 'place' ? 1 : .75);
    if (showOut <= 0 && inPic([ox, oy])) markTarget([ox, oy], pr.co, pr.O);
    if (phase === 'pick') { later = micro ? null : () => dims(pr, vis, false); return }
    if (phase === 'pair') {
      const prog = ease((u * 1.8) % 1);
      glideOnLine(runW, lw, fmt(E.value(0), 3), pr.cw, prog);
      glideOnLine(runX, lx, fmt(demo.at(pr.x, j, 0), 3), pr.cx, prog);
    }
    if (phase === 'place') { E.drop.textContent = fmt(E.value(0), 3); const v = ease(u / .3); if (v < 1) dropAlongArrow(E.drop, v, [ex, ey], [ox, oy]) } else E.drop.textContent = '';
    if (micro) return;
    const rowY = vi => y + ROW0 + (vi < gapPos ? vi : vi + 1) * dy, colX = x + (sh ? 18 : 24);
    E.note.textContent = `⋮ 其余 ${n - visIdx.length} 对`;
    put(E.note, [colX + (sh ? 42 : 52), y + ROW0 + gapPos * dy], phase === 'pair' ? ease((u - .56) / .18) : 1 - ease(u * 3), 1, true);
    visIdx.forEach((k, vi) => {
      const r = E.rows[k], at = rowY(vi), stag = vi / visIdx.length * .24;
      const back = phase === 'place' ? ease(u * 3) : 0; if (back >= 1) return;
      const v = phase === 'pair' ? ease((u - stag) / .34) : 1; if (v <= 0) return;
      const o = (1 - back) * Math.min(1, v * 2.6), slide = (1 - v) * 8;
      put(r.x, [colX - slide, at], o, .72 + .28 * v);
      put(r.w, [colX + (sh ? 26 : 34) - slide, at], o, .72 + .28 * v);
      if (v > .85) put(r.times, [colX + (sh ? 13 : 17), at], o * clamp((v - .85) / .15));
      const m = phase === 'pair' ? ease((u - .50 - stag * .4) / .30) : 1;
      if (v >= .92) { r.txt.innerHTML = E.text(k, m); put(r.txt, [colX + (sh ? 42 : 52), at], (1 - back) * clamp((v - .92) / .08), 1, true) }
    });
  }

  const cellRows = (cs, cw, cx) => {
    const rows = cs.map(c => ({ c, w: el('dot-cell', ''), x: el('dot-cell', ''), times: el('dot-x', '×'), txt: el('dot-txt', '') }));
    rows.forEach(r => { r.w.style.background = cw; r.x.style.background = cx; r.w.style.borderColor = deep(cw); r.x.style.borderColor = deep(cx) });
    return rows;
  };
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

  const betaWhole = pr => `<i>整块</i>${inputName(pr)} <b>[6, ${pr.n}]</b> × W_b <b>[${pr.N}, ${pr.n}]</b> → β <b>[6, ${pr.N}]</b>`
    + `<br>每个词、每个头：一次点积，再 sigmoid = 1 个数（0 到 1 之间）`;
  const betaOne = (pr, j, h) => `<i>这一个</i>${wordOf(j)} 的 <b>[${pr.n}]</b>（RMSNorm 后，在上面）和 W_b 第 ${h + 1} 行 <b>[${pr.n}]</b> 一对一对相乘、相加，再 sigmoid → <b>1</b> 个数：第 ${h + 1} 个头的 β`;
  const betaForm = (cx, cw, v) => `sigmoid(dot(<i class="sw row" style="background:${cx}"></i>, <i class="sw col" style="background:${cw}"></i>)) = <b>${v}</b>`;
  function betaTerms(s) {
    const d = s.beta, p0 = product(s, [d.w, d.x, d.out]), pr = { ...p0, cw: p0.cx, cx: p0.cw, wName: p0.X.t.name, xName: p0.W.t.name }, j = d.word, h = d.R, n = p0.n, cs = [...SHOW, n - 1];
    let dot = 0; for (let c = 0; c < n; c++) dot += demo.weight(d.w, h, c) * demo.at(d.x, j, c);
    return { pr, n, cs, wv: cs.map(c => demo.at(d.x, j, c)), xv: cs.map(c => demo.weight(d.w, h, c)), total: demo.at(d.out, j, h), extra: 22,
      wAt: c => dataAt(p0.X, j, c), xAt: c => weightAt(p0.W, h, c), wLine: dataAt(p0.X, j, n * .85), xLine: weightAt(p0.W, h, n / 2),
      oAt: dataAt(p0.O, j, h), upright: true,
      sumSay: `这 ${cs.length} 个乘积 + 其余 ${n - cs.length} 个，加起来 = <b>${fmt(dot)}</b><br>再过 sigmoid = <b>${fmt(demo.at(d.out, j, h))}</b>`,
      fill: v => setCard(d.tag, betaWhole(p0), betaOne(p0, j, h), betaForm(pr.cw, pr.cx, v), 'beta:' + s.n) };
  }

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
    const sh = shortStage(), micro = microStage(), dy = dyOf(), tb = tabGap();
    CW = micro ? Math.min(232, stageW - 20) : stageW < 700 || sh ? 300 : 360;
    const P = gnParts(s), { pr, j, off, per } = P, n = per, at = (b, c) => dataAt(b, j, off + c), sw = gnSw(pr);
    const visIdx = micro ? [] : sh && P.rows.length > 5 ? [0, 1, 2, P.rows.length - 1] : P.rows.map((_, i) => i), gapPos = sh && P.rows.length > 5 ? 3 : SHOW.length;
    const gateP = phase === 'gate' || phase === 'carry', rmsP = phase === 'square' || phase === 'mean';
    const R = phase === 'place' ? Math.max(0, placedAt(u, n)) : 0, [ox, oy] = px(at(pr.O, R));
    const val = phase === 'place' ? fmt(demo.at(pr.out, j, off + R)) : phase === 'scale' && u > .75 ? fmt(P.yv[0]) : phase === 'mean' && u > .7 ? fmt(P.rms)
      : phase === 'carry' || phase === 'gate' && u > .8 ? fmt(P.sq[0]) : '?';
    const form = gateP ? `sigmoid(输出门${sw.q}) = <b>${val}</b>` : rmsP ? `rms(${sw.x}) = <b>${val}</b>` : gnForm(pr, P.rms, val);
    const oneH = gateP ? `<i>先取</i>输出门里${wordOf(j)}第 ${P.h + 1} 个头的 <b>[${n}]</b>（前面算好的，在上方），每个数过 sigmoid`
      : rmsP ? `<i>再算</i>${wordOf(j)}第 ${P.h + 1} 个头读出的 <b>[${n}]</b>：每个数平方，求平均，再开根号 → 这个头的 rms`
      : `<i>最后</i>第 ${R + 1} 个数 ÷ rms × γ 第 ${R + 1} 个 × sigmoid(输出门第 ${R + 1} 个) → <b>1</b> 个数；这个头的 ${n} 个数共用一个 rms`;
    const HEAD = setCard(P.d.tag, gnWhole(pr), oneH, form, `gn:${s.n}:${gateP ? 'g' : rmsP ? 'r' : 's'}`), FULL = micro ? HEAD : HEAD + pairsOf() + (sh ? 14 : 22), ROW0 = HEAD + (sh ? 4 : 6);
    const seq = s.beats.map((b, i) => b.op.gn ? i : -1).filter(i => i >= 0);
    const reserved = FULL + geo.ph + tb;
    const sp = stageW < 700 ? 'TL' : chooseSpot(s, seq, () => { const [a, b] = px(at(pr.O, 0)); return [a, b, a, b] }, reserved, () => [px(at(pr.O, 0)), px(at(pr.X, 0)), px(at(pr.Q, 0)), px(gammaAt(pr.W, 0))], () => [pr.W, pr.X, pr.O, pr.Q].map(screenBox));
    const { x, y } = spotAt(sp, [0, 0, 0, 0], reserved);
    const grown = micro ? 0 : phase === 'gate' ? ease((u - .2) * 3) : phase === 'place' ? 1 - ease(u * 3) : 1, h = HEAD + (FULL - HEAD) * grown;
    const vis = phase === 'gate' ? ease(u * 5) : 1, drawn = phase === 'gate' ? ease(u * 4 - .3) : 1;
    const pts = gateP ? [px(at(pr.Q, n / 2))] : rmsP ? [px(at(pr.X, n / 2))] : [px(at(pr.X, R)), px(gammaAt(pr.W, R)), [ox, oy]];
    const tab = placeCard(x, y, h, vis, towardOf(pts), [pr.W, pr.X, pr.O, pr.Q].map(faceBox), false, pts);
    if (gateP) lines(pr, null, null, [null], tab, drawn, 1, 0, 0, [[px(at(pr.Q, n / 2)), pr.cq, '输出门']]);
    else if (rmsP) lines(pr, null, px(at(pr.X, n / 2)), [null], tab, 1, 1);
    else {
      const showOut = phase === 'place' ? 1 : phase === 'scale' ? ease((u - .65) / .35) : 0;
      const [ex, ey] = lines(pr, px(gammaAt(pr.W, R)), px(at(pr.X, R)), [ox, oy], tab, 1, 1, showOut, phase === 'place' ? 1 : .75, [[px(at(pr.Q, R)), pr.cq, '输出门']]);
      if (showOut <= 0 && inPic([ox, oy])) markTarget([ox, oy], pr.co, pr.O);
      if (phase === 'place') { P.drop.textContent = fmt(P.yv[0], 3); const v = ease(u / .3); if (v < 1) dropAlongArrow(P.drop, v, [ex, ey], [ox, oy]) } else P.drop.textContent = '';
    }
    if (phase === 'gate') glideOnLine(runX, lxs[0], fmt(P.qv[0], 3), pr.cq, ease((u * 1.6) % 1));
    else if (phase === 'square') glideOnLine(runX, lx, fmt(P.xv[0], 3), pr.cx, ease((u * 1.6) % 1));
    else if (phase === 'scale') {
      const prog = ease((u * 1.6) % 1);
      glideOnLine(runX, lx, fmt(P.xv[0], 3), pr.cx, prog);
      glideOnLine(runW, lw, fmt(P.gv[0], 3), pr.cw, prog);
    }
    if (micro || (phase === 'gate' && u < .2)) return;
    const rowY = vi => y + ROW0 + (vi < gapPos ? vi : vi + 1) * dy, colX = x + (sh ? 16 : 22), sumDest = [x + 28, rowY(visIdx.length) + 4];
    P.note.textContent = `⋮ 其余 ${n - visIdx.length} 个`;
    put(P.note, [colX + (sh ? 50 : 64), y + ROW0 + gapPos * dy], phase === 'gate' ? ease(u * 2 - 1) : phase === 'place' ? 1 - ease(u * 3) : 1, 1, true);
    const grey = t0 => ` <span style="color:#5c6963">${t0}</span>`;
    visIdx.forEach((k, vi) => {
      const r = P.rows[k], at0 = rowY(vi), stag = vi / visIdx.length * .3, back = phase === 'place' ? ease(u * 3) : 0; if (back >= 1) return;
      const vq = phase === 'gate' ? ease((u - .25 - stag) / .35) : 1;
      if (vq > 0) put(r.q, [colX - (1 - vq) * 7, at0], (1 - back) * Math.min(1, vq * 2.6), .72 + .28 * vq);
      const vx = phase === 'square' ? ease((u - stag) / .5) : phase === 'mean' ? 1 : phase === 'scale' ? ease((u - stag) / .45) : phase === 'place' ? 1 : 0;
      const into = phase === 'mean' ? ease((u - stag * .5) / .5) : 0;
      if (vx > 0 && into < 1) { const t0 = [colX + (sh ? 15 : 20) - (1 - vx) * 7, at0]; put(r.x, [t0[0] + (sumDest[0] - t0[0]) * into, t0[1] + (sumDest[1] - t0[1]) * into], (1 - back) * (1 - into) * Math.min(1, vx * 2.6), .72 + .28 * vx) }
      const vw = phase === 'scale' ? ease((u - stag) / .45) : phase === 'place' ? 1 : 0;
      if (vw > 0) put(r.w, [colX + (sh ? 30 : 40) - (1 - vw) * 7, at0], (1 - back) * Math.min(1, vw * 2.6), .72 + .28 * vw);
      const tx = colX + (sh ? 46 : 58), sg = fmt(P.sq[k]);
      if (phase === 'gate' && vq >= .92) { const m = ease((u - .65 - stag * .5) / .25); r.txt.innerHTML = `sigmoid(${fmt(P.qv[k])})${m > 0 ? ` <span style="opacity:${m}">= <b>${sg}</b></span>` : ''}`; put(r.txt, [tx, at0], 1, 1, true) }
      else if (phase === 'carry') { r.txt.innerHTML = grey(`sigmoid(输出门) = ${sg}`); put(r.txt, [tx, at0], 1, 1, true) }
      else if (rmsP) {
        const m = phase === 'square' ? ease((u - .4 - stag * .5) / .35) : 1;
        r.txt.innerHTML = (vx >= .92 && into < 1 ? `<span style="opacity:${1 - into}">${fmt(P.xv[k])}²${m > 0 ? ` <span style="opacity:${m}">= <b>${sci(P.xv[k] ** 2)}</b></span>` : ''}</span>` : '') + grey(` · ${sg}`);
        put(r.txt, [tx, at0], 1, 1, true);
      } else if (vx >= .92 && vw >= .92) {
        const m = phase === 'scale' ? ease((u - .5 - stag * .5) / .3) : 1;
        r.txt.innerHTML = `${fmt(P.xv[k])} ÷ rms × ${fmt(P.gv[k])} × ${sg}${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(P.yv[k])}</b></span>` : ''}`;
        put(r.txt, [tx, at0], 1 - back, 1, true);
      }
    });
    if (phase === 'mean') { const v = ease((u - .55) / .4); if (v > 0) { P.sumLine.innerHTML = `${n} 个平方的平均 = <b>${sci(P.ms)}</b><br>rms = √(平均 + ε) = <b>${fmt(P.rms)}</b>`; put(P.sumLine, [x + 14, rowY(visIdx.length) + 4], v, 1, true) } }
  }

  function kdaPhase(b, u) {
    if (b === 'pick') return ['recall', 'pick', u];
    if (b === 'place') return ['read', 'place', u];
    const P = [['pull', .4], ['mul', .25], ['sum', .35]]; let a = 0;
    for (const [ph, d] of P) { if (u < a + d || ph === 'sum') return [b, ph, clamp((u - a) / d)]; a += d }
  }
  const EW_ALL = [['pick', .15], ['pair', .5], ['place', .35]];
  function ewAll(u) { let a = 0; for (const [ph, d] of EW_ALL) { if (u < a + d || ph === 'place') return [ph, clamp((u - a) / d)]; a += d } }

  function normScene(s, bi, phase, u) {
    if (!RMS_PH.includes(phase)) return pairScene(s, bi, normPairs(s), phase === 'scale' ? 'pair' : phase, u);
    camera.updateMatrixWorld(); hideDots();
    const sh = shortStage(), micro = microStage(), dy = dyOf(), tb = tabGap();
    const P = normParts(s), pr = P.pr, n = pr.n, j = P.word, E = normPairs(s);
    const visIdx = micro ? [] : sh && P.rows.length > 5 ? [0, 1, 2, P.rows.length - 1] : P.rows.map((_, i) => i), gapPos = sh && P.rows.length > 5 ? 3 : SHOW.length;
    const oneH = `<i>先算</i>${wordOf(j)} <b>[${n}]</b> 每个数平方，求平均，再开根号 → <b>1</b> 个数：均方根 rms`;
    const form = `rms(<i class="sw col" style="background:${pr.cx}"></i>) = <b>${phase === 'mean' && u > .7 ? fmt(P.rms) : '?'}</b>`;
    const HEAD = setCard(s.norm.tag, normWhole(pr), oneH, form, `norm:${s.n}:true`), FULL = micro ? HEAD : HEAD + pairsOf(), ROW0 = HEAD + (sh ? 4 : 6);
    const cell0 = () => px(dataAt(pr.O, j, 0)), col = () => px(dataAt(pr.X, j, n * .85));
    const sp = chooseSpot(s, bi, () => { const [a, b] = cell0(); return [a, b, a, b] }, FULL + geo.ph + tb, () => [cell0(), ...E.points()], () => [pr.W, pr.X, pr.O].map(screenBox));
    const [ax, ay] = cell0(), { x, y } = spotAt(sp, [ax, ay, ax, ay], FULL + geo.ph + tb);
    const grown = micro || phase === 'pick' ? 0 : phase === 'square' ? ease(u * 2) : 1, h = HEAD + (FULL - HEAD) * grown;
    const vis = phase === 'pick' ? ease(u * 2) : 1;
    const tab = placeCard(x, y, h, vis, towardOf([cell0(), ...E.points()]), [pr.W, pr.X, pr.O].map(faceBox), false, [cell0(), ...E.points()]);
    const fresh = phase === 'pick' ? ease(u * 1.6 - .3) : 1;
    lines(pr, null, col(), [null], tab, fresh, 1);
    if (phase === 'pick') { later = micro ? null : () => dims(pr, vis, false); return }
    if (phase === 'square') glideOnLine(runX, lx, fmt(P.xv[Math.min(P.xv.length - 1, Math.floor(u * P.xv.length))], 3), pr.cx, ease((u * 1.8) % 1));
    if (micro) return;
    const rowY = vi => y + ROW0 + (vi < gapPos ? vi : vi + 1) * dy, colX = x + (sh ? 18 : 24), sumDest = [x + 28, rowY(2)];
    P.note.textContent = `⋮ 其余 ${n - visIdx.length} 个`;
    put(P.note, [colX + 24, y + ROW0 + gapPos * dy], { square: ease((u - .56) / .18), mean: 1 - ease(u * 2) }[phase], 1, true);
    visIdx.forEach((k, vi) => {
      const r = P.rows[k], at = rowY(vi), stag = vi / visIdx.length * .24;
      const out = phase === 'mean' ? ease((u - stag * .5) / .5) : 0; if (out >= 1) return;
      const v = phase === 'square' ? ease((u - stag) / .34) : 1; if (v <= 0) return;
      const tx = [colX - (1 - v) * 8, at];
      put(r.x, [tx[0] + (sumDest[0] - tx[0]) * out, tx[1] + (sumDest[1] - tx[1]) * out], (1 - out) * Math.min(1, v * 2.6), .72 + .28 * v);
      const m = phase === 'square' ? ease((u - .50 - stag * .4) / .30) : 1;
      if (v >= .92) { r.txt.innerHTML = `${fmt(P.xv[k])}²${m > 0 ? ` <span style="opacity:${m}">= <b>${fmt(P.xv[k] ** 2, 4)}</b></span>` : ''}`; put(r.txt, [colX + 24, at], 1 - out, 1, true) }
    });
    if (phase === 'mean') { const v = ease((u - .55) / .4); if (v > 0) { P.sumLine.innerHTML = `${n} 个平方的平均 = <b>${fmt(P.ms)}</b><br>rms = √(平均 + ε) = <b>${fmt(P.rms)}</b>`; put(P.sumLine, [x + 14, rowY(2)], v, 1, true) } }
  }

  function tracedAt(op, u, pr) {
    const T = words.length, per = pr.O.t.cols;
    const inWord = (f, h0, n) => { const j = Math.min(T - 1, Math.floor(f * T)); return [j, h0 + Math.min(n - 1, Math.floor((f * T - j) * n))] };
    const w0 = (op.w0 || 0) / T;
    if (op.words && headsDown(pr.O)) { const Hn = pr.O.t.deck.n, f = clamp(u) * .9999 * Hn, h = Math.floor(f), g = (f - h) * T, j = Math.floor(g); return [j, h * per + Math.min(per - 1, Math.floor((g - j) * per))] }
    if (op.heads) { const c = op.from + clamp(u) * op.n * .9999, h = Math.floor(c); return inWord(op.slow ? w0 + (1 - w0) * (c - h) : c - h, h * per, per) }
    return inWord(w0 + (1 - w0) * clamp(u) * .9999, 0, pr.N);
  }
  const traces = new Map();
  const traceOf = (s, op) => {
    const key = s.n + ':' + op.trace.join();
    if (!traces.has(key)) {
      const made = ({ norm: normProduct, mix: mixProduct, conv: convProduct, write: s0 => writeProduct(s0), ew: s0 => ewProduct(s0), kda: s0 => kdaProduct(s0), coef: s0 => coefProduct(s0), fg: s0 => fgProduct(s0), gn: s0 => gnParts(s0).pr, beta: s0 => { const p0 = product(s0, op.trace); return { ...p0, cw: p0.cx, cx: p0.cw, wName: p0.X.t.name, xName: p0.W.t.name } } }[op.by] || product)(s, op.trace);
      traces.set(key, made);
    }
    return traces.get(key);
  };

  function traceScene(s, bi, op, u, last) {
    camera.updateMatrixWorld(); hideDots();
    const pr = traceOf(s, op), [j, R] = tracedAt(op, u, pr), [ox, oy] = px(dataAt(pr.O, j, R)), norm = op.by === 'norm';
    const heads = (pr.O.div[2] > 1 || pr.O.t.headsCut) && pr.O.t.cols > 1, per = pr.O.t.cols, close = last ? ease((u - .82) / .18) : 0;
    const unit = pr.O.t.deck?.kind === 'stream' ? '路' : '个头';
    const name = `${op.trace[3]} · ${heads ? `第 ${Math.floor(R / per) + 1} ${unit} · ` : ''}${wordOf(j)} · 第 ${(heads ? R % per : R) + 1} 个数`, key = `trace:${s.n}:${bi}:${close > .5}`;
    const mix = op.by === 'mix', conv = op.by === 'conv', write = op.by === 'write', ew = op.by === 'ew', kda = op.by === 'kda', coef = op.by === 'coef', fg = op.by === 'fg', gn = op.by === 'gn', beta = op.by === 'beta';
    const wAt = () => px(gn ? gammaAt(pr.W, R % per) : coef ? fnAt(pr.W, R, pr.per / 2) : norm ? gammaAt(pr.W, R) : mix ? dataAt(pr.W, j, (pr.k - 1) / 2) : write ? dataAt(pr.X, j, R % per) : ew ? dataAt(pr.W, j, R)
      : kda ? weightAt(pr.W, Math.floor(R / per) * per + per / 2, R % per)
      : beta ? dataAt(pr.X, j, pr.n * .85)
      : conv ? weightAt(pr.W, R, (pr.k - 1) / 2) : weightAt(pr.W, R, pr.n / 2));
    const xAt = () => px(gn ? dataAt(pr.X, j, R) : coef ? dataAt(pr.X, j, pr.per / 2) : conv ? dataAt(pr.X, Math.max(0, j - (pr.k - 1) / 2), R) : write ? dataAt(pr.Y, j, R % per) : kda ? dataAt(pr.X, j, Math.floor(R / per) * per + per / 2)
      : beta ? weightAt(pr.W, R, pr.n / 2)
      : dataAt(pr.X, j, norm || mix || ew ? R : pr.n * .85));
    let HEAD;
    if (kda) HEAD = setCard(close > .5 ? '其余的数都这样算完：每个词先改 S，再用 q 读' : name, kdaWhole(pr), `<i>这一个</i>${wordOf(j)} 第 ${Math.floor(R / per) + 1} 个头：改好的 S 第 ${R % per + 1} 列 <b>[${per}]</b> 和 q <b>[${per}]</b> 一对一对相乘、相加 → <b>1</b> 个数`,
      kdaStack(pr, [['q', '读出'], ['k', '改 S'], ['v', '改 S'], ['g', '改 S'], ['β', '改 S'], ['S', `第 ${R % per + 1} 列`]], `读出 = <b>${fmt(demo.at(pr.out, j, R))}</b>`), key);
    else if (beta) HEAD = setCard(close > .5 ? '其余的都这样算完：每个词、每个头一次点积，再 sigmoid' : `β · 第 ${R + 1} 个头 · ${wordOf(j)}`, betaWhole(pr), betaOne(pr, j, R), betaForm(pr.cw, pr.cx, fmt(demo.at(pr.out, j, R))), key);
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

    const tracePins = () => [wAt(), xAt(), ...(mix ? words.map((_, wd) => px(dataAt(pr.W, wd, (pr.k - 1) / 2))) : []),
      ...(mix || norm ? [0, words.length - 1].flatMap(wd => [0, .5, 1].map(f0 => px(dataAt(pr.O, wd, (pr.N - 1) * f0)))) : [])];
    const sp = chooseSpot(s, bi, () => screenBox(pr.O), HEAD + geo.ph + tabGap(), tracePins, () => [pr.W, pr.X, pr.O].map(screenBox),
      fg || beta ? () => [pr.W, pr.X, pr.O].flatMap(b => { const [a, c, d, e] = screenBox(b); return [[(a + d) / 2, c], [(a + d) / 2, e]] }) : null);
    const { x, y } = spotAt(sp, screenBox(pr.O), HEAD + geo.ph + tabGap());
    const boxes = [pr.W, pr.X, pr.O, pr.Y].filter(Boolean).map(screenBox);
    const hm = Math.floor(R / per) * per + per / 2;
    const more = kda ? [pr.X, pr.K, pr.Vv, pr.G].map((b, idx) => [px(dataAt(b, j, hm)), pr.cx, ['q', 'k', 'v', 'g'][idx]]).concat([[px(dataAt(pr.Be, j, Math.floor(R / per))), pr.cx, 'β'], [px(weightAt(pr.W, hm, R % per)), pr.cw, '记忆 S']])
      : gn ? [[px(dataAt(pr.Q, j, R)), pr.cq, '输出门']] : coef ? coefMore(pr, R).map(([p, c, nm]) => [px(p), c, nm]) : fg ? fgMore(pr, R).map(([p, c, nm]) => [px(p), c, nm]) : [];
    const tab = placeCard(x, y, HEAD, 1, towardOf(boxes.map(([a, c, d, e]) => [(a + d) / 2, (c + e) / 2])), [pr.W, pr.X, pr.O].map(faceBox), coef || fg || beta, [[ox, oy], wAt(), xAt(), ...more.map(([p]) => p)]);
    const ends = coef && coefEnds(pr, j, R), ty = (tab[1] + tab[3]) / 2;
    lines(pr, coef ? nearer(ends[0], ty) : wAt(), coef ? nearer(ends[1], ty) : xAt(), [ox, oy], kda && !s.focusLabels && stageW >= 700 && !shortStage() ? tabLeftOf([pr.X, pr.K, pr.Vv, pr.G, pr.Be, pr.W, pr.O], more.map(m => m[0]), 1) : tab, 1, 1 - close, 1, 1 - close, more, coef || fg || beta);
  }

  // ---- MoE Experts & Merge & Routing
  const expertWordBox = (b, j, k) => { const box = wordBox(b, j); if (b.t.deck?.kind === 'pick') { box[0][2] = k; box[1][2] = k + .999 } return box };
  const pickedAt = (b, j, c, k) => { const p = dataAt(b, j, c); if (b.t.deck?.kind === 'pick') p.z = slabZ(b, k); return p };
  function expertProduct(s, stage, j = 0, k = 0) {
    const d = s.expert.stages[stage], W = B[id(s, d.w)], X = B[id(s, d.x)], O = B[id(s, d.out)], shape = demo.get(d.out).shape, routed = shape.length === 3;
    return { ...d, W, X, O, stage, j, k, routed, e: routed ? demo.at(s.expert.indices, j, k) : null, K: routed ? shape[1] : 1, N: shape.at(-1), n: d.kind === 'activation' ? 1 : demo.W.tensors[d.w].shape.at(-1),
      cw: onCard(look.palette[W.comp][d.kind === 'activation' ? 0 : 1]), cx: onCard(look.palette[X.comp][0]), co: onCard(look.palette[O.comp][0]) };
  }
  function showExpertPlane(W, e, color) {
    const z = slabZ(W, e), pts = [[W.x0, W.y0], [W.x0, W.y1], [W.x1, W.y1], [W.x1, W.y0]].map(([x, y]) => px(V(x, y, z)));
    expertEdge.setAttribute('d', pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + ' Z');
    expertEdge.style.stroke = deep(color); expertEdge.style.fill = color; expertPlane.style.display = 'block';
  }
  function expertIndex(s, op, u) {
    if (op.phase !== 'trace') return [0, 0, 0];
    const p = expertProduct(s, op.expert), i = Math.min(words.length * p.K * p.N - 1, Math.floor(u * words.length * p.K * p.N));
    return [Math.floor(i / (p.K * p.N)), Math.floor(i / p.N) % p.K, i % p.N];
  }
  function fillExpert(pr, j, k, R) {
    const bid = id(cur, pr.out);
    if (!pr.routed) return fillTo(bid, j, R, 'words');
    growB(bid, null); frontB(bid, pr.O.orient === 'row' ? 4 : 5, j, k, (R + 1) / pr.N, 0);
  }
  function expertTerms(s, stage, j = 0, k = 0, R = 0) {
    const pr = expertProduct(s, stage, j, k), activation = pr.kind === 'activation', n = pr.n, cs = activation ? [0] : [...SHOW, n - 1], lim = s.expert.limit;
    const value = (name, c) => demo.get(name).shape.length === 3 ? demo.at(name, j, k, c) : demo.at(name, j, c);
    const g = activation ? value(pr.w, R) : 0, up = activation ? value(pr.x, R + (pr.w === pr.x ? pr.N : 0)) : 0;
    const silu = v => v / (1 + Math.exp(-v)), gv = silu(Math.min(g, lim)), uv = Math.max(-lim, Math.min(lim, up));
    const weight = c => pr.W.t.deck?.kind === 'expert' ? demo.weight(pr.w, pr.e, R, c) : demo.weight(pr.w, R, c);
    const wAt = c => { if (activation) return pickedAt(pr.W, j, R, k); const p = weightAt(pr.W, R, c); if (pr.W.t.deck?.kind === 'expert') p.z = slabZ(pr.W, pr.e); return p };
    const xAt = c => pickedAt(pr.X, j, activation ? R + (pr.w === pr.x ? pr.N : 0) : c, k);
    const total = value(pr.out, R), omega = pr.weighted ? demo.at(s.expert.weights, j, k) : null, raw = pr.weighted ? demo.at('e_raw', j, k, R) : total;
    const who = pr.routed ? `${wordOf(j)} · 第 ${k + 1} 份 → 专家 #${pr.e}` : `共享专家 · ${wordOf(j)}`;
    const shapes = pr.routed ? (activation ? '[6, 8, 4096] → [6, 8, 2048]' : pr.weighted ? '[6, 8, 2048] → [6, 8, 4096]' : '[6, 4096] → [6, 8, 4096]（gate | up 各 2048）') : `[6, ${pr.X.t.cols}] → [6, ${pr.N}]`;
    const wholeH = `<i>整块</i>${shapes.replace(/\[[^\]]+\]/g, '<b>$&</b>')}`, oneH = `<i>这一个</i>${who}，${stage === 'gu' ? (R < pr.N / 2 ? 'gate' : 'up') + ' 第 ' + (R % (pr.N / 2) + 1) : '第 ' + (R + 1)} 个数。${activation ? `gate ≤ ${lim}、up 截到 ±${lim}；SiLU(gate) × up` : n + ' 对乘积相加'}${pr.weighted ? '，再 × 本份路由权重 ' + fmt(omega) : ''}`;
    const form = v => `${activation ? 'SiLU(' : 'dot('}<i class="sw row" style="background:${pr.cw}"></i>${activation ? ') × ' : ', '}<i class="sw col" style="background:${pr.cx}"></i>${activation ? '' : ')'}${pr.weighted ? ` × <i class="sw ex" style="background:${onCard(look.palette.router[0])};width:10px;height:10px"></i> ${fmt(omega)}` : ''} = <b>${v}</b>`;
    return { pr, n, cs, total, dimensions: false, wv: cs.map(c => activation ? gv : weight(c)), xv: cs.map(c => activation ? uv : value(pr.x, c)), wAt, xAt,
      wLine: wAt(n / 2), xLine: xAt(n * .7), oAt: pickedAt(pr.O, j, R, k),
      more: pr.weighted ? () => [[dataAt(B[id(s, s.expert.weights)], j, k), onCard(look.palette.router[0]), '路由权重']] : null,
      sumSay: pr.weighted ? `${n} 个乘积相加 = ${fmt(raw)}<br>× 路由权重 ${fmt(omega)} = <b>${fmt(total)}</b>` : activation ? `SiLU(${fmt(Math.min(g, lim))}) × ${fmt(uv)} = <b>${fmt(total)}</b>` : undefined,
      rowText: activation ? (_k, _phase, m) => `SiLU(${fmt(Math.min(g, lim))}) × ${fmt(uv)}${shown(m, total)}` : null,
      fill: v => setCard(`${pr.name} · ${who}`, wholeH, oneH, form(v), `expert:${s.n}:${stage}:${j}:${k}:${String(R).length}:${stage === 'gu' && R >= pr.N / 2}`) };
  }
  function expertScene(s, bi, op, u) {
    if (op.expert === 'select') {
      hideDots(); camera.updateMatrixWorld();
      const k = Math.min(s.expert.k - 1, Math.floor(u * s.expert.k)), e = demo.at(s.expert.indices, 0, k), W = B[id(s, 'W_gu')], X = B[id(s, s.expert.indices)];
      const cw = onCard(look.palette[W.comp][1]), cx = onCard(look.palette[X.comp][0]), pr = { W, X, O: W, cw, cx, co: cw };
      const H0 = setCard(`接住第 ${s.displayNumber - 1} 段：编号决定用哪一套权重`, `<i>春天</i>${Array.from({ length: s.expert.k }, (_, i) => `<${i === k ? 'b' : 'span'}>#${demo.at(s.expert.indices, 0, i)}</${i === k ? 'b' : 'span'}>`).join(' · ')}`,
        `<i>现在</i>第 ${k + 1} 份，读取专家 #${e}。288 套权重中只用这 8 套；输入仍是春天的 4096 个数。`,
        `<i class="sw col" style="background:${cx}"></i> 编号 ${e} → <i class="sw row" style="background:${cw}"></i> 第 ${e + 1} 片`, `expert:select:${k}`);
      const a = weightAt(W, 0, W.t.rows.n / 2); a.z = slabZ(W, e); const wp = px(a), xp = px(dataAt(X, 0, k));
      const spot = chooseSpot(s, bi, () => screenBox(W), H0 + geo.ph + tabGap(), () => [wp, xp], () => [screenBox(W)]), { x, y } = spotAt(spot, screenBox(W), H0 + geo.ph + tabGap());
      const tab = placeCard(x, y, H0, 1, towardOf([wp, xp]), [faceBox(W)]);
      lines(pr, wp, xp, [null, null], tab, 1, 1, 0, 0); showExpertPlane(W, e, cw); return;
    }
    if (op.phase !== 'trace') { const P = sumParts(s, 'expert:' + op.expert); dotScene(s, bi, P, ...(op.phase === 'all' ? allPhase(u) : [op.phase, u])); if (P.pr.W.t.deck?.kind === 'expert') showExpertPlane(P.pr.W, P.pr.e, P.pr.cw); return }
    hideDots(); camera.updateMatrixWorld();
    const [j, k, R] = expertIndex(s, op, u), P = expertTerms(s, op.expert, j, k, R), pr = P.pr, H0 = P.fill(fmt(P.total));
    const points = [px(P.wLine), px(P.xLine), px(P.oAt)], boxes = [pr.W, pr.X, pr.O];
    const spot = chooseSpot(s, bi, () => screenBox(pr.O), H0 + geo.ph + tabGap(), () => points, () => boxes.map(screenBox)), { x, y } = spotAt(spot, screenBox(pr.O), H0 + geo.ph + tabGap());
    const tab = placeCard(x, y, H0, 1, towardOf(points), boxes.map(faceBox));
    lines(pr, points[0], points[1], points[2], tab, 1, 1, 1, 1, P.more ? P.more().map(([p, c, nm]) => [px(p), c, nm]) : []);
    if (pr.W.t.deck?.kind === 'expert') showExpertPlane(pr.W, pr.e, pr.cw);
  }

  const mergeDrop = el('dot-cell drop', ''), mergeRead = el('dot-cell drop', '');
  function mergeIndex(s, op, u) {
    const n = demo.get(s.merge[op.merge].out).shape[1], i = op.phase === 'trace' ? Math.min(words.length * n - 1, Math.floor(u * words.length * n)) : 0;
    return [Math.floor(i / n), i % n];
  }
  function mergeScene(s, bi, op, u) {
    camera.updateMatrixWorld(); hideDots();
    const d = s.merge[op.merge], [j, R] = mergeIndex(s, op, u), many = d.ins.length === 1, K = many ? demo.get(d.ins[0]).shape[1] : 2;
    const W = B[id(s, d.ins[0])], X = B[id(s, d.ins.at(-1))], O = B[id(s, d.out)];
    const color = b => onCard(look.palette[b.comp][0]), pr = { W, X, O, cw: color(W), cx: color(X), co: color(O) };
    const pulling = op.phase === 'pull', k = pulling ? Math.min(K - 1, Math.floor(u * K)) : 0;
    const values = Array.from({ length: K }, (_, i) => many ? demo.at(d.ins[0], j, i, R) : demo.at(d.ins[i], j, R));
    const total = demo.at(d.out, j, R), ready = ['place', 'trace'].includes(op.phase) || op.phase === 'sum' && u > .7;
    const wAt = i => many ? pickedAt(W, j, R, i) : dataAt(i === 0 ? W : X, j, R), oAt = px(dataAt(O, j, R));
    const wStackMid = () => { const a = wAt(0), b = wAt(K - 1); return V((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2) };
    const w = px(many ? (pulling ? wAt(k) : wStackMid()) : wAt(0)), x = many ? null : px(wAt(1)), points = [oAt, w, ...(x ? [x] : [])], boxes = [W, X, O];
    const sw = (cls, c) => `<i class="sw ${cls}" style="background:${c}"></i>`;
    const form = many ? `Σ₈ ${sw('row', pr.cw)} = <b>${ready ? fmt(total) : '?'}</b>` : `共享 ${sw('col', pr.cx)} + 路由 ${sw('row', pr.cw)} = <b>${ready ? fmt(total) : '?'}</b>`;
    const showRows = ['pull', 'sum'].includes(op.phase), count = pulling ? k + 1 : K;
    const sh = shortStage(), rowIdxs = sh && values.length > 5 ? [...new Set([0, 1, Math.min(k, values.length - 1), values.length - 1])].sort((a, b) => a - b) : values.map((_, i) => i);
    const rows = showRows ? `<div style="margin-left:${sh ? '-40px' : '-46px'};text-indent:0"><table style="width:100%;margin-top:${sh ? '4px' : '8px'};border-collapse:collapse">${rowIdxs.map(i => { const v = values[i]; return `<tr style="height:${sh ? '15px' : '21px'};opacity:${i < count ? 1 : .3};background:${pulling && i === k ? '#eef4ef' : 'transparent'}"><td>${many ? `${i + 1}/8 · 专家 #${demo.at('topk_i', j, i)}` : i === 0 ? '8 份合计' : '共享专家'}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${i < count ? fmt(v, 5) : '待取'}</td></tr>` }).join('')}</table></div>` : '';
    const H0 = setCard(`${many ? '8 份相加' : '加上共享输出'} · ${wordOf(j)} · 第 ${R + 1} 个数`,
      `<i>整块</i>${many ? '[6, 8, 4096] 沿 8 份求和' : '[6, 4096] + [6, 4096]'} → <b>[6, 4096]</b>`,
      `<i>这一个</i>${many ? '每份已经乘过路由权重；同一词、同一位置相加。' : '路由合计与共享输出，同一词、同一位置相加。'}${many ? (pulling ? `<br>连线指向第 ${k + 1}/8 份 · 专家 #${demo.at('topk_i', j, k)}` : '<br>已收齐全部 8 份加权专家输出，沿深度轴整列相加') : ''}${rows}`,
      form, `merge:${s.n}:${op.merge}:${op.phase}:${j}:${R}:${k}`);
    const spot = chooseSpot(s, bi, () => screenBox(O), H0 + geo.ph + tabGap(), () => points, () => boxes.map(screenBox));
    const pos = spotAt(spot, screenBox(O), H0 + geo.ph + tabGap());
    let tab = placeCard(pos.x, pos.y, H0, 1, towardOf(points), boxes.map(faceBox), true, points);
    const bottom = Math.max(...[...new Set([W, X])].map(screenBox).map(b => b[3])), top = screenBox(O)[1];
    const py = Math.max(pos.y + H0 + tabGap(), (bottom + top - geo.ph) / 2), px0 = pos.x + CW - geo.pw;
    if (py >= bottom + 12 && py + geo.ph <= top - 12 && py + geo.ph < stageH - 4) {
      tab = [px0, py, px0 + geo.pw, py + geo.ph]; pillState = tab; put(pill, [px0, py]); pill.style.transform = 'none';
    }
    const showOut = ['place', 'trace'].includes(op.phase) ? 1 : op.phase === 'sum' ? ease((u - .45) / .5) : 0;
    const from = lines(pr, w, x, oAt, tab, 1, 1, showOut, op.phase === 'place' ? 1 : .75, [], true);
    if (showOut <= 0 && inPic(oAt)) markTarget(oAt, pr.co, O);
    if (many && pulling) showExpertPlane(W, k, pr.cw);
    if (op.phase === 'pull') {
      const v = ease((u * K - k) * 1.4), mc = k === 0 || many ? pr.cw : pr.cx;
      glideOnLine(mergeRead, many || k === 0 ? lw : lx, fmt(values[k], 3), mc, v);
    }
    if (op.phase === 'place' && from) { mergeDrop.textContent = fmt(total); mergeDrop.style.background = pr.co; mergeDrop.style.borderColor = deep(pr.co); const v = ease(u * 1.2); if (v < 1) dropAlongArrow(mergeDrop, v, from, oAt) }
  }

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
    const sh = shortStage(), ed = edgeOf(), tb = tabGap();
    const table = (heads, rows) => `<div style="margin-left:${sh ? '-38px' : '-44px'};text-indent:0;margin-top:${sh ? '3px' : '8px'}"><table style="width:100%;border-collapse:collapse;font:${sh ? '10.2px/1.26' : '11px/1.7'} var(--journey-font-mono);font-variant-numeric:tabular-nums"><thead><tr>${heads.map(h => `<th style="text-align:right;font-weight:500">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(({ cells, active, dim }) => `<tr style="background:${active ? cx + '30' : 'transparent'};opacity:${dim ? '.5' : '1'}">${cells.map(v => `<td style="text-align:right;white-space:nowrap">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    let body, form, name;
    if (phase === 'sigmoid') {
      const z = demo.at('logits', j, e), sc = demo.at('scores', j, e);
      name = `${wordOf(j)} · 专家 #${e} · 分数过 sigmoid`;
      body = `<i>这一个</i>logit = ${fmt(z, 4)}<br>s = 1 / (1 + exp(−logit)) = <b>${fmt(sc, 4)}</b><br>288 个分数各自变换；不是 softmax，不要求它们的和为 1。`;
    } else if (phase === 'choose') {
      name = `${wordOf(j)} · 按加偏置的分数挑 ${K} 个`;
      const idxs = sh ? [...new Set([0, 1, Math.min(k, K - 1), K - 1, K])].sort((a, b) => a - b) : Array.from({ length: K + 1 }, (_, n) => n);
      body = `<i>选择</i>s + 偏置，从高到低看前 ${K + 1} 名；第 ${K + 1} 名不入选。`
        + table(['专家', 's', '偏置', '选择分', ''], idxs.map(n => { const e0 = ranked[n]; return { active: n === k, dim: n === K, cells: [`#${e0}`, fmt(demo.at('scores', j, e0), 4), fmt(demo.weight(d.bias, e0), 4), fmt(demo.at('choice', j, e0), 4), n <= k ? '✓' : n === K ? '未选' : ''] } }));
    } else {
      name = `${wordOf(j)} · ${phase === 'place' || phase === 'rest' ? `放回第 ${k + 1} 个权重` : '用未加偏置的分数算权重'}`;
      const idxs = sh ? [...new Set([0, 1, k, K - 1])].sort((a, b) => a - b) : Array.from({ length: K }, (_, n) => n);
      body = `<i>权重</i>这 ${K} 个原始 s 的和 = <b>${fmt(sum, 4)}</b><br>每个 s ÷ ${fmt(sum, 4)} × ${d.scale}。偏置不参与。`
        + table(['专家', '原始 s', '÷ 和', `× ${d.scale}`], idxs.map(n => { const e0 = picks[n]; return { active: n === k, cells: [`#${e0}`, fmt(demo.at('scores', j, e0), 4), fmt(demo.at('scores', j, e0) / sum, 4), fmt(demo.at(d.weights, j, n), 4)] } }))
        + `<div style="margin-top:${sh ? '2px' : '5px'};text-indent:0">${K} 个合并权重的和 = ${d.scale}；编号和权重一一配对。</div>`;
    }
    const grid = rows => `<div style="display:grid;grid-template-columns:1fr auto;gap:${sh ? '3px 8px' : '6px 12px'};align-items:center">${rows.join('')}</div>`;
    const source = `<span>s = ${fmt(demo.at('scores', j, e), 4)}</span>${sw('col', cx)}`;
    const putting = phase === 'choose' || phase === 'place' || phase === 'rest';
    form = phase === 'sigmoid' ? grid([`<span>sigmoid(logit) = ${fmt(demo.at('scores', j, e), 4)}</span>${sw('col', cx)}`])
      : phase === 'choose' ? grid([source, `<span>偏置 = ${fmt(demo.weight(d.bias, e), 4)}</span>${sw('row', cw)}`, `<b>s + 偏置 → top ${K} → #${e}</b>${sw('ex', cx)}`])
      : grid([source, `<b>s ÷ Σ选中 s × ${d.scale} = ${fmt(demo.at(d.weights, j, k), 4)}</b>${sw('ex', cx)}`]);
    let h = setCard(name, `<i>整块</i>[${words.length}, ${E}] → 编号、权重各 [${words.length}, ${K}]`, body, form, `route:${phase}:${j}:${k}:${CW}`);
    h = Math.min(h, Math.max(60, stageH - 2 * ed));
    const output = phase === 'choose' ? I : O, pos = px(dataAt(output, j, k));
    const xp = px(dataAt(X, j, e)), wp = px(V(along(W, e, E, 'x'), W.y1, W.z1));
    const left = Math.min(...[X, W, I, O].map(b => screenBox(b)[0]));
    const x = Math.max(ed, Math.min(stageW - ed - CW, left - CW - 60));
    const sidePill = y0 => y0 + h + tb + geo.ph > stageH - ed && x + CW + tb + geo.pw <= stageW - ed;
    const y = Math.max(ed, Math.min(stageH * .1, stageH - h - (sidePill(ed) ? 0 : geo.ph + tb) - ed));
    put(card, [x, y], 1); card.style.transform = 'none'; card.style.height = h + 'px'; cardState = [x, y, x + CW, y + h];
    const tx = Math.max(4, Math.min(stageW - 4 - geo.pw, sidePill(y) ? x + CW + tb : x + CW - geo.pw));
    const ty = Math.max(4, Math.min(stageH - 4 - geo.ph, sidePill(y) ? Math.max(ed, Math.min(stageH - ed - geo.ph, y + h - geo.ph)) : y + h + tb));
    put(pill, [tx, ty], 1); pill.style.transform = 'none'; pillState = [tx, ty, tx + geo.pw, ty + geo.ph];
    const baseBoxes = [[x - 2, y - 2, x + CW + 2, y + h + 2], [tx - 2, ty - 2, tx + geo.pw + 2, ty + geo.ph + 2]];
    const segBoxes = activeSegLabelBoxes(3, 2, true);
    const port = sw0 => [tx + geo.pw, ty + sw0[1]];
    let rPortIdx = 0;
    const resolvePt = (p, name, col, line) => {
      if (inPic(p)) return p;
      const e0 = sourcePorts[rPortIdx++];
      if (!e0) return null;
      const dir = p[1] < 0 ? '上方' : p[1] > stageH ? '下方' : p[0] < 0 ? '左侧' : '右侧';
      e0.textContent = `${name} · ${dir}`;
      e0.style.borderColor = deep(col);
      e0.style.display = 'block';
      const hw = Math.max(58, (e0.offsetWidth || 120) / 2 + 4), hh = 13;
      const sx = Math.max(hw + 8, Math.min(stageW - hw - 8, p[0] < 0 ? hw + 8 : stageW - hw - 8));
      const sy = Math.max(hh + 8, Math.min(stageH - hh - 8, p[1] < 0 ? 22 + rPortIdx * 28 : p[1] > stageH ? stageH - 24 : p[1]));
      put(e0, [sx, sy]);
      sourceBoxes.set(line, [sx - hw, sy - hh, sx + hw, sy + hh]);
      return [sx - hw + 2, sy];
    };
    const connect = (line, a, b, isOut = false) => {
      if (!b) return;
      const exit = [Math.min(stageW - 3, Math.max(a[0] + 6, x + CW + 10)), a[1]];
      const otherSrc = [...sourceBoxes.entries()].filter(([ln]) => ln !== line).map(([, sbx]) => sbx);
      const minB = otherSrc.length ? baseBoxes.concat(otherSrc) : baseBoxes;
      const rBoxes = minB.concat(segBoxes.filter(lb => !ptInBox(b, lb) && !ptInBox(exit, lb)));
      routeClean(line, a, exit, b, 1, 'h', 1, rBoxes, minB);
      const pin = !isOut && inPic(b) && !sourceBoxes.has(line) && sourcePins.get(line);
      if (pin && line.style.display === 'block') { pin.style.background = line.style.stroke; put(pin, b, 1) }
    };
    lx.style.stroke = deep(cx); lw.style.stroke = deep(cw);
    connect(lx, port(geo.col), resolvePt(xp, X.t.name, cx, lx));
    if (phase === 'choose') connect(lw, port(geo.row), resolvePt(wp, W.t.name, cw, lw));
    const startPt = geo.ex[0] ? port(geo.ex[0]) : null;
    if (putting && startPt && inPic(pos)) {
      const tgtPt = markTarget(pos, cx, O) || pos;
      connect(lo, startPt, tgtPt, true);
    }
    if (phase === 'place' || phase === 'rest') {
      const steps = K * (phase === 'rest' ? words.length - 1 : 1), v = ease((u * steps) % 1);
      routeDrop.textContent = fmt(demo.at(d.weights, j, k), 3);
      routeDrop.style.background = cx; routeDrop.style.borderColor = deep(cx);
      if (startPt && v < .98) dropAlongArrow(routeDrop, v, startPt, pos);
    }
  }

  // ---- Chapter Endpoints & MLA Lesson Formulas (with full source animation, readable shapes & staged handoff)
  function lessonPoint(s, ref) {
    const name = ref.id === 'last_residual' ? 'L44:residual_out' : ref.id;
    const b = B[id(s, name)], shape = ref.weight ? demo.W.tensors[ref.id].shape : demo.get(ref.id).shape;
    const p = lessonPosition(b, ref.index, shape, ref.weight, B);
    return { point: px(V(p.x, p.y, p.z)), b, omitted: p.omitted, candidate: p.candidate };
  }

  const shortRefName = (s, refId) => {
    const name = refId === 'last_residual' ? 'L44:residual_out' : refId;
    const b = B[id(s, name)];
    const raw = b?.t?.name || refId;
    return raw.length <= 10 ? raw : refId;
  };

  const lessonCache = new Map(), lessonDrop = el('dot-cell drop', ''), sentence = el('lesson-sentence', '');
  sentence.id = 'dotsentence';
  function lessonScene(s, bi, op, u) {
    camera.updateMatrixWorld(); hideDots();
    const st = op.lesson, O = demo.get(st.writes[0]), N = O.a.length;
    const index = op.phase === 'trace' ? lessonProgress(B[id(s, st.writes[0])], O.shape, Math.min(.999999, Math.floor(u * 48) / 48)).index : op.sample;
    const key = `${s.n}:${st.id}:${index}`;
    if (!lessonCache.has(key)) lessonCache.set(key, explain(demo, st, index));
    const e = lessonCache.get(key), intro = op.phase === 'intro', ready = !intro && op.phase !== 'pull', micro = microStage();
    const pool = st.id === 'idx_pool', poolTerm = pool ? e.terms[Math.min(3, Math.floor(u * 4))] : null;
    const dotPicked = e.terms.filter(t0 => t0.a);
    const picked = dotPicked.length ? dotPicked
      : pool ? e.terms.map(t0 => ({ c: t0.c, a: t0.key, b: t0.cg, value: t0.value }))
      : e.sources.map((src, k) => ({ c: k, a: src, b: e.sources.length > 1 && k === 0 ? e.sources[1] : null, value: src.value }));
    const termIdx = picked.length ? Math.min(picked.length - 1, Math.floor(u * picked.length)) : 0;
    const term = picked.length ? picked[termIdx] : null;
    const refs = (pool ? [poolTerm.cg, poolTerm.ape, poolTerm.key] : op.phase === 'pull' && dotPicked.length && term ? [term.a, term.b].filter(Boolean) : e.sources)
      .filter((x, i, a) => x && a.findIndex(y => y.id === x.id) === i).slice(0, pool ? 3 : 2);
    const points = refs.map(r => lessonPoint(s, r)), target = lessonPoint(s, { id: st.writes[0], index, weight: false });
    const color = b => onCard(look.palette[b.comp][b.t.kind === 'weight' ? 1 : 0]);
    const W = points[0]?.b || target.b, X = points[1]?.b || W;
    const pr = { W, X, O: target.b, cw: color(W), cx: color(X), co: color(target.b),
      wName: points[0]?.omitted ? `${shortRefName(s, refs[0].id)} #${points[0].candidate} · 省略区` : shortRefName(s, refs[0]?.id || st.writes[0]),
      xName: points[1]?.omitted ? `${shortRefName(s, refs[1].id)} #${points[1].candidate} · 省略区` : refs[1] ? shortRefName(s, refs[1].id) : undefined };
    const value = v => Number.isInteger(v) && Math.abs(v) >= 100 ? String(v) : Math.abs(v) > 1e30 ? '不可见' : Math.abs(v) < .0001 && v !== 0 ? v.toExponential(3) : fmt(v, 4);
    const rows = op.phase === 'pull' && !micro
      ? (e.terms.length
          ? e.terms.map(t0 => pool
              ? `<div>词 ${t0.c + 1}：cg ${value(t0.cg.value)} + ape ${value(t0.ape.value)}<br>α ${value(t0.alpha)} × K ${value(t0.key.value)} = ${value(t0.value)}</div>`
              : t0.a
                ? `<div>${t0.c + 1}：${value(t0.a.value)} × ${value(t0.b.value)} = ${value(t0.product)}</div>`
                : `<div>第 ${t0.c + 1} 项：${value(t0.value)}</div>`).join('')
          : e.sources.map((src, k) => `<div>读取 ${shortRefName(s, src.id)}：<b>${value(src.value)}</b></div>`).join(''))
      : '';
    const sw = (cls, c) => `<i class="sw ${cls}" style="background:${c}"></i>`;
    const fmtRefRow = (refId, cls, col) => {
      const rName = shortRefName(s, refId);
      return `<div>${rName !== refId && !micro ? `<span class="role">${rName}</span> ` : ''}${refId} ${sw(cls, col)}</div>`;
    };
    const pullValTxt = intro ? '准备取数…' : ready ? '= ' + value(e.result) : u > .42 && term?.a ? `读取 → ${value(term.a.value)}` : '沿线取数…';
    const form = `<div class="stk">${fmtRefRow(refs[0]?.id || st.writes[0], 'row', pr.cw)}${refs[1] ? fmtRefRow(refs[1].id, 'col', pr.cx) : ''}${pool ? `<div><span class="role">索引 K</span> ik ${sw('ex', color(points[2].b))}</div>` : ''}<div class="val"><b>${pullValTxt}</b></div></div>`;
    const per = O.shape.slice(1).reduce((a, b) => a * b, 1), j = Math.floor(index / per), r = index % per;
    const location = st.writes[0] === 'attn_w' ? `第 ${Math.floor(index / 36) + 1} 头 · 查询 ${Math.floor(index % 36 / 6) + 1} → 键 ${index % 6 + 1}` : O.shape[0] === 6 ? `${wordOf(j)}${O.shape.length === 3 ? ` · 第 ${Math.floor(r / O.shape[2]) + 1} ${target.b.t.deck?.kind === 'head' ? '头' : target.b.t.deck?.kind === 'pick' ? '份' : '路'}` : ''} · 第 ${r % O.shape.at(-1) + 1} 个数` : `位置 ${index + 1} / ${N}`;
    const readShapes = st.reads.map(x => { const d = x === 'L44:residual_out' ? 'last_residual' : x; return '<b>[' + demo.get(d).shape.join(', ') + ']</b>' });
    const paramShapes = st.params.filter(p0 => !['scale_attn', 'base_attn', 'scale_ffn', 'base_ffn', 'ln_b'].includes(p0)).slice(0, 1).map(p0 => `${p0} <b>[${demo.W.tensors[p0].shape.join(', ')}]</b>`);
    const shapeLine = [...readShapes, ...paramShapes].join(' × ') + ` → <b>[${O.shape.join(', ')}]</b>`;
    const h = setCard(`${st.title} · ${location}`,
      `<i>形状</i>${shapeLine}`,
      `<i>算式</i><b style="white-space:normal;overflow-wrap:anywhere">${e.formula}</b>${micro ? '' : `<br>${e.detail}`}${rows ? `<div style="text-indent:0;margin-top:3px">${rows}</div>` : ''}${e.total > e.terms.length && op.phase === 'pull' && !micro ? `<div style="text-indent:0;color:#5c6963">共 ${e.total} 项；中间 ${e.total - e.terms.length} 项省略显示，仍参加计算。</div>` : ''}`,
      form, `lesson:${key}:${op.phase}:${term?.c}`);
    const pts = [target.point, ...points.map(p => p.point)], boxes = pool ? [...points.map(p => p.b), target.b] : [W, X, target.b];
    const sampled = pool ? e.sources : op.phase === 'pull' && picked.length ? picked.flatMap(t0 => [t0.a, t0.b].filter(Boolean)) : refs;
    const pins = () => [lessonPoint(s, { id: st.writes[0], index, weight: false }).point, ...sampled.map(r0 => lessonPoint(s, r0).point)];
    const pullBi = s.beats.findIndex(b0 => b0.op.lesson?.id === st.id && b0.op.phase === 'pull');
    const rowLines = pool ? e.terms.length * 2 : (e.terms.length || e.sources.length);
    const rowExtra = op.phase === 'pull' || micro ? 0 : rowLines * (shortStage() ? 15 : 21) + (e.total > e.terms.length ? (shortStage() ? 16 : 22) : 6);
    const fullH = h + rowExtra, fullSpan = fullH + geo.ph + tabGap();
    const spot = chooseSpot(s, pullBi >= 0 ? pullBi : bi, () => screenBox(target.b), fullSpan, pins, () => boxes.map(screenBox), null, fullH), pos = spotAt(spot, screenBox(target.b), fullSpan);
    const names = activeSegLabelBoxes(2, 2, true);
    const cardOp = intro ? (op.steady ? 1 : ease(Math.min(1, u * 2.4))) : 1;
    const tab = placeCard(pos.x, pos.y, h, cardOp, towardOf(pts), boxes.map(faceBox), true, pts, names);
    const drawnIn = intro ? (op.steady ? 1 : ease(clamp(u * 2.0 - .1))) : op.phase === 'pull' ? Math.max(.35, ease(u * 2.2)) : 1;
    const showOutArrow = ['place', 'trace'].includes(op.phase) ? 1 : op.phase === 'sum' ? ease((u - .40) / .55) : 0;
    const from = lines(pr, points[0]?.point || null, points[1]?.point || null, target.point, tab, drawnIn, cardOp, showOutArrow, op.phase === 'place' || op.phase === 'trace' ? 1 : .8, pool ? [[points[2].point, color(points[2].b), points[2].b.t.name]] : [], true);
    if (!micro) {
      const gapBoxes = ELIDED_GAPS ? [...ELIDED_GAPS.values()].map(rectOfLabel).filter(Boolean).map(r => [r.left, r.top, r.right, r.bottom]) : [];
      const lineSegs = ALL_LINES.filter(ln => ln.style.display === 'block' && ln._pts?.length >= 2 && +(ln.style.opacity || 1) >= .15).map(ln => ln._pts);
      const placedOmit = [];
      points.forEach((p, k) => {
        if (!p.omitted || !inPic(p.point)) return;
        const e0 = sourcePorts[5 + k];
        e0.textContent = `${shortRefName(s, refs[k].id)} #${p.candidate} · 省略区`;
        e0.style.borderColor = deep(k === 0 ? pr.cw : pr.cx);
        e0.style.display = 'block';
        const hw = (e0.offsetWidth || 136) / 2 + 4, hh = (e0.offsetHeight || 22) / 2 + 3;
        const obs = [cardState, pillState, ...gapBoxes, ...names, ...placedOmit, [p.point[0] - 8, p.point[1] - 8, p.point[0] + 8, p.point[1] + 8]].filter(Boolean);
        const preferDown = pillState && pillState[3] < p.point[1];
        const dyList = preferDown ? [24, -26, 42, -44, 60, -62] : [-26, 24, -44, 42, -62, 60];
        const cands = [
          ...dyList.map(dy => [p.point[0], p.point[1] + dy]),
          [p.point[0] - hw - 14, p.point[1]],
          [p.point[0] + hw + 14, p.point[1]],
          ...dyList.slice(0, 2).flatMap(dy => [[p.point[0] - hw * .65, p.point[1] + dy], [p.point[0] + hw * .65, p.point[1] + dy]]),
        ];
        let chosen = null;
        for (const [rx, ry] of cands) {
          const cx = Math.max(hw + 4, Math.min(stageW - hw - 4, rx)), cy = ry;
          if (cy - hh < 6 || cy + hh > stageH - 6) continue;
          const bx = [cx - hw, cy - hh, cx + hw, cy + hh];
          if (obs.some(([l, t0, r0, b0]) => bx[0] < r0 && bx[2] > l && bx[1] < b0 && bx[3] > t0)) continue;
          if (lineSegs.some(pts => pts.slice(1).some((pt, i0) => segHitsBox(pts[i0], pt, bx)))) continue;
          chosen = [cx, cy, bx]; break;
        }
        if (chosen) { put(e0, [chosen[0], chosen[1]]); placedOmit.push(chosen[2]) }
        else e0.style.display = 'none';
      });
    }
    markTarget(target.point, pr.co, target.b);
    if (target.omitted) { targetName.textContent = `省略位置 · #${index}`; targetName.dataset.omitted = 'true' }
    else { targetName.textContent = '写入位置'; delete targetName.dataset.omitted }

    if (op.phase === 'pull' && term?.a) {
      const useSecondLine = !dotPicked.length && !pool && termIdx === 1 && points[1];
      const activeLine = useSecondLine ? lx : lw;
      const dropVal = term.a.value;
      const dropCol = useSecondLine ? pr.cx : pr.cw;
      lessonDrop.textContent = value(dropVal);
      lessonDrop.style.background = dropCol;
      lessonDrop.style.borderColor = deep(dropCol);
      lessonDrop.style.display = 'block';
      lessonDrop._cw = lessonDrop.offsetWidth || 54;
      const dw = lessonDrop._cw / 2 + 5, dh = 14, v = ease(((u * picked.length) % 1) * 1.28);
      if (v < .94) {
        const L = activeLine.style.display === 'block' ? activeLine._len : 0;
        let posDrop = null;
        if (L > 12) {
          const avoid = [pillState, cardState].filter(Boolean);
          const hitsDrop = p0 => p0.x - dw < 6 || p0.x + dw > stageW - 6 || p0.y - dh < 6 || p0.y + dh > stageH - 6 || avoid.some(([l, t0, r0, b0]) => p0.x + dw > l && p0.x - dw < r0 && p0.y + dh > t0 && p0.y - dh < b0);
          let sDock = Math.min(L * .42, Math.max(dw, dh) + 6);
          for (; sDock < L * .85; sDock += 6) if (!hitsDrop(pointAtLen(activeLine, sDock))) break;
          let sStart = L;
          for (; sStart > sDock + 6; sStart -= 6) if (!hitsDrop(pointAtLen(activeLine, sStart))) break;
          const pt = pointAtLen(activeLine, Math.min(L, Math.max(sDock, sDock + (sStart - sDock) * (1 - v))));
          posDrop = [Math.max(dw + 6, Math.min(stageW - dw - 6, pt.x)), Math.max(dh + 6, Math.min(stageH - dh - 6, pt.y))];
        } else {
          const srcPt = useSecondLine ? points[1].point : points[0].point;
          const q = sourcePoint(srcPt, activeLine, pos.x + 20);
          const dst = [tab[0] + ((useSecondLine ? geo.col?.[0] : geo.row?.[0]) ?? geo.pw / 2), tab[1] + ((useSecondLine ? geo.col?.[1] : geo.row?.[1]) ?? geo.ph / 2)], vc = Math.min(.78, v);
          posDrop = [Math.max(dw + 6, Math.min(stageW - dw - 6, q[0] + (dst[0] - q[0]) * vc)), Math.max(dh + 6, Math.min(stageH - dh - 6, q[1] + (dst[1] - q[1]) * vc))];
        }
        put(lessonDrop, posDrop, v > .88 ? (.95 - v) / .07 : 1);
      } else lessonDrop.style.display = 'none';
    }
    if (op.phase === 'place' && from) {
      lessonDrop.textContent = value(e.result);
      lessonDrop._cw = 58;
      lessonDrop.style.background = pr.co;
      lessonDrop.style.borderColor = deep(pr.co);
      dropAlongArrow(lessonDrop, ease(u), from, target.point);
    }
  }

  function transitScene(op, u = 1) {
    hideDots();
    const l = op.transit, record = initialDemo.chain.layers[l], steps = M.layers[l].steps, st = steps[Math.min(steps.length - 1, Math.floor(u * steps.length))];
    if (!record || record.layer !== l) throw Error('Missing layer boundary ' + l);
    const padS = microStage() ? '6px 10px' : '10px 15px', fsS = microStage() ? '11px' : '13px';
    sentence.style.cssText = 'display:block;position:absolute;box-sizing:border-box;transform:none;left:12px;top:10px;max-width:min(540px,calc(100% - 24px));white-space:normal;padding:' + padS + ';background:rgba(255,255,254,.97);border:1px solid #cbd4c9;border-top:3px solid ' + (ACCENTS.resid || '#6f5e76') + ';border-radius:10px;box-shadow:0 8px 22px rgba(21,30,28,.09);font-size:' + fsS + ';line-height:1.65;z-index:9';
    sentence.innerHTML = `<b>${lid(l)} · 连续前向计算</b>　<span style="color:#52605a">春天 · 第 1 路 · 第 1 个数</span><br>层输入 <b style="font-family:var(--journey-font-mono)">${fmt(record.inputSample, 4)}</b> → 本层输出 <b style="font-family:var(--journey-font-mono)">${fmt(record.outputSample, 4)}</b>　·　<span style="color:#286151;font-weight:600">${u >= 1 ? '本层已完成' : st.title}</span><br><span style="font-size:12px;color:#52605a">直接读取 ${lid(l - 1)} 输出，写回后交给 ${l === 44 ? '最终归一化' : lid(l + 1)}。</span>`;
    const sr = sentence.getBoundingClientRect();
    cardState = [sr.left - hostLeft, sr.top - hostTop, sr.right - hostLeft, sr.bottom - hostTop];
    incomingPort.innerHTML = `${lid(l - 1)} 输出 → ${lid(l)}<br><b>[6, 4, 4096] · 来源入口</b>`;
    const port = [94, Math.min(stageH - 40, cardState[3] + 28)], entry = px(dataAt(B[lid(l) + ':x_attn'], 0, 0));
    put(incomingPort, port);
    lw.style.stroke = deep(onCard(look.palette.resid[0]));
    if (inPic(entry)) curve(lw, [port[0] + 78, port[1]], entry, 1, 'h');
    const target = B[lid(l) + ':residual_out'];
    markTarget(px(dataAt(target, 0, 0)), onCard(look.palette.resid[0]), target);
    targetName.textContent = '写入位置';
  }

  function sequenceScene(s, op, u, isDone = false) {
    hideDots();
    syncHostMetrics();
    const emCol = onCard(look.palette.embed[0]), nmCol = onCard(look.palette.norm[0]);
    const accent = op.last ? (ACCENTS.norm || '#787262') : (ACCENTS.embed || '#4d6778');
    layer.style.setProperty('--dot-out', deep(accent));
    const arrowHead = svg.querySelector('#dotarrow-path'); if (arrowHead) arrowHead.setAttribute('fill', deep(accent));

    const padQ = microStage() ? '6px 10px' : '10px 16px', fsQ = microStage() ? '11px' : '13px';
    sentence.style.cssText = 'display:block;position:absolute;box-sizing:border-box;left:50%;top:10px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 20px);white-space:normal;padding:' + padQ + ';background:rgba(255,255,254,.97);border:1px solid #cbd4c9;border-top:3px solid ' + accent + ';border-radius:10px;box-shadow:0 8px 24px rgba(21,30,28,.09);font-size:' + fsQ + ';line-height:1.58;z-index:9';
    const ids = initialDemo.ids, next = initialDemo.ends.at('next_id', 0);

    if (op.last) {
      sentence.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><b>只取最后一个位置：开了 · [1, 4096]</b><span style="font-size:12px;color:#52605a">前 5 个词的上下文已通过注意力汇入第 6 列，输出头只对这一列打分</span></div>`;
      const sr = sentence.getBoundingClientRect();
      cardState = [sr.left - hostLeft, sr.top - hostTop, sr.right - hostLeft, sr.bottom - hostTop];
      const readPt = px(dataAt(B.h_final, 5, 0));
      const adjRead = markTarget(readPt, nmCol, B.h_final) || readPt;
      targetName.textContent = '读取位置 · 开了';
      const headPt = px(V((B.h_final.x0 + B.h_final.x1) / 2, B.h_final.y0 - 18, 0));
      if (inPic(adjRead) && inPic(headPt)) {
        lo.style.stroke = deep(nmCol);
        curve(lo, [adjRead[0], adjRead[1] + 8], [Math.max(40, Math.min(stageW - 40, headPt[0])), Math.min(stageH - 28, Math.max(adjRead[1] + 54, headPt[1]))], isDone ? 1 : ease(u * 1.4), .12, 1);
      }
      return;
    }

    const activeTok = isDone && s.n === 3 ? -1 : op.token;
    const maxDoneTok = s.n === 3 ? (isDone ? 5 : op.token) : 5;
    const chips = words.map((w, j) => {
      const isCur = activeTok === j;
      const isPast = s.n === 3 ? (isDone || j < op.token || (j === op.token && u >= .45)) : true;
      const bg = isCur ? emCol : isPast ? '#eef4f8' : '#f7f8f6';
      const bd = isCur ? `1.6px solid ${deep(emCol)}` : isPast ? '1px solid #bfd1de' : '1px solid #dfe4dd';
      const op0 = isPast || isCur ? 1 : .48;
      return `<span data-tok-chip="${j}" style="display:inline-flex;flex-direction:column;align-items:center;padding:3px 9px;margin:0 3px;border-radius:6px;background:${bg};border:${bd};opacity:${op0};font-weight:${isCur ? 700 : 600};box-shadow:${isCur ? '0 3px 8px rgba(49,103,124,.16)' : 'none'}"><span>${w}</span><small style="font:600 10.5px var(--journey-font-mono);color:#395364">${ids[j]}</small></span>`;
    }).join('');

    sentence.innerHTML = `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px 2px">${chips}${op.append || op.cycle ? `<span class="appended-token" style="display:inline-flex;flex-direction:column;align-items:center;padding:3px 9px;margin-left:4px;border-radius:6px;background:${emCol};border:1.6px solid ${deep(emCol)};font-weight:700;opacity:${op.append && u < .78 ? .34 : 1}"><span>新 token</span><small style="font:600 10.5px var(--journey-font-mono)">${next}</small></span>` : ''}</div>`
      + `<div style="font-size:12px;color:#4e5c56;margin-top:5px">${op.append || op.cycle ? `序列长度 <b>${op.append && u < .78 ? '6 → 7' : '7'}</b>；教学示例 ID，非模型真实预测。` : isDone ? '6 个词已全部转为词表编号 [6]，与下方 6 列一一对齐，下一步进入词表查表。' : `正在分词第 <b>${op.token + 1}/6</b> 位：<b>${wordOf(op.token)} → ID ${ids[op.token]}</b>，沿线落入编号张量第 ${op.token + 1} 格。`}</div>`;
    if (op.cycle) {
      sentence.innerHTML += `<div style="font-size:12px;margin-top:3px;color:#286151"><b>快进一轮 · 结构回顾 ${Math.min(5, Math.floor(u * 5) + 1)}/5</b>：${['新编号入列', '查同一张词表', '依次穿过 45 层', '输出头打分', '再次采样选词'][Math.min(4, Math.floor(u * 5))]}</div>`;
    }

    const sr = sentence.getBoundingClientRect();
    cardState = [sr.left - hostLeft, sr.top - hostTop, sr.right - hostLeft, sr.bottom - hostTop];

    // Segment 3 (分词): per-column word + ID badges above B.ids + smooth curved arrow + flying token ID pill!
    if (op.token !== undefined) {
      const pL = px(dataAt(B.ids, 0, 0)), pR = px(dataAt(B.ids, 5, 0));
      const spanPx = Math.abs(pR[0] - pL[0]) / 5;
      const stagger = spanPx < 82;
      const roomAbove = slotPt => slotPt[1] - 60 >= cardState[3] + 20;
      for (let k = 0; k <= maxDoneTok; k++) {
        if (!isDone && k === op.token && u < .58) continue;
        const slotPt = px(dataAt(B.ids, k, 0));
        if (!inPic(slotPt)) continue;
        const badge = tokBadges[k];
        badge.classList.toggle('active', !isDone && k === op.token);
        const by = stagger
          ? (k % 2 === 0 ? Math.max(cardState[3] + 20, slotPt[1] - 24) : (roomAbove(slotPt) ? slotPt[1] - 60 : slotPt[1] + 26))
          : Math.max(cardState[3] + 20, slotPt[1] - 30);
        put(badge, [slotPt[0], by]);
      }
      const j = isDone ? 5 : op.token;
      const dstPt = px(dataAt(B.ids, j, 0));
      const chipEl = sentence.querySelector(`[data-tok-chip="${j}"]`);
      if (chipEl && inPic(dstPt)) {
        const cr = chipEl.getBoundingClientRect();
        const srcPt = [cr.left - hostLeft + cr.width / 2, cr.bottom - hostTop + 3];
        const endPt = [dstPt[0], dstPt[1] - 7];
        lo.style.stroke = deep(emCol);
        if (!isDone) {
          const lineDraw = ease(Math.min(1, u * 2.8));
          curve(lo, srcPt, endPt, lineDraw, 'v', .92);
          markTarget(dstPt, emCol);
          targetName.textContent = `第 ${j + 1} 格`;
          const flyU = ease(clamp((u - .06) / .50));
          if (flyU < .98) {
            lessonDrop.textContent = String(ids[j]);
            lessonDrop._cw = 58;
            lessonDrop.style.background = emCol;
            lessonDrop.style.borderColor = deep(emCol);
            dropAlongArrow(lessonDrop, flyU, srcPt, endPt);
          }
        } else {
          // At rest ("看算完的样子"): clean gentle reference link from last chip to slot 6 without distracting target box
          curve(lo, srcPt, [dstPt[0], dstPt[1] - (stagger ? 72 : 48)], 1, 'v', .42);
        }
      }
    }

    if (op.append) {
      const appEl = sentence.querySelector('.appended-token');
      if (appEl) {
        const rect = appEl.getBoundingClientRect();
        const dest = [rect.left - hostLeft + rect.width / 2, rect.bottom - hostTop + 4];
        const startPt = [Math.max(110, Math.min(stageW - 110, dest[0] + 120)), Math.min(stageH - 44, Math.max(dest[1] + 180, stageH - 64))];
        const exit = [startPt[0], startPt[1] - 24];
        incomingPort.innerHTML = `来自输出端选词<br><b>ID ${next}</b>`;
        put(incomingPort, startPt);
        lo.style.stroke = deep(emCol);
        curve(lo, exit, dest, ease(Math.min(1, u * 3.2)), 'v', 1);
        if (!isDone && u < .88) {
          lessonDrop.textContent = String(next);
          lessonDrop._cw = 58;
          lessonDrop.style.background = emCol;
          lessonDrop.style.borderColor = deep(emCol);
          dropAlongArrow(lessonDrop, ease(u / .82), exit, dest);
        }
      }
    }
    if (op.cycle) {
      const ck = Math.min(4, Math.floor(u * 5)), clayer = Math.max(0, Math.min(44, Math.floor((u * 5 - 2) * 45)));
      const focusBid = ['ids', 'W_embed', lid(clayer) + ':residual_out', 'W_head', 'next_id'][ck];
      const fb = B[focusBid];
      if (fb) {
        const dst = px(V((fb.x0 + fb.x1) / 2, (fb.y0 + fb.y1) / 2, fb.z1));
        if (inPic(dst)) {
          const src = [Math.max(40, Math.min(stageW - 40, (cardState[0] + cardState[2]) / 2)), cardState[3] + 3];
          const cycCol = onCard(look.palette[fb.comp][0]);
          lo.style.stroke = deep(cycCol);
          const ahd = svg.querySelector('#dotarrow-path'); if (ahd) ahd.setAttribute('fill', deep(cycCol));
          curve(lo, src, dst, 1, 'v', .88);
          markTarget(dst, cycCol);
          targetName.textContent = ['① 新编号入列', '② 查词表', `③ 经 ${lid(clayer)}`, '④ 输出头打分', '⑤ 选出新词'][ck];
        }
      }
    }
  }

  // ---- Pure function apply(s, t)
  const PAGE_COLOR = new THREE.Color(PAGE);
  let prevLitKey = '', word = -1, dotNow = null, later = null, appliedThisFrame = false;

  function refreshOverlays() {
    if (!cur) return;
    camera.updateMatrixWorld();
    marks();
    later = null;
    if (dotNow) dotNow();
    else { hideDots(); if (cur.incoming?.length && t < durationOf(cur)) incomingPoint() }
    if (later) later();
    if (hideUnderUI) hideUnderUI();
    const actPts = ALL_LINES.filter(p => p.style.display === 'block' && p._pts?.length >= 2 && +(p.style.opacity || 1) >= .15).map(p => p._pts);
    if (actPts.length) {
      for (const e of segLabels.get(cur.n) || []) {
        if (e.classList.contains('word')) continue;
        const ent = entryByEl.get(e);
        if (!ent?.vis || !ent.rect) continue;
        const bx = [ent.rect.left, ent.rect.top, ent.rect.right, ent.rect.bottom];
        const crossed = actPts.some(pts => {
          const s0 = pts[0], e0 = pts.at(-1);
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            if (Math.hypot(a[0] - s0[0], a[1] - s0[1]) < 6 && Math.hypot(b[0] - s0[0], b[1] - s0[1]) < 12) continue;
            if (Math.hypot(b[0] - e0[0], b[1] - e0[1]) < 8 && Math.hypot(a[0] - e0[0], a[1] - e0[1]) < 14) continue;
            if (segHitsBox(a, b, bx)) return true;
          }
          return false;
        });
        if (crossed) { e.style.display = 'none'; ent.vis = false }
      }
    }
    placeTargetName();
  }

  function apply(s, tVal, cam = true) {
    demo = s.global ? initialDemo.ends : s.layer === 0 ? initialDemo : initialDemo.layers?.[s.layer];
    if (!demo) throw Error('Missing numerical data for ' + lid(s.layer));
    sentence.style.display = 'none'; targetName.textContent = '写入位置';
    host.classList.toggle('short', shortStage());
    host.classList.toggle('micro', microStage());
    CW = microStage() ? Math.min(232, stageW - 20) : shortStage() || (stageW < 700 && (s.n >= 20 || s.lessonData || COMPACT_OLD.has(s.n))) ? 300 : 360;
    word = -1; dotNow = null;
    const dur = durationOf(s), done = tVal >= dur;

    let acc0 = 0, bi = 0;
    for (let i = 0; i < s.beats.length; i++) {
      const bd = s.beats[i].dur;
      if (!done && tVal >= acc0 && tVal < acc0 + bd) { bi = i; break }
      acc0 += bd;
    }
    if (done) bi = s.beats.length - 1;
    const curBeatOp = s.beats[bi]?.op || {};
    const baseFade = curBeatOp.overview ? OVERVIEW_FADE : curBeatOp.cycle ? .54 : FADE;

    resetDirtyBlocks(baseFade);
    const lit = new Set(), part = new Map();
    const light = (bid, box) => {
      if (!look.byId.has(bid)) return;
      if (box) { if (!lit.has(bid)) part.set(bid, box) }
      else {
        lit.add(bid); part.delete(bid);
        if (B[bid + '/0']) { lit.add(bid + '/0'); part.delete(bid + '/0') }
      }
    };
    if (!done) for (const o of OUTS.get(s.n)) growTo(o, 0);

    let acc = 0;
    for (const [i, beat] of s.beats.entries()) {
      if (tVal < acc && !done) break;
      const u = done ? 1 : clamp((tVal - acc) / beat.dur), now = !done && tVal >= acc && tVal < acc + beat.dur;
      run(s, beat, u, done ? bid => light(bid) : now ? light : () => {}, done);
      const sum = beat.op.dot || beat.op.mix || beat.op.conv || beat.op.write || beat.op.coef || beat.op.fg || beat.op.beta;
      if (now && sum) dotNow = () => dotScene(s, i, sumParts(beat.dot ? { ...s, dot: beat.dot } : s, beat.op.dot ? 'dot' : beat.op.mix ? 'mix' : beat.op.conv ? 'conv' : beat.op.write ? 'write' : beat.op.coef ? 'coef' : beat.op.fg ? 'fg' : 'beta'), ...(sum === 'all' ? allPhase(u) : [sum, u]));
      if (now && beat.op.kda) dotNow = () => { const [kind, ph, v] = kdaPhase(beat.op.kda, u); dotScene(s, i, sumParts(s, kind), ph, v) };
      if (now && beat.op.gn) dotNow = () => gnScene(s, i, beat.op.gn, u);
      if (now && beat.op.ew) dotNow = () => pairScene(s, i, ewPairs(s), ...(beat.op.ew === 'all' ? ewAll(u) : [beat.op.ew, u]));
      if (now && beat.op.norm) dotNow = () => normScene(s, i, ...(beat.op.norm === 'all' ? normAll(u) : [beat.op.norm, u]));
      if (now && beat.op.trace) dotNow = () => traceScene(s, i, beat.op, u, !s.beats[i + 1]?.op.trace);
      if (now && beat.op.route) dotNow = () => routeScene(s, i, beat.op.route, u);
      if (now && beat.op.expert) dotNow = () => expertScene(s, i, beat.op, u);
      if (now && beat.op.merge) dotNow = () => mergeScene(s, i, beat.op, u);
      if (now && beat.op.lesson) dotNow = () => lessonScene(s, i, beat.op, u);
      if (now && (beat.op.token !== undefined || beat.op.last || beat.op.append || beat.op.cycle)) dotNow = () => sequenceScene(s, beat.op, u, false);
      if (now && beat.op.transit !== undefined) dotNow = () => transitScene(beat.op, u);
      if (now && beat.op.shape) dotNow = () => { hideDots(); later = () => dims(dotParts(s).pr, 1) };
      acc += beat.dur;
    }

    if (!done) {
      for (const o of OUTS.get(s.n)) {
        const u = look.byId.get(o)?.material.uniforms.uGrow.value;
        if (u && ((u.x > 0 && u.x < 1e8) || (u.x === 0 && u.y > 0) || u.x >= 1e8) && !part.has(o)) light(o);
      }
    }
    for (const bid of lit) dimOneB(bid, 0);
    for (const [bid, box] of part) focusB(bid, box, 0);
    lastParts = done ? 0 : part.size;

    const beatObj = s.beats[done ? s.beats.length - 1 : bi] || {}, bNow = beatObj.op || {};
    const outId = bNow.token !== undefined ? 'ids'
      : bNow.lesson ? bNow.lesson.writes[0] : bNow.trace ? bNow.trace[2] : bNow.dot ? (beatObj.dot || s.dot).out
      : bNow.mix ? s.mix.out : bNow.coef ? s.coef.out : bNow.write ? s.write.out : bNow.norm ? s.norm.out
      : bNow.conv ? s.conv.out : bNow.fg ? s.fg.out : bNow.beta ? s.beta.out : bNow.kda ? s.kda.out
      : bNow.gn ? s.gn.out : bNow.ew ? s.ew.out : bNow.route ? s.route.weights
      : bNow.expert ? (bNow.expert === 'select' ? 'W_gu' : s.expert.stages[bNow.expert].out)
      : bNow.merge ? s.merge[bNow.merge].out
      : bNow.words ? [bNow.words].flat()[0] : null;
    activeComp = outId ? B[id(s, outId)]?.comp : null;

    // In Seg 3 (分词), x0 (词向量) is not yet computed — render it as an uncomputed 6-column blueprint slot waiting for Seg 4
    if (s.n === 3) {
      growTo('x0', 0); recvB('x0', 1); dimOneB('x0', .18);
      lit.add('x0');
    }
    if (bNow.recv) {
      const rid = id(s, bNow.recv);
      light(rid); dimOneB(rid, 0);
      if (B[rid + '/0']) dimOneB(rid + '/0', 0);
      if (!done) recvB(rid, 1);
    }

    // Highlight only the active beat's receiving tensor(s) as blueprint slots (docs/3d-teaching-standard.md)
    if (!done) {
      if (outId && bNow.expert !== 'select') recvB(id(s, outId), 1);
      if (bNow.words) for (const w of [bNow.words].flat()) recvB(id(s, w), 1);
      if (bNow.route) { recvB(id(s, s.route.indices), 1); recvB(id(s, s.route.weights), 1) }
      if (bNow.lesson) for (const w of bNow.lesson.writes) recvB(id(s, w), 1);
    }

    const on = new Set([...lit, ...part.keys()]);
    if (ELIDED_GAPS) {
      for (const [eid, gapEl] of ELIDED_GAPS) gapEl.dataset.elidedActive = on.has(eid) ? '1' : '0';
    }
    const litKey = baseFade + ':' + [...on].sort().join(',');
    if (litKey !== prevLitKey) {
      prevLitKey = litKey;
      if (arrowBatch) arrowBatch.syncDim(a => on.has(a.from) && on.has(a.to), PAGE_COLOR, baseFade);
    }

    if (cam && follow) camAt(s, done ? dur : tVal);
    if (done && s.beats.at(-1).op.transit !== undefined) dotNow = () => transitScene(s.beats.at(-1).op, 1);
    if (done && [3, 35, 38].includes(s.n)) dotNow = () => sequenceScene(s, s.beats.at(-1).op, 1, true);

    if (s.focusLabels) {
      const beat = s.beats[done ? s.beats.length - 1 : bi], pose = s.poses[beat.cam];
      const visIds = beat.op.lesson
        ? [...beat.op.lesson.writes, ...beat.op.lesson.reads, ...beat.op.lesson.params]
        : pose.poseShowLabels
          ? pose.poseShowLabels
          : s.lessonData && beat.op.show
            ? [...beat.op.show, ...(beat.op.recv ? [beat.op.recv] : [])]
            : [...(pose.ids || []), ...(pose.labels || [])];
      segLabels.get(s.n).forEach((e, i) => {
        if (e.classList.contains('word')) return;
        e.classList.toggle('off', !visIds.includes(s.labels[i]?.id));
      });
    }

    refreshOverlays();
    appliedThisFrame = true;
    frame();
    return done ? s.beats.length - 1 : bi;
  }

  if (setAfterRender) {
    setAfterRender(() => {
      if (appliedThisFrame) { appliedThisFrame = false; return }
      if (cur) refreshOverlays();
    });
  }
  if (setOnResize) {
    setOnResize((nw, nh) => {
      stageW = nw; stageH = nh;
      syncHostMetrics();
      syncCompactLabelStyles();
      SPOT.clear(); rawPose.clear(); fittedSegs.clear(); dimsFor = null; geo = null; lastCardSig = '';
      if (cur) apply(cur, t, follow && !goAnim);
    });
  }
  controls.addEventListener('change', () => {
    if (cur && !playing && !goAnim && [...layer.children].some(e => e !== svg && e.style.display === 'block')) apply(cur, t, false);
  });

  let entry = null;
  function camAt(s, tVal) {
    let acc = 0, prev = entry;
    for (const beat of s.beats) {
      const P = getPose(s, beat.cam);
      if (tVal < acc + beat.dur || beat === s.beats.at(-1)) {
        if (!prev) return blend(P, P, 1);
        return blend(prev, P, (tVal - acc) / (beat.camT || CAM_T));
      }
      prev = P; acc += beat.dur;
    }
  }

  // ---- Clock & Visibility Pause
  let t = 0, playing = false, speed = 1, follow = true, last = 0, goAnim = null, rafId = 0;
  const post = m => parent !== window && parent.postMessage(m, location.origin);
  const tick = () => { if (!cur) return; const dur = durationOf(cur); post({ ev: 'tick', n: cur.n, t: Math.min(t, dur), dur, beat: apply(cur, t, !goAnim), playing }) };

  function loop(now) {
    rafId = 0;
    if (document.hidden) return;
    if (goAnim) {
      const u = (now - goAnim.t0) / 1000 / GO_T;
      blend(goAnim.from, goAnim.to, u);
      if (u >= 1) goAnim = null;
      if (cur && !playing) { refreshOverlays(); appliedThisFrame = true }
      frame();
    }
    if (playing) {
      t += Math.min(.1, (now - last) / 1000) * speed;
      last = now;
      const dur = durationOf(cur);
      if (t >= dur) { t = dur; playing = false; tick(); post({ ev: 'end', n: cur.n }) }
      else tick();
    }
    if (playing || goAnim) rafId = requestAnimationFrame(loop);
  }
  const kick = () => { last = performance.now(); if (!rafId && !document.hidden) rafId = requestAnimationFrame(loop) };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = 0 } }
    else if (playing || goAnim) kick();
  });

  controls.addEventListener('start', () => { if (cur || playing || goAnim) { follow = false; goAnim = null; post({ ev: 'follow', on: false }) } });

  function go(n) {
    const s = SEGMENTS.find(x => x.n === n); if (!s) return;
    cur = s; t = durationOf(s); playing = false; follow = true; showLabels(n); entry = null;
    const to = getPose(s, s.beats.at(-1).cam);
    goAnim = { from: snap(), to, t0: performance.now() };
    apply(s, t, false); tick(); kick();
  }
  function play(n, restart = false) {
    const s = SEGMENTS.find(x => x.n === n); if (!s) return;
    const switched = !cur || cur.n !== n;
    const fresh = switched || restart || t >= durationOf(s) || t === 0;
    cur = s; goAnim = null; showLabels(n);
    if (switched || restart || t >= durationOf(s)) t = 0;
    entry = snap();
    if (fresh) { follow = true; post({ ev: 'follow', on: true }) }
    playing = true; tick(); kick();
  }

  window.addEventListener('message', e => {
    if (e.origin !== location.origin) return;
    const m = e.data || {};
    if (m.cmd === 'go') go(m.n);
    else if (m.cmd === 'play') play(m.n, !!m.restart);
    else if (m.cmd === 'pause') { playing = false; tick() }
    else if (m.cmd === 'seek') { if (!cur || cur.n !== m.n) go(m.n); goAnim = null; playing = false; entry = entry || getPose(cur, cur.beats[0].cam); t = m.t; tick() }
    else if (m.cmd === 'speed') speed = m.v;
    else if (m.cmd === 'follow') { follow = m.on; if (follow && cur) tick() }
    else if (m.cmd === 'resize' && m.w && m.h) {
      if (window.__truth?.resizeStage) window.__truth.resizeStage(m.w, m.h);
    }
    else if (m.cmd === 'whole') {
      cur = null; playing = false; hideDots(); showLabels(-1);
      if (ELIDED_GAPS) for (const [, gapEl] of ELIDED_GAPS) delete gapEl.dataset.elidedActive;
      for (const x of look.meshes) {
        const bid = x.userData.block.id;
        look.grow(bid, null); look.focus(bid, null); look.dimOne(bid, 0); look.setRecv(bid, 0);
      }
      allFaded = false; dirtyBlocks.clear(); prevLitKey = '';
      if (arrowBatch) arrowBatch.syncDim(() => true, PAGE_COLOR, 0);
      goAnim = { from: snap(), to: start, t0: performance.now() };
      frame(); kick();
    }
  });

  post({ ev: 'ready', segs: Object.fromEntries(SEGMENTS.map(s => [s.n, durationOf(s)])) });
  let lastParts = 0;
  return { go, play, apply, POSE, parts: () => lastParts };
}
