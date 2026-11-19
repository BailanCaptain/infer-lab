import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ParallelLayout } from "./HardwareStage";

export async function mountHardwareStage(
  host: HTMLDivElement,
  kind: "request" | "parallel",
  onSelect: (rank: number) => void,
) {
  const gltf = await new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}experiences/whole/assets/atlas-800t-a2.glb`,
  );
  const scene = new T.Scene();
  scene.background = new T.Color("#e7e9de");
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");
  const camera = new T.PerspectiveCamera(34, 1, 0.1, 120);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.47;
  scene.add(new T.HemisphereLight("#fff6df", "#718772", 2.2));
  const sun = new T.DirectionalLight("#fff0d5", 3);
  sun.position.set(-8, 18, 12);
  scene.add(sun);
  const fill = new T.DirectionalLight("#d5e3f2", 1.5);
  fill.position.set(12, 10, -8);
  scene.add(fill);
  const root = gltf.scene.children[0]!;
  const parts: T.Object3D[] = [];
  root.traverse((o) => {
    if (o.userData.kind) parts.push(o);
  });
  const modules = parts.filter((p) => p.userData.kind === "npu");
  if (modules.length !== 8) throw new Error("Atlas 母版应有 8 个 NPU 模组");
  const ground = new T.Mesh(
    new T.PlaneGeometry(60, 60),
    new T.MeshStandardMaterial({ color: "#e7e9de", roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  scene.add(ground);
  const overlay = document.createElement("div");
  overlay.className = "hardware-labels";
  host.append(overlay);
  const leaders = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  leaders.setAttribute("class", "hardware-leaders");
  leaders.setAttribute("aria-hidden", "true");
  if (kind === "request") overlay.append(leaders);
  const anchors: {
    object: T.Object3D;
    node: HTMLElement;
    rank: number | undefined;
    kind: string | undefined;
  }[] = [];
  const boards: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>[] = [];
  const rankGroups: T.Group[] = [];
  const label = (object: T.Object3D, text: string, rank?: number, partKind?: string) => {
    const node = document.createElement(rank === undefined ? "div" : "button");
    node.className = "hardware-part-label";
    node.textContent = text;
    if (rank !== undefined) {
      node.setAttribute("type", "button");
      node.dataset.rank = String(rank);
      node.setAttribute("aria-label", `选择 rank ${rank}`);
      node.onclick = () => onSelect(rank);
    } else node.dataset.part = partKind ?? "";
    overlay.append(node);
    anchors.push({ object, node, rank, kind: partKind });
  };
  if (kind === "request") {
    scene.add(root);
    for (const part of parts) {
      if (part.userData.kind === "lid") {
        part.visible = false;
        continue;
      }
      part.position.y += (Number(part.userData.explodeZ) || 0) * 0.68;
      part.position.z -= (Number(part.userData.explodeY) || 0) * 0.68;
    }
    for (const [partKind, name] of [
      ["host", "CPU 主板与 DIMM"],
      ["network", "网络接口"],
      ["board", "NPU 载板"],
      ["npu", "NPU 模组 × 8"],
    ]) {
      const part = parts.find((p) => p.userData.kind === partKind);
      if (part) label(part, name!, undefined, partKind);
    }
    host.dataset.asset = "atlas-800t-a2.glb";
  } else {
    for (let rank = 0; rank < 16; rank++) {
      const group = new T.Group();
      const local = rank % 8,
        machine = Math.floor(rank / 8);
      group.position.set(
        (machine === 0 ? -3.15 : 3.15) + ((local % 4) - 1.5) * 1.32,
        0,
        (Math.floor(local / 4) - 0.5) * 2.35,
      );
      const module = modules[local]!.clone(true);
      module.position.set(0, 0.18, 0);
      module.traverse((part) => {
        if (part.userData.kind === "cooler") part.position.y += 0.25;
      });
      group.add(module);
      const board = new T.Mesh(
        new T.BoxGeometry(1.22, 0.12, 2.0),
        new T.MeshStandardMaterial({ color: 0x839d88, roughness: 0.9 }),
      );
      board.position.y = 0.02;
      group.add(board);
      boards.push(board);
      scene.add(group);
      rankGroups.push(group);
      label(group, `${rank}`, rank);
    }
    for (const [x, text] of [
      [-3.15, "服务器 0 · rank 0–7"],
      [3.15, "服务器 1 · rank 8–15"],
    ] as const) {
      const anchor = new T.Object3D();
      anchor.position.set(x, -0.1, 3.65);
      scene.add(anchor);
      label(anchor, text);
    }
    host.dataset.asset = "atlas-800t-a2.glb:npu×16";
  }
  const highlight = new T.Group();
  scene.add(highlight);
  const colors = [0x5d8e79, 0xaa8854, 0x778fa9, 0x9c799a];
  let width = 1,
    height = 1;
  const render = () => {
    renderer.render(scene, camera);
    leaders.replaceChildren();
    for (const anchor of anchors) {
      const center = new T.Box3().setFromObject(anchor.object).getCenter(new T.Vector3());
      if (anchor.object.type === "Object3D") anchor.object.getWorldPosition(center);
      if (kind === "parallel" && anchor.rank !== undefined) {
        anchor.object.getWorldPosition(center);
        center.y = 0.2;
        center.z += 1.08;
      }
      center.project(camera);
      const px = ((center.x + 1) * width) / 2,
        py = ((1 - center.y) * height) / 2;
      const callout = kind === "request";
      const left = anchor.kind === "host" || anchor.kind === "npu";
      const x = callout ? width * (left ? 0.16 : 0.84) : px;
      const y = callout ? height * (anchor.kind === "host" || anchor.kind === "network" ? 0.22 : 0.71) : py;
      anchor.node.style.left = `${x}px`;
      anchor.node.style.top = `${y}px`;
      if (callout) {
        const line = document.createElementNS(leaders.namespaceURI, "path");
        const edge = x + (left ? 52 : -42);
        line.setAttribute("d", `M${edge},${y} L${edge + (left ? 14 : -14)},${y} L${px},${py}`);
        leaders.append(line);
      }
    }
  };
  const reset = () => {
    controls.target.set(0, kind === "request" ? 2 : 0, 0);
    camera.position.set(
      kind === "request" ? 9 : 5.4,
      kind === "request" ? 12 : 12,
      kind === "request" ? 15 : 13.5,
    );
    controls.update();
    render();
  };
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener("change", render);
  resize();
  reset();
  const clearHighlight = () => {
    for (const item of [...highlight.children]) {
      highlight.remove(item);
      const line = item as T.LineSegments;
      line.geometry?.dispose();
      if (line.material)
        for (const m of Array.isArray(line.material) ? line.material : [line.material]) m.dispose();
    }
  };
  return {
    update(focus: string, layout: ParallelLayout, selected: number) {
      clearHighlight();
      if (kind === "request") {
        const selectedParts = parts.filter(
          (p) => p.userData.kind === focus || (focus === "memory" && p.userData.kind === "host"),
        );
        for (const part of selectedParts.slice(0, focus === "npu" ? 8 : 1)) {
          const box = new T.BoxHelper(part, 0xa56d35);
          highlight.add(box);
        }
        for (const a of anchors)
          a.node.dataset.active = String(a.kind === focus || (focus === "memory" && a.kind === "host"));
      } else {
        const groupSize = layout === "tp" ? 8 : 4;
        boards.forEach((board, rank) => {
          board.material.color.setHex(colors[Math.floor(rank / groupSize)]!);
        });
        const selectedGroup = Math.floor(selected / groupSize);
        for (const a of anchors)
          if (a.rank !== undefined) {
            a.node.dataset.active = String(a.rank === selected);
            a.node.dataset.group = String(Math.floor(a.rank / groupSize));
          }
        const set = rankGroups.filter((_, rank) => Math.floor(rank / groupSize) === selectedGroup);
        for (const group of set) highlight.add(new T.BoxHelper(group, colors[selectedGroup]!));
        host.dataset.groupSize = String(groupSize);
        host.dataset.group = String(selectedGroup);
        host.dataset.selected = String(selected);
      }
      render();
    },
    reset,
    dispose() {
      observer.disconnect();
      controls.removeEventListener("change", render);
      controls.dispose();
      clearHighlight();
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      for (const graph of [scene, gltf.scene])
        graph.traverse((o) => {
          const mesh = o as T.Mesh;
          if (mesh.geometry) geometries.add(mesh.geometry);
          if (mesh.material)
            for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m);
        });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {}
      renderer.domElement.remove();
      overlay.remove();
    },
  };
}
