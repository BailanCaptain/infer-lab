import type * as Three from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { type ChapterLayer, HEAD } from "./chapter-layer";
import { columnStages, layerFrame, projectionTerms } from "./layer-calculation";
import { layerBlock, layerWeightBlock } from "./layer-layout";
import type { LayerRenderer } from "./layer-renderer";
import { type MasterParts, type PartBlock, WORDS } from "./matrix-parts";

const ease = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
// The full precision value remains on the cell; the face uses a compact, signed decimal.
const faceValue = (n: number) => (Math.abs(n) < 0.0005 ? "0.000" : n.toFixed(3));

/** One world, one camera: each position owns a V column, a scalar and a contribution column. */
export function mountAttentionScene(
  host: HTMLDivElement,
  source: MasterParts,
  data: ChapterLayer,
  onError: () => void,
): LayerRenderer {
  const T = source.three;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-350, 350, 265, -265, 0.1, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = controls.enablePan = false;
  controls.rotateSpeed = 0.35;
  // A restrained orbit keeps the numbers on the front faces readable.
  controls.minAzimuthAngle = -0.25;
  controls.maxAzimuthAngle = 0.5;
  controls.minPolarAngle = 1.3;
  controls.maxPolarAngle = 1.7;
  const look = source.makeFlowLook({ px: 2, minPx: 0, viewH: 570, fine: 16, slabs: "touch" });
  const style = getComputedStyle(host);
  const ink = (key: string) =>
    new T.Color(style.getPropertyValue(`--color-${key}`).trim()).convertLinearToSRGB();
  const colors = [ink("matrix-input"), ink("matrix-output"), ink("matrix-parameter")];
  const paper = ink("surface");
  const labels = document.createElement("div");
  labels.className = "attention-workbench layer-labels";
  labels.setAttribute("aria-hidden", "true");
  host.append(labels);
  const ns = "http://www.w3.org/2000/svg";
  const wires = document.createElementNS(ns, "svg");
  wires.classList.add("layer-wires", "attention-workbench-wires");
  wires.setAttribute("aria-hidden", "true");
  host.insertBefore(wires, labels);
  const annotations: { node: HTMLElement; at: Three.Vector3 }[] = [];
  const meshes: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>[] = [];
  const pt = (x: number, y: number, z = 1) => new T.Vector3(x, -y + x * 0.016, z);
  const annotation = (text: string, x: number, y: number, cls = "") => {
    const node = document.createElement("span");
    node.className = `attention-annotation ${cls}`;
    node.textContent = text;
    labels.append(node);
    annotations.push({ node, at: pt(x, y, 3) });
    return node;
  };
  const add = (block: PartBlock, tone: number) => {
    const mesh = look.addBlock(scene, block);
    const col = colors[tone]!;
    mesh.material.uniforms.uCol!.value.set(col.r, col.g, col.b);
    mesh.material.uniforms.uPage!.value.set(paper.r, paper.g, paper.b);
    meshes.push(mesh);
    return mesh;
  };
  const block = (
    id: string,
    columns: number,
    rows: number,
    x: number,
    y: number,
    scale: number,
    weight = false,
  ) => {
    const b = weight
      ? layerWeightBlock(source, id, rows, columns, 0, 0)
      : layerBlock(source, id, id, columns, rows, 0, 0);
    const h = (b.y1 - b.y0) * scale;
    const w = (b.x1 - b.x0) * scale;
    const p = pt(x, y);
    b.x0 = p.x - w / 2;
    b.x1 = p.x + w / 2;
    b.y0 = p.y - h / 2;
    b.y1 = p.y + h / 2;
    b.z0 *= scale;
    return b;
  };
  const vector = (role: string, x: number, y: number, tone: number, index = 0) => {
    const b = block(`${role}-${index}`, 1, HEAD, x, y, 2.5);
    const mesh = add(b, tone);
    const group = document.createElement("div");
    group.className = "attention-vector";
    group.dataset.role = role;
    group.dataset.position = String(index);
    labels.append(group);
    const anchors: Three.Vector3[] = [];
    const cells = Array.from({ length: HEAD }, (_, d) => {
      const node = document.createElement("span");
      node.className = "attention-cell";
      node.dataset.role = role;
      node.dataset.dimension = String(d);
      group.append(node);
      const at = new T.Vector3(x, b.y1 - ((d + 0.5) / HEAD) * (b.y1 - b.y0), 1);
      anchors.push(at);
      annotations.push({ node, at });
      return node;
    });
    return { b, mesh, cells, group, anchors };
  };
  const name = (text: string, shape: string, x: number, y: number) => {
    const node = annotation("", x, y, "attention-tensor-label layer-label");
    node.dataset.matrix = text;
    const strong = document.createElement("strong");
    strong.textContent = text;
    const size = document.createElement("small");
    size.textContent = shape;
    node.append(strong, size);
    return node;
  };
  const columns = Array.from({ length: data.count }, (_, i) => {
    const x = 39 + i * 44;
    const token = annotation(WORDS[i]!, x, 43, "attention-token");
    const alpha = annotation("", x, 67, "attention-alpha");
    const input = vector("value", x, 151, 0, i);
    const output = vector("contribution", x, 339, 1, i);
    const multiply = annotation("× α", x, 232, "attention-broadcast");
    const route = document.createElementNS(ns, "path");
    route.classList.add("attention-collection-route");
    wires.append(route);
    return { x, token, alpha, input, output, multiply, route };
  });
  name("内容 V", "6 × 8 · 每列对应一个位置", 149, 14);
  name("加权内容", "6 × 8 · 维数不变", 149, 258);
  const query = annotation("", 482, 22, "attention-query");
  const origin = annotation("Q · K / √8 → 屏蔽 → softmax → α", 485, 46, "attention-origin-explanation");
  const weightBlock = block("output-weight", data.width, HEAD, 470, 137, 1.25, true);
  const weightMesh = add(weightBlock, 2);
  const weightName = name("输出权重 Wₒ", "8 × 4,096", 470, 190);
  const weightHint = annotation("每一列负责一个输出维", 470, 219, "attention-weight-hint");
  const summary = vector("sum", 343, 339, 1);
  name("汇总内容", "1 × 8", 343, 252);
  const coefficient = vector("coefficient", 421, 339, 2);
  const coefficientName = name("Wₒ 的一列", "8 个系数", 421, 438);
  const products = vector("product", 499, 339, 1);
  name("逐项乘积", "8 项 → 一个输出数", 499, 438);
  const pairSigns = Array.from({ length: HEAD }, (_, d) => {
    const y = 339 - (summary.b.y1 - summary.b.y0) / 2 + ((d + 0.5) / HEAD) * (summary.b.y1 - summary.b.y0);
    return [annotation("×", 383, y, "attention-pair-sign"), annotation("=", 461, y, "attention-pair-sign")];
  });
  const outputBlock = block("attention-delta", data.count, data.width, 616, 339, 1.5);
  const outputMesh = add(outputBlock, 1);
  const moving = vector("moving", 0, 151, 0);
  name("注意力 ΔA", "6 × 4,096", 616, 449);
  const writeLabel = annotation("", 616, 236, "attention-write-label");
  const scalar = annotation("", 533, 494, "attention-dot-result");
  const sigma = annotation("Σ", 309, 339, "attention-sigma");
  const projectionRoute = document.createElementNS(ns, "path");
  projectionRoute.classList.add("attention-projection-route");
  wires.append(projectionRoute);
  const weightRoute = document.createElementNS(ns, "path");
  weightRoute.classList.add("attention-weight-route");
  wires.append(weightRoute);
  const outputSlot = document.createElementNS(ns, "path");
  outputSlot.classList.add("attention-output-slot");
  wires.append(outputSlot);
  const work = document.createElement("div");
  work.className = "layer-column-work attention-workbench-caption";
  const status = document.createElement("span");
  status.className = "layer-column-status";
  const note = document.createElement("span");
  note.className = "matrix-rms-note";
  work.append(status, note);
  host.append(work);
  let word = 5,
    channel = 1023,
    progress = 0,
    width = 700,
    height = 570;
  let stages = columnStages(data, "attention", word);
  let terms = projectionTerms(stages[3]!, channel);
  let outputDimension = channel;
  const cellValue = (node: HTMLElement, value: number, visible = true) => {
    node.dataset.value = String(value);
    node.textContent = visible ? faceValue(value) : "·";
  };
  const shade = (v: ReturnType<typeof vector>, dim: number) => {
    look.dimOne(v.b.id, dim);
    v.group.dataset.dim = String(dim > 0.4);
  };
  const update = () => {
    const { phase, amount } = layerFrame("attention", progress);
    const count = word + 1;
    const index = Math.min(word, Math.floor(amount * count));
    const local = ease((amount * count - index) / 0.72);
    const summing = phase === 2;
    const projecting = phase === 3;
    work.hidden = progress === 1;
    host.dataset.operation = ["read", "broadcast", "sum", "project"][phase];
    query.textContent = `正在更新「${WORDS[word]}」`;
    origin.textContent = "Q · K / √8 → 屏蔽 → softmax → α";
    columns.forEach((c, i) => {
      const masked = i > word;
      const alpha = stages[0]!.coefficients?.[i] ?? 0;
      const active = phase < 3 && index === i && progress > 0;
      c.alpha.textContent = masked ? "屏蔽" : `${(alpha * 100).toFixed(1)}%`;
      c.alpha.dataset.value = String(alpha);
      c.alpha.dataset.active = c.token.dataset.active = String(active);
      c.input.group.dataset.masked = c.output.group.dataset.masked = String(masked);
      c.multiply.textContent = masked ? "× 0" : `× ${alpha.toFixed(3)}`;
      c.multiply.dataset.active = String(phase === 1 && active);
      const computed = phase > 1 ? 1 : phase === 1 ? (i < index ? 1 : i === index ? local : 0) : 0;
      shade(c.input, masked ? 0.8 : projecting ? 0.5 : active ? 0 : 0.18);
      shade(c.output, masked ? 0.9 : computed === 0 ? 0.7 : projecting ? 0.5 : active ? 0 : 0.18);
      c.input.cells.forEach((node, d) => {
        cellValue(node, data.attention.v[i * HEAD + d]!);
      });
      c.output.cells.forEach((node, d) => {
        const input = data.attention.v[i * HEAD + d]!;
        const result = stages[0]!.outputs[i]?.values[d] ?? 0;
        cellValue(node, result, computed >= 0.99 && !masked);
        node.dataset.input = String(input);
        node.dataset.alpha = String(alpha);
        node.dataset.revealing = String(computed > 0 && computed < 0.99);
      });
      c.route.dataset.active = String(summing && active);
      c.route.style.opacity = masked || phase < 2 ? "0" : projecting ? ".12" : active ? ".9" : ".24";
    });
    moving.mesh.visible = phase === 1 && local > 0 && local < 0.99;
    moving.group.hidden = !moving.mesh.visible;
    if (moving.mesh.visible) {
      const c = columns[index]!;
      moving.mesh.position.copy(c.input.mesh.position).lerp(c.output.mesh.position, local);
      moving.mesh.position.z += 2;
      const color = colors[local < 0.5 ? 0 : 1]!;
      moving.mesh.material.uniforms.uCol!.value.set(color.r, color.g, color.b);
      moving.cells.forEach((node, d) => {
        cellValue(
          node,
          local < 0.5 ? data.attention.v[index * HEAD + d]! : stages[0]!.outputs[index]!.values[d]!,
        );
        moving.anchors[d]!.set(
          moving.mesh.position.x,
          moving.mesh.position.y + (moving.b.y1 - moving.b.y0) * (0.5 - (d + 0.5) / HEAD),
          3,
        );
      });
    }
    summary.cells.forEach((node, d) => {
      const arrived = summing ? index + (local >= 0.99 ? 1 : 0) : phase > 2 ? count : 0;
      const total = stages[2]!.inputs.slice(0, arrived).reduce((s, c) => s + c.values[d]!, 0);
      cellValue(node, total, summing || projecting);
    });
    shade(summary, phase < 2 ? 0.65 : 0);
    shade(coefficient, projecting ? 0 : 0.65);
    shade(products, projecting ? 0.12 : 0.7);
    look.dimOne(weightBlock.id, projecting ? 0 : 0.12);
    look.dimOne(outputBlock.id, projecting ? 0.16 : 0.65);
    weightName.dataset.active = coefficientName.dataset.active = String(projecting);
    const batch = projecting && amount >= 0.76;
    outputDimension = batch
      ? Math.min(data.width - 1, Math.floor(((amount - 0.76) / 0.24) * data.width))
      : channel;
    terms = projectionTerms(stages[3]!, outputDimension);
    weightHint.textContent = projecting
      ? `取第 ${(outputDimension + 1).toLocaleString()} 列 ↓`
      : "每一列负责一个输出维";
    coefficientName.dataset.column = scalar.dataset.column = String(outputDimension);
    const paired = ease((amount - 0.08) / 0.23);
    const arrived = Math.min(HEAD, Math.max(0, Math.floor(((amount - 0.36) / 0.3) * HEAD)));
    const total = terms.slice(0, arrived).reduce((s, t) => s + t.product, 0);
    terms.forEach((term, d) => {
      cellValue(coefficient.cells[d]!, term.weight, projecting);
      const node = products.cells[d]!;
      cellValue(node, term.product, projecting && paired >= 0.99);
      node.dataset.input = String(term.input);
      node.dataset.weight = String(term.weight);
      node.dataset.added = String(projecting && d < arrived);
      pairSigns[d]!.forEach((n) => {
        n.dataset.active = String(projecting && paired > 0.5);
      });
    });
    writeLabel.textContent = projecting
      ? batch
        ? `写入 ${Math.min(data.width, outputDimension + 1).toLocaleString()} / 4,096 维`
        : `「${WORDS[word]}」第 ${channel + 1} 维`
      : "回到原来的 4,096 维";
    scalar.textContent = projecting ? `Σ ${arrived} / 8 = ${faceValue(total)}` : "八项相加 → 一个输出数";
    scalar.dataset.value = String(total);
    scalar.dataset.active = String(projecting);
    sigma.dataset.active = String(summing);
    weightRoute.style.opacity = projecting ? ".7" : ".25";
    projectionRoute.style.opacity = projecting && arrived ? ".8" : ".15";
    outputSlot.style.opacity = projecting ? "1" : "0";
    look.focus(
      weightBlock.id,
      projecting
        ? [
            [(outputDimension / data.width) * weightBlock.div[0], 0, 0],
            [
              ((outputDimension + 1) / data.width) * weightBlock.div[0],
              weightBlock.div[1],
              weightBlock.div[2],
            ],
          ]
        : null,
    );
    look.focus(
      outputBlock.id,
      projecting
        ? [
            [word, 0, 0],
            [word + 1, outputBlock.div[1], outputBlock.div[2]],
          ]
        : null,
    );
    status.dataset.arrived = String(arrived);
    status.dataset.value = String(total);
    status.textContent =
      progress === 0
        ? "先读上排内容，再看同一列乘比例；下排的贡献汇入右侧。"
        : phase === 0
          ? `「${WORDS[index]}」的比例来自当前 Q 与它的 K 匹配；它提供上方这一整列 V。`
          : phase === 1
            ? `「${WORDS[index]}」：8 个数都乘同一个 α = ${stages[0]!.coefficients![index]!.toFixed(3)}，得到下方整列贡献。`
            : summing
              ? `已相加 ${index + (local >= 0.99 ? 1 : 0)} / ${count} 列：同一个维度相加，右侧仍是 8 维。`
              : batch
                ? "换用 Wₒ 的其余列，算齐 4,096 维 ΔA，再交给下一段 X + ΔA。"
                : `8 个输入各乘一个系数；8 项求和，得到 ΔA 第 ${channel + 1} 维。`;
    note.textContent = projecting
      ? "金色 Wₒ 是固定参数；8 维展开显示，4,096 维压缩显示。数字保留三位小数。"
      : "α 是这次输入计算的混合比例。乘它决定每份内容取多少，八个维度一起缩放。";
    render();
  };
  const project = (p: Three.Vector3) => {
    const v = p.clone().project(camera);
    return { x: ((v.x + 1) * width) / 2, y: ((1 - v.y) * height) / 2 };
  };
  const xy = (x: number, y: number) => {
    const p = project(pt(x, y));
    return `${p.x},${p.y}`;
  };
  const render = () => {
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    annotations.forEach(({ node, at }) => {
      const p = project(at);
      node.style.left = `${p.x}px`;
      node.style.top = `${p.y}px`;
    });
    columns.forEach((c, i) => {
      // Nested arcs share one receiving column; no line crosses another token or its label.
      const lane = 474 + i * 4;
      c.route.setAttribute("d", `M ${xy(c.x, 410)} C ${xy(c.x, lane)}, ${xy(343, lane)}, ${xy(343, 410)}`);
    });
    weightRoute.setAttribute("d", `M ${xy(447, 227)} C ${xy(421, 235)}, ${xy(421, 247)}, ${xy(421, 266)}`);
    const slotY =
      339 -
      (outputBlock.y1 - outputBlock.y0) / 2 +
      ((outputDimension + 0.5) / data.width) * (outputBlock.y1 - outputBlock.y0);
    const slotX = outputBlock.x0 + ((word + 0.5) / data.count) * (outputBlock.x1 - outputBlock.x0);
    projectionRoute.setAttribute(
      "d",
      `M ${xy(518, 410)} C ${xy(578, 410)}, ${xy(562, slotY)}, ${xy(slotX, slotY)}`,
    );
    outputSlot.setAttribute("d", `M ${xy(slotX - 8, slotY)} L ${xy(slotX + 8, slotY)}`);
  };
  const center = pt(347, 263);
  const resetView = () => {
    controls.target.copy(center);
    camera.position.copy(center).add(new T.Vector3(160, 100, 1000));
    camera.lookAt(center);
    controls.update();
    render();
  };
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    renderer.setSize(width, height, false);
    const scale = Math.min((width - 24) / 700, (height - 80) / 525);
    camera.left = -width / 2 / scale;
    camera.right = width / 2 / scale;
    camera.top = (height / 2 - 32) / scale;
    camera.bottom = (-height / 2 - 32) / scale;
    camera.updateProjectionMatrix();
    host.style.setProperty("--attention-cell-size", `${Math.max(8, Math.min(11, scale * 11))}px`);
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
        stages = columnStages(data, "attention", word);
      }
      channel = Math.max(0, Math.min(data.width - 1, selectedChannel));
      terms = projectionTerms(stages[3]!, channel);
      progress = value;
      update();
    },
    resetView,
    dispose() {
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labels.remove();
      wires.remove();
      work.remove();
      scene.remove(weightMesh, outputMesh);
    },
  };
}
