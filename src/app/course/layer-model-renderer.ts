import type * as Three from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { ChapterLayer } from "./chapter-layer";
import { JOURNEY_STEPS, type JourneyNode, journeyFrame, journeyTensors, journeyValue } from "./layer-journey";
import { layerBlock, layerWeightBlock } from "./layer-layout";
import type { MasterParts, PartBlock } from "./matrix-parts";

const layout = [
  ["x", "原输入 X", 6, 4096, -105, 0, 0],
  ["n1", "归一化 N₁", 6, 4096, 260, 0, 1],
  ["g1", "增益 γ₁", 1, 4096, 460, 0, 1],
  ["wq", "Wq", 8, 4096, 65, -185, 2],
  ["wk", "Wk", 8, 4096, 260, -185, 3],
  ["wv", "Wv", 8, 4096, 455, -185, 4],
  ["q", "查询 Q", 6, 8, 65, -325, 2],
  ["k", "键 K", 6, 8, 260, -325, 3],
  ["v", "内容 V", 6, 8, 455, -325, 4],
  ["scores", "匹配分数 S", 6, 6, 162, -435, 5],
  ["alpha", "混合比例 α", 6, 6, 162, -545, 6],
  ["weighted", "各位置贡献 αV", 6, 8, 455, -545, 7],
  ["mixed", "汇总内容", 6, 8, 455, -670, 8],
  ["wo", "输出投影 Wₒ", 4096, 8, 265, -760, 9],
  ["da", "注意力 ΔA", 6, 4096, 65, -670, 9],
  ["mid", "第一次更新 X′", 6, 4096, -105, -670, 10],
  ["n2", "归一化 N₂", 6, 4096, -105, -920, 11],
  ["g2", "增益 γ₂", 1, 4096, -250, -920, 11],
  ["w1", "展开投影 W₁", 8192, 4096, 145, -920, 12],
  ["h", "展开 H", 6, 8192, 455, -920, 12],
  ["relu", "激活 H₊", 6, 8192, 455, -1220, 13],
  ["w2", "收回投影 W₂", 4096, 8192, 145, -1220, 14],
  ["df", "前馈 ΔF", 6, 4096, -105, -1220, 14],
  ["y", "本层输出 Y", 6, 4096, -105, -1440, 15],
] as const;
const parameters = new Set(["g1", "g2", "wq", "wk", "wv", "wo", "w1", "w2"]);
const parameterAt: Record<number, string> = {
  1: "g1",
  2: "wq",
  3: "wk",
  4: "wv",
  9: "wo",
  11: "g2",
  12: "w1",
  14: "w2",
};
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

/** A single permanent scene. Seeking changes column overlays, never the model's geometry or camera. */
export function mountFixedJourney(
  host: HTMLDivElement,
  source: MasterParts,
  data: ChapterLayer,
  onError: () => void,
) {
  const T = source.three;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.rotateSpeed = 0.3;
  controls.minAzimuthAngle = -0.1;
  controls.maxAzimuthAngle = 0.85;
  controls.minPolarAngle = 0.95;
  controls.maxPolarAngle = 1.65;
  const yaw = 0.42,
    pitch = 0.24;
  const point = (x: number, y: number, z = 0) => new T.Vector3(x, y + x * Math.tan(pitch) * Math.sin(yaw), z);
  const look = source.makeFlowLook({ px: 2, minPx: 0, viewH: 1300, fine: 16, slabs: "touch" });
  const style = getComputedStyle(host);
  const color = (name: string) =>
    new T.Color(style.getPropertyValue(`--color-${name}`).trim()).convertLinearToSRGB();
  const gold = color("matrix-parameter"),
    green = color("matrix-output"),
    page = color("surface");
  const labels = document.createElement("div");
  labels.className = "journey-fixed-labels";
  host.append(labels);
  type Mesh = Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>;
  const panels = new Map<
    string,
    { b: PartBlock; mesh: Mesh; label: HTMLDivElement; value: HTMLElement; at: number; name: string }
  >();
  for (const [id, name, columns, rows, x, y, at] of layout) {
    const c = point(x, y);
    const parameter = parameters.has(id);
    const b =
      parameter && !id.startsWith("g")
        ? layerWeightBlock(
            source,
            id,
            rows,
            columns,
            c.x,
            c.y + (rows <= 16 ? (rows * 106) / 16 : (rows * 106) / 4096) / 2,
          )
        : layerBlock(source, id, name, columns, rows, c.x, c.y);
    if (parameter && columns <= 16 && !id.startsWith("g")) {
      b.x0 = x - (columns * 106) / 32;
      b.x1 = x + (columns * 106) / 32;
      b.div[0] = columns;
    }
    const mesh = look.addBlock(scene, b);
    mesh.material.uniforms.uPage!.value.copy(new T.Vector3(page.r, page.g, page.b));
    if (parameter || id === "alpha" || id === "da" || id === "df" || id === "y") {
      const ink = parameter ? gold : green;
      mesh.material.uniforms.uCol!.value.set(ink.r, ink.g, ink.b);
    }
    const label = document.createElement("div");
    label.className = "journey-fixed-label";
    label.dataset.matrix = id;
    label.dataset.position = [b.x0, b.x1, b.y0, b.y1, b.z0, b.z1].join(",");
    label.dataset.parameter = String(parameter);
    const title = document.createElement("strong"),
      shape = document.createElement("span"),
      value = document.createElement("small");
    title.textContent = name;
    shape.textContent =
      id === "weighted"
        ? "当前查询 · 6 列 × 8 维"
        : id === "scores" || id === "alpha"
          ? "6 查询 × 6 来源"
          : parameter && !id.startsWith("g")
            ? `${rows.toLocaleString()} → ${columns.toLocaleString()}`
            : `${columns} 列 × ${rows.toLocaleString()} 维`;
    label.append(title, shape, value);
    labels.append(label);
    panels.set(id, { b, mesh, label, value, at, name });
  }
  const p = (id: string, side: "top" | "bottom" | "left" | "right") => {
    const b = panels.get(id)!.b;
    return new T.Vector3(
      side === "left" ? b.x0 - 6 : side === "right" ? b.x1 + 6 : (b.x0 + b.x1) / 2,
      side === "top" ? b.y1 + 8 : side === "bottom" ? b.y0 - 8 : (b.y0 + b.y1) / 2,
      -7,
    );
  };
  const edges: { from: string; to: string; line: Line2; curve: Three.CurvePath<Three.Vector3> }[] = [];
  const edge = (
    from: string,
    to: string,
    a: "top" | "bottom" | "left" | "right",
    b: "top" | "bottom" | "left" | "right",
    via: [number, number][] = [],
  ) => {
    const pts = [p(from, a), ...via.map(([x, y]) => point(x, y, -7)), p(to, b)];
    const curve = new T.CurvePath<Three.Vector3>();
    let start = pts[0]!;
    for (let i = 1; i < pts.length - 1; i++) {
      const corner = pts[i]!,
        prev = pts[i - 1]!,
        next = pts[i + 1]!;
      const radius = Math.min(12, corner.distanceTo(prev) / 3, corner.distanceTo(next) / 3);
      const before = corner.clone().add(prev.clone().sub(corner).normalize().multiplyScalar(radius));
      const after = corner.clone().add(next.clone().sub(corner).normalize().multiplyScalar(radius));
      curve.add(new T.LineCurve3(start, before));
      curve.add(new T.QuadraticBezierCurve3(before, corner, after));
      start = after;
    }
    curve.add(new T.LineCurve3(start, pts.at(-1)!));
    const geometry = new LineGeometry().setPositions(curve.getPoints(80).flatMap((v) => v.toArray()));
    const material = new LineMaterial({
      color: parameters.has(from) ? 0xb59a66 : 0x96a59e,
      linewidth: 1.15,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const line = new Line2(geometry, material);
    scene.add(line);
    const end = pts.at(-1)!,
      direction = end.clone().sub(curve.getPoint(0.985)).normalize();
    const arrow = new T.ArrowHelper(
      direction,
      end.clone().addScaledVector(direction, -5),
      5,
      material.color,
      5,
      3,
    );
    scene.add(arrow);
    edges.push({ from, to, line, curve });
  };
  edge("x", "n1", "right", "left");
  edge("g1", "n1", "left", "right");
  for (const [w, id, x] of [
    ["wq", "q", 65],
    ["wk", "k", 260],
    ["wv", "v", 455],
  ] as const) {
    edge("n1", id, "bottom", "top", [
      [-10, -90],
      [-10, -267],
      [x, -267],
    ]);
    edge(w, id, "bottom", "top");
  }
  edge("q", "scores", "bottom", "top", [
    [65, -385],
    [162, -385],
  ]);
  edge("k", "scores", "bottom", "top", [
    [260, -385],
    [162, -385],
  ]);
  edge("scores", "alpha", "bottom", "top");
  edge("alpha", "weighted", "right", "left");
  edge("v", "weighted", "bottom", "top");
  edge("weighted", "mixed", "bottom", "top");
  edge("mixed", "da", "left", "right");
  edge("wo", "da", "left", "bottom", [
    [130, -760],
    [65, -760],
  ]);
  edge("da", "mid", "left", "right");
  edge("x", "mid", "bottom", "top");
  edge("mid", "n2", "bottom", "top");
  edge("g2", "n2", "right", "left");
  edge("n2", "h", "bottom", "bottom", [
    [-105, -1062],
    [455, -1062],
  ]);
  edge("w1", "h", "right", "left");
  edge("h", "relu", "bottom", "top");
  edge("relu", "df", "left", "top", [
    [340, -1220],
    [340, -1085],
    [-105, -1085],
  ]);
  edge("w2", "df", "left", "right");
  edge("df", "y", "bottom", "top");
  edge("mid", "y", "left", "left", [
    [-290, -670],
    [-290, -1440],
  ]);
  const marks = [
    [70, 0, "RMSNorm₁"],
    [65, -281, "×"],
    [260, -281, "×"],
    [455, -281, "×"],
    [162, -505, "mask · softmax"],
    [455, -619, "Σ"],
    [-20, -670, "+"],
    [-105, -822, "RMSNorm₂"],
    [455, -1077, "ReLU"],
    [-105, -1370, "+"],
  ].map(([x, y, text]) => {
    const node = document.createElement("span");
    node.className = "journey-fixed-operation";
    node.textContent = String(text);
    labels.append(node);
    return { node, point: point(Number(x), Number(y), 0) };
  });

  // Native whole-column copies move above this fixed model; the original matrices remain intact.
  const moving = [0, 1, 2].map((i) => {
    const base = panels.get(i === 1 ? "wq" : "x")!;
    const template = look.addBlock(scene, { ...base.b, id: `fixed-column-${i}` });
    scene.remove(template);
    const geometry = template.geometry.clone();
    geometry.setAttribute(
      "columnGroup",
      new T.InstancedBufferAttribute(
        Float32Array.from({ length: 16 }, (_, n) => n),
        1,
      ),
    );
    const material = template.material;
    material.uniforms.columnGroups = { value: 16 };
    material.uniforms.columnIndex = { value: 0 };
    material.uniforms.columnCount = { value: 6 };
    material.vertexShader =
      `attribute float columnGroup; uniform float columnGroups,columnIndex,columnCount;\n${material.vertexShader}`
        .replace(
          "vPos = p; vNrm = normal;",
          "vPos=vec3((columnIndex+p.x+.5)/columnCount-.5,.5-(columnGroup+.5-p.y)/columnGroups,p.z); vNrm=normal;",
        )
        .replace(
          "gl_Position = projectionMatrix * viewMatrix * vec4(c + p * s, 1.0);",
          "gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(p,1.0);",
        );
    const mesh = new T.InstancedMesh(geometry, material, 16);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(mesh);
    return mesh;
  });
  const matrix = new T.Matrix4(),
    quaternion = new T.Quaternion();
  const columnCenter = (id: string, index: number) => {
    const b = panels.get(id)!.b;
    const count = parameters.has(id) && !id.startsWith("g") ? b.t.cols : b.t.rows.n;
    return new T.Vector3(
      b.x0 + ((Math.max(0, Math.min(count - 1, index)) + 0.5) / count) * (b.x1 - b.x0),
      (b.y0 + b.y1) / 2,
      16,
    );
  };
  const drawColumn = (
    mesh: (typeof moving)[number],
    id: string,
    center: Three.Vector3,
    h: number,
    groups: number,
    index: number,
  ) => {
    const base = panels.get(id)!;
    mesh.visible = true;
    mesh.count = groups;
    for (const key of ["uCol", "uSeed", "uDiv", "uFine", "uCut", "uPage"]) {
      const value = base.mesh.material.uniforms[key]!.value;
      if (typeof value === "number") mesh.material.uniforms[key]!.value = value;
      else mesh.material.uniforms[key]!.value.copy(value);
    }
    const count = parameters.has(id) && !id.startsWith("g") ? base.b.t.cols : base.b.t.rows.n;
    mesh.material.uniforms.columnCount!.value = count;
    mesh.material.uniforms.columnIndex!.value = index;
    mesh.material.uniforms.columnGroups!.value = groups;
    for (let i = 0; i < groups; i++) {
      matrix.compose(
        center.clone().add(new T.Vector3(0, h / 2 - ((i + 0.5) * h) / groups, 0)),
        quaternion,
        new T.Vector3(10, Math.max(1, h / groups - 0.5), 10),
      );
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  let width = 1,
    height = 1,
    selectedWord = 5,
    selectedDimension = 1023,
    lastStep = -1;
  const project = (v: Three.Vector3) => {
    const n = v.clone().project(camera);
    return [((n.x + 1) * width) / 2, ((1 - n.y) * height) / 2];
  };
  const render = () => {
    renderer.render(scene, camera);
    for (const mark of marks) {
      const [x, y] = project(mark.point);
      mark.node.style.left = `${x}px`;
      mark.node.style.top = `${y}px`;
    }
    for (const { b, label } of panels.values()) {
      const corners = [
        new T.Vector3(b.x0, b.y0, b.z1),
        new T.Vector3(b.x1, b.y0, b.z1),
        new T.Vector3(b.x0, b.y0, b.z0),
        new T.Vector3(b.x1, b.y0, b.z0),
      ].map(project);
      const x = (Math.min(...corners.map((p) => p[0]!)) + Math.max(...corners.map((p) => p[0]!))) / 2;
      const y = Math.max(...corners.map((p) => p[1]!));
      label.style.left = `${x}px`;
      label.style.top = `${y + 4}px`;
    }
  };
  const resetView = () => {
    const center = point(110, -710, -7);
    controls.target.copy(center);
    camera.position
      .copy(center)
      .add(
        new T.Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch),
        ).multiplyScalar(2500),
      );
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    const corners = [
      point(-355, 160, 0),
      point(565, 160, 0),
      point(-355, -1565, 0),
      point(565, -1565, 0),
    ].map((v) => v.applyMatrix4(camera.matrixWorldInverse));
    const spanX = Math.max(...corners.map((v) => v.x)) - Math.min(...corners.map((v) => v.x));
    const spanY = Math.max(...corners.map((v) => v.y)) - Math.min(...corners.map((v) => v.y));
    const h = Math.max(spanY, (spanX * height) / width) * 1.015;
    camera.left = (-h * width) / height / 2;
    camera.right = -camera.left;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    controls.update();
    render();
  };
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    renderer.setSize(width, height);
    edges.forEach((e) => {
      e.line.material.resolution.set(width, height);
    });
    resetView();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener("change", render);
  renderer.domElement.addEventListener("webglcontextlost", onError);
  resize();
  return {
    seek(progress: number, word: number, dimension: number) {
      const { step, amount } = journeyFrame(progress),
        current = JOURNEY_STEPS[step]!;
      const changed = lastStep !== step || selectedWord !== word || selectedDimension !== dimension;
      selectedWord = word;
      selectedDimension = dimension;
      if (changed) {
        const tensors = journeyTensors(data, word);
        host.dataset.result = String(journeyValue(tensors, current.target, word, dimension));
        for (const [id, panel] of panels) {
          panel.label.dataset.active = String(
            id === current.target ||
              current.sources.some((source) => source === id) ||
              id === parameterAt[step],
          );
          panel.value.textContent = "";
          panel.label.title = parameters.has(id)
            ? "推理时固定的参数"
            : id === "scores" || id === "alpha"
              ? `当前查询：第 ${word + 1} 列`
              : `所选位置：${journeyValue(tensors, id as JourneyNode, word, dimension).toFixed(4)}`;
          look.focus(id, null);
          look.dimOne(id, 0);
          if (id === current.target || current.sources.some((source) => source === id)) {
            const col = id === "weighted" ? Math.min(5, Math.floor(amount * 6)) : word;
            look.focus(
              id,
              [
                [col / 6, 0, 0],
                [(col + 1) / 6, 1, 1],
              ],
              0.65,
            );
          }
        }
        for (const e of edges) {
          const active =
            e.to === current.target &&
            (current.sources.some((source) => source === e.from) || e.from === parameterAt[step]);
          e.line.material.opacity = active ? 1 : 0.42;
          e.line.material.linewidth = active ? 2 : 1.15;
        }
        lastStep = step;
      }
      moving.forEach((m) => {
        m.visible = false;
      });
      const repeat = step === 5 || step === 7 || step === 8;
      const lane = Math.min(5, Math.floor(amount * 6));
      const t = repeat ? (amount === 1 ? 1 : amount * 6 - lane) : amount;
      if (step > 0 && t > 0 && t < 0.995) {
        const sourceId = current.sources[0]!,
          targetId = current.target;
        const sourcePanel = panels.get(sourceId)!,
          target = panels.get(targetId)!;
        const sourceIndex = step === 7 || step === 8 ? lane : word;
        const targetIndex = step === 7 ? lane : word;
        const start = columnCenter(sourceId, sourceIndex),
          end = columnCenter(targetId, targetIndex);
        const baseGroups = Math.min(16, sourcePanel.b.t.cols);
        const sourceHeight = sourcePanel.b.y1 - sourcePanel.b.y0;
        const scalar = [2, 3, 4, 5, 9, 12, 14].includes(step);
        const gate = start.clone().lerp(end, 0.6);
        const transfer = edges.find((e) => e.from === sourceId && e.to === targetId);
        if (transfer) gate.copy(transfer.curve.getPoint(0.6));
        gate.z = 43;
        const second =
          parameterAt[step] ?? current.sources[1] ?? (step === 8 && lane > 0 ? "mixed" : undefined);
        const secondIndex = second
          ? second.startsWith("g")
            ? 0
            : parameters.has(second)
              ? Math.min(dimension, panels.get(second)!.b.t.cols - 1)
              : step === 5
                ? lane
                : word
          : 0;
        if (t < 0.33) {
          const move = ease(t / 0.33);
          drawColumn(
            moving[0]!,
            sourceId,
            start.clone().lerp(gate.clone().add(new T.Vector3(-12, 0, 0)), move),
            sourceHeight,
            baseGroups,
            sourceIndex,
          );
          if (second) {
            const origin = columnCenter(second, secondIndex);
            if (step === 7) {
              const b = panels.get(second)!.b;
              origin.y = b.y1 - ((lane + 0.5) * (b.y1 - b.y0)) / 6;
            }
            drawColumn(
              moving[1]!,
              second,
              origin.lerp(gate.clone().add(new T.Vector3(12, 0, 0)), move),
              step === 7 ? 7 + (sourceHeight - 7) * move : sourceHeight,
              step === 7 && move < 0.5 ? 1 : baseGroups,
              secondIndex,
            );
          }
        } else if (t < 0.55) {
          drawColumn(
            moving[0]!,
            sourceId,
            gate.clone().add(new T.Vector3(-12, 0, 0)),
            sourceHeight,
            baseGroups,
            sourceIndex,
          );
          if (second)
            drawColumn(
              moving[1]!,
              second,
              gate.clone().add(new T.Vector3(12, 0, 0)),
              sourceHeight,
              baseGroups,
              secondIndex,
            );
        } else if (t < 0.78) {
          const groups = scalar ? Math.max(1, baseGroups >> Math.floor((t - 0.55) / 0.045)) : baseGroups;
          drawColumn(moving[2]!, targetId, gate, (sourceHeight * groups) / baseGroups, groups, targetIndex);
        } else {
          const write = ease((t - 0.78) / 0.215),
            height = target.b.y1 - target.b.y0;
          if (scalar)
            end.y =
              target.b.y1 -
              (((step === 5 ? lane : Math.min(dimension, target.b.t.cols - 1)) + 0.5) * height) /
                target.b.t.cols;
          drawColumn(
            moving[2]!,
            targetId,
            gate.clone().lerp(end, write),
            scalar ? Math.max(3, height / target.b.t.cols) : height,
            scalar ? 1 : Math.min(16, target.b.t.cols),
            targetIndex,
          );
        }
      }
      host.dataset.phase = t < 0.33 ? "take" : t < 0.55 ? "multiply" : t < 0.78 ? "reduce" : "write";
      host.dataset.fixedMatrices = String(panels.size);
      host.dataset.step = String(step);
      render();
    },
    resetView,
    dispose() {
      observer.disconnect();
      controls.removeEventListener("change", render);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", onError);
      const geometries = new Set<Three.BufferGeometry>(),
        materials = new Set<Three.Material>();
      scene.traverse((o) => {
        const m = o as Three.Mesh;
        if (m.geometry) geometries.add(m.geometry);
        if (m.material)
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) materials.add(mat);
      });
      geometries.forEach((g) => {
        g.dispose();
      });
      materials.forEach((m) => {
        m.dispose();
      });
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {}
      renderer.domElement.remove();
      labels.remove();
    },
  };
}
