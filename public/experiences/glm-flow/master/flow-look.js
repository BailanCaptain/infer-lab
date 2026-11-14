// How a block and an arrow look in the bbycroft-style layout (the master, since 2026-09-24). The look the user approved on 09-24
// ("顺眼了，还是画格子线好"), unchanged: a tensor is one box; its cells are worked out for every pixel (a line one CSS
// pixel wide on every inner cell edge the block's `cut` keeps — words, heads, streams …, never every 256 numbers (09-25) —, a step darker; every cell its own shade, grouped into about-square patches once
// cells get small; no outline, no lighting, each face a constant tint). What changes with the layout: a block says itself
// how many cells run along each axis (`div`) and along which axis its heads alternate (`alt`), so words can run along x,
// numbers down y and heads back in depth.
// Colours: one per component (the user: "组件一色也行"), from a published palette; results in the full colour, weights
// a lighter step of the same hue. No mark on the tracked word at rest (the user: "锈红也太难看") — as in bbycroft, where
// a word lights up only while it is being computed.
import * as THREE from '../../vendor/build/three.module.js';
import { PAGE, PALETTES, loadPalette } from './flow-colors.js';
export { PAGE, PALETTES };   // the colours live in flow-colors.js (one source for the 3D layers and the 2D diagrams)

const WNOISE = .16, DNOISE = .10;
const srgb = hex => new THREE.Vector3(...[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255));   // kept in sRGB: the shader converts

// a side thinner on the screen than uMinPx device pixels is drawn that thick, about the block's middle (uViewH: the
// drawing's height in device pixels; 0 = off). The cells follow (vPos stays the unit box), so a thickened rod keeps its
// one cell across; near enough, every side is its true size again.
const VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uMinPx, uViewH, uGrowAxis;
uniform vec3 uDiv;
// uGrow (a step playing, 09-25 chapter): the slices before uGrow.x are there whole, slice uGrow.x is there up to the
// fraction uGrow.y of its extent along uGrowAxis (0: x, from the left — a column block's words; 1: y, from the top — a
// row block's words), the slices after it are not there yet. A block that is not a stack of slices apart is one slice.
// uGrow.x < 0: every slice up to uGrow.y (all heads at once, word by word).
// The cells stay where they are (vPos is the grown box), so a half-grown block is the finished one's first half.
uniform vec2 uGrow;
attribute vec3 aSlab;   // a slice of a stack with room between slices: (its middle, half its thickness, pitch ÷ thickness) in the unit box; 0 otherwise
varying vec3 vPos; varying vec3 vNrm; varying float vSi;
void main() {
  vec3 p = position;
  float si = aSlab.y > 0. ? floor((.5 - aSlab.x) * uDiv.z + 1e-3) : 0., k = floor(uGrow.x + 1e-4);
  vSi = si;   // (its slice, for uFront)
  if (uGrow.x < -.5) si = k;   // every slice as the current one
  if (si > k || (si == k && uGrow.y <= 0.)) p = vec3(0.);   // not there yet: a point, nothing drawn
  else if (si == k) { if (uGrowAxis < .5) p.x = min(p.x, -.5 + uGrow.y); else p.y = max(p.y, .5 - uGrow.y); }
  vPos = p; vNrm = normal;
  vec3 c = (modelMatrix * vec4(0., 0., 0., 1.)).xyz, s = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
  if (uViewH > 0. && uMinPx > 0.) {
    float dist = max(-(viewMatrix * vec4(c, 1.)).z, 1e-3), ppu = projectionMatrix[1][1] * uViewH * .5 / dist;   // device px per unit
    if (aSlab.y > 0.) p.z = aSlab.x + (p.z - aSlab.x) * clamp(uMinPx / max(2. * aSlab.y * s.z * ppu, 1e-4), 1., aSlab.z);   // a thin slice: thicker, at most filling its gap
    s = max(s, vec3(uMinPx / ppu));
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(c + p * s, 1.0);
  #include <logdepthbuf_vertex>
}`;
const FRAG = `
#include <logdepthbuf_pars_fragment>
uniform vec3 uDiv, uCol, uCut;   // uCut: the axes whose cell edges are lines (the others only carry the shade)
uniform float uNoise, uSeed, uAlt, uAltAxis, uFlat, uHLines, uGapped, uPx, uDim;
uniform vec3 uFine;
uniform vec3 uPage;
// uF0 … uF1 (cells: columns from the left, rows from the top, slices from the front): the part a playing step works on,
// faded uDimIn instead of uDim (09-25 chapter: the rest of a weight fades, the head in use stays; two steps only, A6)
uniform vec3 uF0, uF1;
uniform float uDimIn;
// uFront (09-27 chapter; the user: "为啥不是算出来一个数，而是突然出来一堆蓝色的块"): the numbers grow one by one, as they
// are computed. uFrontAxis 1: the words are columns (a band of x), a word's numbers fill it from the top; 2: the words
// are rows (a band of y from the top), a word's numbers fill it from the left; 0: off. uFront = (the band of the word
// being computed: from, to — fractions of the block; its numbers there so far: a fraction; the slice being computed):
// in that band the slices after it are not there yet, and in it the numbers past the fraction.
// uFrontAxis 3 (09-29, heads one under another, words as columns; the user: "为啥在下面算完又去上面算" — word by word, the
// number followed ran down a word's 64 heads, then jumped back up for the next word): head by head, down. uFront = (the
// head being computed: from, to — down from the top; the word being computed: from, to — from the left); uFrontR: that
// word's numbers there so far, down from the top. The heads above are whole, the ones below not there; in this head,
// the words before whole, the word being computed down to uFrontR, the words after not there.
uniform vec4 uFront;
uniform float uFrontAxis, uFrontR;
// uLines (09-28 trial; the user: the lines on a block "没有对齐，而且不太明显……有没有其他美观的办法"): how the lines
// between words / heads are drawn — 0 now: 1 px, a step darker; 1 bold: 1.6 px, darker, the shade calmed 3 px either side,
// lines too close together kept every 2, 4, 8 … like a ruler's ticks; 2 seam: a 1.5 px gap in the page's colour;
// 3 band (the default, 09-28): now's lines, the words' columns between them one lighter, one darker
uniform float uLines;
// uSeamY: a block cut into heads down y (headsCut): the lines between them a seam in the page's colour, about 2 CSS px
uniform float uSeamY;
varying vec3 vPos; varying vec3 vNrm; varying float vSi;
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
float hash(vec3 i, float lev) {
  uint h = uint(i.x) * 73856093u ^ uint(i.y) * 19349663u ^ uint(i.z) * 83492791u ^ uint(uSeed) * 2654435761u ^ uint(lev) * 3266489917u;
  h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16;
  return float(h) / 4294967296.;
}
float cssPx(float c) { return 1. / max(fwidth(c), 1e-6) / uPx; }   // CSS pixels per unit of c on the screen
// a face's two axes put back into (column, row, slice); k holds the index across the face (0 or the last)
vec3 at(int f, float u, float v, vec3 k) { return f == 0 ? vec3(u, v, k.z) : f == 1 ? vec3(k.x, v, u) : vec3(u, k.y, v); }
// the level of detail along one axis whose cells are p CSS px (q along the face's other axis): cells grouped by 2^level
// into about-square patches of 3–8 px (thin tall cells in random shades read as a barcode)
vec2 lod(float p, float q) { float L = max(0., log2(clamp(.5 * q, 3., 8.) / max(p, 1e-4))); return vec2(floor(L), fract(L)); }
float shadeAt(int f, float u, float v, vec3 k, vec2 lu, vec2 lv) {
  float n = 0.;
  for (int a = 0; a < 2; a++) for (int b = 0; b < 2; b++) {
    float gu = exp2(lu.x + float(a)), gv = exp2(lv.x + float(b)), w = (a == 1 ? lu.y : 1. - lu.y) * (b == 1 ? lv.y : 1. - lv.y);
    if (w > 0.) n += w * hash(at(f, floor(u / gu), floor(v / gv), k), (lu.x + float(a)) * 16. + lv.x + float(b));
  }
  return n;
}
vec3 cell(int f, float u, float v, vec3 k, vec2 lu, vec2 lv, float amp) { return uCol * (1. + (shadeAt(f, u, v, k, lu, lv) - .5) * 2. * amp); }
// the weight of the cell before the nearest boundary (blended over one device pixel); the box's own sides are not boundaries
float before(float c, float n) {
  float k = floor(c + .5);
  if (k < .5) return 0.;
  if (k > n - .5) return 1.;
  return clamp(.5 - (c - k) * cssPx(c) * uPx, 0., 1.);
}
// coverage by an inner cell edge: one CSS pixel wide, faded out where a cell is under a few pixels
float edge(float c, float n) {
  float k = floor(c + .5);
  if (k < .5 || k > n - .5) return 0.;
  float p = cssPx(c);
  return clamp(uPx * .5 + .5 - abs(c - k) * p * uPx, 0., 1.) * smoothstep(4., 10., p);
}
// the same with a width of w CSS px; for a coverage around the line (the calm band), w wide
float edgeW(float c, float n, float w) {
  float k = floor(c + .5);
  if (k < .5 || k > n - .5) return 0.;
  float p = cssPx(c);
  return clamp(uPx * w + .5 - abs(c - k) * p * uPx, 0., 1.) * smoothstep(4., 10., p);
}
// lines every 1, 2, 4, 8 … cells so they stay at least 6 CSS px apart (as a ruler's ticks), w CSS px wide
float rulerW(float c, float n, float w) {
  float p = cssPx(c), s = min(exp2(max(0., ceil(log2(6. / max(p, 1e-4))))), exp2(floor(log2(max(n * .5, 1.)))));
  float c2 = c / s, k = floor(c2 + .5);
  if (k < .5 || k > n / s - .5) return 0.;
  return clamp(uPx * w + .5 - abs(c2 - k) * p * s * uPx, 0., 1.);
}
// the lines between the slices of a stack (heads …) with uHLines: every slice once a slice is 6 CSS px on the screen, else
// every 2, 4, 8 … slices, like a ruler's ticks, so the stack always reads as cut across into layers (09-25 trial)
float stackEdge(float c, float n) {
  if (uGapped > .5) return 0.;   // slices apart: the gaps part them
  if (uHLines < .5) return edge(c, n);
  float p = cssPx(c), s = min(exp2(max(0., ceil(log2(6. / max(p, 1e-4))))), exp2(floor(log2(max(n * .5, 1.)))));
  float c2 = c / s, k = floor(c2 + .5);
  if (k < .5 || k > n / s - .5) return 0.;
  return clamp(uPx * .5 + .5 - abs(c2 - k) * p * s * uPx, 0., 1.);
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 a = vPos + .5;
  if (uFrontAxis > 3.5) {
    // Routed activations: each word's selected experts, then each expert's numbers.
    bool row = uFrontAxis < 4.5;
    float word = min(floor((row ? 1. - a.y : a.x) * (row ? uDiv.y : uDiv.x)), (row ? uDiv.y : uDiv.x) - 1.);
    float pick = min(floor((1. - a.z) * uDiv.z), uDiv.z - 1.);
    float slot = word * uDiv.z + pick, done = uFront.x * uDiv.z + uFront.y;
    if (slot > done + .5 || (abs(slot - done) < .5 && (row ? a.x : 1. - a.y) > uFront.z + 1e-5)) discard;
  } else if (uFrontAxis > 2.5) {
    float down = 1. - a.y;
    if (down > uFront.y + 1e-4) discard;
    if (down > uFront.x - 1e-4 && (a.x > uFront.w + 1e-4 || (a.x > uFront.z + 1e-4 && down > uFrontR + 1e-4))) discard;
  } else if (uFrontAxis > .5) {
    float band = uFrontAxis < 1.5 ? a.x : 1. - a.y, along = uFrontAxis < 1.5 ? 1. - a.y : a.x;
    if (band > uFront.x + 1e-4 && (vSi > uFront.w + .5 || (abs(vSi - uFront.w) < .5 && along > uFront.z + 1e-4))) discard;
  }
  float cx = a.x * uDiv.x, cy = (1. - a.y) * uDiv.y, cz = (1. - a.z) * uDiv.z;   // columns from the left, rows from the top, slices from the front
  bool front = abs(vNrm.z) > .5, side = abs(vNrm.x) > .5;
  int f = front ? 0 : side ? 1 : 2;
  // uFlat: a stack back in depth (heads, experts, streams, picks) keeps one shade along the stack, so the shade varies
  // across a plate, as its numbers do, not from one plate to the next (09-25; the grid lines between slices stay)
  float sz = uFlat > .5 ? .5 : cz;
  float cu = f == 1 ? sz : cx, cv = f == 2 ? sz : cy, nu = f == 1 ? uDiv.z : uDiv.x, nv = f == 2 ? uDiv.z : uDiv.y;
  vec3 k = clamp(floor(vec3(cx, cy, sz)), vec3(0.), uDiv - 1.);
  float pu = cssPx(cu), pv = cssPx(cv), amp = uNoise * smoothstep(.5, 2., max(pu, pv));
  if (uLines > .5 && uLines < 1.5) {   // (bold: the shade calmed 3 px either side of a line, so the line lies on one colour)
    float qx = uDiv.x > 12. ? 0. : rulerW(cx, uDiv.x, 3.) * uCut.x, qy = uDiv.y > 12. ? 0. : rulerW(cy, uDiv.y, 3.) * uCut.y, qz = uDiv.z > 12. ? 0. : rulerW(cz, uDiv.z, 3.) * uCut.z;   // (the bold lines' axes only)
    float q = front ? max(qx, qy) : side ? max(qz, qy) : max(qx, qz);
    amp *= 1. - .75 * q;
  }
  // uFine: the shade in patches finer than a cell along the axes that count numbers (a word stays one column), grouped
  // back into 3–8 px patches when small (09-25 trial: "板上的变化丰富一点")
  float fu = f == 1 ? uFine.z : uFine.x, fv = f == 2 ? uFine.z : uFine.y;
  cu *= fu; cv *= fv; nu *= fu; nv *= fv; pu = cssPx(cu); pv = cssPx(cv);
  vec2 lu = lod(pu, pv), lv = lod(pv, pu);
  float ku = floor(cu + .5), kv = floor(cv + .5), wu = before(cu, nu), wv = before(cv, nv);
  float u0 = clamp(ku - 1., 0., nu - 1.), u1 = clamp(ku, 0., nu - 1.), v0 = clamp(kv - 1., 0., nv - 1.), v1 = clamp(kv, 0., nv - 1.);
  vec3 col = mix(mix(cell(f, u1, v1, k, lu, lv, amp), cell(f, u0, v1, k, lu, lv, amp), wu), mix(cell(f, u1, v0, k, lu, lv, amp), cell(f, u0, v0, k, lu, lv, amp), wu), wv);
  // with uHLines the top of a stack is cut across only: the lines along it (between words …) stay on the first slice
  float ex = edge(cx, uDiv.x) * uCut.x, ey = edge(cy, uDiv.y) * uCut.y, ez = stackEdge(cz, uDiv.z) * uCut.z;
  // (bold: an axis cut in few (the words) gets the bold dark line; one cut in many (64 heads …) a thin light one)
  float lx2 = 0., ly2 = 0.;
  if (uLines > .5 && uLines < 1.5) {
    ex = uDiv.x > 12. ? 0. : rulerW(cx, uDiv.x, .8) * uCut.x; ey = uDiv.y > 12. ? 0. : rulerW(cy, uDiv.y, .8) * uCut.y;
    lx2 = uDiv.x > 12. ? rulerW(cx, uDiv.x, .5) * uCut.x : 0.; ly2 = uDiv.y > 12. ? rulerW(cy, uDiv.y, .5) * uCut.y : 0.;
    if (uGapped < .5 && uHLines < .5) ez = rulerW(cz, uDiv.z, .5) * uCut.z;
  }
  else if (uLines > 1.5 && uLines < 2.5) { ex = edgeW(cx, uDiv.x, .75) * uCut.x; ey = edgeW(cy, uDiv.y, .75) * uCut.y; }
  float lx = uHLines > .5 && cz > 1. ? 0. : ex;
  float l = front ? max(ex, ey) : side ? max(ez, ey) : max(lx, ez);
  col = uLines > 1.5 && uLines < 2.5 ? mix(col, uPage, l) : mix(col, col * (uLines > .5 && uLines < 1.5 ? .6 : .8), l);
  if (uSeamY > .5 && (front || side)) {   // (a seam across the front and the sides, where the heads were cut)
    float ky = floor(cy + .5), py = cssPx(cy);
    if (ky > .5 && ky < uDiv.y - .5) col = mix(col, uPage, clamp(1.5 - abs(cy - ky) * py, 0., 1.) * smoothstep(2.5, 5., py));
  }
  float l2 = front ? max(lx2, ly2) : side ? ly2 : lx2;
  col = mix(col, col * .86, l2 * (1. - l));
  if (uLines > 2.5) {   // (band: the columns between the lines one lighter, one darker — along an axis cut in few, the
    // words; not the 64 heads or the experts, which would read as stripes: 09-25 "相邻片一深一浅交替" was turned down)
    bool fx = uCut.x > .5 && uDiv.x <= 12., fy = uCut.y > .5 && uDiv.y <= 12. && !fx;
    float bx = fx ? mod(floor(cx), 2.) : 0., by = fy ? mod(floor(cy), 2.) : 0.;
    if (fx || fy)
    col *= 1. + (max(bx, by) > .5 ? -.045 : .045);
  }
  // neighbouring heads a step apart in shade while a head is 2–10 px: nearer the lines separate them, farther one tone
  float alt = 1.;
  if (uAlt < 1.) {
    float s = uAltAxis < .5 ? cx : uAltAxis < 1.5 ? cy : cz, n = uAltAxis < .5 ? uDiv.x : uAltAxis < 1.5 ? uDiv.y : uDiv.z;
    float d = (1. - uAlt) * .5, kk = floor(s + .5), w = before(s, n), sp = cssPx(s);
    float here = mod(clamp(kk, 0., n - 1.), 2.) > .5 ? 1. - d : 1. + d, prev = mod(clamp(kk - 1., 0., n - 1.), 2.) > .5 ? 1. - d : 1. + d;
    alt = mix(1., mix(here, prev, w), smoothstep(1., 2.5, sp) * (1. - smoothstep(4., 10., sp)));
  }
  float tint = vNrm.x > .5 || vNrm.x < -.5 ? .86 : vNrm.y > .5 ? .95 : vNrm.y < -.5 ? .8 : vNrm.z > .5 ? 1. : .9;
  vec3 cc = vec3(cx, cy, cz);
  float dm = all(greaterThanEqual(cc, uF0)) && all(lessThanEqual(cc, uF1)) ? uDimIn : uDim;
  gl_FragColor = vec4(mix(toLinear(clamp(col, 0., 1.)) * tint * alt, toLinear(uPage), dm), 1.);   // uDim: faded while another component is picked
  #include <colorspace_fragment>
}`;

// A stack of heads back in depth (a block whose `alt` is z, split by head) can be drawn three ways (09-25 trial; the layout
// and the stack's depth never change):
//   'touch' — one box, the heads touching, a line between them;
//   'gap'   (the default since 09-25) — every head its own slab with room between them (as bbycroft's heads stand apart): the layout's `gap` (in head
//             thicknesses) when it made room, else half a slab and half a gap in the touching stack's depth;
//   'elide' — heads 1, 2, 3 at the front and the last at the back, apart; the rest left out (`elided` says where the gap is).
export const SLAB_MODES = ['touch', 'gap', 'elide'];
const ELIDE_FRONT = 3, ELIDE_STEP = 3;   // elide: the first 3 heads, a head every 3 units back
const STACKS = new Map();
function stackGeometry(H, frac) {
  const key = H + ':' + frac; if (STACKS.has(key)) return STACKS.get(key);
  const pos = [], nrm = [], slab = [], idx = [], box = new THREE.BoxGeometry(1, 1, frac / H), bp = box.attributes.position.array, bn = box.attributes.normal.array, bi = box.index.array;
  for (let i = 0; i < H; i++) {
    const zc = .5 - (i + frac / 2) / H, o = pos.length / 3;
    for (let v = 0; v < bp.length; v += 3) { pos.push(bp[v], bp[v + 1], bp[v + 2] + zc); nrm.push(bn[v], bn[v + 1], bn[v + 2]); slab.push(zc, frac / H / 2, 1 / frac) }
    for (const j of bi) idx.push(o + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aSlab', new THREE.Float32BufferAttribute(slab, 3)); g.setIndex(idx); g.computeBoundingSphere();
  STACKS.set(key, g); return g;
}
function headSlabs(b, mode) {
  const H = b.div[2], p = (b.z1 - b.z0) / H, one = (i, z1, t) => ({ ...b, z0: z1 - t, z1, div: [b.div[0], b.div[1], 1], alt: null, head: i });
  const slabs = Array.from({ length: ELIDE_FRONT }, (_, i) => one(i, b.z1 - i * ELIDE_STEP, p)).concat([one(H - 1, b.z0 + p, p)]);
  return { slabs, gap: { from: b.z1 - (ELIDE_FRONT - 1) * ELIDE_STEP - p, to: b.z0 + p, shown: ELIDE_FRONT + 1, H } };
}

// alt: the 09-24 look of a stack back in depth — every slice its own shade (so the top of a stack reads as stripes, one
// per head) and neighbouring slices a step apart. Off since 09-25 (the user: the shade should vary across a plate as its
// numbers do, as bbycroft's, not from one plate to the next; "所有的都要改"): one shade along the stack. ?alt=1 shows it.
// fine: numbers a shade patch (16 → 16 patches a cell; 0 = a patch a cell); hlines: the stack's lines always shown (09-25 trials)
// which axes of a block count numbers (the others count words, heads or copies, and are never cut finer)
const NUM_AXES = { col: [0, 1], row: [1, 0], wl: [1, 1], wt: [1, 1], rod: [0, 1], bar: [1, 0] };
// fineWords: the word axes cut finer too (only a sketch: a word is one column of numbers); flat: one shade along a stack
// Since 09-25 (the user: "C2 的感觉对了") the default is: a stack's lines across only (hlines), the shade in patches of 16
// numbers along every axis of a plate, words too (fine, fineWords), and in patches along the stack too (flat off) — a
// texture that never lines up with the heads, so it reads as numbers on the plates, not as one shade a plate.
export function makeFlowLook({ px = 2, pal = 'user', minPx = 0, viewH = 0, slabs = 'gap', alt = false, fine = 16, hlines = true, fineWords = true, flat = false, lines = 'band' } = {}) {
  // (uLines: how the lines between words are drawn; 09-28 the user chose band — "4 吧" — from the four in
  // renders/master/lines-cmp/; the others stay as ?lines=now|bold|seam)
  const LINES = { now: 0, bold: 1, seam: 2, band: 3 }[lines] ?? 3;
  // this browser's tuned colours over the published ones; setColor changes a component's colours while the page is open
  const P = loadPalette(pal), uPx = { value: px }, UNIT = new THREE.BoxGeometry(1, 1, 1);
  UNIT.setAttribute('aSlab', new THREE.Float32BufferAttribute(new Float32Array(UNIT.attributes.position.count * 3), 3));
  const uMinPx = { value: minPx * px }, uViewH = { value: viewH * px };   // (both in device pixels; shared by every block)
  const colorOf = b => P[b.comp][b.kind === 'data' ? 0 : 1], meshes = [];
  let seed = 0;
  const byId = new Map();   // a block's id → its mesh
  const fineOf = b => {
    const F = fine > 0 ? 256 / fine : 1, [nx, ny] = NUM_AXES[b.orient] || [0, 0];
    const tok = b.t?.colsUnit === 'token', wo = b.t?.headAxis === 'y';   // words × words; W_o's heads along x
    const W = fineWords ? 2 * F : 1;   // a word is 2 cells wide
    return new THREE.Vector3(nx && !wo ? F : W, ny && !tok ? F : W, 1);
  };
  const elided = [];   // elide: {b, from, to, shown, H} for every head stack drawn with a gap
  function setColor(comp, [res, wt]) {
    P[comp] = [res, wt];
    for (const m of meshes) if (m.userData.block.comp === comp) m.material.uniforms.uCol.value.copy(srgb(colorOf(m.userData.block)));
  }
  // one block (world box: x0..x1, y0..y1, z0..z1) → one mesh; a stack of heads drawn 'gap' or 'elide' → a mesh a head
  function addBlock(scene, b) {
    if (slabs !== 'touch' && b.alt === 'z' && b.t?.deck?.kind === 'head' && b.div[2] > 1) {
      // gap: one mesh of 64 boxes (a mesh a head made the whole model tens of thousands of meshes and stalled it)
      if (slabs === 'gap') return addOne(scene, b, stackGeometry(b.div[2], 1 / (1 + (b.headGap || 1))));
      const { slabs: S, gap } = headSlabs(b, slabs); if (gap) elided.push({ b, ...gap });
      const ms = S.map(c => addOne(scene, c)); return ms[0];
    }
    return addOne(scene, b);
  }
  function addOne(scene, b, geo = UNIT) {
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: {
      uDiv: { value: new THREE.Vector3(...b.div) }, uCut: { value: new THREE.Vector3(...(b.cut || [1, 1, 1])) }, uCol: { value: srgb(colorOf(b)) }, uNoise: { value: b.kind === 'data' ? DNOISE : WNOISE },
      uSeed: { value: ++seed * 7 }, uAlt: { value: alt && b.alt ? (b.alt === 'z' && b.t.deck?.kind === 'head' ? .86 : .9) : 1 }, uAltAxis: { value: { x: 0, y: 1, z: 2 }[b.alt] ?? 2 }, uFlat: { value: flat && !alt && b.alt === 'z' ? 1 : 0 }, uHLines: { value: hlines && b.alt === 'z' ? 1 : 0 }, uGapped: { value: geo === UNIT ? 0 : 1 }, uFine: { value: fineOf(b) }, uPx, uMinPx, uViewH, uDim: { value: 0 }, uGrow: { value: new THREE.Vector2(1e9, 1) }, uGrowAxis: { value: 0 }, uF0: { value: new THREE.Vector3(1e9, 1e9, 1e9) }, uF1: { value: new THREE.Vector3(-1e9, -1e9, -1e9) }, uDimIn: { value: 0 }, uFront: { value: new THREE.Vector4() }, uFrontAxis: { value: 0 }, uFrontR: { value: 0 }, uLines: { value: LINES }, uSeamY: { value: b.t?.headsCut && b.alt === 'y' ? 1 : 0 }, uPage: { value: srgb(PAGE) } } }));
    m.frustumCulled = false;   // (a thickened block is larger than its box)
    m.scale.set(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0); m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    m.userData.block = b; meshes.push(m); byId.set(b.id, m); scene.add(m); return m;
  }
  // an arrow: a flat ribbon along a path of world points [x, y] at depth z, rounded at its corners, with a flat head
  // (as bbycroft's), in the colour of where it comes from, a step toward the page
  function addArrow(scene, pts, { color, w = 2, z = -2.048, head = true, r = 2.4 }) {
    const P2 = pts.map(([x, y]) => new THREE.Vector2(x, y)), path = [P2[0]];
    for (let i = 1; i < P2.length - 1; i++) {   // round each corner with a small arc
      const a = P2[i - 1], c = P2[i], n = P2[i + 1], da = c.clone().sub(a), dn = n.clone().sub(c), rr = Math.min(r, da.length() / 2, dn.length() / 2);
      const p0 = c.clone().sub(da.normalize().multiplyScalar(rr)), p1 = c.clone().add(dn.normalize().multiplyScalar(rr));
      for (let k = 0; k <= 6; k++) { const t = k / 6, q = p0.clone().multiplyScalar((1 - t) * (1 - t)).add(c.clone().multiplyScalar(2 * t * (1 - t))).add(p1.clone().multiplyScalar(t * t)); path.push(q) }
    }
    path.push(P2.at(-1));
    const HL = head ? Math.min(1.6 * w + 1, 0.7 * path.at(-1).distanceTo(path.at(-2))) : 0, HW = w * 1.15;
    // shorten the ribbon by the head's length
    const end = path.at(-1), dirE = end.clone().sub(path.at(-2)).normalize(), baseP = end.clone().sub(dirE.clone().multiplyScalar(HL));
    const body = [...path.slice(0, -1), baseP].filter((p, i, A) => i === 0 || p.distanceTo(A[i - 1]) > 1e-4);
    const pos = [], idx = [];
    body.forEach((p, i) => {
      const d = (i < body.length - 1 ? body[i + 1].clone().sub(p) : p.clone().sub(body[i - 1])).normalize(), nrm = new THREE.Vector2(-d.y, d.x).multiplyScalar(w / 2);
      pos.push(p.x + nrm.x, p.y + nrm.y, z, p.x - nrm.x, p.y - nrm.y, z);
      if (i) { const o = (i - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2) }
    });
    if (head) {
      const o = pos.length / 3, nH = new THREE.Vector2(-dirE.y, dirE.x).multiplyScalar(HW);
      pos.push(baseP.x + nH.x, baseP.y + nH.y, z, baseP.x - nH.x, baseP.y - nH.y, z, end.x, end.y, z); idx.push(o, o + 1, o + 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    scene.add(m); return m;
  }
  // fade every block but one component's toward the page (null: none faded)
  function setDim(comp, amt = .78) { for (const m of meshes) m.material.uniforms.uDim.value = comp && m.userData.block.comp !== comp ? amt : 0 }
  // a playing step (09-25 chapter): grow(id, k, f, axis) — k slices whole, slice k up to f (null: all there);
  // focus(id, [c0, c1] | null, dimIn) — the cells c0 … c1 (inclusive, in cells) fade dimIn, the rest of the block its uDim
  const U = id => byId.get(id)?.material.uniforms;
  function grow(id, k = null, f = 1, axis = 0) { const u = U(id); if (!u) return; if (k === null) u.uGrow.value.set(1e9, 1); else u.uGrow.value.set(k, f); u.uGrowAxis.value = axis; u.uFrontAxis.value = 0 }
  // front(id, axis, from, to, f, slice) — the word in the band from … to has its numbers up to f (in slice; see uFront); after a grow
  function front(id, axis, from, to, f, slice) { const u = U(id); if (!u) return; u.uFront.value.set(from, to, f, slice); u.uFrontAxis.value = axis }
  // downHeads(id, h0, h1, w0, w1, r) — uFrontAxis 3: head by head down (see uFront)
  function downHeads(id, h0, h1, w0, w1, r) { const u = U(id); if (!u) return; u.uGrow.value.set(1e9, 1); u.uFront.value.set(h0, h1, w0, w1); u.uFrontR.value = r; u.uFrontAxis.value = 3 }
  function focus(id, box = null, dimIn = 0) { const u = U(id); if (!u) return; if (!box) { u.uF0.value.set(1e9, 1e9, 1e9); u.uF1.value.set(-1e9, -1e9, -1e9) } else { u.uF0.value.set(...box[0]); u.uF1.value.set(...box[1]) } u.uDimIn.value = dimIn }
  function dimOne(id, v) { const u = U(id); if (u) u.uDim.value = v }
  return { addBlock, addArrow, colorOf, setColor, setDim, meshes, byId, grow, front, downHeads, focus, dimOne, palette: P, elided };
}
