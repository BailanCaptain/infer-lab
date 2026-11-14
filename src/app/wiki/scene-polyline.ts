import { Float32BufferAttribute, type Line, type Vector3 } from "three";
import type { Line2 } from "three/addons/lines/Line2.js";

/** setFromPoints cannot grow an existing position buffer. Keep every bend and the receiving endpoint. */
export function setPolylinePoints(line: Line, points: Vector3[]) {
  const geometry = line.geometry;
  if (geometry.getAttribute("position")?.count !== points.length) {
    geometry.dispose();
    geometry.setAttribute("position", new Float32BufferAttribute(points.length * 3, 3));
  }
  geometry.setFromPoints(points);
  geometry.computeBoundingSphere();
  line.computeLineDistances();
}

/** Screen-width lines use segment buffers; reuse them while endpoints move. */
export function setWidePolylinePoints(line: Line2, points: Vector3[]) {
  const geometry = line.geometry;
  if (
    geometry.getAttribute("instanceStart")?.count !== points.length - 1 ||
    !geometry.getAttribute("instanceDistanceStart")
  ) {
    geometry.dispose();
    geometry.setPositions(points.flatMap((point) => point.toArray()));
    line.computeLineDistances();
    return;
  }
  const starts = geometry.getAttribute("instanceStart"),
    ends = geometry.getAttribute("instanceEnd");
  const distanceStarts = geometry.getAttribute("instanceDistanceStart"),
    distanceEnds = geometry.getAttribute("instanceDistanceEnd");
  let distance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!,
      b = points[i + 1]!;
    starts.setXYZ(i, a.x, a.y, a.z);
    ends.setXYZ(i, b.x, b.y, b.z);
    distanceStarts.setX(i, distance);
    distance += a.distanceTo(b);
    distanceEnds.setX(i, distance);
  }
  starts.needsUpdate = ends.needsUpdate = distanceStarts.needsUpdate = distanceEnds.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
