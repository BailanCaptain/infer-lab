import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { numberText } from "./scene-inference";
import { parallelHardware } from "./scene-parallel-hardware";
import { setWidePolylinePoints } from "./scene-polyline";
import { epTransferPath } from "./wiki-parallel-strategy-renderer";

export const V = (x: number, y: number, z = 0) => new T.Vector3(x, y, z);
export const INK = {
  blue: "#85a9ec",
  gold: "#e0948b",
  green: "#78c8b0",
  violet: "#8e82c8",
  amethyst: "#9d8ad9",
  muted: "#e6e8e3",
  bracket: "#2c3836",
  empty: "#f2f1eb",
};
const PAPER = new T.Color("#fbfaf6");
export const crispEdgeColor = (src: T.Color | string) => new T.Color(src).offsetHSL(0, 0.1, -0.25);
export const wireTone = (src: T.Color | string) => {
  const c = new T.Color(src);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return hsl.l > 0.52 ? c.offsetHSL(0, 0.1, -0.18) : c;
};
export type Values = readonly (readonly (number | string)[])[];

/** Shared drawing primitives; each lesson owns its spatial layout and timeline. */
export async function inferenceSceneKit(
  host: HTMLDivElement,
  kind: number,
  signal: AbortSignal,
  hardwareKind = kind === 2 ? 10 : kind === 0 ? 1 : 9,
) {
  const hardware = await parallelHardware(hardwareKind, signal);
  if (!hardware) return null;
  const spatialCache = kind === 1;
  const spatialCore = kind === 3;
  const spatialCollective = hardwareKind === 5;
  const spatialStage = spatialCache || spatialCore;
  const narrowViewport = window.matchMedia("(max-width: 650px)").matches;
  const compactCache = spatialCache && narrowViewport;
  const compactCore = spatialCore && narrowViewport;
  host.style.background = "#fbfaf6";
  const root = new T.Group(),
    scene = new T.Scene();
  hardware.group.position.set(0, hardwareKind === 9 ? 3.2 : hardwareKind === 5 ? 5.35 : 4.5, -1.5);
  hardware.group.scale.setScalar(hardwareKind === 9 ? 3.2 : kind === 2 ? 0.78 : 0.85);
  if (spatialCollective) {
    hardware.group.rotation.set(0.46, 0, 0);
    hardware.group.scale.setScalar(2.0);
    hardware.group.position.set(0, 3.55, -4.8);
  } else if (spatialCache) {
    hardware.group.rotation.set(0, 0, 0);
    hardware.group.scale.setScalar(6.8);
    hardware.group.position.set(0, -2.7 - hardware.chips[0]!.position.y * 6.8, 0);
  } else if (spatialCore) {
    const scale = compactCore ? 8.2 : 10.2;
    hardware.group.rotation.set(0, 0, 0);
    hardware.group.scale.setScalar(scale);
    hardware.group.position.set(
      0,
      (compactCore ? -0.95 : -0.82) - hardware.chips[0]!.position.y * scale,
      compactCore ? 0.35 : 0.45,
    );
  }
  // Teaching scenes replace generic resident cubes with their own actual tensor contents.
  hardware.payloads.forEach((payload) => {
    payload.visible = false;
  });
  root.add(hardware.group);
  scene.add(root, new T.HemisphereLight(0xfffcf5, 0xb8b4a8, 1.85));
  const light = new T.DirectionalLight(0xfffdf8, 1.85);
  light.position.set(-5, 9, 18);
  scene.add(light);
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.domElement.setAttribute("aria-hidden", "true");
  const pmrem = new T.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();
  const overlay = document.createElement("div");
  overlay.className = "wiki-inference-labels";
  host.append(renderer.domElement, overlay);
  const camera = new T.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = controls.enableZoom = false;
  controls.minPolarAngle = compactCache ? 0.5 : spatialStage ? 0.72 : 1.24;
  controls.maxPolarAngle = compactCache ? 0.65 : spatialCache ? 1.03 : spatialCore ? 1.06 : 1.48;
  controls.minAzimuthAngle = spatialCache ? 0.05 : spatialCore ? -0.36 : -0.09;
  controls.maxAzimuthAngle = compactCache ? 0.16 : spatialCache ? 0.65 : spatialCore ? 0.46 : 0.12;
  controls.rotateSpeed = 0.24;
  const geometry = new T.BoxGeometry(1, 1, 1);
  const tileGeometry = new T.BoxGeometry(1, 1, 1);
  {
    const nrm = tileGeometry.getAttribute("normal");
    const colors = new Float32Array(nrm.count * 3);
    for (let i = 0; i < nrm.count; i++) {
      const nx = nrm.getX(i),
        ny = nrm.getY(i),
        nz = nrm.getZ(i);
      const shade = nz > 0.5 ? 1.0 : ny > 0.5 ? 0.89 : Math.abs(nx) > 0.5 ? 0.8 : 0.73;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = shade;
    }
    tileGeometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  }
  const cellEdges = new T.EdgesGeometry(geometry);
  const resources: (T.BufferGeometry | T.Material | T.WebGLRenderTarget)[] = [
    geometry,
    tileGeometry,
    cellEdges,
    envRT,
  ];
  const pickTargets: { target: T.Object3D; action: () => void }[] = [];
  const labels: {
    el: HTMLSpanElement;
    parent: T.Object3D;
    point: T.Vector3;
    w?: number | undefined;
    h?: number | undefined;
    textCache?: string | undefined;
  }[] = [];
  const emptyMemColor = new T.Color("#dad6ca");
  const lines: Line2[] = [];
  const memoryViews: (() => void)[] = [];
  const memoryInstances: T.InstancedMesh[] = [];
  let width = 1,
    height = 1,
    disposed = false;
  const label = (text: string, point: T.Vector3, type = "name", parent: T.Object3D = root) => {
    const el = document.createElement("span");
    el.className = `wiki-inference-label ${type}`;
    el.textContent = text;
    overlay.append(el);
    labels.push({ el, point, parent });
    return el;
  };
  const box = (point: T.Vector3, size: T.Vector3, color: string, parent: T.Object3D = root) => {
    const material = new T.MeshStandardMaterial({ color, roughness: 0.65, transparent: true });
    resources.push(material);
    const mesh = new T.Mesh(geometry, material);
    mesh.position.copy(point);
    mesh.scale.copy(size);
    parent.add(mesh);
    return mesh;
  };
  const tileBox = (point: T.Vector3, size: T.Vector3, color: string, parent: T.Object3D = root) => {
    const material = new T.MeshBasicMaterial({
      color,
      vertexColors: true,
      transparent: true,
      toneMapped: false,
    });
    const edgeMat = new T.LineBasicMaterial({
      color: crispEdgeColor(color),
      transparent: true,
      opacity: 0.7,
      toneMapped: false,
    });
    resources.push(material, edgeMat);
    const mesh = new T.Mesh(tileGeometry, material);
    mesh.position.copy(point);
    mesh.scale.copy(size);
    const edges = new T.LineSegments(cellEdges, edgeMat);
    edges.raycast = () => {};
    mesh.add(edges);
    mesh.userData.edgeMat = edgeMat;
    parent.add(mesh);
    return mesh;
  };
  const wire = (
    points: T.Vector3[],
    color = INK.blue,
    dashed = false,
    parent: T.Object3D = root,
    linewidth = dashed ? 1.8 : 2.8,
  ) => {
    const g = new LineGeometry(),
      m = new LineMaterial({
        color: wireTone(color),
        linewidth,
        dashed,
        dashSize: 0.14,
        gapSize: 0.12,
        transparent: true,
        opacity: dashed ? 0.56 : 0.92,
        depthWrite: false,
      });
    const line = new Line2(g, m);
    m.resolution.set(width, height);
    resources.push(g, m);
    parent.add(line);
    lines.push(line);
    setWidePolylinePoints(line, points);
    return line;
  };
  const matrix = (
    name: string,
    values: Values,
    point: T.Vector3,
    color = INK.blue,
    pitch = 0.65,
    rowNames: string[] = [],
    columnWidths?: number[],
    withBrackets = true,
  ) => {
    const group = new T.Group();
    group.position.copy(point);
    root.add(group);
    const cols = values[0]!.length,
      rows = values.length;
    const widths = columnWidths ?? Array<number>(cols).fill(pitch);
    const fullWidth = widths.reduce((a, b) => a + b, 0);
    const cells: T.Mesh<T.BoxGeometry, T.MeshBasicMaterial>[] = [],
      numbers: HTMLSpanElement[] = [];
    const titlePoint = V(0, (rows * pitch) / 2 + 0.3, 0.2);
    const title = label(name, titlePoint, "name", group);
    const names = rowNames.map((s, r) =>
      label(s, V(-fullWidth / 2 - 0.22, ((rows - 1) / 2 - r) * pitch, 0.2), "row", group),
    );
    values.forEach((row, r) => {
      row.forEach((value, c) => {
        const cell = tileBox(
          V(
            -fullWidth / 2 + widths.slice(0, c).reduce((a, b) => a + b, 0) + widths[c]! / 2,
            ((rows - 1) / 2 - r) * pitch,
            0,
          ),
          V(widths[c]! * 0.89, pitch * 0.84, 0.22),
          color,
          group,
        );
        cells.push(cell);
        const number = label(numberText(value), V(0, 0, spatialStage ? 0.2 : 0.52), "value", cell);
        number.dataset.tensor = name;
        numbers.push(number);
      });
    });
    const leftBracket = wire([V(0, 0), V(0, 0)], INK.bracket, false, group, 1.95);
    const rightBracket = wire([V(0, 0), V(0, 0)], INK.bracket, false, group, 1.95);
    leftBracket.material.opacity = rightBracket.material.opacity = 0.88;
    const syncBrackets = () => {
      let minR = Infinity,
        maxR = -Infinity;
      cells.forEach((cell, index) => {
        if (!cell.visible) return;
        const r = Math.floor(index / cols);
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
      });
      const show = withBrackets && minR <= maxR;
      leftBracket.visible = rightBracket.visible = show;
      if (!show) return;
      const top = ((rows - 1) / 2 - minR) * pitch + pitch * 0.45;
      const bottom = ((rows - 1) / 2 - maxR) * pitch - pitch * 0.45;
      const hx = fullWidth / 2 + 0.035;
      const tick = Math.min(0.12, fullWidth * 0.18);
      setWidePolylinePoints(leftBracket, [
        V(-hx + tick, top, 0.13),
        V(-hx, top, 0.13),
        V(-hx, bottom, 0.13),
        V(-hx + tick, bottom, 0.13),
      ]);
      setWidePolylinePoints(rightBracket, [
        V(hx - tick, top, 0.13),
        V(hx, top, 0.13),
        V(hx, bottom, 0.13),
        V(hx - tick, bottom, 0.13),
      ]);
    };
    const write = (
      next: Values,
      options: {
        color?: string | undefined;
        focus?: number | undefined;
        focusCell?: number | undefined;
        focusCells?: readonly number[] | undefined;
        empty?: boolean | undefined;
        colors?: readonly string[] | undefined;
        cellColors?: readonly string[] | undefined;
        receivingCells?: readonly number[] | undefined;
      } = {},
    ) => {
      cells.forEach((cell, index) => {
        const r = Math.floor(index / cols),
          value = next[r]?.[index % cols] ?? "";
        const empty = options.empty || value === "";
        const isRecv = empty && !!options.receivingCells?.includes(index);
        const baseHex = options.cellColors?.[index] ?? options.colors?.[r] ?? options.color ?? color;
        const muted = options.focusCells
          ? !options.focusCells.includes(index)
          : options.focusCell !== undefined
            ? options.focusCell !== index
            : options.focus !== undefined && options.focus !== r;
        const edgeMat = cell.userData.edgeMat as T.LineBasicMaterial;
        if (isRecv) {
          cell.material.color.set(baseHex).lerp(PAPER, 0.7);
          cell.material.opacity = 0.96;
          cell.scale.z = 0.13;
          edgeMat.color.copy(wireTone(baseHex));
          edgeMat.opacity = 0.86;
        } else if (empty) {
          cell.material.color.set(INK.empty);
          cell.material.opacity = 0.9;
          cell.scale.z = 0.08;
          edgeMat.color.set("#c7cbc3");
          edgeMat.opacity = 0.52;
        } else {
          cell.material.color.set(baseHex).lerp(PAPER, muted ? 0.48 : 0.08);
          cell.material.opacity = 0.98;
          cell.scale.z = 0.22;
          edgeMat.color.copy(crispEdgeColor(baseHex));
          edgeMat.opacity = muted ? 0.38 : 0.74;
        }
        numbers[index]!.textContent = empty ? "" : numberText(value);
        numbers[index]!.dataset.zero = value === 0 ? "true" : "false";
        numbers[index]!.classList.toggle("muted", !empty && muted);
      });
      syncBrackets();
    };
    syncBrackets();
    const rowPoint = (r: number, side = 0) =>
      group.localToWorld(V((side * fullWidth) / 2, ((rows - 1) / 2 - r) * pitch, 0.3));
    return {
      group,
      title,
      titlePoint,
      names,
      cells,
      numbers,
      write,
      syncBrackets,
      rowPoint,
      width: fullWidth,
      height: rows * pitch,
      rows,
      cols,
    };
  };
  const port = (index: number) => {
    root.updateMatrixWorld(true);
    return hardware.group.localToWorld(
      (index === -1 ? hardware.hostPoint! : hardware.points[index]!).clone(),
    );
  };
  const ownership = (index: number, target: T.Vector3, text: string) => {
    const a = port(index);
    const line = wire([a, V(a.x, target.y + 0.55, 0.1), target], INK.green, true);
    const caption = label(text, V(a.x, a.y + 0.65, a.z), "hardware");
    return { line, caption };
  };
  // A magnified matrix and its on-device miniature are two views of the same cells.
  type MatrixView = ReturnType<typeof matrix>;
  const memory = (
    index: number,
    matrices: (MatrixView | { source: MatrixView; rows: readonly number[] })[],
  ) => {
    const point = (index === -1 ? hardware.hostPoint! : hardware.points[index]!).clone();
    point.y -= index === -1 ? 0 : spatialCore ? 0.68 : 0.5;
    const columns = Math.ceil(Math.sqrt(matrices.length)),
      rows = Math.ceil(matrices.length / columns);
    const slotWidth = spatialCore ? 0.092 : 1.08 / columns,
      slotDepth = spatialCore ? 0.13 : 0.96 / rows;
    const hbmSlots: [number, number][] = [
      [-0.222, -0.145],
      [0.222, -0.145],
      [-0.222, 0.089],
      [0.222, 0.089],
    ];
    const views = matrices.map((binding, slot) => {
      const source = "source" in binding ? binding.source : binding;
      const rowIndices = "source" in binding ? binding.rows : undefined;
      // Cell coordinates already encode nonuniform column widths; normalize that same layout.
      const indices = source.cells.flatMap((_, i) =>
        !rowIndices || rowIndices.includes(Math.floor(i / source.cols)) ? [i] : [],
      );
      const material = new T.MeshBasicMaterial({
        color: "white",
        vertexColors: true,
        toneMapped: false,
      });
      resources.push(material);
      const mesh = new T.InstancedMesh(tileGeometry, material, indices.length);
      const hbmOffset = spatialCore ? hbmSlots[slot % hbmSlots.length]! : null;
      mesh.position
        .copy(point)
        .add(
          hbmOffset
            ? V(hbmOffset[0], 0, hbmOffset[1])
            : V(
                ((slot % columns) - (columns - 1) / 2) * slotWidth,
                0,
                (Math.floor(slot / columns) - (rows - 1) / 2) * slotDepth,
              ),
        );
      hardware.group.add(mesh);
      memoryInstances.push(mesh);
      const transform = new T.Matrix4(),
        position = new T.Vector3(),
        scale = new T.Vector3(),
        rotation = new T.Quaternion();
      return () => {
        mesh.visible = rowIndices !== undefined || source.group.visible;
        indices.forEach((i, instance) => {
          const cell = source.cells[i]!;
          const filled = !!source.numbers[i]!.textContent;
          const row = Math.floor(i / source.cols),
            count = rowIndices?.length ?? source.rows;
          const depth = ((rowIndices ? rowIndices.indexOf(row) : row) - (count - 1) / 2) / count;
          position.set(
            (cell.position.x / source.width) * slotWidth * 0.85,
            filled ? (spatialCore ? 0.018 : 0.045) : 0.005,
            depth * slotDepth * 0.85,
          );
          scale.set(
            (cell.scale.x / source.width) * slotWidth * 0.85,
            filled ? (spatialCore ? 0.032 : 0.09) : 0.01,
            (cell.scale.y / source.height) * slotDepth * 0.85,
          );
          if (!cell.visible) scale.setScalar(0);
          mesh.setMatrixAt(instance, transform.compose(position, rotation, scale));
          mesh.setColorAt(instance, filled ? cell.material.color : emptyMemColor);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      };
    });
    memoryViews.push(...views);
  };
  const compute = (index: number, active: boolean, color = INK.green) => {
    const chip = hardware.chips[index];
    if (!chip) return;
    chip.material.color.set(active ? color : "#286151");
    chip.material.emissive.set(active ? color : "#000000");
    chip.material.opacity = active ? (spatialCore ? 0.28 : 0.4) : spatialCore ? 0.0 : 0.12;
  };
  const pick = (target: T.Object3D, action: () => void) => {
    pickTargets.push({ target, action });
  };
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  let downX = 0,
    downY = 0;
  const isVisibleInHierarchy = (o: T.Object3D | null): boolean => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  const hitPick = (event: PointerEvent) => {
    if (!pickTargets.length) return undefined;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return undefined;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    let best: (typeof pickTargets)[number] | undefined;
    let bestDist = Infinity;
    for (const entry of pickTargets) {
      if (!isVisibleInHierarchy(entry.target)) continue;
      for (const hit of raycaster.intersectObject(entry.target, true)) {
        if (!(hit.object as T.Mesh).isMesh || !isVisibleInHierarchy(hit.object)) continue;
        if (hit.distance < bestDist) {
          bestDist = hit.distance;
          best = entry;
        }
      }
    }
    return best;
  };
  const onPointerDown = (event: PointerEvent) => {
    downX = event.clientX;
    downY = event.clientY;
  };
  let hoverRaf = 0;
  let pendingMove: PointerEvent | null = null;
  const onPointerMove = (event: PointerEvent) => {
    if (!pickTargets.length) return;
    if (event.buttons !== 0) {
      renderer.domElement.style.cursor = "grabbing";
      return;
    }
    pendingMove = event;
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      if (disposed || !pendingMove) return;
      renderer.domElement.style.cursor = hitPick(pendingMove) ? "pointer" : "";
      pendingMove = null;
    });
  };
  const onPointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5) return;
    hitPick(event)?.action();
  };
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  const hardwareTransfer = () => {
    const line = wire([V(0, 0), V(0, 0)], INK.blue);
    const packet = box(V(0, 0), V(0.16, 0.16, 0.16), INK.blue);
    return (from: number, to: number, progress: number, active: boolean, color = INK.blue) => {
      const visible = active && from !== to;
      line.visible = visible;
      packet.visible = visible && progress > 0 && progress < 1;
      if (!visible) return;
      const a = port(from),
        b = port(to);
      a.y -= 0.35;
      b.y -= 0.35;
      const height = Math.max(a.y, b.y) + 0.45;
      const route = new T.CubicBezierCurve3(a, V(a.x, height, a.z), V(b.x, height, b.z), b);
      setWidePolylinePoints(line, route.getPoints(40));
      line.material.color.copy(wireTone(color));
      packet.material.color.set(color);
      packet.position.copy(route.getPoint(progress));
    };
  };
  const plane = (name: string, point: T.Vector3, size: T.Vector3) => {
    const mesh = box(point, size, "#ebe8df");
    mesh.material.opacity = 0.48;
    label(name, point.clone().add(V(0, size.y / 2 - 0.24, 0.25)), "region");
    return mesh;
  };
  // A bounded cubic keeps the packet and its visible route on the same path.
  const path = (a: T.Vector3, b: T.Vector3) =>
    new T.CubicBezierCurve3(a, V(a.x, (a.y + b.y) / 2, 0.7), V(b.x, (a.y + b.y) / 2, 0.7), b);
  const transfer = (values: Values, color = INK.blue, pitch = 0.65) => {
    const packet = matrix("", values, V(0, 0), color, pitch);
    const line = wire([V(0, 0), V(0, 0)], color);
    return (
      a: T.Vector3,
      b: T.Vector3,
      progress: number,
      active: boolean,
      next: Values = values,
      laneX?: number,
    ) => {
      packet.group.visible = active && progress > 0 && progress < 1;
      line.visible = active;
      if (!active) return;
      const route = laneX === undefined ? path(a, b) : epTransferPath(a, b, laneX);
      setWidePolylinePoints(line, route.getPoints(32));
      line.material.opacity = progress === 1 ? 0.35 : 0.9;
      packet.group.position.copy(route.getPoint(progress));
      packet.write(next);
      const delta = packet.group.position.clone().sub(a);
      const clear = Math.abs(delta.x) > packet.width + 0.12 || Math.abs(delta.y) > packet.height + 0.12;
      packet.numbers.forEach((number) => {
        number.style.visibility = clear ? "visible" : "hidden";
      });
    };
  };
  const projected = new T.Vector3();
  const render = () => {
    if (disposed) return;
    const started = performance.now();
    memoryViews.forEach((update) => {
      update();
    });
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    const shown: typeof labels = [];
    for (const item of labels) {
      let visible = true;
      for (let p: T.Object3D | null = item.parent; p; p = p.parent) visible &&= p.visible;
      if (item.el.hidden !== !visible) item.el.hidden = !visible;
      if (visible && item.el.textContent) shown.push(item);
    }
    for (const item of shown) {
      if (item.el.classList.contains("value")) continue;
      const text = item.el.textContent ?? "";
      if (item.w === undefined || item.textCache !== text) {
        item.textCache = text;
        item.w = item.el.offsetWidth;
        item.h = item.el.offsetHeight;
      }
    }
    for (const item of shown) {
      projected.copy(item.point);
      item.parent.localToWorld(projected).project(camera);
      let x = ((projected.x + 1) * width) / 2;
      let y = ((1 - projected.y) * height) / 2;
      if (!item.el.classList.contains("value") && (x < 140 || x > width - 140 || y < 38 || y > height - 38)) {
        const w = item.w ?? 0;
        const h = item.h ?? 0;
        if (w > 0 && h > 0) {
          const pad = 4;
          if (item.el.style.transform.startsWith("translate(0")) {
            x = Math.max(pad, Math.min(Math.max(pad, width - w - pad), x));
          } else if (item.el.classList.contains("row")) {
            x = Math.max(w + pad, Math.min(width - pad, x));
          } else {
            x = Math.max(w / 2 + pad, Math.min(Math.max(w / 2 + pad, width - w / 2 - pad), x));
          }
          y = Math.max(h / 2 + pad, Math.min(Math.max(h / 2 + pad, height - h / 2 - pad), y));
        }
      }
      item.el.style.left = `${x.toFixed(2)}px`;
      item.el.style.top = `${y.toFixed(2)}px`;
    }
    host.dataset.drawCalls = String(renderer.info.render.calls);
    host.dataset.triangles = String(renderer.info.render.triangles);
    host.dataset.renderMs = (performance.now() - started).toFixed(2);
  };
  const reset = () => {
    camera.position.copy(
      compactCache
        ? V(2, 25, 16)
        : spatialCache
          ? V(9, 17, 24)
          : spatialCore
            ? V(compactCore ? 2.8 : 5.4, compactCore ? 21 : 18.8, compactCore ? 19.5 : 21.5)
            : spatialCollective
              ? V(0.55, 4.1, 28)
              : V(1.4, 5, 30),
    );
    controls.target.set(0, spatialCache ? 0.2 : spatialCore ? -0.15 : spatialCollective ? 0.25 : -0.15, 0);
    controls.update();
    render();
  };
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    const half = compactCache
      ? Math.max(7.9, (5.2 * height) / width)
      : spatialCore
        ? Math.max(8.45, (7.9 * height) / width)
        : spatialCollective
          ? Math.max(6.85, (7.95 * height) / width)
          : Math.max(8.8, (8.4 * height) / width);
    camera.top = half;
    camera.bottom = -half;
    camera.left = (-half * width) / height;
    camera.right = (half * width) / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    lines.forEach((l) => {
      l.material.resolution.set(width, height);
    });
    for (const item of labels) item.w = undefined;
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener("change", render);
  reset();
  resize();
  return {
    compactCache,
    compactCore,
    root,
    port,
    matrix,
    box,
    wire,
    label,
    ownership,
    memory,
    compute,
    pick,
    hardwareTransfer,
    plane,
    transfer,
    render,
    reset,
    dispose() {
      disposed = true;
      cancelAnimationFrame(hoverRaf);
      host.style.removeProperty("background");
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      observer.disconnect();
      controls.dispose();
      hardware.dispose();
      memoryInstances.forEach((instance) => {
        instance.dispose();
      });
      resources.forEach((r) => {
        r.dispose();
      });
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {}
      renderer.domElement.remove();
      overlay.remove();
    },
  };
}
export type InferenceKit = NonNullable<Awaited<ReturnType<typeof inferenceSceneKit>>>;
