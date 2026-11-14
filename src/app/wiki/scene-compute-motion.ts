import type { Object3D, Vector3 } from "three";

/** Unit-box face in the same parent coordinates as the target; respects rotation and live scale. */
export function cellSurfacePoint(cell: Object3D, towards: Vector3) {
  const point = towards
    .clone()
    .sub(cell.position)
    .applyQuaternion(cell.quaternion.clone().invert())
    .divide(cell.scale);
  const extent = Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z));
  if (extent === 0) return cell.position.clone();
  return point
    .multiplyScalar(0.5 / extent)
    .multiply(cell.scale)
    .applyQuaternion(cell.quaternion)
    .add(cell.position);
}

/** Distance-based travel avoids a pause at zero-length corners when the source and output align. */
export function pointAlongComputePath(points: Vector3[], progress: number) {
  const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]!));
  let distance = Math.max(0, Math.min(1, progress)) * lengths.reduce((sum, n) => sum + n, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i]! > 0 && distance <= lengths[i]!)
      return points[i]!.clone().lerp(points[i + 1]!, distance / lengths[i]!);
    distance -= lengths[i]!;
  }
  return points.at(-1)!.clone();
}
