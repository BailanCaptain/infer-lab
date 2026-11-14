import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** GLM EP16: 288 routed experts per MoE layer, 18 resident on each card. */
export const EXPERTS_PER_CARD = 18;

/** The same dismantled Atlas NPU modules as TP/DP/EP, in an eight-slot teaching chassis. */
export async function parallelHardware(kind: number, signal: AbortSignal, allCards = false) {
  const gltf = await new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}experiences/whole/assets/atlas-800t-a2.glb`,
  );
  const resources = new Set<T.BufferGeometry | T.Material>();
  const instances: T.InstancedMesh[] = [];
  const originals: T.Object3D[] = [];
  gltf.scene.traverse((object) => {
    if (object.userData.kind === "npu") originals.push(object);
    if (object instanceof T.Mesh) {
      resources.add(object.geometry);
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) resources.add(m);
    }
  });
  const dispose = () => {
    instances.forEach((instance) => {
      instance.dispose();
    });
    resources.forEach((r) => {
      r.dispose();
    });
  };
  if (signal.aborted) {
    dispose();
    return null;
  }
  if (originals.length !== 8) {
    dispose();
    throw new Error("Atlas 母版应包含 8 个 NPU 模组");
  }
  // DP, EP and P/D span two machines; other mechanisms use one machine or one NPU.
  const boards = kind === 6 || kind === 7 || kind === 10 ? 2 : 1;
  const isolated = kind === 9;
  const group = new T.Group();
  group.position.set(0, boards === 2 ? 2.85 : 1.8, -1.6);
  group.rotation.x = 0.35;
  group.scale.setScalar(boards === 2 ? 0.86 : 1.3);
  const mat = (color: string, opacity = 1) => {
    const m = new T.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
    resources.add(m);
    return m;
  };
  const metal = mat("#b5c6ba"),
    board = mat("#799b88"),
    dark = mat("#35594b");
  const box = (size: [number, number, number], position: [number, number, number], material: T.Material) => {
    const g = new T.BoxGeometry(...size);
    resources.add(g);
    const m = new T.Mesh(g, material);
    m.position.set(...position);
    group.add(m);
    return m;
  };
  const boardCenters = Array.from({ length: boards }, (_, b) => (boards === 2 ? (b - 0.5) * 8.1 : 0));
  for (const ox of isolated ? [] : boardCenters) {
    box([7.5, 0.22, 4.4], [ox, 0, 0], metal);
    box([7.05, 0.1, 4.1], [ox, 0.17, 0], board);
    for (const x of [-3.7, 3.7]) box([0.12, 0.42, 4.4], [ox + x, 0.22, 0], metal);
    box([7.4, 0.4, 0.12], [ox, 0.2, -2.18], metal);
    for (const x of [-2.8, 2.8]) box([0.7, 0.22, 0.2], [ox + x, 0.1, 2.3], dark);
  }
  const selected =
    kind === 10
      ? [0, 8]
      : allCards || boards === 2
        ? Array.from({ length: boards * 8 }, (_, i) => i)
        : kind === 8 || kind === 9
          ? [0]
          : kind === 0 || kind === 5
            ? [0, 1, 2, 3]
            : [0, 3];
  const points: T.Vector3[] = [],
    payloads: T.InstancedMesh[] = [],
    chips: T.Mesh<T.BoxGeometry, T.MeshLambertMaterial>[] = [];
  const diffuse = new Map<T.Material, T.Material>();
  const modules = boardCenters.flatMap((ox, b) =>
    originals.map((original, slot) => ({ original, ox, index: b * 8 + slot, slot })),
  );
  modules.forEach(({ original, ox, index, slot }) => {
    if (isolated && slot !== 0) return;
    const x = isolated ? 0 : ox + ((slot % 4) - 1.5) * 1.75,
      z = isolated ? 0 : Math.floor(slot / 4) * 1.95 - 0.98;
    const part = original.clone(true),
      coolers: T.Object3D[] = [];
    part.traverse((o) => {
      if (o.userData.kind === "cooler" || (isolated && o.name.includes("Lettering"))) coolers.push(o);
      if (o instanceof T.Mesh) {
        const convert = (old: T.MeshStandardMaterial) => {
          let next = diffuse.get(old);
          if (!next) {
            next = mat(old.color?.getStyle() ?? "#a6b7aa");
            diffuse.set(old, next);
          }
          return next;
        };
        o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
      }
    });
    coolers.forEach((c) => {
      c.removeFromParent();
    });
    part.position.set(0, 0, 0);
    const bounds = new T.Box3().setFromObject(part),
      size = bounds.getSize(new T.Vector3());
    part.scale.multiplyScalar(1.3 / Math.max(size.x, size.z / 1.1));
    const b = new T.Box3().setFromObject(part),
      center = b.getCenter(new T.Vector3());
    const moduleTop = 0.28 + b.max.y - b.min.y;
    part.position.set(x - center.x, 0.28 - b.min.y, z - center.z);
    group.add(part);
    if (!selected.includes(index)) return;
    const chip = box([0.56, 0.08, 0.56], [x, moduleTop + 0.04, z], mat("#437465")) as T.Mesh<
      T.BoxGeometry,
      T.MeshLambertMaterial
    >;
    chips.push(chip);
    const isCache = kind === 3;
    const geometry = new T.BoxGeometry(0.18, 0.16, 0.18);
    resources.add(geometry);
    const payload = new T.InstancedMesh(
      geometry,
      mat(
        isCache
          ? "#ffffff"
          : kind === 6
            ? "#ffffff"
            : kind === 2 || kind === 4
              ? index === selected[0]
                ? "#497e91"
                : "#a1724b"
              : "#7794b4",
      ),
      kind === 0 ? 32 : kind === 6 ? 16 + EXPERTS_PER_CARD : kind === 7 ? EXPERTS_PER_CARD : 16,
    );
    const matrix = new T.Matrix4();
    // DP and EP carry one cube per resident expert (6 × 3) so the count on the card is literal.
    const expertStart = kind === 6 ? 16 : kind === 7 ? 0 : Infinity;
    for (let i = 0; i < payload.count; i++) {
      const j = i - expertStart;
      payload.setMatrixAt(
        i,
        j >= 0
          ? matrix.makeTranslation(
              x + ((j % 6) - 2.5) * 0.19,
              moduleTop + 0.25 + (expertStart ? 0.2 : 0),
              z + (Math.floor(j / 6) - 1) * 0.2,
            )
          : matrix.makeTranslation(
              x + ((i % 4) - 1.5) * 0.2 + (isCache ? (i % 4 < 2 ? -0.06 : 0.06) : 0),
              moduleTop + 0.25 + Math.floor(i / 16) * 0.2,
              z + ((Math.floor(i / 4) % 4) - 1.5) * 0.2,
            ),
      );
      // DP: the lower layer is the dense copy each machine holds; the upper layer is that machine's expert half.
      if (kind === 6)
        payload.setColorAt(i, new T.Color(i < 16 ? "#7794b4" : index < 8 ? "#8a7aa8" : "#5d8f9e"));
      if (isCache)
        payload.setColorAt(
          i,
          new T.Color(
            index === selected[0] ? (i % 4 < 2 ? "#497e91" : "#789eaa") : i % 4 < 2 ? "#a1724b" : "#bb9471",
          ),
        );
    }
    group.add(payload);
    instances.push(payload);
    payloads.push(payload);
    points.push(new T.Vector3(x, moduleTop + 0.75, z));
    if (kind === 0)
      for (let i = 0; i < 4; i++)
        box([0.14, 0.15, 0.18], [x + 0.62, moduleTop + 0.15, z + (i - 1.5) * 0.2], mat("#80a08c"));
  });
  let hostPoint: T.Vector3 | undefined;
  if (kind === 8) {
    // Offload expands the real host board beside the same accelerator board.
    group.children.forEach((part) => {
      part.position.x -= 4.1;
    });
    points.forEach((point) => {
      point.x -= 4.1;
    });
    let hostSource: T.Object3D | undefined;
    gltf.scene.traverse((part) => {
      if (part.userData.kind === "host") hostSource = part;
    });
    if (!hostSource) {
      dispose();
      throw new Error("Atlas 母版缺少主机内存板");
    }
    const host = hostSource.clone(true);
    host.position.set(0, 0, 0);
    const bounds = new T.Box3().setFromObject(host),
      size = bounds.getSize(new T.Vector3());
    host.scale.multiplyScalar(7.2 / Math.max(size.x, size.z / 0.6));
    const scaled = new T.Box3().setFromObject(host),
      center = scaled.getCenter(new T.Vector3());
    host.position.set(4.1 - center.x, 0.25 - scaled.min.y, -center.z);
    group.add(host);
    group.updateMatrixWorld(true);
    let memory: T.Object3D | undefined;
    host.traverse((part) => {
      if (!memory && part.userData.kind === "memory") memory = part;
    });
    hostPoint = group.worldToLocal(new T.Box3().setFromObject(memory ?? host).getCenter(new T.Vector3()));
    hostPoint.y += 0.2;
  }
  // Merge static native mesh parts without losing the independent weight/cache tensors.
  group.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.Mesh[]>();
  group.traverse((o) => {
    if (
      !(o instanceof T.Mesh) ||
      o instanceof T.InstancedMesh ||
      Array.isArray(o.material) ||
      chips.includes(o as (typeof chips)[number])
    )
      return;
    const items = batches.get(o.material) ?? [];
    items.push(o);
    batches.set(o.material, items);
  });
  const inverse = group.matrixWorld.clone().invert();
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const parts = meshes.map((m) => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      return g.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => {
      p.dispose();
    });
    if (!merged) continue;
    resources.add(merged);
    meshes.forEach((m) => {
      m.removeFromParent();
    });
    group.add(new T.Mesh(merged, material));
  }
  return { group, points, payloads, chips, dispose, boards, boardCenters, hostPoint };
}
