import { describe, expect, it } from "vitest";
import { framePose, viewDir } from "./frame";

describe("相机取景", () => {
  const box = { minX: -20, maxX: 20, minY: 0, maxY: 2, minZ: -6, maxZ: 6 };

  it("8 个角都落在视锥内（宽盒子由水平视角决定距离）", () => {
    const fov = 22;
    const aspect = 16 / 10;
    const pose = framePose(box, { fovDeg: fov, aspect, dir: viewDir(50, 0), margin: 1 });
    const [cx, cy, cz] = pose.position;
    const [tx, ty, tz] = pose.target;
    const dir = [cx - tx, cy - ty, cz - tz] as const;
    const dist = Math.hypot(...dir);
    const d = [dir[0] / dist, dir[1] / dist, dir[2] / dist] as const;
    const right = [d[2], 0, -d[0]] as const; // up × dir 归一化后（up=(0,1,0)）
    const rl = Math.hypot(...right);
    const r = [right[0] / rl, right[1] / rl, right[2] / rl] as const;
    const u = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]] as const;
    const tanV = Math.tan(((fov / 2) * Math.PI) / 180);
    const tanH = tanV * aspect;
    let tight = 0;
    for (const x of [box.minX, box.maxX])
      for (const y of [box.minY, box.maxY])
        for (const z of [box.minZ, box.maxZ]) {
          const p = [x - tx, y - ty, z - tz] as const;
          const px = p[0] * r[0] + p[1] * r[1] + p[2] * r[2];
          const py = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
          const pz = p[0] * d[0] + p[1] * d[1] + p[2] * d[2];
          const depth = dist - pz;
          expect(Math.abs(px)).toBeLessThanOrEqual(depth * tanH + 1e-9);
          expect(Math.abs(py)).toBeLessThanOrEqual(depth * tanV + 1e-9);
          tight = Math.max(tight, Math.abs(px) / (depth * tanH), Math.abs(py) / (depth * tanV));
        }
    expect(tight).toBeCloseTo(1, 6);
  });

  it("留边系数放大距离，目标点是盒子中心", () => {
    const a = framePose(box, { fovDeg: 22, aspect: 1.6, dir: viewDir(50, 0), margin: 1 });
    const b = framePose(box, { fovDeg: 22, aspect: 1.6, dir: viewDir(50, 0), margin: 1.2 });
    const da = Math.hypot(a.position[0], a.position[1] - 1, a.position[2]);
    const db = Math.hypot(b.position[0], b.position[1] - 1, b.position[2]);
    expect(db).toBeGreaterThan(da);
    expect(a.target).toEqual([0, 1, 0]);
  });
});
