import * as T from "three";
import type { scenePalette } from "./scene-palette";

export const EXPERT_PARTS = 4;
const plateBase = 0.07,
  plateGap = 0.09,
  plateOffset = 0.025;
export const expertSlot = (slot: number) =>
  new T.Vector3(((slot % 6) - 2.5) * 0.23, 0, (Math.floor(slot / 6) - 1) * 0.43);
export function expertLayout(slot: number) {
  const origin = expertSlot(slot);
  return {
    input: origin.clone().add(new T.Vector3(0, plateBase, -0.16)),
    down: origin.clone().add(new T.Vector3(0, plateBase + 2 * plateGap, 0.16 + 2 * plateOffset)),
  };
}

/** A bound group of three complete matrices, not three shards of one matrix. */
export function createExpertAssembly(
  palette: Pick<ReturnType<typeof scenePalette>, "board" | "result" | "weightSoft" | "weight">,
) {
  const geometry = new T.BoxGeometry(1, 1, 1),
    material = new T.MeshBasicMaterial({ toneMapped: false });
  const mesh = new T.InstancedMesh(geometry, material, 18 * EXPERT_PARTS);
  mesh.frustumCulled = false;
  const dummy = new T.Object3D(),
    color = new T.Color(),
    muted = new T.Color(palette.weight).lerp(new T.Color(palette.weightSoft), 0.3);
  let previous = "";
  const update = (picked: Set<number>, phase: number, progress: number, workingSlot = -1) => {
    const key = picked.size
      ? `${[...picked]}:${phase}:${workingSlot}:${phase === 0 || phase === 2 ? progress.toFixed(3) : ""}`
      : "idle";
    if (key === previous) return;
    previous = key;
    for (let slot = 0; slot < 18; slot++) {
      const origin = expertSlot(slot),
        active = picked.has(slot);
      // Three fixed weight plates distinguish an expert from a single weight shard.
      for (let part = 0; part < 4; part++) {
        dummy.position.copy(origin);
        dummy.rotation.set(0, 0, 0);
        if (part === 0) {
          dummy.scale.set(0.205, 0.025, 0.37);
          dummy.position.y = 0.02;
        } else {
          dummy.scale.set(0.18, 0.035, 0.32);
          dummy.position.y = plateBase + (part - 1) * plateGap;
          dummy.position.z += (part - 1) * plateOffset;
        }
        const calculating =
          active &&
          (workingSlot === -2 || slot === workingSlot) &&
          phase === 2 &&
          (progress < 0.6 ? part === 1 || part === 2 : part === 3);
        if (calculating) dummy.position.y += 0.16 * Math.sin(Math.PI * progress);
        dummy.updateMatrix();
        mesh.setMatrixAt(slot * 4 + part, dummy.matrix);
        color.set(
          part === 0 ? palette.board : calculating ? palette.weightSoft : active ? palette.weight : muted,
        );
        if (part > 0) color.multiplyScalar([1, 0.68, 0.84, 1][part]!);
        if (active && part > 0 && phase === 0)
          color.lerp(muted, 1 - T.MathUtils.smoothstep(progress, 0, 0.75));
        mesh.setColorAt(slot * 4 + part, color);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.instanceColor!.needsUpdate = true;
  };
  return {
    mesh,
    update,
    dispose() {
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
