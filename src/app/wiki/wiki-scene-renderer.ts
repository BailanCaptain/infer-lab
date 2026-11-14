import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  COMPUTE_INPUT,
  COMPUTE_OUTPUT,
  COMPUTE_PRODUCTS,
  COMPUTE_WEIGHT,
  computePhase,
  computeWindow,
  FFN,
  formatComputeProduct,
  matmulOutputState,
  matmulProgress,
  matmulTimeline,
  swigluFocus,
  swigluGateState,
  swigluTimeline,
} from "./scene-compute-data";
import { cellSurfacePoint, pointAlongComputePath } from "./scene-compute-motion";
import { type LabelRect, placeSceneCellLabel, placeSceneLabel } from "./scene-label-layout";
import { scenePalette } from "./scene-palette";
import {
  SWIGLU_START,
  SWIGLU_STRUCTURE,
  type SwiCell,
  type SwiNode,
  swigluCellPoint,
  swigluStructureState,
  swigluTensorPort,
  swigluTransfer,
} from "./scene-swiglu-structure";

type Cell = { mesh: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>; value: number; point: T.Vector3 };
type Caption = {
  node: HTMLElement;
  point: T.Vector3;
  leaderPoint: T.Vector3 | undefined;
  group?: T.Object3D;
  attachment?: { mesh: Cell["mesh"]; side: "left" | "right" };
  face?: Cell["mesh"];
  measurement?: { text: string; viewport: number; width: number; height: number };
};
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const fmt = (n: number) => Number(n.toFixed(2)).toString();

/** Depth exposes the contracted input dimension in XW and separates paired SwiGLU branches. */
export async function mountWikiModel(
  host: HTMLDivElement,
  signal: AbortSignal,
  readingHost: HTMLDivElement,
  seekProgress: (p: number) => void,
) {
  if (signal.aborted) return null;
  const palette = scenePalette(host),
    scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  const stage = document.createElement("div"),
    overlay = document.createElement("div"),
    inspector = document.createElement("div");
  stage.className = "wiki-compute-stage";
  overlay.className = "wiki-compute-labels";
  inspector.className = "wiki-compute-inspector";
  const leaders = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    leaderPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  leaders.classList.add("wiki-compute-leaders");
  leaders.setAttribute("aria-hidden", "true");
  leaders.append(leaderPath);
  stage.append(renderer.domElement, leaders, overlay);
  host.append(stage);
  readingHost.append(inspector);
  host.dataset.compute = "spatial";
  const camera = new T.OrthographicCamera(-10, 10, 8, -8, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = controls.enablePan = false;
  controls.rotateSpeed = 0.45;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI * 0.75;
  scene.add(new T.HemisphereLight(0xffffff, 0xc6c5b5, 1.8));
  const light = new T.DirectionalLight(0xffffff, 1.5);
  light.position.set(-8, 12, 20);
  scene.add(light);
  const content = new T.Group();
  scene.add(content);
  const box = new T.BoxGeometry(1, 1, 1),
    edges = new T.EdgesGeometry(box);
  const geometries: T.BufferGeometry[] = [box, edges],
    materials: T.Material[] = [];
  const captions: Caption[] = [],
    pickable: T.Object3D[] = [],
    animations: ((p: number) => void)[] = [];
  let width = 1,
    height = 1,
    step = -1,
    progress = 0,
    row = 0,
    column = 0,
    downColumn = 0,
    spread = false;
  let description: HTMLElement,
    formula: HTMLElement,
    values: HTMLElement,
    rowSelect: HTMLSelectElement,
    colSelect: HTMLSelectElement;
  let lastReadout = "";
  const positive = new T.Color(palette.result),
    negative = new T.Color(palette.data),
    paper = new T.Color(palette.paper);

  const cell = (value: number, point: T.Vector3, size: T.Vector3, color = palette.result): Cell => {
    const material = new T.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness: 0.04,
      transparent: true,
    });
    materials.push(material);
    const mesh = new T.Mesh(box, material);
    mesh.position.copy(point);
    mesh.scale.copy(size);
    content.add(mesh);
    return { mesh, value, point: point.clone() };
  };
  const colorCell = (c: Cell, active: boolean, amount = 1, value = c.value) => {
    c.mesh.material.color.copy(value < 0 ? negative : positive).lerp(paper, active ? 0.02 : 0.38);
    c.mesh.material.opacity = 0.14 + 0.86 * amount;
  };
  const frame = (point: T.Vector3, size: T.Vector3, color = palette.line) => {
    const material = new T.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
    materials.push(material);
    const item = new T.LineSegments(edges, material);
    item.position.copy(point);
    item.scale.copy(size);
    content.add(item);
    return item;
  };
  const caption = (title: string, sub: string, point: T.Vector3, kind = "", leaderPoint?: T.Vector3) => {
    const node = document.createElement("span"),
      strong = document.createElement("strong"),
      small = document.createElement("small");
    node.className = `wiki-compute-label ${kind}`;
    strong.textContent = title;
    small.textContent = sub;
    node.append(strong, small);
    overlay.append(node);
    captions.push({ node, point, leaderPoint });
    return node;
  };
  const line = (points: T.Vector3[], color: string) => {
    const geometry = new T.BufferGeometry().setFromPoints(points),
      material = new T.LineBasicMaterial({ color });
    geometries.push(geometry);
    materials.push(material);
    const item = new T.Line(geometry, material);
    content.add(item);
    return item;
  };
  const inputLabel = (text: string, count: number, update: (n: number) => void) => {
    const label = document.createElement("label"),
      select = document.createElement("select");
    label.textContent = text;
    select.setAttribute("aria-label", text);
    for (let i = 0; i < count; i++) select.add(new Option(String(i + 1), String(i)));
    select.addEventListener("change", () => {
      update(Number(select.value));
      animate(progress);
    });
    label.append(select);
    return { label, select };
  };
  const buildInspector = () => {
    inspector.replaceChildren();
    const choices = document.createElement("div");
    choices.className = "wiki-compute-choices";
    const title = document.createElement("strong");
    title.className = "wiki-compute-choice-title";
    title.textContent = step === 1 ? "追踪一个输出" : "追踪一个中间通道";
    choices.append(title);
    if (step === 1) {
      const select = inputLabel("token", 3, (n) => {
        seekProgress(matmulProgress(n, column, matmulTimeline(progress).local));
      });
      rowSelect = select.select;
      choices.append(select.label);
    }
    const select = inputLabel(step === 1 ? "输出通道" : "中间通道", step === 1 ? 4 : FFN.gate.length, (n) => {
      if (step === 1) seekProgress(matmulProgress(row, n, matmulTimeline(progress).local));
      else column = n;
    });
    colSelect = select.select;
    choices.append(select.label);
    if (step === 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "保留展开";
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        spread = !spread;
        button.setAttribute("aria-pressed", String(spread));
        animate(progress);
      });
      choices.append(button);
    }
    description = document.createElement("p");
    description.className = "wiki-compute-description";
    formula = document.createElement("strong");
    values = document.createElement("div");
    formula.className = "wiki-compute-formula";
    values.className = "wiki-compute-values";
    inspector.append(description, formula, values, choices);
    if (step === 2) {
      const stack = document.createElement("div"),
        active = document.createElement("div"),
        sizing = document.createElement("div");
      stack.className = sizing.className = "wiki-scene-stable-stack";
      sizing.setAttribute("aria-hidden", "true");
      sizing.inert = true;
      active.append(description, formula, values);
      const current = { description, formula, values, column, downColumn };
      // Measure text-only alternatives once; no extra 3D scenes or per-frame layout reads.
      for (const p of [0.19, 0.39, 0.54, 0.74, 0.99]) {
        for (const channel of FFN.gate.keys()) {
          const sample = document.createElement("div");
          description = current.description.cloneNode(false) as HTMLElement;
          formula = current.formula.cloneNode(false) as HTMLElement;
          values = current.values.cloneNode(false) as HTMLElement;
          column = channel;
          downColumn = channel % FFN.output.length;
          lastReadout = "";
          updateReadout(p);
          sample.append(description, formula, values);
          sizing.append(sample);
        }
      }
      ({ description, formula, values, column, downColumn } = current);
      lastReadout = "";
      stack.append(active, sizing);
      inspector.prepend(stack);
    }
  };
  const buildMatmul = () => {
    // X: left face (token × input). W: roof (input × output). Y: front (token × output).
    const xpos = (j: number) => (j - 1.5) * 1.48,
      ypos = (i: number) => (1 - i) * 1.6,
      zpos = (k: number) => 1.75 - k * 1.75;
    const inputs: Cell[][] = [],
      weights: Cell[][] = [],
      outputs: Cell[][] = [],
      products: Cell[][][] = [];
    for (let i = 0; i < 3; i++) {
      inputs.push(
        COMPUTE_INPUT[i]!.map((n, k) =>
          cell(n, v(-4.2, ypos(i), zpos(k)), v(0.16, 1.28, 1.4), palette.norm[0]),
        ),
      );
      outputs.push(
        COMPUTE_OUTPUT[i]!.map((n, j) => {
          const c = cell(n, v(xpos(j), ypos(i), 4.1), v(1.23, 1.28, 0.22));
          c.mesh.userData.output = [i, j];
          pickable.push(c.mesh);
          return c;
        }),
      );
      products.push(
        COMPUTE_PRODUCTS[i]!.map((terms, j) =>
          terms.map((n, k) => cell(n, v(xpos(j), ypos(i), zpos(k)), v(1.02, 1.06, 0.23))),
        ),
      );
    }
    for (let k = 0; k < 3; k++)
      weights.push(
        COMPUTE_WEIGHT[k]!.map((n, j) =>
          cell(n, v(xpos(j), 3.4, zpos(k)), v(1.23, 0.15, 1.4), palette.weight),
        ),
      );
    frame(v(0, 0, 0), v(5.75, 4.55, 5.1)).material.opacity = 0.22;
    caption("输入 X", "token × 输入维", v(-4.6, -3, 0));
    caption("共享权重 W", "输入维 × 输出维", v(0, 4.6, 0));
    caption("输出 Y", "token × 输出维", v(0, -3, 4.1));
    const selected = frame(v(0, 0, 0), v(1.34, 1.4, 0.7), palette.result);
    const inputRowFrame = frame(v(-4.2, ypos(0), 0), v(0.3, 1.4, 4.95), palette.data);
    const inputNumbers = inputs.map((rr) =>
      rr.map((c) => caption(String(c.value), "", c.point.clone().add(v(-0.13, 0, 0)), "operand")),
    );
    const weightNumbers = weights.map((rr) =>
      rr.map((c) => caption(String(c.value), "", c.point.clone().add(v(0, 0.12, 0)), "operand")),
    );
    const path = line([v(0, 0, -2), v(0, 0, 4)], palette.result);
    const terms = [0, 1, 2].map((k) => {
      const point = v(0, 0, zpos(k));
      const label = caption("", "", point, "term");
      const relation = line([v(0, 0, 0), v(0, 0, 0), v(0, 0, 0)], palette.result);
      return { point, label, relation };
    });
    const readouts = outputs.flatMap((rr, i) =>
      rr.map((c, j) => ({
        label: caption(String(COMPUTE_OUTPUT[i]![j]), "", c.point.clone().add(v(0, 0, 0.16)), "number"),
        i,
        j,
      })),
    );
    animations.push((p) => {
      const timeline = matmulTimeline(p),
        { phase, active: activeK, arrivals, reductions, added } = timeline,
        reduce = spread ? 0 : reductions.reduce((a, b) => a + b, 0) / 3;
      host.dataset.contraction = reduce.toFixed(3);
      host.dataset.activeTerm = String(activeK);
      host.dataset.addedTerms = String(added);
      for (let i = 0; i < 3; i++) {
        inputs[i]!.forEach((c, k) => {
          c.mesh.material.color.set(i === row ? palette.norm[0] : palette.norm[1]);
          c.mesh.material.opacity = i !== row ? 0.4 : phase === 1 && k !== activeK ? 0.6 : 1;
          inputNumbers[i]![k]!.dataset.active = String(i === row);
        });
        for (let j = 0; j < 4; j++) {
          const { active, reveal } = matmulOutputState(timeline, i, j),
            output = outputs[i]![j]!;
          colorCell(output, active, reveal);
          output.mesh.material.opacity = 0.07 + 0.93 * reveal;
          output.mesh.scale.z = 0.2 + 0.35 * reveal;
          products[i]![j]!.forEach((c, k) => {
            const arrival = arrivals[k]!,
              collapse = spread ? 0 : reductions[k]!;
            c.mesh.visible = active && arrival > 0 && collapse < 1;
            c.mesh.position.z = T.MathUtils.lerp(c.point.z, 3.85, collapse);
            colorCell(c, true, arrival * (1 - collapse));
            c.mesh.scale.set(1.02 * arrival, 1.06 * arrival, 0.23 * (1 - collapse * 0.9));
            c.mesh.material.color.lerp(paper, c.value === 0 ? 0.65 : 0);
          });
        }
      }
      weights.forEach((rr, k) => {
        rr.forEach((c, j) => {
          c.mesh.material.color.set(j === column ? palette.weight : palette.weightSoft);
          c.mesh.material.opacity = j !== column ? 0.4 : phase === 1 && k !== activeK ? 0.6 : 1;
          weightNumbers[k]![j]!.dataset.active = String(j === column);
        });
      });
      selected.position.set(xpos(column), ypos(row), 4.1);
      inputRowFrame.position.y = ypos(row);
      const pathPositions = path.geometry.getAttribute("position") as T.BufferAttribute;
      const sourceZ = spread ? zpos(activeK) : T.MathUtils.lerp(zpos(activeK), 3.85, reductions[activeK]!);
      pathPositions.setXYZ(0, xpos(column), ypos(row), sourceZ);
      pathPositions.setXYZ(1, xpos(column), ypos(row), 4.1);
      pathPositions.needsUpdate = true;
      path.geometry.computeBoundingSphere();
      path.visible = phase === 2 && added < 3;
      terms.forEach(({ point, label, relation }, k) => {
        const collapse = spread ? 0 : reductions[k]!;
        point.set(xpos(column), ypos(row) + 0.2, T.MathUtils.lerp(zpos(k), 3.85, collapse));
        label.querySelector("strong")!.textContent = String(COMPUTE_PRODUCTS[row]![column]![k]);
        label.hidden = arrivals[k]! < 1 || collapse > 0.08;
        label.dataset.active = String(k === activeK);
        const positions = relation.geometry.getAttribute("position") as T.BufferAttribute;
        positions.setXYZ(0, -4.2, ypos(row), zpos(k));
        positions.setXYZ(1, xpos(column), ypos(row), zpos(k));
        positions.setXYZ(2, xpos(column), 3.4, zpos(k));
        positions.needsUpdate = true;
        relation.geometry.computeBoundingSphere();
        relation.visible = (phase === 1 && k === activeK) || (phase === 3 && spread);
      });
      readouts.forEach(({ label, i, j }) => {
        const { active, reveal, value } = matmulOutputState(timeline, i, j);
        label.hidden = reveal === 0;
        label.querySelector("strong")!.textContent = String(value);
        label.dataset.active = String(active);
      });
      host.dataset.weightColumn = String(
        weights[0]!.findIndex(
          (c) => c.mesh.material.color.getHexString() === new T.Color(palette.weight).getHexString(),
        ),
      );
      host.dataset.lineColumn = String(Math.round(pathPositions.getX(1) / 1.48 + 1.5));
      host.dataset.lineStart = pathPositions.getZ(0).toFixed(3);
      host.dataset.inputRow = String(Math.round(1 - inputRowFrame.position.y / 1.6));
      host.dataset.writtenCells = readouts
        .filter(({ label }) => !label.hidden)
        .map(({ i, j }) => `${i},${j}`)
        .join(";");
    });
  };
  const buildSwiGLU = () => {
    const heading = document.createElement("div");
    heading.className = "wiki-swiglu-focus-title";
    const headingTitle = document.createElement("strong"),
      hint = document.createElement("span");
    heading.append(headingTitle, hint);
    overlay.append(heading);
    const key = document.createElement("div");
    key.className = "wiki-swiglu-key";
    for (const [kind, text] of [
      ["weight", "权重"],
      ["positive", "正值"],
      ["negative", "负值"],
    ] as const) {
      const item = document.createElement("span");
      item.dataset.kind = kind;
      item.textContent = text;
      key.append(item);
    }
    overlay.append(key);
    const choice = inputLabel("down 输出", FFN.output.length, (n) => {
      downColumn = n;
    });
    const operationLabel = document.createElement("label"),
      operationSelect = document.createElement("select");
    operationLabel.textContent = "查看计算";
    operationSelect.setAttribute("aria-label", "查看计算");
    for (const [id, text] of [
      ["gate", "gate 投影"],
      ["up", "up 投影"],
      ["silu", "SiLU"],
      ["multiply", "逐通道门控"],
      ["down", "down 投影"],
    ])
      operationSelect.add(new Option(text, id));
    operationSelect.addEventListener("change", () =>
      seekProgress(SWIGLU_START[operationSelect.value as keyof typeof SWIGLU_START]),
    );
    operationLabel.append(operationSelect);
    inspector.querySelector(".wiki-compute-choices")!.append(choice.label, operationLabel);
    const group = (draw: () => void) => {
      const from = content.children.length,
        firstLabel = captions.length;
      draw();
      const mesh = new T.Group();
      for (const child of content.children.slice(from)) mesh.add(child);
      content.add(mesh);
      const labels = captions.slice(firstLabel);
      for (const c of labels) c.group = mesh;
      return { mesh, labels };
    };
    const setText = (node: HTMLElement, text: string, sub = "") => {
      if (node.firstElementChild!.textContent !== text) node.firstElementChild!.textContent = text;
      if (node.lastElementChild!.textContent !== sub) node.lastElementChild!.textContent = sub;
    };
    const modelCells = new Map<string, Cell>(),
      modelLabels = new Map<SwiNode, HTMLElement>();
    const cellKey = (c: SwiCell) => `${c.node}/${c.row}/${c.col}`;
    const structure = group(() => {
      // Keep the complete structure visible, with no backing panels behind the tensors.
      for (const id of Object.keys(SWIGLU_STRUCTURE) as SwiNode[]) {
        const node = SWIGLU_STRUCTURE[id],
          rows = node.values.length,
          cols = node.values[0]!.length;
        frame(v(node.at[0]!, node.at[1]!, 0), v(cols * 0.62 - 0.08, rows * 0.62 - 0.08, 0.28), palette.line);
        node.values.forEach((rr, row) => {
          rr.forEach((value, col) => {
            const ref = { node: id, row, col },
              at = v(...swigluCellPoint(ref));
            const c = cell(
              value,
              at,
              v(0.54, 0.54, 0.4),
              id.startsWith("W_") ? palette.weight : palette.norm[0],
            );
            modelCells.set(cellKey(ref), c);
            frame(at, v(0.56, 0.56, 0.42), palette.line);
            const op = (
              {
                W_gate: "gate",
                W_up: "up",
                g: "silu",
                s: "multiply",
                u: "multiply",
                h: "down",
                W_down: "down",
                delta: "down",
              } as Record<string, keyof typeof SWIGLU_START>
            )[id];
            if (op) {
              c.mesh.userData.operation = op;
              c.mesh.userData.channel = id === "W_down" || id === "delta" ? undefined : col;
              c.mesh.userData.downColumn = id === "W_down" || id === "delta" ? col : undefined;
              pickable.push(c.mesh);
            }
          });
        });
        const label = caption(
          node.title,
          `${rows} × ${cols}`,
          id === "W_down"
            ? v(-2.5, node.at[1]!, 0)
            : id === "s"
              ? v(node.at[0]! - 2.8, node.at[1]!, 0)
              : ["g", "u", "h", "delta"].includes(id)
                ? v(node.at[0]!, node.at[1]! - (id === "delta" ? 1.6 : 1.05), 0)
                : v(node.at[0]!, node.at[1]! + (id === "n" ? 2 : rows * 0.31 + (rows > 1 ? 0.95 : 0.56)), 0),
          "ffn-structure-label",
        );
        label.dataset.structureNode = id;
        modelLabels.set(id, label);
      }
      // These are the same tensor ports used by the moving copies, not a second diagram of buttons.
      const port = (node: SwiNode, side: "left" | "right" | "top" | "bottom") =>
        v(...swigluTensorPort(node, side));
      const routes = [
        [port("n", "bottom"), v(0, 7.85, 0), v(-4.6, 7.85, 0), v(-4.6, 4.5, 0), port("W_up", "left")],
        [port("n", "bottom"), v(0, 7.85, 0), v(4.6, 7.85, 0), v(4.6, 4.5, 0), port("W_gate", "right")],
        [port("W_up", "bottom"), port("u", "top")],
        [port("W_gate", "bottom"), port("g", "top")],
        [port("g", "bottom"), port("s", "top")],
        [port("u", "left"), v(-4.6, 2.3, 0), v(-4.6, -1.3, 0), port("h", "left")],
        [port("s", "bottom"), v(2.4, -1.3, 0), port("h", "right")],
        [port("h", "bottom"), v(0, -2.4, 0), v(3.9, -2.4, 0), v(3.9, -4.7, 0), port("W_down", "right")],
        [port("W_down", "bottom"), port("delta", "top")],
      ];
      routes.forEach((points) => {
        line(points, palette.result);
        const end = points.at(-1)!,
          direction = end.clone().sub(points.at(-2)!).normalize();
        const side = v(-direction.y, direction.x, 0).multiplyScalar(0.13);
        line(
          [
            end.clone().addScaledVector(direction, -0.24).add(side),
            end,
            end.clone().addScaledVector(direction, -0.24).sub(side),
          ],
          palette.result,
        );
      });
    });
    const source = (ref: SwiCell, targetGroup: T.Group) => {
      const world = structure.mesh.localToWorld(v(...swigluCellPoint(ref)));
      return targetGroup.worldToLocal(world);
    };
    const slab = (value: number, at: T.Vector3, size: T.Vector3, color = palette.result) => {
      const c = cell(value, at, size, color);
      const material = new T.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0.22 });
      materials.push(material);
      c.mesh.add(new T.LineSegments(edges, material));
      return c;
    };
    // The copied cell and its connector share the exact same endpoints throughout extraction and return.
    const transfer = (
      c: Cell,
      ref: SwiCell,
      target: T.Vector3,
      size: T.Vector3,
      amount: number,
      g: T.Group,
      rotation: "x" | "y" | null = null,
    ) => {
      c.mesh.position.copy(source(ref, g)).lerp(target, amount);
      const originSize = structure.mesh.getWorldScale(v(1, 1, 1)).divide(g.getWorldScale(v(1, 1, 1)));
      c.mesh.scale.copy(originSize.multiply(v(0.54, 0.54, 0.4))).lerp(size, amount);
      c.mesh.rotation.set(0, 0, 0);
      c.mesh.rotation.y = (structure.mesh.rotation.y - g.rotation.y) * (1 - amount);
      if (rotation) c.mesh.rotation[rotation] += (Math.PI / 2) * amount;
    };
    const views: { mesh: T.Group; labels: Caption[] }[] = [];
    const dotViews: ((p: number) => void)[] = [];
    for (const down of [false, true]) {
      const count = down ? FFN.product.length : FFN.input.length,
        columns = down ? FFN.output.length : FFN.gate.length;
      let update: (p: number) => void;
      const view = group(() => {
        const outlines: T.LineSegments[] = [];
        // Keep the tensor's rows and columns intact; numbers belong to its cell faces.
        const matrix = (name: string, rows: number, cols: number, at: T.Vector3, color: string) => {
          outlines.push(frame(at, v(cols * 1.8, rows * 1.28, 0.42), palette.line));
          return Array.from({ length: rows * cols }, (_, i) => {
            const row = Math.floor(i / cols),
              col = i % cols,
              point = at.clone().add(v((col - (cols - 1) / 2) * 1.8, ((rows - 1) / 2 - row) * 1.28, 0));
            const c = slab(0, point, v(1.72, 1.2, 0.42), color);
            const label = caption("", "", point, "ffn-matrix-number");
            label.dataset.matrix = name;
            label.dataset.row = String(row);
            label.dataset.col = String(col);
            captions.at(-1)!.face = c.mesh;
            return { cell: c, label, row, col };
          });
        };
        const inputs = matrix("input", 1, count, v(0, 11.8, 0), palette.norm[0]),
          weights = matrix("weight", count, columns, v(0, 4.3, 0), palette.weight),
          terms = matrix("product", 1, count, v(0, -3, 0.7), palette.result),
          outputs = matrix("output", 1, columns, v(0, -6.7, 0.7), palette.result);
        const inputTitle = caption("", "", v(0, 13.3, 0), "ffn-axis"),
          weightTitle = caption("", "", v(0, 4.3 + count * 0.64 + 0.85, 0), "ffn-axis"),
          productTitle = caption("", "", v(0, -0.9, 0.7), "ffn-axis"),
          outputTitle = caption("", "", v(0, -8.5, 0.7), "ffn-axis");
        const sum = line(
          Array.from({ length: 4 }, () => v(0, 0, 0)),
          palette.result,
        );
        const contribution = slab(0, v(0, 0, 0), v(1.72, 1.2, 0.42));
        const originLines = [
          line([v(0, 0, 0), v(1, 0, 0)], palette.norm[0]),
          line([v(0, 0, 0), v(1, 0, 0)], palette.weight),
        ];
        const returnLine = line([v(0, 0, 0), v(1, 0, 0)], palette.result);
        const paint = (c: Cell, color: string, current: boolean, selected = true) => {
          c.mesh.material.color.set(color).lerp(paper, current ? 0.22 : selected ? 0.58 : 0.88);
          c.mesh.material.opacity = 1;
          (c.mesh.children[0] as T.LineSegments<T.EdgesGeometry, T.LineBasicMaterial>).material.opacity =
            current ? 0.65 : selected ? 0.28 : 0.12;
        };
        update = (p) => {
          const f = swigluFocus(p, column, downColumn),
            t = swigluTransfer(p, column, downColumn);
          const expanded = t.extract === 1,
            returning = t.returning > 0,
            adding = f.calculation === "sum",
            multiplying = f.calculation === "multiply",
            active = f.active,
            weightNode: SwiNode = down ? "W_down" : f.operation === "up" ? "W_up" : "W_gate",
            outputName = down ? "Δ" : f.operation === "up" ? "u" : "g";
          view.labels.forEach(({ node }) => {
            node.style.visibility = expanded && !returning ? "visible" : "hidden";
          });
          outlines.forEach((outline) => {
            outline.visible = expanded && !returning;
          });
          setText(inputTitle, `输入 ${down ? "h" : "n"} · 1 × ${count}`);
          setText(weightTitle, `W_${f.operation} · ${count} × ${columns}`);
          setText(
            productTitle,
            f.calculation === "complete" ? `${outputName}[${f.column + 1}] = ${fmt(f.sum)}` : f.equation,
            adding
              ? `加入第 ${active + 1} 项 · 已完成 ${f.added}/${count}`
              : multiplying
                ? `第 ${active + 1} 项 · 输入与权重同亮`
                : f.calculation === "complete"
                  ? `${count} 项相加完成，即将写回`
                  : "保持输入顺序，接着逐项相加",
          );
          setText(outputTitle, `${outputName} · 1 × ${columns}`, `只写入第 ${f.column + 1} 格`);
          inputs.forEach((item, k) => {
            transfer(item.cell, t.inputs[k]!, item.cell.point, v(1.72, 1.2, 0.42), t.unfold, view.mesh);
            item.cell.mesh.visible = t.unfold > 0;
            paint(item.cell, f.input[k]! < 0 ? palette.data : palette.norm[0], multiplying && k === active);
            setText(item.label, fmt(f.input[k]!));
            item.label.dataset.current = String(multiplying && k === active);
          });
          weights.forEach((item) => {
            const selected = item.col === f.column,
              current = multiplying && selected && item.row === active;
            // The selected column protrudes from the complete grid without losing its row alignment.
            const target = item.cell.point.clone().add(v(0, 0, selected ? 0.32 : 0));
            transfer(
              item.cell,
              { node: weightNode, row: item.row, col: item.col },
              target,
              v(1.72, 1.2, selected ? 0.7 : 0.42),
              t.unfold,
              view.mesh,
            );
            item.cell.mesh.visible = t.unfold > 0;
            paint(item.cell, palette.weight, current, selected);
            setText(item.label, fmt(f.weights[item.row]![item.col]!));
            item.label.dataset.current = String(current);
            item.label.dataset.selected = String(selected);
          });
          terms.forEach((term, k) => {
            const amount = f.arrivals[k]!;
            term.cell.mesh.visible = expanded && !returning;
            paint(
              term.cell,
              f.products[k]! < 0 ? palette.data : palette.result,
              (multiplying || adding) && k === active,
              amount === 1,
            );
            setText(term.label, amount === 1 ? fmt(f.products[k]!) : "·");
            term.label.dataset.current = String((multiplying || adding) && k === active);
            term.label.dataset.term = String(k);
            term.label.dataset.product = fmt(f.products[k]!);
          });
          const output = outputs[f.column]!;
          outputs.forEach((item, j) => {
            const selected = j === f.column;
            item.cell.mesh.visible = expanded && (!returning || (selected && t.returning < 1));
            if (selected)
              transfer(
                item.cell,
                t.outputs[0]!,
                item.cell.point,
                v(1.72, 1.2, 0.42),
                1 - t.returning,
                view.mesh,
              );
            else {
              item.cell.mesh.position.copy(item.cell.point);
              item.cell.mesh.rotation.set(0, 0, 0);
              item.cell.mesh.scale.set(1.72, 1.2, 0.42);
            }
            paint(item.cell, f.sum < 0 ? palette.data : palette.result, selected && f.added > 0, selected);
            setText(item.label, selected && (adding || f.added > 0) ? fmt(f.sum) : "·");
            item.label.dataset.current = String(selected);
            item.label.dataset.outputColumn = String(j);
          });
          // The product row stays readable while one contribution folds into the selected output slot.
          const term = terms[active]!,
            reduction = f.reductions[active]!,
            start = cellSurfacePoint(term.cell.mesh, term.cell.point.clone().add(v(0, -1, 0))),
            end = cellSurfacePoint(output.cell.mesh, output.cell.point.clone().add(v(0, 1, 0)));
          const path = [start, v(start.x, -4.8, start.z), v(end.x, -4.8, end.z), end];
          sum.geometry.setFromPoints(path);
          sum.geometry.computeBoundingSphere();
          sum.visible = expanded && adding && f.added < count && !returning;
          contribution.mesh.visible = sum.visible && reduction > 0 && reduction < 1;
          contribution.mesh.position.copy(pointAlongComputePath(path, reduction));
          contribution.mesh.scale.set(1.05 * (1 - reduction * 0.25), 0.44, 0.3);
          colorCell(contribution, true, 0.85, f.products[active]);
          [t.inputs[0]!, { node: weightNode, row: 0, col: 0 }].forEach((ref, i) => {
            originLines[i]!.geometry.setFromPoints([
              source(ref as SwiCell, view.mesh),
              i === 0 ? inputs[0]!.cell.mesh.position : weights[0]!.cell.mesh.position,
            ]);
            originLines[i]!.visible = t.extract > 0 && t.extract < 1;
          });
          returnLine.geometry.setFromPoints([output.cell.point, source(t.outputs[0]!, view.mesh)]);
          returnLine.visible = returning && t.returning < 1;
        };
      });
      views.push(view);
      dotViews.push((p) => update(p));
    }
    let gateUpdate: (p: number) => void;
    const gateView = group(() => {
      const rowFrames = [
        frame(v(0, 9, 0), v(FFN.gate.length * 1.8, 1.2, 0.42), palette.line),
        frame(v(0, 5, 0), v(FFN.gate.length * 1.8, 1.2, 0.42), palette.line),
        frame(v(0, -1.4, 0), v(FFN.gate.length * 1.8, 1.2, 0.04), palette.line),
      ];
      const firstTitle = caption("", "", v(0, 10.7, 0), "ffn-axis"),
        secondTitle = caption("", "", v(0, 6.7, 0), "ffn-axis"),
        resultTitle = caption("", "", v(0, 2.8, 0), "ffn-axis"),
        zeroTitle = caption("0 面", "", v(6.2, -2.1, 0), "ffn-gate-effect"),
        explanation = caption("", "", v(0, -7.5, 0), "ffn-axis ffn-gate-explanation");
      const channels = Array.from({ length: FFN.gate.length }, (_, j) => {
        const x = (j - (FFN.gate.length - 1) / 2) * 1.8;
        const input = slab(0, v(x, 9, 0), v(1.72, 1.2, 0.42)),
          factor = slab(0, v(x, 5, 0), v(1.72, 1.2, 0.42)),
          result = slab(0, v(x, -1.4, 0), v(1.72, 1.2, 0.42));
        const labels = [input, factor, result].map((c, i) => {
          const label = caption("", "", c.point, "ffn-matrix-number ffn-gate-number");
          label.dataset.gateRole = ["before", "factor", "after"][i]!;
          label.dataset.channel = String(j);
          captions.at(-1)!.face = c.mesh;
          return label;
        });
        const ghost = frame(v(x, -1.4, 0), v(1.72, 1.2, 1), palette.line);
        const zero = line([v(x - 0.86, -2.1, 0), v(x + 0.86, -2.1, 0)], palette.weight);
        const effect = caption("", "", v(x, -5.1, 0), "ffn-gate-effect");
        const origins = [
          line([v(0, 0, 0), v(1, 0, 0)], palette.line),
          line([v(0, 0, 0), v(1, 0, 0)], palette.line),
        ];
        const back = line([v(0, 0, 0), v(1, 0, 0)], palette.result);
        return { input, factor, result, labels, ghost, zero, effect, origins, back };
      });
      gateUpdate = (p) => {
        const t = swigluTransfer(p, column, downColumn),
          g = swigluGateState(p),
          expanded = t.extract === 1,
          returning = t.returning > 0,
          collapse = computeWindow(t.local, 0.82, 0.9),
          visible = expanded && !returning;
        gateView.labels.forEach(({ node }) => {
          node.style.visibility = visible ? "visible" : "hidden";
        });
        rowFrames.forEach((f) => {
          f.visible = visible;
        });
        zeroTitle.style.visibility = visible && collapse === 0 ? "visible" : "hidden";
        setText(firstTitle, g.silu ? "gate 输出 g · 1 × 6" : "内容 u · 1 × 6");
        setText(secondTitle, g.silu ? "× 每格自己的 sigmoid(g)" : "× 门控系数 s · 1 × 6");
        setText(
          resultTitle,
          g.silu ? "SiLU 结果 s · 1 × 6" : "门控结果 h · 1 × 6",
          "同一列相乘，通道之间不相加",
        );
        const selected = g.channels[column]!;
        setText(
          explanation,
          `通道 ${column + 1} · ${selected.effect}${g.complete ? "" : "中"}`,
          `${formatComputeProduct(selected.before, selected.factor, 3)} ${g.complete ? `≈ ${fmt(selected.result)}` : `→ 目标 ${fmt(selected.result)}`}`,
        );
        channels.forEach((lane, j) => {
          const c = g.channels[j]!,
            active = j === column;
          transfer(lane.input, t.inputs[j]!, lane.input.point, v(1.72, 1.2, 0.42), t.unfold, gateView.mesh);
          lane.input.mesh.visible = t.unfold > 0;
          if (g.silu) {
            lane.factor.mesh.position.copy(lane.factor.point);
            lane.factor.mesh.rotation.set(0, 0, 0);
            lane.factor.mesh.scale.set(1.72, 1.2, 0.42);
            lane.factor.mesh.visible = expanded && !returning;
          } else {
            transfer(
              lane.factor,
              t.weights[j]!,
              lane.factor.point,
              v(1.72, 1.2, 0.42),
              t.unfold,
              gateView.mesh,
            );
            lane.factor.mesh.visible = t.unfold > 0;
          }
          // All channel volumes share the same zero face and scale. Ghosts preserve the original value.
          const depth = c.shapeValue * 1.3;
          lane.result.mesh.position.copy(lane.result.point).add(v(0, 0, depth / 2));
          lane.result.mesh.scale.set(1.72, 1.2, Math.max(0.015, Math.abs(depth)));
          lane.result.mesh.rotation.set(0, 0, 0);
          lane.ghost.position.copy(lane.result.point).add(v(0, 0, (c.before * 1.3) / 2));
          lane.ghost.scale.set(1.72, 1.2, Math.abs(c.before) * 1.3);
          (lane.ghost.material as T.LineBasicMaterial).opacity = active ? 0.65 : 0.24;
          lane.ghost.visible = lane.zero.visible = visible && collapse === 0;
          lane.result.mesh.position.lerp(lane.result.point, collapse);
          lane.result.mesh.scale.lerp(v(1.72, 1.2, 0.42), collapse);
          if (returning)
            transfer(
              lane.result,
              t.outputs[j]!,
              lane.result.point,
              v(1.72, 1.2, 0.42),
              1 - t.returning,
              gateView.mesh,
            );
          lane.result.mesh.visible = expanded && t.returning < 1;
          [lane.input, lane.factor, lane.result].forEach((cell, i) => {
            const value = [c.before, c.factor, c.shapeValue][i]!;
            cell.mesh.material.color.copy(value < 0 ? negative : positive).lerp(paper, active ? 0.25 : 0.65);
            cell.mesh.material.opacity = 1;
          });
          setText(lane.labels[0]!, fmt(c.before));
          setText(lane.labels[1]!, String(c.factor));
          setText(lane.labels[2]!, c.displayValue === null ? "…" : fmt(c.displayValue));
          lane.labels.forEach((label) => {
            label.dataset.current = String(active);
          });
          lane.labels[2]!.dataset.before = String(c.before);
          lane.labels[2]!.dataset.after = String(c.result);
          lane.labels[2]!.dataset.complete = String(g.complete);
          setText(lane.effect, `${j + 1} ${c.factor < 0 ? "变号" : c.effect}`);
          lane.effect.dataset.current = String(active);
          lane.origins.forEach((wire, i) => {
            const ref = i === 0 ? t.inputs[j]! : t.weights[j];
            const mesh = i === 0 ? lane.input.mesh : lane.factor.mesh;
            wire.visible = Boolean(ref) && t.extract > 0 && t.extract < 1 && active;
            if (ref) wire.geometry.setFromPoints([source(ref, gateView.mesh), mesh.position]);
          });
          lane.back.geometry.setFromPoints([lane.result.point, source(t.outputs[j]!, gateView.mesh)]);
          lane.back.visible = returning && t.returning < 1 && active;
        });
        host.dataset.gateComplete = String(g.complete);
      };
    });
    views.push(gateView);
    animations.push((p) => {
      const t = swigluTransfer(p, column, downColumn),
        dot = t.phase === 0 || t.phase === 3;
      const stacked = width < 900;
      host.dataset.layout = stacked ? "stack" : "wide";
      structure.mesh.position.set(stacked ? 0 : -7.6, stacked ? 9 : 0, 0);
      structure.mesh.scale.setScalar(stacked ? 1 : 1.12);
      structure.mesh.rotation.y = 0;
      views.forEach((g, i) => {
        g.mesh.position.set(stacked ? 0 : 5.4, stacked ? -15 : 0, 0);
        g.mesh.rotation.y = 0.12;
        const visible = dot ? i === (t.phase === 3 ? 1 : 0) : i === 2;
        g.mesh.visible = visible;
        g.labels.forEach(({ node }) => {
          node.style.visibility = "hidden";
        });
      });
      content.updateMatrixWorld(true);
      const section = t.phase === 0 ? 0 : t.phase === 3 ? 2 : 1;
      const selected = new Set([...t.inputs, ...t.weights, ...t.outputs].map(cellKey));
      for (const [id, c] of modelCells) {
        const node = id.split("/")[0] as SwiNode,
          ready = swigluStructureState(p, node),
          active = selected.has(id);
        if (node.startsWith("W_") || node === "n") {
          c.mesh.material.color
            .set(node === "n" ? palette.norm[0] : palette.weight)
            .lerp(paper, active ? 0 : 0.28);
          c.mesh.material.opacity = active ? 1 : 0.5;
        } else colorCell(c, active, ready ? 1 : 0.03);
        // The full weight grid unfolds, so retain its outline rather than a duplicate matrix underneath.
        if ([...t.inputs, ...t.weights].some((ref) => ref.node === node)) c.mesh.visible = t.unfold === 0;
        else c.mesh.visible = true;
      }
      for (const [id, label] of modelLabels) {
        const active = [...t.inputs, ...t.weights, ...t.outputs].some((ref) => ref.node === id),
          node = SWIGLU_STRUCTURE[id];
        label.dataset.active = String(active);
        label.dataset.ready = String(swigluStructureState(p, id));
        if (id === t.outputs[0]!.node && t.outputs.length === 1) {
          const col = t.outputs[0]!.col;
          setText(
            label,
            `${node.title}[${col + 1}]${t.returning === 1 ? ` = ${fmt(node.values[0]![col]!)}` : ""}`,
            "",
          );
        } else if (id === "n" || id === "delta") {
          setText(label, `${node.title} · 1 × ${node.values[0]!.length}`);
        } else
          setText(
            label,
            id === "s" ? "缩放系数 s" : id === "h" ? "逐通道乘积 h" : node.title,
            ["g", "u", "s", "h"].includes(id)
              ? ""
              : `${id === "W_gate" || id === "W_up" ? `${id} · ` : ""}${node.values.length} × ${node.values[0]!.length}`,
          );
      }
      if (dot) dotViews[t.phase === 3 ? 1 : 0]!(p);
      else gateUpdate(p);
      const target = SWIGLU_STRUCTURE[t.outputs[0]!.node].title,
        col = t.outputs[0]!.col + 1;
      const name = {
        gate: "gate 投影",
        up: "up 投影",
        silu: "SiLU",
        multiply: "逐通道门控",
        down: "down 投影",
      }[t.operation];
      const calculation = dot ? swigluFocus(p, column, downColumn).calculation : null;
      headingTitle.textContent = `${["双路投影", "门控汇合", "输出投影"][section]} / ${name} · ${t.returning > 0 ? "收回原位" : t.extract < 1 ? "从结构展开" : calculation === "multiply" ? "逐项相乘" : calculation === "sum" ? "逐项相加" : calculation === "complete" ? "结果就绪" : "计算"}`;
      hint.textContent =
        t.returning > 0
          ? t.outputs.length === 1
            ? `结果回到 ${target} 的第 ${col} 格；随后其他格按同样规则补齐。`
            : `六个结果按通道编号，写回 ${target} 的六个原位。`
          : dot
            ? `输入行 × 权重第 ${col} 列：同亮的两格相乘，逐项填入乘积行，再相加写回输出第 ${col} 格。`
            : t.operation === "silu"
              ? "六列各算自己的 g × sigmoid(g)。系数在 0 到 1 之间，只压小幅度、保留符号；轮廓保留原值。"
              : "六列独立相乘。轮廓保留原值，实体深度表示大小；负系数让结果越过零面、改变符号。";
      host.dataset.operation = t.operation;
      host.dataset.calculation = calculation ?? "gate";
      host.dataset.transfer = t.returning > 0 ? "return" : t.extract < 1 ? "extract" : "compute";
      host.dataset.structureVisible = "true";
      host.dataset.outputReady = String(swigluStructureState(p, "delta"));
      host.dataset.spatialMeaning = "structure-extraction-compute-writeback";
      host.dataset.structureCells = String(modelCells.size);
      host.dataset.unfold = t.unfold.toFixed(3);
      operationSelect.value = t.operation;
      choice.select.value = String(downColumn);
    });
  };

  const updateReadout = (readProgress = progress) => {
    const phase = computePhase(step, readProgress),
      timeline = matmulTimeline(readProgress),
      swiglu = swigluTimeline(readProgress),
      focus = step === 2 ? swigluFocus(readProgress, column, downColumn) : null,
      key = `${step}/${phase}/${row}/${column}/${downColumn}/${spread}/${step === 1 ? `${timeline.active}/${timeline.made}/${timeline.added}` : `${swiglu.operation}/${focus!.calculation}/${swiglu.active}/${swiglu.made}/${swiglu.added}/${swiglu.silu === 1}/${swiglu.pair === 1}`}`;
    if (key === lastReadout) return;
    lastReadout = key;
    colSelect.value = String(column);
    if (step === 1) {
      rowSelect.value = String(row);
      const terms = COMPUTE_PRODUCTS[row]![column]!;
      const { active, made, added } = timeline;
      const sum = terms.slice(0, added).reduce((a, b) => a + b, 0);
      formula.textContent =
        phase === 3
          ? `Y[${row}, ${column}] = ${terms.join(" + ")} = ${COMPUTE_OUTPUT[row]![column]}`
          : phase === 2
            ? `已累加 ${added}/3 项：${terms.slice(0, added).join(" + ") || "0"} = ${sum}`
            : phase === 1
              ? `第 ${active + 1} 项：${COMPUTE_INPUT[row]![active]} × ${COMPUTE_WEIGHT[active]![column]} = ${terms[active]}`
              : `token ${row + 1} → 输出通道 ${column + 1}`;
      const descriptions = [
        `输入第 ${row + 1} 行 × 权重第 ${column + 1} 列，只得到输出第 ${row + 1} 行、第 ${column + 1} 列这一格。左侧框住这一行，上方亮起这一列。`,
        `沿深度看第 ${active + 1} 层：一项输入与一项权重在交点相乘。三层分别留下三项贡献。`,
        "三项贡献依次汇入前方这一格。深度代表的输入维被求和消去，token 行和输出列保留下来。",
        `输出 Y[${row}, ${column}] 写入完成。${column < 3 ? "保持输入行，接着读取下一列权重。" : row < 2 ? "这一行的四格已算完，接着切换下一行输入。" : "三行、四列的十二个结果全部得到。"}`,
      ];
      // Share one grid cell so every phase reserves the longest explanation's height.
      description.replaceChildren(
        ...descriptions.map((text, index) => {
          const item = document.createElement("span");
          item.textContent = text;
          item.setAttribute("aria-hidden", String(index !== phase));
          return item;
        }),
      );
      values.replaceChildren(
        ...terms.map((n, k) => {
          const item = document.createElement("div"),
            name = document.createElement("span"),
            equation = document.createElement("strong");
          item.className = "wiki-compute-term-row";
          item.dataset.active = String((phase === 1 && k === active) || (phase === 2 && k === added));
          item.dataset.done = String(phase === 3 || (phase === 2 ? k < added : k < made));
          name.textContent = `输入维 ${k + 1}`;
          equation.textContent = `${COMPUTE_INPUT[row]![k]} × ${COMPUTE_WEIGHT[k]![column]} = ${phase === 0 || (phase === 1 && k > active) ? "·" : n}`;
          item.append(name, equation);
          return item;
        }),
      );
    } else {
      const f = focus!,
        dot = phase === 0 || phase === 3;
      const symbol = phase === 3 ? "Δ" : f.operation === "up" ? "u" : "g";
      if (dot) {
        description.textContent = `${phase === 3 ? "门控后的 h" : "同一份输入 n"}的第 k 项，与 W_${f.operation} 第 ${f.column + 1} 列的第 k 行相乘。${f.input.length} 个乘积按输入顺序排成一行，相加后只写入 ${symbol}[${f.column + 1}] 这一格。其余输出列按相同规则计算。`;
        formula.textContent = `${f.calculation === "multiply" ? `第 ${f.active + 1} 项` : `${symbol}[${f.column + 1}]`}：${f.equation}`;
        values.replaceChildren(
          ...f.products.map((n, k) => {
            const item = document.createElement("div"),
              name = document.createElement("span"),
              equation = document.createElement("strong");
            item.className = "wiki-compute-term-row";
            item.dataset.active = String(
              (f.calculation === "multiply" || f.calculation === "sum") && k === f.active,
            );
            item.dataset.done = String(k < f.added);
            name.textContent = `输入维 ${k + 1}`;
            equation.textContent = `${formatComputeProduct(f.input[k]!, f.weights[k]![f.column]!)} = ${k < f.made ? fmt(n) : "…"}`;
            item.append(name, equation);
            return item;
          }),
        );
        const p = document.createElement("p");
        p.textContent =
          phase === 3
            ? `down 的每一列都读取全部六个 h；四列得到 [${FFN.output.map(fmt).join(", ")}]。这里还没有加残差。`
            : "两路使用同一份 n，但各自读取不同权重。完整 3D 结构始终保留，放大部分从高亮格取出，结果返回原格。";
        values.append(p);
      } else {
        const j = column,
          gate = swigluGateState(readProgress),
          silu = gate.silu,
          selected = gate.channels[j]!;
        description.textContent = silu
          ? "六个 g 各自生成 sigmoid(g)，逐格相乘得到 SiLU(g)。上排是 g，中排是乘数，下排是结果；同一列配对。sigmoid(g) 在 0 到 1 之间，压小幅度、保留正负号。"
          : "六个通道各自相乘，没有跨通道相加。通道 1 的乘数大于 1，会放大；通道 2 的负乘数接近 0，压小并翻转。其余通道也由各自乘数独立决定。";
        formula.textContent = `${gate.complete ? "结果" : "目标"} ${silu ? "s" : "h"}[${j + 1}]：${formatComputeProduct(selected.before, selected.factor, 3)} ≈ ${fmt(selected.result)}`;
        const table = document.createElement("table");
        table.className = "wiki-swiglu-values";
        table.setAttribute("aria-label", "门控前后逐通道对照");
        const head = table.createTHead().insertRow();
        ["通道", silu ? "g" : "原值 u", silu ? "sigmoid" : "乘数", "结果"].forEach((text) => {
          const th = document.createElement("th");
          th.textContent = text;
          head.append(th);
        });
        gate.channels.forEach((channel, j) => {
          const rr = table.insertRow();
          rr.dataset.active = String(j === column);
          [j + 1, channel.before, channel.factor, channel.result].forEach((n) => {
            rr.insertCell().textContent = String(n);
          });
        });
        const p = document.createElement("p");
        p.textContent =
          "轮廓保留门控前的深度，实体显示门控后的大小。绿色为正、橙色为负；结果格在形变完成后显示数值。表中是目标值，示意数逐步取两位小数。";
        values.replaceChildren(table, p);
      }
    }
    host.dataset.selection = `${row},${column}`;
  };
  const render = () => {
    const header = step === 2 ? 90 : 0,
      plotHeight = Math.max(1, height - header);
    renderer.setViewport(0, 0, width, plotHeight);
    renderer.render(scene, camera);
    const project = (point: T.Vector3) => {
      point.project(camera);
      return { x: ((point.x + 1) * width) / 2, y: header + ((1 - point.y) * plotHeight) / 2 };
    };
    const occupied: LabelRect[] = [],
      wires: LabelRect[] = [];
    if (step === 2) {
      // Reserve the actual projected tensor faces, including the outlines left during unfolding.
      for (const item of captions) {
        const id = item.node.dataset.structureNode as SwiNode | undefined;
        if (!id || !item.group) continue;
        const tensor = SWIGLU_STRUCTURE[id];
        const halfX = tensor.values[0]!.length * 0.31;
        const halfY = tensor.values.length * 0.31;
        const corners = [-1, 1].flatMap((x) =>
          [-1, 1].map((y) =>
            project(
              v(tensor.at[0]! + x * halfX, tensor.at[1]! + y * halfY, 0.3).applyMatrix4(
                item.group!.matrixWorld,
              ),
            ),
          ),
        );
        const left = Math.min(...corners.map((p) => p.x)),
          top = Math.min(...corners.map((p) => p.y));
        occupied.push({
          x: left - 4,
          y: top - 4,
          width: Math.max(...corners.map((p) => p.x)) - left + 8,
          height: Math.max(...corners.map((p) => p.y)) - top + 8,
        });
      }
    }
    const blocks = new Map<T.Object3D, { rect: LabelRect; corners: { x: number; y: number }[] }>();
    if (step === 1) {
      content.traverseVisible((object) => {
        if (object instanceof T.Line && object.userData.labelObstacle) {
          const positions = object.geometry.getAttribute("position");
          for (let i = 1; i < positions.count; i++) {
            const a = project(
              v(0, 0, 0)
                .fromBufferAttribute(positions, i - 1)
                .applyMatrix4(object.matrixWorld),
            );
            const b = project(v(0, 0, 0).fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
            wires.push({
              x: Math.min(a.x, b.x),
              y: Math.min(a.y, b.y),
              width: Math.max(1, Math.abs(a.x - b.x)),
              height: Math.max(1, Math.abs(a.y - b.y)),
            });
          }
        }
        if (!(object instanceof T.Mesh) || object.material.opacity < 0.12) return;
        let left = Infinity,
          right = -Infinity,
          top = Infinity,
          bottom = -Infinity;
        const corners: { x: number; y: number }[] = [];
        for (const x of [-0.5, 0.5])
          for (const y of [-0.5, 0.5])
            for (const z of [-0.5, 0.5]) {
              const point = project(v(x, y, z).applyMatrix4(object.matrixWorld));
              corners.push(point);
              left = Math.min(left, point.x);
              right = Math.max(right, point.x);
              top = Math.min(top, point.y);
              bottom = Math.max(bottom, point.y);
            }
        const rect = { x: left, y: top, width: right - left, height: bottom - top };
        occupied.push(rect);
        blocks.set(object, { rect, corners });
      });
    }
    const links: string[] = [];
    leaders.style.display = step === 2 ? "" : "none";
    leaders.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const bounds = { x: 10, y: header + 12, width: width - 20, height: plotHeight - 46 };
    const measure = (item: Caption) => {
      // Cache text measurements; playback must not force layout for every label on every frame.
      const text = item.node.textContent ?? "";
      if (item.measurement?.text !== text || item.measurement.viewport !== width) {
        item.measurement = {
          text,
          viewport: width,
          width: item.node.offsetWidth,
          height: item.node.offsetHeight,
        };
      }
      return item.measurement;
    };
    for (const item of captions) {
      const { node, point, group } = item;
      const p = item.face
        ? v(0, 0, 0.51).applyMatrix4(item.face.matrixWorld)
        : point.clone().applyMatrix4((group ?? content).matrixWorld);
      const anchor = project(p);
      let x = anchor.x,
        y = anchor.y;
      const structureTitle = step === 2 && Boolean(node.dataset.structureNode);
      const placeTitle = structureTitle || (step === 1 && node.className.trim() === "wiki-compute-label");
      if (placeTitle && !item.face && !node.hidden && node.style.visibility !== "hidden") {
        const size = measure(item);
        const block = item.attachment && blocks.get(item.attachment.mesh);
        const placed = block
          ? placeSceneCellLabel(block.rect, size, item.attachment!.side, occupied, bounds, wires)
          : placeSceneLabel(
              { x: x - size.width / 2, y: y - size.height / 2, width: size.width, height: size.height },
              occupied,
              bounds,
            );
        occupied.push(placed);
        x = placed.x + placed.width / 2;
        y = placed.y + placed.height / 2;
        let from = item.leaderPoint
          ? project(item.leaderPoint.clone().applyMatrix4((group ?? content).matrixWorld))
          : anchor;
        if (block) {
          // Start on the actual block silhouette, never draw a leader through its face.
          const distance = (corner: { x: number; y: number }) =>
            (corner.x - Math.max(placed.x, Math.min(corner.x, placed.x + placed.width))) ** 2 +
            (corner.y - Math.max(placed.y, Math.min(corner.y, placed.y + placed.height))) ** 2;
          from = block.corners.reduce((a, b) => (distance(a) < distance(b) ? a : b));
        }
        if ((block || item.leaderPoint || structureTitle) && Math.hypot(x - from.x, y - from.y) > 8) {
          const endX = Math.max(placed.x, Math.min(from.x, placed.x + placed.width)),
            endY = Math.max(placed.y, Math.min(from.y, placed.y + placed.height));
          links.push(`M${from.x},${from.y}L${endX},${endY}`);
        }
      }
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
    }
    leaderPath.setAttribute("d", links.join(""));
    host.dataset.drawCalls = String(renderer.info.render.calls);
  };
  const reset = () => {
    content.rotation.z = 0;
    content.updateMatrixWorld(true);
    const target = step === 1 ? v(-0.5, 0.4, 0.6) : v(width < 900 ? 0 : -1.4, width < 900 ? -2 : 0.7, 0);
    controls.target.copy(target);
    camera.position.copy(target).add(step === 1 ? v(-11, 8, 18) : v(0, 17, 28));
    camera.lookAt(target);
    const aspect = width / Math.max(1, height - (step === 2 ? 90 : 0)),
      half =
        step === 1
          ? Math.max(5.8, 6.6 / aspect)
          : width < 900
            ? Math.max(23, 6.6 / aspect)
            : Math.max(10.8, 11.7 / aspect);
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    controls.update();
    render();
  };
  const animate = (p: number) => {
    if (step === 1) {
      const next = matmulTimeline(p);
      row = next.row;
      column = next.column;
    }
    progress = p;
    if (step < 0) return;
    for (const fn of animations) fn(p);
    host.dataset.phase = String(computePhase(step, p));
    host.dataset.progress = p.toFixed(3);
    updateReadout();
    render();
  };
  const clear = () => {
    content.clear();
    captions.length = pickable.length = animations.length = 0;
    overlay.replaceChildren();
    for (const g of geometries.splice(2)) g.dispose();
    for (const m of materials.splice(0)) m.dispose();
  };
  const resize = () => {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height);
    if (step >= 0) {
      reset();
      animate(progress);
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  const raycaster = new T.Raycaster();
  let downX = 0,
    downY = 0;
  const pointerDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
  };
  const pointerUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const header = step === 2 ? 90 : 0;
    if (e.clientY - rect.top < header) return;
    raycaster.setFromCamera(
      new T.Vector2(
        ((e.clientX - rect.left) / width) * 2 - 1,
        1 - ((e.clientY - rect.top - header) / (height - header)) * 2,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(pickable.filter((object) => object.parent?.visible !== false))[0];
    if (hit) {
      if (step === 2 && hit.object.userData.operation) {
        const data = hit.object.userData;
        if (data.channel !== undefined) column = data.channel;
        if (data.downColumn !== undefined) downColumn = data.downColumn;
        seekProgress(SWIGLU_START[data.operation as keyof typeof SWIGLU_START]);
        return;
      }
      if (step === 2 && hit.object.userData.down) downColumn = hit.object.userData.output[1];
      else [row, column] = hit.object.userData.output;
      if (step === 1) seekProgress(matmulProgress(row, column, matmulTimeline(progress).local));
      animate(progress);
    }
  };
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  controls.addEventListener("change", render);
  resize();
  return {
    update(next: number) {
      if (next === step) return;
      clear();
      step = next;
      controls.minPolarAngle = step === 2 ? 0.65 : 0.35;
      controls.maxPolarAngle = step === 2 ? 1.25 : Math.PI * 0.75;
      controls.minAzimuthAngle = step === 2 ? -0.45 : -Infinity;
      controls.maxAzimuthAngle = step === 2 ? 0.45 : Infinity;
      row = column = 0;
      spread = false;
      lastReadout = "";
      host.dataset.step = String(step);
      buildInspector();
      if (step === 1) buildMatmul();
      else buildSwiGLU();
      reset();
      animate(progress);
    },
    animate,
    reset,
    dispose() {
      observer.disconnect();
      controls.dispose();
      clear();
      box.dispose();
      edges.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      stage.remove();
      inspector.remove();
      delete host.dataset.compute;
    },
  };
}
