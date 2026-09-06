/**
 * 一个张量的格子体：每格是一个真实的小方块（InstancedMesh），格间留缝当格线，
 * 头张量的各切片沿 −z 叠进去。颜色 = 身份色淡底按数值向身份色（正）或灰（负）靠，对比压低。
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Object3D } from "three";
import { planeView } from "../../sim/timeline/plane";
import { MASK_SENTINEL } from "../scale";
import { type VizColorName, vizTheme } from "../theme";
import type { Volume, VolumeKind } from "./attentionLayout";
import { cellGrid } from "./cells";

const SOFT: Record<VolumeKind, VizColorName> = {
  act: "tokenSoft",
  weight: "weightSoft",
  kv: "kvSoft",
  scores: "tokenSoft",
};
const IDENT: Record<VolumeKind, VizColorName> = {
  act: "token",
  weight: "weight",
  kv: "kv",
  scores: "token",
};
/** 格间缝占格边的比例 */
export const CELL_GAP = 0.12;
/**
 * 数值对比压低：正值向身份色靠、负值向白靠，|v| = scale 时各到 VALUE_MIX_MAX。
 * 哈希权重按格上色天然是噪声，幅度小了就是"纹理"，大了就是"电视雪花"。
 */
const VALUE_MIX_MAX = 0.3;
const VALUE_MIX_MIN = 0.06;

const dummy = new Object3D();
const tmp = new Color();

export interface CellVolumeProps {
  volume: Volume;
  onHover?: ((id: string | null) => void) | undefined;
}

export function CellVolume({ volume, onHover }: CellVolumeProps) {
  const theme = vizTheme();
  const ref = useRef<InstancedMesh>(null);

  const grids = useMemo(
    () =>
      volume.slices.map((s) =>
        cellGrid(
          planeView(volume.record, { head: s.head >= 0 ? s.head : undefined, picks: s.picks }),
          volume.merge,
        ),
      ),
    [volume],
  );
  const count = grids.reduce((a, g) => a + g.values.length, 0);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const soft = theme[SOFT[volume.kind]];
    const ident = theme[IDENT[volume.kind]];
    const light = theme.canvas;
    const mask = theme.line;
    const size = volume.merge;
    const cell = size * (1 - CELL_GAP);
    let i = 0;
    grids.forEach((g, si) => {
      const z = volume.z - si * volume.slicePitch - volume.thickness / 2;
      const scale = g.scale.scale || 1;
      for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
          const v = g.values[r * g.cols + c] ?? 0;
          // 行 0 在上：y 从顶往下
          const cx = volume.x + (c + 0.5) * size;
          const cy = volume.y + volume.h - (r + 0.5) * size;
          dummy.position.set(cx, cy, z);
          dummy.scale.set(cell, cell, volume.thickness);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          if (Math.abs(v) >= MASK_SENTINEL) tmp.copy(mask);
          else {
            const t = Math.min(1, Math.abs(v) / scale);
            tmp.copy(soft).lerp(v >= 0 ? ident : light, VALUE_MIX_MIN + (VALUE_MIX_MAX - VALUE_MIX_MIN) * t);
          }
          mesh.setColorAt(i, tmp);
          i++;
        }
      }
    });
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [grids, volume, theme]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count]}
      frustumCulled
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover?.(volume.id);
      }}
      onPointerOut={() => onHover?.(null)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** 供测试/调试：一个格子体的实例总数 */
export function instanceCount(volume: Volume): number {
  return volume.slices.length * Math.ceil(volume.rows / volume.merge) * Math.ceil(volume.cols / volume.merge);
}
