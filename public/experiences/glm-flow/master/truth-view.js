// Page helpers shared by the one-layer page and the 45-layer page (prototype, 2026-09-23): HTML labels re-projected
// through the camera on every change, and a camera fit that puts a box into the free band between the title and the
// legend strip.
import * as THREE from 'three';

export function makeView({ host, W, H, camera, controls }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), labels = [];
  function label(html, p, cls = 'c', nudge = false) { const el = document.createElement('div'); el.className = 'l ' + cls; el.innerHTML = html; host.append(el); labels.push({ el, p, nudge }); return el }
  // labels never cover each other: line titles and ruler marks stay put, a block's name steps away from whatever it would
  // cover (a name under a block moves down, a name over a block moves up; at most 60 px, else it tries the other way)
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  function place() {
    camera.updateMatrixWorld();
    for (const { el, p } of labels) { const q = p.clone().project(camera), off = q.z > 1 || Math.abs(q.x) > 1.2 || Math.abs(q.y) > 1.2; el.style.display = off ? 'none' : ''; el.style.left = '0'; el.style.top = '0'; el.style.translate = (q.x + 1) * W / 2 + 'px ' + (1 - q.y) * H / 2 + 'px' }
    const vis = labels.filter(l => l.el.style.display !== 'none'), box = new Map(vis.map(l => [l, l.el.getBoundingClientRect()])), taken = vis.filter(l => !l.nudge).map(l => box.get(l));
    const at = (r, dy) => ({ left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy }), clear = (r, dy) => !taken.some(t => hit(at(r, dy), t));
    const step = (r, up) => { let dy = 0; for (let k = 0; k < 12 && !clear(r, dy); k++) { const o = taken.find(t => hit(at(r, dy), t)); dy = up ? o.top - r.bottom - 2 : o.bottom - r.top + 2; if (Math.abs(dy) > 60) return null } return clear(r, dy) ? dy : null };
    for (const l of vis.filter(l => l.nudge).sort((a, b) => box.get(a).top - box.get(b).top)) {
      // (a name with no room within 60 px either way waits until the reader comes closer: it hides rather than lie on another)
      const r = box.get(l), up = l.el.classList.contains('t'); let dy = step(r, up); if (dy === null) dy = step(r, !up); if (dy === null) { l.el.style.display = 'none'; continue }
      if (dy) { const [x, y] = l.el.style.translate.split(' ').map(parseFloat); l.el.style.translate = x + 'px ' + (y + dy) + 'px' } taken.push(at(r, dy));
    }
  }
  // The box goes into the free band between the title and the legend strip (measured, so a short window never puts a
  // block or its name under them); `shift` moves it within the band, in the band's own half-widths.
  let lastFit = null, shrink = 1;
  // (own = true: a fit of its own, e.g. a player's pose — not the page's view, not stepped back by settle)
  function fit(box, dir, margin = .9, shift = [0, 0], own = false) {
    if (!own) lastFit = [box, dir, margin, shift];
    const sh = own ? 1 : shrink;
    const tt = document.getElementById('title'), lg = document.getElementById('legend'), top = tt ? tt.getBoundingClientRect().bottom + 6 : 0, bot = lg ? lg.getBoundingClientRect().top - 6 : H;
    const cy = 1 - (top + bot) / H, hy = (bot - top) / H, sy = cy + shift[1] * hy, mx = (margin - Math.abs(shift[0])) * sh, my = (.94 - Math.abs(shift[1])) * hy * sh;
    const c = V((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2), corners = []; for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) for (const z of [box.z0, box.z1]) corners.push(V(x, y, z));
    const n = dir.clone().normalize(); let d = Math.max(box.x1 - box.x0, box.y1 - box.y0) * 2;
    // size it around its own middle (the move to the band's middle comes after), so the shift is counted once
    for (let i = 0; i < 40; i++) { camera.position.copy(c).addScaledVector(n, d); camera.lookAt(c); camera.updateMatrixWorld(true); const qc = c.clone().project(camera); let m = 0; for (const p of corners) { const q = p.clone().project(camera); m = Math.max(m, Math.abs(q.x - qc.x) / mx, Math.abs(q.y - qc.y) / my) } d *= m }
    camera.position.copy(c).addScaledVector(n, d); camera.lookAt(c); camera.updateMatrixWorld(true);
    // centre the band: move the target so the box's middle lands on the band's middle, not the screen's
    const q = c.clone().project(camera), back = V(shift[0] - q.x, sy - q.y, q.z).unproject(camera).sub(c); camera.position.sub(back); controls.target.copy(c).sub(back); camera.lookAt(controls.target); controls.update();
  }
  // once the title and the legend are on the page: fit again, then step back a little at a time until no name hangs
  // under the title or the legend or off the page (the fit only knows the blocks, not the names under them). `mine`
  // picks the names that belong to what was fitted (on the 45-layer page, the other layers' names are meant to be cut off)
  function settle(mine = () => true) {
    if (!lastFit) return; shrink = 1; fit(...lastFit); const tt = document.getElementById('title'), lg = document.getElementById('legend');
    for (let k = 0; k < 8; k++) { place(); const t = tt ? tt.getBoundingClientRect().bottom : 0, g = lg ? lg.getBoundingClientRect().top : H;
      if (!labels.some(l => { const { el } = l; if (el.style.display === 'none' || !mine(l)) return false; const r = el.getBoundingClientRect(); return r.top < t || r.bottom > g || r.left < 0 || r.right > W })) break; shrink *= .95; fit(...lastFit) }
  }
  const title = (h, sub) => { const el = document.createElement('div'); el.id = 'title'; el.innerHTML = h + (sub ? `<i>${sub}</i>` : ''); host.append(el) };
  return { V, label, labels, place, fit, settle, title };
}
