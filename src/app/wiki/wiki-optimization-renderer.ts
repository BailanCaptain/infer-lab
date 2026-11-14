import * as T from "three";
import { INK, type InferenceKit, inferenceSceneKit, V, type Values } from "./inference-scene-kit";
import { span } from "./scene-easing";
import {
  LAYOUT_BLOCKS,
  LAYOUT_MATRIX,
  layoutState,
  OFFLOAD_DATA,
  offloadState,
  optimizationFrame,
  QUANT,
  quantState,
  SCHEDULE_C,
  SCHEDULE_STARTS,
  scheduleState,
} from "./scene-optimization";
import { setWidePolylinePoints } from "./scene-polyline";

const blank = (rows: number, cols: number): Values =>
  Array.from({ length: rows }, () => Array<string>(cols).fill(""));
const tones = [INK.blue, INK.green, INK.gold, INK.violet];
const curve = (a: T.Vector3, b: T.Vector3) =>
  new T.CubicBezierCurve3(a, V(a.x, (a.y + b.y) / 2, 0.7), V(b.x, (a.y + b.y) / 2, 0.7), b);
function receiving(matrix: ReturnType<InferenceKit["matrix"]>, active: boolean, indices?: number[]) {
  if (!active) return;
  for (const i of indices ?? matrix.cells.map((_, i) => i)) matrix.cells[i]!.material.opacity = 0.38;
}

function courier(k: InferenceKit, values: Values, color: string, pitch = 0.7, widths?: number[]) {
  const packet = k.matrix("", values, V(0, 0), color, pitch, [], widths);
  const line = k.wire([V(0, 0), V(0, 0)], color);
  return (a: T.Vector3, b: T.Vector3, t: number, active: boolean, next: Values = values) => {
    packet.group.visible = active && t > 0 && t < 1;
    line.visible = active;
    if (!active) return;
    const path = curve(a, b);
    setWidePolylinePoints(line, path.getPoints(40));
    line.material.opacity = t === 1 ? 0.4 : 0.85;
    packet.group.position.copy(path.getPoint(t));
    packet.write(next);
    const clearance = Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? packet.width : packet.height;
    for (const number of packet.numbers)
      number.style.visibility = packet.group.position.distanceTo(a) > clearance + 0.15 ? "visible" : "hidden";
  };
}
function pulse(k: InferenceKit, color: string) {
  const line = k.wire([V(0, 0), V(0, 0)], color),
    bead = k.box(V(0, 0), V(0.15, 0.15, 0.15), color);
  return (a: T.Vector3, b: T.Vector3, t: number, active: boolean, via?: T.Vector3) => {
    line.visible = active;
    bead.visible = active && t > 0 && t < 1;
    if (!active) return;
    const path = via ? new T.QuadraticBezierCurve3(a, via, b) : curve(a, b);
    setWidePolylinePoints(line, path.getPoints(40));
    bead.position.copy(path.getPoint(t));
  };
}

function layoutScene(k: InferenceKit) {
  const logical = k.matrix("逻辑矩阵 · 4 行 × 4 列", LAYOUT_MATRIX, V(-4.3, 1), INK.blue, 0.7, [
    "第 1 行",
    "第 2 行",
    "第 3 行",
    "第 4 行",
  ]);
  const nd = k.matrix("ND · 原地址顺序", LAYOUT_MATRIX, V(3.1, 1), INK.blue, 0.7);
  const nz = k.matrix("NZ · 新地址顺序", blank(4, 4), V(3.1, -3.3), INK.green, 0.7);
  k.memory(0, [nd, nz]);
  nz.titlePoint.y = -1.8;
  for (let r = 0; r < 4; r++) {
    k.label(`地址 ${r * 4}–${r * 4 + 3}`, V(5.8, 2.05 - r * 0.7), "status");
    k.label(`地址 ${r * 4}–${r * 4 + 3}`, V(5.8, -2.25 - r * 0.7), "status");
  }
  k.ownership(0, V(-4.3, 3), "NPU 模组 · ND 源区与 NZ 目标区");
  k.ownership(0, V(3.1, 3), "");
  const packet = k.matrix("", [[1, 2, 5, 6]], V(0, 0), INK.blue, 0.7);
  const line = k.wire([V(0, 0), V(0, 0)], INK.blue);
  const message = k.label("数值保持不变 · 每块内部逐行读取", V(-2, -5.8), "equation");
  return (p: number) => {
    const f = layoutState(p);
    k.compute(0, f.phase >= 2 && f.phase <= 5 && !f.landed, tones[f.active]!);
    logical.write(LAYOUT_MATRIX);
    nd.write(LAYOUT_MATRIX);
    logical.cells.forEach((cell, i) => {
      cell.material.color.set(
        f.phase === 0 ? INK.blue : tones[Math.floor((i % 4) / 2) * 2 + Math.floor(i / 8)]!,
      );
    });
    nz.write(
      LAYOUT_BLOCKS.map((row, r) => (r < f.written ? row : ["", "", "", ""])),
      { colors: tones },
    );
    const active = f.phase >= 2 && f.phase <= 5,
      t = f.travel,
      block = f.active;
    receiving(
      nz,
      active && !f.landed,
      [0, 1, 2, 3].map((c) => block * 4 + c),
    );
    packet.group.visible = active && t > 0 && t < 1;
    line.visible = active && !f.landed;
    if (active) {
      const source = V(-4.3 + (block < 2 ? -0.7 : 0.7), 1 + (block % 2 === 0 ? 0.7 : -0.7), 0.55);
      const staging = V(-0.7, -0.9, 0.8),
        destination = V(3.1, -2.25 - block * 0.7, 0.55);
      const travelA = span(t, 0, 0.35),
        unfold = span(t, 0.35, 0.6),
        travelB = span(t, 0.6, 1);
      const firstPath = curve(source, staging),
        secondPath = new T.CubicBezierCurve3(
          staging,
          V(staging.x, destination.y, 0.8),
          V(destination.x - 1.5, destination.y, 0.8),
          destination,
        );
      const position = t < 0.35 ? firstPath.getPoint(travelA) : secondPath.getPoint(travelB);
      packet.group.position.copy(position);
      packet.write([LAYOUT_BLOCKS[block]!], { color: tones[block]! });
      packet.cells.forEach((cell, i) => {
        cell.position.set(
          T.MathUtils.lerp(((i % 2) - 0.5) * 0.7, (i - 1.5) * 0.7, unfold),
          T.MathUtils.lerp((0.5 - Math.floor(i / 2)) * 0.7, 0, unfold),
          0,
        );
        packet.numbers[i]!.style.visibility = t < 0.24 ? "hidden" : "visible";
      });
      line.material.color.set(tones[block]!);
      setWidePolylinePoints(line, [...firstPath.getPoints(24), ...secondPath.getPoints(24).slice(1)]);
    }
    if (f.phase === 6) {
      logical.write(LAYOUT_MATRIX, { focusCell: 4 });
      nd.write(LAYOUT_MATRIX, { focusCell: 4 });
      nz.write(LAYOUT_BLOCKS, { focusCell: 2, colors: tones });
    }
    message.textContent =
      f.phase === 6
        ? "数值 5：逻辑坐标仍是第 2 行、第 1 列；地址 4 → 2"
        : "先沿块列向下 · 块内逐行 · 颜色跟随完整小块";
  };
}

function quantScene(k: InferenceKit) {
  const x = k.matrix(
    "激活 X · 1 token × 3 通道",
    [QUANT.x.map(String)],
    V(-3.4, 2.05),
    INK.blue,
    0.75,
    [],
    [1.65, 1.65, 1.65],
  );
  const w = k.matrix(
    "权重 W · 3 通道 × 1 输出",
    QUANT.w.map((v) => [String(v)]),
    V(4.3, 1.5),
    INK.gold,
    0.75,
    [],
    [1.6],
  );
  const qx = k.matrix("X 的 INT8 编码", blank(1, 3), V(-3.4, 0.15), INK.blue, 0.75, [], [1.65, 1.65, 1.65]);
  const qw = k.matrix("W 的 INT8 编码", blank(3, 1), V(4.3, -1.8), INK.gold, 0.75, [], [1.6]);
  qx.title.textContent = "激活 INT8";
  qx.titlePoint.set(-3.7, 0, 0.2);
  qw.title.textContent = "权重 INT8";
  qw.titlePoint.set(2, 0, 0.2);
  const products = k.matrix(
    "逐通道乘积",
    blank(1, 3),
    V(-3.4, -2.2),
    INK.green,
    0.75,
    [],
    [1.65, 1.65, 1.65],
  );
  products.titlePoint.set(-3.7, 0, 0.2);
  const sum = k.matrix("宽整数累加", [[""]], V(-3.4, -4.6), INK.green, 0.75, [], [2.5]);
  sum.titlePoint.set(-3.7, 0, 0.2);
  const restored = k.matrix("乘回系数后的值", [[""]], V(3.2, -4.6), INK.green, 0.75, [], [2.5]);
  k.memory(0, [qw, qx, restored]);
  k.label("sₓ = 0.01", V(-7.1, 2.05), "status");
  k.label("s𝑤 = 0.02", V(6.35, 1.5), "status");
  k.ownership(0, V(-3.4, 3.25), "NPU 模组 · 显存中的 INT8 张量");
  k.ownership(0, V(4.3, 3.25), "");
  const moveX = courier(k, [QUANT.x.map(String)], INK.blue, 0.75, [1.65, 1.65, 1.65]);
  const moveW = courier(
    k,
    QUANT.w.map((v) => [String(v)]),
    INK.gold,
    0.75,
    [1.6],
  );
  const operands = [pulse(k, INK.blue), pulse(k, INK.gold)];
  const sums = [pulse(k, INK.green), pulse(k, INK.green), pulse(k, INK.green)];
  const scale = pulse(k, INK.green);
  const formula = k.label("同通道相乘，三个通道相加", V(0, -6.15), "equation");
  return (p: number) => {
    const f = quantState(p);
    k.compute(
      0,
      f.phase === 3 ? f.products < 3 : f.phase >= 2 && f.phase <= 5 && !f.landed,
      f.phase === 2 ? INK.blue : INK.green,
    );
    k.root.updateMatrixWorld(true);
    x.write([QUANT.x.map(String)]);
    w.write(QUANT.w.map((v) => [String(v)]));
    qx.write([f.activation ? QUANT.qx : ["", "", ""]]);
    qw.write(f.weights ? QUANT.qw.map((v) => [v]) : blank(3, 1));
    products.write([QUANT.products.map((v, i) => (i < f.products ? v : ""))]);
    sum.write([[f.summed ? QUANT.sum : ""]]);
    restored.write([[f.restored ? QUANT.restored.toFixed(4) : ""]]);
    receiving(qx, f.phase === 2 && !f.activation);
    receiving(qw, f.phase === 1 && !f.weights);
    receiving(products, f.phase === 3 && f.products <= f.channel, [f.channel]);
    receiving(sum, f.phase === 4 && !f.summed);
    receiving(restored, f.phase === 5 && !f.restored);
    moveX(x.group.position, qx.group.position, f.travel, f.phase === 2);
    moveW(w.group.position, qw.group.position, f.travel, f.phase === 1);
    const dest = products.cells[f.channel]!.getWorldPosition(V(0, 0)).add(V(0, 0, 0.5));
    operands[0]!(
      qx.cells[f.channel]!.getWorldPosition(V(0, 0)).add(V(0, 0, 0.5)),
      dest,
      f.productTravel,
      f.phase === 3,
    );
    operands[1]!(
      qw.cells[f.channel]!.getWorldPosition(V(0, 0)).add(V(0, 0, 0.5)),
      dest,
      f.productTravel,
      f.phase === 3,
      V(dest.x, -0.9, 0.6),
    );
    if (f.phase === 3) {
      qx.write([QUANT.qx], { focusCell: f.channel });
      qw.write(
        QUANT.qw.map((v) => [v]),
        { focus: f.channel },
      );
    }
    sums.forEach((draw, i) => {
      draw(
        products.cells[i]!.getWorldPosition(V(0, 0)),
        sum.group.position.clone().add(V(0, 0, 0.5)),
        f.travel,
        f.phase === 4,
      );
    });
    scale(
      sum.group.position.clone().add(V(1.3, 0, 0.5)),
      restored.group.position.clone().add(V(-1.3, 0, 0.5)),
      f.travel,
      f.phase === 5,
    );
    formula.textContent =
      f.phase === 3
        ? `${QUANT.qx[f.channel]} × ${QUANT.qw[f.channel]}${f.products > f.channel ? ` = ${QUANT.products[f.channel]}` : ""}`
        : f.phase === 4
          ? `1040 + 3937 + 5461${f.summed ? " = 10438" : ""}`
          : f.phase >= 5
            ? `10438 × 0.01 × 0.02${f.restored ? " = 2.0876" : ""}`
            : "整数保留缩放关系 · 激活与权重各有一份系数";
  };
}

function offloadScene(k: InferenceKit) {
  k.label("NPU 板", V(-3.5, 7), "region");
  k.label("主机板 · CPU 与内存条", V(3.7, 7), "region");
  k.plane("设备显存", V(-3.6, -0.6, -0.3), V(5.9, 7.9, 0.08));
  k.plane("CPU 主机内存", V(3.6, -0.6, -0.3), V(5.9, 7.9, 0.08));
  k.ownership(0, V(-3.6, 2.7), "");
  k.ownership(-1, V(3.6, 2.7), "");
  const gpu = [0, 1].map((i) =>
    k.matrix(
      `A · 显存页 ${[2, 7][i]}`,
      OFFLOAD_DATA.slice(i * 2, i * 2 + 2),
      V(-3.6, 1 - i * 2.8),
      INK.blue,
      0.68,
      [`位置 ${i * 2}`, `位置 ${i * 2 + 1}`],
    ),
  );
  const cpu = [0, 1].map((i) => k.matrix(`主机槽 ${i}`, blank(2, 4), V(3.6, 1 - i * 2.8), INK.gold, 0.68));
  cpu.forEach((page, i) => {
    for (let r = 0; r < 2; r++) {
      const label = k.label(
        `位置 ${i * 2 + r}`,
        V(page.width / 2 + 0.18, (0.5 - r) * 0.68, 0.2),
        "row",
        page.group,
      );
      label.style.transform = "translate(0, -50%)";
    }
  });
  for (const page of [...gpu, ...cpu]) {
    page.titlePoint.y = 1.6;
    ["K₀", "K₁", "V₀", "V₁"].forEach((name, c) => {
      k.label(name, V((c - 1.5) * 0.68, 0.96, 0.2), "status", page.group);
    });
  }
  const next = k.matrix("B 的新 K/V", [[4, 5, 6, 7]], V(-3.6, -4.3), INK.green, 0.68, ["位置 4"]);
  k.memory(0, [...gpu, next]);
  k.memory(-1, cpu);
  const deviceLink = k.hardwareTransfer();
  const status = k.label("等待保存完成", V(3.6, -4.1), "status");
  const links = [
    courier(k, OFFLOAD_DATA.slice(0, 2), INK.blue, 0.68),
    courier(k, OFFLOAD_DATA.slice(2, 4), INK.blue, 0.68),
  ];
  return (p: number) => {
    const f = offloadState(p);
    const saving = f.phase === 1 || f.phase === 2,
      loading = f.phase === 5 || f.phase === 6;
    deviceLink(saving ? 0 : -1, saving ? -1 : 0, f.travel, saving || loading);
    k.compute(0, f.phase === 7 && !f.resumed, INK.green);
    for (let i = 0; i < 2; i++) {
      const rows = OFFLOAD_DATA.slice(i * 2, i * 2 + 2);
      gpu[i]!.write(!f.reclaimed || f.loaded[i] ? rows : blank(2, 4), {
        color: f.loaded[i] ? INK.green : INK.blue,
      });
      gpu[i]!.title.textContent = f.allocated
        ? `B · 显存页 ${[9, 10][i]}`
        : f.reclaimed
          ? `原页 ${[2, 7][i]} · 已归还`
          : `A · 显存页 ${[2, 7][i]}`;
      cpu[i]!.write(f.saved[i] ? rows : blank(2, 4), { color: INK.gold });
      const save = f.phase === i + 1,
        load = f.phase === i + 5;
      receiving(cpu[i]!, save && !f.saved[i]);
      receiving(gpu[i]!, load && !f.loaded[i]);
      links[i]!(
        save ? gpu[i]!.group.position : cpu[i]!.group.position,
        save ? cpu[i]!.group.position : gpu[i]!.group.position,
        f.travel,
        save || load,
        rows,
      );
    }
    next.group.visible = f.phase === 7;
    next.write([f.resumed ? [4, 5, 6, 7] : ["", "", "", ""]]);
    receiving(next, f.phase === 7 && !f.resumed);
    status.textContent = f.hostReady
      ? "完整段可复用 · 主机副本仍保留"
      : `${f.saved.filter(Boolean).length} / 2 页到达 · 等待保存完成`;
  };
}

function scheduleScene(host: HTMLDivElement) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 720 800");
  svg.classList.add("wiki-schedule-svg");
  svg.setAttribute("aria-hidden", "true");
  host.append(svg);
  const make = (tag: string, attrs: Record<string, string | number>, text = "") => {
    const el = document.createElementNS(ns, tag);
    for (const [key, v] of Object.entries(attrs)) el.setAttribute(key, String(v));
    el.textContent = text;
    svg.append(el);
    return el;
  };
  make("text", { x: 42, y: 68, class: "schedule-title" }, "把一次长 prefill 分进不同调度步");
  make("text", { x: 42, y: 102, class: "schedule-note" }, "A、B 每步各生成一个位置；C 有 14 个提示词位置");
  const focus = make("rect", {
    x: 135,
    y: 138,
    width: 129,
    height: 332,
    rx: 10,
    class: "schedule-highlight",
  });
  const cells: { rect: Element; text: Element; sub: Element }[][] = [];
  for (let s = 0; s < 4; s++) {
    const x = 142 + s * 136;
    make("text", { x: x + 57, y: 166, "text-anchor": "middle", class: "schedule-row" }, `第 ${s + 1} 步`);
    cells[s] = [0, 1, 2].map((r) => ({
      rect: make("rect", {
        x,
        y: 188 + r * 77,
        width: 114,
        height: 58,
        rx: 6,
        fill: "#edf1e8",
        stroke: "#d3dece",
      }),
      text: make("text", { x: x + 57, y: 211 + r * 77, "text-anchor": "middle", class: "schedule-value" }),
      sub: make("text", { x: x + 57, y: 232 + r * 77, "text-anchor": "middle", class: "schedule-note" }),
    }));
  }
  ["A · decode", "B · decode", "C"].forEach((s, r) => {
    make("text", { x: 24, y: 222 + r * 77, class: "schedule-row" }, s);
  });
  make("text", { x: 24, y: 443, class: "schedule-note" }, "本步预算");
  const budgets = Array.from({ length: 4 }, (_, s) =>
    Array.from({ length: 8 }, (_, i) =>
      make("rect", { x: 142 + s * 136 + i * 14, y: 423, width: 11, height: 22, rx: 2, fill: "#e2e9dc" }),
    ),
  );
  make("text", { x: 42, y: 519, class: "schedule-title" }, "C 的历史按位置延续");
  const history = Array.from({ length: 15 }, (_, i) => {
    const rect = make("rect", {
      x: 42 + i * 43,
      y: 550,
      width: 37,
      height: 42,
      rx: 4,
      fill: "#edf1e8",
      stroke: "#cbd9c8",
    });
    make("text", { x: 60.5 + i * 43, y: 576, "text-anchor": "middle", class: "schedule-row" }, String(i));
    return rect;
  });
  make("text", { x: 42, y: 619, class: "schedule-note" }, "位置 0–13：提示词历史");
  make("text", { x: 594, y: 619, class: "schedule-note" }, "14：y₀");
  const output = make("text", { x: 42, y: 687, class: "schedule-title" });
  make(
    "text",
    { x: 42, y: 738, class: "schedule-note" },
    "横轴按调度步划分；实际每步耗时由计算、历史与通信决定。",
  );
  const animate = (p: number) => {
    const f = scheduleState(p);
    focus.setAttribute("x", String(135 + f.step * 136));
    focus.setAttribute("opacity", f.phase === 0 ? "0" : "1");
    cells.forEach((rows, s) => {
      rows.forEach((cell, r) => {
        const scheduled = s < f.planned,
          done = s < f.completed,
          color = r === 2 ? INK.gold : INK.blue;
        cell.rect.setAttribute("fill", done ? color : scheduled ? "#dce9dc" : "#edf1e8");
        cell.rect.setAttribute("stroke-dasharray", scheduled && !done ? "4 3" : "none");
        cell.text.textContent = scheduled ? `${r === 2 ? SCHEDULE_C[s] : 1} 个位置` : "";
        cell.text.setAttribute("style", `fill:${done ? "white" : "#315343"}`);
        cell.sub.textContent = scheduled
          ? r === 2
            ? s < 3
              ? `${SCHEDULE_STARTS[s]}–${SCHEDULE_STARTS[s]! + SCHEDULE_C[s]! - 1}`
              : "y₀ → 前向"
            : done
              ? "已推进"
              : "已排，待执行"
          : "";
        cell.sub.setAttribute("style", `fill:${done ? "#fff" : "#6d8073"}`);
      });
    });
    budgets.forEach((row, s) => {
      row.forEach((rect, i) => {
        rect.setAttribute(
          "fill",
          s < f.planned ? (i < 2 ? INK.blue : i < 2 + SCHEDULE_C[s]! ? INK.gold : "#e2e9dc") : "#e2e9dc",
        );
      });
    });
    history.forEach((rect, i) => {
      rect.setAttribute("fill", i < f.prefix || (i === 14 && f.completed === 4) ? "#a7c8af" : "#edf1e8");
    });
    output.textContent = f.firstToken
      ? "C 的第一个回答 y₀ 已交付"
      : f.completed
        ? "C 提示词未结束：本步采样不交付"
        : "C 等待提示词计算；A、B 已在生成";
  };
  return {
    animate,
    reset() {},
    dispose() {
      svg.remove();
    },
  };
}

export async function mountOptimizationScene(host: HTMLDivElement, kind: number, signal: AbortSignal) {
  let animate: (p: number) => void,
    reset: () => void,
    dispose: () => void,
    render = () => {};
  if (kind === 3) {
    const view = scheduleScene(host);
    animate = view.animate;
    reset = view.reset;
    dispose = view.dispose;
  } else {
    const kit = await inferenceSceneKit(host, 0, signal, kind === 2 ? 8 : 9);
    if (!kit) return null;
    animate = [layoutScene, quantScene, offloadScene][kind]!(kit);
    reset = kit.reset;
    dispose = kit.dispose;
    render = kit.render;
  }
  const update = (p: number) => {
    animate(p);
    const f = optimizationFrame(kind, p);
    host.dataset.phase = String(f.phase);
    host.dataset.progress = p.toFixed(4);
    host.dataset.landed = String(f.landed);
    host.dataset.result =
      p === 1
        ? [
            LAYOUT_BLOCKS.flat().join(","),
            "10438;2.0876;error=0.0012",
            "host=ready;gpu=9,10;next=4",
            "6,6,2,1;prefix=14;first=y0",
          ][kind]!
        : "pending";
    render();
  };
  update(0);
  return { update() {}, animate: update, reset, dispose };
}
