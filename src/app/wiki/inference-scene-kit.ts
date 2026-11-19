import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { numberText } from "./scene-inference";
import { parallelHardware } from "./scene-parallel-hardware";
import { setWidePolylinePoints } from "./scene-polyline";
import { epTransferPath } from "./wiki-parallel-strategy-renderer";

export const V = (x: number, y: number, z = 0) => new T.Vector3(x, y, z);
export const INK = {
  blue: "#287fb5",
  gold: "#b58a45",
  green: "#44866c",
  violet: "#8875ad",
  muted: "#c4d2c7",
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
  const spatialStage = spatialCache || spatialCore;
  const narrowViewport = window.matchMedia("(max-width: 650px)").matches;
  const compactCache = spatialCache && narrowViewport;
  const compactCore = spatialCore && narrowViewport;
  const root = new T.Group(),
    scene = new T.Scene();
  hardware.group.position.set(0, hardwareKind === 9 ? 3.2 : hardwareKind === 5 ? 5.35 : 4.5, -1.5);
  hardware.group.scale.setScalar(hardwareKind === 9 ? 3.2 : kind === 2 ? 0.78 : 0.85);
  if (spatialCache) {
    hardware.group.rotation.set(0, 0, 0);
    hardware.group.scale.setScalar(6.8);
    hardware.group.position.set(0, -2.7 - hardware.chips[0]!.position.y * 6.8, 0);
  } else if (spatialCore) {
    const scale = compactCore ? 4.1 : 4.7;
    hardware.group.rotation.set(0, 0, 0);
    hardware.group.scale.setScalar(scale);
    hardware.group.position.set(
      0,
      (compactCore ? -5.05 : -4.9) - hardware.chips[0]!.position.y * scale,
      compactCore ? 2.9 : 3.0,
    );
  }
  // Teaching scenes replace generic resident cubes with their own actual tensor contents.
  hardware.payloads.forEach((payload) => {
    payload.visible = false;
  });
  root.add(hardware.group);
  scene.add(root, new T.HemisphereLight(0xffffff, 0xaebdb0, 2.5));
  const light = new T.DirectionalLight(0xffffff, 2);
  light.position.set(-5, 8, 18);
  scene.add(light);
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
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
  const resources: (T.BufferGeometry | T.Material)[] = [geometry];
  const labels: { el: HTMLSpanElement; parent: T.Object3D; point: T.Vector3 }[] = [];
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
  const wire = (points: T.Vector3[], color = INK.blue, dashed = false) => {
    const g = new LineGeometry(),
      m = new LineMaterial({
        color,
        linewidth: dashed ? 1.8 : 2.8,
        dashed,
        dashSize: 0.14,
        gapSize: 0.12,
        transparent: true,
        opacity: dashed ? 0.5 : 0.9,
        depthWrite: false,
      });
    const line = new Line2(g, m);
    m.resolution.set(width, height);
    resources.push(g, m);
    root.add(line);
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
  ) => {
    const group = new T.Group();
    group.position.copy(point);
    root.add(group);
    const cols = values[0]!.length,
      rows = values.length;
    const widths = columnWidths ?? Array<number>(cols).fill(pitch);
    const fullWidth = widths.reduce((a, b) => a + b, 0);
    const cells: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>[] = [],
      numbers: HTMLSpanElement[] = [];
    const titlePoint = V(0, (rows * pitch) / 2 + 0.3, 0.2);
    const title = label(name, titlePoint, "name", group);
    const names = rowNames.map((s, r) =>
      label(s, V(-fullWidth / 2 - 0.18, ((rows - 1) / 2 - r) * pitch, 0.2), "row", group),
    );
    values.forEach((row, r) => {
      row.forEach((value, c) => {
        const cell = box(
          V(
            -fullWidth / 2 + widths.slice(0, c).reduce((a, b) => a + b, 0) + widths[c]! / 2,
            ((rows - 1) / 2 - r) * pitch,
            0,
          ),
          V(widths[c]! * 0.9, pitch * 0.85, 0.22),
          color,
          group,
        );
        cells.push(cell);
        const number = label(numberText(value), V(0, 0, spatialStage ? 0.16 : 0.52), "value", cell);
        number.dataset.tensor = name;
        numbers.push(number);
      });
    });
    const write = (
      next: Values,
      options: {
        color?: string;
        focus?: number | undefined;
        focusCell?: number | undefined;
        empty?: boolean;
        colors?: string[];
      } = {},
    ) => {
      cells.forEach((cell, index) => {
        const r = Math.floor(index / cols),
          value = next[r]?.[index % cols] ?? "";
        const empty = options.empty || value === "";
        cell.material.color.set(options.colors?.[r] ?? options.color ?? color);
        const muted =
          options.focusCell !== undefined
            ? options.focusCell !== index
            : options.focus !== undefined && options.focus !== r;
        cell.material.opacity = empty ? 0.12 : muted ? 0.5 : 1;
        numbers[index]!.textContent = empty ? "" : numberText(value);
        numbers[index]!.classList.toggle("muted", muted);
      });
    };
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
    point.y -= index === -1 ? 0 : 0.5;
    const columns = Math.ceil(Math.sqrt(matrices.length)),
      rows = Math.ceil(matrices.length / columns);
    const slotWidth = 1.08 / columns,
      slotDepth = 0.96 / rows;
    const views = matrices.map((binding, slot) => {
      const source = "source" in binding ? binding.source : binding;
      const rowIndices = "source" in binding ? binding.rows : undefined;
      // Cell coordinates already encode nonuniform column widths; normalize that same layout.
      const indices = source.cells.flatMap((_, i) =>
        !rowIndices || rowIndices.includes(Math.floor(i / source.cols)) ? [i] : [],
      );
      const material = new T.MeshStandardMaterial({ color: "white", roughness: 0.65 });
      resources.push(material);
      const mesh = new T.InstancedMesh(geometry, material, indices.length);
      mesh.position
        .copy(point)
        .add(
          V(
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
            filled ? 0.045 : 0.008,
            depth * slotDepth * 0.85,
          );
          scale.set(
            (cell.scale.x / source.width) * slotWidth * 0.85,
            filled ? 0.09 : 0.016,
            (cell.scale.y / source.height) * slotDepth * 0.85,
          );
          if (!cell.visible) scale.setScalar(0);
          mesh.setMatrixAt(instance, transform.compose(position, rotation, scale));
          mesh.setColorAt(instance, filled ? cell.material.color : new T.Color("#d4dfd0"));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
      };
    });
    memoryViews.push(...views);
  };
  const compute = (index: number, active: boolean, color = INK.green) => {
    const chip = hardware.chips[index];
    if (chip) chip.material.color.set(active ? color : "#437465");
  };
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
      line.material.color.set(color);
      packet.material.color.set(color);
      packet.position.copy(route.getPoint(progress));
    };
  };
  const plane = (name: string, point: T.Vector3, size: T.Vector3) => {
    const mesh = box(point, size, "#b7c9bf");
    mesh.material.opacity = 0.2;
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
    memoryViews.forEach((update) => {
      update();
    });
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    for (const item of labels) {
      let visible = true;
      for (let p: T.Object3D | null = item.parent; p; p = p.parent) visible &&= p.visible;
      item.el.hidden = !visible;
      if (!visible) continue;
      projected.copy(item.point);
      item.parent.localToWorld(projected).project(camera);
      item.el.style.left = `${((projected.x + 1) * width) / 2}px`;
      item.el.style.top = `${((1 - projected.y) * height) / 2}px`;
    }
  };
  const reset = () => {
    camera.position.copy(
      compactCache
        ? V(2, 25, 16)
        : spatialCache
          ? V(9, 17, 24)
          : spatialCore
            ? V(compactCore ? 3.2 : 6.6, compactCore ? 21 : 17.8, compactCore ? 21 : 24.5)
            : V(1.4, 5, 30),
    );
    controls.target.set(0, spatialCache ? 0.2 : spatialCore ? -0.35 : -0.15, 0);
    controls.update();
    render();
  };
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    const half = compactCache
      ? Math.max(7.9, (5.2 * height) / width)
      : spatialCore
        ? Math.max(9.25, (8.6 * height) / width)
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
    matrix,
    box,
    wire,
    label,
    ownership,
    memory,
    compute,
    hardwareTransfer,
    plane,
    transfer,
    render,
    reset,
    dispose() {
      disposed = true;
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
