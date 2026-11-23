import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { pointAlongComputePath } from "./scene-compute-motion";
import { scenePalette } from "./scene-palette";
import {
  residualEase as ease,
  RESIDUAL_EXAMPLE as ex,
  residualNumber as fmt,
  residualMotion,
  residualRoute as route,
} from "./scene-residual-data";

type Vector = {
  group: T.Group;
  cells: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>[];
  numbers: HTMLElement[];
  title: HTMLElement;
  values: number[];
  gap: number;
};
type Label = { el: HTMLElement; parent: T.Object3D; point: T.Vector3; visible: () => boolean };
const v = (x: number, y: number, z = 0) => new T.Vector3(x, y, z);
// Mineral palette for the 4 residual streams: Cobalt, Cinnabar-Coral, Amethyst, Celadon-Jade.
const routeColors = ["#85a9ec", "#e0948b", "#a698dc", "#78c8b0"];

/** The depth axis is the residual-stream axis. Only equal channel coordinates are reduced. */
export function mountResidualScene(host: HTMLDivElement, step: number, signal: AbortSignal) {
  if (signal.aborted) return null;
  const cssPalette = scenePalette(host),
    palette = {
      ...cssPalette,
      paper: "#fbfaf6",
      ink: cssPalette.ink || "#17211f",
      data: "#85a9ec",
      weight: "#e0948b",
      result: "#78c8b0",
      line: "#6f7a75",
    },
    scene = new T.Scene(),
    root = new T.Group();
  scene.background = new T.Color(palette.paper);
  scene.add(root, new T.HemisphereLight(0xffffff, 0xc6c9ba, 2.4));
  const light = new T.DirectionalLight(0xffffff, 2);
  light.position.set(-7, 9, 18);
  scene.add(light);
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(palette.paper, 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  const stage = document.createElement("div"),
    overlay = document.createElement("div"),
    key = document.createElement("div");
  stage.className = "wiki-residual-stage";
  overlay.className = "wiki-residual-labels";
  key.className = "wiki-residual-key";
  key.textContent = "同一个 token · 每条 1×4 向量 · 横向 c0–c3 · 四层为四路残差";
  stage.append(renderer.domElement, overlay, key);
  host.append(stage);
  host.dataset.compute = "residual";
  host.dataset.step = String(step);
  const camera = new T.OrthographicCamera(-8, 8, 7, -7, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = controls.enableZoom = false;
  controls.rotateSpeed = 0.3;
  controls.minPolarAngle = 1.14;
  controls.maxPolarAngle = 1.4;
  controls.minAzimuthAngle = 0.03;
  controls.maxAzimuthAngle = 0.28;
  const box = new T.BoxGeometry(1, 1, 1),
    edge = new T.EdgesGeometry(box);
  const materials: T.Material[] = [],
    geometries: T.BufferGeometry[] = [box, edge],
    labels: Label[] = [];
  let width = 1,
    height = 1,
    progress = 0,
    disposed = false;
  const mat = (color: string) => {
    const m = new T.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.04, transparent: true });
    materials.push(m);
    return m;
  };
  const label = (
    text: string,
    parent: T.Object3D,
    point: T.Vector3,
    kind = "title",
    visible = () => true,
  ) => {
    const el = document.createElement("span");
    el.className = `wiki-residual-label ${kind}`;
    el.textContent = text;
    overlay.append(el);
    labels.push({ el, parent, point, visible });
    return el;
  };
  const vector = (
    values: number[],
    title: string,
    color: string,
    point: T.Vector3,
    size = 0.83,
    gap = size >= 0.85 ? 0.065 : 0.035,
  ): Vector => {
    const group = new T.Group();
    group.position.copy(point);
    root.add(group);
    const cells: Vector["cells"] = [],
      numbers: HTMLElement[] = [];
    values.forEach((n, c) => {
      const mesh = new T.Mesh(box, mat(color));
      mesh.scale.set(size, size * 0.69, size * 0.65);
      mesh.position.x = (c - (values.length - 1) / 2) * (size + gap);
      group.add(mesh);
      cells.push(mesh);
      const outlineMat = new T.LineBasicMaterial({
        color: new T.Color(color).multiplyScalar(0.62),
        transparent: true,
        opacity: 0.78,
      });
      materials.push(outlineMat);
      const outline = new T.LineSegments(edge, outlineMat);
      outline.scale.setScalar(1.015);
      mesh.add(outline);
      numbers.push(
        label(
          fmt(n),
          mesh,
          v(0, 0, 0.505),
          size < 0.65 ? "number miniature" : "number",
          () => group.visible && mesh.material.opacity > 0.05,
        ),
      );
    });
    const titleEl = label(
      title,
      group,
      v(0, (size * 0.69) / 2 + 0.3, 0.2),
      size < 0.65 ? "title miniature" : "title",
      () => group.visible,
    );
    return { group, cells, numbers, title: titleEl, values, gap };
  };
  const show = (item: Vector, amount: number, values?: (number | string)[]) => {
    item.group.visible = amount > 0.015;
    item.cells.forEach((cell, i) => {
      const empty = values?.[i] === "?";
      cell.material.opacity = Math.max(0, amount) * (empty ? 0.24 : 1);
      item.numbers[i]!.style.color = palette.ink;
      if (values)
        item.numbers[i]!.textContent =
          typeof values[i] === "number" ? fmt(values[i] as number) : String(values[i]);
      item.numbers[i]!.dataset.long = String((item.numbers[i]!.textContent?.length ?? 0) >= 5);
    });
  };
  const tint = (item: Vector, color: string, active = false) => {
    item.cells.forEach((cell) => {
      cell.material.color.set(color);
      cell.material.emissive.set(color);
      cell.material.emissiveIntensity = active ? 0.2 : 0;
    });
    item.title.dataset.active = String(active);
  };
  const link = (color: string, opacity = 0.6, dashed = false) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(15), 3));
    geometries.push(geometry);
    const material = dashed
      ? new T.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.12, gapSize: 0.1 })
      : new T.LineBasicMaterial({ color, transparent: true, opacity });
    materials.push(material);
    const line = new T.Line(geometry, material);
    root.add(line);
    return (a: T.Vector3, b: T.Vector3, amount = opacity, bend = 0, via?: T.Vector3[]) => {
      const points = geometry.getAttribute("position") as T.BufferAttribute;
      points.setXYZ(0, a.x, a.y, a.z);
      points.setXYZ(1, a.x + (b.x - a.x) * 0.34, a.y + (b.y - a.y) * 0.34 + bend, a.z + (b.z - a.z) * 0.34);
      points.setXYZ(2, a.x + (b.x - a.x) * 0.66, a.y + (b.y - a.y) * 0.66 + bend, a.z + (b.z - a.z) * 0.66);
      points.setXYZ(3, b.x, b.y, b.z);
      points.setXYZ(4, b.x, b.y, b.z);
      if (via) {
        const path = [a, ...via, b];
        for (let i = 0; i < 5; i++) {
          const point = path[Math.min(i, path.length - 1)]!;
          points.setXYZ(i, point.x, point.y, point.z);
        }
      }
      points.needsUpdate = true;
      geometry.computeBoundingSphere();
      if (dashed) line.computeLineDistances();
      material.opacity = amount;
      line.visible = amount > 0.01;
    };
  };
  const port = (item: Vector, side: number) => {
    item.group.updateWorldMatrix(true, false);
    return item.group.localToWorld(
      v((side * (item.values.length * (item.cells[0]!.scale.x + item.gap) - item.gap)) / 2, 0, 0),
    );
  };
  const connect = (a: Vector, b: Vector, color: string, opacity = 0.4) => {
    const update = link(color, opacity);
    update(port(a, 1), port(b, -1));
  };
  const fullInputs = ex.input.map((row, i) =>
    vector(row, route(i), routeColors[i]!, v(-5.65, 4.65 - i * 0.72, (1.5 - i) * 0.26), 0.53),
  );
  label(
    step === 0 ? "子层入口 · 四路保留，一路送入计算" : "子层出口 · 两条支路，一起写回四路",
    root,
    v(0, 6.4),
    "context",
  );
  const topCaption = label("", root, v(0, 1.7), "caption");
  const focusCaption = label("", root, v(0, 1.06), "focus");
  const sourcePositions = ex.input.map((_, i) => v(-4.95, -0.65 - i * 0.86, (i - 1.5) * 1.0));
  const sources = ex.input.map((row, i) => vector(row, route(i), routeColors[i]!, sourcePositions[i]!));
  const routeTag = (item: Vector, x: number) => {
    labels.find((label) => label.el === item.title)!.point.set(x, 0, 0.2);
  };
  fullInputs.forEach((item) => {
    routeTag(item, -1.5);
  });
  sources.forEach((item) => {
    routeTag(item, -2.1);
  });
  const coefficients = ex.pre.map((n, i) =>
    vector([n], "× 合成系数", palette.weight, v(-2.75, sourcePositions[i]!.y, sourcePositions[i]!.z), 0.68),
  );
  const contributions = ex.input.map((row, i) =>
    vector(
      row.map((n) => n / 4),
      "",
      routeColors[i]!,
      v(-0.05, sourcePositions[i]!.y, sourcePositions[i]!.z),
      0.92,
    ),
  );
  const operandLinks = ex.input.map((_, i) => [link(routeColors[i]!), link(routeColors[i]!)]);
  const extraction = [link(palette.weight, 0.3, true), link(palette.weight, 0.3, true)];
  const receipt = link(palette.result, 0.8);
  const sourceFrame = new T.LineSegments(
    edge,
    new T.LineBasicMaterial({ color: palette.line, transparent: true, opacity: 0.48 }),
  );
  materials.push(sourceFrame.material);
  sourceFrame.position.set(-5.65, 3.57, 0);
  sourceFrame.scale.set(2.8, 3.4, 1.2);
  root.add(sourceFrame);
  let animate: (p: number) => void;
  if (step === 0) {
    const collapsed = vector(ex.merged, "按 pre 系数合成", palette.result, v(-2.1, 3.5), 0.64);
    const normalized = vector(ex.normalized, "RMSNorm", palette.result, v(1.25, 3.5), 0.78);
    normalized.numbers.forEach((number) => {
      number.classList.add("miniature");
    });
    const sublayer = vector(
      ex.merged.map(() => 0),
      "注意力 / 前馈",
      palette.weight,
      v(4.7, 3.5),
      0.68,
    );
    sublayer.numbers.forEach((n) => {
      n.textContent = "·";
    });
    fullInputs.forEach((input, i) => {
      connect(input, collapsed, routeColors[i]!, 0.3);
    });
    connect(collapsed, normalized, palette.line);
    connect(normalized, sublayer, palette.line);
    // The frame carries the four unchanged streams as a bundle, below the compute branch.
    ex.input.forEach((_, i) => {
      const y = 2.05 + i * 0.07;
      link(routeColors[i]!, 0.24)(v(-4.875, y, -0.6), v(5.5, y, -0.6));
    });
    topCaption.textContent = "四路沿旁路保留 → 出口再混合";
    const sum = vector(
      ex.merged.map(() => 0),
      "同通道累加",
      palette.result,
      v(3.95, -4.25),
      0.94,
    );
    const reductionLabel = label("四份贡献沿同一列相加", root, v(3.95, 0), "title");
    const reduceLink = link(palette.result, 0.5);
    const squared = ex.merged.map((n) => n * n);
    const square = vector(squared, "逐格平方", palette.data, v(-0.8, -1.55), 0.83);
    const mean = vector([ex.rms ** 2], "相加 ÷ 4", palette.data, v(2.45, -1.55), 0.94);
    const rms = vector([ex.rms], "均方根 RMS", palette.weight, v(5.1, -1.55), 1.15);
    const out = vector(ex.normalized, "整行 ÷ RMS × γ · 1×4", palette.result, v(2.7, -4.2), 0.83);
    const write = vector(ex.normalized, "", palette.result, out.group.position.clone(), 0.83);
    const normLinks = [
      link(palette.line),
      link(palette.line),
      link(palette.line),
      link(palette.result),
      link(palette.result),
    ];
    const squareCards = ex.merged.map((n, i) =>
      vector([n * n], "", palette.data, v(-0.8 + (i - 1.5) * 0.865, -1.55, 1.1), 0.83),
    );
    animate = (p) => {
      const m = residualMotion(0, p),
        norm = ease(p, 0.55, 0.62),
        expand = m.unfold;
      host.dataset.residualPhase = String(m.phase);
      host.dataset.residualWritten = String(m.written);
      focusCaption.textContent =
        m.phase < 2 ? "4×4 四路输入 · 同一列相加，保留四个通道" : "1×4 合成向量 → 1×4 归一化向量";
      sources.forEach((item, i) => {
        item.group.position.lerpVectors(fullInputs[i]!.group.position, sourcePositions[i]!, expand);
        item.group.scale.setScalar(0.64 + 0.36 * expand);
        show(item, (1 - norm) * expand);
        item.title.style.visibility = expand >= 0.95 ? "visible" : "hidden";
        item.numbers.forEach((number) => {
          number.style.visibility = expand >= 0.95 ? "visible" : "hidden";
        });
        tint(item, routeColors[i]!, m.row === i && m.phase === 1);
        show(coefficients[i]!, (1 - norm) * expand);
        coefficients[i]!.numbers[0]!.textContent = "¼";
        const local = Math.max(0, Math.min(1, ((p - 0.12) / 0.42) * 4 - i));
        const product = contributions[i]!,
          home = v(-0.05, sourcePositions[i]!.y, sourcePositions[i]!.z);
        product.group.position.lerpVectors(item.group.position, home, ease(local, 0.06, 0.38));
        product.group.position.lerp(v(3.95, -2.1 - i * 0.12, (i - 1.5) * 0.85), ease(local, 0.55, 0.95));
        show(product, (local > 0.02 ? 1 : 0) * (1 - norm));
        product.title.textContent = local >= 0.38 && local < 0.8 ? `${route(i)} × ¼` : "";
        product.numbers.forEach((number) => {
          number.style.visibility = local >= 0.38 && local < 0.8 ? "visible" : "hidden";
        });
        operandLinks[i]![0]!(
          port(item, 1),
          port(coefficients[i]!, -1),
          ease(expand, 0.85, 1) * (1 - norm) * (m.row === i ? 0.65 : 0.16),
        );
        operandLinks[i]![1]!(
          port(coefficients[i]!, 1),
          port(product, -1),
          ease(local, 0.28, 0.38) * (1 - ease(local, 0.6, 0.78)) * (1 - norm) * 0.5,
        );
      });
      reductionLabel.style.opacity = String(expand * (1 - norm));
      reduceLink(v(3.95, -2.9, 0), v(3.95, -3.78, 0), expand * (1 - norm) * 0.5);
      sum.group.position.lerpVectors(v(3.95, -4.25), v(-4.65, -1.55), norm);
      sum.title.textContent = norm > 0.5 ? "合成的一路" : `累计 ${m.contributions}/4 路`;
      show(
        sum,
        expand,
        m.phase < 2
          ? ex.merged.map((_, c) => ex.input.slice(0, m.contributions).reduce((s, row) => s + row[c]! / 4, 0))
          : ex.merged,
      );
      show(collapsed, 1, p >= 0.54 ? ex.merged : ex.merged.map(() => "?"));
      show(normalized, 1, m.written ? ex.normalized : ex.merged.map(() => "?"));
      normalized.numbers.forEach((number) => {
        number.style.visibility = m.write > 0.7 && m.write < 1 ? "hidden" : "visible";
      });
      tint(collapsed, palette.result, m.phase === 1);
      tint(normalized, palette.result, m.phase === 3);
      show(square, ease(p, 0.59, 0.66), p >= 0.66 ? squared : squared.map(() => "?"));
      squareCards.forEach((card, c) => {
        card.group.position.lerpVectors(
          v(-4.55 + (c - 1.5) * 0.865, -1.55, 0.4),
          v(-0.8 + (c - 1.5) * 0.865, -1.55, 0),
          ease(p, 0.6, 0.66),
        );
        show(card, p >= 0.59 && p < 0.66 ? 1 : 0);
      });
      show(mean, ease(p, 0.65, 0.69), p >= 0.69 ? [ex.rms ** 2] : ["?"]);
      show(rms, ease(p, 0.69, 0.73), p >= 0.73 ? [ex.rms] : ["?"]);
      show(out, ease(p, 0.77, 0.84), p >= 0.84 ? ex.normalized : ex.merged.map(() => "?"));
      normLinks[0]!(port(sum, 1), port(square, -1), norm * 0.45);
      normLinks[1]!(port(square, 1), port(mean, -1), norm * 0.45);
      normLinks[2]!(port(mean, 1), port(rms, -1), norm * 0.45);
      normLinks[3]!(
        sum.group.position.clone().add(v(0, -0.45)),
        port(out, -1),
        ease(p, 0.75, 0.8) * 0.55,
        -0.45,
      );
      normLinks[4]!(
        rms.group.position.clone().add(v(0, -0.45)),
        out.group.position.clone().add(v(0, 0.45)),
        ease(p, 0.75, 0.8) * 0.55,
      );
      const returnPath = [
        out.group.position.clone(),
        v(6.3, -4.2, 0),
        v(6.3, 2.6, 0),
        v(1.25, 2.6, 0),
        normalized.group.position.clone(),
      ];
      write.group.position.copy(pointAlongComputePath(returnPath, m.write));
      write.group.scale.setScalar(
        T.MathUtils.lerp(1, normalized.cells[0]!.scale.x / write.cells[0]!.scale.x, m.write),
      );
      show(write, m.write > 0 && m.write < 1 ? 1 : 0);
      write.numbers.forEach((number) => {
        number.style.visibility = m.write > 0.15 && m.write < 0.65 ? "visible" : "hidden";
      });
      receipt(
        out.group.position.clone(),
        normalized.group.position.clone(),
        ease(p, 0.84, 0.86) * (1 - ease(p, 0.96, 1)) * 0.5,
        0,
        returnPath.slice(1, -1),
      );
      extraction[0]!(
        v(-6.425, 1.87, 0),
        sources[0]!.group.position.clone().add(v(-0.9, 0.3)),
        expand * (1 - norm) * 0.22,
        0,
        [v(-6.65, 1.87), v(-6.65, sourcePositions[0]!.y + 0.3, sourcePositions[0]!.z)],
      );
      extraction[1]!(
        collapsed.group.position.clone().add(v(0, -0.4)),
        sum.group.position.clone().add(v(0, 0.5)),
        norm * (1 - ease(p, 0.66, 0.7)) * 0.3,
      );
      render();
    };
  } else {
    const mixed = ex.mixed.map((row, i) =>
      vector(
        row,
        "",
        routeColors[i]!,
        v(0.4, fullInputs[i]!.group.position.y, fullInputs[i]!.group.position.z),
        0.53,
      ),
    );
    const fullOut = ex.output.map((row, i) =>
      vector(
        row,
        `${route(i)}′`,
        routeColors[i]!,
        v(5.5, fullInputs[i]!.group.position.y, fullInputs[i]!.group.position.z),
        0.53,
      ),
    );
    fullOut.forEach((item) => {
      routeTag(item, -1.5);
    });
    const fullDelta = vector(ex.delta, "子层输出 Δ", palette.data, v(-2.2, 5.2), 0.57);
    const fullPost = vector(ex.post, "post · 按路分配", palette.weight, v(2.8, 5.2), 0.6);
    const combRows = ex.comb.map((row, i) => vector(row, "", palette.weight, v(-2.2, 4.03 - i * 0.48), 0.55));
    label("comb · 行为新流，列为旧流", root, v(-2.2, 4.55), "title miniature");
    label("旧流混合", root, v(0.4, 5.2), "title miniature");
    connect(fullDelta, fullPost, palette.data, 0.4);
    const rowLinks = ex.input.map((_, i) => {
      connect(combRows[i]!, mixed[i]!, routeColors[i]!, 0.15);
      return link(routeColors[i]!);
    });
    topCaption.textContent = "混合旧流 + 分配 Δ → 新四路";
    labels.find((item) => item.el === topCaption)!.point.x = 2.6;
    labels.find((item) => item.el === focusCaption)!.point.x = 2.6;
    const sum = vector(
      ex.merged.map(() => 0),
      "comb × r",
      palette.result,
      v(0.7, -1.55),
      0.83,
    );
    const distributed = vector(
      ex.merged.map(() => 0),
      "post × Δ",
      palette.data,
      v(0.7, -4.6),
      0.83,
    );
    const output = vector(
      ex.merged.map(() => 0),
      "同通道相加 · 1×4",
      palette.result,
      v(5.1, -2.6),
      0.83,
    );
    // Keep the caption above both incoming branches, including their moving copies.
    labels.find((item) => item.el === output.title)!.point.y = 1.4;
    const deltaCopy = vector(ex.delta, "", palette.data, distributed.group.position.clone(), 0.83);
    const deltaRoute = [
      fullDelta.group.position.clone(),
      v(-1.6, fullDelta.group.position.y),
      v(-1.6, distributed.group.position.y),
      distributed.group.position.clone(),
    ];
    const deltaFeed = link(palette.data, 0.45, true);
    const outputCopy = vector(
      ex.merged.map(() => 0),
      "",
      palette.result,
      output.group.position.clone(),
      0.83,
    );
    const branchLines = [link(palette.result), link(palette.data)];
    const combInputs = fullInputs.map((_, i) => link(routeColors[i]!));
    const postOutputs = fullOut.map(() => link(palette.data));
    const addSign = label("+", root, v(3.2, -2.7, 0.4), "operator");
    animate = (p) => {
      const m = residualMotion(3, p),
        r = m.row,
        t = m.local;
      host.dataset.residualPhase = String(m.phase);
      host.dataset.residualWritten = String(m.written);
      host.dataset.residualRoute = String(r);
      focusCaption.textContent = `${route(r)}′ 展开 · 两支路逐通道相加`;
      fullInputs.forEach((item, i) => {
        tint(item, routeColors[i]!, ex.comb[r]![i]! > 0);
      });
      combRows.forEach((item, i) => {
        tint(item, palette.weight, i === r);
        show(item, i === r ? 1 : 0.45);
      });
      combInputs.forEach((update, i) => {
        update(
          port(fullInputs[i]!, 1),
          port(combRows[r]!, -1),
          ex.comb[r]![i]! > 0 ? (m.phase === 1 ? 0.65 : 0.24) : 0,
        );
      });
      postOutputs.forEach((update, i) => {
        const target = port(fullOut[i]!, 1);
        update(port(fullPost, 1), target, i === r ? (m.phase >= 2 ? 0.55 : 0.18) : 0, 0, [
          v(6.8, fullPost.group.position.y, 0),
          v(6.8, target.y, target.z),
        ]);
      });
      mixed.forEach((item, i) => {
        show(item, 1, i < r || (i === r && t >= 0.44) ? ex.mixed[i] : ex.merged.map(() => "?"));
        tint(item, routeColors[i]!, i === r);
      });
      fullOut.forEach((item, i) => {
        show(item, 1, i < m.written ? ex.output[i] : ex.merged.map(() => "?"));
        tint(item, routeColors[i]!, i === r);
        item.numbers.forEach((number) => {
          number.style.visibility = i === r && m.write > 0.7 && m.write < 1 ? "hidden" : "visible";
        });
      });
      rowLinks.forEach((update, i) => {
        update(port(mixed[i]!, 1), port(fullOut[i]!, -1), i === r ? 0.6 : 0.12);
      });
      const unfold = r === 0 ? m.unfold : 1;
      sources.forEach((item, i) => {
        const w = ex.comb[r]![i]!;
        item.group.position.lerpVectors(fullInputs[i]!.group.position, sourcePositions[i]!, unfold);
        item.group.scale.setScalar(0.64 + 0.36 * unfold);
        show(item, unfold * (w ? 1 : 0.52));
        item.title.style.visibility = unfold >= 0.95 ? "visible" : "hidden";
        item.numbers.forEach((number) => {
          number.style.visibility = unfold >= 0.95 ? "visible" : "hidden";
        });
        tint(item, routeColors[i]!, w > 0);
        const coeff = coefficients[i]!;
        coeff.title.textContent = `× comb[${r},${i}]`;
        show(coeff, unfold * (w ? 1 : 0.55), [w]);
        const product = contributions[i]!,
          home = v(-0.2, sourcePositions[i]!.y, sourcePositions[i]!.z);
        product.group.position.lerpVectors(item.group.position, home, ease(t, 0.15, 0.27));
        product.group.position.lerp(
          sum.group.position.clone().add(v(0, 0.75, (i - 1.5) * 0.85)),
          ease(t, 0.3, 0.44),
        );
        show(
          product,
          w && t >= 0.15 && t < 0.44 ? 1 : 0,
          ex.input[i]!.map((n) => n * w),
        );
        product.title.textContent = `${route(i)} × ${w}`;
        product.numbers.forEach((number) => {
          number.style.visibility = t >= 0.27 && t < 0.37 ? "visible" : "hidden";
        });
        if (t < 0.27 || t >= 0.37) product.title.textContent = "";
        operandLinks[i]![0]!(port(item, 1), port(coeff, -1), ease(unfold, 0.85, 1) * (w ? 0.6 : 0.1));
        operandLinks[i]![1]!(
          port(coeff, 1),
          port(product, -1),
          w ? ease(t, 0.22, 0.27) * (1 - ease(t, 0.34, 0.42)) * 0.45 : 0,
        );
      });
      show(sum, 1, t >= 0.44 ? ex.mixed[r] : ex.merged.map(() => "?"));
      tint(sum, routeColors[r]!, t >= 0.44);
      sum.title.textContent = `${route(r)} · 旧流混合`;
      show(distributed, 1, t >= 0.66 ? ex.distributed[r] : ex.merged.map(() => "?"));
      distributed.numbers.forEach((number) => {
        number.style.visibility = t >= 0.59 && t < 0.66 ? "hidden" : "visible";
      });
      distributed.title.textContent = `${ex.post[r]} × Δ`;
      // Use the open corridor beside the calculation, never across the mixed result.
      const deltaTravel = ease(t, 0.46, 0.61);
      deltaCopy.group.position.copy(pointAlongComputePath(deltaRoute, deltaTravel));
      deltaCopy.group.scale.setScalar(
        0.54 + 0.36 * ease(deltaTravel, 0.5, 0.75) + 0.1 * ease(deltaTravel, 0.9, 1),
      );
      deltaFeed(deltaRoute[0]!, deltaRoute[3]!, t >= 0.46 && t < 0.66 ? 0.45 : 0, 0, deltaRoute.slice(1, 3));
      show(deltaCopy, t >= 0.46 && t < 0.66 ? 1 : 0, t >= 0.61 ? ex.distributed[r] : ex.delta);
      show(output, 1, t >= 0.82 ? ex.output[r] : ex.merged.map(() => "?"));
      tint(output, routeColors[r]!, t >= 0.82);
      addSign.dataset.active = String(t >= 0.68);
      branchLines[0]!(port(sum, 1), port(output, -1).add(v(0, 0.18)), t >= 0.44 ? 0.65 : 0.15);
      branchLines[1]!(port(distributed, 1), port(output, -1).add(v(0, -0.18)), t >= 0.66 ? 0.65 : 0.15);
      // Aligned copies converge in depth: each channel receives its two operands before being written.
      if (t >= 0.68 && t < 0.82) {
        deltaCopy.group.scale.setScalar(1);
        deltaCopy.group.position.lerpVectors(
          distributed.group.position,
          output.group.position.clone().add(v(0, 0, 0.25)),
          ease(t, 0.68, 0.81),
        );
        show(deltaCopy, 1, ex.distributed[r]);
        outputCopy.group.position.lerpVectors(
          sum.group.position,
          output.group.position.clone().add(v(0, 0, -0.25)),
          ease(t, 0.68, 0.81),
        );
        outputCopy.group.scale.setScalar(1);
        show(outputCopy, 1, ex.mixed[r]);
        const visible = t >= 0.72 && t < 0.77 ? "visible" : "hidden";
        deltaCopy.numbers.forEach((number) => {
          number.style.visibility = visible;
        });
        outputCopy.numbers.forEach((number) => {
          number.style.visibility = visible;
        });
        output.numbers.forEach((number) => {
          number.style.visibility = "hidden";
        });
      } else {
        [deltaCopy, outputCopy, output].forEach((item) => {
          item.numbers.forEach((number) => {
            number.style.visibility = "visible";
          });
        });
        deltaCopy.numbers.forEach((number) => {
          number.style.visibility = t >= 0.5 && t < 0.59 ? "visible" : "hidden";
        });
        const path = [
          output.group.position.clone(),
          v(6.8, -2.6, 0),
          v(6.8, fullOut[r]!.group.position.y, fullOut[r]!.group.position.z),
          fullOut[r]!.group.position.clone(),
        ];
        outputCopy.group.position.copy(pointAlongComputePath(path, m.write));
        outputCopy.group.scale.setScalar(
          T.MathUtils.lerp(
            1,
            fullOut[r]!.cells[0]!.scale.x / outputCopy.cells[0]!.scale.x,
            ease(m.write, 0, 0.25),
          ),
        );
        show(outputCopy, m.write > 0 && m.write < 1 ? 1 : 0, ex.output[r]);
        outputCopy.numbers.forEach((number) => {
          number.style.visibility = m.write > 0.15 && m.write < 0.65 ? "visible" : "hidden";
        });
      }
      tint(outputCopy, routeColors[r]!);
      const landing = fullOut[Math.max(0, r - 1)]!.group.position.clone().lerp(
        fullOut[r]!.group.position,
        m.unfold,
      );
      receipt(output.group.position.clone(), landing, ease(t, 0.78, 0.84) * (1 - ease(t, 0.96, 1)) * 0.5, 0, [
        v(6.8, -2.6, 0),
        v(6.8, landing.y, landing.z),
      ]);
      extraction[0]!(
        v(-6.425, 1.87, 0),
        sources[0]!.group.position.clone().add(v(-0.95, 0.3)),
        unfold * 0.2,
        0,
        [v(-6.65, 1.87), v(-6.65, sourcePositions[0]!.y + 0.3, sourcePositions[0]!.z)],
      );
      extraction[1]!(v(-2.2, 2.83), coefficients[0]!.group.position.clone().add(v(0, 0.3)), 0.25, 0, [
        v(-3.65, 2.83),
        v(-3.65, -0.35, sourcePositions[0]!.z),
      ]);
      render();
    };
  }
  const project = new T.Vector3();
  function render() {
    if (disposed) return;
    renderer.render(scene, camera);
    for (const item of labels) {
      const active = item.parent.visible && item.visible();
      item.el.hidden = !active;
      if (!active) continue;
      item.parent.localToWorld(project.copy(item.point));
      project.project(camera);
      item.el.style.left = `${(project.x * 0.5 + 0.5) * width}px`;
      item.el.style.top = `${(-project.y * 0.5 + 0.5) * height}px`;
    }
  }
  const reset = () => {
    controls.target.set(0, 0.5, 0);
    camera.position.set(4.2, 9, 26);
    controls.update();
    render();
  };
  const resize = () => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    renderer.setSize(width, height);
    const half = Math.max(6.65, (7.55 * height) / width);
    camera.left = (-half * width) / height;
    camera.right = -camera.left;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    stage.dataset.compact = String(width < 560);
    render();
  };
  controls.addEventListener("change", render);
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  reset();
  resize();
  animate(0);
  return {
    update() {},
    animate(p: number) {
      progress = p;
      animate(progress);
    },
    reset,
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      materials.forEach((m) => {
        m.dispose();
      });
      geometries.forEach((g) => {
        g.dispose();
      });
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {}
      stage.remove();
      delete host.dataset.compute;
    },
  };
}
