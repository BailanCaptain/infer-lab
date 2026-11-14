import type * as Three from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { ChapterLayer, LayerScene } from "./chapter-layer";
import {
  type Column,
  columnStages,
  formatLayerValue,
  layerFrame,
  type Panel,
  projectionGroups,
  projectionTerms,
  RESIDUAL_TIMING,
  visibleGroups,
} from "./layer-calculation";
import { layerBlock, layerWeightBlock } from "./layer-layout";
import { type MasterParts, type PartBlock, WORDS } from "./matrix-parts";

export interface LayerRenderer {
  seek(progress: number, word: number, channel: number): void;
  resetView(): void;
  dispose(): void;
}
const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
const during = (n: number, from: number, to: number) => smooth((n - from) / (to - from));

export function mountLayerScene(
  host: HTMLDivElement,
  source: MasterParts,
  kind: Exclude<LayerScene, "attention">,
  data: ChapterLayer,
  onError: () => void,
): LayerRenderer {
  const T = source.three;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(2);
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);
  const svgNS = "http://www.w3.org/2000/svg";
  const wires = document.createElementNS(svgNS, "svg");
  wires.classList.add("layer-wires");
  wires.setAttribute("aria-hidden", "true");
  const markerId = `layer-wire-arrow-${kind}`;
  const defs = document.createElementNS(svgNS, "defs");
  const marker = document.createElementNS(svgNS, "marker");
  marker.id = markerId;
  for (const [key, value] of Object.entries({
    viewBox: "0 0 8 8",
    refX: "7",
    refY: "4",
    markerWidth: "5",
    markerHeight: "5",
    orient: "auto",
  }))
    marker.setAttribute(key, value);
  const arrow = document.createElementNS(svgNS, "path");
  arrow.setAttribute("d", "M1 1 L7 4 L1 7");
  arrow.setAttribute("fill", "none");
  arrow.setAttribute("stroke", "context-stroke");
  marker.append(arrow);
  defs.append(marker);
  wires.append(defs);
  host.append(wires);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI - 0.2;
  controls.mouseButtons.LEFT = T.MOUSE.ROTATE;
  controls.touches.ONE = T.TOUCH.ROTATE;
  const look = source.makeFlowLook({ px: 2, minPx: 0, viewH: 420, fine: 16, slabs: "touch" });
  const style = getComputedStyle(host);
  const color = (name: string) =>
    new T.Color(style.getPropertyValue(`--color-${name}`).trim()).convertLinearToSRGB();
  const page = color("surface");
  const palette = [null, color("matrix-parameter"), color("matrix-output")];
  const labels = document.createElement("div");
  labels.className = "layer-labels";
  labels.setAttribute("aria-hidden", "true");
  host.append(labels);
  type Mesh = Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  type Item = {
    mesh: Mesh;
    block: PartBlock;
    label: HTMLDivElement;
    name: HTMLElement;
    shape: HTMLElement;
    producedAt: number;
    parameter: boolean;
  };
  let word = 5,
    channel = 1023,
    selectedDimension = 1023,
    progress = 0,
    width = 1,
    height = 1;
  let stages = columnStages(data, kind, word);
  let projectedStage = stages[0];
  let projectedChannel = -1;
  let projectedTerms: ReturnType<typeof projectionTerms> = [];
  let projectedGroups: ReturnType<typeof projectionGroups> = [];
  const graph = !kind.startsWith("residual");
  const pitch = 0.349,
    yaw = 0.525;
  const rowY = (x: number, y: number) => y + x * Math.tan(pitch) * Math.sin(yaw);
  const items: Item[] = [];
  const stageItems: (Item | undefined)[][] = [];
  const makeItem = (spec: Panel, x: number, top: number, producedAt: number, parameter = false): Item => {
    const id = `matrix-${items.length}`;
    const block = spec.weight
      ? layerWeightBlock(source, id, spec.rows, spec.columns, x, top)
      : layerBlock(source, id, spec.name, spec.columns, spec.rows, x, 0);
    if (!spec.weight) {
      const h = block.y1 - block.y0;
      block.y1 = top;
      block.y0 = top - h;
    }
    if (graph) {
      const h = block.y1 - block.y0;
      // Stagger parameters into the gaps above their operation, retaining native proportions.
      block.y1 = rowY(x, parameter ? 235 : top);
      block.y0 = block.y1 - h;
    }
    const mesh = look.addBlock(scene, block);
    const ink = palette[spec.ink];
    if (ink) mesh.material.uniforms.uCol!.value.set(ink.r, ink.g, ink.b);
    mesh.material.uniforms.uPage!.value.set(page.r, page.g, page.b);
    const label = document.createElement("div");
    label.className = "layer-label matrix-part-label";
    label.dataset.matrix = spec.name;
    const name = document.createElement("strong"),
      shape = document.createElement("span");
    name.textContent = spec.name;
    shape.textContent = spec.weight
      ? `${spec.rows.toLocaleString("en-US")} × ${spec.columns.toLocaleString("en-US")}`
      : `${spec.columns} × ${spec.rows.toLocaleString("en-US")}`;
    label.append(name, shape);
    labels.append(label);
    const item = { mesh, block, label, name, shape, producedAt, parameter };
    items.push(item);
    return item;
  };
  // Each tensor owns one permanent mesh. A previous output is literally the next input.
  let previousOutput: Item | undefined;
  let dataIndex = 0;
  const dataCount = kind === "ffn" ? 5 : 4;
  const dataX = (index: number) => (index - (dataCount - 1) / 2) * 210;
  stages.forEach((stage, index) => {
    if (index > 0 && stage === stages[index - 1]) {
      stageItems.push(stageItems[index - 1]!);
      return;
    }
    if (!graph) {
      stageItems.push(stage.panels.map((spec, i) => makeItem(spec, (i - 1) * 116, 95, i === 2 ? 0 : -1)));
      return;
    }
    const input = previousOutput ?? makeItem(stage.panels[0]!, dataX(dataIndex++), 95, -1);
    const output = makeItem(stage.panels[2]!, dataX(dataIndex++), 95, index);
    const parameter =
      stage.panels[1]!.rows > 0
        ? makeItem(
            stage.panels[1]!,
            (input.mesh.position.x + output.mesh.position.x) / 2,
            kind === "ffn" ? 400 : 260,
            -1,
            true,
          )
        : undefined;
    stageItems.push([input, parameter, output]);
    previousOutput = output;
  });
  let active = stageItems[0]!;
  const overlay = document.createElement("div");
  overlay.className = "layer-column-work";
  overlay.setAttribute("aria-hidden", "true");
  const status = document.createElement("span"),
    note = document.createElement("span");
  status.className = "layer-column-status";
  note.className = "matrix-rms-note";
  overlay.append(status, note);
  host.append(overlay);
  const projection = document.createElement("div");
  projection.className = "projection-detail";
  projection.hidden = true;
  const projectionTitle = document.createElement("div");
  projectionTitle.className = "projection-title";
  const projectionSum = document.createElement("div");
  projectionSum.className = "projection-sum";
  projection.append(projectionTitle, projectionSum);
  overlay.append(projection);
  const projectionLabels: { node: HTMLElement; at: Three.Vector3 }[] = [];
  const mathLabel = (parent: HTMLElement, className: string) => {
    const node = document.createElement("span");
    node.className = className;
    parent.append(node);
    const label = { node, at: new T.Vector3() };
    projectionLabels.push(label);
    return label;
  };
  const equations = Array.from({ length: 8 }, () => {
    const row = document.createElement("div");
    row.className = "projection-equation";
    projection.append(row);
    return ["dimension", "input", "multiply", "weight", "equals", "product"].map((part) =>
      mathLabel(row, `projection-${part}`),
    );
  });
  const projectionHeaders = Array.from({ length: 4 }, () => mathLabel(projection, "projection-heading"));
  // Preserve the mother's surface coordinates across every contiguous piece of a full column.
  const pool = Array.from({ length: 15 }, (_, index) => {
    const block = active[0]!.block;
    const sample = look.addBlock(scene, { ...block, id: `column-motion-${index}` });
    scene.remove(sample);
    const geometry = sample.geometry.clone();
    geometry.setAttribute(
      "columnGroup",
      new T.InstancedBufferAttribute(
        Float32Array.from({ length: 32 }, (_, i) => i),
        1,
      ),
    );
    const material = sample.material;
    material.uniforms.columnIndex = { value: 0 };
    material.uniforms.columnCount = { value: 6 };
    material.uniforms.columnSpan = { value: 1 };
    material.uniforms.groupCount = { value: 16 };
    material.vertexShader =
      `attribute float columnGroup; uniform float columnIndex, columnCount, columnSpan, groupCount;\n${material.vertexShader}`
        .replace(
          "vPos = p; vNrm = normal;",
          "vPos = vec3((columnIndex + (p.x + .5) * columnSpan) / columnCount - .5, .5 - (columnGroup + .5 - p.y) / groupCount, p.z); vNrm = normal;",
        )
        .replace(
          "gl_Position = projectionMatrix * viewMatrix * vec4(c + p * s, 1.0);",
          "gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);",
        );
    const mesh = new T.InstancedMesh(geometry, material, 32);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });
  const guides = Array.from({ length: 7 }, () => {
    const path = document.createElementNS(svgNS, "path");
    path.classList.add("layer-wire");
    path.setAttribute("marker-end", `url(#${markerId})`);
    wires.append(path);
    const outline = new Line2(
      new LineGeometry().setPositions([-0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 0, -0.5, 0.5, 0]),
      new LineMaterial({ linewidth: 1.2, transparent: true, depthTest: false, depthWrite: false }),
    );
    outline.renderOrder = 6;
    outline.frustumCulled = false;
    scene.add(outline);
    return {
      path,
      outline,
      points: [] as Three.Vector3[],
      opacity: 0,
      parameter: false,
      reverse: false,
      sourceLabel: null as HTMLDivElement | null,
    };
  });
  const m = new T.Matrix4(),
    point = new T.Vector3(),
    size = new T.Vector3(),
    rotation = new T.Quaternion();
  const put = (
    mesh: (typeof pool)[number],
    i: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => {
    m.compose(
      point.set(x, y, z),
      rotation,
      w <= 0 || h <= 0 || d <= 0 ? size.set(0, 0, 0) : size.set(w, h, d),
    );
    mesh.setMatrixAt(i, m);
  };
  const prepare = (index: number, column: Column, span = 1) => {
    const mesh = pool[index]!,
      original = active[column.panel]!;
    const uniforms = mesh.material.uniforms,
      from = original.mesh.material.uniforms;
    for (const key of ["uCol", "uPage", "uDiv", "uFine", "uCut", "uSeed", "uNoise"]) {
      if (typeof from[key]!.value === "number") uniforms[key]!.value = from[key]!.value;
      else uniforms[key]!.value.copy(from[key]!.value);
    }
    uniforms.uDim!.value = 0;
    uniforms.columnIndex!.value = column.column;
    uniforms.columnCount!.value = stages[currentStage()]!.panels[column.panel]!.columns;
    uniforms.columnSpan!.value = span;
    mesh.count = visibleGroups(column.values.length);
    uniforms.groupCount!.value = mesh.count;
    mesh.visible = progress > 0 && original.mesh.visible;
    for (let i = 0; i < mesh.count; i++) put(mesh, i, 0, 0, 0, 0, 0, 0);
    return mesh;
  };
  const currentStage = () => (kind.startsWith("residual") ? 0 : layerFrame(kind, progress).phase);
  const columnHeight = (c: Column) => {
    const b = active[c.panel]!.block;
    return b.y1 - b.y0;
  };
  const origin = (c: Column) => {
    const item = active[c.panel]!,
      b = item.block,
      spec = stages[currentStage()]!.panels[c.panel]!;
    return new T.Vector3(
      b.x0 + ((c.column + 0.5) / spec.columns) * (b.x1 - b.x0),
      (b.y0 + b.y1) / 2,
      (b.z0 + b.z1) / 2,
    );
  };
  const workTop = kind === "ffn" ? -215 : -58;
  const aligned = (x: number, y: number, z = 12) => {
    const spaced = x * (kind === "ffn" ? 1.8 : graph ? 1.4 : 1);
    return new T.Vector3(spaced, rowY(spaced, y), z);
  };
  const pose = (
    mesh: (typeof pool)[number],
    center: Three.Vector3,
    h: number,
    w = 13.25,
    d = 13.25,
    gap = 0.45,
  ) => {
    for (let i = 0; i < mesh.count; i++)
      put(
        mesh,
        i,
        center.x,
        center.y + h / 2 - ((i + 0.5) * h) / mesh.count,
        center.z,
        w,
        h / mesh.count - gap,
        d,
      );
  };
  const guide = (
    index: number,
    c: Column,
    to: Three.Vector3,
    opacity: number,
    span = 1,
    localHeight = columnHeight(c),
  ) => {
    if (opacity <= 0) return;
    const g = guides[index]!,
      item = active[c.panel]!,
      b = item.block,
      o = origin(c);
    const spec = stages[currentStage()]!.panels[c.panel]!;
    const columnWidth = (span * (b.x1 - b.x0)) / spec.columns;
    o.x += ((span - 1) * (b.x1 - b.x0)) / spec.columns / 2;
    g.outline.position.set(o.x, o.y, b.z1 + 0.8);
    g.outline.scale.set(Math.max(1.4, columnWidth), b.y1 - b.y0, 1);
    const start =
      c.panel === 2
        ? new T.Vector3(b.x1 + 3, (b.y0 + b.y1) / 2, b.z1 + 1)
        : new T.Vector3(o.x, b.y0, b.z1 + 1);
    const end = to.clone().add(new T.Vector3(0, (c.panel === 2 ? -1 : 1) * (localHeight / 2 + 8), 0));
    const lane = (active[0]!.block.x1 + active[2]!.block.x0) / 2;
    g.points = [start, end, new T.Vector3(lane, rowY(lane, 0), 12)];
    g.parameter = item.parameter;
    g.reverse = c.panel === 2;
    g.sourceLabel = item.label;
    g.opacity = opacity;
    const ink = item.mesh.material.uniforms.uCol!.value;
    g.outline.material.color.setRGB(ink.x, ink.y, ink.z, T.SRGBColorSpace).multiplyScalar(0.6);
    g.outline.material.opacity = opacity * 0.65;
    g.outline.visible = true;
    g.path.dataset.tone =
      item.parameter && stages[currentStage()]!.panels[c.panel]!.ink === 1 ? "parameter" : "data";
  };
  const textureResult = (mesh: (typeof pool)[number], amount: number) => {
    mesh.material.uniforms.uCol!.value.lerp(active[2]!.mesh.material.uniforms.uCol!.value, amount);
  };
  const update = () => {
    const stageIndex = currentStage(),
      stage = stages[stageIndex]!;
    channel = Math.min(selectedDimension, stage.outputs[0]!.values.length - 1);
    const frame = layerFrame(kind, progress);
    const t = kind.startsWith("residual") ? progress : frame.amount;
    active = stageItems[stageIndex]!;
    for (const item of items) {
      const isInput = item === active[0];
      const isOutput = item === active[2];
      const isParameter = item === active[1];
      const complete = item.producedAt >= 0 && (item.producedAt < stageIndex || (isOutput && t >= 0.99));
      look.dimOne(
        item.block.id,
        isInput || isParameter
          ? 0.08
          : isOutput
            ? 0.32 * (1 - during(t, 0.84, 0.98))
            : complete
              ? 0.18
              : 0.42,
      );
      item.label.dataset.active = String(progress > 0 && (isInput || isOutput || isParameter));
      item.label.dataset.role = isInput
        ? "source"
        : isOutput
          ? "destination"
          : isParameter
            ? "coefficient"
            : "";
      look.focus(item.block.id, null);
    }
    for (const mesh of pool) mesh.visible = false;
    for (const g of guides) {
      g.opacity = 0;
      g.outline.visible = false;
    }
    overlay.hidden = progress === 0 || progress === 1;
    projection.hidden = progress === 0 || progress === 1 || stage.mode === "weight" || stage.mode === "sum";
    overlay.dataset.mode = stage.mode;
    const extract = during(t, 0, RESIDUAL_TIMING.aligned),
      write = during(t, RESIDUAL_TIMING.write, RESIDUAL_TIMING.end);
    const out = stage.outputs[0]!,
      outH = columnHeight(out);
    const rows = out.values.length,
      groupCount = visibleGroups(rows);
    note.textContent = rows <= 16 ? `每格一维 · 数字显示舍入` : `每段 256 维 · 数字为标号维度的抽样`;
    status.textContent =
      t < 0.22
        ? "整列从原矩阵取出"
        : t < 0.5
          ? "各维度保持对应位置"
          : t < 0.84
            ? "整列参与运算"
            : t < 0.99
              ? "整列回到对应位置"
              : "整列已写回";
    if (stage.mode === "add" || stage.mode === "norm" || stage.mode === "relu") {
      projection.dataset.large = "false";
      const input = stage.inputs[0]!,
        second = stage.inputs[1];
      const isNorm = stage.mode === "norm",
        isRelu = stage.mode === "relu";
      const localHeight = 192;
      const left = origin(input).lerp(aligned(-132, workTop - localHeight / 2), extract);
      const right = second ? origin(second).lerp(aligned(-12, workTop - localHeight / 2), extract) : null;
      const destination = aligned(128, workTop - localHeight / 2).lerp(origin(out), write);
      const a = prepare(0, input),
        b = second ? prepare(1, second) : null,
        result = prepare(2, out);
      const h = T.MathUtils.lerp(columnHeight(input), localHeight, extract);
      const outputHeight = T.MathUtils.lerp(localHeight, outH, write);
      pose(a, left, h, T.MathUtils.lerp(13.25, 40, extract), 13.25, 0.7);
      if (b && right && second) pose(b, right, h, T.MathUtils.lerp(13.25, 40, extract), 13.25, 0.7);
      a.material.uniforms.uDim!.value = b ? 0.22 : 0.08;
      if (b) b.material.uniforms.uDim!.value = 0.22;
      const begun = during(t, 0.38, 0.76);
      for (let g = 0; g < result.count; g++) {
        const amount = during(t, 0.38 + (g / result.count) * 0.23, 0.5 + (g / result.count) * 0.23);
        put(
          result,
          g,
          destination.x,
          destination.y + outputHeight / 2 - ((g + 0.5) * outputHeight) / result.count,
          destination.z,
          T.MathUtils.lerp(40, 13.25, write) * amount,
          outputHeight / result.count - 0.7 * (1 - write),
          13.25,
        );
      }
      guide(0, input, left, during(t, 0.02, 0.06) * (1 - during(t, 0.22, 0.28)), 1, h);
      if (second && right) guide(1, second, right, during(t, 0.02, 0.06) * (1 - during(t, 0.22, 0.28)), 1, h);
      guide(2, out, destination, during(t, 0.82, 0.86) * (1 - write), 1, outputHeight);
      if (t > RESIDUAL_TIMING.write) {
        a.visible = false;
        if (b) b.visible = false;
      }
      const sampleDimensions = Array.from({ length: 8 }, (_, j) => {
        const g = Math.round((j * (groupCount - 1)) / 7);
        return { g, dimension: Math.min(rows - 1, Math.floor(((g + 0.5) * rows) / groupCount)) };
      });
      equations.forEach((cells, j) => {
        const { g, dimension } = sampleDimensions[j]!;
        const y = workTop - ((g + 0.5) * localHeight) / groupCount;
        const computed = t >= 0.5 + (g / groupCount) * 0.23;
        const av = input.values[dimension]!;
        const bv = second?.values[dimension] ?? 0;
        const quotient = isNorm && t > 0.3 ? av / stage.coefficients![0]! : av;
        const texts = [
          String(dimension + 1),
          quotient.toFixed(3),
          isRelu ? "→" : isNorm ? "×" : "+",
          isRelu ? "max(0,x)" : bv.toFixed(3),
          isRelu ? "=" : "≈",
          out.values[dimension]!.toFixed(3),
        ];
        const xs = [-180, -132, -72, -12, 58, 128];
        cells.forEach((cell, i) => {
          cell.node.textContent = texts[i]!;
          cell.at.copy(aligned(xs[i]!, y, 20));
          cell.node.hidden = extract < 0.99 || t > 0.82 || (i >= 4 && !computed);
          cell.node.style.opacity = "1";
        });
      });
      const names = [
        isNorm && t > 0.3 ? "X′ ÷ RMS" : stage.panels[0]!.name,
        isRelu ? "负数变零" : isNorm ? "γ₂ 系数" : stage.panels[1]!.name,
        stage.panels[2]!.name,
        "",
      ];
      [-132, -12, 128, 0].forEach((x, i) => {
        projectionHeaders[i]!.node.textContent = names[i]!;
        projectionHeaders[i]!.at.copy(aligned(x, workTop - localHeight - 24, 20));
        projectionHeaders[i]!.node.hidden = i === 3 || extract < 0.99 || t > 0.82;
      });
      projectionTitle.textContent = `「${WORDS[word]}」的整列 ${rows.toLocaleString()} 维 · ${isNorm ? "先除 RMS，再乘 γ₂" : isRelu ? "槽位不变，负数置零" : "逐维对应相加"}`;
      projectionSum.textContent = isNorm
        ? `RMS(X′) = ${formatLayerValue(stage.coefficients![0]!)} · 从本列全部 ${rows.toLocaleString()} 维重算`
        : isRelu
          ? "max(0, x)：负数变成 0，正数保持原值，维度不删除"
          : `${stage.panels[0]!.name} + ${stage.panels[1]!.name} = ${stage.panels[2]!.name}`;
      projectionSum.dataset.complete = String(begun === 1);
      status.textContent =
        t < 0.22
          ? "从原矩阵取出同一位置的完整列"
          : t < 0.38
            ? isNorm
              ? "整列共用自己的 RMS，先逐维相除"
              : "整列按维度排齐，数字标注对应的维度编号"
            : t < 0.82
              ? isRelu
                ? "整列逐维经过 ReLU；零仍占据原来的维度槽位"
                : isNorm
                  ? "归一化后的每一维乘各自 γ₂，生成 N₂"
                  : "对应两维相加，结果从上到下组成完整新列"
              : t < 0.99
                ? "保持维度顺序，结果整列回到同一位置"
                : "整列已写回；此结果交给下一段计算";
      note.textContent = `整列 ${rows.toLocaleString()} 维全部参与 · 每段 ${rows / groupCount} 维 · 行内数字为标出维度的抽样值`;
    } else {
      if (projectedStage !== stage || projectedChannel !== channel) {
        projectedStage = stage;
        projectedChannel = channel;
        projectedTerms = projectionTerms(stage, channel);
        projectedGroups = kind === "ffn" ? projectionGroups(stage, channel) : [];
      }
      const large = kind === "ffn";
      projection.dataset.large = String(large);
      const inputX = large ? -180 : -146,
        weightX = large ? -60 : -58,
        productX = large ? 60 : 31,
        outputX = large ? 180 : 143;
      const input = stage.inputs[0]!,
        terms = large
          ? projectedGroups.map((g) => ({ input: 0, weight: 0, product: g.sum }))
          : projectedTerms,
        localHeight = large ? 224 : 252,
        take = during(t, 0, 0.18),
        returnColumn = during(t, 0.91, 0.99),
        sweep = during(t, 0.76, 0.9);
      const from = origin(input).lerp(aligned(inputX, workTop - localHeight / 2), take);
      const batch = !large && t > 0.75 && t < 0.91;
      // Batch the remaining dimensions visually; each uses a different parameter column.
      const batchIndex = Math.min(rows - 2, Math.floor(sweep * (rows - 1)));
      const weight: Column = {
        panel: 1,
        column: batch ? batchIndex + (batchIndex >= channel ? 1 : 0) : channel,
        values: input.values,
      };
      const weightsAt = origin(weight).lerp(aligned(weightX, workTop - localHeight / 2), take);
      // The magnified output is a complete column; the highlighted slot is one scalar in it.
      const outputHeight = T.MathUtils.lerp(large ? outH : localHeight, outH, returnColumn);
      const outputAt = aligned(outputX, workTop - (large ? outH : localHeight) / 2).lerp(
        origin(out),
        returnColumn,
      );
      const slotY = outputAt.y + outputHeight / 2 - ((channel + 0.5) / rows) * outputHeight;
      const inputMesh = prepare(0, input),
        weightMesh = prepare(1, weight),
        products = prepare(2, input);
      const outputMesh = prepare(3, out),
        ghost = prepare(4, out),
        selected = prepare(5, out),
        destination = prepare(6, out);
      if (large)
        for (const mesh of [inputMesh, weightMesh, products]) {
          mesh.count = 8;
          mesh.material.uniforms.groupCount!.value = 8;
        }
      const inputHeight = T.MathUtils.lerp(columnHeight(input), localHeight, take);
      const weightHeight = T.MathUtils.lerp(columnHeight(weight), localHeight, take);
      pose(inputMesh, from, inputHeight, T.MathUtils.lerp(13.25, 39, take), 13.25, 1.5);
      pose(weightMesh, weightsAt, weightHeight, T.MathUtils.lerp(1.2, 39, take), 13.25, 1.5);
      inputMesh.material.uniforms.uDim!.value = 0.3;
      weightMesh.material.uniforms.uDim!.value = 0.3;
      textureResult(products, 1);
      ghost.material.uniforms.uDim!.value = 0.5;
      pose(ghost, outputAt, outputHeight);
      let arrived = 0,
        total = 0;
      terms.forEach((term, j) => {
        const rowHeight = localHeight / terms.length;
        const y = workTop - (j + 0.5) * rowHeight;
        const multiply = during(t, 0.22 + j * 0.01, 0.34 + j * 0.01);
        const reduce = during(t, 0.45 + j * 0.017, 0.57 + j * 0.017);
        const at = aligned(T.MathUtils.lerp(weightX, productX, multiply), y).lerp(
          new T.Vector3(outputAt.x, slotY, outputAt.z),
          reduce,
        );
        put(
          products,
          j,
          at.x,
          at.y,
          at.z,
          multiply > 0 && reduce < 1 ? 39 * (1 - reduce * 0.7) : 0,
          (rowHeight - 1.5) * (1 - reduce * 0.8),
          13.25,
        );
        if (reduce === 1) {
          arrived++;
          total += term.product;
        }
        const cells = equations[j]!;
        const texts = [
          String(j + 1),
          term.input.toFixed(3),
          "×",
          term.weight.toFixed(3),
          "≈",
          term.product.toFixed(3),
        ];
        if (large) {
          const range = projectedGroups[j]!;
          texts[0] = "";
          texts[1] = `${range.start + 1}–${range.end}`;
          texts[2] = "·";
          texts[3] = `${range.start + 1}–${range.end}`;
          texts[4] = "Σ→";
        }
        const xs = [-184, inputX, -102, weightX, -14, productX];
        cells.forEach((cell, i) => {
          cell.node.textContent = texts[i]!;
          cell.at.copy(aligned(xs[i]!, y, 20));
          cell.node.hidden =
            take < 0.99 || t > 0.75 || (i >= 4 && multiply < 0.95) || (large && [0, 2, 4].includes(i));
          if (i === 5) {
            cell.at.copy(at).add(new T.Vector3(0, 0, 8));
            cell.node.style.opacity = String(1 - during(reduce, 0.05, 0.45));
          }
          if (i === 4) cell.node.style.opacity = String(1 - reduce);
        });
      });
      for (let j = 0; j < outputMesh.count; j++)
        put(
          outputMesh,
          j,
          outputAt.x,
          outputAt.y + outputHeight / 2 - ((j + 0.5) * outputHeight) / outputMesh.count,
          outputAt.z,
          sweep > j / outputMesh.count ? 13.25 : 0,
          outputHeight / outputMesh.count - 0.35,
          13.25,
        );
      selected.count = 1;
      put(selected, 0, outputAt.x, slotY, outputAt.z + 0.5, arrived ? 16 : 0, 2.4, 15);
      selected.material.uniforms.uDiv!.value.set(1, 1, 1);
      selected.material.uniforms.uFine!.value.set(1, 1, 1);
      selected.material.uniforms.uNoise!.value = 0;
      const destinationAt = origin(out);
      destination.count = 1;
      put(
        destination,
        0,
        destinationAt.x,
        destinationAt.y + outH / 2 - ((channel + 0.5) / rows) * outH,
        active[out.panel]!.block.z1 + 1,
        16,
        2.4,
        1,
      );
      destination.material.uniforms.uDiv!.value.set(1, 1, 1);
      destination.material.uniforms.uFine!.value.set(1, 1, 1);
      destination.material.uniforms.uNoise!.value = 0;
      guide(0, input, from, during(t, 0.02, 0.06) * (1 - during(t, 0.18, 0.24)), 1, inputHeight);
      guide(1, weight, weightsAt, during(t, 0.02, 0.06) * (1 - during(t, 0.18, 0.24)), 1, weightHeight);
      guide(2, out, outputAt, during(t, 0.91, 0.94) * (1 - returnColumn), 1, outputHeight);
      if (t > (large ? 0.75 : 0.91)) {
        inputMesh.visible = weightMesh.visible = false;
      }
      if (t >= 0.99) {
        ghost.visible = false;
      }
      const headerText = large
        ? [
            stageIndex === 1 ? "N₂ 的整列" : "H₊ 的整列",
            `${stageIndex === 1 ? "W₁" : "W₂"} 的一列`,
            "各段乘积和",
            stageIndex === 1 ? "H 结果列" : "ΔF 结果列",
          ]
        : [
            "汇总列\n8 维",
            batch ? "Wₒ 其余列\n逐批换用" : "Wₒ 一列\n8 个系数",
            "逐项相乘\n8 个乘积",
            "ΔA 整列\n4,096 维",
          ];
      [inputX, weightX, productX, outputX].forEach((x, i) => {
        const label = projectionHeaders[i]!;
        label.node.textContent = headerText[i]!;
        label.at.copy(aligned(x, large ? workTop - Math.max(localHeight, outH) - 24 : workTop + 12, 20));
        label.node.hidden = take < 0.99 || (t > 0.75 && (large || i === 2)) || t > 0.91;
      });
      projectionTitle.textContent =
        t < 0.71
          ? `① 先算一个数：8 维汇总 × Wₒ 的一列 → ΔA 第 ${channel + 1} 维`
          : t < 0.91
            ? "② 换用 Wₒ 的其余列 → 算齐 4,096 维的 ΔA"
            : "③ 把完整 ΔA 列写回当前位置 → 下一段与 X 相加";
      projectionSum.textContent =
        t < 0.43
          ? "同一高度的两个数相乘，得到一整列 8 个乘积"
          : t < 0.71
            ? `Σ ${arrived} / 8 项 ≈ ${formatLayerValue(total)}`
            : `Σ 8 项 ≈ ${formatLayerValue(out.values[channel]!)} →「${WORDS[word]}」的 ΔA 第 ${channel + 1} 维`;
      projectionSum.dataset.complete = String(arrived === 8);
      status.textContent =
        t >= 0.99
          ? "整列已写回：仅更新当前位置，其他位置各自计算"
          : t < 0.16
            ? "保持这同一列汇总，取出 Wₒ 中对应输出维度的一整列"
            : t < 0.43
              ? "8 对数字逐维相乘：每个输入维度都参与"
              : t < 0.71
                ? "8 个乘积沿输入维求和，写入标出的一个输出维度"
                : t < 0.91
                  ? "其余 4,095 维各用不同权重列计算；这里分批展示，左侧 8 维输入保持不变"
                  : "完整输出列回到 ΔA 中的原位置";
      note.textContent =
        "左侧每格 1 维；右侧每段 256 维，亮线标出一个输出维度。列高为阅读放大，不表示维数比例。";
      if (large) {
        projectionTitle.textContent = `「${WORDS[word]}」· 全部 ${input.values.length.toLocaleString()} 维参与，计算${stageIndex === 1 ? " H" : " ΔF"} 第 ${channel + 1} 维`;
        projectionSum.textContent =
          t < 0.43
            ? `第 1 维示例：${formatLayerValue(projectedTerms[0]!.input)} × ${formatLayerValue(projectedTerms[0]!.weight)} ≈ ${formatLayerValue(projectedTerms[0]!.product)}；该段共 ${input.values.length / 8} 项`
            : t < 0.71
              ? `已汇入 ${arrived} / 8 段 · ${(arrived * input.values.length) / 8} 个乘积 · Σ ≈ ${formatLayerValue(total)}`
              : `全部 ${input.values.length.toLocaleString()} 个乘积求和 ≈ ${formatLayerValue(out.values[channel]!)} → 第 ${channel + 1} 维`;
        status.textContent =
          t < 0.16
            ? "取出输入整列，以及对应一个输出维的完整权重列"
            : t < 0.43
              ? "两列对应维度相乘；每段的所有乘积形成一个部分和"
              : t < 0.71
                ? "八段依次汇入同一个槽位，整列输入没有遗漏"
                : t < 0.91
                  ? `其余 ${(rows - 1).toLocaleString()} 个输出维各用自己的权重列，组成 ${rows.toLocaleString()} 维结果`
                  : t < 0.99
                    ? "完整结果列写回原位置，准备交给下一步"
                    : "整列已写回；结果成为下一步的输入";
        note.textContent = `左两列标注维度范围 · 每段 ${input.values.length / 8} 对数相乘、求和`;
      }
    }
    // Keep the action sentence. An extra equation appears only when it adds
    // a numeric result, rather than repeating the current instruction.
    projectionSum.hidden = stage.mode === "project" ? t < 0.18 : stage.mode !== "norm";
    // Completion is the written matrix, not a second copy left in the work area.
    if (progress === 1) {
      for (const mesh of pool) mesh.visible = false;
      for (const g of guides) {
        g.opacity = 0;
        g.outline.visible = false;
      }
    }
    for (const mesh of pool) if (mesh.visible) mesh.instanceMatrix.needsUpdate = true;
    render();
  };
  const corners = (b: PartBlock) =>
    [b.x0, b.x1].flatMap((x) => [b.y0, b.y1].flatMap((y) => [b.z0, b.z1].map((z) => new T.Vector3(x, y, z))));
  const matrixCorners = items.flatMap((item) => corners(item.block));
  const bound = new T.Box3().setFromPoints(matrixCorners);
  const graphWorkCorners = [-215, 215].flatMap((x) =>
    [workTop + 20, workTop - 260].flatMap((y) => [0, 30].map((z) => aligned(x, y, z))),
  );
  const fullBound = bound
    .clone()
    .expandByPoint(new T.Vector3(0, workTop - (kind === "ffn" ? 212 : 106) - 48, 26));
  fullBound.expandByPoint(new T.Vector3(-215, workTop - 220, 26));
  fullBound.expandByPoint(new T.Vector3(215, workTop - 220, 26));
  const center = bound.getCenter(new T.Vector3());
  const direction = new T.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  );
  const project = (at: Three.Vector3) => {
    const p = at.clone().project(camera);
    return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 };
  };
  const render = () => {
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    if (!projection.hidden)
      for (const label of projectionLabels) {
        if (label.node.hidden) continue;
        const p = project(label.at);
        label.node.style.left = `${p.x}px`;
        label.node.style.top = `${p.y}px`;
      }
    const headings = projectionHeaders.filter((label) => !label.node.hidden);
    for (const label of headings) {
      const x = project(label.at).x;
      const gap = Math.min(
        ...headings.filter((other) => other !== label).map((other) => Math.abs(project(other.at).x - x)),
      );
      label.node.style.width = `${Math.max(36, Math.min(112, gap - 12))}px`;
    }
    for (const item of items) {
      if (item.label.hidden) continue;
      const points = corners(item.block).map(project);
      const left = Math.min(...points.map((p) => p.x)),
        right = Math.max(...points.map((p) => p.x)),
        top = Math.min(...points.map((p) => p.y));

      const w = graph ? Math.min(84, width / (dataCount + 3)) : Math.min(115, width * 0.17);
      item.label.style.width = `${w}px`;
      item.label.style.left = `${Math.max(4, Math.min(width - w - 4, (left + right - w) / 2))}px`;
      // Data names share a baseline below the tallest tensor. Parameter slabs must
      // never sit behind a data heading, even when W₂ is twice as tall as W₁.
      const dataBaseline = project(
        new T.Vector3(
          (item.block.x0 + item.block.x1) / 2,
          rowY((item.block.x0 + item.block.x1) / 2, kind === "ffn" ? -124 : -40),
          0,
        ),
      ).y;
      item.label.style.top = `${Math.max(4, graph && !item.parameter ? dataBaseline : top - (graph ? 54 : item.label.offsetHeight + 10))}px`;
    }
    // Route in screen space: every elbow has the same radius under rotation.
    for (const g of guides) {
      g.outline.material.resolution.set(width, height);
      g.path.style.opacity = "0";
      if (!g.opacity || g.points.length === 0) continue;
      const [start, end, gate] = g.points.map(project);
      if (!start || !end || !gate || end.y - start.y < 24) continue;
      const laneY = end.y - 8;
      // Bypass the data label, not its center. Leave its reading area clear.
      const labelLeft = Number.parseFloat(g.sourceLabel!.style.left);
      const labelWidth = Number.parseFloat(g.sourceLabel!.style.width);
      const laneX = g.parameter ? gate.x : g.reverse ? labelLeft + labelWidth + 12 : labelLeft - 12;
      const labelTop = Number.parseFloat(g.sourceLabel!.style.top);
      const shoulderY = start.y + (g.parameter ? 12 : Math.max(2, Math.min(12, (labelTop - start.y) / 2)));
      const points = g.reverse
        ? [start, { x: laneX, y: start.y }, { x: laneX, y: laneY }, { x: end.x, y: laneY }, end]
        : [
            start,
            { x: start.x, y: shoulderY },
            { x: laneX, y: shoulderY },
            { x: laneX, y: laneY },
            { x: end.x, y: laneY },
            end,
          ];
      if (g.reverse) points.reverse();
      let d = `M ${points[0]!.x} ${points[0]!.y}`;
      for (let i = 1; i < points.length - 1; i++) {
        const a = points[i - 1]!,
          b = points[i]!,
          c = points[i + 1]!;
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        const after = Math.hypot(c.x - b.x, c.y - b.y);
        if (before < 0.01 || after < 0.01) {
          d += ` L ${b.x} ${b.y}`;
          continue;
        }
        const radius = Math.min(10, before / 2, after / 2);
        d += ` L ${b.x + ((a.x - b.x) * radius) / before} ${b.y + ((a.y - b.y) * radius) / before}`;
        d += ` Q ${b.x} ${b.y} ${b.x + ((c.x - b.x) * radius) / after} ${b.y + ((c.y - b.y) * radius) / after}`;
      }
      const last = points.at(-1)!;
      g.path.setAttribute("d", `${d} L ${last.x} ${last.y}`);
      g.path.style.opacity = String(g.opacity * 0.75);
    }
  };
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    renderer.setSize(width, height, false);
    const fitBound = fullBound;
    const next = fitBound.getCenter(new T.Vector3());
    camera.position.add(next.clone().sub(center));
    center.copy(next);
    controls.target.copy(center);
    controls.update();
    const view = camera.clone();
    view.position.copy(center).addScaledVector(direction, 1000);
    view.lookAt(center);
    view.zoom = 1;
    view.left = -width / 2;
    view.right = width / 2;
    view.top = height / 2;
    view.bottom = -height / 2;
    view.updateProjectionMatrix();
    view.updateMatrixWorld(true);
    // Reserve separate screen space for labels above the graph and arithmetic below it.
    const topInset = graph ? 104 : 65;
    const bottomInset = graph ? 100 : 90;
    const verticalFit = (height - topInset - bottomInset) / height;
    let fit = 0;
    if (graph) {
      // Fit occupied geometry, not empty corners introduced by an axis-aligned world box.
      const points = [...matrixCorners, ...graphWorkCorners].map((point) => point.clone().project(view));
      const minX = Math.min(...points.map((point) => point.x)),
        maxX = Math.max(...points.map((point) => point.x)),
        minY = Math.min(...points.map((point) => point.y)),
        maxY = Math.max(...points.map((point) => point.y));
      fit = Math.max((maxX - minX) / 1.8, (maxY - minY) / (2 * verticalFit));
      view.left += ((minX + maxX) * width) / 4;
      view.right += ((minX + maxX) * width) / 4;
      view.top += ((minY + maxY) * height) / 4;
      view.bottom += ((minY + maxY) * height) / 4;
    } else {
      for (const x of [fitBound.min.x, fitBound.max.x])
        for (const y of [fitBound.min.y, fitBound.max.y])
          for (const z of [fitBound.min.z, fitBound.max.z]) {
            const p = new T.Vector3(x, y, z).project(view);
            fit = Math.max(fit, Math.abs(p.x) / 0.9, Math.abs(p.y) / verticalFit);
          }
    }
    view.zoom = 1 / fit;
    const frameOffset = (graph ? topInset - bottomInset : bottomInset - topInset) / 2 / view.zoom;
    view.top += frameOffset;
    view.bottom += frameOffset;
    Object.assign(camera, {
      left: view.left,
      right: view.right,
      top: view.top,
      bottom: view.bottom,
      zoom: view.zoom,
    });
    camera.updateProjectionMatrix();
    render();
  };
  const resetView = () => {
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, 1000);
    camera.lookAt(center);
    controls.update();
    render();
  };
  const lost = (event: Event) => {
    event.preventDefault();
    onError();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  controls.addEventListener("change", render);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resetView();
  resize();
  update();
  return {
    seek(value, selectedWord, selectedChannel) {
      if (selectedWord !== word) {
        word = selectedWord;
        stages = columnStages(data, kind, word);
      }
      selectedDimension = selectedChannel;
      progress = value;
      update();
    },
    resetView,
    dispose() {
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      for (const item of items) {
        item.mesh.geometry.dispose();
        item.mesh.material.dispose();
      }
      for (const mesh of pool) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      for (const g of guides) {
        g.outline.geometry.dispose();
        g.outline.material.dispose();
      }
      wires.remove();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labels.remove();
      overlay.remove();
    },
  };
}
