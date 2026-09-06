/**
 * 场景内短标签：troika SDF 文字（drei <Text>），中文用 gen-font-subset 生成的 woff 子集。
 * 约定（计划 §2.4「文字策略」）：
 * - 只放短标签（张量 id、shape、轴刻度、格值）；超过 40 字走 DOM 右栏；
 * - 深色描边 + depthTest=false，任何角度都不会被格子挡住；
 * - 亮度控制在 0.8 以下，不进 Bloom；
 * - 新增中文标签后必须重跑 `pnpm gen:font`，否则字形缺失。
 */
import { Text } from "@react-three/drei";
import { useEffect, useRef } from "react";
import type { Mesh } from "three";
import { type VizColorName, vizTheme } from "../theme";
import { registerLabel } from "./registry";
import { LABEL_SIZE, type LabelSize } from "./sizes";

/** 子集字体路径（相对 base，GitHub Pages 子路径也成立） */
export const LABEL_FONT = `${import.meta.env.BASE_URL}fonts/notosc-3d.woff`;
/** 等宽子集（JetBrains Mono 500，仅 ASCII + × ·）：数字、shape、格值 */
export const MONO_FONT = `${import.meta.env.BASE_URL}fonts/mono-3d.woff`;
const MONO_SAFE = /^[\x20-\x7e×·]+$/;

/** SDF 每字形分辨率：troika 要求 2 的幂；64 对中文偏软，128 够清晰 */
export const SDF_GLYPH_SIZE = 128;

export { LABEL_SIZE, type LabelSize } from "./sizes";

export interface LabelProps {
  children: string;
  /** 注册到标签边界表的 id；给了才参与不遮挡断言 */
  id?: string | undefined;
  position?: [number, number, number] | undefined;
  rotation?: [number, number, number] | undefined;
  size?: LabelSize | number | undefined;
  color?: VizColorName | undefined;
  anchorX?: "left" | "center" | "right" | undefined;
  anchorY?: "top" | "middle" | "bottom" | undefined;
  maxWidth?: number | undefined;
  outline?: boolean | undefined;
  /** 等宽：文本全是 ASCII/×/· 时生效，否则回落到中文字体 */
  mono?: boolean | undefined;
  /** 拿到 mesh 引用（动效每帧改 position/scale，不经过 React） */
  objRef?: ((m: Mesh | null) => void) | undefined;
}

export function Label({
  children,
  id,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size = "body",
  color = "ink",
  anchorX = "center",
  anchorY = "middle",
  maxWidth,
  outline = true,
  mono = false,
  objRef,
}: LabelProps) {
  const ref = useRef<Mesh>(null);
  const setRef = (m: Mesh | null) => {
    ref.current = m;
    objRef?.(m);
  };
  const theme = vizTheme();
  const fontSize = typeof size === "number" ? size : LABEL_SIZE[size];

  useEffect(() => {
    const obj = ref.current;
    if (!obj || !id) return;
    return registerLabel(id, obj, children);
  }, [id, children]);

  return (
    <Text
      ref={setRef}
      font={mono && MONO_SAFE.test(children) ? MONO_FONT : LABEL_FONT}
      fontSize={fontSize}
      color={theme[color]}
      anchorX={anchorX}
      anchorY={anchorY}
      position={position}
      rotation={rotation}
      {...(maxWidth === undefined ? {} : { maxWidth })}
      sdfGlyphSize={SDF_GLYPH_SIZE}
      outlineWidth={outline ? fontSize * 0.07 : 0}
      outlineColor={theme.canvas}
      outlineOpacity={0.95}
      renderOrder={10}
      material-depthTest={false}
      material-toneMapped={false}
    >
      {children}
    </Text>
  );
}
