import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { scenePalette } from "./scene-palette";
import {
  REQUEST_EDGES,
  REQUEST_HANDOFF_LABELS,
  REQUEST_INPUT,
  REQUEST_STRUCTURE,
  type RequestNode,
  type RequestState,
  requestBinding,
  requestEase,
  requestPreviousState,
  requestState,
  requestStatus,
} from "./scene-request-data";
import { type RequestCell, requestCellPairs, requestCells, requestVector } from "./scene-request-identity";

type Sheet = {
  group: T.Group;
  paint(values: string[][], active?: number[], identity?: RequestCell[]): void;
  width: number;
  height: number;
  values(): string[][];
  cells(): RequestCell[];
};
type Label = { element: HTMLElement; anchor: T.Object3D; offset: T.Vector3; focus: boolean };
type FocusPort = { sheet: Sheet; offset?: T.Vector3 };
type CellLabel = {
  element: HTMLElement;
  face: T.Mesh;
  offset: T.Vector3;
  width: number;
  height: number;
  textWidth: number;
  focus: boolean;
};
const point = (x: number, y: number, z = 0) => new T.Vector3(x, y, z);
const ids = REQUEST_INPUT;
const logits = [
  ["v₀", "ℓ₀"],
  ["v₁", "ℓ₁"],
  ["v₂", "ℓ₂"],
  ["…", "…"],
  ["vₖ", "ℓₖ"],
];

/** One scene, one persistent architecture. Data trays unfold from their actual owning module. */
export async function mountRequestScene(host: HTMLDivElement, signal: AbortSignal) {
  if (signal.aborted) return null;
  const colors = scenePalette(host),
    paperHex = colors.paper || "#fbfaf6",
    borderColor = "#6d7873",
    wireIdle = "#6d7873",
    wireActive = colors.result || "#087f73",
    weightMineral = "#e0948b",
    weightSoftMineral = "#efc5bf",
    scene = new T.Scene();
  scene.background = new T.Color(paperHex);
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(paperHex, 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  const overlay = document.createElement("div");
  overlay.className = "wiki-request-labels";
  const location = document.createElement("div");
  location.className = "wiki-request-location";
  const legend = document.createElement("div");
  legend.className = "wiki-request-key";
  legend.textContent = "厚片：模型权重　薄片：本次数据　?：待验证";
  host.append(renderer.domElement, overlay, location, legend);
  scene.add(new T.HemisphereLight(0xffffff, 0xb9c5b8, 2.1));
  const light = new T.DirectionalLight(0xffffff, 2);
  light.position.set(-8, 10, 18);
  scene.add(light);
  const camera = new T.OrthographicCamera(-9, 9, 8, -8, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = controls.enablePan = false;
  controls.rotateSpeed = 0.35;
  controls.minAzimuthAngle = -0.13;
  controls.maxAzimuthAngle = 0.26;
  controls.minPolarAngle = 1.38;
  controls.maxPolarAngle = 1.56;
  const geometry = new T.BoxGeometry(1, 1, 1);
  const resources: (T.Material | T.BufferGeometry | T.Texture)[] = [geometry];
  const focusResources: (T.Material | T.BufferGeometry | T.Texture)[] = [];
  let buildingFocus = false;
  const keep = <U extends T.Material | T.BufferGeometry | T.Texture>(resource: U): U => {
    (buildingFocus ? focusResources : resources).push(resource);
    return resource;
  };
  const material = (color: string, opacity = 1) =>
    keep(new T.MeshStandardMaterial({ color, roughness: 0.7, transparent: opacity < 1, opacity }));
  const box = (parent: T.Object3D, at: T.Vector3, size: T.Vector3, color: string, opacity = 1) => {
    const mesh = new T.Mesh(geometry, material(color, opacity));
    mesh.position.copy(at);
    mesh.scale.copy(size);
    parent.add(mesh);
    return mesh;
  };
  const line = (parent: T.Object3D, points: T.Vector3[], color = colors.line, dashed = false) => {
    const g = keep(new T.BufferGeometry().setFromPoints(points));
    const m = keep(
      dashed
        ? new T.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08 })
        : new T.LineBasicMaterial({ color }),
    );
    const path = new T.Line(g, m);
    path.computeLineDistances();
    parent.add(path);
    const end = points.at(-1)!,
      previous = points.at(-2)!;
    if (!dashed && end.distanceTo(previous) > 0.1) {
      const direction = end.clone().sub(previous).normalize();
      const normal = new T.Vector3(-direction.y, direction.x, 0).multiplyScalar(0.1);
      const back = end.clone().addScaledVector(direction, -0.2);
      const arrow = keep(
        new T.BufferGeometry().setFromPoints([back.clone().add(normal), end, back.clone().sub(normal)]),
      );
      parent.add(new T.Line(arrow, m));
    }
    return path;
  };
  const labels: Label[] = [];
  const cells = new Set<CellLabel>();
  const fontFamily = getComputedStyle(host).fontFamily;
  const label = (parent: T.Object3D, title: string, sub: string, at: T.Vector3) => {
    const element = document.createElement("div");
    element.className = "wiki-request-label";
    const strong = document.createElement("strong"),
      small = document.createElement("small");
    strong.textContent = title;
    small.textContent = sub;
    element.append(strong, small);
    overlay.append(element);
    labels.push({ element, anchor: parent, offset: at, focus: buildingFocus });
    return { strong, small, element };
  };
  const dataColors = ["#85a9ec", "#78c8b0", "#9d90cc", "#e0948b", wireActive, "#d97c72", "#6b8ec9"];
  let focusEntry: Sheet | undefined;
  const sheet = (
    parent: T.Object3D,
    values: string[][],
    x: number,
    y: number,
    width: number,
    height: number,
    weight = false,
    z = 0,
    resolution = 384,
    receiver = false,
  ): Sheet => {
    const inFocus = buildingFocus;
    const group = new T.Group();
    group.position.set(x, y, z);
    parent.add(group);
    const depth = weight ? 0.85 : 0.2;
    if (!receiver)
      box(group, point(0, 0, -depth / 2), point(width, height, depth), weight ? weightMineral : wireActive);
    const canvas = document.createElement("canvas");
    canvas.width = resolution;
    canvas.height = Math.max(96, Math.round((resolution * height) / width));
    const ctx = canvas.getContext("2d")!;
    const texture = keep(new T.CanvasTexture(canvas));
    texture.colorSpace = T.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = T.LinearFilter;
    const face = new T.Mesh(
      keep(new T.PlaneGeometry(width, height)),
      keep(new T.MeshBasicMaterial({ map: texture, transparent: false })),
    );
    face.position.z = 0.01;
    group.add(face);
    let cellLabels: CellLabel[] = [];
    let shape = "";
    let signature = "";
    let painted = values;
    let identities = requestCells(values);
    const paint = (rows: string[][], active: number[] = [], identity = requestCells(rows)) => {
      const next = JSON.stringify([rows, active, identity]);
      if (next === signature) return;
      signature = next;
      painted = rows;
      identities = identity;
      const rh = canvas.height / rows.length,
        cols = rows[0]!.length,
        cw = canvas.width / cols;
      if (shape !== `${rows.length}:${cols}`) {
        for (const cell of cellLabels) {
          cell.element.remove();
          cells.delete(cell);
        }
        cellLabels = rows.flatMap((row, r) =>
          row.map((_, c) => {
            const element = document.createElement("span");
            element.className = "wiki-request-cell";
            element.dataset.focus = String(inFocus);
            element.dataset.receiver = String(receiver);
            overlay.append(element);
            const cell: CellLabel = {
              element,
              face,
              offset: point(((c + 0.5) / cols - 0.5) * width, (0.5 - (r + 0.5) / rows.length) * height),
              width: width / cols,
              height: height / rows.length,
              textWidth: 0,
              focus: inFocus,
            };
            cells.add(cell);
            return cell;
          }),
        );
        shape = `${rows.length}:${cols}`;
      }
      ctx.fillStyle = paperHex;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      rows.forEach((row, r) => {
        row.forEach((value, c) => {
          const selected = active.includes(r * cols + c);
          const meta = identities[r * cols + c]!;
          const color = weight ? weightMineral : (dataColors[meta.tone] ?? borderColor);
          const tint = new T.Color(color).lerp(
            new T.Color(paperHex),
            receiver ? 0.9 : selected ? 0.42 : 0.72,
          );
          ctx.fillStyle = `#${tint.getHexString()}`;
          ctx.fillRect(c * cw + 2, r * rh + 2, cw - 4, rh - 4);
          ctx.strokeStyle = receiver ? color : "#7f8a84";
          ctx.lineWidth = receiver ? 4 : 2.2;
          ctx.strokeRect(c * cw + 2, r * rh + 2, cw - 4, rh - 4);
          if (!weight && meta.identity) {
            ctx.fillStyle = color;
            ctx.fillRect(c * cw + 2, r * rh + 2, Math.max(4, cw * 0.03), rh - 4);
          }
          const cell = cellLabels[r * cols + c]!;
          cell.element.textContent = value;
          cell.element.dataset.identity = weight ? "" : meta.identity;
          cell.element.dataset.cellKey = meta.key;
          cell.element.dataset.tone = color;
          ctx.font = `600 15px ${fontFamily}`;
          cell.textWidth = ctx.measureText(value).width;
        });
      });
      ctx.strokeStyle = receiver ? wireActive : borderColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
      texture.needsUpdate = true;
    };
    paint(values);
    const result = { group, paint, width, height, values: () => painted, cells: () => identities };
    if (buildingFocus && !focusEntry) focusEntry = result;
    return result;
  };
  const baseEdge = keep(new T.EdgesGeometry(geometry));
  const modules = new Map<
    RequestNode,
    {
      group: T.Group;
      base: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>;
      border: T.LineSegments<T.EdgesGeometry, T.LineBasicMaterial>;
      data: Sheet;
      text: HTMLElement;
    }
  >();
  for (const node of REQUEST_STRUCTURE) {
    const group = new T.Group();
    group.position.set(node.x, node.y, 0);
    scene.add(group);
    const base = box(group, point(0, 0, -0.35), point(2.55, 1.25, 0.4), colors.board || "#dfe3dd");
    const border = new T.LineSegments(
      baseEdge,
      keep(new T.LineBasicMaterial({ color: borderColor, transparent: true, opacity: 0.78 })),
    );
    border.scale.setScalar(1.01);
    base.add(border);
    if (node.id === "layers")
      for (let i = 0; i < 5; i++)
        box(
          group,
          point(-0.3 + i * 0.12, 0.1 + i * 0.07, 0.05 + i * 0.13),
          point(1.8, 0.85, 0.09),
          weightSoftMineral,
        );
    if (node.id === "embed")
      for (let i = 0; i < 8; i++)
        box(
          group,
          point(-1 + (i % 4) * 0.65, -0.65 - Math.floor(i / 4) * 0.16, 0.05),
          point(0.42, 0.12, 0.2),
          colors.chip || "#242d2a",
        );
    const data = sheet(
      group,
      [["", "", "", ""]],
      0,
      0,
      2.25,
      0.62,
      false,
      node.id === "layers" ? 0.85 : 0.12,
    );
    const text = label(group, node.title, "", point(0, 1, 0)).element;
    text.dataset.node = node.id;
    modules.set(node.id, { group, base, border, data, text });
  }
  // Separate ports and corridors keep requests, cache access and responses distinguishable.
  const routes: Record<string, number[][]> = {
    "client:api": [
      [-7, 2.6],
      [-7.65, 2.6],
      [-7.65, 5.6],
      [-7, 5.6],
    ],
    "api:client": [
      [-7, 5],
      [-7.3, 5],
      [-7.3, 2],
      [-7, 2],
    ],
    "api:engine": [
      [-4.4, 5.5],
      [-3.2, 5.5],
    ],
    "engine:api": [
      [-3.2, 5],
      [-4.4, 5],
    ],
    "engine:embed": [
      [-0.6, 5.3],
      [0.6, 5.3],
    ],
    "embed:layers": [
      [3.2, 5.3],
      [4.4, 5.3],
    ],
    "layers:head": [
      [7, 5],
      [7.12, 5],
      [7.12, 2.3],
      [7, 2.3],
    ],
    "head:sample": [
      [4.4, 2.3],
      [3.2, 2.3],
    ],
    "sample:engine": [
      [0.6, 2.5],
      [0.3, 2.5],
      [0.3, 4],
      [-1.15, 4],
      [-1.15, 4.65],
    ],
    "engine:cache": [
      [-2.6, 4.65],
      [-2.6, 4],
      [-3.55, 4],
      [-3.55, 2.3],
      [-3.2, 2.3],
    ],
    "cache:layers": [
      [-0.6, 2],
      [0, 2],
      [0, 0.95],
      [7.45, 0.95],
      [7.45, 5.3],
      [7, 5.3],
    ],
  };
  const paths = REQUEST_EDGES.map(([from, to]) => {
    const key = `${from}:${to}`;
    const path = line(
      scene,
      routes[key]!.map(([x, y]) => point(x!, y!, -0.3)),
      colors.wire,
    );
    path.material.transparent = true;
    return { key, path };
  });
  const focus = new T.Group();
  scene.add(focus);
  const binding = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  binding.classList.add("wiki-request-binding");
  binding.setAttribute("aria-hidden", "true");
  host.insertBefore(binding, overlay);
  const bindingPath = (role: string) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `wiki-request-binding-${role}`);
    binding.append(path);
    return path;
  };
  const ownerOutline = bindingPath("owner"),
    unfoldGuide = bindingPath("guide"),
    detailBracket = bindingPath("bracket"),
    inputOutline = bindingPath("input"),
    outputOutline = bindingPath("output");
  const previousOwner = bindingPath("owner"),
    previousGuide = bindingPath("guide"),
    movingOutline = bindingPath("output");
  previousOwner.setAttribute("data-outgoing", "true");
  previousGuide.setAttribute("data-outgoing", "true");
  movingOutline.setAttribute("data-carried", "true");
  const portAnchor = new T.Group();
  scene.add(portAnchor);
  const unfoldLabel = label(focus, "展开", "", point(0, 0));
  unfoldLabel.element.classList.add("wiki-request-unfold");
  const unfoldLabelPosition = labels.at(-1)!.offset;
  const ports: HTMLElement[] = [];
  for (const [role, text, x] of [
    ["input", "A 入", -0.78],
    ["output", "B 出", 0.78],
  ] as const) {
    const port = label(portAnchor, text, "", point(x, -0.96, 0.9));
    port.element.classList.add("wiki-request-port");
    port.element.dataset.port = role;
    ports.push(port.element);
  }
  const outgoingAnchor = new T.Group();
  scene.add(outgoingAnchor);
  const outgoingPort = label(outgoingAnchor, "B 出", "", point(0.78, -0.96, 0.9));
  outgoingPort.element.classList.add("wiki-request-port");
  outgoingPort.element.dataset.port = "output";
  outgoingPort.element.dataset.outgoing = "true";
  outgoingPort.element.setAttribute("aria-hidden", "true");
  let inputPort: FocusPort | undefined, outputPort: FocusPort | undefined;
  // This tray survives stage rebuilds: the completed output itself moves into the next input.
  const transfer = new T.Group();
  scene.add(transfer);
  const transferLabel = label(transfer, "B → A", "", point(0, 0));
  transferLabel.element.classList.add("wiki-request-port", "wiki-request-transfer-port");
  transferLabel.element.setAttribute("aria-hidden", "true");
  const transferLabelPosition = labels.at(-1)!.offset;
  const carried: Sheet[] = [];
  const receiving = new T.Group();
  scene.add(receiving);
  const slots: Sheet[] = [];
  const receiverFrame = new T.LineLoop(
    keep(
      new T.BufferGeometry().setFromPoints([
        point(-0.5, -0.5),
        point(0.5, -0.5),
        point(0.5, 0.5),
        point(-0.5, 0.5),
      ]),
    ),
    keep(new T.LineBasicMaterial({ color: colors.result, transparent: true })),
  );
  receiving.add(receiverFrame);
  let receiverTitle: Label | undefined;
  const cameraLift = new T.Vector3();
  type Snapshot = {
    at: T.Vector3;
    rotation: T.Quaternion;
    width: number;
    height: number;
    values: string[][];
    cells: RequestCell[];
    stack: { at: T.Vector3; rotation: T.Quaternion }[];
  };
  const completed = new Map<string, Snapshot>();
  let exit: Sheet | undefined;
  const exitOffset = point(0, 0);
  const entryOffset = point(0, 0);
  let exitValues: string[][] | undefined;
  let exitStack: Sheet[] = [];
  let entryStack: Sheet[] = [];
  let pairs: { from: number; to: number }[] = [];
  let incoming: Snapshot | undefined;
  let target: Snapshot | undefined;
  let animations: ((state: RequestState) => void)[] = [],
    current = "",
    width = 1,
    height = 1,
    section = 0,
    progress = 0;
  const title = (name: string, detail: string, x: number, y: number) => {
    const caption = label(focus, name, detail, point(x, y, 0.8));
    if (y < -1.7) caption.element.classList.add("wiki-request-footnote");
    return caption;
  };
  const connector = (from: T.Vector3, to: T.Vector3) =>
    line(
      focus,
      [from, point((from.x + to.x) / 2, from.y, from.z), point((from.x + to.x) / 2, to.y, to.z), to],
      wireIdle,
    );
  const build = (s: RequestState) => {
    focus.clear();
    for (const resource of focusResources) resource.dispose();
    focusResources.length = 0;
    for (let i = labels.length - 1; i >= 0; i--)
      if (labels[i]!.focus) {
        labels[i]!.element.remove();
        labels.splice(i, 1);
      }
    for (const cell of cells)
      if (cell.focus) {
        cell.element.remove();
        cells.delete(cell);
      }
    animations = [];
    focusEntry = undefined;
    inputPort = outputPort = undefined;
    entryOffset.set(0, 0, 0);
    exit = undefined;
    exitOffset.set(0, 0, 0);
    exitValues = undefined;
    exitStack = [];
    entryStack = [];
    buildingFocus = true;
    const key = `${s.section}:${s.phase}`;
    if (key === "0:0") {
      const prompt = sheet(
        focus,
        [["<|user|>"], ["请用一句话解释"], ["KV cache。"], ["<|assistant|><think>"]],
        -4.2,
        0,
        4.1,
        2.8,
      );
      title("客户端文字 → 模型输入", "API 应用 chat template", -4.2, 2.4);
      const out = sheet(
        focus,
        ids.map((id, i) => [id, String(i)]),
        2.7,
        0,
        4.4,
        2.5,
      );
      exit = out;
      title("token ID / 位置", "分词后才有编号；不是一字一格", 2.7, 2);
      connector(point(-2.1, 0), point(0.4, 0));
      title("Tokenizer", "文本 → 离散编号", -1.2, -2);
      animations.push((state) => {
        const n = Math.floor(state.work * 4.99);
        out.paint(
          ids.map((id, i) => [i < n ? id : "—", i < n ? String(i) : "—"]),
          [n * 2 - 2, n * 2 - 1],
        );
        prompt.group.rotation.y = -0.13;
      });
    } else if (key === "0:1") {
      const request = sheet(
        focus,
        ids.map((id, i) => [id, String(i)]),
        -4,
        0.3,
        3.3,
        2.4,
      );
      const queue = sheet(
        focus,
        ids.map(() => ["—", "—"]),
        1.6,
        0.3,
        2.8,
        2.4,
      );
      exit = queue;
      const other = sheet(focus, [["空"]], 5, 0.3, 1.7, 0.8);
      title("同一条请求", "选择 DP0", -4, 2);
      title("DP0 队列", "等待 → 本步运行", 1.6, 2);
      title("DP1 队列", "没有第二条真实请求", 5, 2);
      connector(point(-2.3, 0.3), point(0.2, 0.3));
      animations.push((state) => {
        queue.paint(
          ids.map((id, i) => (state.queued ? [id, String(i)] : ["—", "—"])),
          state.queued ? [0, 2, 4, 6] : [],
        );
        request.group.position.x = -4;
        other.group.rotation.y = -0.1;
      });
      title("请求归属 ≠ 专家只在本机", "后续 MoE 仍会使用跨两组的 EP16 专家", 0, -2);
    } else if (key === "0:2") {
      exit = sheet(
        focus,
        ids.map((id, i) => [id, String(i)]),
        -4.4,
        0,
        3.3,
        2.4,
      );
      title("本步 4 个位置", "另预留 3 个候选位置，候选尚未生成", -4.4, 2);
      const pool = sheet(
        focus,
        Array.from({ length: 3 }, () => Array(5).fill("空")),
        1.9,
        0,
        5.5,
        2.1,
      );
      title("分配 15 个块号", "容量已占用；还没写入计算结果", 1.9, 2);
      outputPort = { sheet: pool };
      animations.push((state) =>
        pool.paint(
          Array.from({ length: 3 }, (_, r) =>
            Array.from({ length: 5 }, (_, c) => (r * 5 + c < state.allocatedBlocks ? "预留" : "空")),
          ),
          Array.from({ length: state.allocatedBlocks }, (_, i) => i),
        ),
      );
      title("按正文混合缓存分组分配", "全量组 1 + KDA 状态组 12 + indexer 状态 2", 0, -2);
    } else if (key === "0:3") {
      sheet(
        focus,
        ids.map((id, i) => [id, String(i)]),
        -4.8,
        0.2,
        3.2,
        2.4,
      );
      title("同一位置计划", "左侧 ID · 右侧 position", -4.8, 2.2);
      const workers: { group: T.Group; input: Sheet }[] = [];
      for (let i = 0; i < 8; i++) {
        const g = new T.Group();
        g.position.set(-0.9 + (i % 4) * 1.85, 0.7 - Math.floor(i / 4) * 2.1, -0.2);
        focus.add(g);
        box(g, point(0, 0, -0.2), point(1.6, 1.25, 0.35), colors.board);
        const input = sheet(
          g,
          [
            ["p₀", "p₁"],
            ["p₂", "p₃"],
          ],
          0,
          0,
          1.35,
          1.05,
        );
        workers.push({ group: g, input });
        if (i === 0) exit = input;
        label(g, `r${i}`, "", point(0, 0.9, 0.3));
      }
      animations.push((state) =>
        workers.forEach(({ group, input }, i) => {
          const ready = state.work * 8 > i + 0.3;
          group.scale.setScalar(0.85 + 0.15 * requestEase(state.work * 8 - i));
          input.paint(
            ready
              ? [
                  ["p₀", "p₁"],
                  ["p₂", "p₃"],
                ]
              : [
                  ["—", "—"],
                  ["—", "—"],
                ],
            ready ? [0, 1, 2, 3] : [],
          );
        }),
      );
      title("DP0 · 8 个 worker", "输入相同 · 计算分片", 2.1, 2.6);
    } else if (key === "1:0") {
      const tokenIds = sheet(focus, [ids.slice(0, 2), ids.slice(2)], -5.4, 0, 1.8, 1.6);
      title("输入 ID", "位置 0 → 3", -5.4, 2.35);
      const tableRows = [
        ["…", "…", "…", "…"],
        ...ids.map((_, i) => requestVector("e", i)),
        ["…", "…", "…", "…"],
      ];
      const table = sheet(focus, tableRows, -1.8, 0, 3.9, 3.6, true);
      title("Embedding 权重表", "按 pᵢ 查行，权重留在原处", -1.8, 2.35);
      const result = sheet(
        focus,
        ids.map(() => ["—", "—", "—", "—"]),
        3.8,
        0,
        3.9,
        2.4,
      );
      exit = result;
      title("隐藏表示 H", "4 行 × 4096 维（列省略）", 3.8, 2.35);
      const copies = ids.map((_, i) =>
        sheet(focus, [requestVector("e", i)], -1.8, 1.8 - (i + 1.5) * 0.6, 3.9, 0.6, false, 0.15),
      );
      animations.push((state) => {
        const n = Math.min(3, Math.floor(state.work * 4));
        tokenIds.paint([ids.slice(0, 2), ids.slice(2)], [n]);
        table.paint(tableRows, state.work > 0 ? [0, 1, 2, 3].map((c) => (n + 1) * 4 + c) : []);
        copies.forEach((copy, i) => {
          const t = requestEase(state.work * 4 - i);
          copy.group.position.set(
            T.MathUtils.lerp(-1.8, 3.8, t),
            T.MathUtils.lerp(1.8 - (i + 1.5) * 0.6, 0.9 - i * 0.6, t),
            0.2 + Math.sin(t * Math.PI) * 0.8,
          );
          copy.group.visible = state.work > 0 && state.work * 4 >= i;
        });
        result.paint(
          ids.map((_, i) => (state.work * 4 >= i + 1 ? requestVector("e", i) : ["—", "—", "—", "—"])),
        );
      });
      title("pᵢ → eᵢⱼ：颜色沿用输入位置 i", "j 是分量编号；n 代表第 4095 个分量，中间列省略", 0, -2.7);
    } else if (key === "1:1") {
      const streams: Sheet[] = [];
      for (let i = 3; i >= 0; i--) {
        const plane = sheet(
          focus,
          ids.map((_, r) => requestVector("e", r)),
          -3.7,
          0,
          3.9,
          2.4,
          false,
          i * 0.42,
        );
        streams.unshift(plane);
      }
      title("4 个位置 × 4 路残差", "深度方向是 residual 流", -3.7, 2.7);
      focusEntry = streams[0];
      exit = streams[0];
      exitStack = streams;
      entryStack = streams;
      outputPort = { sheet: streams[3]! };
      const layerMeshes = Array.from({ length: 9 }, (_, i) =>
        box(focus, point(0.4, -1.1 + i * 0.27, i * 0.14), point(2.35, 0.16, 1.1), weightSoftMineral),
      );
      const layerTitle = title("45 层主干", "每片概括 5 层", 0.5, 2.7);
      const mla = sheet(focus, [["0", "1", "2", "3"]], 4.6, 0.65, 3, 0.65);
      const kda = sheet(
        focus,
        [
          ["S", "S"],
          ["S", "S"],
        ],
        4.6,
        -1,
        2.3,
        1.2,
      );
      const cacheTitle = title("逐层历史状态", "展开 4 路 · 尚未写缓存", 4.5, 2.7);
      animations.push((state) => {
        const t = requestEase(state.work * 5);
        streams.forEach((plane, i) => {
          plane.group.visible = i === 0 || t > 0.05;
          plane.group.position.set(-3.8 + i * 0.34 * t, i * 0.15 * t, i * 0.6 * t);
          plane.paint(
            ids.map((_, r) => requestVector(state.layersDone ? "h" : "e", r)),
            state.layersDone ? Array.from({ length: 16 }, (_, cell) => cell) : [],
          );
        });
        layerTitle.small.textContent = `已更新 ${state.layersDone} / 45 层 · attention / FFN`;
        cacheTitle.small.textContent =
          state.layersDone === 0
            ? "展开 4 路 · 尚未写缓存"
            : state.layersDone < 4
              ? "L0–L2 为 KDA · 首个 MLA 在第 3 层"
              : `MLA ${state.mlaLayersDone}/11 层（4 位同写）· KDA 更新 S`;
        layerMeshes.forEach((mesh, i) => {
          mesh.material.color.set(state.layersDone >= (i + 1) * 5 ? wireActive : weightSoftMineral);
        });
        mla.paint([["0", "1", "2", "3"]], state.layersDone >= 4 ? [0, 1, 2, 3] : []);
        kda.paint(
          Array.from({ length: 2 }, () => Array(2).fill(state.layersDone >= 1 ? "S′" : "S")),
          state.layersDone >= 1 ? [0, 1, 2, 3] : [],
        );
      });
      title("变的是隐藏表示与历史状态", "输入仍是 p₀ p₁ p₂ p₃；还没有生成新 token", 0, -2.8);
    } else if (key === "1:2") {
      for (let i = 3; i >= 0; i--) {
        const plane = sheet(
          focus,
          ids.map((_, r) => requestVector("h", r)),
          -5.15 + i * 0.16,
          0.15 + i * 0.06,
          2.9,
          2.3,
          false,
          i * 0.3,
        );
        plane.paint(
          ids.map((_, r) => requestVector("h", r)),
          Array.from({ length: 16 }, (_, c) => c),
        );
        entryStack.unshift(plane);
      }
      focusEntry = entryStack[0];
      title("主干 4 路输出", "[4,4,4096] 全 4 位", -4.95, 2.25);
      const mergeSlabs = Array.from({ length: 4 }, (_, i) =>
        box(
          focus,
          point(-5.15 + i * 0.16, 0.15 + i * 0.06, i * 0.3 + 0.12),
          point(2.85, 2.25, 0.08),
          dataColors[i]!,
          0.35,
        ),
      );
      sheet(focus, [["¼ Σ"], ["RMSNorm"]], -2.0, 0.15, 1.45, 1.4);
      title("全位置归约", "4 路均值 + RMSNorm", -2.0, -1.62);
      const normed = sheet(
        focus,
        ids.map(() => ["—", "—", "—", "—"]),
        1.15,
        0.15,
        3.0,
        2.3,
      );
      title("整批归一化输出", "[4,4096] 保留给 MTP", 1.15, 2.25);
      const sliceRow = sheet(focus, [requestVector("z", 3)], 1.15, -0.71, 3.0, 0.58, false, 0.25);
      const out = sheet(
        focus,
        requestVector("z", 3).map((v) => [v]),
        4.95,
        0.15,
        1.45,
        2.3,
      );
      exit = out;
      title("切片末位 → 输出头", "仅位置 3 · [1,4096]", 4.95, 2.25);
      connector(point(-3.2, 0.15), point(-2.75, 0.15));
      connector(point(-1.25, 0.15), point(-0.38, 0.15));
      connector(point(2.7, -0.71), point(4.18, 0.15));
      animations.push((state) => {
        const mergeT = requestEase(state.work / 0.48);
        const normedReady = state.work >= 0.45;
        const slicing = state.work >= 0.58;
        const sliceT = requestEase((state.work - 0.58) / 0.24);
        mergeSlabs.forEach((slab, i) => {
          slab.visible = state.work > 0 && state.work < 0.5;
          slab.position.set(
            T.MathUtils.lerp(-5.15 + i * 0.16, 1.15, mergeT),
            T.MathUtils.lerp(0.15 + i * 0.06, 0.15, mergeT),
            T.MathUtils.lerp(i * 0.3 + 0.12, 0.1, mergeT),
          );
        });
        normed.paint(
          normedReady ? ids.map((_, r) => requestVector("z", r)) : ids.map(() => ["—", "—", "—", "—"]),
          !normedReady ? [] : slicing ? [12, 13, 14, 15] : Array.from({ length: 16 }, (_, c) => c),
        );
        sliceRow.group.visible = slicing && state.work < 0.84;
        sliceRow.group.position.set(
          T.MathUtils.lerp(1.15, 4.95, sliceT),
          T.MathUtils.lerp(-0.71, 0.15, sliceT),
          0.25 + Math.sin(sliceT * Math.PI) * 0.5,
        );
        sliceRow.group.scale.setScalar(1 - 0.35 * sliceT);
        out.paint(
          (state.work >= 0.8 ? requestVector("z", 3) : ["—", "—", "—", "—"]).map((v) => [v]),
          state.work >= 0.8 ? [0, 1, 2, 3] : [],
        );
      });
      title(
        "全位置四路求均值 + RMSNorm 得到 [4, 4096]",
        "前 3 行保留供 MTP 首遍；仅切片位置 3 (z₃) 送入输出头生成 y₀",
        0,
        -2.5,
      );
    } else if (key === "1:3") {
      const h = sheet(
        focus,
        requestVector("z", 3).map((v) => [v]),
        -5.4,
        0,
        1.3,
        2.7,
      );
      title("最后位置向量", "4096 个分量", -5.2, 2.4);
      const weights = [
        ["w₀₀", "w₀₁", "w₀₂", "…", "w₀ₖ"],
        ["w₁₀", "w₁₁", "w₁₂", "…", "w₁ₖ"],
        ["⋮", "⋮", "⋮", "…", "⋮"],
        ["wₙ₀", "wₙ₁", "wₙ₂", "…", "wₙₖ"],
      ];
      const w = sheet(focus, weights, -0.8, 0, 4.8, 2.7, true);
      title("输出头权重 W", "每列一个候选；n = 4095", -0.8, 2.4);
      const scores = sheet(focus, logits, 4.6, 0, 2.6, 3.1);
      exit = scores;
      title("候选 logits", "154880 个分数", 4.7, 2.4);
      const formula = title("ℓₖ = Σⱼ z₃ⱼ · Wⱼₖ", "每次点亮整列权重，归约为一个候选分数", 0, -2.5);
      animations.push((state) => {
        const c = Math.min(4, Math.floor(state.work * 5));
        h.paint(
          requestVector("z", 3).map((v) => [v]),
          [0, 1, 2, 3],
        );
        w.paint(weights, state.work > 0 ? [0, 1, 2, 3].map((r) => r * 5 + c) : []);
        scores.paint(
          logits.map(([id, value], i) => [id!, i === 3 || i + 1 <= state.work * 5 ? value! : "—"]),
          [c * 2, c * 2 + 1],
        );
        formula.strong.textContent = `ℓ${c === 4 ? "ₖ" : c} = Σⱼ z₃ⱼ · Wⱼ${c === 4 ? "ₖ" : c}`;
      });
    } else if (key === "2:0") {
      const candidates = sheet(focus, logits, -4, 0, 3, 2.8);
      title("整个词表的候选", "ID 与分数是两种数据", -4, 2.3);
      sheet(focus, [["采样规则"]], 0.2, 0, 2.7, 0.9);
      const chosen = sheet(focus, [["待选"]], 4.3, 0, 2.2, 0.9);
      exit = chosen;
      title("第一个新 ID", "y₀ ≠ p₃", 4.3, 2.3);
      connector(point(-2.4, 0), point(-1.2, 0));
      connector(point(1.6, 0), point(3.2, 0));
      animations.push((state) => {
        candidates.paint(logits, state.sampled ? [8, 9] : []);
        chosen.paint([[state.sampled ? "y₀" : "待选"]], state.sampled ? [0] : []);
      });
      title("在词表中选出一个 ID", "vₖ 仅表示被选中的候选；没有假造真实分数或输出词", 0, -2.5);
    } else if (key === "2:1") {
      const hidden = sheet(
        focus,
        [
          ["h₀", "4096"],
          ["h₁", "4096"],
          ["h₂", "4096"],
          ["h₃", "4096"],
        ],
        -4.95,
        0.95,
        2.6,
        1.65,
      );
      const embedding = sheet(
        focus,
        [
          ["p₁", "0"],
          ["p₂", "1"],
          ["p₃", "2"],
          ["y₀", "3"],
        ],
        -4.95,
        -0.9,
        2.6,
        1.65,
      );
      focusEntry = { ...embedding, width: 1.7, height: 0.65, values: () => [["y₀"]] };
      entryOffset.set(-0.62, -0.62, 0);
      inputPort = { sheet: { ...hidden, height: 3.5 }, offset: point(0, -0.925) };
      exit = sheet(focus, [["y₀"]], 4.4, -1.25, 1.7, 0.6);
      label(exit.group, "已确认，可返回", "", point(0, -0.55, 0.1));
      const source = title("首遍 4 行输入", "主干 [h₀…h₃] + 左移 [p₁,p₂,p₃,y₀]", -4.95, 2.25);
      for (let i = 0; i < 3; i++)
        box(
          focus,
          point(-0.55 + i * 0.12, i * 0.05, -0.45 + i * 0.14),
          point(3.65, 2.0, 0.12),
          weightSoftMineral,
        );
      const mtpPipe = sheet(
        focus,
        [["2×RMSNorm [4,4096]"], ["拼接 concat [4,8192]"], ["投影 proj [4,4096]"], ["MLA+MoE → 末行 d₁?"]],
        -0.55,
        0.05,
        3.65,
        2.0,
        false,
        0.1,
      );
      const mtpTitle = title("MTP 草稿层（第 45 层）", "首遍 4 行并行 · 后两遍单行接力", -0.55, 2.25);
      connector(point(-3.6, 0.95), point(-2.4, 0.55));
      connector(point(-3.6, -0.9), point(-2.4, -0.55));
      connector(point(1.32, 0.05), point(2.35, 0.2));
      const drafts = sheet(focus, [["—", "—", "—"]], 4.4, 0.2, 3.7, 1.1);
      outputPort = { sheet: drafts };
      line(
        focus,
        [
          point(2.45, -0.45, 0.1),
          point(6.35, -0.45, 0.1),
          point(6.35, 0.85, 0.1),
          point(2.45, 0.85, 0.1),
          point(2.45, -0.45, 0.1),
        ],
        weightMineral,
        true,
      );
      title("留在 worker 的候选", "首遍末行出 d₁? · 仍待验证", 4.4, 2.25);
      animations.push((state) => {
        const firstPass = state.drafts.length === 0;
        if (firstPass) {
          const stepIdx = Math.min(3, Math.floor((state.work / 0.34) * 4));
          hidden.paint(
            [
              ["h₀", "4096"],
              ["h₁", "4096"],
              ["h₂", "4096"],
              ["h₃", "4096"],
            ],
            stepIdx >= 3 ? [6, 7] : [0, 1, 2, 3, 4, 5, 6, 7],
          );
          embedding.paint(
            state.work < 0.08
              ? [
                  ["p₁", "0"],
                  ["p₂", "1"],
                  ["p₃", "2"],
                  ["y₀", "3"],
                ]
              : [
                  ["0 (pos0)", "清零"],
                  ["E[p₂]", "4096"],
                  ["E[p₃]", "4096"],
                  ["E[y₀]", "4096"],
                ],
            stepIdx >= 3 ? [6, 7] : [0, 1, 2, 3, 4, 5, 6, 7],
          );
          mtpPipe.paint(
            [
              ["2×RMSNorm [4,4096]"],
              ["拼接 concat [4,8192]"],
              ["投影 proj [4,4096]"],
              ["MLA+MoE → 末行 d₁?"],
            ],
            state.work > 0 ? [stepIdx] : [],
          );
          source.strong.textContent = "首遍 4 行输入";
          source.small.textContent =
            state.work < 0.08 ? "左移 [p₁,p₂,p₃,y₀] · pos 0…3" : "pos=0 嵌入清零 · 各做 RMSNorm";
          mtpTitle.small.textContent = "第 1 遍：4 行并行，仅取末行得 d₁?";
        } else {
          const passNum = Math.min(3, state.drafts.length + 1);
          hidden.paint([[state.draftHidden, "1×4096"]], [0, 1]);
          embedding.paint([[`E[${state.draftInput}]`, "1×4096"]], [0, 1]);
          mtpPipe.paint(
            [
              ["2×RMSNorm · R1 末行"],
              ["拼接 → 投影 8192→4096"],
              [`复用 MTP 权重 · 第 ${passNum} 遍`],
              [`词表投影 → d${passNum === 2 ? "₂" : "₃"}?`],
            ],
            [2, 3],
          );
          source.strong.textContent = `第 ${passNum} 遍单行接力`;
          source.small.textContent = `上次隐藏 ${state.draftHidden} + ${state.draftInput} 嵌入`;
          mtpTitle.small.textContent = `第 ${passNum} 遍：复用同一层权重`;
        }
        drafts.paint(
          [[...state.drafts, ...Array(3 - state.drafts.length).fill("—")]],
          state.drafts.map((_, i) => i),
        );
      });
      title(
        "首遍 4 行 [h₀…h₃] + [p₁,p₂,p₃,y₀]（pos=0 嵌入清零）→ 末行 d₁?",
        "后两遍复用同一 MTP 权重，单行接力草拟 d₂?、d₃?；候选都还不能返回",
        0,
        -2.45,
      );
    } else if (key === "2:2") {
      const tokens = sheet(focus, [[...ids, "—"]], -1.7, 0.65, 8, 0.85);
      exit = { ...tokens, width: 1.6 };
      exitOffset.set(3.2, 0, 0);
      exitValues = [["y₀"]];
      const arriving = sheet(focus, [["y₀"]], 1.5, 1.55, 1.6, 0.6);
      focusEntry = arriving;
      const computed = sheet(focus, [["已算", "已算", "已算", "已算", "待算"]], -1.7, -0.25, 8, 0.6);
      title("Engine 中 R1 的 token 列表", "位置 0　1　2　3　4", -1.7, 2.4);
      const output = sheet(focus, [["等待"]], 4.7, 0.2, 2.1, 1.3);
      title("API → 客户端", "增量反分词 / SSE", 4.7, 2.4);
      animations.push((state) => {
        arriving.group.position.y = 1.55 - 0.9 * requestEase(state.work / 0.35);
        arriving.group.visible = state.work < 0.35;
        tokens.paint(
          [[...ids, state.confirmed.length === 5 ? "y₀" : "—"]],
          state.confirmed.length === 5 ? [4] : [],
        );
        computed.paint([["已算", "已算", "已算", "已算", "待算"]], [0, 1, 2, 3]);
        output.paint([[state.returned.length ? "增量文字" : "等待"]], state.returned.length ? [0] : []);
      });
      title("持有 5 个 ID ≠ 已计算 5 个位置", "y₀ 已确认，但它自身的前向还没做；候选没有返回", 0, -2.2);
    } else if (key === "2:3") {
      const history = sheet(focus, [["0", "1", "2", "3"]], -4.4, 0, 3.3, 0.8);
      title("已有历史", "前四位置已经计算", -4.4, 2.3);
      const next = sheet(
        focus,
        [
          ["y₀", "4"],
          ["d₁?", "5"],
          ["d₂?", "6"],
          ["d₃?", "7"],
        ],
        1.2,
        0,
        3.4,
        2.4,
      );
      focusEntry = { ...next, width: 1.7, height: 0.6, values: () => [["y₀"]] };
      entryOffset.set(-0.85, 0.9, 0);
      exit = next;
      title("下一轮送入主模型", "左侧 ID · 右侧 position", 1.2, 2.3);
      animations.push((state) => {
        history.paint([["0", "1", "2", "3"]], [0, 1, 2, 3]);
        next.paint(
          [
            ["y₀", "4"],
            ["d₁?", "5"],
            ["d₂?", "6"],
            ["d₃?", "7"],
          ],
          Array.from({ length: Math.floor(state.work * 4.99) }, (_, i) => [i * 2, i * 2 + 1]).flat(),
        );
      });
      title(
        "确认输出和候选一起计算，身份仍然不同",
        "接下来才验证 d₁…d₃；接受、拒绝与缓存回退见正文下节",
        0,
        -2.4,
      );
    } else if (s.section === 3 && s.phase < 3) {
      const generation = s.stream?.generation;
      const batch = sheet(
        focus,
        generation ? generation.input.map((id, i) => [id, String(generation.positions[i])]) : [["y₀"]],
        -5.4,
        0,
        2.3,
        2.7,
      );
      const inputTitle = title("已确认的 ID", `第 ${s.phase + 1} 批 · Engine 输出`, -5.5, 2.5);
      const decode = sheet(focus, [["等待本批 ID"], [""], [""], ["输出收集器"]], -1.5, 0, 4.7, 2.7);
      const processTitle = title("API · 本批文字", "反分词 → 输出收集器", -1.5, 2.5);
      const received = sheet(focus, [["等待文字"], [""], [""], [""]], 4.1, 0, 4.7, 2.7);
      const resultTitle = title("客户端累积显示", "每次追加 delta.content", 4.1, 2.5);
      exit = s.phase === 1 ? batch : received;
      const footer = title("", "", 0, -2.4);
      connector(point(-4.25, 0), point(-3.85, 0));
      connector(point(0.85, 0), point(1.75, 0));
      animations.push((state) => {
        const stream = state.stream!;
        const generation = stream.generation;
        if (generation && state.work < 0.62) {
          inputPort = { sheet: state.work < 0.22 ? batch : decode };
          outputPort = { sheet: state.work < 0.22 ? decode : received };
          batch.paint(
            generation.input.map((id, i) => [id, String(generation.positions[i])]),
            [0, 2, 4, 6],
          );
          inputTitle.strong.textContent = "本圈输入 / 位置";
          inputTitle.small.textContent = stream.phase === 1 ? "沿用 y₀ + 三个候选" : "从位置 6 续算";
          processTitle.strong.textContent =
            generation.layers < 45 ? `主干 ${generation.layers} / 45 层` : "主模型四行分数";
          processTitle.small.textContent = "每行预测它的下一个位置";
          const predictions =
            stream.phase === 1
              ? [
                  ["位置 4 →", "d₁"],
                  ["位置 5 →", "y₂"],
                  ["位置 6 →", "不使用"],
                  ["位置 7 →", "不使用"],
                ]
              : [
                  ["位置 6 →", "d₁′"],
                  ["位置 7 →", "d₂′"],
                  ["位置 8 →", "d₃′"],
                  ["位置 9 →", "y₆"],
                ];
          decode.paint(
            predictions.map((row) =>
              generation.layers === 45 ? row : [row[0]!, state.work > 0 ? "计算中" : "待输入"],
            ),
          );
          const checks =
            stream.phase === 1
              ? ["d₁ 接受 → y₁", "d₂ 拒绝 → y₂", "d₃ 不再检查", "计数 8 → 6"]
              : ["d₁′ 接受 → y₃", "d₂′ 接受 → y₄", "d₃′ 接受 → y₅", "额外输出 y₆"];
          received.paint(
            checks.map((text, i) => [
              i < generation.checked || (stream.phase === 1 && generation.verified) ? text : "待验证",
            ]),
            Array.from({ length: generation.checked }, (_, i) => i),
          );
          resultTitle.strong.textContent = "按顺序验证候选";
          resultTitle.small.textContent = "遇到拒绝即停止，不把候选当答案";
          footer.strong.textContent = "先经过主模型，才能确认新输出";
          footer.small.textContent = "这里只展开本圈的输入与验证；上方完整结构标明主干、输出头与采样位置";
          return;
        }
        inputPort = { sheet: batch };
        outputPort = { sheet: decode };
        batch.paint(
          Array.from({ length: 4 }, (_, i) => [stream.currentIds[i] ?? "—"]),
          stream.currentIds.map((_, i) => i),
        );
        inputTitle.strong.textContent = "本圈已确认的 ID";
        inputTitle.small.textContent = generation
          ? stream.phase === 1
            ? "y₁ = d₁；y₂ 替换被拒绝候选"
            : "接受 3 个 + 额外输出 1 个"
          : "prefill 输出";
        processTitle.strong.textContent = "API · 本批文字";
        processTitle.small.textContent = "反分词 → 输出收集器";
        resultTitle.strong.textContent = "客户端累积显示";
        resultTitle.small.textContent = "已有文字保留，再追加本批";
        const newLines = stream.deltaText.replace("</think>", "</think>\n").replace("，", "，\n").split("\n");
        decode.paint(
          [
            [stream.decoded ? newLines[0]! : "等待可显示文字"],
            [newLines[1] ?? ""],
            [newLines[2] ?? ""],
            [stream.delivered ? "SSE 已发送" : "输出收集器"],
          ],
          stream.decoded ? [0, 1, 2] : [],
        );
        const text = stream.clientText;
        received.paint(
          text
            ? [
                [text.startsWith("先解释") ? "先解释缓存作用。" : "先"],
                [text.includes("</think>") ? "</think>" : ""],
                [text.includes("KV cache") ? "KV cache 复用历史信息，" : ""],
                [text.includes("减少重复") ? "减少重复计算。" : ""],
              ]
            : [["等待文字"], [""], [""], [""]],
          stream.delivered ? [0, 1, 2, 3] : [],
        );
        if (stream.preparingNext) {
          inputPort = { sheet: { ...batch, width: 1.15, height: 0.675 }, offset: point(-0.575, 1.0125) };
          outputPort = { sheet: batch };
          batch.paint([
            ["y₂", "6"],
            ["d₁′?", "7"],
            ["d₂′?", "8"],
            ["d₃′?", "9"],
          ]);
          inputTitle.strong.textContent = "下一圈输入已备好";
          inputTitle.small.textContent = "y₂ + MTP 新草稿";
        }
        footer.strong.textContent = "验证 → 确认 ID → 增量文字";
        footer.small.textContent = "文字沿 Engine → API → 客户端返回；新候选只供下一轮验证";
      });
    } else if (key === "3:3") {
      const stop = sheet(focus, [["继续生成"], ["等待结束条件"]], -4.9, 0, 3.1, 1.8);
      title("Engine · 停止条件", "本例走 EOS 结束分支", -4.9, 2.4);
      const cache = sheet(
        focus,
        [
          ["MLA", "R1"],
          ["KDA", "R1"],
          ["Indexer", "R1"],
        ],
        -0.5,
        0,
        3.3,
        2.7,
      );
      title("R1 占用的缓存", "按混合缓存组归还", -0.5, 2.4);
      const wire = sheet(focus, [["等待最终结果"], ["HTTP 流仍打开"]], 4.3, 0, 3.7, 1.8);
      inputPort = { sheet: stop };
      outputPort = { sheet: cache };
      focusEntry = modules.get("client")!.data;
      exit = wire;
      title("API · 流结束", "客户端保留收到的文字", 4.3, 2.4);
      connector(point(-3.3, 0), point(-2.15, 0));
      connector(point(1.15, 0), point(2.45, 0));
      animations.push((state) => {
        const stream = state.stream!;
        stop.paint(
          stream.cacheReleased ? [["EOS · 154820"], ["停止 R1"]] : [["继续生成"], ["等待结束条件"]],
          stream.cacheReleased ? [0, 1] : [],
        );
        cache.paint(
          ["MLA", "KDA", "Indexer"].map((name) => [name, stream.cacheReleased ? "已归还" : "R1 占用"]),
          stream.cacheReleased ? [1, 3, 5] : [],
        );
        wire.paint(
          [
            [stream.finished ? "finish_reason: stop" : "等待最终结果"],
            [stream.done ? "data: [DONE]" : "HTTP 流仍打开"],
          ],
          stream.done ? [0, 1] : stream.finished ? [0] : [],
        );
      });
      title(
        "先由引擎结束请求，再发送流结束标记",
        "归还的是 R1 的历史缓存；模型权重仍留在卡上，EOS 本身不显示为回答",
        0,
        -2.4,
      );
    }
    buildingFocus = false;
    current = key;
  };
  const updateOverview = (s: RequestState) => {
    const stream = s.stream;
    const values: Record<RequestNode, string[][]> = {
      api: stream ? [[stream.done ? "流已结束" : "反分词 / SSE"]] : [s.tokenized ? ids : ["模板 → ID"]],
      engine: [
        [
          stream
            ? stream.preparingNext
              ? "R1 · 下一圈"
              : stream.cacheReleased
                ? "R1 已结束"
                : "R1 · 回程"
            : s.queued
              ? "R1 · DP0"
              : "等待请求",
        ],
      ],
      embed: [[s.section > 0 ? "4 × 4096" : "8 worker"]],
      layers: [
        [
          stream?.generation && !stream.generation.verified
            ? `${stream.generation.layers} / 45 层`
            : s.section === 1 && s.phase === 1
              ? `${s.layersDone} / 45 层`
              : s.layersDone === 45
                ? "45 / 45 层 · 4 路"
                : "共 45 层 · 待算",
        ],
      ],
      cache: stream
        ? [[stream.cacheReleased ? "R1 已归还" : "R1 占用中"]]
        : [
            [
              s.allocatedBlocks ? `${s.allocatedBlocks} 块` : "待分配",
              s.cachedPositions ? "已写" : s.layersDone > 0 ? "KDA 写" : "待算",
            ],
          ],
      head: [[s.section >= 1 && (s.section > 1 || s.phase === 3) ? "154880 项" : "归一化 → z₃"]],
      sample: stream
        ? [[`${stream.confirmed.length} 个已确认`]]
        : [[s.sampled ? "y₀" : "待采样", s.drafts.length ? `${s.drafts.length} 候选` : "MTP"]],
      client: [
        [
          stream
            ? stream.clientText
              ? "收到增量文字"
              : "等待首段"
            : s.returned.length
              ? "收到：先"
              : s.section === 0 && s.phase === 0
                ? "发送一句话"
                : "等待返回",
        ],
      ],
    };
    for (const [id, module] of modules) {
      module.data.group.visible = true;
      module.data.paint(values[id]);
      const active =
        id === s.origin || (s.section === 2 && s.phase === 2 && id === "client" && s.returned.length > 0);
      module.text.dataset.receiving = String(
        !!incoming &&
          s.handoff.phase !== "computing" &&
          id === (s.section === 3 && s.phase === 3 ? "client" : s.origin),
      );
      module.base.material.color.set(active ? wireActive : colors.board || "#dfe3dd");
      module.border.material.color.set(active ? wireActive : borderColor);
      module.border.material.opacity = active ? 1 : 0.78;
      module.text.dataset.active = String(active);
      module.text.dataset.values =
        id === "engine" && !stream
          ? [...s.confirmed, ...(s.confirmed.length === 4 ? [""] : [])].join(",")
          : values[id].flat().join(",");
    }
    const activePaths = stream?.preparingNext
      ? []
      : stream?.generation && s.work < 0.62
        ? s.work < 0.22
          ? ["engine:embed", "embed:layers", "cache:layers", "layers:head"]
          : ["head:sample"]
        : s.section === 0
          ? [["client:api"], ["api:engine"], ["engine:cache"], ["engine:embed"]][s.phase]!
          : s.section === 1
            ? [["engine:embed"], ["embed:layers", "cache:layers"], ["layers:head"], ["head:sample"]][s.phase]!
            : s.section === 2
              ? [
                  ["head:sample"],
                  [],
                  ["sample:engine", "engine:api", "api:client"],
                  ["engine:embed", "engine:cache"],
                ][s.phase]!
              : s.phase === 3
                ? ["engine:cache", "engine:api", "api:client"]
                : s.work < 0.4
                  ? ["sample:engine", "engine:api"]
                  : ["api:client"];
    for (const { key, path } of paths) {
      const active = s.handoff.phase === "computing" && activePaths.includes(key);
      path.material.opacity = active ? 1 : 0.58;
      path.material.color.set(active ? wireActive : wireIdle);
    }
  };
  const raycaster = new T.Raycaster();
  const screenPoint = new T.Vector2();
  const cellPosition = new T.Vector3();
  const projected = new T.Vector3();
  const edge = new T.Vector3();
  const intersections: T.Intersection[] = [];
  const surfaces: T.Object3D[] = [];
  const bindDetail = (s: RequestState) => {
    const visible = s.expansion >= 0.93;
    binding.style.display = visible ? "" : "none";
    portAnchor.visible = visible;
    outgoingAnchor.visible = visible;
    unfoldLabel.element.style.display = visible ? "" : "none";
    if (!visible) return;
    const owner = modules.get(s.origin)!.group;
    const handoff = requestBinding(s);
    const outgoing = modules.get(handoff.from)!.group;
    portAnchor.position.copy(owner.position);
    outgoingAnchor.position.copy(outgoing.position);
    binding.dataset.owner = s.origin;
    binding.dataset.from = handoff.from;
    binding.dataset.mix = handoff.mix.toFixed(3);
    ports[0]!.style.opacity = String(0.4 + 0.6 * handoff.mix);
    ports[1]!.style.opacity = String(handoff.output);
    outgoingPort.element.style.opacity = String(1 - handoff.output);
    ownerOutline.style.opacity = String(0.35 + 0.65 * handoff.mix);
    unfoldGuide.style.opacity = String(0.65 * handoff.mix);
    previousOwner.style.opacity = String(handoff.from === handoff.to ? 0 : 1 - handoff.mix);
    previousGuide.style.opacity = String(0.65 * (1 - handoff.mix));
    unfoldLabel.element.style.opacity = String(handoff.mix);
    const projectPath = (points: T.Vector3[], close = false, inset = 0) =>
      points
        .map((p, i) => {
          p.project(camera);
          const x = (p.x * 0.5 + 0.5) * width;
          return `${i ? "L" : "M"}${(inset ? T.MathUtils.clamp(x, inset, width - inset) : x).toFixed(1)},${((-p.y * 0.5 + 0.5) * height).toFixed(1)}`;
        })
        .join(" ") + (close ? " Z" : "");
    const drawOwner = (node: T.Group, outline: SVGElement, guide: SVGElement) => {
      outline.setAttribute(
        "d",
        projectPath(
          [
            point(-1.4, 0.82, 0.9),
            point(1.4, 0.82, 0.9),
            point(1.4, -0.82, 0.9),
            point(-1.4, -0.82, 0.9),
          ].map((p) => node.localToWorld(p)),
          true,
        ),
      );
      const side = node.position.x < 0 ? -1 : 1;
      const gutter = node.position.x + side * 1.85;
      const detailCorner = focus.localToWorld(point(side * 7.15, 2.1, 0.2));
      // This dashed view guide stays outside both rows of modules and the calculation labels.
      guide.setAttribute(
        "d",
        projectPath(
          [
            node.localToWorld(point(side * 1.4, -0.6, 0.9)),
            point(gutter, node.position.y - 0.6, 0.9),
            point(gutter, 0.8, 0.9),
            point(side * 7.5, 0.8, 0.9),
            point(side * 7.5, detailCorner.y, detailCorner.z),
            detailCorner,
          ],
          false,
          14,
        ),
      );
      return focus.worldToLocal(point(side * 7.5, detailCorner.y + 0.65, detailCorner.z));
    };
    drawOwner(outgoing, previousOwner, previousGuide);
    unfoldLabelPosition.copy(drawOwner(owner, ownerOutline, unfoldGuide));
    detailBracket.setAttribute(
      "d",
      [-1, 1]
        .map((sign) =>
          projectPath(
            [
              point(sign * 6.8, 2.1, 0.2),
              point(sign * 7.15, 2.1, 0.2),
              point(sign * 7.15, -2.1, 0.2),
              point(sign * 6.8, -2.1, 0.2),
            ].map((p) => focus.localToWorld(p)),
            false,
            14,
          ),
        )
        .join(" "),
    );

    const entry = inputPort ?? (focusEntry ? { sheet: focusEntry, offset: entryOffset } : undefined);
    const result = outputPort ?? (exit ? { sheet: exit, offset: exitOffset } : undefined);
    const headings = labels.filter((item) => item.focus && item.offset.y >= 1.8);
    for (const item of headings) item.element.querySelector("strong")!.removeAttribute("data-port");
    for (const [role, port, outline] of [
      ["input", entry, inputOutline],
      ["output", result, outputOutline],
    ] as const) {
      if (!port) {
        outline.setAttribute("d", "");
        continue;
      }
      const { sheet, offset = point(0, 0) } = port;
      const pad = role === "output" && entry?.sheet.group === sheet.group ? 0.18 : 0.08;
      const x = sheet.width / 2 + pad,
        y = sheet.height / 2 + pad;
      outline.setAttribute(
        "d",
        projectPath(
          [point(-x, y, 0.06), point(x, y, 0.06), point(x, -y, 0.06), point(-x, -y, 0.06)].map((p) =>
            sheet.group.localToWorld(p.add(offset)),
          ),
          true,
        ),
      );
      const center = focus.worldToLocal(sheet.group.localToWorld(offset.clone()));
      const heading = headings.reduce<Label | undefined>(
        (nearest, item) =>
          !nearest || Math.abs(item.offset.x - center.x) < Math.abs(nearest.offset.x - center.x)
            ? item
            : nearest,
        undefined,
      );
      if (heading) {
        const strong = heading.element.querySelector("strong")!;
        strong.dataset.port = strong.dataset.port === "input" ? "both" : role;
        strong.style.setProperty(
          "--port-opacity",
          String(strong.dataset.port === "output" ? handoff.output : 1),
        );
      }
      outline.setAttribute("data-values", sheet.values().flat().join(","));
      outline.style.opacity = String(role === "input" ? 0.4 + 0.6 * handoff.mix : handoff.output);
    }
    outputOutline.setAttribute("data-ready", String(s.work > 0));
    // The B→A frame follows the same meshes as the data, never a separately timed animation.
    movingOutline.style.opacity = transfer.visible ? String(1 - handoff.output) : "0";
    const closing = s.section === 3 && s.phase === 3;
    // The closing tray folds into the smaller client card; retire its caption before it covers that card.
    const caption = closing ? 1 - requestEase((s.handoff.motion - 0.4) / 0.35) : 1;
    transferLabel.element.style.opacity = transfer.visible ? String((1 - handoff.output) * caption) : "0";
    transferLabel.strong.textContent = closing ? "保留回答" : "B → A";
    if (transfer.visible && incoming) {
      const bounds = new T.Box3();
      const front = (incoming.stack.length - 1) * pairs.length;
      for (const tray of carried.slice(front, front + pairs.length)) {
        for (const x of [-0.5, 0.5])
          for (const y of [-0.5, 0.5])
            bounds.expandByPoint(transfer.worldToLocal(tray.group.localToWorld(point(x, y, 0.08))));
      }
      const { min, max } = bounds;
      movingOutline.setAttribute(
        "d",
        projectPath(
          [
            point(min.x - 0.06, max.y + 0.06, max.z),
            point(max.x + 0.06, max.y + 0.06, max.z),
            point(max.x + 0.06, min.y - 0.06, max.z),
            point(min.x - 0.06, min.y - 0.06, max.z),
          ].map((p) => transfer.localToWorld(p)),
          true,
        ),
      );
      transferLabelPosition.set(min.x, max.y + 0.18, max.z);
    }
  };
  const render = () => {
    scene.updateMatrixWorld(true);
    // Rendering updates the camera matrices; paused orbiting must project guides from this same frame.
    renderer.render(scene, camera);
    const s = requestState(section, progress);
    bindDetail(s);
    scene.updateMatrixWorld(true);
    surfaces.length = 0;
    scene.traverseVisible((object) => {
      if (object instanceof T.Mesh) surfaces.push(object);
    });
    for (const cell of cells) {
      let visible = !cell.focus || (s.expansion >= 0.93 && !transfer.visible);
      cell.face.traverseAncestors((parent) => {
        if (!parent.visible) visible = false;
      });
      if (!visible || !cell.element.textContent) {
        cell.element.hidden = true;
        continue;
      }
      cellPosition.copy(cell.offset).applyMatrix4(cell.face.matrixWorld);
      projected.copy(cellPosition).project(camera);
      edge
        .copy(cell.offset)
        .add(point(cell.width / 2, cell.height / 2))
        .applyMatrix4(cell.face.matrixWorld)
        .project(camera);
      const cellWidth = Math.abs(edge.x - projected.x) * width;
      const cellHeight = Math.abs(edge.y - projected.y) * height;
      const fontSize = Math.max(
        13,
        Math.min(cell.focus ? 15 : 13, (15 * (cellWidth - 3)) / Math.max(1, cell.textWidth)),
      );
      // Browser text stays sharp; the actual face still controls attachment and depth occlusion.
      raycaster.setFromCamera(screenPoint.set(projected.x, projected.y), camera);
      intersections.length = 0;
      raycaster.intersectObjects(surfaces, false, intersections);
      const distance = raycaster.ray.origin.distanceTo(cellPosition);
      cell.element.hidden = cellHeight < 17 || (intersections[0]?.distance ?? distance) < distance - 0.02;
      cell.element.style.fontSize = `${fontSize}px`;
      cell.element.style.left = `${Math.round((projected.x * 0.5 + 0.5) * width)}px`;
      cell.element.style.top = `${Math.round((-projected.y * 0.5 + 0.5) * height)}px`;
    }
    for (const item of labels) {
      if (!item.element.classList.contains("wiki-request-footnote")) {
        const p = item.anchor.localToWorld(item.offset.clone()).project(camera);
        const left = (p.x * 0.5 + 0.5) * width;
        item.element.style.left = `${item.element === unfoldLabel.element ? T.MathUtils.clamp(left, 22, width - 22) : left}px`;
        item.element.style.top = `${(-p.y * 0.5 + 0.5) * height}px`;
        item.element.style.maxWidth = `${Math.min(item.focus ? 205 : 145, width * (item.focus ? 0.25 : 0.21))}px`;
      }
      let hidden = item.focus && s.expansion < 0.93;
      item.anchor.traverseAncestors((parent) => {
        if (!parent.visible) hidden = true;
      });
      if (!item.anchor.visible) hidden = true;
      item.element.hidden = hidden;
    }
    host.dataset.drawCalls = String(renderer.info.render.calls);
  };
  const snapshot = (
    sheet: Sheet,
    offset = point(0, 0),
    values = sheet.values(),
    stack: Sheet[] = [],
  ): Snapshot => {
    scene.updateMatrixWorld(true);
    const at = focus.worldToLocal(sheet.group.localToWorld(offset.clone()));
    const scale = sheet.group.getWorldScale(new T.Vector3()).divide(focus.getWorldScale(new T.Vector3()));
    const rotation = focus
      .getWorldQuaternion(new T.Quaternion())
      .invert()
      .multiply(sheet.group.getWorldQuaternion(new T.Quaternion()));
    return {
      at,
      rotation,
      width: sheet.width * scale.x,
      height: sheet.height * scale.y,
      values: values.map((row) => [...row]),
      cells: values === sheet.values() ? sheet.cells() : requestCells(values),
      stack: stack.length
        ? stack.map((plane) => ({
            at: focus.worldToLocal(plane.group.getWorldPosition(new T.Vector3())),
            rotation: focus
              .getWorldQuaternion(new T.Quaternion())
              .invert()
              .multiply(plane.group.getWorldQuaternion(new T.Quaternion())),
          }))
        : [{ at, rotation }],
    };
  };
  const cellPoint = (snapshot: Snapshot, cell: RequestCell, layer: number) => {
    const plane = snapshot.stack[Math.min(layer, snapshot.stack.length - 1)]!;
    return point(
      ((cell.col + 0.5) / snapshot.values[0]!.length - 0.5) * snapshot.width,
      (0.5 - (cell.row + 0.5) / snapshot.values.length) * snapshot.height,
    )
      .applyQuaternion(plane.rotation)
      .add(plane.at);
  };
  const animate = (p: number) => {
    progress = p;
    const s = requestState(section, p);
    const origin = modules.get(s.origin)!.group.position;
    focus.position.copy(origin).lerp(point(0, -2.9, 1.3), s.expansion);
    focus.scale.setScalar(T.MathUtils.lerp(0.12, 1, s.expansion));
    focus.rotation.y = 0.12 * s.expansion;
    const key = `${s.section}:${s.phase}`;
    const changed = key !== current;
    if (changed) {
      // A seek reconstructs only the preceding output; it must not inherit whichever scene was last visited.
      const previous = requestPreviousState(s);
      incoming = undefined;
      if (previous) {
        const previousKey = `${previous.section}:${previous.phase}`;
        if (!completed.has(previousKey)) {
          build(previous);
          for (const animation of animations) animation(previous);
          if (exit) completed.set(previousKey, snapshot(exit, exitOffset, exitValues, exitStack));
        }
        incoming = completed.get(previousKey);
      }
      build(s);
      const entryState = requestState(section, s.phase / 4);
      for (const animation of animations) animation(entryState);
      target = focusEntry ? snapshot(focusEntry, entryOffset, focusEntry.values(), entryStack) : undefined;
      // Finished text folds into the client summary; its contents stay intact while travelling.
      if (section === 3 && s.phase === 3 && target && incoming) {
        target.values = incoming.values;
        target.cells = incoming.cells;
      }
      pairs = incoming && target ? requestCellPairs(incoming.cells, target.cells) : [];
      const count = pairs.length * (incoming?.stack.length ?? 0);
      while (carried.length < count) carried.push(sheet(transfer, [[""]], 0, 0, 1, 1, false, 0, 128));
      carried.forEach((tray, i) => {
        tray.group.visible = i < count;
      });
      if (target && incoming) {
        while (slots.length < target.cells.length)
          slots.push(sheet(receiving, [[""]], 0, 0, 1, 1, false, 0, 128, true));
        const layer = Math.min(incoming.stack.length, target.stack.length) - 1;
        const pose = target.stack[layer]!;
        slots.forEach((slot, i) => {
          const cell = target!.cells[i];
          slot.group.visible = !!cell;
          if (!cell) return;
          slot.group.position
            .copy(cellPoint(target!, cell, layer))
            .add(point(0, 0, -0.02).applyQuaternion(pose.rotation));
          slot.group.quaternion.copy(pose.rotation);
          slot.group.scale.set(
            target!.width / target!.values[0]!.length,
            target!.height / target!.values.length,
            1,
          );
          slot.paint([[cell.value]], [], [cell]);
        });
        receiverFrame.position.copy(pose.at).add(point(0, 0, 0.03).applyQuaternion(pose.rotation));
        receiverFrame.quaternion.copy(pose.rotation);
        receiverFrame.scale.set(target.width + 0.2, target.height + 0.2, 1);
        // Keep arrival guidance in the input's existing heading, clear of the matrix itself.
        receiverTitle = labels
          .filter((caption) => caption.focus && caption.offset.y >= 1.8)
          .sort((a, b) => Math.abs(a.offset.x - target!.at.x) - Math.abs(b.offset.x - target!.at.x))[0];
      }
    }
    updateOverview(s);
    if (focusEntry) focusEntry.group.visible = true;
    for (const plane of entryStack) plane.group.visible = true;
    for (const animation of animations) animation(s);
    const { motion } = s.handoff;
    transfer.visible = !!incoming && !!target && pairs.length > 0 && s.handoff.phase !== "computing";
    transfer.position.copy(focus.position);
    transfer.rotation.copy(focus.rotation);
    receiving.position.copy(focus.position);
    receiving.rotation.copy(focus.rotation);
    receiving.visible = !!incoming && !!target && pairs.length > 0 && s.work < 0.08;
    slots.forEach((slot, i) => {
      slot.group.visible = transfer.visible && i < (target?.cells.length ?? 0);
    });
    receiverFrame.material.opacity = 1 - requestEase(s.work / 0.08);
    if (receiverTitle) {
      receiverTitle.element.dataset.inputReceiving = String(transfer.visible && key !== "3:3");
      receiverTitle.element.dataset.arrival = REQUEST_HANDOFF_LABELS[s.handoff.phase];
    }
    // Lift toward the camera rather than world Z, avoiding a projected up/down bounce.
    cameraLift
      .copy(camera.position)
      .sub(controls.target)
      .normalize()
      .applyQuaternion(focus.quaternion.clone().invert());
    if (transfer.visible && incoming && target) {
      if (focusEntry) focusEntry.group.visible = false;
      for (const plane of entryStack) plane.group.visible = false;
      for (let layer = 0; layer < incoming.stack.length; layer++) {
        pairs.forEach(({ from, to }, i) => {
          const source = incoming!.cells[from]!,
            destination = target!.cells[to]!;
          const tray = carried[layer * pairs.length + i]!;
          tray.group.position
            .copy(cellPoint(incoming!, source, layer))
            .lerp(cellPoint(target!, destination, layer), motion);
          tray.group.position.addScaledVector(cameraLift, 0.08 + 2.8 * Math.sin(Math.PI * motion));
          tray.group.quaternion
            .copy(incoming!.stack[layer]!.rotation)
            .slerp(target!.stack[Math.min(layer, target!.stack.length - 1)]!.rotation, motion);
          tray.group.scale.set(
            T.MathUtils.lerp(
              incoming!.width / incoming!.values[0]!.length,
              target!.width / target!.values[0]!.length,
              motion,
            ),
            T.MathUtils.lerp(
              incoming!.height / incoming!.values.length,
              target!.height / target!.values.length,
              motion,
            ),
            1,
          );
          tray.paint([[source.value]], [], [source]);
        });
      }
    }
    if (s.work === 1 && exit) completed.set(key, snapshot(exit, exitOffset, exitValues, exitStack));
    focus.updateMatrixWorld(true);
    location.textContent = `${s.location} · ${incoming ? requestStatus(s) : "当前计算位置"}`;
    legend.textContent = "同编号、同色边：同一份数据　厚片：权重　?：待验证";
    host.dataset.step = String(section);
    host.dataset.phase = String(s.phase);
    host.dataset.progress = p.toFixed(3);
    host.dataset.origin = s.origin;
    host.dataset.computed = String(s.computed);
    host.dataset.confirmed = s.stream ? s.stream.confirmed.join(",") : s.confirmed.join(",");
    host.dataset.returned = s.stream ? s.stream.clientText : s.returned.join(",");
    host.dataset.nodes = REQUEST_STRUCTURE.map((n) => n.id).join(",");
    host.dataset.focusAttached = String(focusEntry !== undefined);
    host.dataset.expansion = s.expansion.toFixed(3);
    host.dataset.handoff = transfer.visible ? "transferring" : "received";
    host.dataset.handoffPhase = s.handoff.phase;
    host.dataset.handoffMotion = motion.toFixed(3);
    host.dataset.work = s.work.toFixed(3);
    host.dataset.receiverVisible = String(receiving.visible);
    host.dataset.handoffValues = incoming?.values.flat().join(",") ?? "";
    host.dataset.handoffMatched = `${pairs.length}/${incoming?.cells.length ?? 0}`;
    host.dataset.handoffShape =
      incoming && target
        ? `${incoming.values.length}×${incoming.values[0]!.length}→${target.values.length}×${target.values[0]!.length}`
        : "";
    render();
  };
  const reset = () => {
    controls.target.set(0, 0.5, 0);
    camera.position.set(4.4, 5.1, 32);
    controls.update();
    render();
  };
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    const halfWidth = Math.max(8.2, (7.6 * width) / height),
      halfHeight = (halfWidth * height) / width;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    reset();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener("change", render);
  resize();
  return {
    update(next: number) {
      section = next;
    },
    animate,
    reset,
    dispose() {
      observer.disconnect();
      controls.dispose();
      focusResources.forEach((r) => {
        r.dispose();
      });
      resources.forEach((r) => {
        r.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      overlay.remove();
      location.remove();
      legend.remove();
      binding.remove();
    },
  };
}
