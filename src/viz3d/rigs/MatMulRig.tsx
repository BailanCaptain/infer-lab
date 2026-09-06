/**
 * MatMulRig：matmul 步的动效层，叠在 A / B / C 三个 TensorGrid 之上。
 * 每帧读 progress.t → matmulMotion(t) → 直接改实例矩阵与标签位置，不经过 React。
 * 数值全是真的：A[r,k]、B[k,c] 逐元素取，C[r,c] 是前向算出的值；K 只展示首 4 末 2 项，总和用真值。
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedBufferAttribute, InstancedMesh, Mesh } from "three";
import { Matrix4 } from "three";
import type { Highlight } from "../../sim/timeline/types";
import { progress } from "../../timeline";
import { Label } from "../labels/Label";
import { LABEL_SIZE } from "../labels/sizes";
import { createCellMaterial } from "../materials/cellMaterial";
import type { RevealRef } from "../primitives/TensorPlane";
import { fmtCell } from "../scale";
import type { SceneLayout, SlotSpec } from "../scenes/sceneLayout";
import { vizTheme } from "../theme";
import { type MatmulMotionInput, matmulMotion, sampleK, type Vec3 } from "./matmulMotion";

/** 舞台格边长（比放大窗口的格子大，数字要能读） */
const STAGE_CELL = 0.6;

export interface MatMulRigProps {
  layout: SceneLayout;
  /** C 的逐格揭示（瞬态 ref），由本组件每帧写，C 的 TensorGrid 读 */
  reveal: RevealRef;
  labelScale: number;
}

function slotOf(layout: SceneLayout, key: SlotSpec["key"]): SlotSpec | undefined {
  return layout.slots.find((s) => s.key === key);
}

/** 平面上 (row, col) 格中心在场景坐标里的位置 */
function cellWorld(slot: SlotSpec, row: number, col: number, z = 0.05): Vec3 {
  const { size } = slot.layout;
  const { rows, cols } = slot.view;
  return {
    x: slot.position[0] + ((col + 0.5) / cols - 0.5) * size.w,
    y: slot.position[1] + (0.5 - (row + 0.5) / rows) * size.h,
    z: slot.position[2] + z,
  };
}

function firstCell(h: Highlight | undefined): [number, number] {
  return h?.cells?.[0] ?? [h?.rows?.[0] ?? 0, h?.cols?.[0] ?? 0];
}

const mat = new Matrix4();

export function MatMulRig({ layout, reveal, labelScale }: MatMulRigProps) {
  const theme = vizTheme();
  const A = slotOf(layout, "a");
  const B = slotOf(layout, "b");
  const C = slotOf(layout, "out");

  const input = useMemo<MatmulMotionInput | null>(() => {
    if (!A || !B || !C) return null;
    const [r, c] = firstCell(C.highlight);
    const K = A.view.cols;
    const kIndex = sampleK(K);
    const cell = STAGE_CELL * Math.min(1.3, labelScale);
    // 舞台放在 A 上方、B 左侧的空档：x 对齐 A 的中心，y 对齐 B 的中心
    const stage: Vec3 = { x: A.position[0], y: B.position[1], z: 0.6 };
    return {
      kIndex,
      aRow: kIndex.map((k) => A.view.at(r, k)),
      bCol: kIndex.map((k) => B.view.at(k, c)),
      sum: C.view.at(r, c),
      K,
      aRowStart: cellWorld(A, r, Math.floor(K / 2)),
      bColStart: cellWorld(B, Math.floor(K / 2), c),
      stage,
      cTarget: cellWorld(C, r, c, 0.3),
      cell,
    };
  }, [A, B, C, labelScale]);

  const material = useMemo(() => createCellMaterial(theme), [theme]);
  useEffect(() => () => material.dispose(), [material]);

  // 实例：A 行 n 个 + B 列 n 个 + 乘积 n 个 + 总和 1 个
  const n = input?.kIndex.length ?? 0;
  const count = n * 3 + 1;
  const attrs = useMemo(
    () => ({
      aVal0: new Float32Array(64),
      aVal1: new Float32Array(64),
      aHi0: new Float32Array(64),
      aHi1: new Float32Array(64),
      aRow: new Float32Array(64),
      aCol: new Float32Array(64),
    }),
    [],
  );
  const mesh = useRef<InstancedMesh>(null);
  const valAttr = useRef<InstancedBufferAttribute>(null);
  const valAttr1 = useRef<InstancedBufferAttribute>(null);
  const hiAttr = useRef<InstancedBufferAttribute>(null);
  const hiAttr1 = useRef<InstancedBufferAttribute>(null);

  useLayoutEffect(() => {
    if (!input || !mesh.current) return;
    const vals = [
      ...input.aRow,
      ...input.bCol,
      ...input.kIndex.map((_, i) => (input.aRow[i] ?? 0) * (input.bCol[i] ?? 0)),
      input.sum,
    ];
    vals.forEach((v, i) => {
      attrs.aVal0[i] = v;
      attrs.aVal1[i] = v;
      attrs.aHi0[i] = 1;
      attrs.aHi1[i] = 1;
      attrs.aRow[i] = -1;
      attrs.aCol[i] = -1;
    });
    for (const a of [valAttr.current, valAttr1.current, hiAttr.current, hiAttr1.current])
      if (a) a.needsUpdate = true;
    // 色阶按这一格的乘积范围定
    let scale = 1e-9;
    for (const v of vals) scale = Math.max(scale, Math.abs(v));
    material.uniforms.uScale.value = scale;
    material.uniforms.uDimScale.value = 1;
    mesh.current.count = count;
  }, [input, attrs, material, count]);

  // 标签引用：位置每帧跟着格子走
  const labels = useRef<(Mesh | null)[]>([]);
  const signs = useRef<(Mesh | null)[]>([]);
  const ellipsisRefs = useRef<(Mesh | null)[]>([]);

  useFrame(() => {
    const m = mesh.current;
    if (!input || !m) return;
    const mo = matmulMotion(progress.t, input);
    const cells = [...mo.a, ...mo.b, ...mo.products, mo.sum];
    const s = input.cell;
    cells.forEach((c, i) => {
      mat.makeScale(s * 0.94 * c.scale, s * 0.94 * c.scale, s * 0.3 * Math.max(c.scale, 1e-3));
      mat.setPosition(c.x, c.y, c.z);
      m.setMatrixAt(i, mat);
      const l = labels.current[i];
      if (l) {
        l.position.set(c.x, c.y, c.z + s * 0.2);
        l.scale.setScalar(Math.max(c.scale, 1e-3));
        l.visible = c.scale > 0.05;
      }
    });
    m.instanceMatrix.needsUpdate = true;
    // 乘号 / 等号：在 A 行与 B 列之间、总和旁
    const [times, eq] = signs.current;
    if (times) {
      const a0 = mo.a[0];
      times.visible = mo.phase === "multiply" || mo.phase === "collapse";
      if (a0)
        times.position.set(
          input.stage.x - ((mo.a.length + 1) / 2 + 0.4) * s,
          (a0.y + (mo.b[0]?.y ?? a0.y)) / 2,
          input.stage.z,
        );
    }
    if (eq) {
      eq.visible = mo.sum.scale > 0.05 && mo.phase !== "write";
      eq.position.set(mo.sum.x - s * 0.95, mo.sum.y, mo.sum.z + s * 0.2);
    }
    const ells = [mo.ellipsis.a, mo.ellipsis.b, mo.ellipsis.p];
    ellipsisRefs.current.forEach((e, i) => {
      const src = ells[i];
      if (!e || !src) return;
      e.position.set(src.x, src.y, src.z + s * 0.2);
      e.visible = src.scale > 0.05;
    });
    reveal.row = mo.written ? firstCell(C?.highlight)[0] : -1;
    reveal.fraction = mo.reveal;
  });

  if (!input) return null;
  const valueText = (v: number) => fmtCell(v);
  const cellVals = [
    ...input.aRow,
    ...input.bCol,
    ...input.kIndex.map((_, i) => (input.aRow[i] ?? 0) * (input.bCol[i] ?? 0)),
    input.sum,
  ];
  const size = Math.max(LABEL_SIZE.micro, input.cell * 0.27);
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, 64]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]}>
          <instancedBufferAttribute ref={valAttr} attach="attributes-aVal0" args={[attrs.aVal0, 1]} />
          <instancedBufferAttribute ref={valAttr1} attach="attributes-aVal1" args={[attrs.aVal1, 1]} />
          <instancedBufferAttribute ref={hiAttr} attach="attributes-aHi0" args={[attrs.aHi0, 1]} />
          <instancedBufferAttribute ref={hiAttr1} attach="attributes-aHi1" args={[attrs.aHi1, 1]} />
          <instancedBufferAttribute attach="attributes-aRow" args={[attrs.aRow, 1]} />
          <instancedBufferAttribute attach="attributes-aCol" args={[attrs.aCol, 1]} />
        </boxGeometry>
        <primitive object={material} attach="material" />
      </instancedMesh>
      {cellVals.map((v, i) => (
        <Label
          key={i < n * 3 ? `${["a", "b", "p"][Math.floor(i / n)]}${input.kIndex[i % n]}` : "sum"}
          size={size}
          color="ink"
          mono
          objRef={(m) => {
            labels.current[i] = m;
          }}
        >
          {valueText(v)}
        </Label>
      ))}
      <Label
        size={size * 1.3}
        color="inkMuted"
        mono
        objRef={(m) => {
          signs.current[0] = m;
        }}
      >
        ×
      </Label>
      <Label
        size={size * 1.3}
        color="inkMuted"
        mono
        objRef={(m) => {
          signs.current[1] = m;
        }}
      >
        =
      </Label>
      {["a", "b", "p"].map((k, i) => (
        <Label
          key={k}
          size={size * 1.3}
          color="inkMuted"
          objRef={(m) => {
            ellipsisRefs.current[i] = m;
          }}
        >
          ⋯
        </Label>
      ))}
    </group>
  );
}
