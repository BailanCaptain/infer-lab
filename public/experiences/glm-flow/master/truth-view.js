// Page helpers shared by the one-layer page and the 45-layer page (prototype, 2026-09-23): HTML labels re-projected
// through the camera on every change, and a camera fit that puts a box into the free band between the title and the
// legend strip. Cached stage-local label metrics avoid per-frame synchronous layout thrashing during 60fps playback.
import * as THREE from 'three';

export function makeView({ host, W: initW, H: initH, camera, controls }) {
  let W = initW, H = initH, cachedMode = '';
  const V = (x, y, z) => new THREE.Vector3(x, y, z), labels = [], _q = new THREE.Vector3(), _c = new THREE.Vector3();

  function anchorOf(cl, far) {
    if (far && cl.contains('out-head')) return [-1, 0, 0, 3];
    const ax = cl.contains('rr') || cl.contains('tr') || cl.contains('br') ? -1 : cl.contains('r') || cl.contains('tl') || cl.contains('bl') ? 0 : -.5;
    const ay = cl.contains('t') || cl.contains('tl') || cl.contains('tr') ? -1 : cl.contains('b') || cl.contains('bl') || cl.contains('br') ? 0 : -.5;
    return [ax, ay, 0, cl.contains('stag') ? -17 : 0];
  }

  function label(html, p, cls = 'c', nudge = false) {
    const el = document.createElement('div');
    el.className = 'l ' + cls;
    el.innerHTML = html;
    host.append(el);
    const entry = { el, p, nudge, w: -1, h: -1, htmlLen: -1, sx: 0, sy: 0, vis: false, rect: null };
    labels.push(entry);
    return el;
  }

  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  function invalidate() {
    for (let i = 0; i < labels.length; i++) labels[i].w = -1;
  }

  function syncModeKey() {
    const cl = host.classList;
    const key = `${W}x${H}:${cl.contains('far') ? 1 : 0}:${cl.contains('ultrafar') ? 1 : 0}:${cl.contains('compact-in') ? 1 : 0}:${cl.contains('short') ? 1 : 0}:${cl.contains('micro') ? 1 : 0}`;
    if (key !== cachedMode) { cachedMode = key; invalidate() }
  }

  function isCssSuppressed(el, inseg, far, ultrafar, compactIn) {
    const cl = el.classList;
    if (cl.contains('off') || cl.contains('narrow')) return true;
    if (inseg && !cl.contains('seg') && el.dataset.elidedActive !== '1') return true;
    if (far && (cl.contains('minor') || cl.contains('layer-mid') || cl.contains('inner'))) return true;
    if (ultrafar && cl.contains('layer-col-mid')) return true;
    if (compactIn && cl.contains('in-micro')) return true;
    return false;
  }

  function place() {
    syncModeKey();
    camera.updateMatrixWorld();
    const cl = host.classList, inseg = cl.contains('inseg'), far = cl.contains('far'), ultrafar = cl.contains('ultrafar'), compactIn = cl.contains('compact-in');
    const active = [];
    for (let i = 0; i < labels.length; i++) {
      const l = labels[i], el = l.el;
      l.vis = false; l.rect = null;
      if (isCssSuppressed(el, inseg, far, ultrafar, compactIn)) {
        if (el.style.display !== 'none') el.style.display = 'none';
        continue;
      }
      _q.copy(l.p).project(camera);
      if (_q.z > 1 || Math.abs(_q.x) > 1.2 || Math.abs(_q.y) > 1.2) {
        if (el.style.display !== 'none') el.style.display = 'none';
        continue;
      }
      l.sx = (_q.x + 1) * W * .5;
      l.sy = (1 - _q.y) * H * .5;
      if (el.style.display === 'none') el.style.display = '';
      if (el.style.left !== '0px') { el.style.left = '0'; el.style.top = '0' }
      active.push(l);
    }

    // Batch-measure any newly visible or resized label in one single read pass before writing transforms.
    for (let i = 0; i < active.length; i++) {
      const l = active[i], len = l.el.innerHTML.length, cls = l.el.className;
      if (l.w < 0 || l.htmlLen !== len || l.cls !== cls) {
        l.w = l.el.offsetWidth;
        l.h = l.el.offsetHeight;
        l.htmlLen = len;
        l.cls = cls;
      }
    }

    const taken = [], nudged = [], gaps = [];
    const clampX = r => {
      if (r.right - r.left > W - 10) return 0;
      return r.left < 5 ? 5 - r.left : r.right > W - 5 ? (W - 5) - r.right : 0;
    };
    for (let i = 0; i < active.length; i++) {
      const l = active[i];
      if (l.w <= 0 || l.h <= 0) { l.el.style.display = 'none'; continue }
      const [ax, ay, ox, oy] = anchorOf(l.el.classList, far);
      const left = l.sx + ax * l.w + ox, top = l.sy + ay * l.h + oy;
      l.rect = { left, right: left + l.w, top, bottom: top + l.h, _elided: l.el.classList.contains('elided-gap') };
      if (l.nudge) nudged.push(l);
      else if (l.rect._elided) gaps.push(l);
      else {
        const rawDx = !inseg ? clampX(l.rect) : 0;
        const cand = rawDx ? { left: l.rect.left + rawDx, right: l.rect.right + rawDx, top: l.rect.top, bottom: l.rect.bottom } : null;
        const dx = cand && !taken.some(t => hit(cand, t)) ? rawDx : 0;
        if (dx) { l.rect.left += dx; l.rect.right += dx }
        l.vis = true;
        taken.push(l.rect);
        l.el.style.translate = `${l.sx + dx}px ${l.sy}px`;
      }
    }
    for (let i = 0; i < gaps.length; i++) {
      const l = gaps[i];
      const force = l.el.dataset.elidedActive === '1';
      if (taken.some(t => hit(l.rect, t) && (!force || t._elided))) {
        l.el.style.display = 'none'; l.rect = null; continue;
      }
      l.vis = true;
      taken.push(l.rect);
      l.el.style.translate = `${l.sx}px ${l.sy}px`;
    }

    nudged.sort((a, b) => a.rect.top - b.rect.top);
    const at = (r, dx, dy) => ({ left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy });
    const clear = (r, dx, dy) => !taken.some(t => hit(at(r, dx, dy), t));
    const step = (r, dx, up) => {
      let dy = 0;
      for (let k = 0; k < 12 && !clear(r, dx, dy); k++) {
        const o = taken.find(t => hit(at(r, dx, dy), t));
        dy = up ? o.top - r.bottom - 3 : o.bottom - r.top + 3;
        if (Math.abs(dy) > 48) return null;
      }
      return clear(r, dx, dy) ? dy : null;
    };
    for (let i = 0; i < nudged.length; i++) {
      const l = nudged[i], r = l.rect, clL = l.el.classList;
      const dx = !inseg ? clampX(r) : 0;
      const up = clL.contains('t') || clL.contains('tl') || clL.contains('tr');
      let dy = step(r, dx, up);
      if (dy === null) dy = step(r, dx, !up);
      if (dy === null) { l.el.style.display = 'none'; l.rect = null; continue }
      const nr = (dx || dy) ? at(r, dx, dy) : r;
      l.rect = nr; l.vis = true;
      taken.push(nr);
      l.el.style.translate = `${l.sx + dx}px ${l.sy + dy}px`;
    }
  }

  const overUI = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  function hideUnderUI(ids = ['title', 'legend', 'views', 'hint', 'dotcard', 'dotpill', 'dotsentence']) {
    const hr = host.getBoundingClientRect();
    const us = [];
    for (let i = 0; i < ids.length; i++) {
      const u = document.getElementById(ids[i]);
      if (!u || u.hidden || u.style.display === 'none') continue;
      const r = u.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) us.push({ left: r.left - hr.left, right: r.right - hr.left, top: r.top - hr.top, bottom: r.bottom - hr.top });
    }
    for (let i = 0; i < labels.length; i++) {
      const l = labels[i];
      if (!l.vis || !l.rect) continue;
      const r = l.rect, edgeCut = r.left < 1 || r.right > W - 1 || r.top < 1 || r.bottom > H - 1;
      if (edgeCut || us.some(u => overUI(r, u))) {
        l.el.style.display = 'none';
        l.vis = false;
      }
    }
  }

  let lastFit = null, shrink = 1;
  const topBand = () => {
    const hr = host.getBoundingClientRect(), tt = document.getElementById('title'), vw = document.getElementById('views');
    return Math.max(tt ? tt.getBoundingClientRect().bottom - hr.top : 0, vw && W <= 920 ? vw.getBoundingClientRect().bottom - hr.top : 0);
  };
  function fit(box, dir, margin = .9, shift = [0, 0], own = false, zoom = 1) {
    if (!own) lastFit = [box, dir, margin, shift];
    const sh = (own ? 1 : shrink) * zoom;
    const hr = host.getBoundingClientRect(), t0 = topBand(), lg = document.getElementById('legend');
    const top = t0 > 0 ? t0 + 6 : 0, bot = lg ? lg.getBoundingClientRect().top - hr.top - 6 : H;
    const cy = 1 - (top + bot) / H, hy = (bot - top) / H, sy = cy + shift[1] * hy, mx = (margin - Math.abs(shift[0])) * sh, my = (.94 - Math.abs(shift[1])) * hy * sh;
    const c = V((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2), corners = [];
    for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) for (const z of [box.z0, box.z1]) corners.push(V(x, y, z));
    const n = dir.clone().normalize(); let d = Math.max(box.x1 - box.x0, box.y1 - box.y0) * 2;
    for (let i = 0; i < 16; i++) {
      camera.position.copy(c).addScaledVector(n, d); camera.lookAt(c); camera.updateMatrixWorld(true);
      const qc = _c.copy(c).project(camera); let m = 0;
      for (const p of corners) { const q = _q.copy(p).project(camera); m = Math.max(m, Math.abs(q.x - qc.x) / mx, Math.abs(q.y - qc.y) / my) }
      if (Math.abs(m - 1) < 1e-4) break;
      d *= m;
    }
    camera.position.copy(c).addScaledVector(n, d); camera.lookAt(c); camera.updateMatrixWorld(true);
    const q = _c.copy(c).project(camera), back = V(shift[0] - q.x, sy - q.y, q.z).unproject(camera).sub(c);
    camera.position.sub(back); controls.target.copy(c).sub(back); camera.lookAt(controls.target); controls.update();
  }

  function settle(mine = () => true, afterFit = null) {
    if (!lastFit) return; shrink = 1; fit(...lastFit); if (afterFit) afterFit();
    const hr = host.getBoundingClientRect(), lg = document.getElementById('legend');
    for (let k = 0; k < 24; k++) {
      place();
      const t = topBand(), g = lg ? lg.getBoundingClientRect().top - hr.top : H;
      if (!labels.some(l => {
        if (!l.vis || !l.rect || !mine(l)) return false;
        const r = l.rect;
        return r.top < t + 4 || r.bottom > g - 4 || r.left < 4 || r.right > W - 4;
      })) break;
      shrink *= .94; fit(...lastFit); if (afterFit) afterFit();
    }
  }

  function resize(newW, newH) { W = newW; H = newH; invalidate() }
  const title = (h, sub) => { const el = document.createElement('div'); el.id = 'title'; el.innerHTML = h + (sub ? `<i>${sub}</i>` : ''); host.append(el) };
  return { V, label, labels, place, hideUnderUI, fit, settle, title, resize, invalidate };
}
