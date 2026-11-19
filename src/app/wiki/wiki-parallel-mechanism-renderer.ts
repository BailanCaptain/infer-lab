import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { scenePalette } from "./scene-palette";
import { parallelHardware } from "./scene-parallel-hardware";
import {
  CP_FOCUS,
  CP_TOKENS,
  cpReadFrame,
  DCP_EXAMPLE,
  DCP_QUERY,
  dcpChannels,
  dcpKeyVector,
  dcpMergeFrame,
  dcpValueVector,
  gridWriteProgress,
  mechanismFrame,
  PARTITIONS,
  PCP_EXAMPLE,
  PCP_QUERIES,
  PP_SETUP,
  pcpMotion,
  ppActivations,
  ringMotion,
  SP_NORMALIZED,
  SP_PARTIALS,
  SP_PROJECTED,
  SP_RMS,
  SP_SUM,
  SP_TOKENS,
  SP_WEIGHT_COLUMNS,
  span,
  spNormalization,
  spProjection,
} from "./scene-parallel-mechanisms";
import { isStrategyKind, TP_KIND } from "./scene-parallel-strategy";
import { setWidePolylinePoints } from "./scene-polyline";
import {
  RING_K,
  RING_Q_VECTOR,
  RING_V,
  ringKeyVector,
  ringValueVector,
  ringVectorOutput,
} from "./scene-ring-data";
import { mountStrategyContent, type StrategyContent } from "./wiki-parallel-strategy-renderer";

const v = (x: number, y: number, z = 0) => new T.Vector3(x, y, z);
const rowColors = ["#497e91", "#a1724b", "#82769c", "#43846e"];
type Tensor = {
  group: T.Group;
  cells: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>[];
  numbers: HTMLElement[];
  title: HTMLElement;
};
type Caption = { el: HTMLElement; parent: T.Object3D; point: T.Vector3; visible: () => boolean };

/** Hardware ownership stays in view; the actual row objects expand, land and retain their result. */
export async function mountParallelMechanism(host: HTMLDivElement, kind: number, signal: AbortSignal) {
  if (signal.aborted) return null;
  const hardware = await parallelHardware(kind, signal);
  if (!hardware) return null;
  const palette = scenePalette(host),
    scene = new T.Scene(),
    root = new T.Group();
  root.add(hardware.group);
  scene.add(root, new T.HemisphereLight(0xffffff, 0xb7c5b2, 2.3));
  const light = new T.DirectionalLight(0xffffff, 2.1);
  light.position.set(-5, 8, 15);
  scene.add(light);
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio || 1, 1.5), 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  const overlay = document.createElement("div");
  overlay.className = "wiki-mechanism-labels";
  host.append(renderer.domElement, overlay);
  const camera = new T.OrthographicCamera(-8, 8, 6.4, -6.4, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = controls.enableZoom = false;
  controls.minPolarAngle = 1.12;
  controls.maxPolarAngle = 1.4;
  controls.minAzimuthAngle = -0.05;
  controls.maxAzimuthAngle = 0.2;
  controls.rotateSpeed = 0.28;
  const geometry = new T.BoxGeometry(1, 1, 1);
  const socketGeometry = new T.BufferGeometry().setFromPoints([
    v(-0.38, 0.5, 0.5),
    v(-0.5, 0.5, 0.5),
    v(-0.5, 0.5, 0.5),
    v(-0.5, -0.5, 0.5),
    v(-0.5, -0.5, 0.5),
    v(-0.38, -0.5, 0.5),
    v(0.38, 0.5, 0.5),
    v(0.5, 0.5, 0.5),
    v(0.5, 0.5, 0.5),
    v(0.5, -0.5, 0.5),
    v(0.5, -0.5, 0.5),
    v(0.38, -0.5, 0.5),
  ]);
  const resources: (T.BufferGeometry | T.Material)[] = [geometry, socketGeometry];
  const captions: Caption[] = [];
  let progress = 0,
    disposed = false,
    width = 1,
    height = 1;
  const material = (color: string, opacity = 1) => {
    const m = new T.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.7 });
    resources.push(m);
    return m;
  };
  const label = (text: string, parent: T.Object3D, point: T.Vector3, kind = "name", visible = () => true) => {
    const el = document.createElement("span");
    el.className = `wiki-mechanism-label ${kind}`;
    el.textContent = text;
    overlay.append(el);
    captions.push({ el, parent, point, visible });
    return el;
  };
  const cube = (parent: T.Object3D, point: T.Vector3, size: T.Vector3, color: string, opacity = 1) => {
    const mesh = new T.Mesh(geometry, material(color, opacity));
    mesh.position.copy(point);
    mesh.scale.copy(size);
    parent.add(mesh);
    return mesh;
  };
  const tensor = (
    name: string,
    values: (number | string)[],
    point: T.Vector3,
    color: string,
    size = 0.78,
  ): Tensor => {
    const group = new T.Group();
    group.position.copy(point);
    root.add(group);
    const cells: Tensor["cells"] = [],
      numbers: HTMLElement[] = [];
    values.forEach((value, i) => {
      const cell = cube(
        group,
        v((i - (values.length - 1) / 2) * (size + 0.045), 0),
        v(size, size * 0.68, 0.36),
        color,
      );
      cells.push(cell);
      numbers.push(
        label(
          String(value),
          cell,
          v(0, 0, 0.515),
          size < 0.5 ? "value small" : "value",
          () => group.visible && cell.material.opacity > 0.5,
        ),
      );
    });
    const title = label(
      name,
      group,
      v(0, size * 0.5 + 0.23, 0.22),
      size < 0.5 ? "name small" : "name",
      () => group.visible,
    );
    return { group, cells, numbers, title };
  };
  const rowTitle = (t: Tensor) => {
    const c = captions.find((c) => c.el === t.title)!;
    c.point.set(-t.cells.length * 0.42 - 0.55, 0, 0.3);
  };
  const set = (t: Tensor, values: (number | string)[], color?: string, opacity = 1) => {
    t.cells.forEach((cell, i) => {
      cell.material.opacity = opacity;
      if (color) cell.material.color.set(color);
      t.numbers[i]!.textContent = String(values[i] ?? "");
    });
  };
  const line = (color: string, dashed = false, linewidth = dashed ? 1.8 : 1.35) => {
    const g = new LineGeometry().setPositions([0, 0, 0, 0, 0, 0]);
    const m = new LineMaterial({
      color,
      linewidth,
      dashed,
      transparent: true,
      opacity: dashed ? 0.68 : 0.95,
      dashSize: 0.16,
      gapSize: 0.12,
      depthWrite: false,
    });
    const item = new Line2(g, m);
    resources.push(g, m);
    root.add(item);
    return item;
  };
  const connect = (l: Line2, points: T.Vector3[]) => {
    setWidePolylinePoints(l, points);
  };
  const outsideRoute = (a: T.Vector3, b: T.Vector3, side: number) =>
    new T.CatmullRomCurve3(
      [a, v(side * 6.1, a.y, 0.8), v(side * 6.1, b.y, 0.8), b],
      false,
      "catmullrom",
      0.1,
    );
  const socket = (parent: T.Object3D, point: T.Vector3, count = 2, size = 0.78) => {
    const m = new T.LineBasicMaterial({ color: palette.result, transparent: true, opacity: 0.5 });
    resources.push(m);
    const frame = new T.LineSegments(socketGeometry, m);
    frame.position.copy(point);
    frame.scale.set(count * (size + 0.045) + 0.12, size * 0.68 + 0.14, 0.5);
    parent.add(frame);
    return frame;
  };
  // A shallow open bracket preserves the matrix boundary without a backplate hiding cells.
  const bracket = (x: number, top: number, bottom: number, halfWidth: number, color: string) => {
    const left = line(color),
      right = line(color);
    connect(left, [
      v(x - halfWidth + 0.15, top, 0.2),
      v(x - halfWidth, top, 0.2),
      v(x - halfWidth, bottom, 0.2),
      v(x - halfWidth + 0.15, bottom, 0.2),
    ]);
    connect(right, [
      v(x + halfWidth - 0.15, top, 0.2),
      v(x + halfWidth, top, 0.2),
      v(x + halfWidth, bottom, 0.2),
      v(x + halfWidth - 0.15, bottom, 0.2),
    ]);
    return [left, right];
  };
  const cut = (x: number, y: number, halfWidth: number) => {
    const l = line("#ae774d", true);
    connect(l, [
      v(x - halfWidth, y, -0.12),
      v(x + halfWidth, y, -0.12),
      v(x + halfWidth, y, 0.7),
      v(x - halfWidth, y, 0.7),
      v(x - halfWidth, y, -0.12),
    ]);
    return l;
  };
  // The bracket and its identity travel with the whole slice, not individual cells.
  const slice = (name: string, color: string) => {
    const group = new T.Group();
    root.add(group);
    const wire = line(color);
    group.add(wire);
    wire.material.opacity = 0.8;
    const tagPoint = v(0, 0, 0.4);
    label(name, group, tagPoint, "name");
    return { group, wire, tagPoint };
  };
  type Grid = Tensor & {
    outlines: Line2[];
    rows: number;
    cols: number;
    half: number;
    top: number;
    pitch: number;
    cellWidth: number;
  };
  // Row names sit just left of the bracket; longer names move further out instead of covering cells.
  const nameWidth = (text: string) =>
    [...text].reduce((w, ch) => w + (/[⺀-鿿＀-￯]/.test(ch) ? 0.26 : 0.14), 0);
  // PP's matrix language, shared by every mechanism: row names, open brackets, channel axis, values in cells.
  const grid = (
    name: string,
    point: T.Vector3,
    color: string,
    o: {
      rows?: number;
      cols?: number;
      rowNames?: readonly string[];
      axis?: string | false;
      focusRow?: number;
      wide?: number;
    } = {},
  ): Grid => {
    const rows = o.rows ?? 4,
      cols = o.cols ?? 8,
      names = o.rowNames ?? SP_TOKENS,
      focus = o.focusRow ?? 3,
      wide = o.wide ?? 1;
    const pitch = 0.385 * wide,
      cellWidth = 0.34 * wide;
    const half = ((cols - 1) / 2) * pitch + 0.2625 + (cellWidth - 0.34) / 2,
      top = ((rows - 1) / 2) * 0.5 + 0.27;
    const group = new T.Group();
    group.position.copy(point);
    root.add(group);
    const cells: Tensor["cells"] = [],
      numbers: HTMLElement[] = [];
    for (let r = 0; r < rows; r++) {
      const y = ((rows - 1) / 2 - r) * 0.5;
      if (names[r]) {
        const w = nameWidth(names[r]!);
        const x = w <= 0.55 ? -half - 0.31 : -half - 0.1 - w / 2;
        label(names[r]!, group, v(x, y, 0.3), "name small", () => group.scale.x > 0.85);
      }
      for (let c = 0; c < cols; c++) {
        const cell = cube(group, v((c - (cols - 1) / 2) * pitch, y), v(cellWidth, 0.4, 0.28), color);
        cells.push(cell);
        numbers.push(
          label(
            "",
            cell,
            v(0, 0, 0.515),
            `value pp-number${r !== focus ? " pp-context-value" : ""}`,
            () => group.scale.x > 0.85,
          ),
        );
      }
    }
    const outlines = bracket(0, top, -top, half, color);
    outlines.forEach((wire) => {
      group.add(wire);
    });
    const title = label(name, group, v(0, top + 0.28, 0.3), "name");
    const axis = o.axis === undefined ? "8 个隐藏通道 →" : o.axis;
    if (axis) label(axis, group, v(0, -top - 0.32, 0.3), "note", () => group.scale.x > 0.85);
    return { group, cells, numbers, title, outlines, rows, cols, half, top, pitch, cellWidth };
  };
  const paper = new T.Color("#e6ece3");
  const fmt = (x: number | string) => (typeof x === "number" ? String(+x.toFixed(2)) : x);
  const paintGrid = (
    t: Pick<Grid, "outlines" | "cells" | "numbers" | "cols" | "pitch" | "cellWidth">,
    values: readonly (readonly (number | string)[])[],
    color: string | ((row: number, column: number) => string),
    amount = 1,
    unfold = 1,
    focus = 3,
  ) => {
    const tint = typeof color === "string" ? () => color : color;
    t.outlines.forEach((wire) => {
      wire.scale.x = 0.15 + 0.85 * unfold;
      wire.material.color.set(tint(0, 0));
    });
    t.cells.forEach((cell, i) => {
      const r = Math.floor(i / t.cols),
        c = i % t.cols,
        value = values[r]?.[c] ?? "";
      const written = gridWriteProgress(amount, r, c, t.cols);
      cell.position.x = (c - (t.cols - 1) / 2) * t.pitch * (0.15 + 0.85 * unfold);
      cell.position.z = 0.2 * Math.sin(written * Math.PI);
      cell.scale.x = t.cellWidth * (0.15 + 0.85 * unfold);
      cell.scale.z = 0.08 + 0.2 * written;
      const shade = typeof value === "number" ? Math.abs(Math.round(value)) % 4 : 0;
      cell.material.color.set(tint(r, c)).lerp(paper, r === focus ? 0 : 0.2 + shade * 0.1);
      cell.material.opacity = 0.15 + 0.85 * written;
      cell.material.emissive.set(written > 0 && written < 1 ? "#3c6752" : "#000");
      t.numbers[i]!.textContent = written === 1 && unfold > 0.9 ? fmt(value) : "";
    });
  };
  const matrixSlot = (point: T.Vector3, scale = 1, cols = 8, rows = 4) => {
    const frame = socket(root, point, cols, 0.34);
    const half = ((cols - 1) / 2) * 0.385 + 0.2625,
      top = ((rows - 1) / 2) * 0.5 + 0.27;
    frame.scale.set((2 * half + 0.02) * scale, (2 * top + 0.06) * scale, 0.5);
    return frame;
  };
  // The travelling matrix's edge follows the line, so enlarging the matrix
  // cannot leave the old centre-to-centre connection drawn across its cells.
  const matrixTransfer = (
    a: T.Vector3,
    b: T.Vector3,
    side: number,
    fromScale: number,
    toScale: number,
    t: number,
    half = 1.61,
    detour = 7.8,
  ) => {
    const edge = (point: T.Vector3, scale: number) => point.clone().add(v(side * half * scale, 0));
    const start = edge(a, fromScale),
      end = edge(b, toScale),
      scale = fromScale + (toScale - fromScale) * t;
    const curve = new T.CatmullRomCurve3(
      [start, v(side * detour, a.y, 0.8), v(side * detour, b.y, 0.8), end],
      false,
      "catmullrom",
      0.1,
    );
    return { position: curve.getPoint(t).add(v(-side * half * scale, 0)), scale, curve };
  };
  const header = label("", root, v(0, 6), "heading");
  const footerPoint = v(0, -6.1);
  const footer = label("", root, footerPoint, "equation");
  root.updateMatrixWorld(true);
  const ports = hardware.points.map((point) => hardware.group.localToWorld(point.clone()));
  const cardStates = hardware.points.map((point, i) => {
    const names = isStrategyKind(kind)
      ? kind === TP_KIND
        ? [`TP 卡${i}`, `输入通道 ${2 * i}、${2 * i + 1}`]
        : [`卡${i}`, ""]
      : kind === 0
        ? [`卡${i}`, `第${2 * i}、${2 * i + 1}层`]
        : kind === 1
          ? [`TP 卡${i}`, `权重片 W${i}`]
          : kind === 2 || kind === 4
            ? [`${kind === 4 ? "Ring" : "PCP"} 卡${i}`, `位置 ${PCP_QUERIES[i]!.join("、")}`]
            : [`DCP 卡${i}`, i === 0 ? "KV 0、2、4、6" : "KV 1、3、5、7"];
    if (hardware.boards === 2) {
      label(names[0]!, hardware.group, point.clone().add(v(0, -0.7, 1.02)), "name small");
      return label("", hardware.group, point, "note");
    }
    label(names[0]!, hardware.group, point.clone().add(v(0, 0.5, -0.1)), "name");
    return label(names[1]!, hardware.group, point.clone().add(v(0, 0.15, -0.1)), "note");
  });
  const portFrames = ports.map((point) => socket(root, point, 1, 0.45));
  const extraction = ports.map((point, i) => {
    const wire = line(i % 2 ? palette.data : palette.result, true);
    wire.material.depthTest = false;
    wire.renderOrder = 10;
    const expandedX = kind === 2 || kind === 4 ? 3.8 : kind === 3 ? 3.5 : 3.35;
    const end = kind === 0 ? v(point.x, 0.2, 0.3) : v(i ? expandedX : -expandedX, -0.3, 0.4);
    const side = (point.x < 0 ? -1 : 1) * (5.3 + (kind === 0 ? (i % 2) * 0.23 : 0));
    connect(wire, [point, v(side, point.y, 1.2), v(side, end.y, 1.2), end]);
    return wire;
  });
  label(
    `高亮的 ${ports.length} 张 NPU 参与本例`,
    hardware.group,
    v(0, 0.3, 2.1),
    "note",
    () => !isStrategyKind(kind) && (kind !== 0 || mechanismFrame(0, progress).setup),
  );
  host.dataset.asset = "atlas-800t-a2.glb:npu×8";
  host.dataset.activeCards = String(ports.length);
  let animateContent: (p: number) => void;
  let strategy: StrategyContent | null = null;

  if (isStrategyKind(kind)) {
    strategy = mountStrategyContent(
      {
        root,
        ports,
        palette,
        cardColors: rowColors,
        label,
        line,
        connect,
        socket,
        grid,
        paintGrid,
        matrixSlot,
        header,
        footer,
        payloads: hardware.payloads,
        hardwareGroup: hardware.group,
        boardCenters: hardware.boardCenters,
      },
      kind,
    );
    animateContent = strategy.animate;
    footerPoint.y = strategy.camera.footerY;
  } else if (kind === 0) {
    const xs = ports.map((p) => p.x);
    const paint = (t: Grid, layer: number, color: string, amount = 1, unfold = 1) =>
      paintGrid(t, ppActivations(layer), color, amount, unfold);
    hardware.payloads.forEach((payload) => {
      payload.visible = false;
    });
    const layers = Array.from({ length: 8 }, (_, i) => {
      const group = new T.Group();
      root.add(group);
      for (let depth = 0; depth < 2; depth++)
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 4; c++)
            cube(
              group,
              v((c - 1.5) * 0.28, (1 - r) * 0.25, -depth * 0.3),
              v(0.25, 0.22, 0.22),
              rowColors[Math.floor(i / 2)]!,
            );
      label(
        `第${i}层`,
        group,
        v(0, -0.7, 0.2),
        "name",
        () => mechanismFrame(kind, progress).setup && mechanismFrame(kind, progress).split < 0.65,
      );
      return group;
    });
    const layerCuts = [1, 3, 5].map((i) => {
      const l = line("#a1724b", true);
      connect(l, [v((i - 3) * 1.38, -0.9, 0), v((i - 3) * 1.38, -2.65, 0)]);
      return l;
    });
    const layerSlices = PARTITIONS[0]!.groups.map((rows, g) =>
      slice(`第${rows[0]}–${rows[1]}层 → 卡${g}`, rowColors[g]!),
    );
    const entryHome = v(0, -4.7, 0.5);
    const entryEnd = v(xs[0]!, 0.2, 0.3);
    const entry = grid("输入 X · 4 个 token × 8 个隐藏通道", entryHome, palette.data, { axis: false });
    const entryRoute = line(palette.data, false, 2.8);
    const entrySlot = matrixSlot(entryEnd, 0.4);
    const beforeFlow = new Set(root.children);
    const flowCaptionStart = captions.length;
    const stageResults = xs.map((x, i) =>
      grid(`卡${i}输出 · 4×8`, v(x, 0.2, 0.3), rowColors[i]!, { axis: false }),
    );
    const stageSlots = xs.map((x) => matrixSlot(v(x, 0.2, 0.3), 0.4));
    const sourceHome = v(-4.5, -2.2, 0.5);
    const source = grid("本段输入 · 4×8", sourceHome, palette.data);
    const middle = grid("第一层输出 · 4×8", v(0, -2.2, 0.5), palette.result);
    const result = grid("本段出口 · 4×8", v(4.5, -2.2, 0.5), palette.result);
    const slot = matrixSlot(sourceHome);
    const extract = line(palette.result, true),
      routeA = line(palette.data, false, 2.8),
      routeB = line(palette.result, false, 2.8),
      inputRoute = line(palette.data, false, 2.8),
      outputRoute = line(palette.result, false, 2.8);
    extract.material.opacity = 0.68;
    connect(routeA, [
      v(-2.89, -2.2, 0.5),
      v(-1.61, -2.2, 0.5),
      v(-1.79, -2.08, 0.5),
      v(-1.61, -2.2, 0.5),
      v(-1.79, -2.32, 0.5),
    ]);
    connect(routeB, [
      v(1.61, -2.2, 0.5),
      v(2.89, -2.2, 0.5),
      v(2.71, -2.08, 0.5),
      v(2.89, -2.2, 0.5),
      v(2.71, -2.32, 0.5),
    ]);
    label("一行是一个 token 的向量 · 整张 4×8 矩阵一起传递", root, v(0, -4.3), "name");
    label("四行都显示当前数值；+1 只示意层间交接，真实层包含 attention / MLP", root, v(0, -5.0), "equation");
    const flowObjects = root.children.filter((o) => !beforeFlow.has(o));
    // Labels on root need the same visibility as their calculation objects.
    const flowLabels = captions.slice(flowCaptionStart).filter((c) => c.parent === root);
    animateContent = (p) => {
      const f = mechanismFrame(0, p);
      const intro = p / PP_SETUP;
      const entering = span(intro, 0.74, 1);
      const entryTransfer = matrixTransfer(entryHome, entryEnd, -1, 1, 0.4, entering);
      entry.group.visible = f.setup;
      entry.group.position.copy(entryTransfer.position);
      entry.group.scale.setScalar(entryTransfer.scale);
      if (f.setup) paint(entry, 0, palette.data, 1, f.reveal);
      entry.title.textContent = entering > 0 ? "输入 X · 4×8" : "输入 X · 4 个 token × 8 个隐藏通道";
      entrySlot.visible = f.setup && intro >= 0.72;
      entryRoute.visible = f.setup && entering > 0;
      connect(entryRoute, entryTransfer.curve.getPoints(40));
      const open = span(f.split, 0, 0.28),
        land = span(f.split, 0.28, 1);
      layers.forEach((layer, i) => {
        const source = v((i - 3.5) * 1.38 + (Math.floor(i / 2) - 1.5) * 0.32 * open, -1.7, 0.4);
        const destination = ports[Math.floor(i / 2)]!.clone().add(
          v(0, -0.35 + (i % 2) * 0.23, (i % 2) * 0.18),
        );
        layer.position.copy(source).lerp(destination, land);
        layer.position.z += Math.sin(land * Math.PI) * 3.2;
        layer.scale.setScalar(1 - 0.45 * land);
        layer.children.forEach((child) => {
          if (child instanceof T.Mesh)
            child.material.color.set("#6e8d80").lerp(new T.Color(rowColors[Math.floor(i / 2)]!), open);
        });
      });
      layerSlices.forEach((s, g) => {
        s.group.visible = f.setup && f.split > 0;
        const a = layers[g * 2]!.position,
          b = layers[g * 2 + 1]!.position;
        s.group.position.copy(a).lerp(b, 0.5);
        const half = (b.x - a.x) / 2 + 0.6 * (1 - 0.45 * land);
        connect(s.wire, [v(-half, -0.85, 0.2), v(-half, -1, 0.2), v(half, -1, 0.2), v(half, -0.85, 0.2)]);
        s.tagPoint.set(0, -1.38, 0.3);
      });
      layerCuts.forEach((c, g) => {
        const midpoint = (layers[g * 2 + 1]!.position.x + layers[g * 2 + 2]!.position.x) / 2;
        c.position.x = midpoint - (g * 2 - 2) * 1.38;
        c.visible = f.setup && f.split > 0 && land === 0;
      });
      flowObjects.forEach((o) => {
        o.visible = !f.setup;
      });
      flowLabels.forEach((c) => {
        c.visible = () => !mechanismFrame(0, progress).setup;
      });
      if (f.setup) {
        header.textContent =
          f.split === 0
            ? "先看全貌 · 一个请求怎样走完 8 层"
            : f.split < 1
              ? "部署模型 · 连续两层归一张卡"
              : "开始这条请求 · 卡0 接收整张输入矩阵";
        footer.textContent = "";
        return;
      }
      header.textContent = `8 层完整结构 · 当前在卡${f.stage}计算第${f.stage * 2}、${f.stage * 2 + 1}层`;
      footer.textContent =
        f.stage === 3 && f.second === 1
          ? "最终隐藏状态 4×8 → 出口归一化、词表打分与采样（未展开）"
          : "接收 → 第一层 → 第二层 → 下一段；同一请求依次计算";
      const previous = f.stage === 0 ? v(xs[0]!, 0.2, 0.3) : v(xs[f.stage - 1]!, 0.2, 0.3);
      const receiveTransfer = matrixTransfer(previous, sourceHome, -1, 0.4, 1, f.receive);
      source.group.position.copy(receiveTransfer.position);
      source.group.scale.setScalar(receiveTransfer.scale);
      paint(source, f.stage * 2, f.stage === 0 ? palette.data : rowColors[f.stage - 1]!);
      source.title.textContent =
        f.receive < 1 ? (f.stage === 0 ? "输入 X · 4×8" : `卡${f.stage - 1}的输出 · 4×8`) : "本段输入 · 4×8";
      [source.title, ...source.numbers].forEach((el) => {
        el.style.opacity = String(f.stage === 0 ? 1 : span(f.receive, 0.25, 0.5));
      });
      paint(middle, f.stage * 2 + 1, rowColors[f.stage]!, f.first);
      middle.title.textContent = `第${f.stage * 2}层输出 · 各通道 +1`;
      paint(result, f.stage * 2 + 2, rowColors[f.stage]!, f.second);
      result.title.textContent = `第${f.stage * 2 + 1}层输出 · 各通道 +1`;
      result.group.visible = f.second !== 1 || f.local < 0.84;
      routeA.visible = f.receive === 1;
      routeA.material.opacity = f.first < 1 ? 0.95 : 0.45;
      routeB.visible = result.group.visible && f.first === 1;
      routeB.material.opacity = f.second < 1 ? 0.95 : 0.45;
      slot.visible = f.receive < 1;
      slot.material.opacity = 0.8;
      inputRoute.visible = f.receive > 0 && f.receive < 1;
      inputRoute.material.color.set(f.stage === 0 ? palette.data : rowColors[f.stage - 1]!);
      connect(inputRoute, receiveTransfer.curve.getPoints(40));
      const currentPort = ports[f.stage]!,
        side = currentPort.x < 0 ? -5.5 : 5.5;
      connect(extract, [
        currentPort,
        v(side, currentPort.y, 1.2),
        v(side, -0.65, 1.2),
        v(0, -0.65, 0.5),
        v(0, -0.75, 0.5),
      ]);
      outputRoute.visible = f.second === 1 && f.local >= 0.84 && f.local < 1;
      stageResults.forEach((t, i) => {
        t.group.visible = i < f.stage || (i === f.stage && f.second === 1 && f.local >= 0.84);
        t.group.position.set(xs[i]!, 0.2, 0.3);
        t.group.scale.setScalar(0.4);
        if (t.group.visible) paint(t, i * 2 + 2, rowColors[i]!);
        if (i === f.stage && f.second === 1) {
          const land = span(f.local, 0.84, 1);
          const returning = matrixTransfer(result.group.position, v(xs[i]!, 0.2, 0.3), 1, 1, 0.4, land);
          t.group.position.copy(returning.position);
          t.group.scale.setScalar(returning.scale);
          connect(outputRoute, returning.curve.getPoints(40));
        }
        stageSlots[i]!.visible = i === f.stage && f.second === 1 && f.local >= 0.82;
        stageSlots[i]!.material.opacity = 0.7;
      });
    };
  } else if (kind === 1) {
    const xs = [-3.35, 3.35];
    const rowStretch = 1.25;
    const projectionY = -5.55;
    const emptyRow = () => Array(PARTITIONS[1]!.columns).fill("");
    const channelIndices = [0, 1, 2, 3];
    const rowName = (r: number) => `${SP_TOKENS[r]} t${r}`;
    const sequence = SP_TOKENS.map((token, r) => {
      const t = tensor(token, ["·", "·", "·", "·"], v(0, -0.95 - r * 0.7, 0.35), palette.data);
      rowTitle(t);
      t.group.scale.x = rowStretch;
      return t;
    });
    label("完整序列 · 4 行 × 4 通道", root, v(0, -0.25, 0.4), "name", () => {
      const f = mechanismFrame(kind, progress);
      return f.phase === 0 && f.local < 0.4;
    });
    const matrixNames = xs.map((x, i) => label(`卡${i} · 部分和 [4,4]`, root, v(x, -0.25, 0.4), "name"));
    const shapeLabels = xs.map((x) =>
      label(
        "H=4 通道 →",
        root,
        v(x, -3.9, 0.4),
        "note",
        () => ![1, 4].includes(mechanismFrame(kind, progress).phase),
      ),
    );
    const cuts = xs.map((x) => cut(x, -2.05, 2.2));
    const frames = xs.map((x) => bracket(x, -0.65, -4, 2.2, "#69867a"));
    const rowSlices = xs.map(() => [0, 1].map((g) => slice(`卡${g}负责`, rowColors[g]!)));
    const pos = (g: number, r: number) => {
      const f = mechanismFrame(kind, progress);
      const compact = f.phase === 2 ? span(f.local, 0, 0.2) : f.phase === 3 ? 1 - span(f.local, 0, 0.15) : 0;
      const gap =
        f.phase === 0
          ? f.split * 0.55
          : f.phase === 1
            ? 0.55
            : f.phase === 4
              ? 0.55 * (1 - span(f.local, 0, 0.08))
              : 0.55 * (1 - compact);
      return v(
        xs[g]! - (f.phase === 4 ? 0.85 * span(f.local, 0, 0.08) : 0),
        -0.95 - r * 0.7 + (Math.floor(r / 2) === g ? g * 1.4 * compact : 0) - (r >= 2 ? gap : 0),
        0.35,
      );
    };
    const rows = xs.map((_, g) =>
      SP_PARTIALS[g]!.map((values, r) =>
        tensor(rowName(r), values, pos(g, r), rowColors[Math.floor(r / 2)]!),
      ),
    );
    rows.flat().forEach((t) => {
      rowTitle(t);
      t.group.scale.x = rowStretch;
    });
    const slots = xs.map((_, g) => SP_PARTIALS[g]!.map((_, r) => socket(root, pos(g, r), 4)));
    slots.flat().forEach((slot) => {
      slot.scale.x *= rowStretch;
    });
    const routes = Array.from({ length: 4 }, (_, r) => line(rowColors[Math.floor(r / 2)]!, false, 2.8));
    const arriving = SP_SUM.map((_, r) =>
      tensor(
        `t${r} · 接收`,
        SP_PARTIALS[1 - Math.floor(r / 2)]![r]!,
        pos(1 - Math.floor(r / 2), r),
        rowColors[Math.floor(r / 2)]!,
      ),
    );
    const norms = xs.map((x, g) => {
      const input = tensor("", emptyRow(), v(x, -3.2, 0.7), rowColors[g]!);
      const result = tensor("", emptyRow(), v(x, -4.8, 0.7), rowColors[g]!);
      [input, result].forEach((t) => {
        t.group.scale.x = rowStretch;
      });
      captions.find((c) => c.el === result.title)!.point.set(0, -0.62, 0.3);
      const divisor = label("", root, v(x, -4.02, 0.7), "operator", () => {
        const n = spNormalization(progress);
        return n.enabled && n.landed === 1 && n.written[n.rows[g]!]! < 1;
      });
      const take = line(rowColors[g]!, true),
        write = line(rowColors[g]!, false, 2.8);
      const channels = channelIndices.map(() => line(rowColors[g]!, false, 2.8));
      return { input, result, divisor, take, write, channels };
    });
    const sum = tensor("逐通道相加", emptyRow(), v(4.8, -5.15, 0.6), palette.result);
    sum.group.scale.x = rowStretch;
    arriving.forEach((tensor) => {
      tensor.group.scale.x = rowStretch;
    });
    const operandsLanded = () => {
      const frame = mechanismFrame(kind, progress);
      const rowProgress = (frame.local * 4) % 1;
      return frame.phase === 1 && rowProgress >= 0.45 && rowProgress < 0.85;
    };
    label("+", root, v(-2.4, -5.15, 0.6), "operator", operandsLanded);
    label("=", root, v(2.4, -5.15, 0.6), "operator", operandsLanded);
    const sumRoute = line(palette.result, false, 2.8);
    const projections = xs.map((x, g) => {
      const weight = tensor(
        `权重列 ${g}`,
        SP_WEIGHT_COLUMNS[g]!,
        v(x - 1.45, projectionY, 0.5),
        palette.weight,
        0.56,
      );
      const products = tensor("逐项乘积", emptyRow(), v(x, projectionY, 1.1), rowColors[g]!, 0.56);
      // Leave room for decimal values without shrinking the label font.
      [weight, products].forEach((t) => {
        t.group.scale.x = 1.35;
      });
      [weight, products].forEach((t) => {
        t.cells.forEach((cell, c) => {
          cell.position.set(0, 1.02 - c * 0.68, 0);
        });
        captions.find((c) => c.el === t.title)!.point.set(0, -1.65, 0.35);
      });
      const output = Array.from({ length: 4 }, (_, r) =>
        tensor("", [""], v(x + 1.8, pos(g, r).y, 0.4), rowColors[Math.floor(r / 2)]!, 0.8),
      );
      const name = label(
        `输出列 ${g}`,
        root,
        v(x + 1.8, -0.25),
        "note",
        () => spProjection(progress).enabled,
      );
      const slots = output.map((t) => socket(root, t.group.position, 1, 0.8));
      const inputRoute = line(rowColors[g]!, false, 2.8),
        writeRoute = line(palette.result, false, 2.8);
      const result = tensor("", [""], v(x + 1.8, projectionY, 0.5), palette.result, 0.8);
      channelIndices.forEach((c) => {
        label(
          "×",
          root,
          v(x - 0.72, projectionY + 1.02 - c * 0.68, 0.5),
          "operator",
          () =>
            spProjection(progress).enabled &&
            spProjection(progress).landed === 1 &&
            spProjection(progress).multiplied < 1,
        );
      });
      label(
        "+",
        root,
        v(x + 0.95, projectionY, 1.5),
        "operator",
        () =>
          spProjection(progress).enabled &&
          spProjection(progress).multiplied === 1 &&
          spProjection(progress).written[spProjection(progress).row]! < 1,
      );
      const sumLines = channelIndices.map(() => line(palette.result, false, 2.8));
      const extraction = line(palette.weight, true);
      connect(extraction, [
        ports[g]!,
        v(g ? 6.8 : -6.8, ports[g]!.y, 1.4),
        v(g ? 6.8 : -6.8, projectionY + 1.45, 1.4),
        v(x - 1.45, projectionY + 1.45, 0.5),
        v(x - 1.45, projectionY + 1.22, 0.5),
      ]);
      return { weight, products, output, name, slots, inputRoute, writeRoute, result, extraction, sumLines };
    });
    const finalOutput = SP_PROJECTED.map((row, r) => {
      const out = tensor(
        SP_TOKENS[r]!,
        row.map((n) => +n.toFixed(2)),
        v(0, -1.15 - r * 0.7, 0.6),
        palette.result,
        0.8,
      );
      rowTitle(out);
      return out;
    });
    label("输出对照：4 行 × 2 通道", root, v(0, -0.35, 0.6), "name", () => progress >= 0.963);
    animateContent = (p) => {
      const f = mechanismFrame(kind, p),
        phase = f.phase;
      const local = phase === 3 ? Math.max(0, (f.local - 0.18) / 0.82) : f.local;
      const norm = spNormalization(p);
      const introducing = phase === 0 && f.local < 0.4;
      const unfold = phase === 0 ? span(f.local, 0.4, 0.62) : 1;
      // The whole sequence writes in row by row, as PP's input matrix does, so the intro is never a still frame.
      const intro = phase === 0 ? span(f.local, 0, 0.34) : 1;
      sequence.forEach((t, r) => {
        t.group.visible = introducing;
        t.cells.forEach((cell, c) => {
          const written = gridWriteProgress(intro, r, c, t.cells.length);
          cell.material.opacity = 0.15 + 0.85 * written;
          cell.position.z = 0.2 * Math.sin(written * Math.PI);
        });
      });
      cuts.forEach((c) => {
        c.visible = phase <= 1 && unfold === 1;
        c.material.opacity = phase === 0 ? 0.2 + f.split * 0.7 : 0.4;
      });
      matrixNames.forEach((name, g) => {
        name.style.visibility = introducing || unfold < 0.5 ? "hidden" : "";
        name.textContent = `卡${g} · ${phase < 2 ? "同四行的不同贡献" : phase === 2 ? "本卡两行激活" : phase === 3 ? "收齐归一化后的四行" : "输入"}`;
      });
      rowSlices.forEach((slices, card) => {
        slices.forEach((s, g) => {
          s.group.visible = (phase <= 1 && unfold === 1) || (phase === 2 && card === g);
          const a = pos(card, g * 2),
            b = pos(card, g * 2 + 1);
          s.group.position.copy(a).lerp(b, 0.5);
          const half = (a.y - b.y) / 2 + 0.29;
          connect(s.wire, [v(2.08, half, 0.3), v(2.25, half, 0.3), v(2.25, -half, 0.3), v(2.08, -half, 0.3)]);
          s.tagPoint.set(3, 0, 0.3);
        });
      });
      frames.forEach((pair, g) => {
        pair.forEach((l) => {
          l.visible = !introducing && unfold === 1;
          l.scale.y =
            phase === 2
              ? 1 - span(f.local, 0, 0.2) * 0.48
              : phase === 3
                ? 0.52 + span(f.local, 0, 0.15) * 0.48
                : 1;
          l.position.y = -0.65 * (1 - l.scale.y);
          l.position.x = phase === 4 ? -0.85 * span(f.local, 0, 0.08) : 0;
          l.material.color.set(phase === 2 ? rowColors[g]! : "#69867a");
        });
      });
      shapeLabels.forEach((l) => {
        l.textContent = phase === 2 ? "两行，每行四个通道" : "一行一个 token · 四列是四个通道 →";
        captions.find((c) => c.el === l)!.point.y = -4.3;
        l.style.visibility = introducing || unfold < 1 || phase === 2 || phase === 3 ? "hidden" : "";
      });
      sum.group.visible = false;
      sumRoute.visible = false;
      header.textContent = [
        introducing ? "完整序列：每个 token 对应一整行激活" : "TP 产生两份贡献 · SP 再按行相加并分工",
        "Reduce-Scatter · 同位置相加，每卡只留自己的行",
        "本地 RMSNorm · 每卡只算两行",
        "All-Gather · 把另一卡的行收齐，不做相加",
        "同一份输入 × 本卡权重列 · 输出各占一列",
      ][phase]!;
      footer.textContent = [
        "示意分词：今天 / 天气 / 很 / 好 · 切在行间，每个 token 的四个通道一起保留",
        "先接收另一份部分和，再相加；结果只留在负责它的卡",
        "γ=1，忽略 ε 与残差；这一段没有跨卡通信",
        "每卡重新持有 4 行 → 下一列并行投影",
        p >= 0.999
          ? "两列并排对照 · 仍分别存于卡0、卡1，未额外通信"
          : "输入行不改变；两卡的输出列一起组成下一份激活，不再相加",
      ][phase]!;
      captions.find((c) => c.el === footer)!.point.y = phase === 4 ? -8.15 : -6.1;
      for (let r = 0; r < 4; r++) {
        const owner = Math.floor(r / 2),
          other = 1 - owner;
        const localRow = Math.max(0, Math.min(1, local * 4 - r));
        const travel = span(localRow, phase === 1 ? 0.12 : 0, phase === 1 ? 0.45 : 0.65);
        const destination = phase === 1 ? owner : other;
        const origin = phase === 1 ? other : owner;
        const a = pos(origin, r),
          b = phase === 1 ? v(0, -5.15, 0.6) : pos(destination, r);
        const packet = arriving[r]!;
        packet.group.visible =
          (phase === 1 || phase === 3) && local * 4 >= r && local * 4 < r + (phase === 1 ? 0.85 : 1);
        if (phase === 3 && f.local < 0.18) packet.group.visible = false;
        const curve = phase === 1 ? outsideRoute(a, b, origin === 0 ? -1 : 1) : new T.LineCurve3(a, b);
        packet.group.position.copy(curve.getPoint(travel));
        if (phase === 3 && travel === 1) packet.group.visible = false;
        set(packet, phase === 1 ? SP_PARTIALS[other]![r]! : SP_NORMALIZED[r]!);
        // AllGather copies a retained row: keep names at its ports, not across the source cells.
        packet.title.textContent = phase === 1 && travel > 0.06 ? `卡${other} · ${rowName(r)}` : "";
        packet.numbers.forEach((el) => {
          el.style.opacity = String(phase === 3 ? span(travel, 0.44, 0.5) : 1);
        });
        const packetCaption = captions.find((c) => c.el === packet.title)!;
        packetCaption.point.set(-2.5, 0, 0.3);
        if (phase === 1) packetCaption.point.lerp(v(0, 0.65, 0.3), travel);
        const l = routes[r]!;
        l.visible = packet.group.visible && travel < 1;
        connect(l, curve.getPoints(32));
        for (let g = 0; g < 2; g++) {
          const t = rows[g]![r]!;
          t.group.position.copy(pos(g, r));
          // These are different TP contributions, not two copies of the completed activation.
          // Reveal them in separate lanes so their numeric rows never pass through one another.
          if (phase === 0) t.group.position.x *= 0.86 + 0.14 * unfold;
          rowTitle(t);
          // During copying, keep card 1's row names outside the communication corridor.
          captions.find((c) => c.el === t.title)!.point.x = phase === 3 && g === 1 ? 2.25 : -2.25;
          t.group.visible = !introducing;
          t.title.textContent =
            (phase === 0 && unfold < 0.5) || (phase === 2 && g !== owner) ? "" : rowName(r);
          if (phase === 2 && g !== owner) t.group.visible = false;
          if (phase === 3 && f.local < 0.15 && g !== owner) t.group.visible = false;
          let vals: (number | string)[] = SP_PARTIALS[g]![r]!,
            opacity = phase === 0 ? unfold : 1;
          if (phase === 1) {
            if (local * 4 >= r + 1) vals = g === owner ? SP_SUM[r]! : emptyRow();
            if (g === other && local * 4 >= r) {
              vals = emptyRow();
              opacity = 0.15;
              t.title.textContent = "";
            }
            if (g === owner && local * 4 >= r && local * 4 < r + 1) {
              t.title.textContent = `卡${owner} · ${rowName(r)}`;
              captions.find((c) => c.el === t.title)!.point.lerp(v(0, 0.65, 0.3), span(localRow, 0, 0.18));
              t.group.position.copy(
                outsideRoute(pos(g, r), v(-4.8, -5.15, 0.6), g === 0 ? -1 : 1).getPoint(
                  span(localRow, 0, 0.18),
                ),
              );
              t.group.visible = localRow < 0.85;
              sum.group.visible = localRow >= 0.62;
              const returnRoute = outsideRoute(pos(owner, r), v(4.8, -5.15, 0.6), owner === 0 ? -1 : 1);
              sum.group.position.copy(returnRoute.getPoint(1 - span(localRow, 0.85, 1)));
              set(sum, SP_SUM[r]!, rowColors[Math.floor(r / 2)]!);
              sum.title.textContent = localRow < 0.85 ? `合齐 → 卡${owner}` : "";
              rowTitle(sum);
              captions
                .find((c) => c.el === sum.title)!
                .point.copy(v(0, 0.65, 0.3))
                .lerp(v(-2.5, 0, 0.3), span(localRow, 0.85, 1));
              sumRoute.visible = localRow >= 0.85;
              connect(sumRoute, returnRoute.getPoints(36));
            }
          }
          if (phase >= 2) {
            if (g === owner) {
              vals = norm.written[r] === 1 ? SP_NORMALIZED[r]! : SP_SUM[r]!;
              if (norm.enabled && norm.rows[g] === r && norm.local >= 0.04 && norm.written[r]! < 1)
                opacity = 0.18;
            } else {
              vals = phase > 3 || (phase === 3 && local * 4 >= r + 0.65) ? SP_NORMALIZED[r]! : emptyRow();
              opacity = vals[0] === "" ? 0.13 : 1;
              if (vals[0] === "") {
                t.title.textContent =
                  phase === 3 && f.local >= 0.18 && local * 4 >= r && local * 4 < r + 1 ? rowName(r) : "";
              }
            }
          }
          set(t, vals, undefined, opacity);
          slots[g]![r]!.material.opacity =
            g === destination && (phase === 1 || phase === 3) && local * 4 >= r && local * 4 < r + 1
              ? 0.95
              : 0.16;
          slots[g]![r]!.position.copy(pos(g, r));
          slots[g]![r]!.visible =
            g === destination &&
            (phase === 1 || (phase === 3 && f.local >= 0.18)) &&
            local * 4 >= r &&
            local * 4 < r + 1;
          if (norm.enabled && norm.rows[g] === r && norm.written[r]! < 1) {
            slots[g]![r]!.visible = true;
            slots[g]![r]!.material.opacity = 0.85;
          }
        }
      }
      norms.forEach((n, g) => {
        const r = norm.rows[g]!,
          live = norm.enabled && norm.local >= 0.04 && norm.written[r]! < 1;
        const home = pos(g, r),
          bench = v(xs[g]!, -3.2, 0.7);
        const route = new T.CubicBezierCurve3(
          home,
          v(xs[g]! + (g ? 2.6 : -2.6), home.y, 1.1),
          v(xs[g]! + (g ? 2.6 : -2.6), -3.2, 1.1),
          bench,
        );
        n.input.group.visible = live;
        n.input.group.position.copy(route.getPoint(norm.landed));
        n.input.title.textContent = norm.landed === 1 && norm.written[r] === 0 ? `${rowName(r)} · 原值` : "";
        n.input.numbers.forEach((el) => {
          el.style.opacity = String(span(norm.landed, 0.1, 0.3));
        });
        set(n.input, SP_SUM[r]!);
        n.take.visible = live;
        connect(n.take, route.getPoints(32));
        n.divisor.textContent = `÷ RMS ${SP_RMS[r]}`;
        const resultHome = v(xs[g]!, -4.8, 0.7),
          written = norm.written[r]!;
        const back = new T.CubicBezierCurve3(
          resultHome,
          v(xs[g]! + (g ? 2.6 : -2.6), -4.8, 1.1),
          v(xs[g]! + (g ? 2.6 : -2.6), home.y, 1.1),
          home,
        );
        n.result.group.visible = live && norm.divided === 1;
        n.result.group.position.copy(back.getPoint(written));
        n.result.title.textContent = written === 0 ? `${rowName(r)} · 归一化后` : "";
        set(n.result, SP_NORMALIZED[r]!);
        n.write.visible = n.result.group.visible && written > 0;
        connect(n.write, back.getPoints(32));
        n.channels.forEach((l, c) => {
          l.visible = live && norm.landed === 1 && written === 0;
          const x = xs[g]! + (c - 1.5) * 0.825 * rowStretch;
          connect(l, [v(x, -3.5, 0.7), v(x, -4.5, 0.7)]);
        });
      });
      const projection = spProjection(p);
      const reveal = phase === 4 ? span(f.local, 0.78, 0.98) : 0;
      finalOutput.forEach((out, r) => {
        out.group.visible = reveal > 0;
        out.cells.forEach((cell, g) => {
          const from = projections[g]!.output[r]!.group.position.clone().sub(out.group.position);
          cell.position.copy(from).lerp(v((g - 0.5) * 0.845, 0, 0), reveal);
        });
        out.title.textContent = reveal === 1 ? SP_TOKENS[r]! : "";
      });
      projections.forEach((item, g) => {
        const { row, local, landed, multiplied, written, enabled } = projection;
        [item.weight.group, item.products.group, item.extraction].forEach((o) => {
          o.visible = enabled && written[row]! < 1;
        });
        item.output.forEach((out, r) => {
          out.group.position.y = pos(g, r).y;
          item.slots[r]!.position.copy(out.group.position);
          out.group.visible = enabled && written[r] === 1 && reveal === 0;
          set(out, [+SP_PROJECTED[r]![g]!.toFixed(2)]);
          item.slots[r]!.visible = enabled && row === r && written[r]! < 1;
          item.slots[r]!.material.opacity = 0.8;
        });
        rows[g]!.forEach((t, r) => {
          t.cells.forEach((c) => {
            c.material.emissive.set(enabled && r === row ? "#355b4c" : "#000");
          });
        });
        const start = pos(g, row),
          end = v(xs[g]!, projectionY, 1.1);
        const path = new T.CubicBezierCurve3(
          start,
          v(xs[g]! + 4.2, start.y, 1.1),
          v(xs[g]! + 4.2, projectionY, 1.1),
          end,
        );
        item.products.group.position.copy(path.getPoint(landed));
        item.products.group.visible = enabled && local >= 0.1 && written[row]! < 1;
        // Keep the copy's labels off the retained matrix until it clears the source row.
        item.products.numbers.forEach((el) => {
          el.style.opacity = String(span(landed, 0.55, 0.75));
        });
        const fold = span(landed, 0.75, 1);
        item.products.cells.forEach((cell, c) => {
          cell.position.set((c - 1.5) * 0.825 * (1 - fold), (1.02 - c * 0.68) * fold, 0);
        });
        set(
          item.products,
          SP_NORMALIZED[row]!.map(
            (n, c) => +(multiplied === 1 ? n * SP_WEIGHT_COLUMNS[g]![c]! : n).toFixed(2),
          ),
          rowColors[Math.floor(row / 2)]!,
        );
        item.inputRoute.material.color.set(rowColors[Math.floor(row / 2)]!);
        item.products.title.textContent = landed === 1 ? (multiplied === 1 ? "乘积" : "输入") : "";
        item.sumLines.forEach((l, c) => {
          l.visible = enabled && multiplied === 1 && local < 0.7;
          connect(l, [
            v(xs[g]! + 0.28, projectionY + 1.02 - c * 0.68, 1.1),
            v(xs[g]! + 1, projectionY, 0.8),
            v(xs[g]! + 1.4, projectionY, 0.5),
          ]);
        });
        item.inputRoute.visible = enabled && local >= 0.1 && landed < 1;
        connect(item.inputRoute, path.getPoints(32));
        const outHome = item.output[row]!.group.position;
        const resultPath = new T.QuadraticBezierCurve3(
          v(xs[g]! + 1.8, projectionY, 0.5),
          v(xs[g]! + 2.55, projectionY + 0.15, 1.1),
          outHome,
        );
        item.result.group.visible = enabled && local >= 0.65 && written[row]! < 1;
        item.result.group.position.copy(resultPath.getPoint(written[row]!));
        set(item.result, [+SP_PROJECTED[row]![g]!.toFixed(2)], rowColors[Math.floor(row / 2)]!);
        item.writeRoute.visible = item.result.group.visible && written[row]! > 0;
        connect(item.writeRoute, resultPath.getPoints(32));
      });
      if (reveal > 0) {
        rows.flat().forEach((t) => {
          t.group.visible = false;
        });
        frames.flat().forEach((l) => {
          l.visible = false;
        });
        rowSlices.flat().forEach((s) => {
          s.group.visible = false;
        });
        matrixNames.forEach((n) => {
          n.style.visibility = "hidden";
        });
        shapeLabels.forEach((n) => {
          n.style.visibility = "hidden";
        });
        projections.forEach((item) => {
          item.name.style.visibility = "hidden";
        });
        header.textContent = "保留四个 token 行 · 输出宽度从四通道变为两通道";
        footer.textContent = "左列归卡0，右列归卡1 · 并列展开供对照，不表示额外收集通信";
        captions.find((c) => c.el === footer)!.point.y = -4.3;
      } else
        projections.forEach((item) => {
          item.name.style.visibility = "";
        });
    };
  } else if (kind === 2) {
    const xs = [-3.8, 3.8];
    const landedRotation = hardware.group.quaternion
      .clone()
      .multiply(new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0)));
    ports.forEach((point, g) => {
      // The expanded row plane lands on the actual payload plane, not above its label port.
      point.add(v(0, -0.5, 0).multiply(hardware.group.scale).applyQuaternion(hardware.group.quaternion));
      portFrames[g]!.position.copy(point);
      portFrames[g]!.quaternion.copy(landedRotation);
      portFrames[g]!.scale.set(0.98, 0.9, 0.25);
      const side = g ? 5.3 : -5.3;
      connect(extraction[g]!, [point, v(side, point.y, 1.2), v(side, -0.3, 1.2), v(xs[g]!, -0.3, 0.4)]);
    });
    const payloadMaterials = hardware.payloads.flatMap((t) =>
      Array.isArray(t.material) ? t.material : [t.material],
    );
    payloadMaterials.forEach((m) => {
      m.transparent = true;
    });
    const ownerOf = (q: number) => (PCP_QUERIES[0]!.includes(q) ? 0 : 1);
    const source = (q: number, gap = 0) => v(0, -0.8 - q * 0.49 - Math.floor(q / 2) * gap, 0.35);
    const target = (q: number) => {
      const slot = PCP_QUERIES[ownerOf(q)]!.indexOf(q);
      return v(xs[ownerOf(q)]!, -1.05 - slot * 0.49 - Math.floor(slot / 2) * 0.22, 0.4);
    };
    const kvPoint = (g: number, p: number) => v(g ? 1.15 : -1.15, -1.05 - p * 0.46, 0.5);
    const names = xs.map((x, i) =>
      label(`卡${i} · Q [4,4]`, root, v(x, -0.3), "name", () => pcpMotion(progress).assign > 0),
    );
    const fullName = label(
      "一句话的输入 X · 8 行 × 4 个通道",
      root,
      v(0, -0.12),
      "name",
      () => pcpMotion(progress).localKV === 0,
    );
    const outlines = bracket(0, -0.43, -4.7, 1.28, "#69867a");
    const cuts = [1, 3, 5].map((q) => cut(0, -0.8 - (q + 0.5) * 0.49, 1.3));
    label(
      "一行 = 一个 token 的隐藏向量 · 横向通道不切 →",
      root,
      v(0, -5.35),
      "name",
      () => mechanismFrame(kind, progress).phase === 0,
    );
    const balance = xs.map((x, g) =>
      label(
        `卡${g}`,
        root,
        v(x, -4.65),
        "name",
        () => pcpMotion(progress).phase === 0 && pcpMotion(progress).local >= 0.25,
      ),
    );
    const querySlices = Array.from({ length: 4 }, (_, g) => slice(`段${g}`, rowColors[ownerOf(g * 2)]!));
    const frames = xs.map((x) => bracket(x, -0.7, -3.1, 1.28, "#69867a"));
    const rows = Array.from({ length: 8 }, (_, q) =>
      tensor(`位置${q}`, PCP_EXAMPLE.queries[q]!, source(q), rowColors[ownerOf(q)]!, 0.52),
    );
    const outputs = rows.map((_, q) =>
      tensor(`输出${q}`, PCP_EXAMPLE.outputs[q]!, target(q), rowColors[ownerOf(q)]!, 0.52),
    );
    const ghosts = rows.map((_, q) =>
      tensor("", Array(4).fill(""), source(q, 0.22), rowColors[ownerOf(q)]!, 0.52),
    );
    [...rows, ...outputs].forEach((t, i) => {
      // Keep row identities outside both matrices, leaving the K/V read corridor clear.
      const side = ownerOf(i % rows.length) === 0 ? -1 : 1;
      captions.find((c) => c.el === t.title)!.point.set(side * 1.72, 0, 0.3);
    });
    const kvNames = [0, 1].map((g) =>
      label(
        "可读历史 K / V",
        root,
        v(g ? 1.15 : -1.15, -0.3),
        "note",
        () => pcpMotion(progress).localKV > 0.9 && pcpMotion(progress).phase < 3,
      ),
    );
    const kv = [0, 1].map((g) =>
      Array.from({ length: 8 }, (_, p) => {
        const t = tensor(`p${p}`, Array(8).fill(""), kvPoint(g, p), rowColors[ownerOf(p)]!, 0.17);
        t.cells.forEach((cell, d) => {
          cell.position.x += d < 4 ? -0.07 : 0.07;
        });
        t.title.className = "wiki-mechanism-label name";
        captions.find((c) => c.el === t.title)!.point.set(-1.08, 0, 0.3);
        return t;
      }),
    );
    const kvSlots = [0, 1].map((g) =>
      Array.from({ length: 8 }, (_, p) => socket(root, kvPoint(g, p), 8, 0.17)),
    );
    const accesses = xs.map(() => line("#b78243", false, 2.8));
    const valueReads = xs.map(() => line(palette.result, false, 2.8));
    const valueSamples = xs.map((x, g) =>
      tensor("当前 V · 4 通道", ["", "", "", ""], v(x, -4.85, 0.65), rowColors[g]!, 0.62),
    );
    const sums = xs.map((x, g) =>
      tensor("取回的内容总和 · 4通道", [0, 0, 0, 0], v(x, -6.3, 0.65), rowColors[g]!, 0.62),
    );
    [...valueSamples, ...sums].forEach((t) => {
      t.numbers.forEach((el) => {
        el.className = "wiki-mechanism-label value pp-number";
      });
      t.title.className = "wiki-mechanism-label name";
    });
    const sumRoutes = xs.map((x) => {
      const l = line(palette.result, false, 2.8);
      connect(l, [
        v(x + 1.31, -4.85, 0.65),
        v(x + 1.8, -4.85, 0.65),
        v(x + 1.8, -6.3, 0.65),
        v(x + 1.31, -6.3, 0.65),
      ]);
      return l;
    });
    const activeHistory = xs.map(() => socket(root, v(0, 0), 8, 0.17));
    const focusedQueries = CP_FOCUS.map((q) => socket(root, target(q), 4, 0.52));
    const counts = xs.map((x) =>
      label("", root, v(x, -7.15), "equation", () => pcpMotion(progress).phase === 2),
    );
    const completion = xs.map((x) =>
      label("", root, v(x, -5.05), "name", () => pcpMotion(progress).phase === 3),
    );
    const flightRows: Tensor[][] = [];
    const flight = xs.map((x, g) => {
      const group = new T.Group();
      root.add(group);
      flightRows[g] = PCP_QUERIES[g]!.map((q) => {
        const t = tensor(`o${q}`, PCP_EXAMPLE.outputs[q]!, v(0, 0), rowColors[g]!, 0.52);
        group.add(t.group);
        t.group.position.copy(target(q)).sub(v(x, -1.9, 0.4));
        const title = captions.find((c) => c.el === t.title)!;
        title.point.set(-1.48, 0, 0.3);
        title.visible = () => false;
        t.numbers.forEach((el) => {
          captions.find((c) => c.el === el)!.visible = () => false;
        });
        return t;
      });
      return group;
    });
    const writeRoutes = xs.map(() => line(palette.result, false, 2.8));
    animateContent = (p) => {
      const f = pcpMotion(p),
        { phase, local, split } = f;
      balance.forEach((l, g) => {
        l.textContent = `卡${g}：${local < 0.65 ? (g ? 26 : 10) : 18} 次评分`;
      });
      header.textContent = [
        local < 0.25 ? "先看输入 · 一句话的 8 个位置" : "再看分工 · 连续分不均衡，头尾配对来平衡",
        f.assign < 1
          ? "整行输入落到负责它的卡"
          : f.localKV < 1
            ? "各卡从本地输入生成 Q、K、V"
            : "Q 留在本卡 · 临时收齐本层 K/V",
        "各卡计算自己的查询 · 分别遵守因果范围",
        "attention 输出留在原卡 · 继续本层后续计算",
      ][phase]!;
      footer.textContent =
        phase === 0
          ? local < 0.25
            ? "示意分词：请 / 介绍 / 一下 / 并行 / 计算 / 的 / 工作 / 原理"
            : "位置越靠后，要读取的历史越多；分工不改变原顺序"
          : phase === 1
            ? f.assign < 1
              ? "相同颜色、相同位置、整行通道一起落卡"
              : f.localKV < 1
                ? "本地投影（未展开乘法）：X → Q、K、V；随后才计算 attention"
                : "临时 AllGather K/V；Q 留在本卡，不交换查询"
            : phase === 2
              ? ""
              : "本卡 attention 输出 → 输出投影等后续计算；位置归属不变";
      fullName.textContent = phase === 0 ? "一句话的输入 X · 8 行 × 4 个通道" : "原位置保留作对照";
      outlines.forEach((l) => {
        l.visible = phase < 2;
        l.material.opacity = 0.35 * (1 - f.localKV);
      });
      cuts.forEach((l, i) => {
        l.visible = phase === 0 && split > 0;
        l.position.y = -(i + 0.5) * 0.22 * split;
        l.material.opacity = 0.2 + split * 0.6;
      });
      frames.flat().forEach((l) => {
        l.visible = f.assign > 0;
        l.material.opacity = 0.35 + f.assign * 0.25;
      });
      names.forEach((n, g) => {
        n.textContent = `卡${g} · ${f.localKV === 0 ? "输入 X" : f.localKV < 1 ? "X → Q / K / V" : phase < 2 ? "查询 Q" : phase === 2 ? "查询 → 输出" : "输出"}`;
      });
      completion.forEach((n, g) => {
        n.textContent = `位置 ${PCP_QUERIES[g]!.join("、")} · 留在本卡`;
        cardStates[g]!.textContent =
          f.assign === 0
            ? "等待位置分工"
            : `${phase === 3 ? "输出" : f.localKV === 0 ? "输入位置" : "查询"} ${PCP_QUERIES[g]!.join("、")}`;
      });
      payloadMaterials.forEach((m) => {
        m.opacity = 0.2 + 0.8 * f.assign;
      });
      for (let q = 0; q < 8; q++) {
        const g = ownerOf(q),
          row = rows[q]!,
          out = outputs[q]!,
          ghost = ghosts[q]!,
          written = f.written[q]!;
        row.group.position.copy(source(q, 0.22 * split)).lerp(target(q), f.assign);
        row.group.visible = written < 1;
        const color = new T.Color(rowColors[Math.floor(q / 4)]!).lerp(
          new T.Color(rowColors[g]!),
          phase === 0 ? span(local, 0.42, 0.72) : 1,
        );
        if (phase === 0 && local < 0.25) color.set(palette.data);
        set(
          row,
          f.localKV === 0 ? Array(4).fill("") : PCP_EXAMPLE.queries[q]!,
          color.getStyle(),
          (0.15 + 0.85 * f.rows[q]!) * (1 - written) * (phase === 2 && q !== CP_FOCUS[g] ? 0.65 : 1),
        );
        row.title.textContent =
          written < 0.5 && f.rows[q]! > 0.5
            ? f.assign === 0
              ? `${q} · ${CP_TOKENS[q]}`
              : `${f.localKV > 0 ? "Q" : "位置"}${q}`
            : "";
        captions
          .find((c) => c.el === row.title)!
          .point.set((f.assign === 0 ? -1 : g ? 1 : -1) * 1.85, 0, 0.3);
        row.cells.forEach((c) => {
          c.material.emissive.set(phase === 2 && PCP_QUERIES[g]![f.active] === q ? "#355b4c" : "#000");
        });
        row.cells.forEach((c, d) => {
          c.position.x = (d - 1.5) * 0.565;
          c.scale.x = 0.52;
        });
        ghost.group.visible = phase === 1 && f.localKV < 1;
        ghost.cells.forEach((c) => {
          c.material.opacity = 0.12 * (1 - f.localKV);
        });
        out.group.visible = written > 0;
        out.group.position.copy(target(q));
        out.group.position.z += Math.sin(written * Math.PI) * 0.35;
        set(out, PCP_EXAMPLE.outputs[q]!, undefined, written);
        out.title.textContent = written >= 0.5 ? `输出${q}` : "";
      }
      querySlices.forEach((s, g) => {
        s.group.visible = phase === 0 ? local >= 0.72 : phase === 1 && f.assign > 0;
        const a = rows[g * 2]!.group.position,
          b = rows[g * 2 + 1]!.group.position;
        s.group.position.copy(a).lerp(b, 0.5);
        const half = (a.y - b.y) / 2 + 0.22;
        const side = ownerOf(g * 2) === 0 ? -1 : 1;
        const x = 1.3 * side;
        connect(s.wire, [v(x * 0.9, half, 0.3), v(x, half, 0.3), v(x, -half, 0.3), v(x * 0.9, -half, 0.3)]);
        s.tagPoint.set(side * 2.65, 0, 0.3);
      });
      for (let g = 0; g < 2; g++) {
        const read = cpReadFrame(kind, p, g),
          activeQ = read.query;
        focusedQueries[g]!.visible = phase === 2 && f.written[activeQ]! < 1;
        focusedQueries[g]!.material.opacity = 0.95;
        names[g]!.textContent =
          phase === 2 ? `追踪 Q${activeQ} · ${CP_TOKENS[activeQ]}` : names[g]!.textContent;
        counts[g]!.textContent = read.total.z
          ? `内容 ${read.total.u} ÷ 份额 ${read.total.z} = 上下文 ${+(read.output ?? 0).toFixed(2)}`
          : `Q${activeQ} · 等待第一项`;
        [valueSamples[g]!.group, sums[g]!.group].forEach((o) => {
          o.visible = phase === 2;
        });
        valueSamples[g]!.title.textContent = `V${read.position} · 整行 4 通道`;
        sums[g]!.title.textContent = read.read.length
          ? `已加入 V${read.read[0]}${read.read.length > 1 ? `–V${read.read.at(-1)}` : ""} 的内容和`
          : "内容和 · 尚未加入";
        set(
          valueSamples[g]!,
          read.weighted || read.complete ? PCP_EXAMPLE.values[read.position]! : ["", "", "", ""],
          undefined,
          read.weighted || read.complete ? 1 : 0.25,
        );
        set(
          sums[g]!,
          [0, 1, 2, 3].map((d) =>
            read.read.reduce((sum, position) => sum + PCP_EXAMPLE.values[position]![d]!, 0),
          ),
        );
        sumRoutes[g]!.visible = phase === 2 && read.item >= 0.65 && !read.complete;
        activeHistory[g]!.visible = phase === 2 && !read.complete;
        activeHistory[g]!.position.copy(kvPoint(g, read.position));
        for (let k = 0; k < 8; k++) {
          const t = kv[g]![k]!,
            isLocal = ownerOf(k) === g;
          const ready = isLocal ? f.localKV : f.gather;
          t.group.visible = ready > 0 && (phase < 3 || f.handoff < 1);
          const a = isLocal ? ports[g]!.clone() : kvPoint(1 - g, k);
          const b = kvPoint(g, k);
          const move = new T.QuadraticBezierCurve3(
            a,
            isLocal
              ? a
                  .clone()
                  .lerp(b, 0.5)
                  .add(v(0, 0, 3))
              : a
                  .clone()
                  .lerp(b, 0.5)
                  .add(v(0, 0, g ? 1.2 : 2.2)),
            b,
          );
          t.group.position.copy(move.getPoint(ready));
          const opacity = phase === 3 ? 1 - f.handoff : phase === 2 && k > activeQ ? 0.12 : 1;
          t.title.textContent = ready === 1 && opacity > 0.5 ? `${k}` : "";
          t.cells.forEach((cell, d) => {
            cell.material.opacity = opacity;
            cell.material.color.set(rowColors[ownerOf(k)]!);
            if (d >= 4) cell.material.color.lerp(new T.Color("#e6eadf"), 0.3);
            cell.material.emissive.set(
              phase === 2 && k === read.position && !read.complete ? "#325e42" : "#000",
            );
          });
          kvSlots[g]![k]!.visible = phase === 1 && f.assign === 1 && ready < 1;
          kvSlots[g]![k]!.material.opacity = 0.45;
        }
        kvNames[g]!.style.opacity = String(f.localKV);
        const access = accesses[g]!;
        access.visible = phase === 2 && !read.complete;
        valueReads[g]!.visible = phase === 2 && read.weighted && !read.complete;
        if (phase === 2) {
          const qPoint = target(activeQ).add(v(g ? -1.2 : 1.2, 0, 0.4));
          const edgeX = g ? 2.25 : -2.25;
          connect(access, [
            qPoint,
            v(edgeX, qPoint.y, 0.8),
            v(edgeX, kvPoint(g, read.position).y, 0.8),
            kvPoint(g, read.position).add(v(g ? 0.95 : -0.95, 0, 0.3)),
          ]);
          const vp = kvPoint(g, read.position).add(v(0.1775, 0, 0.3));
          const aisle = g ? 2.55 : -2.55;
          connect(valueReads[g]!, [
            vp,
            v(vp.x, vp.y - 0.22, 0.8),
            v(aisle, vp.y - 0.22, 0.8),
            v(aisle, -4.5, 0.8),
            v(xs[g]!, -4.5, 0.8),
            v(xs[g]!, -4.6392, 0.8),
          ]);
        }
        writeRoutes[g]!.visible = phase === 3 && f.handoff > 0 && f.handoff < 1;
        const writeStart = v(xs[g]!, -1.9, 0.4),
          writeEnd = ports[g]!;
        const writeCurve = new T.QuadraticBezierCurve3(
          writeStart,
          writeStart
            .clone()
            .lerp(writeEnd, 0.5)
            .add(v(0, 0, 3.2)),
          writeEnd,
        );
        connect(writeRoutes[g]!, writeCurve.getPoints(32));
        flight[g]!.visible = phase === 3;
        flight[g]!.position.copy(writeCurve.getPoint(f.handoff));
        flight[g]!.scale.setScalar(1 - 0.62 * f.handoff);
        flight[g]!.quaternion.identity().slerp(landedRotation, f.handoff);
        flightRows[g]!.forEach((t) => {
          // Original output rows retain their labels; flying copies only show the same colored grid.
          t.cells.forEach((cell) => {
            cell.material.opacity = 0.25 + 0.75 * span(f.handoff, 0.25, 0.6);
          });
        });
        hardware.payloads[g]!.visible = phase < 3;
      }
    };
  } else if (kind === 4) {
    const xs = [-3.8, 3.8];
    const owner = (p: number) => (PCP_QUERIES[0]!.includes(p) ? 0 : 1);
    const slot = (p: number) => PCP_QUERIES[owner(p)]!.indexOf(p);
    const rowY = (r: number) => -1.35 - r * 0.64;
    const kvCenter = (g: number) => v(xs[g]! + 0.8, -2.31, 0.5);
    const vectorKV = (p: number) => ["κ", ...ringKeyVector(p).slice(1), ...ringValueVector(p)];
    const fmt = (n: number) => +n.toFixed(2);
    const sourceQ = (p: number) => v(-1, -0.8 - p * 0.53, 0.4);
    const sourceKV = (p: number) => v(0.65, -0.8 - p * 0.53, 0.4);
    const queryPoint = (p: number, assign: number) =>
      sourceQ(p).lerp(v(xs[owner(p)]! - 2.15, rowY(slot(p)), 0.4), assign);
    const kvRow = (p: number, point: T.Vector3) => {
      const t = tensor(`位置${p}`, vectorKV(p), point, rowColors[owner(p)]!, 0.32);
      t.cells.forEach((cell, d) => {
        cell.position.x += d < 4 ? -0.08 : 0.08;
        cell.scale.y = 0.4;
        if (d < 4) cell.material.color.lerp(new T.Color("#a8bdc2"), 0.25);
      });
      captions.find((c) => c.el === t.title)!.point.set(2.05, 0, 0.4);
      return t;
    };
    const inputs = Array.from({ length: 8 }, (_, p) => {
      const t = tensor(
        `${p} · ${CP_TOKENS[p]}`,
        ["", "", "", ""],
        v(0, -0.8 - p * 0.53, 0.4),
        palette.data,
        0.48,
      );
      captions.find((c) => c.el === t.title)!.point.set(-1.8, 0, 0.4);
      return t;
    });
    const queries = Array.from({ length: 8 }, (_, p) =>
      tensor(`位置${p}`, RING_Q_VECTOR, sourceQ(p), rowColors[owner(p)]!, 0.6),
    );
    const kv = Array.from({ length: 8 }, (_, p) => kvRow(p, sourceKV(p)));
    queries.forEach((t) => {
      captions.find((c) => c.el === t.title)!.point.set(-1.65, 0, 0.4);
      t.numbers.forEach((el) => {
        el.className = "wiki-mechanism-label value small";
      });
      t.cells.forEach((cell) => {
        cell.scale.y = 0.4;
      });
    });
    const globalTitle = label(
      "一句话的输入 X · 每行对应一个位置",
      root,
      v(0, -0.12),
      "name",
      () => ringMotion(progress).assign < 1,
    );
    const cuts = [1, 3, 5].map((r) => cut(0, -0.8 - (r + 0.5) * 0.53, 1.15));
    const globalOutline = bracket(0, -0.42, -4.85, 1.15, "#69867a");
    const slices = Array.from({ length: 4 }, (_, r) => slice(`段${r}`, rowColors[owner(r * 2)]!));
    const panels = xs.map((x) => bracket(x - 0.2, -0.75, -5.9, 3.35, "#69867a"));
    const qHeads = xs.map((x, g) =>
      label(`卡${g} · Q`, root, v(x - 2.15, -0.55), "name", () => ringMotion(progress).assign === 1),
    );
    const kvHeads = xs.map((x, g) =>
      label(
        `K / V · 块 ${g ? "B" : "A"}`,
        root,
        v(x + 0.8, -0.3),
        "name",
        () => ringMotion(progress).assign === 1,
      ),
    );
    xs.forEach((x) => {
      const showColumns = () => {
        const motion = ringMotion(progress);
        return motion.project > 0 && !(motion.transfer > 0 && motion.transfer < 1);
      };
      label("K · 4 通道", root, v(x, -0.85), "note", showColumns);
      label("V · 4 通道", root, v(x + 1.6, -0.85), "note", showColumns);
    });
    const packets = [0, 1].map((g) => {
      const group = new T.Group();
      root.add(group);
      const rows = PCP_QUERIES[g]!.map((p, r) => {
        const t = kvRow(p, v(0, 0));
        group.add(t.group);
        t.group.position.set(0, rowY(r) + 2.31, 0);
        return t;
      });
      const name = label(`块 ${g ? "B" : "A"}`, group, v(0, 1.5, 0.4), "name");
      return { group, rows, name };
    });
    const routes = xs.map((_, g) => line(rowColors[g]!, false, 2.8));
    const receive = xs.map((_, g) =>
      PCP_QUERIES[1 - g]!.map((_, r) => {
        const frame = socket(root, v(xs[g]! + 0.8, rowY(r), 0.5), 8, 0.32);
        frame.scale.set(3.08, 0.48, 0.5);
        return frame;
      }),
    );
    const terms = xs.map((x, g) =>
      tensor("权重 × V · 当前四项贡献", ["", "", "", ""], v(x, -4.22, 0.8), rowColors[g]!, 0.7),
    );
    const accumulator = xs.map((x, g) => {
      const u = tensor("内容总和", [0], v(x - 0.8, -4.95, 0.5), rowColors[g]!, 0.86);
      const z = tensor("权重总份额", [0], v(x + 0.8, -4.95, 0.5), rowColors[g]!, 0.86);
      [u, z].forEach((t) => {
        captions.find((c) => c.el === t.title)!.point.set(0, -0.4, 0.4);
      });
      const answer = label("", root, v(x, -6.15, 0.5), "name", () => ringMotion(progress).phase > 0);
      answer.style.whiteSpace = "pre-line";
      return { u, z, answer };
    });
    const reads = xs.map(() => line(palette.result, false, 2.8));
    const queryReads = xs.map(() => line("#b78243", false, 3));
    const queryFocus = xs.map((x) => {
      const frame = socket(root, v(x - 2.15, rowY(3), 0.4), 4, 0.6);
      frame.scale.set(2.56, 0.48, 0.5);
      return frame;
    });
    const keyFocus = xs.map((x) => {
      const frame = socket(root, v(x + 0.8, rowY(0), 0.5), 8, 0.32);
      frame.scale.set(3.08, 0.48, 0.5);
      return frame;
    });
    const finalGroups = xs.map((_, g) => {
      const group = new T.Group();
      root.add(group);
      PCP_QUERIES[g]!.forEach((p, r) => {
        const t = tensor("", ringVectorOutput(p).map(fmt), v(0, 0), rowColors[g]!, 0.6);
        group.add(t.group);
        t.group.position.set(0, 0.96 - r * 0.64, 0);
        t.numbers.forEach((el) => {
          // The expanded output keeps its readable values throughout writeback;
          // lettering on the departing copy would overlap those same values.
          captions.find((c) => c.el === el)!.visible = () => false;
        });
      });
      return group;
    });
    const writes = xs.map(() => line(palette.result, false, 2.8));
    animateContent = (p) => {
      const f = ringMotion(p),
        { phase, assign } = f;
      header.textContent = [
        f.local < 0.3
          ? "先看输入 · 同一句话按位置分工"
          : assign < 1
            ? "头尾配对 · 整行输入落到各卡"
            : "各卡由本地输入生成 Q、K、V",
        "第1轮 · 本地 Q 读取本地 K/V 块",
        "交换 K/V 块 · 查询和已读内容留在原卡",
        "第2轮 · 接着读另一块，合齐同一份上下文",
        "各位置得到完整输出 · 写回原来的卡",
      ][phase]!;
      footer.textContent =
        phase === 0
          ? assign === 0
            ? "示意分词 · 每行保留完整的隐藏通道"
            : assign < 1
              ? "卡0：0、1、6、7；卡1：2、3、4、5"
              : "本地投影（乘法未展开）→ 下一步 Q 读取第一块 K/V"
          : "";
      globalTitle.style.opacity = String(1 - assign);
      cuts.forEach((c) => {
        c.visible = phase === 0 && f.local >= 0.25 && assign < 0.25;
      });
      globalOutline.forEach((l) => {
        l.visible = phase === 0;
        l.material.opacity = 0.5 * (1 - assign);
      });
      panels.flat().forEach((l) => {
        l.visible = assign === 1;
      });
      slices.forEach((s, r) => {
        s.group.visible = phase === 0 && assign > 0 && assign < 1;
        const point = (q: number) =>
          v(0, -0.8 - q * 0.53, 0.4).lerp(v(xs[owner(q)]!, rowY(slot(q)), 0.4), assign);
        s.group.position.copy(point(r * 2)).lerp(point(r * 2 + 1), 0.5);
        const side = owner(r * 2) ? 1 : -1;
        connect(s.wire, [
          v(side * 1.1, 0.5, 0.2),
          v(side * 1.25, 0.5, 0.2),
          v(side * 1.25, -0.5, 0.2),
          v(side * 1.1, -0.5, 0.2),
        ]);
        s.tagPoint.set(side * 2.55, 0, 0.3);
      });
      for (let q = 0; q < 8; q++) {
        const g = owner(q),
          r = slot(q),
          t = queries[q]!,
          k = kv[q]!;
        const kvHome = v(xs[g]! + 0.8, rowY(r), 0.5);
        const input = inputs[q]!;
        input.group.visible = f.project < 1;
        input.group.position.set(0, -0.8 - q * 0.53, 0.4).lerp(v(xs[g]!, rowY(r), 0.4), assign);
        input.cells.forEach((c, d) => {
          c.position.x = (d - 1.5) * 0.525;
          c.scale.x = 0.48;
        });
        set(
          input,
          ["", "", "", ""],
          new T.Color(palette.data).lerp(new T.Color(rowColors[g]!), span(f.local, 0.25, 0.35)).getStyle(),
          1 - f.project,
        );
        input.title.textContent = assign === 0 ? `${q} · ${CP_TOKENS[q]}` : `位置${q}`;
        input.title.style.opacity = String(1 - f.project);
        captions.find((c) => c.el === input.title)!.point.x = (assign > 0 && g ? 1 : -1) * 1.8;
        t.group.position.copy(queryPoint(q, assign));
        k.group.position.copy(sourceKV(q)).lerp(kvHome, assign);
        t.group.visible = f.project > 0;
        const done = f.remoteWritten[r] === 1;
        set(
          t,
          done ? ringVectorOutput(q).map((value) => +value.toFixed(1)) : RING_Q_VECTOR,
          undefined,
          f.project * (phase > 0 && phase < 4 && q !== CP_FOCUS[g] ? 0.65 : 1),
        );
        t.title.textContent = `${done ? "O" : "Q"}${q}`;
        t.title.style.opacity = String(f.project);
        t.cells.forEach((cell) => {
          cell.material.emissive.set(phase > 0 && q === CP_FOCUS[g] ? "#406d59" : "#000");
        });
        const read = cpReadFrame(kind, p, g);
        k.group.visible = f.transfer < 1 && f.project > 0;
        // The dimmed local block becomes the receiving slot. Label it with the
        // incoming row before arrival so a new block never lands on old IDs.
        k.title.textContent = phase === 0 ? "" : `位置${phase === 2 ? PCP_QUERIES[1 - g]![r] : q}`;
        k.cells.forEach((cell) => {
          cell.material.opacity =
            phase === 0 ? f.project : phase === 2 ? 0.18 : phase === 1 && q > read.query ? 0.18 : 1;
          cell.material.emissive.set(
            phase === 1 && read.position === q && !read.complete ? "#486e50" : "#000",
          );
        });
      }
      for (let g = 0; g < 2; g++) {
        const other = 1 - g,
          packet = packets[g]!;
        cardStates[g]!.textContent = assign === 0 ? "等待位置分工" : `位置 ${PCP_QUERIES[g]!.join("、")}`;
        const a = kvCenter(g),
          b = kvCenter(other);
        // Route whole blocks above the expanded matrices, descending along the
        // destination K/V column instead of crossing stationary Q rows.
        const lane = g ? 1.4 : 2.8;
        const route = new T.CatmullRomCurve3(
          [a, v(a.x, lane, 1), v(b.x, lane, 1), b],
          false,
          "catmullrom",
          0.12,
        );
        packet.group.visible = phase >= 2;
        packet.group.position.copy(route.getPoint(f.transfer));
        packet.name.textContent = f.transfer > 0 && f.transfer < 1 ? `块 ${g ? "B" : "A"} → 卡${other}` : "";
        packet.rows.forEach((t, r) => {
          const position = PCP_QUERIES[g]![r]!,
            destinationRead = cpReadFrame(kind, p, other);
          t.title.textContent = f.transfer === 1 ? `位置${position}` : "";
          const opacity = phase >= 3 && position > destinationRead.query ? 0.18 : 1;
          t.cells.forEach((cell) => {
            cell.material.opacity = opacity;
            cell.material.emissive.set(
              phase === 3 && destinationRead.position === position && !destinationRead.complete
                ? "#486e50"
                : "#000",
            );
          });
          t.numbers.forEach((el) => {
            el.style.opacity = String(phase === 2 ? span(f.transfer, 0.08, 0.2) : 1);
          });
        });
        routes[g]!.visible = phase === 2 && f.transfer > 0 && f.transfer < 1;
        connect(routes[g]!, route.getPoints(44));
        receive[g]!.forEach((s) => {
          s.visible = phase === 2 && f.transfer < 1;
          s.material.opacity = 0.9;
        });
        qHeads[g]!.textContent = `卡${g} · ${phase === 4 ? "O" : phase === 3 ? "Q → O" : "Q"} · 4×4`;
        kvHeads[g]!.textContent =
          phase === 2 && f.transfer > 0 && f.transfer < 1
            ? ""
            : phase === 2
              ? `${f.transfer < 1 ? "接收" : "已接收"}块 ${other ? "B" : "A"} · K / V`
              : `K / V · 块 ${(phase >= 3 ? other : g) ? "B" : "A"}`;
        const read = cpReadFrame(kind, p, g),
          q = read.query;
        const currentBlock = read.positions;
        const acc = accumulator[g]!;
        [acc.u.group, acc.z.group, terms[g]!.group].forEach((o) => {
          o.visible = phase > 0;
        });
        set(acc.u, [fmt(read.total.u)]);
        set(acc.z, [fmt(read.total.z)]);
        acc.answer.textContent =
          phase === 0
            ? ""
            : phase === 2
              ? `保留内容 ${fmt(read.total.u)}、份额 ${fmt(read.total.z)}\n等待远端块，接着计算`
              : read.output === null
                ? `Q${q} · 等待第一项累积`
                : `${phase >= 3 ? `上轮 ${fmt(read.prior.u)} + 本块 ${fmt(read.added.u)} = ${fmt(read.total.u)}\n` : ""}内容 ${fmt(read.total.u)} ÷ 份额 ${fmt(read.total.z)} = ${fmt(read.output)}`;
        terms[g]!.title.textContent =
          read.weighted && !read.complete
            ? `取用：${fmt(read.weight)} × 内容${fmt(read.value)} = ${fmt(read.product)}`
            : `${read.block} · 四行取回的内容`;
        set(
          terms[g]!,
          currentBlock.map((position) =>
            position > q
              ? "遮蔽"
              : read.read.includes(position) || (position === read.position && read.weighted)
                ? fmt(Math.exp(RING_K[position]!) * RING_V[position]!)
                : "",
          ),
        );
        terms[g]!.cells.forEach((cell, j) => {
          const position = currentBlock[j]!,
            added = read.read.includes(position),
            current = position === read.position && read.weighted;
          cell.material.opacity = position > q ? 0.22 : added || current ? 1 : 0.15;
          cell.position.z = current && !read.complete ? 0.26 : 0;
          cell.material.emissive.set(current && !read.complete ? "#486e50" : "#000");
        });
        const activeRow = currentBlock.indexOf(read.position),
          x = xs[g]!;
        queryFocus[g]!.visible = phase > 0 && phase < 4;
        queryFocus[g]!.scale.y = 0.5;
        keyFocus[g]!.visible = read.running && !read.complete;
        keyFocus[g]!.position.set(x + 0.8, rowY(activeRow), 0.5);
        queryReads[g]!.visible = read.running && !read.complete;
        connect(queryReads[g]!, [
          v(x - 0.88, rowY(3), 0.64),
          v(x - 0.82, rowY(3), 0.64),
          v(x - 0.82, rowY(activeRow), 0.64),
          v(x - 0.74, rowY(activeRow), 0.64),
        ]);
        reads[g]!.visible = read.running && read.weighted && !read.complete;
        const termX = x + (activeRow - 1.5) * 0.745;
        connect(reads[g]!, [
          v(x + 1.05, rowY(activeRow) - 0.26, 0.7),
          v(x + 1.05, rowY(activeRow) - 0.32, 0.7),
          v(x + 3.3, rowY(activeRow) - 0.32, 0.7),
          v(x + 3.3, -3.74, 0.8),
          v(termX, -3.74, 0.8),
          v(termX, -3.97, 0.8),
        ]);
        const outputStart = v(xs[g]! - 2.15, -2.31, 0.4);
        const outputEnd = ports[g]!.clone().add(
          v(0, -0.5, 0).multiply(hardware.group.scale).applyQuaternion(hardware.group.quaternion),
        );
        const writeCurve = new T.QuadraticBezierCurve3(outputStart, v(xs[g]!, -0.2, 3.3), outputEnd);
        finalGroups[g]!.visible = phase === 4;
        finalGroups[g]!.position.copy(writeCurve.getPoint(f.handoff));
        finalGroups[g]!.scale.setScalar(1 - 0.65 * f.handoff);
        finalGroups[g]!.quaternion.identity().slerp(
          hardware.group.quaternion
            .clone()
            .multiply(new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0))),
          f.handoff,
        );
        writes[g]!.visible = phase === 4 && f.handoff > 0 && f.handoff < 1;
        connect(writes[g]!, writeCurve.getPoints(32));
        hardware.payloads[g]!.visible = phase < 4;
      }
    };
  } else {
    const xs = [-3.5, 3.5];
    const cacheNames = xs.map((x, i) =>
      label(
        `卡${i} · K、V 各 [4,4]`,
        root,
        v(x, 0.25),
        "name",
        () => mechanismFrame(kind, progress).split > 0.8,
      ),
    );
    const sourceName = label(
      "历史缓存的全局位置（逻辑视图）",
      root,
      v(0, 0.35),
      "name",
      () => mechanismFrame(kind, progress).phase === 0,
    );
    const sourceFrames = [
      bracket(-1.6, -0.4, -4.55, 1.51, "#69867a"),
      bracket(1.3, -0.4, -4.55, 1.25, "#69867a"),
    ].flat();
    const cuts = Array.from({ length: 7 }, (_, r) => cut(0, -1 - r * 0.49, 2.8));
    const cache = xs.map((x, g) =>
      PARTITIONS[3]!.groups[g]!.map((position, r) => {
        const pair = slice(`位置${position}`, rowColors[g]!);
        pair.tagPoint.set(g ? 3.15 : -3.65, 0, 0.3);
        connect(pair.wire, [
          v(-3.05, 0.2, 0.25),
          v(-3.05, -0.27, 0.25),
          v(2.5, -0.27, 0.25),
          v(2.5, 0.2, 0.25),
        ]);
        const parts = [-1.6, 1.3].map((offset, part) => {
          const t = tensor(
            "",
            Array(PARTITIONS[3]!.columns).fill(""),
            v(x + offset, -0.75 - r * 0.56, 0.2),
            part === 0 ? rowColors[g]! : g ? "#bb9471" : "#789eaa",
            0.56,
          );
          pair.group.add(t.group);
          t.group.position.set(offset, 0, 0);
          if (part === 0) {
            // Reserve space for the signed decimal in the active K channel, without smaller text.
            t.cells.forEach((cell, c) => {
              cell.position.x = [-0.9075, -0.0575, 0.5475, 1.1525][c]!;
              if (c === 0) cell.scale.x = 1.05;
            });
            t.numbers.forEach((n) => {
              n.className = "wiki-mechanism-label value pp-number";
            });
          }
          return t;
        });
        return { position, parts, pair };
      }),
    );
    label("K 键         V 值", root, v(0, -0.2), "name", () => mechanismFrame(kind, progress).split < 0.15);
    label(
      "同一位置的 K、V 为一对；每一行保留四个通道 →",
      root,
      v(0, -5.1),
      "name",
      () => mechanismFrame(kind, progress).phase === 0,
    );
    xs.forEach((x) => {
      for (const [dx, name] of [
        [-1.6, "K · 四通道"],
        [1.3, "V 内容"],
      ] as const)
        label(name, root, v(x + dx, -0.25), "note", () => mechanismFrame(kind, progress).split > 0.9);
      label(
        "4 个历史位置 × 4 通道",
        root,
        v(x, -3.45),
        "note",
        () => mechanismFrame(kind, progress).phase === 0 && mechanismFrame(kind, progress).split > 0.9,
      );
    });
    const queries = xs.map((x) => tensor("Q₇", DCP_QUERY, v(x, -3.15, 0.4), palette.data, 0.62));
    queries.forEach(rowTitle);
    const queryLines = xs.map((x, g) => {
      const l = line("#b78243", false, 2.8);
      const aisle = x + (g ? -2.2 : 2.2);
      connect(l, [v(aisle, -1.75, 0.4), v(aisle, -3.1, 0.6), v(x, -3.1, 0.6)]);
      return l;
    });
    const readLines = xs.map(() => line(palette.result, false, 2.8));
    const localO = xs.map((x, g) =>
      tensor(`O${g}`, dcpChannels(DCP_EXAMPLE.local[g]!), v(x - 0.3325, -4, 0.6), rowColors[g]!, 0.62),
    );
    const localZ = xs.map((x, g) =>
      tensor(`Z${g}`, [DCP_EXAMPLE.normalizers[g]!], v(x + 1.33, -4, 0.6), rowColors[g]!, 0.62),
    );
    xs.forEach((_x, g) => {
      localO[g]!.title.textContent = "本块上下文";
      localZ[g]!.title.textContent = "份额";
    });
    const receive = xs.map((x, g) =>
      tensor(
        `卡${1 - g}的结果`,
        [...dcpChannels(DCP_EXAMPLE.local[1 - g]!), DCP_EXAMPLE.normalizers[1 - g]!],
        v(x, -5.2, 0.6),
        rowColors[1 - g]!,
        0.62,
      ),
    );
    const slots = receive.map((t) => socket(root, t.group.position, 5, 0.62));
    receive.forEach((t) => {
      captions.find((c) => c.el === t.title)!.point.set(-2.4, 0, 0.3);
    });
    const travel = receive.map((_, g) =>
      tensor(
        `输出 O${1 - g} 与权重和 Z${1 - g}`,
        [...dcpChannels(DCP_EXAMPLE.local[1 - g]!), DCP_EXAMPLE.normalizers[1 - g]!],
        v(xs[1 - g]!, -4, 0.6),
        rowColors[1 - g]!,
        0.62,
      ),
    );
    const routes = [line(rowColors[1]!, false, 2.8), line(rowColors[0]!, false, 2.8)];
    const contributions = xs.map((_, g) =>
      tensor(
        `卡${g}贡献 × ${g ? "¾" : "¼"}`,
        dcpChannels(DCP_EXAMPLE.local[g]!).map((n) => n * (g ? 0.75 : 0.25)),
        v(g === 0 ? -5.1 : 0, -5.65, 0.7),
        rowColors[g]!,
        0.78,
      ),
    );
    const result = tensor("合并 O · 4 通道", dcpChannels(25), v(5.1, -5.65, 0.7), palette.result, 0.78);
    result.group.scale.x = 1.35;
    captions.find((c) => c.el === footer)!.point.y = -6.7;
    const mergeRoutes = xs.map((_, g) => line(rowColors[g]!, false, 2.8));
    const mergeLanded = () => {
      const f = mechanismFrame(kind, progress);
      return f.phase === 3 && f.local >= 0.34;
    };
    label("+", root, v(-2.55, -5.65, 0.7), "operator", mergeLanded);
    label("=", root, v(2.55, -5.65, 0.7), "operator", mergeLanded);
    animateContent = (p) => {
      const { phase, local, split } = mechanismFrame(kind, p);
      const merge = dcpMergeFrame(p);
      header.textContent = [
        "DCP · K、V 沿历史位置交错分存",
        "各卡算局部输出 O，同时保留权重和 Z",
        "接收同查询 / 同头的 O 与 LSE",
        merge.complete
          ? "合并完成 · O = [25, 15, 12.5, 7.5]"
          : merge.weighted
            ? "两卡贡献已乘份额 · 接下来同列相加"
            : "同一个查询 · 先收齐，再按 2∶6 合并",
      ][phase]!;
      footer.textContent =
        phase === 0
          ? "K、V 每行四通道 · −0.69≈ln(0.5)，0.41≈ln(1.5)"
          : phase < 3
            ? "前四格为 O 向量；末格 Z = exp(LSE)，不是输出通道"
            : "同列相加：¼ O₀ + ¾ O₁ · 四通道共用分区权重";
      sourceName.textContent =
        split < 0.2 ? "历史缓存的全局位置（逻辑视图）" : "偶数位置归卡0 · 奇数位置归卡1";
      sourceFrames.forEach((l) => {
        l.visible = phase === 0;
        l.material.opacity = 0.5 * (1 - split);
      });
      cuts.forEach((l) => {
        l.visible = phase === 0 && split < 0.55;
        l.material.opacity = 0.6;
      });
      cacheNames.forEach((n) => {
        n.style.opacity = String(split);
      });
      queries.forEach((t) => {
        t.group.visible = phase > 0;
      });
      queryLines.forEach((l, g) => {
        l.visible = phase === 1 && !cpReadFrame(kind, p, g).complete;
      });
      readLines.forEach((l, g) => {
        const read = cpReadFrame(kind, p, g);
        l.visible = phase === 1 && read.weighted && !read.complete;
      });
      cache.forEach((rows, g) => {
        const read = cpReadFrame(kind, p, g);
        rows.forEach(({ position, parts, pair }, r) => {
          pair.group.position
            .copy(v(0, -0.75 - position * 0.49, 0.2))
            .lerp(v(xs[g]!, -0.75 - r * 0.56, 0.2), split);
          pair.group.position.z += Math.sin(split * Math.PI) * 0.5;
          parts.forEach((t, part) => {
            set(
              t,
              (part === 0 ? dcpKeyVector(position) : dcpValueVector(position)).map((n) => +n.toFixed(2)),
            );
            t.cells.forEach((c) => {
              const active = phase === 1 && read.index === r && !read.complete;
              c.material.emissive.set(active ? "#234431" : "#000");
              c.material.opacity = phase === 1 && !active ? 0.65 : 1;
            });
          });
        });
        const row = read.index;
        const y = -0.75 - row * 0.56;
        const queryAisle = xs[g]! - 3.3;
        connect(queryLines[g]!, [
          v(xs[g]! - 1.3075, -3.15, 0.6),
          v(queryAisle, -3.15, 0.6),
          v(queryAisle, y, 0.6),
          v(xs[g]! - 3.0325, y, 0.6),
        ]);
        const returnX = xs[g]! + 2.8;
        connect(readLines[g]!, [
          v(xs[g]! + 2.4875, y, 0.6),
          v(returnX, y, 0.6),
          v(returnX, -3.65, 0.6),
          v(xs[g]! - 0.3325, -3.65, 0.6),
          v(xs[g]! - 0.3325, -3.7892, 0.6),
        ]);
      });
      for (let g = 0; g < 2; g++) {
        const read = cpReadFrame(kind, p, g);
        localO[g]!.group.visible = localZ[g]!.group.visible = phase >= 1;
        set(
          localO[g]!,
          read.output === null ? DCP_QUERY.map(() => "") : dcpChannels(read.output).map((n) => +n.toFixed(2)),
          undefined,
          read.output === null ? 0.25 : 1,
        );
        set(localZ[g]!, [read.total.z], undefined, read.total.z === 0 ? 0.25 : 1);
        const transferTime = local * 2 - g;
        const u = span(transferTime, 0.1, 0.8);
        const a = v(xs[1 - g]!, -4, 0.6),
          b = receive[g]!.group.position;
        travel[g]!.group.visible = phase === 2 && transferTime >= 0 && u < 1;
        // Source/receiver labels stay beside their rows; a second flying title would cross them.
        travel[g]!.title.textContent = "";
        const curve = new T.CatmullRomCurve3([a, v(a.x, -5.2, 0.6), b], false, "centripetal");
        travel[g]!.group.position.copy(curve.getPoint(u));
        const departed = span(Math.abs(travel[g]!.group.position.y - a.y), 0.25, 0.85);
        travel[g]!.cells.forEach((cell) => {
          cell.material.opacity = departed;
        });
        travel[g]!.numbers.forEach((n) => {
          // Reveal the copy only after it has cleared the retained source row.
          n.style.visibility = departed === 1 ? "visible" : "hidden";
        });
        // Received copies have served their purpose; leave original answers visible above.
        receive[g]!.group.visible = (phase === 2 && u === 1) || (phase === 3 && local < 0.1);
        set(
          receive[g]!,
          [...dcpChannels(DCP_EXAMPLE.local[1 - g]!), DCP_EXAMPLE.normalizers[1 - g]!],
          undefined,
          phase === 3 ? 1 - span(local, 0, 0.1) : 1,
        );
        slots[g]!.visible = phase === 2 && transferTime >= 0 && u < 1;
        slots[g]!.material.opacity = phase === 2 ? 0.8 : 0.25;
        routes[g]!.visible = phase === 2 && transferTime >= 0 && u < 1;
        connect(routes[g]!, curve.getPoints(32));
        const contribution = contributions[g]!;
        contribution.group.visible = phase === 3 && local >= 0.12;
        const land = merge.landed;
        const mergeCurve = new T.QuadraticBezierCurve3(
          localO[g]!.group.position,
          v(xs[g]!, -4.4, 0.9),
          v(g === 0 ? -5.1 : 0, -5.65, 0.7),
        );
        contribution.group.position.copy(mergeCurve.getPoint(land));
        contribution.group.scale.setScalar(0.72 + 0.28 * land);
        contribution.group.scale.x *= 1 + 0.35 * land;
        contribution.title.textContent =
          land === 1 ? `卡${g} ${merge.weighted ? `已乘 ${g ? "¾" : "¼"}` : `答案 × ${g ? "¾" : "¼"}`}` : "";
        set(
          contribution,
          dcpChannels(DCP_EXAMPLE.local[g]!).map((n) => n * (merge.weighted ? (g ? 0.75 : 0.25) : 1)),
          undefined,
          span(Math.abs(contribution.group.position.y - localO[g]!.group.position.y), 0.25, 0.85),
        );
        mergeRoutes[g]!.visible = phase === 3 && local >= 0.12 && land < 1;
        connect(mergeRoutes[g]!, mergeCurve.getPoints(24));
      }
      result.group.visible = phase === 3 && local >= 0.34;
      set(
        result,
        merge.complete ? dcpChannels(25) : DCP_QUERY.map(() => ""),
        undefined,
        merge.complete ? 1 : 0.2,
      );
    };
  }
  const projected = new T.Vector3();
  const render = () => {
    if (disposed) return;
    const started = performance.now();
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    for (const caption of captions) {
      let visible = caption.visible();
      for (let p: T.Object3D | null = caption.parent; p; p = p.parent) visible &&= p.visible;
      caption.el.hidden = !visible;
      if (!visible) continue;
      if (caption.el === header) {
        caption.el.style.left = "50%";
        caption.el.style.top = "32px";
        continue;
      }
      projected.copy(caption.point);
      caption.parent.localToWorld(projected);
      projected.project(camera);
      caption.el.style.left = `${(((projected.x + 1) * width) / 2).toFixed(2)}px`;
      caption.el.style.top = `${(((1 - projected.y) * height) / 2).toFixed(2)}px`;
    }
    host.dataset.drawCalls = String(renderer.info.render.calls);
    host.dataset.triangles = String(renderer.info.render.triangles);
    host.dataset.renderMs = (performance.now() - started).toFixed(2);
  };
  const animate = (p: number) => {
    progress = p;
    animateContent(p);
    const frame = mechanismFrame(kind, p);
    hardware.chips.forEach((chip, i) => {
      const lit = strategy ? strategy.glow(i, p) : !(kind === 0 && frame.stage !== i);
      chip.material.emissive.set(lit ? "#245b43" : "#000");
      chip.material.emissiveIntensity = 0.35;
      portFrames[i]!.visible = !strategy && (kind !== 0 || (!frame.setup && frame.stage === i));
      portFrames[i]!.material.opacity = 0.5;
      extraction[i]!.visible =
        (kind === 1 && p < 0.963 && (frame.phase > 0 || frame.local >= 0.62)) ||
        (kind === 2 && pcpMotion(p).assign === 1) ||
        (kind === 3 && frame.split === 1) ||
        (kind === 4 && ringMotion(p).assign === 1);
      extraction[i]!.material.opacity = 0.68;
    });
    host.dataset.step = String(kind);
    host.dataset.phase = String(mechanismFrame(kind, p).phase);
    host.dataset.progress = p.toFixed(3);
    host.dataset.result =
      p === 1 && strategy
        ? strategy.result
        : p === 1
          ? [
              "9,8",
              SP_PROJECTED.map((row) => row.join(",")).join(";"),
              "o0,o1,o6,o7|o2,o3,o4,o5",
              dcpChannels(25).join(","),
              "q7=25",
            ][kind]!
          : "pending";
    render();
  };
  const reset = () => {
    camera.position.set(1.7, kind === 0 ? 7 : 6.3, 25);
    controls.target.set(0, strategy ? strategy.camera.targetY : kind === 0 ? 0 : -0.7, 0);
    controls.update();
    render();
  };
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    const base = strategy ? strategy.camera.half : kind === 0 ? 6.1 : kind === 4 ? 6.4 : 7.6;
    const half = Math.max(base, (8 * height) / width);
    camera.top = half;
    camera.bottom = -half;
    camera.left = (-half * width) / height;
    camera.right = (half * width) / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    animate(progress);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener("change", render);
  host.dataset.mechanism = ["PP", "SP", "PCP", "DCP", "Ring", "TP", "DP", "EP"][kind]!;
  reset();
  resize();
  return {
    update() {},
    animate,
    reset,
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      hardware.dispose();
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
