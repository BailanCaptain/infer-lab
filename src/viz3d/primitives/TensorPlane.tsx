/**
 * 全幅张量平面：一个张量的整体形状与值场，按真实行列比（压缩后）铺开。
 * - 稠密张量按 stride 下采样进 R32F 纹理；惰性权重没有全量数据，走 96×96 缩略图。
 * - 高亮行列在着色器里画带，强度由 useFrame 写 uHiT = progress.t，播放期零 React 重渲染。
 * - 多头张量在后面叠一摞「其余头」的薄片，表达 heads 的数量（非高亮用缩放表达）。
 */
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  FloatType,
  type InstancedMesh,
  Matrix4,
  NearestFilter,
  RedFormat,
} from "three";
import type { PlaneView } from "../../sim/timeline/plane";
import type { Highlight } from "../../sim/timeline/types";
import { progress } from "../../timeline";
import { createPlaneMaterial, MAX_HIGHLIGHT } from "../materials/planeMaterial";
import { MAX_TEX_AXIS, type PlaneSize, type Rect, rectUv, sampleAxis } from "../scale";
import { vizTheme } from "../theme";

/** 其余头的薄片最多画这么多，超出只画这些（标签写真实头数） */
const MAX_GHOST_HEADS = 15;
const GHOST_GAP = 0.055;

export interface TensorPlaneProps {
  view: PlaneView;
  /** 纹理缓存键：张量 id + 头 + 额外下标 */
  viewKey: string;
  size: PlaneSize;
  /** 色阶基准 */
  scale: number;
  highlight?: Highlight | undefined;
  /** 放大窗口在平面上的取景框 */
  rect?: Rect | null | undefined;
  /** 高亮渐入区间（progress.t） */
  hiWindow?: [number, number] | undefined;
}

const FULL: [number, number] = [0, 1];

/** progress.t → 区间内的 0..1 */
export function phase(t: number, w: [number, number]): number {
  const [a, b] = w;
  if (b <= a) return t >= b ? 1 : 0;
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

export interface TextureShape {
  cols: number;
  rows: number;
  /** 一个 texel 是否就是一格（否则标签要说明是采样） */
  exact: boolean;
}

/** 全幅纹理的取样计划：权重走缩略图，其余按 stride 下采样。标签与纹理共用这一份判断。 */
export function textureShape(view: PlaneView): TextureShape {
  if (view.thumb) {
    const { rows, cols } = view.thumb;
    return { cols, rows, exact: rows === view.rows && cols === view.cols };
  }
  const rs = sampleAxis(view.rows, MAX_TEX_AXIS);
  const cs = sampleAxis(view.cols, MAX_TEX_AXIS);
  return { cols: cs.count, rows: rs.count, exact: rs.exact && cs.exact };
}

interface TextureData extends TextureShape {
  tex: DataTexture;
}

/** R32F 纹理必须用最近邻：浮点线性过滤要额外扩展，而且格子本来就不该被插值 */
function floatTexture(data: Float32Array, cols: number, rows: number): DataTexture {
  const t = new DataTexture(data, cols, rows, RedFormat, FloatType);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

function buildTexture(view: PlaneView): TextureData {
  const shape = textureShape(view);
  // 权重没有全量数据，只有缩略图
  if (view.thumb) {
    const { rows, cols, data } = view.thumb;
    return { ...shape, tex: floatTexture(new Float32Array(data), cols, rows) };
  }
  const rs = sampleAxis(view.rows, MAX_TEX_AXIS);
  const cs = sampleAxis(view.cols, MAX_TEX_AXIS);
  const data = new Float32Array(rs.count * cs.count);
  for (let r = 0; r < rs.count; r++) {
    const sr = rs.index(r);
    for (let c = 0; c < cs.count; c++) data[r * cs.count + c] = view.at(sr, cs.index(c));
  }
  return { ...shape, tex: floatTexture(data, cs.count, rs.count) };
}

const ghostMatrix = new Matrix4();

export const TensorPlane = memo(function TensorPlane({
  view,
  viewKey,
  size,
  scale,
  highlight,
  rect,
  hiWindow = FULL,
}: TensorPlaneProps) {
  const theme = vizTheme();
  const material = useMemo(() => createPlaneMaterial(theme), [theme]);
  useEffect(() => () => material.dispose(), [material]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 纹理只随 viewKey 变（view 每次渲染都是新对象）
  const texture = useMemo(() => buildTexture(view), [viewKey]);
  useEffect(() => () => texture.tex.dispose(), [texture]);

  // 换步：一次性重写 uniform，播放期不再动
  useLayoutEffect(() => {
    const u = material.uniforms;
    u.uTex.value = texture.tex;
    u.uTexSize.value.set(texture.cols, texture.rows);
    u.uCells.value.set(view.cols, view.rows);
    u.uScale.value = scale;
    u.uExact.value = texture.exact ? 1 : 0;
    const rows = (highlight?.rows ?? []).slice(0, MAX_HIGHLIGHT);
    const cols = (highlight?.cols ?? []).slice(0, MAX_HIGHLIGHT);
    u.uHiRowCount.value = rows.length;
    u.uHiColCount.value = cols.length;
    for (let i = 0; i < MAX_HIGHLIGHT; i++) {
      u.uHiRows.value[i] = rows[i] ?? -1;
      u.uHiCols.value[i] = cols[i] ?? -1;
    }
    if (rect) {
      const [u0, v0, u1, v1] = rectUv(rect, view);
      u.uRect.value.set(u0, v0, u1, v1);
    } else {
      u.uRect.value.set(0, 0, 0, 0);
    }
  }, [material, texture, view, scale, highlight, rect]);

  useFrame(() => {
    material.uniforms.uHiT.value = phase(progress.t, hiWindow);
  });

  // 其余头：后面一摞薄片，只表达数量
  const ghosts = Math.max(0, Math.min(view.heads - 1, MAX_GHOST_HEADS));
  const ghostRef = useRef<InstancedMesh>(null);
  const ghostColor = useMemo(() => new Color(theme.line), [theme]);
  useLayoutEffect(() => {
    const m = ghostRef.current;
    if (!m) return;
    for (let i = 0; i < ghosts; i++) {
      ghostMatrix.makeScale(0.78, 0.78, 1);
      ghostMatrix.setPosition(0, 0, -GHOST_GAP * (i + 1));
      m.setMatrixAt(i, ghostMatrix);
    }
    m.count = ghosts;
    m.instanceMatrix.needsUpdate = true;
  }, [ghosts]);

  return (
    <group>
      {ghosts > 0 && (
        <instancedMesh ref={ghostRef} args={[undefined, undefined, MAX_GHOST_HEADS]} frustumCulled={false}>
          <planeGeometry args={[size.w, size.h]} />
          <meshBasicMaterial color={ghostColor} toneMapped={false} />
        </instancedMesh>
      )}
      <mesh>
        <planeGeometry args={[size.w, size.h]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
});
