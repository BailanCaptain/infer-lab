/**
 * 全幅张量平面的材质：一张 R32F 纹理 = 张量的（可能下采样的）值场。
 * 着色只做四件事：数值色阶、格线（仅逐格对应且足够大时）、高亮行列带、放大窗口取景框。
 * 高亮强度 uHiT 由 useFrame 每帧写入 progress.t，不触发 React。
 */
import { type Color, DoubleSide, GLSL3, ShaderMaterial, type Texture, Vector2, Vector4 } from "three";
import type { VizTheme } from "../theme";
import { VALUE_COLOR_GLSL } from "./valueColor";

/** 高亮行/列的上限（真实时间线最多 6 行） */
export const MAX_HIGHLIGHT = 8;

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
${VALUE_COLOR_GLSL}

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uTex;
uniform vec2 uTexSize;   // 纹理的列数、行数
uniform vec2 uCells;     // 张量真实的列数、行数
uniform float uScale;
uniform float uExact;    // 1 = 一个 texel 就是一格
uniform float uHiT;      // 高亮渐入 0..1
uniform int uHiRowCount;
uniform int uHiColCount;
uniform float uHiRows[${MAX_HIGHLIGHT}];
uniform float uHiCols[${MAX_HIGHLIGHT}];
uniform vec4 uRect;      // 取景框 (u0,v0,u1,v1)，左上原点；z<=x 表示无
uniform float uRevealRow; // 逐格揭示的行（-1 = 不揭示）
uniform float uReveal;    // 该行揭示到的列比例 0..1
uniform vec3 uNeg, uPos, uZero, uMask, uGrid, uAccent;

void main() {
  vec2 t = vec2(vUv.x, 1.0 - vUv.y);          // 行 0 在上
  float v = texture(uTex, t).r;
  vec3 c = valueColor(v, uScale, uNeg, uPos, uZero, uMask);

  // 高亮行列带：格数极多时按最小可见宽度加宽，否则一格宽的带只有半个像素
  vec2 cellF = t * uCells;
  float halfR = max(0.5, uCells.y * 0.004);
  float halfC = max(0.5, uCells.x * 0.004);
  float hi = 0.0;
  for (int i = 0; i < ${MAX_HIGHLIGHT}; i++) {
    if (i < uHiRowCount && abs(cellF.y - (uHiRows[i] + 0.5)) < halfR) hi = 1.0;
    if (i < uHiColCount && abs(cellF.x - (uHiCols[i] + 0.5)) < halfC) hi = 1.0;
  }
  c = mix(c, c * 1.7 + uAccent * 0.32, clamp(hi * uHiT, 0.0, 1.0));

  // 逐格揭示：揭示行里还没算到的格子先是"空"的
  if (uRevealRow >= 0.0 && abs(cellF.y - (uRevealRow + 0.5)) < 0.5 && cellF.x > uReveal * uCells.x) {
    c = uZero;
  }

  // 格线：只有逐格对应且一格 ≥ 3 像素时才画，避免下采样纹理上的摩尔纹
  vec2 texel = t * uTexSize;
  vec2 fw = fwidth(texel);
  if (uExact > 0.5 && max(fw.x, fw.y) < 0.34) {
    vec2 w = clamp(fw, vec2(0.004), vec2(0.4));
    vec2 d = abs(fract(texel) - 0.5);
    float line = max(
      smoothstep(0.5 - w.x, 0.5, d.x),
      smoothstep(0.5 - w.y, 0.5, d.y)
    );
    c = mix(c, uGrid, line * 0.85);
  }

  // 放大窗口的取景框
  if (uRect.z > uRect.x) {
    vec2 fwUv = max(fwidth(t), vec2(1e-6));
    bool inX = t.x > uRect.x - fwUv.x * 2.0 && t.x < uRect.z + fwUv.x * 2.0;
    bool inY = t.y > uRect.y - fwUv.y * 2.0 && t.y < uRect.w + fwUv.y * 2.0;
    float dx = min(abs(t.x - uRect.x), abs(t.x - uRect.z)) / fwUv.x;
    float dy = min(abs(t.y - uRect.y), abs(t.y - uRect.w)) / fwUv.y;
    float edge = 0.0;
    if (inY && dx < 1.6) edge = 1.0;
    if (inX && dy < 1.6) edge = 1.0;
    c = mix(c, uAccent, edge);
  }

  outColor = vec4(c, 1.0);
}
`;

export interface PlaneUniforms {
  uTex: { value: Texture | null };
  uTexSize: { value: Vector2 };
  uCells: { value: Vector2 };
  uScale: { value: number };
  uExact: { value: number };
  uHiT: { value: number };
  uHiRowCount: { value: number };
  uHiColCount: { value: number };
  uHiRows: { value: number[] };
  uHiCols: { value: number[] };
  uRect: { value: Vector4 };
  uRevealRow: { value: number };
  uReveal: { value: number };
  uNeg: { value: Color };
  uPos: { value: Color };
  uZero: { value: Color };
  uMask: { value: Color };
  uGrid: { value: Color };
  uAccent: { value: Color };
}

export type PlaneMaterial = ShaderMaterial & { uniforms: PlaneUniforms };

export function createPlaneMaterial(theme: VizTheme): PlaneMaterial {
  const uniforms: PlaneUniforms = {
    uTex: { value: null },
    uTexSize: { value: new Vector2(1, 1) },
    uCells: { value: new Vector2(1, 1) },
    uScale: { value: 1 },
    uExact: { value: 1 },
    uHiT: { value: 1 },
    uHiRowCount: { value: 0 },
    uHiColCount: { value: 0 },
    uHiRows: { value: new Array<number>(MAX_HIGHLIGHT).fill(-1) },
    uHiCols: { value: new Array<number>(MAX_HIGHLIGHT).fill(-1) },
    uRect: { value: new Vector4(0, 0, 0, 0) },
    uRevealRow: { value: -1 },
    uReveal: { value: 1 },
    uNeg: { value: theme.neg.clone() },
    uPos: { value: theme.pos.clone() },
    uZero: { value: theme.zero.clone() },
    uMask: { value: theme.mask.clone() },
    uGrid: { value: theme.grid.clone() },
    uAccent: { value: theme.accent.clone() },
  };
  const m = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: uniforms as unknown as ShaderMaterial["uniforms"],
    side: DoubleSide,
  });
  return m as PlaneMaterial;
}
