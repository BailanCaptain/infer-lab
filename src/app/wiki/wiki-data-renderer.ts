import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createFlowGraph, type FlowSpec, ffnSpec, narrowFlowSpec } from "./scene-flow-graph";
import { scenePalette } from "./scene-palette";
import { residualFrame } from "./scene-residual-data";
import { MATMUL_INPUT, MATMUL_WEIGHT, modelTeaching } from "./scene-teaching";

export function modelSpec(step: number): FlowSpec {
  if (step === 2) return ffnSpec();
  if (step === 3)
    return {
      nodes: [
        {
          id: "streams",
          title: "原四路 residual",
          detail: "保留旁路信息",
          x: -5.6,
          y: 1.8,
          width: 2,
          height: 2,
          rows: 4,
          cols: 1,
          kind: "layers",
        },
        {
          id: "comb",
          title: "comb × 原四路",
          detail: "混合各路旁路",
          x: -1.8,
          y: 1.8,
          width: 2.4,
          height: 1.2,
          rows: 4,
          cols: 4,
          kind: "operator",
        },
        {
          id: "mixed",
          title: "混合后的四路",
          detail: "每路仍为 4096",
          x: 1.8,
          y: 1.8,
          width: 1.8,
          height: 1.4,
          rows: 4,
          cols: 1,
        },
        {
          id: "delta",
          title: "子层输出 Δ",
          detail: "4096",
          x: -5.6,
          y: -1.8,
          width: 2,
          height: 0.7,
          cols: 1,
        },
        {
          id: "post",
          labelBelow: true,
          title: "post × Δ",
          detail: "按系数分配到四路",
          x: -1.8,
          y: -1.8,
          width: 2.4,
          height: 1,
          rows: 4,
          kind: "operator",
        },
        {
          id: "distributed",
          labelBelow: true,
          title: "四路新贡献",
          detail: "每路接收一份 Δ 的贡献",
          x: 1.8,
          y: -1.8,
          width: 1.8,
          height: 1.4,
          rows: 4,
          cols: 1,
        },
        {
          id: "add",
          labelBelow: true,
          title: "对应位置相加",
          detail: "旁路 + 新贡献",
          x: 4.3,
          y: 0,
          width: 1,
          height: 1,
          values: ["+"],
          kind: "operator",
        },
        {
          id: "out",
          title: "新四路",
          detail: "进入下一层",
          x: 6.6,
          y: 0,
          width: 1.6,
          height: 2,
          rows: 4,
          cols: 1,
          kind: "layers",
        },
      ],
      edges: [
        ...Array.from({ length: 4 }, (_, i) => [
          {
            from: "streams",
            to: "comb",
            start: 0.25 + i / 16,
            end: 0.25 + i / 16 + 0.025,
            fromCell: i,
            toCell: i * 5,
          },
          {
            from: "comb",
            to: "mixed",
            start: 0.25 + i / 16 + 0.035,
            end: 0.25 + (i + 1) / 16,
            fromCell: i * 5,
            toCell: i,
          },
          { from: "delta", to: "post", start: 0.5 + i / 16, end: 0.5 + i / 16 + 0.025, toCell: i },
          {
            from: "post",
            to: "distributed",
            start: 0.5 + i / 16 + 0.035,
            end: 0.5 + (i + 1) / 16,
            fromCell: i,
            toCell: i,
          },
          { from: "mixed", to: "add", start: 0.75 + i * 0.05, end: 0.75 + i * 0.05 + 0.02, fromCell: i },
          {
            from: "distributed",
            to: "add",
            start: 0.75 + i * 0.05,
            end: 0.75 + i * 0.05 + 0.02,
            fromCell: i,
          },
          {
            from: "add",
            to: "out",
            start: 0.75 + i * 0.05 + 0.03,
            end: 0.75 + (i + 1) * 0.05,
            toCell: i,
            result: true,
          },
        ]).flat(),
      ],
    };
  if (step === 1)
    return {
      nodes: [
        {
          id: "input",
          title: "输入 x",
          detail: "同一行反复使用",
          x: -5.6,
          y: 1.4,
          width: 1.2,
          height: 2.1,
          rows: 3,
          values: MATMUL_INPUT.map(String),
        },
        {
          id: "weight",
          title: "常驻权重 W",
          detail: "每一列对应一个输出通道",
          x: -2.1,
          y: 1.4,
          width: 3.2,
          height: 2.1,
          rows: 3,
          cols: 4,
          kind: "weight",
          values: MATMUL_WEIGHT.flat().map(String),
        },
        {
          id: "products",
          title: "逐项相乘",
          detail: "对应输入维相乘",
          x: 2,
          y: 1.4,
          width: 1.6,
          height: 2.1,
          rows: 3,
        },
        {
          id: "sum",
          title: "沿输入维求和",
          detail: "三项累加成一个数",
          x: 5.3,
          y: 1.4,
          width: 1.5,
          height: 1.3,
          values: ["Σ"],
          kind: "operator",
        },
        {
          id: "output",
          title: "输出 y",
          detail: "已完成的通道保持不动",
          x: 3.3,
          y: -2.2,
          width: 3.6,
          height: 0.85,
          cols: 4,
          values: ["?", "?", "?", "?"],
        },
      ],
      edges: [
        { from: "input", to: "weight", start: 0, end: 0.3 },
        { from: "weight", to: "products", start: 0.2, end: 0.55 },
        { from: "products", to: "sum", start: 0.45, end: 0.8 },
        { from: "sum", to: "output", start: 0.8, end: 1, result: true },
      ],
    };
  return {
    nodes: [
      {
        id: "streams",
        title: "四路 residual",
        detail: "示意：每路 [3, 4]",
        x: -5.3,
        y: 0,
        width: 2,
        height: 3.1,
        rows: 4,
        cols: 2,
        kind: "layers",
      },
      {
        id: "coefficients",
        title: "pre 系数",
        detail: "本例预设每路 ¼",
        x: -1.7,
        y: 2,
        width: 2.2,
        height: 1,
        rows: 4,
        cols: 1,
      },
      {
        id: "merge",
        title: "加权合成一路",
        detail: "隐藏宽度不变",
        x: 1.6,
        y: 0,
        width: 2.3,
        height: 1.1,
        cols: 2,
        values: ["?", "?"],
        kind: "operator",
      },
      {
        id: "norm",
        title: "均方根 RMS",
        detail: "√mean(x²)",
        x: -1.7,
        y: -2,
        width: 2.2,
        height: 0.85,
        cols: 1,
        values: ["RMS"],
        kind: "operator",
      },
      {
        id: "out",
        title: "归一化输入",
        detail: "原值 ÷ RMS · γ",
        x: 5.4,
        y: 0,
        width: 2,
        height: 1,
        rows: 1,
        cols: 2,
        kind: "tensor",
      },
    ],
    edges: [
      ...Array.from({ length: 4 }, (_, i) => [
        { from: "streams", to: "merge", start: 0.25 + i / 16, end: 0.25 + (i + 1) / 16, fromCell: i * 2 },
        { from: "coefficients", to: "merge", start: 0.25 + i / 16, end: 0.25 + (i + 1) / 16, fromCell: i },
      ]).flat(),
      { from: "merge", to: "norm", start: 0.5, end: 0.6 },
      ...[0, 1].map((i) => ({
        from: "merge",
        to: "out",
        start: 0.75 + i * 0.1,
        end: 0.85 + i * 0.1,
        fromCell: i,
        toCell: i,
        result: true,
      })),
      ...[0, 1].map((i) => ({
        from: "norm",
        to: "out",
        start: 0.75 + i * 0.1,
        end: 0.85 + i * 0.1,
        toCell: i,
        result: true,
      })),
    ],
  };
}

export function sceneNodeValues(kind: "model-compute", step: number, p: number): Record<string, string[]> {
  if (kind === "model-compute" && (step === 0 || step === 3)) return residualFrame(step, p).values;
  return {};
}

export async function mountDataScene(host: HTMLDivElement, kind: "model-compute", signal: AbortSignal) {
  if (signal.aborted) return null;
  const palette = scenePalette(host),
    scene = new T.Scene();
  scene.add(new T.HemisphereLight(palette.paper, palette.board, 1.4));
  const light = new T.DirectionalLight(palette.paper, 1.6);
  light.position.set(-4, 7, 12);
  scene.add(light);
  const camera = new T.OrthographicCamera(-9, 9, 5, -5, 0.1, 100);
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);
  const overlay = document.createElement("div");
  overlay.className = "wiki-flow-labels";
  host.append(overlay);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = controls.enablePan = false;
  controls.minPolarAngle = Math.PI * 0.4;
  controls.maxPolarAngle = Math.PI * 0.6;
  controls.minAzimuthAngle = -0.2;
  controls.maxAzimuthAngle = 0.2;
  let step = -1,
    progress = 0,
    width = 1,
    height = 1,
    narrow = false;
  let graph: ReturnType<typeof createFlowGraph> | undefined;
  const render = () => {
    renderer.setViewport(0, 0, width, height);
    renderer.render(scene, camera);
    graph?.project(camera, width, height);
    host.dataset.drawCalls = String(renderer.info.render.calls);
  };
  const animate = (p: number) => {
    progress = p;
    if (!graph) return;
    const frame = modelTeaching(step, p);
    graph?.animate(kind === "model-compute" && step === 1 ? (p >= 1 ? 1 : (p * 4) % 1) : p);
    const residual = step === 0 || step === 3 ? residualFrame(step, p) : null;
    for (const [id, values] of Object.entries(sceneNodeValues(kind, step, p)))
      graph.paint(id, values, residual?.active[id]);
    if (graph && kind === "model-compute" && step === 1) {
      const col = Math.min(3, Math.floor(p * 4));
      graph.paint("input", MATMUL_INPUT.map(String), frame.tensors[0]!.active);
      graph.paint("weight", undefined, frame.tensors[1]!.active);
      graph.paint(
        "products",
        MATMUL_INPUT.map((x, row) => `${x}×${MATMUL_WEIGHT[row]![col]}`),
      );
      const row = Math.min(2, Math.floor((p * 4 - col) * 4));
      graph.paint("sum", [
        String(MATMUL_INPUT.slice(0, row + 1).reduce((s, x, r) => s + x * MATMUL_WEIGHT[r]![col]!, 0)),
      ]);
      graph.paint("output", frame.tensors[2]!.rows[0], [col]);
    }
    host.dataset.step = String(step);
    host.dataset.phase = String(Math.min(3, Math.floor(p * 4)));
    host.dataset.progress = p.toFixed(3);
    host.dataset.result = frame.equation;
    render();
  };
  const build = () => {
    graph?.dispose();
    graph = undefined;
    const spec = modelSpec(step);
    graph = createFlowGraph(narrow ? narrowFlowSpec(spec) : spec, palette, overlay);
    scene.add(graph.group);
    host.dataset.nodes = spec.nodes.map((n) => n.id).join(",");
    host.dataset.edges = spec.edges.map((e) => `${e.from}>${e.to}`).join(",");
    animate(progress);
  };
  const reset = () => {
    // Reserve a stable label lane above the top row, including its activity line.
    controls.target.set(0, narrow ? 0.2 : 0.6, 0);
    camera.position.set(1.3, narrow ? 1.5 : 2.5, 24);
    controls.update();
    render();
  };
  const resize = () => {
    width = Math.max(host.clientWidth, 1);
    height = Math.max(host.clientHeight, 1);
    const changed = narrow !== width < 500;
    narrow = width < 500;
    const viewHeight = height;
    const half = narrow ? Math.max(7, (4.4 * height) / width) : Math.max(4.8, (8.5 * height) / width);
    camera.top = half;
    camera.bottom = -half;
    camera.left = (-half * width) / viewHeight;
    camera.right = (half * width) / viewHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (changed && step >= 0) build();
    reset();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener("change", render);
  resize();
  return {
    update(next: number) {
      if (next !== step) {
        step = next;
        build();
      }
    },
    animate,
    reset,
    dispose() {
      observer.disconnect();
      controls.dispose();
      graph?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      overlay.remove();
    },
  };
}
