/**
 * 整模型结构场景：白纸上的一个物体。块 = 身份色淡填充 + 同色实线边；标签平放在块前方。
 * 不逐值着色，不画粒子，不画流程箭头；所有尺寸来自 layout.ts。
 */
import { Edges, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useMemo, useRef } from "react";
import type { Color, Group, Mesh, Object3D, Vector3 } from "three";
import { Label } from "../labels/Label";
import { type VizColorName, vizTheme } from "../theme";
import { type Box3Like, framePose, type Pose, viewDir } from "./frame";
import type { Block, BlockKind, ModelLayout } from "./layout";

const FILL: Record<BlockKind, VizColorName> = {
  act: "tokenSoft",
  weight: "weightSoft",
  kv: "kvSoft",
  scores: "tokenSoft",
  norm: "weightSoft",
};
const EDGE: Record<BlockKind, VizColorName> = {
  act: "token",
  weight: "weight",
  kv: "kv",
  scores: "token",
  norm: "weight",
};

/** 标签字号（世界单位）：组名 / 块名 / 形状 */
export const MODEL_LABEL = { group: 0.9, name: 0.55, shape: 0.4 } as const;
/** 侧面 = 顶面淡色往身份色靠 35%，不用灯光也有体积感，颜色与 token 精确一致 */
const SIDE_MIX = 0.35;

function PaperBox({
  w,
  h,
  d,
  top,
  edge,
  edges = true,
  sideMix = SIDE_MIX,
}: {
  w: number;
  h: number;
  d: number;
  top: Color;
  edge: Color;
  edges?: boolean;
  sideMix?: number;
}) {
  const side = useMemo(() => top.clone().lerp(edge, sideMix), [top, edge, sideMix]);
  const sideHex = side.getHex();
  const topHex = top.getHex();
  return (
    <>
      <boxGeometry args={[w, h, d]} />
      {/* 顺序：+x −x +y −y +z −z */}
      <meshBasicMaterial attach="material-0" color={sideHex} toneMapped={false} />
      <meshBasicMaterial attach="material-1" color={sideHex} toneMapped={false} />
      <meshBasicMaterial attach="material-2" color={topHex} toneMapped={false} />
      <meshBasicMaterial attach="material-3" color={sideHex} toneMapped={false} />
      <meshBasicMaterial attach="material-4" color={sideHex} toneMapped={false} />
      <meshBasicMaterial attach="material-5" color={sideHex} toneMapped={false} />
      {edges && <Edges color={edge.getHex()} threshold={15} />}
    </>
  );
}
const LABEL_GAP = 0.18;
/** 视线：仰角 27°、偏左 30°，看向 −z（数据流向远处）；斜着看，全览才能用满画布对角线 */
export const MODEL_VIEW_DIR = viewDir(27, -30);

/**
 * 标签按屏幕字号隐藏：投影后不足 LABEL_MIN_PX 像素的字不画（远处的字只会变成噪点）。
 * 每帧只改 visible，不经过 React。
 */
interface LodEntry {
  obj: Object3D;
  /** 世界单位字号 */
  fontSize: number;
}
const LodContext = createContext<(obj: Object3D | null, fontSize: number) => void>(() => {});
/** 屏幕上小于这个像素高度的标签不显示 */
export const LABEL_MIN_PX = 9;

function useLod(fontSize: number) {
  const register = useContext(LodContext);
  return (m: Mesh | null) => register(m, fontSize);
}
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

export function shapeText(b: Block): string {
  const s = b.shape.join(" × ");
  return b.truncated ? `${s}（截断）` : s;
}

function BlockMesh({
  block,
  hovered,
  onHover,
}: {
  block: Block;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const theme = vizTheme();
  const ref = useRef<Mesh>(null);
  const lodName = useLod(MODEL_LABEL.name);
  const lodShape = useLod(MODEL_LABEL.shape);
  const right = block.labelSide === "right";
  /* 右侧标签：贴块的 +x 边、与块的 z 中心对齐，两行沿 +z（屏幕向下）排；前方标签：贴块的 +z 边居中 */
  const lx = right ? block.x + block.w / 2 + LABEL_GAP : block.x;
  const lz = right ? block.z - MODEL_LABEL.name * 0.6 : block.z + block.d / 2 + LABEL_GAP;
  return (
    <group>
      <mesh
        ref={ref}
        position={[block.x, block.h / 2, block.z]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(block.id);
        }}
        onPointerOut={() => onHover(null)}
      >
        <PaperBox
          w={block.w}
          h={block.h}
          d={block.d}
          top={theme[FILL[block.kind]]}
          edge={hovered ? theme.accent : theme[EDGE[block.kind]]}
        />
      </mesh>
      <Label
        id={`${block.id}.name`}
        position={[lx, 0.002, lz]}
        rotation={FLAT}
        size={MODEL_LABEL.name}
        anchorX={right ? "left" : "center"}
        anchorY="top"
        color={hovered ? "accent" : "ink"}
        outline={false}
        objRef={lodName}
      >
        {block.name}
      </Label>
      <Label
        id={`${block.id}.shape`}
        position={[lx, 0.002, lz + MODEL_LABEL.name * 1.2]}
        rotation={FLAT}
        size={MODEL_LABEL.shape}
        anchorX={right ? "left" : "center"}
        anchorY="top"
        color="inkMuted"
        mono
        outline={false}
        objRef={lodShape}
      >
        {shapeText(block)}
      </Label>
    </group>
  );
}

function Deck({ layout }: { layout: ModelLayout }) {
  const theme = vizTheme();
  const lodName = useLod(MODEL_LABEL.name);
  const deck = layout.deck;
  if (!deck) return null;
  const cards = Array.from({ length: deck.count }, (_, i) => deck.z0 - deck.pitch * i);
  return (
    <group>
      {cards.map((z) => (
        <mesh key={z} position={[deck.x, deck.h / 2, z]}>
          <PaperBox
            w={deck.w}
            h={deck.h}
            d={deck.d}
            top={theme.weightSoft}
            edge={theme.weight}
            edges={false}
            sideMix={0.16}
          />
        </mesh>
      ))}
      <Label
        id="deck.label"
        position={[deck.x + deck.w / 2 + LABEL_GAP, 0.002, deck.z0 - MODEL_LABEL.name * 0.6]}
        rotation={FLAT}
        size={MODEL_LABEL.name}
        anchorX="left"
        anchorY="top"
        color="ink"
        outline={false}
        objRef={lodName}
      >
        {deck.label}
      </Label>
    </group>
  );
}

function GroupUnderlays({ layout }: { layout: ModelLayout }) {
  const theme = vizTheme();
  const pad = 0.5;
  const xMin = layout.bounds.minX - pad;
  const xMax = layout.bounds.maxX + pad;
  return (
    <group>
      {layout.groups.map((g) => {
        const d = g.maxZ - g.minZ + pad * 2;
        const z = (g.minZ + g.maxZ) / 2;
        return (
          <group key={g.id}>
            <mesh position={[(xMin + xMax) / 2, -0.01, z]} rotation={FLAT}>
              <planeGeometry args={[xMax - xMin, d]} />
              <meshBasicMaterial color={theme.surface.getHex()} toneMapped={false} />
            </mesh>
            {/* 组名：底板左前角 */}
            <Label
              id={`group.${g.id}`}
              position={[xMin + 0.2, 0.003, g.maxZ + pad - 0.15]}
              rotation={FLAT}
              size={MODEL_LABEL.group}
              anchorX="left"
              anchorY="bottom"
              color="ink"
              outline={false}
            >
              {g.name}
            </Label>
          </group>
        );
      })}
    </group>
  );
}

/** 相机飞到能装下 focus 的位姿（600 ms 缓动），飞完把控制权交回 OrbitControls；取景用画布真实宽高比 */
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
      dir: MODEL_VIEW_DIR,
      margin: 1.04,
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
    const lerp = (i: number, f: [number, number, number], t: [number, number, number]) =>
      f[i]! + (t[i]! - f[i]!) * e;
    camera.position.set(
      lerp(0, a.from.position, a.to.position),
      lerp(1, a.from.position, a.to.position),
      lerp(2, a.from.position, a.to.position),
    );
    if (controls) {
      controls.target.set(
        lerp(0, a.from.target, a.to.target),
        lerp(1, a.from.target, a.to.target),
        lerp(2, a.from.target, a.to.target),
      );
      controls.update();
    } else camera.lookAt(a.to.target[0], a.to.target[1], a.to.target[2]);
    if (k >= 1) anim.current = null;
  });
  return null;
}

export interface ModelSceneProps {
  layout: ModelLayout;
  hovered: string | null;
  onHover: (id: string | null) => void;
  /** 要装进画面的包围盒；换了就飞过去 */
  focus: Box3Like;
}

export function ModelScene({ layout, hovered, onHover, focus }: ModelSceneProps) {
  const root = useRef<Group>(null);
  const blocks = useMemo(() => layout.blocks, [layout]);
  const lod = useRef<LodEntry[]>([]);
  const register = useMemo(
    () => (obj: Object3D | null, fontSize: number) => {
      if (!obj) return;
      const list = lod.current;
      const i = list.findIndex((e) => e.obj === obj);
      if (i < 0) list.push({ obj, fontSize });
      else list[i]!.fontSize = fontSize;
    },
    [],
  );
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useFrame(() => {
    const cp = camera.position;
    const fov = "fov" in camera ? (camera.fov as number) : 22;
    /* 每世界单位在屏幕上的像素数 = 画布高 / (2·距离·tan(fov/2)) */
    const k = size.height / (2 * Math.tan((fov * Math.PI) / 360));
    for (const e of lod.current) {
      if (!e.obj.parent) continue;
      e.obj.visible = (e.fontSize * k) / cp.distanceTo(e.obj.position) >= LABEL_MIN_PX;
    }
  });
  return (
    <LodContext.Provider value={register}>
      <group ref={root}>
        <GroupUnderlays layout={layout} />
        {blocks.map((b) => (
          <BlockMesh key={b.id} block={b} hovered={hovered === b.id} onHover={onHover} />
        ))}
        <Deck layout={layout} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2 - 0.05} />
        <CameraFly focus={focus} />
      </group>
    </LodContext.Provider>
  );
}
