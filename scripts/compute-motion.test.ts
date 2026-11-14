import { Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { cellSurfacePoint, pointAlongComputePath } from "../src/app/wiki/scene-compute-motion";

describe("calculation connectors follow the moving geometry", () => {
  it("attaches to a real face throughout a rotated block's move and collapse", () => {
    const cell = new Object3D();
    cell.rotation.set(Math.PI / 2, 0.28, 0);
    for (let i = 0; i <= 20; i++) {
      cell.position.set(i / 10, -i / 5, 1);
      cell.scale.set(2 - i / 20, 0.5 + i / 20, 0.4);
      const target = new Vector3(-3, 4, 2);
      const end = cellSurfacePoint(cell, target);
      cell.updateMatrixWorld(true);
      const local = cell.worldToLocal(end.clone());
      expect(Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z))).toBeCloseTo(0.5);
      expect(
        end.clone().sub(cell.position).normalize().dot(target.sub(cell.position).normalize()),
      ).toBeCloseTo(1);
    }
  });
  it("moves uniformly through a route even when its middle segment has zero length", () => {
    const route = [new Vector3(0, 4, 0), new Vector3(0, 2, 0), new Vector3(0, 2, 0), new Vector3(0, 0, 0)];
    for (const progress of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1])
      expect(pointAlongComputePath(route, progress).y).toBeCloseTo(4 * (1 - progress));
    expect(pointAlongComputePath([route[0]!, route[0]!], 0.5)).toEqual(route[0]);
  });
  it("traces the full bent line without cutting across its corners", () => {
    const route = [new Vector3(0, 4, 0), new Vector3(0, 2, 0), new Vector3(4, 2, 0), new Vector3(4, 0, 0)];
    expect(pointAlongComputePath(route, 0.5)).toEqual(new Vector3(2, 2, 0));
    expect(pointAlongComputePath(route, 1)).toEqual(route.at(-1));
  });
});
