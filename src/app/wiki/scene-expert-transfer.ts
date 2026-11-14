import * as T from "three";

export function expertTransferPaths(
  source: T.Vector3,
  input: T.Vector3,
  output: T.Vector3,
  collected: T.Vector3,
  result: T.Vector3,
  arch: number,
) {
  const arc = (a: T.Vector3, b: T.Vector3) =>
    new T.QuadraticBezierCurve3(
      a.clone(),
      a
        .clone()
        .lerp(b, 0.5)
        .add(new T.Vector3(0, arch, 0)),
      b.clone(),
    );
  // A straight landing lane holds the entire six-element vector before combine starts.
  const landing = collected.clone().add(new T.Vector3(-0.9, 0, 0));
  const reply = new T.CurvePath<T.Vector3>();
  reply.add(
    new T.CubicBezierCurve3(
      output.clone(),
      output
        .clone()
        .lerp(landing, 0.5)
        .add(new T.Vector3(0, arch, 0)),
      landing.clone().add(new T.Vector3(-1, 0, 0)),
      landing,
    ),
  );
  reply.add(new T.LineCurve3(landing, collected.clone()));
  return [
    arc(source, input),
    new T.LineCurve3(input.clone(), output.clone()),
    reply,
    new T.LineCurve3(collected.clone(), result.clone().add(new T.Vector3(2.5 * 0.145, 0, 0))),
  ];
}

const packetCell = new T.Object3D();
const packetAxis = new T.Vector3(1, 0, 0);
export function positionExpertPacket(
  packet: T.InstancedMesh,
  paths: T.Curve<T.Vector3>[],
  phase: number,
  local: number,
) {
  const segment = Math.max(0, Math.min(3, phase - 1));
  const lengths = paths.map((curve) => curve.getLength());
  const start = lengths.slice(0, segment).reduce((sum, n) => sum + n, 0);
  const total = lengths.reduce((sum, n) => sum + n, 0);
  const at = phase === 4 ? T.MathUtils.smoothstep(local, 0, 1) : local;
  const head = start + at * lengths[segment]!;
  const occupied = new Set<number>();
  for (let i = 0; i < packet.count; i++) {
    if (phase === 4) {
      // Combine corresponding elements; a vector never collapses to a scalar point.
      packetCell.position.copy(paths[3]!.getPoint(at)).add(new T.Vector3(-i * 0.145, 0, 0));
      packetCell.quaternion.identity();
      packetCell.updateMatrix();
      packet.setMatrixAt(i, packetCell.matrix);
      occupied.add(3);
      continue;
    }
    // Preserve the vector's tail across a stage boundary instead of jumping it to the next line.
    let distance = T.MathUtils.clamp(head - i * 0.145, 0, total),
      part = 0;
    while (part < paths.length - 1 && distance > lengths[part]!) distance -= lengths[part++]!;
    const curve = paths[part]!,
      u = T.MathUtils.clamp(distance / Math.max(0.0001, lengths[part]!), 0, 1);
    occupied.add(part);
    // CurvePath.getPoint already uses arc length; remapping it shifts the landing slots.
    packetCell.position.copy(curve instanceof T.CurvePath ? curve.getPoint(u) : curve.getPointAt(u));
    packetCell.quaternion.setFromUnitVectors(
      packetAxis,
      (curve instanceof T.CurvePath ? curve.getTangent(u) : curve.getTangentAt(u)).normalize(),
    );
    packetCell.updateMatrix();
    packet.setMatrixAt(i, packetCell.matrix);
  }
  packet.instanceMatrix.needsUpdate = true;
  return occupied;
}
