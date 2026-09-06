/**
 * 相机取景：给定包围盒与视线方向，算出能把 8 个角全部装进视锥的最近相机位置（纯函数）。
 */
export interface Box3Like {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface Pose {
  position: [number, number, number];
  target: [number, number, number];
}

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** 视线方向：仰角 elev（度，0 = 平视，90 = 正俯视）、方位 azim（度，0 = 正前方 +z，正值往右） */
export function viewDir(elevDeg: number, azimDeg: number): V3 {
  const e = (elevDeg * Math.PI) / 180;
  const a = (azimDeg * Math.PI) / 180;
  return norm([Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)]);
}

/**
 * 相机从 target 沿 dir 后退到能装下整个盒子的距离。
 * margin > 1 留边（1.1 = 四周留 10%）。
 */
export function framePose(
  box: Box3Like,
  opts: { fovDeg: number; aspect: number; dir: V3; margin?: number; target?: V3 },
): Pose {
  const target: V3 = opts.target ?? [
    (box.minX + box.maxX) / 2,
    (box.minY + box.maxY) / 2,
    (box.minZ + box.maxZ) / 2,
  ];
  const dir = norm(opts.dir);
  const up: V3 = [0, 1, 0];
  const right = norm(cross(up, dir));
  const camUp = cross(dir, right);
  const tanV = Math.tan(((opts.fovDeg / 2) * Math.PI) / 180);
  const tanH = tanV * opts.aspect;
  const m = opts.margin ?? 1.1;
  let dist = 0;
  for (const x of [box.minX, box.maxX])
    for (const y of [box.minY, box.maxY])
      for (const z of [box.minZ, box.maxZ]) {
        const p = sub([x, y, z], target);
        const px = dot(p, right);
        const py = dot(p, camUp);
        const pz = dot(p, dir);
        dist = Math.max(dist, (Math.abs(px) * m) / tanH + pz, (Math.abs(py) * m) / tanV + pz);
      }
  return {
    position: [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist],
    target,
  };
}
