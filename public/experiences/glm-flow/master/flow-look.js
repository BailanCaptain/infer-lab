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
import { ACCENTS, PAGE, PALETTES, loadPalette } from './flow-colors.js';
export { ACCENTS, PAGE, PALETTES };   // the colours live in flow-colors.js (one source for the 3D layers and the 2D diagrams)

const WNOISE = .16, DNOISE = .10, PWNOISE = .054, PDNOISE = .042;
const srgb = hex => new THREE.Vector3(...[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255));   // kept in sRGB: the shader converts

// a side thinner on the screen than uMinPx device pixels is drawn that thick, about the block's middle (uViewH: the
// drawing's height in device pixels; 0 = off). The cells follow (vPos stays the unit box), so a thickened rod keeps its
// one cell across; near enough, every side is its true size again.
const VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uMinPx, uViewH, uPx, uGrowAxis, uPrism;
uniform vec3 uDiv;
// uGrow (a step playing, 09-25 chapter): the slices before uGrow.x are there whole, slice uGrow.x is there up to the
// fraction uGrow.y of its extent along uGrowAxis (0: x, from the left — a column block's words; 1: y, from the top — a
// row block's words), the slices after it are not there yet. A block that is not a stack of slices apart is one slice.
// uGrow.x < 0: every slice up to uGrow.y (all heads at once, word by word).
// In prism mode, uncomputed slices/cells stay in place as architectural blueprint receiving slots instead of vanishing.
uniform vec2 uGrow;
attribute vec3 aSlab;   // a slice of a stack with room between slices: (its middle, half its thickness, pitch ÷ thickness) in the unit box; 0 otherwise
varying vec3 vPos; varying vec3 vNrm; varying float vSi; varying float vZ01;
void main() {
  vec3 p = position;
  float si = aSlab.y > 0. ? floor((.5 - aSlab.x) * uDiv.z + 1e-3) : 0., k = floor(uGrow.x + 1e-4);
  vSi = si;   // (its slice, for uFront)
  if (uPrism < .5) {
    if (uGrow.x < -.5) si = k;   // every slice as the current one
    if (si > k || (si == k && uGrow.y <= 0.)) p = vec3(0.);   // not there yet: a point, nothing drawn
    else if (si == k) { if (uGrowAxis < .5) p.x = min(p.x, -.5 + uGrow.y); else p.y = max(p.y, .5 - uGrow.y); }
  }
  vPos = p; vNrm = normal;
  vZ01 = aSlab.y > 0. ? clamp((p.z - aSlab.x) / max(2. * aSlab.y, 1e-5) + .5, 0., 1.) : p.z + .5;
  vec3 c = (modelMatrix * vec4(0., 0., 0., 1.)).xyz, s = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
  if (uViewH > 0. && uMinPx > 0.) {
    float dist = max(-(viewMatrix * vec4(c, 1.)).z, 1e-3), ppu = projectionMatrix[1][1] * uViewH * .5 / dist;   // device px per unit
    float spanCss = max(s.x, s.y) * ppu / max(uPx, 1.);
    float effMinPx = uMinPx * mix(1., 2.85, smoothstep(52., 175., spanCss));
    if (aSlab.y > 0.) p.z = aSlab.x + (p.z - aSlab.x) * clamp(uMinPx / max(2. * aSlab.y * s.z * ppu, 1e-4), 1., max(1., aSlab.z * .82));   // a thin slice: thicker, leaving a clean gap between slabs
    vec3 sNew = max(s, vec3(effMinPx / ppu));
    if (aSlab.y <= 0.) c.z -= (sNew.z - s.z) * .5;
    s = sNew;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(c + p * s, 1.0);
  #include <logdepthbuf_vertex>
}`;
const FRAG_HEADER = `
#include <logdepthbuf_pars_fragment>
uniform vec3 uDiv, uCol, uCut;   // uCut: the axes whose cell edges are lines (the others only carry the shade)
uniform float uNoise, uSeed, uAlt, uAltAxis, uFlat, uHLines, uGapped, uPx, uDim, uPrism, uGrowAxis, uRecv;
uniform vec2 uGrow;
uniform vec3 uFine;
uniform vec3 uPage;
uniform vec3 uAccent;
// uF0 … uF1 (cells: columns from the left, rows from the top, slices from the front): the part a playing step works on,
// faded uDimIn instead of uDim (09-25 chapter: the rest of a weight fades, the head in use stays; two steps only, A6)
uniform vec3 uF0, uF1;
uniform float uDimIn;
// uFront (09-27 chapter): the numbers grow one by one as they are computed.
uniform vec4 uFront;
uniform float uFrontAxis, uFrontR;
uniform float uLines;
uniform float uSeamY;
varying vec3 vPos; varying vec3 vNrm; varying float vSi; varying float vZ01;`;

const VERT_INST = `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uMinPx, uViewH, uPx, uPrism, uInvTexH;
uniform sampler2D uStaticTex, uDynTex;
attribute vec3 aSlab;
attribute float aBlockIdx;
varying vec4 vPosSi, vNrmZ, vDivSeed, vCutNoise, vColFlat, vAccSeam, vFineHL, vAltGAR, vGrowF2, vFrontV, vF0Dim, vF1DimIn;
void main() {
  float bi = floor(aBlockIdx + .5);
  float row = floor(bi / 64.);
  float col8 = (bi - row * 64.) * 8.;
  float invW = 1. / 512.;
  float uvY = (row + .5) * uInvTexH;
  vec4 dy3 = texture2D(uDynTex, vec2((col8 + 3.5) * invW, uvY));
  if (dy3.w < .5) {
    vPosSi = vNrmZ = vDivSeed = vCutNoise = vColFlat = vAccSeam = vFineHL = vAltGAR = vGrowF2 = vFrontV = vF0Dim = vF1DimIn = vec4(0.);
    gl_Position = vec4(2., 2., 2., 1.);
    return;
  }
  vec4 st0 = texture2D(uStaticTex, vec2((col8 + .5) * invW, uvY));
  vec4 st1 = texture2D(uStaticTex, vec2((col8 + 1.5) * invW, uvY));
  vec4 st2 = texture2D(uStaticTex, vec2((col8 + 2.5) * invW, uvY));
  vec4 st3 = texture2D(uStaticTex, vec2((col8 + 3.5) * invW, uvY));
  vec4 st4 = texture2D(uStaticTex, vec2((col8 + 4.5) * invW, uvY));
  vec4 st5 = texture2D(uStaticTex, vec2((col8 + 5.5) * invW, uvY));
  vec4 st6 = texture2D(uStaticTex, vec2((col8 + 6.5) * invW, uvY));
  vec4 dy0 = texture2D(uDynTex, vec2((col8 + .5) * invW, uvY));
  vec4 dy1 = texture2D(uDynTex, vec2((col8 + 1.5) * invW, uvY));
  vec4 dy2 = texture2D(uDynTex, vec2((col8 + 2.5) * invW, uvY));
  vec4 dy4 = texture2D(uDynTex, vec2((col8 + 4.5) * invW, uvY));
  vec3 bDiv = st0.xyz;
  vec2 bGrow = dy0.xy;
  float bGrowAxis = dy0.z;
  vec3 p = position;
  float si = aSlab.y > 0. ? floor((.5 - aSlab.x) * bDiv.z + 1e-3) : 0., k = floor(bGrow.x + 1e-4);
  if (uPrism < .5) {
    if (bGrow.x < -.5) si = k;
    if (si > k || (si == k && bGrow.y <= 0.)) p = vec3(0.);
    else if (si == k) { if (bGrowAxis < .5) p.x = min(p.x, -.5 + bGrow.y); else p.y = max(p.y, .5 - bGrow.y); }
  }
  float z01 = aSlab.y > 0. ? clamp((p.z - aSlab.x) / max(2. * aSlab.y, 1e-5) + .5, 0., 1.) : p.z + .5;
  vPosSi = vec4(p, si);
  vNrmZ = vec4(normal, z01);
  vDivSeed = st0;
  vCutNoise = st1;
  vColFlat = st2;
  vAccSeam = st3;
  vFineHL = st4;
  vAltGAR = vec4(st5.w, st6.w, bGrowAxis, dy0.w);
  vGrowF2 = vec4(bGrow, dy2.x, dy2.y);
  vFrontV = dy1;
  vF0Dim = vec4(dy3.xyz, dy2.z);
  vF1DimIn = vec4(dy4.xyz, dy2.w);
  vec3 c = st5.xyz, s = st6.xyz;
  if (uViewH > 0. && uMinPx > 0.) {
    float dist = max(-(viewMatrix * vec4(c, 1.)).z, 1e-3), ppu = projectionMatrix[1][1] * uViewH * .5 / dist;
    float spanCss = max(s.x, s.y) * ppu / max(uPx, 1.);
    float effMinPx = uMinPx * mix(1., 2.85, smoothstep(52., 175., spanCss));
    if (aSlab.y > 0.) p.z = aSlab.x + (p.z - aSlab.x) * clamp(uMinPx / max(2. * aSlab.y * s.z * ppu, 1e-4), 1., max(1., aSlab.z * .82));
    vec3 sNew = max(s, vec3(effMinPx / ppu));
    if (aSlab.y <= 0.) c.z -= (sNew.z - s.z) * .5;
    s = sNew;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(c + p * s, 1.0);
  #include <logdepthbuf_vertex>
}`;

const FRAG_INST_HEADER = `
#include <logdepthbuf_pars_fragment>
uniform float uGapped, uPx, uPrism, uLines;
uniform vec3 uPage;
varying vec4 vPosSi, vNrmZ, vDivSeed, vCutNoise, vColFlat, vAccSeam, vFineHL, vAltGAR, vGrowF2, vFrontV, vF0Dim, vF1DimIn;
#define vPos (vPosSi.xyz)
#define vSi (vPosSi.w)
#define vNrm (vNrmZ.xyz)
#define vZ01 (vNrmZ.w)
#define uDiv (vDivSeed.xyz)
#define uSeed (vDivSeed.w)
#define uCut (vCutNoise.xyz)
#define uNoise (vCutNoise.w)
#define uCol (vColFlat.xyz)
#define uFlat (vColFlat.w)
#define uAccent (vAccSeam.xyz)
#define uSeamY (vAccSeam.w)
#define uFine (vFineHL.xyz)
#define uHLines (vFineHL.w)
#define uAlt (vAltGAR.x)
#define uAltAxis (vAltGAR.y)
#define uGrowAxis (vAltGAR.z)
#define uRecv (vAltGAR.w)
#define uGrow (vGrowF2.xy)
#define uFrontAxis (vGrowF2.z)
#define uFrontR (vGrowF2.w)
#define uFront (vFrontV)
#define uF0 (vF0Dim.xyz)
#define uDim (vF0Dim.w)
#define uF1 (vF1DimIn.xyz)
#define uDimIn (vF1DimIn.w)`;

const FRAG_CORE = `
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
float hash(vec3 i, float lev) {
  uint h = uint(i.x) * 73856093u ^ uint(i.y) * 19349663u ^ uint(i.z) * 83492791u ^ uint(uSeed) * 2654435761u ^ uint(lev) * 3266489917u;
  h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16;
  return float(h) / 4294967296.;
}
float aaLeFw(float v, float lim, float fw) { return clamp(.5 + (lim - v) / max(fw * 1.28, 1e-6), 0., 1.); }
vec3 at(int f, float u, float v, vec3 k) { return f == 0 ? vec3(u, v, k.z) : f == 1 ? vec3(k.x, v, u) : vec3(u, k.y, v); }
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
float beforeP(float c, float n, float p) {
  float k = floor(c + .5);
  if (k < .5) return 0.;
  if (k > n - .5) return 1.;
  return clamp(.5 - (c - k) * p * uPx / 1.28, 0., 1.);
}
float edgeP(float c, float n, float p) {
  float k = floor(c + .5);
  if (k < .5 || k > n - .5) return 0.;
  return clamp((uPx * .5 + .64 - abs(c - k) * p * uPx) / 1.28, 0., 1.) * smoothstep(3.4, 9., p);
}
float edgeWP(float c, float n, float w, float p) {
  float k = floor(c + .5);
  if (k < .5 || k > n - .5) return 0.;
  return clamp((uPx * w + .64 - abs(c - k) * p * uPx) / 1.28, 0., 1.) * smoothstep(3.4, 9., p);
}
float rulerWP(float c, float n, float w, float p) {
  float s = min(exp2(max(0., ceil(log2(6. / max(p, 1e-4))))), exp2(floor(log2(max(n * .5, 1.)))));
  float c2 = c / s, k = floor(c2 + .5);
  if (k < .5 || k > n / s - .5) return 0.;
  return clamp((uPx * w + .64 - abs(c2 - k) * p * s * uPx) / 1.28, 0., 1.);
}
float stackEdgeP(float c, float n, float p) {
  if (uGapped > .5) return 0.;
  if (uHLines < .5) return edgeP(c, n, p);
  float s = min(exp2(max(0., ceil(log2(6. / max(p, 1e-4))))), exp2(floor(log2(max(n * .5, 1.)))));
  float c2 = c / s, k = floor(c2 + .5);
  if (k < .5 || k > n / s - .5) return 0.;
  return clamp((uPx * .5 + .64 - abs(c2 - k) * p * s * uPx) / 1.28, 0., 1.);
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 a = vPos + .5;
  vec3 fwA = max(fwidth(a), vec3(1e-6));
  float fwZ01 = max(fwidth(vZ01), 1e-6);
  float pxA_x = 1. / (fwA.x * uPx), pxA_y = 1. / (fwA.y * uPx), pxA_z = 1. / (fwA.z * uPx), pxZ01 = 1. / (fwZ01 * uPx);
  float pxX = pxA_x / max(uDiv.x, 1e-4), pxY = pxA_y / max(uDiv.y, 1e-4), pxZ = pxA_z / max(uDiv.z, 1e-4);

  float compMask = 1., compPad = 1., frontier = 0.;
  float gk = floor(uGrow.x + 1e-4);
  if (uPrism > .5 && gk < 1e8) {
    float gsi = uGrow.x < -.5 ? gk : vSi;
    float gAlong = uGrowAxis < .5 ? a.x : 1. - a.y, fwG = uGrowAxis < .5 ? fwA.x : fwA.y, pxG = uGrowAxis < .5 ? pxA_x : pxA_y;
    if (gsi > gk + .5) { compMask = 0.; compPad = 0.; }
    else if (abs(gsi - gk) < .5) {
      if (uGrow.y <= 1e-5) { compMask = 0.; compPad = 0.; }
      else if (uGrow.y < .9999) {
        compMask = aaLeFw(gAlong, uGrow.y, fwG);
        compPad = aaLeFw(gAlong, uGrow.y + 1.45 * fwG, fwG);
        if (uFrontAxis < .5) frontier = max(frontier, (1. - smoothstep(.35, 1.85, abs(uGrow.y - gAlong) * pxG)) * compMask);
      }
    }
  }
  if (compPad > .001 && uFrontAxis > .5) {
    if (uFrontAxis > 3.5) {
      bool row = uFrontAxis < 4.5;
      float nW = row ? uDiv.y : uDiv.x;
      float wAlong = (row ? 1. - a.y : a.x) * nW, fwW = (row ? fwA.y : fwA.x) * nW;
      float chAlong = row ? a.x : 1. - a.y, fwCh = row ? fwA.x : fwA.y, pxCh = row ? pxA_x : pxA_y;
      float zIdx = uGapped > .5 ? vSi : (1. - a.z) * uDiv.z, fwZI = uGapped > .5 ? 1e-5 : fwA.z * uDiv.z;
      float mPrevW = uFront.x > .5 ? aaLeFw(wAlong, uFront.x, fwW) : 0.;
      float mPrevWPad = uFront.x > .5 ? aaLeFw(wAlong, uFront.x + 1.45 * fwW, fwW) : 0.;
      float mPrevS = uFront.y > .5 ? (uGapped > .5 ? (vSi < uFront.y - .5 ? 1. : 0.) : aaLeFw(zIdx, uFront.y, fwZI)) : 0.;
      float mCh = uFront.z <= 1e-5 ? 0. : uFront.z >= .9999 ? 1. : aaLeFw(chAlong, uFront.z, fwCh);
      float mChPad = uFront.z <= 1e-5 ? 0. : uFront.z >= .9999 ? 1. : aaLeFw(chAlong, uFront.z + 1.45 * fwCh, fwCh);
      float inS = uGapped > .5 ? (vSi > uFront.y + .5 ? 0. : 1.) : aaLeFw(zIdx, uFront.y + 1., fwZI);
      float sliceCond = mix(mCh, 1., mPrevS) * inS;
      float sliceCondPad = mix(mChPad, 1., mPrevS) * inS;
      compMask = min(compMask, mix(sliceCond, 1., mPrevW) * aaLeFw(wAlong, uFront.x + 1., fwW));
      compPad = min(compPad, mix(sliceCondPad, 1., mPrevWPad) * aaLeFw(wAlong, uFront.x + 1. + 1.45 * fwW, fwW));
      if (uFront.z > 1e-4 && uFront.z < .999 && abs(floor(wAlong) - uFront.x) < .6 && abs(floor(zIdx) - uFront.y) < .6) {
        frontier = max(frontier, (1. - smoothstep(.35, 1.85, abs(uFront.z - chAlong) * pxCh)) * compMask);
      }
    } else if (uFrontAxis > 2.5) {
      float down = 1. - a.y;
      float mPrevH = uFront.x > 1e-5 ? aaLeFw(down, uFront.x, fwA.y) : 0.;
      float mPrevW = uFront.z > 1e-5 ? aaLeFw(a.x, uFront.z, fwA.x) : 0.;
      float mR = uFrontR <= 1e-5 ? 0. : aaLeFw(down, uFrontR, fwA.y);
      float mRPad = uFrontR <= 1e-5 ? 0. : aaLeFw(down, uFrontR + 1.45 * fwA.y, fwA.y);
      float inHead = mix(mR, 1., mPrevW) * aaLeFw(a.x, uFront.w, fwA.x);
      float inHeadPad = mix(mRPad, 1., mPrevW) * aaLeFw(a.x, uFront.w + 1.45 * fwA.x, fwA.x);
      compMask = min(compMask, mix(inHead, 1., mPrevH) * aaLeFw(down, uFront.y, fwA.y));
      compPad = min(compPad, mix(inHeadPad, 1., mPrevH) * aaLeFw(down, uFront.y + 1.45 * fwA.y, fwA.y));
      if (a.x > uFront.z - fwA.x && a.x < uFront.w + fwA.x && uFrontR < uFront.y - 1e-4) {
        frontier = max(frontier, (1. - smoothstep(.35, 1.85, abs(uFrontR - down) * pxA_y)) * compMask);
      }
    } else {
      float band = uFrontAxis < 1.5 ? a.x : 1. - a.y, fwBand = uFrontAxis < 1.5 ? fwA.x : fwA.y;
      float along = uFrontAxis < 1.5 ? 1. - a.y : a.x, fwAlong = uFrontAxis < 1.5 ? fwA.y : fwA.x, pxAlong = uFrontAxis < 1.5 ? pxA_y : pxA_x;
      float mPrevB = uFront.x > 1e-5 ? aaLeFw(band, uFront.x, fwBand) : 0.;
      float mPrevBPad = uFront.x > 1e-5 ? aaLeFw(band, uFront.x + 1.45 * fwBand, fwBand) : 0.;
      float mAlong = uFront.z <= 1e-5 ? 0. : uFront.z >= .9999 ? 1. : aaLeFw(along, uFront.z, fwAlong);
      float mAlongPad = uFront.z <= 1e-5 ? 0. : uFront.z >= .9999 ? 1. : aaLeFw(along, uFront.z + 1.45 * fwAlong, fwAlong);
      float curB = vSi < uFront.w - .5 ? 1. : vSi > uFront.w + .5 ? 0. : mAlong;
      float curBPad = vSi < uFront.w - .5 ? 1. : vSi > uFront.w + .5 ? 0. : mAlongPad;
      compMask = min(compMask, mix(curB, 1., mPrevB));
      compPad = min(compPad, mix(curBPad, 1., mPrevBPad));
      if (abs(vSi - uFront.w) < .5 && uFront.z > 1e-4 && uFront.z < .999 && band > uFront.x - fwBand) {
        frontier = max(frontier, (1. - smoothstep(.35, 1.85, abs(uFront.z - along) * pxAlong)) * compMask);
      }
    }
  }
  if (uPrism < .5 && compMask < .5) discard;

  float cx = a.x * uDiv.x, cy = (1. - a.y) * uDiv.y, cz = (1. - a.z) * uDiv.z;
  bool front = abs(vNrm.z) > .5, side = abs(vNrm.x) > .5;
  int f = front ? 0 : side ? 1 : 2;
  float fu01 = f == 1 ? vZ01 : a.x, fv01 = f == 2 ? vZ01 : a.y;
  float suPx = f == 1 ? pxZ01 : pxA_x, svPx = f == 2 ? pxZ01 : pxA_y, minSpan = min(suPx, svPx);
  float showRim = smoothstep(3., 7.5, minSpan);
  float duRim = min(fu01, 1. - fu01) * suPx, dvRim = min(fv01, 1. - fv01) * svPx;

  bool hasFocus = uF0.x <= uF1.x;
  float sdFocus = -1e4, focusMask = 0.;
  if (hasFocus) {
    vec3 f0c = clamp(uF0, vec3(0.), uDiv), f1c = clamp(uF1, vec3(0.), uDiv);
    float czN = uGapped > .5 ? vSi + .5 : clamp(cz, 1e-3, max(uDiv.z - 1e-3, 1e-3));
    float cxN = vNrm.x < 0. ? 1e-3 : max(uDiv.x - 1e-3, 1e-3);
    float cyN = vNrm.y > 0. ? 1e-3 : max(uDiv.y - 1e-3, 1e-3);
    bool nrmOk = f == 0 ? (czN >= f0c.z - .02 && czN <= f1c.z + .02) : f == 1 ? (cxN >= f0c.x - .02 && cxN <= f1c.x + .02) : (cyN >= f0c.y - .02 && cyN <= f1c.y + .02);
    if (nrmOk) {
      float sdX = min(cx - f0c.x, f1c.x - cx) * pxX;
      float sdY = min(cy - f0c.y, f1c.y - cy) * pxY;
      float sdZ = uGapped > .5 ? ((vSi + .5 >= f0c.z - .02 && vSi + .5 <= f1c.z + .02) ? min(vZ01, 1. - vZ01) * pxZ01 : -1e4) : min(cz - f0c.z, f1c.z - cz) * pxZ;
      float sdU = f == 1 ? sdZ : sdX, sdV = f == 2 ? sdZ : sdY;
      sdFocus = min(sdU, sdV) > 0. ? min(sdU, sdV) : -length(max(vec2(-sdU, -sdV), 0.));
      focusMask = clamp(.5 + sdFocus * uPx / 1.28, 0., 1.);
    }
  }

  vec3 slotCol = vec3(1.);
  if (uPrism > .5 && compMask < .999) {
    float faceTint = side ? .965 : vNrm.y > .5 ? 1.012 : 1.;
    slotCol = mix(uCol * faceTint, uPage, uRecv > .5 ? .845 : .905);
    if (uRecv > .5) {
      float ex0 = uDiv.x <= 12. ? edgeP(cx, uDiv.x, pxX) * uCut.x : 0.;
      float ey0 = uDiv.y <= 12. ? edgeP(cy, uDiv.y, pxY) * uCut.y : 0.;
      float ez0 = stackEdgeP(cz, uDiv.z, pxZ) * uCut.z;
      float slotGrid = front ? max(ex0, ey0) : side ? max(ez0, ey0) : max(uHLines > .5 && cz > 1. ? 0. : ex0, ez0);
      slotCol = mix(slotCol, uAccent, slotGrid * .18);
    }
    if (showRim > .001) {
      float rim = (1. - smoothstep(.28, 1.32, min(duRim, dvRim))) * showRim;
      slotCol = mix(slotCol, uAccent, rim * (uRecv > .5 ? .38 : .14));
    }
    if (compPad <= .001 && (!hasFocus || sdFocus < -1.8)) {
      gl_FragColor = vec4(toLinear(clamp(slotCol, 0., 1.)), 1.);
      #include <colorspace_fragment>
      return;
    }
  }

  float sz = uFlat > .5 ? .5 : cz;
  float cu = f == 1 ? sz : cx, cv = f == 2 ? sz : cy, nu = f == 1 ? uDiv.z : uDiv.x, nv = f == 2 ? uDiv.z : uDiv.y;
  float pu = f == 1 ? (uFlat > .5 ? 1e5 : pxZ) : pxX, pv = f == 2 ? (uFlat > .5 ? 1e5 : pxZ) : pxY;
  vec3 k = clamp(floor(vec3(cx, cy, sz)), vec3(0.), uDiv - 1.);
  float amp = uNoise * smoothstep(.5, 2., max(pu, pv));
  if (uPrism > .5) amp *= max(0., 1. - uDim * 1.25);
  if (amp > .0015 && uLines > .5 && uLines < 1.5) {
    float qx = f == 1 || uDiv.x > 12. ? 0. : rulerWP(cx, uDiv.x, 3., pxX) * uCut.x;
    float qy = f == 2 || uDiv.y > 12. ? 0. : rulerWP(cy, uDiv.y, 3., pxY) * uCut.y;
    float qz = f == 0 || uDiv.z > 12. ? 0. : rulerWP(cz, uDiv.z, 3., pxZ) * uCut.z;
    float q = front ? max(qx, qy) : side ? max(qz, qy) : max(qx, qz);
    amp *= 1. - .75 * q;
  }
  vec3 col = uCol;
  if (amp > .0015) {
    float fu = f == 1 ? uFine.z : uFine.x, fv = f == 2 ? uFine.z : uFine.y;
    cu *= fu; cv *= fv; nu *= fu; nv *= fv;
    float puf = pu / max(fu, 1e-4), pvf = pv / max(fv, 1e-4);
    vec2 lu = lod(puf, pvf), lv = lod(pvf, puf);
    float ku = floor(cu + .5), kv = floor(cv + .5), wu = beforeP(cu, nu, puf), wv = beforeP(cv, nv, pvf);
    float u0 = clamp(ku - 1., 0., nu - 1.), u1 = clamp(ku, 0., nu - 1.), v0 = clamp(kv - 1., 0., nv - 1.), v1 = clamp(kv, 0., nv - 1.);
    vec3 c11 = cell(f, u1, v1, k, lu, lv, amp);
    if (wu > .002) c11 = mix(c11, cell(f, u0, v1, k, lu, lv, amp), wu);
    if (wv > .002) {
      vec3 c10 = cell(f, u1, v0, k, lu, lv, amp);
      if (wu > .002) c10 = mix(c10, cell(f, u0, v0, k, lu, lv, amp), wu);
      c11 = mix(c11, c10, wv);
    }
    col = c11;
  }
  float ex = 0., ey = 0., ez = 0., lx2 = 0., ly2 = 0.;
  if (uLines > .5 && uLines < 1.5) {
    if (f != 1) { ex = uDiv.x > 12. ? 0. : rulerWP(cx, uDiv.x, .8, pxX) * uCut.x; lx2 = uDiv.x > 12. ? rulerWP(cx, uDiv.x, .5, pxX) * uCut.x : 0.; }
    if (f != 2) { ey = uDiv.y > 12. ? 0. : rulerWP(cy, uDiv.y, .8, pxY) * uCut.y; ly2 = uDiv.y > 12. ? rulerWP(cy, uDiv.y, .5, pxY) * uCut.y : 0.; }
    if (f != 0) ez = (uGapped < .5 && uHLines < .5 ? rulerWP(cz, uDiv.z, .5, pxZ) : stackEdgeP(cz, uDiv.z, pxZ)) * uCut.z;
  } else if (uLines > 1.5 && uLines < 2.5) {
    if (f != 1) ex = edgeWP(cx, uDiv.x, .75, pxX) * uCut.x;
    if (f != 2) ey = edgeWP(cy, uDiv.y, .75, pxY) * uCut.y;
    if (f != 0) ez = stackEdgeP(cz, uDiv.z, pxZ) * uCut.z;
  } else {
    if (f != 1) ex = edgeP(cx, uDiv.x, pxX) * uCut.x;
    if (f != 2) ey = edgeP(cy, uDiv.y, pxY) * uCut.y;
    if (f != 0) ez = stackEdgeP(cz, uDiv.z, pxZ) * uCut.z;
  }
  float lx = uHLines > .5 && cz > 1. ? 0. : ex;
  float l = front ? max(ex, ey) : side ? max(ez, ey) : max(lx, ez);
  vec3 lineTone = uPrism > .5 ? mix(col * (uLines > .5 && uLines < 1.5 ? .66 : .83), uAccent, .18) : col * (uLines > .5 && uLines < 1.5 ? .6 : .8);
  col = uLines > 1.5 && uLines < 2.5 ? mix(col, uPage, l) : mix(col, lineTone, l);
  if (uSeamY > .5 && (front || side)) {
    float ky = floor(cy + .5);
    if (ky > .5 && ky < uDiv.y - .5) col = mix(col, uPage, clamp(1.5 - abs(cy - ky) * pxY, 0., 1.) * smoothstep(2.5, 5., pxY));
  }
  float l2 = front ? max(lx2, ly2) : side ? ly2 : lx2;
  col = mix(col, uPrism > .5 ? mix(col * .87, uAccent, .13) : col * .86, l2 * (1. - l));
  if (uLines > 2.5) {
    bool fx = uCut.x > .5 && uDiv.x <= 12., fy = uCut.y > .5 && uDiv.y <= 12. && !fx;
    if (fx || fy) {
      float sB = fx ? cx : cy, nB = fx ? uDiv.x : uDiv.y, pB = fx ? pxX : pxY;
      float kkB = floor(sB + .5), wB = beforeP(sB, nB, pB);
      float hB = mod(clamp(kkB, 0., nB - 1.), 2.) > .5 ? -.034 : .034;
      float prB = mod(clamp(kkB - 1., 0., nB - 1.), 2.) > .5 ? -.034 : .034;
      col *= 1. + mix(hB, prB, wB) * smoothstep(2., 5., pB);
    }
  }
  float alt = 1.;
  if (uAlt < 1.) {
    float s = uAltAxis < .5 ? cx : uAltAxis < 1.5 ? cy : cz, n = uAltAxis < .5 ? uDiv.x : uAltAxis < 1.5 ? uDiv.y : uDiv.z;
    float sp = uAltAxis < .5 ? pxX : uAltAxis < 1.5 ? pxY : pxZ;
    float d = (1. - uAlt) * .5, kk = floor(s + .5), w = beforeP(s, n, sp);
    float here = mod(clamp(kk, 0., n - 1.), 2.) > .5 ? 1. - d : 1. + d, prev = mod(clamp(kk - 1., 0., n - 1.), 2.) > .5 ? 1. - d : 1. + d;
    alt = mix(1., mix(here, prev, w), smoothstep(1., 2.5, sp) * (1. - smoothstep(4., 10., sp)));
  }
  float tint = uPrism > .5
    ? (abs(vNrm.x) > .5 ? (.85 - .055 * (1. - a.z)) : vNrm.y > .5 ? (1.035 - .028 * (1. - a.z)) : vNrm.y < -.5 ? .78 : vNrm.z > .5 ? (1.012 - .026 * (1. - a.y)) : .88)
    : (vNrm.x > .5 || vNrm.x < -.5 ? .86 : vNrm.y > .5 ? .95 : vNrm.y < -.5 ? .8 : vNrm.z > .5 ? 1. : .9);
  float dm = hasFocus ? mix(uDim, uDimIn, focusMask) : uDim;
  if (uPrism > .5) {
    if (showRim > .001) {
      float bev = (1. - smoothstep(.8, 2.4, min(fu01 * suPx, (1. - fv01) * svPx))) * showRim;
      col = mix(col, min(col * 1.055 + .02, vec3(1.)), bev * .48);
      float rim = (1. - smoothstep(.28, 1.32, min(duRim, dvRim))) * showRim;
      vec3 rimCol = mix(col * .70, uAccent, .32);
      col = mix(col, rimCol, rim * .70);
    }
    if (hasFocus && uDim > .05) {
      col = mix(col, min(col * 1.03 + .008, vec3(1.)), focusMask * .85);
    }
    if (frontier > .01) {
      col = mix(col, mix(uAccent, vec3(1.), .18), frontier * .78);
    }
  }
  vec3 outLin = mix(toLinear(clamp(col, 0., 1.)) * tint * alt, toLinear(uPage), dm);
  if (uPrism > .5 && compMask < .999) {
    outLin = mix(toLinear(clamp(slotCol, 0., 1.)), outLin, compMask);
  }
  if (uPrism > .5 && hasFocus && uDim > .05 && sdFocus > -1.8 && compPad > .001) {
    float fBand = smoothstep(-1.15 / uPx, .25 / uPx, sdFocus) * (1. - smoothstep(.35, 1.38, sdFocus));
    vec3 focusStroke = clamp(mix(uCol * .64, uAccent, .56), 0., 1.);
    outLin = mix(outLin, toLinear(focusStroke), fBand * compPad * .72);
  }
  gl_FragColor = vec4(outLin, 1.);
  #include <colorspace_fragment>
}`;
const FRAG = FRAG_HEADER + FRAG_CORE;
const FRAG_INST = FRAG_INST_HEADER + FRAG_CORE;

export const SLAB_MODES = ['touch', 'gap', 'elide'];
const ELIDE_FRONT = 3, ELIDE_STEP = 3;
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
function headSlabs(b) {
  const H = b.div[2], p = (b.z1 - b.z0) / H, one = (i, z1, t) => ({ ...b, z0: z1 - t, z1, div: [b.div[0], b.div[1], 1], alt: null, head: i });
  const slabs = Array.from({ length: ELIDE_FRONT }, (_, i) => one(i, b.z1 - i * ELIDE_STEP, p)).concat([one(H - 1, b.z0 + p, p)]);
  return { slabs, gap: { from: b.z1 - (ELIDE_FRONT - 1) * ELIDE_STEP - p, to: b.z0 + p, shown: ELIDE_FRONT + 1, H } };
}

function buildArrowVertices(pts, { w = 2, z = -2.048, head = true, r = 2.4 }) {
  const P2 = pts.map(([x, y]) => new THREE.Vector2(x, y)), path = [P2[0]];
  for (let i = 1; i < P2.length - 1; i++) {
    const a = P2[i - 1], c = P2[i], n = P2[i + 1], da = c.clone().sub(a), dn = n.clone().sub(c), rr = Math.min(r, da.length() / 2, dn.length() / 2);
    const p0 = c.clone().sub(da.normalize().multiplyScalar(rr)), p1 = c.clone().add(dn.normalize().multiplyScalar(rr));
    for (let k = 0; k <= 14; k++) { const t = k / 14, q = p0.clone().multiplyScalar((1 - t) * (1 - t)).add(c.clone().multiplyScalar(2 * t * (1 - t))).add(p1.clone().multiplyScalar(t * t)); path.push(q) }
  }
  path.push(P2.at(-1));
  const HL = head ? Math.min(1.68 * w + .9, 0.72 * path.at(-1).distanceTo(path.at(-2))) : 0, HW = w * 1.04;
  const end = path.at(-1), dirE = end.clone().sub(path.at(-2)).normalize();
  const baseP = end.clone().sub(dirE.clone().multiplyScalar(HL)), notchP = end.clone().sub(dirE.clone().multiplyScalar(HL * .86));
  const body = [...path.slice(0, -1), head ? notchP : end].filter((p, i, A) => i === 0 || p.distanceTo(A[i - 1]) > 1e-4);
  const pos = [], idx = [];
  body.forEach((p, i) => {
    const dPrev = i > 0 ? p.clone().sub(body[i - 1]).normalize() : null;
    const dNext = i < body.length - 1 ? body[i + 1].clone().sub(p).normalize() : null;
    const tang = dPrev && dNext ? dPrev.clone().add(dNext) : (dNext || dPrev);
    if (tang.lengthSq() < 1e-8) tang.copy(dNext || dPrev); else tang.normalize();
    const miter = dNext ? 1 / Math.max(.58, tang.dot(dNext)) : 1;
    const nrm = new THREE.Vector2(-tang.y, tang.x).multiplyScalar((w / 2) * miter);
    pos.push(p.x + nrm.x, p.y + nrm.y, z, p.x - nrm.x, p.y - nrm.y, z);
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2) }
  });
  if (head) {
    const o = pos.length / 3, nH = new THREE.Vector2(-dirE.y, dirE.x).multiplyScalar(HW);
    pos.push(baseP.x + nH.x, baseP.y + nH.y, z, notchP.x, notchP.y, z, baseP.x - nH.x, baseP.y - nH.y, z, end.x, end.y, z);
    idx.push(o, o + 1, o + 3, o + 1, o + 2, o + 3);
  }
  return { pos, idx };
}

const NUM_AXES = { col: [0, 1], row: [1, 0], wl: [1, 1], wt: [1, 1], rod: [0, 1], bar: [1, 0] };

export function makeFlowLook({ px = 2, pal = 'user', minPx = 0, viewH = 0, slabs = 'gap', alt = false, fine = 16, hlines = true, fineWords = true, flat = false, lines = 'band', prism = false } = {}) {
  const LINES = { now: 0, bold: 1, seam: 2, band: 3 }[lines] ?? 3;
  const P = loadPalette(pal), uPx = { value: px }, UNIT = new THREE.BoxGeometry(1, 1, 1);
  UNIT.setAttribute('aSlab', new THREE.Float32BufferAttribute(new Float32Array(UNIT.attributes.position.count * 3), 3));
  const uMinPx = { value: minPx * px }, uViewH = { value: viewH * px };
  const colorOf = b => P[b.comp][b.kind === 'data' ? 0 : 1], meshes = [];
  let seed = 0;
  const byId = new Map();
  const fineOf = b => {
    const F = fine > 0 ? 256 / fine : 1, [nx, ny] = NUM_AXES[b.orient] || [0, 0];
    const tok = b.t?.colsUnit === 'token', wo = b.t?.headAxis === 'y';
    const W = fineWords ? 2 * F : 1;
    return new THREE.Vector3(nx && !wo ? F : W, ny && !tok ? F : W, 1);
  };
  const elided = [], batchById = new Map();
  let batchState = null;
  function setColor(comp, [res, wt]) {
    P[comp] = [res, wt];
    for (const m of meshes) {
      if (m.userData.block.comp !== comp) continue;
      const c = srgb(colorOf(m.userData.block));
      if (m.material.uniforms.uCol) m.material.uniforms.uCol.value.copy(c);
      const rec = batchById.get(m.userData.block.id);
      if (rec && batchState) {
        batchState.staticArr[rec.base + 8] = c.x;
        batchState.staticArr[rec.base + 9] = c.y;
        batchState.staticArr[rec.base + 10] = c.z;
        batchState.staticTex.needsUpdate = true;
      }
    }
  }
  function addBlock(scene, b) {
    if (slabs !== 'touch' && b.alt === 'z' && b.t?.deck?.kind === 'head' && b.div[2] > 1) {
      if (slabs === 'gap') return addOne(scene, b, stackGeometry(b.div[2], 1 / (1 + (b.headGap || 1))));
      const { slabs: S, gap } = headSlabs(b); if (gap) elided.push({ b, ...gap });
      const ms = S.map(c => addOne(scene, c)); return ms[0];
    }
    return addOne(scene, b);
  }
  function addOne(scene, b, geo = UNIT) {
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: {
      uDiv: { value: new THREE.Vector3(...b.div) }, uCut: { value: new THREE.Vector3(...(b.cut || [1, 1, 1])) }, uCol: { value: srgb(colorOf(b)) }, uNoise: { value: b.kind === 'data' ? (prism ? PDNOISE : DNOISE) : (prism ? PWNOISE : WNOISE) },
      uSeed: { value: ++seed * 7 }, uAlt: { value: alt && b.alt ? (b.alt === 'z' && b.t.deck?.kind === 'head' ? .86 : .9) : 1 }, uAltAxis: { value: { x: 0, y: 1, z: 2 }[b.alt] ?? 2 }, uFlat: { value: flat && !alt && b.alt === 'z' ? 1 : 0 }, uHLines: { value: hlines && b.alt === 'z' ? 1 : 0 }, uGapped: { value: geo === UNIT ? 0 : 1 }, uFine: { value: fineOf(b) }, uPx, uMinPx, uViewH, uDim: { value: 0 }, uPrism: { value: prism ? 1 : 0 }, uRecv: { value: 0 }, uGrow: { value: new THREE.Vector2(1e9, 1) }, uGrowAxis: { value: 0 }, uF0: { value: new THREE.Vector3(1e9, 1e9, 1e9) }, uF1: { value: new THREE.Vector3(-1e9, -1e9, -1e9) }, uDimIn: { value: 0 }, uFront: { value: new THREE.Vector4() }, uFrontAxis: { value: 0 }, uFrontR: { value: 0 }, uLines: { value: LINES }, uSeamY: { value: b.t?.headsCut && b.alt === 'y' ? 1 : 0 }, uPage: { value: srgb(PAGE) }, uAccent: { value: srgb(ACCENTS[b.comp] || '#3b4741') } } }));
    m.frustumCulled = false;
    m.scale.set(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0); m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    m.userData.block = b; meshes.push(m); byId.set(b.id, m); scene.add(m); return m;
  }
  // Batch thousands of tensor blocks into 3–4 InstancedMeshes backed by power-of-two RGBA32F DataTextures (3007 draw calls -> 3).
  function addBlockBatch(scene, blocks) {
    if (slabs === 'elide') return blocks.map(b => addBlock(scene, b));
    const n = blocks.length;
    if (!n) return [];
    let texH = 1;
    while (texH < Math.ceil(n / 64)) texH <<= 1;
    const staticArr = new Float32Array(512 * texH * 4);
    const dynArr = new Float32Array(512 * texH * 4);
    const groups = new Map();
    for (let bi = 0; bi < n; bi++) {
      const b = blocks[bi], base = bi * 32;
      const isStack = slabs === 'gap' && b.alt === 'z' && b.t?.deck?.kind === 'head' && b.div[2] > 1;
      const geo = isStack ? stackGeometry(b.div[2], 1 / (1 + (b.headGap || 1))) : UNIT;
      if (!groups.has(geo)) groups.set(geo, []);
      groups.get(geo).push(bi);

      const cut = b.cut || [1, 1, 1], col = srgb(colorOf(b)), acc = srgb(ACCENTS[b.comp] || '#3b4741'), fn = fineOf(b);
      staticArr[base] = b.div[0]; staticArr[base + 1] = b.div[1]; staticArr[base + 2] = b.div[2]; staticArr[base + 3] = ++seed * 7;
      staticArr[base + 4] = cut[0]; staticArr[base + 5] = cut[1]; staticArr[base + 6] = cut[2];
      staticArr[base + 7] = b.kind === 'data' ? (prism ? PDNOISE : DNOISE) : (prism ? PWNOISE : WNOISE);
      staticArr[base + 8] = col.x; staticArr[base + 9] = col.y; staticArr[base + 10] = col.z;
      staticArr[base + 11] = flat && !alt && b.alt === 'z' ? 1 : 0;
      staticArr[base + 12] = acc.x; staticArr[base + 13] = acc.y; staticArr[base + 14] = acc.z;
      staticArr[base + 15] = b.t?.headsCut && b.alt === 'y' ? 1 : 0;
      staticArr[base + 16] = fn.x; staticArr[base + 17] = fn.y; staticArr[base + 18] = fn.z;
      staticArr[base + 19] = hlines && b.alt === 'z' ? 1 : 0;
      staticArr[base + 20] = (b.x0 + b.x1) / 2; staticArr[base + 21] = (b.y0 + b.y1) / 2; staticArr[base + 22] = (b.z0 + b.z1) / 2;
      staticArr[base + 23] = alt && b.alt ? (b.alt === 'z' && b.t.deck?.kind === 'head' ? .86 : .9) : 1;
      staticArr[base + 24] = b.x1 - b.x0; staticArr[base + 25] = b.y1 - b.y0; staticArr[base + 26] = b.z1 - b.z0;
      staticArr[base + 27] = { x: 0, y: 1, z: 2 }[b.alt] ?? 2;

      dynArr[base] = 1e9; dynArr[base + 1] = 1; dynArr[base + 2] = 0; dynArr[base + 3] = 0;
      dynArr[base + 12] = 1e9; dynArr[base + 13] = 1e9; dynArr[base + 14] = 1e9; dynArr[base + 15] = 1;
      dynArr[base + 16] = -1e9; dynArr[base + 17] = -1e9; dynArr[base + 18] = -1e9;

      const u = {
        uGrow: { value: new THREE.Vector2(1e9, 1) }, uGrowAxis: { value: 0 }, uRecv: { value: 0 },
        uFront: { value: new THREE.Vector4() }, uFrontAxis: { value: 0 }, uFrontR: { value: 0 },
        uDim: { value: 0 }, uDimIn: { value: 0 },
        uF0: { value: new THREE.Vector3(1e9, 1e9, 1e9) }, uF1: { value: new THREE.Vector3(-1e9, -1e9, -1e9) },
      };
      let vis = true;
      const proxy = {
        isBlockProxy: true,
        userData: { block: b },
        material: { uniforms: u },
        get visible() { return vis },
        set visible(v) {
          const nv = !!v;
          if (nv === vis) return;
          vis = nv;
          dynArr[base + 15] = nv ? 1 : 0;
          batchState.dynDirty = true;
        },
      };
      meshes.push(proxy);
      byId.set(b.id, proxy);
      batchById.set(b.id, { base, u, proxy });
    }
    const mkTex = arr => {
      const t = new THREE.DataTexture(arr, 512, texH, THREE.RGBAFormat, THREE.FloatType);
      t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true;
      return t;
    };
    const staticTex = mkTex(staticArr), dynTex = mkTex(dynArr);
    batchState = { staticArr, dynArr, staticTex, dynTex, dynDirty: false, n };
    const uPageVal = srgb(PAGE), batchMeshes = [];
    for (const [geo, indices] of groups) {
      const instGeo = geo.clone();
      instGeo.setAttribute('aBlockIdx', new THREE.InstancedBufferAttribute(new Float32Array(indices), 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT_INST,
        fragmentShader: FRAG_INST,
        uniforms: {
          uStaticTex: { value: staticTex }, uDynTex: { value: dynTex }, uInvTexH: { value: 1 / texH },
          uGapped: { value: geo === UNIT ? 0 : 1 }, uPx, uMinPx, uViewH,
          uPrism: { value: prism ? 1 : 0 }, uLines: { value: LINES }, uPage: { value: uPageVal },
        },
      });
      const im = new THREE.InstancedMesh(instGeo, mat, indices.length);
      im.frustumCulled = false;
      im.onBeforeRender = () => {
        if (batchState.dynDirty) { batchState.dynTex.needsUpdate = true; batchState.dynDirty = false }
      };
      scene.add(im);
      batchMeshes.push(im);
    }
    return batchMeshes;
  }
  function addArrow(scene, pts, { color, w = 2, z = -2.048, head = true, r = 2.4 }) {
    const { pos, idx } = buildArrowVertices(pts, { w, z, head, r });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    scene.add(m); return m;
  }
  // Merge thousands of static model arrows into a single vertex-coloured draw call while preserving per-arrow dimming.
  function addArrowBatch(scene, defs) {
    const allPos = [], allCol = [], allIdx = [], items = [], tmp = new THREE.Color();
    let vOff = 0;
    for (const d of defs) {
      const { pos, idx } = buildArrowVertices(d.pts, d);
      const vCount = pos.length / 3;
      tmp.set(d.color);
      for (let i = 0; i < pos.length; i++) allPos.push(pos[i]);
      for (let i = 0; i < vCount; i++) allCol.push(tmp.r, tmp.g, tmp.b);
      for (let i = 0; i < idx.length; i++) allIdx.push(idx[i] + vOff);
      items.push({ ...d.meta, v0: vOff, vCount, baseR: tmp.r, baseG: tmp.g, baseB: tmp.b, curR: tmp.r, curG: tmp.g, curB: tmp.b });
      vOff += vCount;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
    const colAttr = new THREE.Float32BufferAttribute(allCol, 3);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('color', colAttr);
    g.setIndex(allIdx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    mesh.frustumCulled = false;
    scene.add(mesh);
    const arr = colAttr.array;
    function setArrowFade(item, pageCol, fade) {
      const r = fade > 0 ? item.baseR + (pageCol.r - item.baseR) * fade : item.baseR;
      const gg = fade > 0 ? item.baseG + (pageCol.g - item.baseG) * fade : item.baseG;
      const b = fade > 0 ? item.baseB + (pageCol.b - item.baseB) * fade : item.baseB;
      if (Math.abs(r - item.curR) < 1e-5 && Math.abs(gg - item.curG) < 1e-5 && Math.abs(b - item.curB) < 1e-5) return false;
      item.curR = r; item.curG = gg; item.curB = b;
      const end = (item.v0 + item.vCount) * 3;
      for (let i = item.v0 * 3; i < end; i += 3) { arr[i] = r; arr[i + 1] = gg; arr[i + 2] = b }
      return true;
    }
    function syncDim(keepFn, pageCol, fade) {
      let dirty = false;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (setArrowFade(it, pageCol, keepFn(it) ? 0 : fade)) dirty = true;
      }
      if (dirty) colAttr.needsUpdate = true;
    }
    return { mesh, items, syncDim };
  }
  function setDim(comp, amt = .78) {
    for (const m of meshes) dimOne(m.userData.block.id, comp && m.userData.block.comp !== comp ? amt : 0);
  }
  function setResolution(pxVal, viewHVal) { uPx.value = pxVal; uMinPx.value = minPx * pxVal; uViewH.value = viewHVal * pxVal }
  const U = id => byId.get(id)?.material.uniforms;
  function grow(id, k = null, f = 1, axis = 0) {
    const u = U(id); if (!u) return;
    const gx = k === null ? 1e9 : k, gy = k === null ? 1 : f;
    u.uGrow.value.set(gx, gy); u.uGrowAxis.value = axis; u.uFrontAxis.value = 0;
    const rec = batchById.get(id);
    if (rec) {
      const a = batchState.dynArr, o = rec.base;
      a[o] = gx; a[o + 1] = gy; a[o + 2] = axis; a[o + 8] = 0;
      batchState.dynDirty = true;
    }
  }
  function front(id, axis, from, to, f, slice) {
    const u = U(id); if (!u) return;
    u.uFront.value.set(from, to, f, slice); u.uFrontAxis.value = axis;
    const rec = batchById.get(id);
    if (rec) {
      const a = batchState.dynArr, o = rec.base;
      a[o + 4] = from; a[o + 5] = to; a[o + 6] = f; a[o + 7] = slice; a[o + 8] = axis;
      batchState.dynDirty = true;
    }
  }
  function downHeads(id, h0, h1, w0, w1, r) {
    const u = U(id); if (!u) return;
    u.uGrow.value.set(1e9, 1); u.uFront.value.set(h0, h1, w0, w1); u.uFrontR.value = r; u.uFrontAxis.value = 3;
    const rec = batchById.get(id);
    if (rec) {
      const a = batchState.dynArr, o = rec.base;
      a[o] = 1e9; a[o + 1] = 1; a[o + 4] = h0; a[o + 5] = h1; a[o + 6] = w0; a[o + 7] = w1; a[o + 8] = 3; a[o + 9] = r;
      batchState.dynDirty = true;
    }
  }
  function focus(id, box = null, dimIn = 0) {
    const u = U(id); if (!u) return;
    const x0 = box ? box[0][0] : 1e9, y0 = box ? box[0][1] : 1e9, z0 = box ? box[0][2] : 1e9;
    const x1 = box ? box[1][0] : -1e9, y1 = box ? box[1][1] : -1e9, z1 = box ? box[1][2] : -1e9;
    u.uF0.value.set(x0, y0, z0); u.uF1.value.set(x1, y1, z1); u.uDimIn.value = dimIn;
    const rec = batchById.get(id);
    if (rec) {
      const a = batchState.dynArr, o = rec.base;
      a[o + 11] = dimIn; a[o + 12] = x0; a[o + 13] = y0; a[o + 14] = z0; a[o + 16] = x1; a[o + 17] = y1; a[o + 18] = z1;
      batchState.dynDirty = true;
    }
  }
  function dimOne(id, v) {
    const u = U(id); if (!u) return;
    u.uDim.value = v;
    const rec = batchById.get(id);
    if (rec) { batchState.dynArr[rec.base + 10] = v; batchState.dynDirty = true }
  }
  function setRecv(id, v) {
    const u = U(id); if (!u) return;
    u.uRecv.value = v;
    const rec = batchById.get(id);
    if (rec) { batchState.dynArr[rec.base + 3] = v; batchState.dynDirty = true }
  }
  function resetOne(id, baseFade) {
    const u = U(id); if (!u) return;
    u.uGrow.value.set(1e9, 1); u.uFrontAxis.value = 0;
    u.uF0.value.set(1e9, 1e9, 1e9); u.uF1.value.set(-1e9, -1e9, -1e9);
    u.uDim.value = baseFade; u.uRecv.value = 0;
    const rec = batchById.get(id);
    if (rec) {
      const a = batchState.dynArr, o = rec.base;
      a[o] = 1e9; a[o + 1] = 1; a[o + 3] = 0; a[o + 8] = 0; a[o + 10] = baseFade;
      a[o + 12] = 1e9; a[o + 13] = 1e9; a[o + 14] = 1e9; a[o + 16] = -1e9; a[o + 17] = -1e9; a[o + 18] = -1e9;
      batchState.dynDirty = true;
    }
  }
  function resetAll(baseFade) {
    if (batchState) {
      const a = batchState.dynArr, total = batchState.n;
      for (let i = 0; i < total; i++) {
        const o = i * 32;
        a[o] = 1e9; a[o + 1] = 1; a[o + 3] = 0; a[o + 8] = 0; a[o + 10] = baseFade;
        a[o + 12] = 1e9; a[o + 13] = 1e9; a[o + 14] = 1e9; a[o + 16] = -1e9; a[o + 17] = -1e9; a[o + 18] = -1e9;
        const u = meshes[i].material.uniforms;
        u.uGrow.value.set(1e9, 1); u.uFrontAxis.value = 0;
        u.uF0.value.set(1e9, 1e9, 1e9); u.uF1.value.set(-1e9, -1e9, -1e9);
        u.uDim.value = baseFade; u.uRecv.value = 0;
      }
      batchState.dynDirty = true;
      return;
    }
    for (const m of meshes) resetOne(m.userData.block.id, baseFade);
  }
  return { addBlock, addBlockBatch, addArrow, addArrowBatch, colorOf, setColor, setDim, setResolution, meshes, byId, grow, front, downHeads, focus, dimOne, setRecv, resetOne, resetAll, palette: P, elided };
}
