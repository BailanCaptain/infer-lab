import * as T from "three";
import { INK, type InferenceKit, inferenceSceneKit, V, type Values, wireTone } from "./inference-scene-kit";
import { span } from "./scene-easing";
import {
  LAYOUT_BLOCKS,
  LAYOUT_MATRIX,
  layoutState,
  nzAddress,
  OFFLOAD_C_DATA,
  OFFLOAD_DATA,
  offloadState,
  optimizationFrame,
  SCHEDULE_C,
  SCHEDULE_STARTS,
  scheduleState,
} from "./scene-optimization";
import { setWidePolylinePoints } from "./scene-polyline";
import { quantSvgScene } from "./wiki-quant-svg";

const blank = (rows: number, cols: number): Values =>
  Array.from({ length: rows }, () => Array<string>(cols).fill(""));
const tones = [INK.blue, INK.green, INK.gold, INK.violet];
const curve = (a: T.Vector3, b: T.Vector3) =>
  new T.CubicBezierCurve3(a, V(a.x, (a.y + b.y) / 2, 0.7), V(b.x, (a.y + b.y) / 2, 0.7), b);

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
const ND_STRIDED = [
  [0, 1, 4, 5],
  [8, 9, 12, 13],
  [2, 3, 6, 7],
  [10, 11, 14, 15],
] as const;
const ND_STRIDED_LABELS = ["0,1 与 4,5", "8,9 与 12,13", "2,3 与 6,7", "10,11 与 14,15"] as const;

function layoutScene(k: InferenceKit) {
  const logical = k.matrix("逻辑矩阵 · 4×4（坐标不变）", LAYOUT_MATRIX, V(-4.3, 1), INK.blue, 0.7, [
    "第 1 行",
    "第 2 行",
    "第 3 行",
    "第 4 行",
  ]);
  const nd = k.matrix("ND · 线性地址（按行）", LAYOUT_MATRIX, V(3.1, 1), INK.blue, 0.7);
  const nz = k.matrix("NZ · 分块连续地址", blank(4, 4), V(3.1, -3.3), INK.green, 0.7);
  k.memory(0, [nd, nz]);
  nz.titlePoint.y = -1.98;
  for (let r = 0; r < 4; r++) {
    k.label(`地址 ${r * 4}–${r * 4 + 3}`, V(5.8, 2.05 - r * 0.7), "status");
    k.label(`地址 ${r * 4}–${r * 4 + 3}`, V(5.8, -2.25 - r * 0.7), "status");
  }
  k.ownership(0, V(-4.3, 3), "NPU 模组 · 逻辑视图与 ND/NZ 地址对照");
  k.ownership(0, V(3.1, 3), "");
  const packet = k.matrix("", [[1, 2, 5, 6]], V(0, 0), INK.blue, 0.7, [], undefined, false);
  packet.title.textContent = "";
  const line = k.wire([V(0, 0), V(0, 0)], INK.blue);
  const message = k.label("数值保持不变 · 每块内部逐行读取", V(-0.6, -6.1), "equation");
  const cellColors = Array.from(
    { length: 16 },
    (_, i) => tones[Math.floor((i % 4) / 2) * 2 + Math.floor(i / 8)]!,
  );
  let inspectCell = 4;
  let lastP = 0;
  [logical, nd].forEach((m) => {
    m.cells.forEach((cell, idx) => {
      k.pick(cell, () => {
        inspectCell = idx;
        step(lastP);
        k.render();
      });
    });
  });
  const step = (p: number) => {
    lastP = p;
    const f = layoutState(p);
    const active = f.phase >= 2 && f.phase <= 5,
      t = f.travel,
      block = f.active;
    k.compute(0, active && !f.landed, tones[block]!);
    logical.write(LAYOUT_MATRIX, {
      ...(f.phase === 0 ? {} : { cellColors }),
      focusCell: f.phase === 6 ? inspectCell : undefined,
    });
    nd.write(LAYOUT_MATRIX, {
      ...(f.phase === 0 ? {} : { cellColors }),
      focusCells: active ? ND_STRIDED[block] : undefined,
      focusCell: f.phase === 6 ? inspectCell : undefined,
    });
    const r0 = Math.floor(inspectCell / 4),
      c0 = inspectCell % 4;
    const nzIdx = nzAddress(r0, c0);
    nz.write(
      LAYOUT_BLOCKS.map((row, r) => (r < f.written ? row : ["", "", "", ""])),
      {
        colors: tones,
        focusCell: f.phase === 6 ? nzIdx : undefined,
        receivingCells: active && !f.landed ? [0, 1, 2, 3].map((c) => block * 4 + c) : [],
      },
    );
    packet.group.visible = active && t > 0 && t < 1;
    line.visible = active && !f.landed;
    if (active) {
      // Gather directly from ND linear matrix at x = 3.1 (strided addresses), leaving logical at x = -4.3 intact.
      const source = V(3.1 + (block < 2 ? -0.7 : 0.7), 1 + (block % 2 === 0 ? 0.7 : -0.7), 0.55);
      const staging = V(-0.15, -1.1, 0.85),
        destination = V(3.1, -2.25 - block * 0.7, 0.55);
      const travelA = span(t, 0, 0.35),
        unfold = span(t, 0.35, 0.6),
        travelB = span(t, 0.6, 1);
      const firstPath = curve(source, staging),
        secondPath = new T.CubicBezierCurve3(
          staging,
          V(staging.x, destination.y, 0.85),
          V(destination.x - 1.5, destination.y, 0.85),
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
        packet.numbers[i]!.style.visibility = t < 0.26 || t > 0.88 ? "hidden" : "visible";
      });
      line.material.color.copy(wireTone(tones[block]!));
      setWidePolylinePoints(line, [...firstPath.getPoints(24), ...secondPath.getPoints(24).slice(1)]);
    }
    const val = LAYOUT_MATRIX[r0]![c0]!;
    message.textContent =
      f.phase === 6
        ? `数值 ${val}：逻辑坐标仍是第 ${r0 + 1} 行、第 ${c0 + 1} 列（未转置）；ND 地址 ${inspectCell} → NZ 地址 ${nzIdx}`
        : active
          ? `从 ND 跨行取地址 ${ND_STRIDED_LABELS[block]}（步长 4）→ 展开写入 NZ 连续地址 ${block * 4}–${block * 4 + 3}`
          : "逻辑矩阵坐标保持不变 · 从右上 ND 跨步采集 2×2 小块写入右下 NZ";
  };
  return step;
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
  const gpuBanner = k.label("", V(-3.6, -3.55), "subhead");
  const links = [
    courier(k, OFFLOAD_DATA.slice(0, 2), INK.blue, 0.68),
    courier(k, OFFLOAD_DATA.slice(2, 4), INK.blue, 0.68),
  ];
  const makeOverwriteCarrier = () => {
    const group = new T.Group();
    k.root.add(group);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        k.box(V((c - 1.5) * 0.68, (0.5 - r) * 0.68, 0), V(0.58, 0.54, 0.2), INK.gold, group);
      }
    }
    const line = k.wire([V(0, 0), V(0, 0)], INK.gold);
    return (a: T.Vector3, b: T.Vector3, t: number, active: boolean) => {
      group.visible = active && t > 0 && t < 1;
      line.visible = active;
      if (!active) return;
      const path = curve(a, b);
      setWidePolylinePoints(line, path.getPoints(32));
      line.material.opacity = t >= 1 ? 0.35 : 0.88;
      group.position.copy(path.getPoint(t));
    };
  };
  const overwriteLinks = [makeOverwriteCarrier(), makeOverwriteCarrier()];
  return (p: number) => {
    const f = offloadState(p);
    const saving = f.phase === 1 || f.phase === 2,
      loading = f.phase === 5 || f.phase === 6;
    deviceLink(saving ? 0 : -1, saving ? -1 : 0, f.travel, saving || loading, loading ? INK.green : INK.blue);
    k.compute(0, (f.phase === 7 && !f.resumed) || f.overwriting, f.overwriting ? INK.gold : INK.green);
    const cTravel = f.phase === 3 ? span(f.local, 0.32, 0.7) : 0;
    const showC = f.reclaimed && !f.allocated;
    gpuBanner.textContent =
      f.phase === 7
        ? ""
        : f.allocated
          ? "原页 2、7 已被 C 覆盖 → B 另分新页 9、10"
          : showC
            ? "请求 C 已复用覆盖页 2、7（本地前缀已淘汰）"
            : f.overwriting
              ? "A 已归还页 2、7 → 请求 C 正在占用覆写…"
              : "";
    for (let i = 0; i < 2; i++) {
      const rows = OFFLOAD_DATA.slice(i * 2, i * 2 + 2);
      const cRows = OFFLOAD_C_DATA.slice(i * 2, i * 2 + 2);
      const save = f.phase === i + 1,
        load = f.phase === i + 5;
      const cellValues = f.allocated ? (f.loaded[i] ? rows : blank(2, 4)) : showC ? cRows : rows;
      const cellColor = f.loaded[i] ? INK.green : showC ? INK.gold : INK.blue;
      gpu[i]!.write(cellValues, {
        color: cellColor,
        receivingCells: (load && !f.loaded[i]) || f.overwriting ? [0, 1, 2, 3, 4, 5, 6, 7] : [],
      });
      gpu[i]!.names.forEach((lbl, r) => {
        lbl.textContent = showC || f.overwriting ? `C 位置 ${i * 2 + r}` : `位置 ${i * 2 + r}`;
      });
      gpu[i]!.title.textContent = f.allocated
        ? `B · 显存新页 ${[9, 10][i]}`
        : showC
          ? `C 占用 · 页 ${[2, 7][i]}（已覆盖）`
          : f.overwriting
            ? `页 ${[2, 7][i]} · C 占用覆写`
            : f.phase === 3
              ? `A · 显存页 ${[2, 7][i]}（归还中）`
              : `A · 显存页 ${[2, 7][i]}`;
      cpu[i]!.write(f.saved[i] ? rows : blank(2, 4), {
        color: INK.violet,
        receivingCells: save && !f.saved[i] ? [0, 1, 2, 3, 4, 5, 6, 7] : [],
      });
      links[i]!(
        save ? gpu[i]!.group.position : cpu[i]!.group.position,
        save ? cpu[i]!.group.position : gpu[i]!.group.position,
        f.travel,
        save || load,
        rows,
      );
      overwriteLinks[i]!(
        V(-5.85, gpu[i]!.group.position.y + 0.85, 0.35),
        gpu[i]!.group.position,
        cTravel,
        f.overwriting,
      );
    }
    next.group.visible = f.phase === 7;
    next.write([f.resumed ? [4, 5, 6, 7] : ["", "", "", ""]], {
      color: INK.green,
      receivingCells: f.phase === 7 && !f.resumed ? [0, 1, 2, 3] : [],
    });
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
        cell.rect.setAttribute("fill", done ? color : scheduled ? "#e5efe9" : "#f1efe8");
        cell.rect.setAttribute("stroke", done ? (r === 2 ? "#bc6c63" : "#5d82c7") : "#d5d3c9");
        cell.rect.setAttribute("stroke-dasharray", scheduled && !done ? "4 3" : "none");
        cell.text.textContent = scheduled ? `${r === 2 ? SCHEDULE_C[s] : 1} 个位置` : "";
        cell.text.setAttribute("style", `fill:${done ? "#17211f" : "#315343"}`);
        cell.sub.textContent = scheduled
          ? r === 2
            ? s < 3
              ? `${SCHEDULE_STARTS[s]}–${SCHEDULE_STARTS[s]! + SCHEDULE_C[s]! - 1}`
              : "y₀ → 前向"
            : done
              ? "已推进"
              : "已排，待执行"
          : "";
        cell.sub.setAttribute("style", `fill:${done ? "#24332f" : "#626d68"}`);
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
      : f.planned === 3
        ? "最后 2 个提示词已排入：本步执行完即可交付 y₀"
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

export async function mountOptimizationScene(
  host: HTMLDivElement,
  kind: number,
  signal: AbortSignal,
  onSeek?: (p: number) => void,
) {
  let animate: (p: number) => void,
    reset: () => void,
    dispose: () => void,
    render = () => {};
  if (kind === 1 || kind === 3) {
    const view = kind === 1 ? quantSvgScene(host, onSeek) : scheduleScene(host);
    animate = view.animate;
    reset = view.reset;
    dispose = view.dispose;
  } else {
    const kit = await inferenceSceneKit(host, 0, signal, kind === 2 ? 8 : 9);
    if (!kit) return null;
    animate = (kind === 0 ? layoutScene : offloadScene)(kit);
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
