/**
 * 数值 → 颜色的唯一定义（GLSL）。全幅平面与放大窗口共用这段代码，避免两处色阶漂移。
 * 约定与 scale.ts 一致：|v| ≥ MASK_SENTINEL 是哨兵（因果掩码 −1e30），单独出灰蓝色，不参与色阶。
 * 亮度 ∝ (|v|/scale)^0.7，负值走青、正值走琥珀、0 近黑。
 */
export const VALUE_COLOR_GLSL = /* glsl */ `
const float MASK_SENTINEL = 1e29;
const float VALUE_GAMMA = 0.7;

bool isMasked(float v) {
  return abs(v) >= MASK_SENTINEL || isnan(v);
}

vec3 valueColor(float v, float scale, vec3 negC, vec3 posC, vec3 zeroC, vec3 maskC) {
  if (isMasked(v)) return maskC;
  float a = clamp(abs(v) / max(scale, 1e-20), 0.0, 1.0);
  vec3 c = v < 0.0 ? negC : posC;
  return mix(zeroC, c, pow(a, VALUE_GAMMA));
}
`;
