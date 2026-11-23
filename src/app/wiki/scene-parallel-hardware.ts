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
  const mat = (color: string, opacity = 1, pbr: { metalness?: number; roughness?: number } = {}) => {
    const m = new T.MeshStandardMaterial({
      color,
      metalness: pbr.metalness ?? 0.08,
      roughness: pbr.roughness ?? 0.62,
      transparent: opacity < 1,
      opacity,
    });
    resources.add(m);
    return m;
  };
  const isParallel = kind <= 7;
  // Light architectural silver-stone chassis tray so hardware sits airily on #fbfaf6 warm-white paper.
  const metal = mat("#e5e8e6", 1, { metalness: 0.2, roughness: 0.5 }),
    board = mat("#eff1ef", 1, { metalness: 0.05, roughness: 0.84 }),
    dark = mat("#b4bcba", 1, { metalness: 0.12, roughness: 0.6 }),
    accent = mat(isParallel ? "#9bb0c7" : "#c79b4b", 1, { metalness: 0.16, roughness: 0.48 });
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
    box([7.08, 0.1, 4.12], [ox, 0.17, 0], board);
    for (const x of [-3.7, 3.7]) box([0.12, 0.42, 4.4], [ox + x, 0.22, 0], metal);
    box([7.4, 0.4, 0.12], [ox, 0.2, -2.18], metal);
    box([6.8, 0.05, 0.06], [ox, 0.24, 2.22], accent);
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
    chips: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>[] = [];
  const pbrClones = new Map<T.Material, T.Material>();
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
      if (
        o.userData.kind === "cooler" ||
        (isolated && (o.userData.kind === "ihs" || o.name.includes("Lettering")))
      )
        coolers.push(o);
      if (o instanceof T.Mesh) {
        const preservePbr = (old: T.MeshStandardMaterial) => {
          let next = pbrClones.get(old);
          if (!next) {
            next = old.clone();
            resources.add(next);
            pbrClones.set(old, next);
          }
          return next;
        };
        o.material = Array.isArray(o.material) ? o.material.map(preservePbr) : preservePbr(o.material);
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
    // Keep the authentic silicon SoC die + HBM stacks exposed; chip acts as a translucent compute halo.
    const chipMat = new T.MeshStandardMaterial({
      color: "#286151",
      emissive: "#000000",
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: isolated ? 0.0 : 0.14,
      depthWrite: false,
    });
    resources.add(chipMat);
    const chip = box([0.52, 0.03, 0.56], [x, moduleTop + 0.04, z], chipMat) as T.Mesh<
      T.BoxGeometry,
      T.MeshStandardMaterial
    >;
    chips.push(chip);
    const isCache = kind === 3;
    const geometry = isParallel ? new T.BoxGeometry(0.132, 0.096, 0.11) : new T.BoxGeometry(0.18, 0.16, 0.18);
    if (isParallel) {
      const nrm = geometry.getAttribute("normal");
      const colors = new Float32Array(nrm.count * 3);
      for (let k = 0; k < nrm.count; k++) {
        const nx = nrm.getX(k),
          ny = nrm.getY(k),
          nz = nrm.getZ(k);
        const shade = ny > 0.5 ? 1.06 : nz > 0.5 ? 0.85 : Math.abs(nx) > 0.5 ? 0.69 : 0.62;
        colors[k * 3] = shade;
        colors[k * 3 + 1] = shade;
        colors[k * 3 + 2] = shade;
      }
      geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    }
    resources.add(geometry);
    const payloadMat = isParallel
      ? (() => {
          const m = new T.MeshBasicMaterial({
            color: "#ffffff",
            vertexColors: true,
            transparent: kind === 2,
            opacity: 1,
            toneMapped: false,
          });
          resources.add(m);
          return m;
        })()
      : mat("#495d7d", 1, { metalness: 0.14, roughness: 0.44 });
    const payload = new T.InstancedMesh(
      geometry,
      payloadMat,
      kind === 0 ? 32 : kind === 6 ? 16 + EXPERTS_PER_CARD : kind === 7 ? EXPERTS_PER_CARD : 16,
    );
    const matrix = new T.Matrix4();
    // DP and EP carry one cube per resident expert (6 × 3) so the count on the card is literal.
    const expertStart = kind === 6 ? 16 : kind === 7 ? 0 : Infinity;
    const slateTones = ["#586470", "#74818e", "#4b5661", "#8a96a3"];
    for (let i = 0; i < payload.count; i++) {
      const j = i - expertStart;
      payload.setMatrixAt(
        i,
        j >= 0
          ? matrix.makeTranslation(
              x + ((j % 6) - 2.5) * 0.196,
              moduleTop + (kind === 7 ? 0.095 : 0.24),
              z + (Math.floor(j / 6) - 1) * (kind === 7 ? 0.305 : 0.22),
            )
          : matrix.makeTranslation(
              x + ((i % 4) - 1.5) * 0.2 + (isCache ? (i % 4 < 2 ? -0.06 : 0.06) : 0),
              moduleTop + (isParallel ? 0.11 + Math.floor(i / 16) * 0.12 : 0.25 + Math.floor(i / 16) * 0.2),
              z + ((Math.floor(i / 4) % 4) - 1.5) * 0.2,
            ),
      );
      if (kind === 6) {
        const slate = slateTones[((i % 4) + Math.floor(i / 4) + index) % 4]!;
        payload.setColorAt(i, new T.Color(i < 16 ? slate : index < 8 ? "#85a9ec" : "#e0948b"));
      } else if (kind === 7) {
        const step = ((j % 6) + Math.floor(j / 6) + index) % 4;
        payload.setColorAt(i, new T.Color(slateTones[step]!));
      } else if (isCache) {
        payload.setColorAt(i, new T.Color(i % 4 < 2 ? "#e0948b" : "#78c8b0"));
      } else if (isParallel) {
        const step = ((i % 4) + Math.floor(i / 4) + index) % 4;
        payload.setColorAt(i, new T.Color(slateTones[step]!));
      }
    }
    group.add(payload);
    instances.push(payload);
    payloads.push(payload);
    points.push(new T.Vector3(x, moduleTop + 0.75, z));
    if (kind === 0)
      for (let i = 0; i < 4; i++)
        box([0.13, 0.12, 0.16], [x + 0.62, moduleTop + 0.13, z + (i - 1.5) * 0.2], mat("#687582"));
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
