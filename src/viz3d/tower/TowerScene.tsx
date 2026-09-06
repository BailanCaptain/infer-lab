/**
 * "塔"场景（当前只有第 0 层注意力块）：格子墙正面朝相机，自下而上流动；头切片沿 z 叠进去。
 * 标签立在每块的左侧（与格子同一平面，面向 +z），字号随块的体量。
 */
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh, Object3D, Vector3 } from "three";
import { Label } from "../labels/Label";
import { type Box3Like, framePose, type Pose, viewDir } from "../model/frame";
import type { AttentionLayout, Volume } from "./attentionLayout";
import { CellVolume } from "./CellVolume";

/** 视线：略高于水平、从右前方看，才能看见叠片的厚度 */
export const TOWER_VIEW_DIR = viewDir(14, 28);
/** 标签字号（世界单位 = 元素）：块越高字越大，夹在 [16, 90]；小块（6 行）的字不能比块本身大太多 */
export function labelSize(v: Volume): number {
  return Math.min(90, Math.max(16, v.h * 0.06 + 12));
}
export const LABEL_MIN_PX = 9;

export function shapeText(v: Volume): string {
  const s = v.shape.join(" × ");
  return v.merge > 1 ? `${s} · 一格 = ${v.merge}×${v.merge}` : s;
}

function VolumeLabels({
  volume,
  hovered,
  register,
}: {
  volume: Volume;
  hovered: boolean;
  register: (m: Mesh | null, size: number) => void;
}) {
  const size = labelSize(volume);
  const x = volume.x - 40;
  const yTop = volume.y + volume.h;
  return (
    <>
      <Label
        id={`${volume.id}.name`}
        position={[x, yTop, volume.z + 1]}
        size={size}
        anchorX="right"
        anchorY="top"
        color={hovered ? "accent" : "ink"}
        outline={false}
        objRef={(m) => register(m, size)}
      >
        {volume.name}
      </Label>
      <Label
        id={`${volume.id}.shape`}
        position={[x, yTop - size * 1.25, volume.z + 1]}
        size={size * 0.72}
        anchorX="right"
        anchorY="top"
        color="inkMuted"
        mono
        outline={false}
        objRef={(m) => register(m, size * 0.72)}
      >
        {shapeText(volume)}
      </Label>
    </>
  );
}

interface LodEntry {
  obj: Object3D;
  fontSize: number;
}

function CameraFly({ focus }: { focus: Box3Like }) {
  const controls = useThree((s) => s.controls) as { target: Vector3; update(): void } | null;
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const anim = useRef<{ from: Pose; to: Pose; t0: number } | null>(null);
  const last = useRef<Box3Like | null>(null);
  if (focus !== last.current) {
    last.current = focus;
    const fov = "fov" in camera ? (camera.fov as number) : 22;
    const to = framePose(focus, {
      fovDeg: fov,
      aspect: size.width / size.height,
      dir: TOWER_VIEW_DIR,
      margin: 1.06,
    });
    const target = controls?.target;
    anim.current = {
      from: {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: target ? [target.x, target.y, target.z] : to.target,
      },
      to,
      t0: performance.now(),
    };
  }
  useFrame(() => {
    const a = anim.current;
    if (!a) return;
    const k = Math.min(1, (performance.now() - a.t0) / 600);
    const e = 1 - (1 - k) ** 3;
    const L = (i: number, f: [number, number, number], t: [number, number, number]) =>
      f[i]! + (t[i]! - f[i]!) * e;
    camera.position.set(
      L(0, a.from.position, a.to.position),
      L(1, a.from.position, a.to.position),
      L(2, a.from.position, a.to.position),
    );
    if (controls) {
      controls.target.set(
        L(0, a.from.target, a.to.target),
        L(1, a.from.target, a.to.target),
        L(2, a.from.target, a.to.target),
      );
      controls.update();
    } else camera.lookAt(a.to.target[0], a.to.target[1], a.to.target[2]);
    if (k >= 1) anim.current = null;
  });
  return null;
}

export interface TowerSceneProps {
  layout: AttentionLayout;
  hovered: string | null;
  onHover: (id: string | null) => void;
  focus: Box3Like;
}

export function TowerScene({ layout, hovered, onHover, focus }: TowerSceneProps) {
  const lod = useRef<LodEntry[]>([]);
  const register = (obj: Mesh | null, fontSize: number) => {
    if (!obj) return;
    const list = lod.current;
    const i = list.findIndex((e) => e.obj === obj);
    if (i < 0) list.push({ obj, fontSize });
    else list[i]!.fontSize = fontSize;
  };
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useFrame(() => {
    const fov = "fov" in camera ? (camera.fov as number) : 22;
    const k = size.height / (2 * Math.tan((fov * Math.PI) / 360));
    for (const e of lod.current) {
      if (!e.obj.parent) continue;
      e.obj.visible = (e.fontSize * k) / camera.position.distanceTo(e.obj.position) >= LABEL_MIN_PX;
    }
  });
  return (
    <group>
      {/* 灯光只为让方块的侧面比正面暗一点，颜色本身来自实例色 */}
      <ambientLight intensity={2.6} />
      <directionalLight position={[-0.4, 1, 1]} intensity={1.4} />
      {layout.volumes.map((v) => (
        <CellVolume key={v.id} volume={v} onHover={onHover} />
      ))}
      {layout.volumes.map((v) => (
        <VolumeLabels key={`${v.id}.labels`} volume={v} hovered={hovered === v.id} register={register} />
      ))}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
      <CameraFly focus={focus} />
    </group>
  );
}
