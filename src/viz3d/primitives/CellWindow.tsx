/**
 * 放大窗口：把张量的一小块（高亮所在区域）画成实体格子，叠在全幅平面上方。
 * - 一个 InstancedMesh 装下全部格子，容量固定，换步只重写属性缓冲（目标 < 2 ms）；
 * - 每个实例带 from/to 两组值与高亮，uT 在 useFrame 里写，插值发生在 GPU；
 * - 格子够大时在格上标真实数值。
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedBufferAttribute, InstancedMesh } from "three";
import { Matrix4 } from "three";
import type { PlaneView } from "../../sim/timeline/plane";
import type { Highlight } from "../../sim/timeline/types";
import { progress } from "../../timeline";
import { Label } from "../labels/Label";
import { createCellMaterial, DIM_SCALE } from "../materials/cellMaterial";
import { fmtCell, type Rect } from "../scale";
import { vizTheme } from "../theme";
import { phase, type RevealRef } from "./TensorPlane";

/** 实例容量：Spike B 要求 5k 格子仍然 60fps */
export const MAX_WINDOW_CELLS = 5120;
/** 小于这个格边长就不标数值（会互相挤到一起） */
export const VALUE_MIN_CELL = 0.34;
/** 标数值的格数上限 */
export const VALUE_MAX_CELLS = 64;

export interface CellWindowProps {
  view: PlaneView;
  /** 形状相同的上一步视图；不同则不插值 */
  prevView?: PlaneView | null | undefined;
  rect: Rect;
  scale: number;
  highlight?: Highlight | undefined;
  prevHighlight?: Highlight | undefined;
  cellSize: number;
  showValues: boolean;
  /** 格值文案，默认 fmtCell */
  format?: ((v: number) => string) | undefined;
  /** 高亮渐入区间（progress.t） */
  hiWindow?: [number, number] | undefined;
  /** 逐格揭示（瞬态，每帧读） */
  reveal?: RevealRef | undefined;
  /** 换步重写缓冲的耗时（ms） */
  onCost?: ((ms: number) => void) | undefined;
  labelKey?: string | undefined;
}

function hiTest(h: Highlight | undefined): ((r: number, c: number) => number) | null {
  const rows = new Set(h?.rows ?? []);
  const cols = new Set(h?.cols ?? []);
  const cells = new Set((h?.cells ?? []).map(([r, c]) => `${r},${c}`));
  if (!rows.size && !cols.size && !cells.size) return null;
  return (r, c) => (rows.has(r) || cols.has(c) || cells.has(`${r},${c}`) ? 1 : 0);
}

const mat = new Matrix4();
const FULL: [number, number] = [0, 1];

export function CellWindow({
  view,
  prevView,
  rect,
  scale,
  highlight,
  prevHighlight,
  cellSize,
  showValues,
  format = fmtCell,
  hiWindow = FULL,
  reveal,
  onCost,
  labelKey = "win",
}: CellWindowProps) {
  const theme = vizTheme();
  const material = useMemo(() => createCellMaterial(theme), [theme]);
  useEffect(() => () => material.dispose(), [material]);

  const attrs = useMemo(
    () => ({
      aVal0: new Float32Array(MAX_WINDOW_CELLS),
      aVal1: new Float32Array(MAX_WINDOW_CELLS),
      aHi0: new Float32Array(MAX_WINDOW_CELLS),
      aHi1: new Float32Array(MAX_WINDOW_CELLS),
      aRow: new Float32Array(MAX_WINDOW_CELLS),
      aCol: new Float32Array(MAX_WINDOW_CELLS),
    }),
    [],
  );
  const mesh = useRef<InstancedMesh>(null);
  const aVal0 = useRef<InstancedBufferAttribute>(null);
  const aVal1 = useRef<InstancedBufferAttribute>(null);
  const aHi0 = useRef<InstancedBufferAttribute>(null);
  const aHi1 = useRef<InstancedBufferAttribute>(null);
  const aRowRef = useRef<InstancedBufferAttribute>(null);
  const aColRef = useRef<InstancedBufferAttribute>(null);
  // 回调放进 ref：换步重写只应由数据变化触发，不被父组件的函数身份带着重跑
  const costRef = useRef(onCost);
  costRef.current = onCost;

  const count = Math.min(rect.rows * rect.cols, MAX_WINDOW_CELLS);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const t0 = performance.now();
    const hiNow = hiTest(highlight) ?? (() => 0);
    const hiPrev = hiTest(prevHighlight) ?? (() => 0);
    // 本步没有任何焦点时不整体缩小，否则"全部变小"会被误读成"全部不重要"
    material.uniforms.uDimScale.value = hiTest(highlight) ? DIM_SCALE : 1;
    const sameShape = !!prevView && prevView.rows === view.rows && prevView.cols === view.cols;
    const x0 = -((rect.cols - 1) / 2) * cellSize;
    const y0 = ((rect.rows - 1) / 2) * cellSize;
    let i = 0;
    for (let r = 0; r < rect.rows && i < MAX_WINDOW_CELLS; r++) {
      const rr = rect.r0 + r;
      for (let c = 0; c < rect.cols && i < MAX_WINDOW_CELLS; c++) {
        const cc = rect.c0 + c;
        mat.identity();
        mat.setPosition(x0 + c * cellSize, y0 - r * cellSize, 0);
        m.setMatrixAt(i, mat);
        const v1 = view.at(rr, cc);
        attrs.aVal1[i] = v1;
        attrs.aVal0[i] = sameShape && prevView ? prevView.at(rr, cc) : v1;
        attrs.aHi1[i] = hiNow(rr, cc);
        attrs.aHi0[i] = sameShape ? hiPrev(rr, cc) : 0;
        attrs.aRow[i] = rr;
        attrs.aCol[i] = cc;
        i++;
      }
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
    for (const a of [
      aVal0.current,
      aVal1.current,
      aHi0.current,
      aHi1.current,
      aRowRef.current,
      aColRef.current,
    ]) {
      if (a) a.needsUpdate = true;
    }
    material.uniforms.uScale.value = scale;
    costRef.current?.(performance.now() - t0);
  }, [view, prevView, rect, highlight, prevHighlight, cellSize, scale, attrs, material]);

  useFrame(() => {
    material.uniforms.uT.value = phase(progress.t, hiWindow);
    material.uniforms.uRevealRow.value = reveal ? reveal.row : -1;
    material.uniforms.uRevealCol.value = reveal ? reveal.fraction * view.cols : 1e9;
  });

  const cell = cellSize * 0.86;
  const values =
    showValues && cellSize >= VALUE_MIN_CELL && count <= VALUE_MAX_CELLS
      ? Array.from({ length: count }, (_, i) => {
          const r = Math.floor(i / rect.cols);
          const c = i % rect.cols;
          return {
            key: `${rect.r0 + r},${rect.c0 + c}`,
            x: -((rect.cols - 1) / 2) * cellSize + c * cellSize,
            y: ((rect.rows - 1) / 2) * cellSize - r * cellSize,
            text: format(view.at(rect.r0 + r, rect.c0 + c)),
          };
        })
      : [];

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, MAX_WINDOW_CELLS]} frustumCulled={false}>
        <boxGeometry args={[cell, cell, cellSize * 0.55]}>
          <instancedBufferAttribute ref={aVal0} attach="attributes-aVal0" args={[attrs.aVal0, 1]} />
          <instancedBufferAttribute ref={aVal1} attach="attributes-aVal1" args={[attrs.aVal1, 1]} />
          <instancedBufferAttribute ref={aHi0} attach="attributes-aHi0" args={[attrs.aHi0, 1]} />
          <instancedBufferAttribute ref={aHi1} attach="attributes-aHi1" args={[attrs.aHi1, 1]} />
          <instancedBufferAttribute ref={aRowRef} attach="attributes-aRow" args={[attrs.aRow, 1]} />
          <instancedBufferAttribute ref={aColRef} attach="attributes-aCol" args={[attrs.aCol, 1]} />
        </boxGeometry>
        <primitive object={material} attach="material" />
      </instancedMesh>
      {values.map((v) => (
        <Label
          key={v.key}
          id={`${labelKey}.cell.${v.key}`}
          position={[v.x, v.y, cellSize * 0.4]}
          size={cellSize * 0.3}
          color="ink"
          mono
        >
          {v.text}
        </Label>
      ))}
    </group>
  );
}
