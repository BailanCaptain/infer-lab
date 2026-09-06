/**
 * 放大窗口的实体格子材质（InstancedMesh）。
 * 每个实例带 from/to 两组值与高亮，uT 由 useFrame 每帧写入：换步时数值与焦点在 GPU 上插值，
 * CPU 只在换步那一帧重写属性缓冲。焦点用缩放表达（非高亮 0.78 倍），不用透明度。
 */
import { type Color, GLSL3, ShaderMaterial } from "three";
import type { VizTheme } from "../theme";
import { VALUE_COLOR_GLSL } from "./valueColor";

/** 非高亮格的缩放（计划 §1「焦点用缩放而非透明度」） */
export const DIM_SCALE = 0.78;

const VERT = /* glsl */ `
${VALUE_COLOR_GLSL}

in float aVal0;
in float aVal1;
in float aHi0;
in float aHi1;

uniform float uT;
uniform float uScale;
uniform float uDimScale;
uniform vec3 uNeg, uPos, uZero, uMask, uAccent;

out vec3 vColor;
out float vHi;
out vec3 vNormal;

void main() {
  float hi = mix(aHi0, aHi1, uT);
  vHi = hi;
  // 先各自上色再插值：哨兵值不能参与数值插值
  vec3 c0 = valueColor(aVal0, uScale, uNeg, uPos, uZero, uMask);
  vec3 c1 = valueColor(aVal1, uScale, uNeg, uPos, uZero, uMask);
  vColor = mix(mix(c0, c1, uT), uAccent, hi * 0.22);

  vNormal = normalize(normalMatrix * normal);
  vec3 transformed = position * mix(uDimScale, 1.0, hi);
  #ifdef USE_INSTANCING
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
  #else
    vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
  #endif
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
in vec3 vColor;
in float vHi;
in vec3 vNormal;
out vec4 outColor;

void main() {
  // 固定方向的柔和明暗，让格子有体积感；不接入场景灯光，保证颜色即数值
  float nl = 0.62 + 0.38 * max(dot(normalize(vNormal), normalize(vec3(0.35, 0.75, 0.55))), 0.0);
  vec3 c = vColor * nl;
  c += vColor * vHi * 0.35;
  outColor = vec4(c, 1.0);
}
`;

export interface CellUniforms {
  uT: { value: number };
  uScale: { value: number };
  /** 非高亮格的缩放；本步无焦点时设为 1 */
  uDimScale: { value: number };
  uNeg: { value: Color };
  uPos: { value: Color };
  uZero: { value: Color };
  uMask: { value: Color };
  uAccent: { value: Color };
}

export type CellMaterial = ShaderMaterial & { uniforms: CellUniforms };

export function createCellMaterial(theme: VizTheme): CellMaterial {
  const uniforms: CellUniforms = {
    uT: { value: 1 },
    uScale: { value: 1 },
    uDimScale: { value: DIM_SCALE },
    uNeg: { value: theme.neg.clone() },
    uPos: { value: theme.pos.clone() },
    uZero: { value: theme.zero.clone() },
    uMask: { value: theme.mask.clone() },
    uAccent: { value: theme.accent.clone() },
  };
  const m = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: uniforms as unknown as ShaderMaterial["uniforms"],
  });
  return m as CellMaterial;
}
