import { BufferGeometry, Line, Vector3 } from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { expect, it } from "vitest";
import { setPolylinePoints, setWidePolylinePoints } from "../src/app/wiki/scene-polyline";

it("preserves every bend and the receiver when a two-point line becomes a longer route", () => {
  const line = new Line(new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]));
  const route = [new Vector3(1, 2, 3), new Vector3(4, 2, 3), new Vector3(4, -2, 3), new Vector3(7, -2, 3)];
  setPolylinePoints(line, route);
  const positions = line.geometry.getAttribute("position");
  expect(positions.count).toBe(4);
  expect(new Vector3().fromBufferAttribute(positions, 3)).toEqual(route[3]);
  expect(line.geometry.getAttribute("lineDistance").getX(3)).toBe(10);
  route[3]!.x = 8;
  setPolylinePoints(line, route);
  expect(line.geometry.getAttribute("position")).toBe(positions);
  const bounds = line.geometry.boundingSphere!;
  expect(bounds.center.distanceTo(route[3]!)).toBeCloseTo(bounds.radius, 8);
  line.geometry.dispose();
});

it("wide routes retain bends, endpoints and dash distances without reallocating each frame", () => {
  const line = new Line2(new LineGeometry().setPositions([0, 0, 0, 0, 0, 0]));
  const route = [new Vector3(1, 2, 3), new Vector3(4, 2, 3), new Vector3(4, -2, 3), new Vector3(7, -2, 3)];
  setWidePolylinePoints(line, route);
  const starts = line.geometry.getAttribute("instanceStart"),
    ends = line.geometry.getAttribute("instanceEnd");
  const distances = line.geometry.getAttribute("instanceDistanceEnd");
  expect(starts.count).toBe(3);
  for (let i = 0; i < 3; i++) {
    expect(new Vector3().fromBufferAttribute(starts, i)).toEqual(route[i]);
    expect(new Vector3().fromBufferAttribute(ends, i)).toEqual(route[i + 1]);
  }
  expect(distances.getX(2)).toBe(10);
  route[3]!.x = 8;
  setWidePolylinePoints(line, route);
  expect(line.geometry.getAttribute("instanceStart")).toBe(starts);
  expect(line.geometry.getAttribute("instanceDistanceEnd")).toBe(distances);
  expect(new Vector3().fromBufferAttribute(ends, 2)).toEqual(route[3]);
  expect(distances.getX(2)).toBe(11);
  expect(line.geometry.boundingBox!.containsPoint(route[3]!)).toBe(true);
  setWidePolylinePoints(line, route.slice(0, 2));
  expect(line.geometry.instanceCount).toBe(1);
  expect(line.geometry.getAttribute("instanceDistanceEnd").getX(0)).toBe(3);
  line.geometry.dispose();
  line.material.dispose();
});
