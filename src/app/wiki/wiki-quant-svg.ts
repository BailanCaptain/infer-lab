import { QUANT, quantState } from "./scene-optimization";

const NS = "http://www.w3.org/2000/svg";

const TONE = {
  paper: "#fbfaf6",
  sunken: "#f2efe6",
  line: "#dcd8ce",
  ink: "#17211f",
  muted: "#626d68",
  token: "#087f73",
  tokenSoft: "#ddf4ef",
  tokenInk: "#065f56",
  weight: "#c78300",
  weightSoft: "#fff4cf",
  weightInk: "#936300",
  kv: "#4c65b6",
  kvSoft: "#e8edff",
  kvInk: "#3a4f93",
  comm: "#9a4b86",
  commSoft: "#f7e7f2",
  commInk: "#7a3a6a",
  danger: "#b54237",
  dangerSoft: "#fff0e9",
};

function el<K extends keyof SVGElementTagNameMap>(
  parent: SVGElement,
  tag: K,
  attrs: Record<string, string | number> = {},
  text = "",
) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text) node.textContent = text;
  parent.append(node);
  return node;
}

/** Interactive Edition-A 2D SVG workbench for W8A8 symmetric per-row/per-column quantization. */
export function quantSvgScene(host: HTMLDivElement, onSeek?: (p: number) => void) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 820 760");
  svg.setAttribute("class", "wiki-quant-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "W8A8 三通道对称量化与双系数反量化分步交互图");
  host.append(svg);

  // Header
  el(
    svg,
    "text",
    { x: 26, y: 36, "font-size": 19, "font-weight": 700, fill: TONE.ink },
    "INT8 W8A8 单输出元素演算（3 通道对称量化）",
  );
  el(
    svg,
    "text",
    { x: 26, y: 58, "font-size": 13.5, fill: TONE.muted },
    "权重离线按列量化 · 激活在线按行量化 · INT32 宽整数累加 · 末步乘回行/列双系数",
  );

  // Live status bar
  const bannerRect = el(svg, "rect", {
    x: 24,
    y: 74,
    width: 772,
    height: 34,
    rx: 8,
    fill: TONE.sunken,
    stroke: TONE.line,
  });
  const bannerDot = el(svg, "circle", { cx: 44, cy: 91, r: 5, fill: TONE.token });
  const bannerText = el(svg, "text", { x: 58, y: 96, "font-size": 13.5, "font-weight": 650, fill: TONE.ink });

  const makeHit = (stage: number, local = 0.78) => {
    const g = el(svg, "g", { class: onSeek ? "quant-hit" : "" });
    if (onSeek) g.addEventListener("click", () => onSeek((stage + local) / 7));
    return g;
  };

  // Row 1 Left: Activation X (online per-token)
  const actGroup = makeHit(2);
  const actCard = el(actGroup, "rect", {
    class: "quant-card-bg",
    x: 24,
    y: 120,
    width: 374,
    height: 176,
    rx: 12,
    fill: TONE.paper,
    stroke: TONE.line,
    "stroke-width": 1.4,
  });
  el(
    actGroup,
    "text",
    { x: 42, y: 146, "font-size": 14.5, "font-weight": 700, fill: TONE.tokenInk },
    "激活 X · 每次前向在线量化",
  );
  el(
    actGroup,
    "text",
    { x: 380, y: 146, "text-anchor": "end", "font-size": 13, fill: TONE.tokenInk, class: "quant-mono" },
    "sₓ = 0.01",
  );
  const xBoxes = QUANT.x.map((val, i) => {
    const x = 42 + i * 116;
    const rect = el(actGroup, "rect", {
      x,
      y: 160,
      width: 104,
      height: 38,
      rx: 7,
      fill: TONE.tokenSoft,
      stroke: TONE.token,
      "stroke-width": 1.2,
    });
    const txt = el(
      actGroup,
      "text",
      {
        x: x + 52,
        y: 185,
        "text-anchor": "middle",
        "font-size": 15,
        "font-weight": 650,
        fill: TONE.tokenInk,
        class: "quant-value quant-mono",
      },
      String(val),
    );
    return { rect, txt };
  });
  const actOp = el(
    actGroup,
    "text",
    { x: 211, y: 218, "text-anchor": "middle", "font-size": 12.5, fill: TONE.muted },
    "÷ 0.01 后四舍五入（0.523 → 52）",
  );
  const qxBoxes = QUANT.qx.map((_, i) => {
    const x = 42 + i * 116;
    const rect = el(actGroup, "rect", {
      x,
      y: 232,
      width: 104,
      height: 42,
      rx: 7,
      fill: TONE.sunken,
      stroke: TONE.line,
      "stroke-width": 1.2,
    });
    const txt = el(actGroup, "text", {
      x: x + 52,
      y: 259,
      "text-anchor": "middle",
      "font-size": 16,
      "font-weight": 700,
      fill: TONE.ink,
      class: "quant-value quant-mono",
    });
    return { rect, txt };
  });

  // Row 1 Right: Weight W (offline per-column)
  const wGroup = makeHit(1);
  const wCard = el(wGroup, "rect", {
    class: "quant-card-bg",
    x: 422,
    y: 120,
    width: 374,
    height: 176,
    rx: 12,
    fill: TONE.paper,
    stroke: TONE.line,
    "stroke-width": 1.4,
  });
  el(
    wGroup,
    "text",
    { x: 440, y: 146, "font-size": 14.5, "font-weight": 700, fill: TONE.weightInk },
    "权重 W · 部署前离线量化",
  );
  el(
    wGroup,
    "text",
    { x: 778, y: 146, "text-anchor": "end", "font-size": 13, fill: TONE.weightInk, class: "quant-mono" },
    "s𝑤 = 0.02",
  );
  const wBoxes = QUANT.w.map((val, i) => {
    const x = 440 + i * 116;
    const rect = el(wGroup, "rect", {
      x,
      y: 160,
      width: 104,
      height: 38,
      rx: 7,
      fill: TONE.weightSoft,
      stroke: TONE.weight,
      "stroke-width": 1.2,
    });
    const txt = el(
      wGroup,
      "text",
      {
        x: x + 52,
        y: 185,
        "text-anchor": "middle",
        "font-size": 15,
        "font-weight": 650,
        fill: TONE.weightInk,
        class: "quant-value quant-mono",
      },
      String(val),
    );
    return { rect, txt };
  });
  const wOp = el(
    wGroup,
    "text",
    { x: 609, y: 218, "text-anchor": "middle", "font-size": 12.5, fill: TONE.muted },
    "÷ 0.02 离线存盘 · 推理时直接复用",
  );
  const qwBoxes = QUANT.qw.map((_, i) => {
    const x = 440 + i * 116;
    const rect = el(wGroup, "rect", {
      x,
      y: 232,
      width: 104,
      height: 42,
      rx: 7,
      fill: TONE.sunken,
      stroke: TONE.line,
      "stroke-width": 1.2,
    });
    const txt = el(wGroup, "text", {
      x: x + 52,
      y: 259,
      "text-anchor": "middle",
      "font-size": 16,
      "font-weight": 700,
      fill: TONE.ink,
      class: "quant-value quant-mono",
    });
    return { rect, txt };
  });

  // Row 2 Left: 3 clickable channel multiply rows
  const prodBg = el(svg, "rect", {
    x: 24,
    y: 312,
    width: 512,
    height: 212,
    rx: 12,
    fill: TONE.paper,
    stroke: TONE.line,
    "stroke-width": 1.4,
  });
  el(
    svg,
    "text",
    { x: 42, y: 338, "font-size": 14.5, "font-weight": 700, fill: TONE.ink },
    "逐通道 INT8 整数乘积（点击任意通道定位）",
  );
  const chRows = [0, 1, 2].map((i) => {
    const y = 354 + i * 54;
    const g = makeHit(3, (i + 0.85) / 3);
    const rowBg = el(g, "rect", {
      class: "quant-card-bg",
      x: 38,
      y,
      width: 484,
      height: 44,
      rx: 8,
      fill: TONE.sunken,
      stroke: "transparent",
      "stroke-width": 1.6,
    });
    el(g, "text", { x: 54, y: y + 27, "font-size": 13.5, "font-weight": 650, fill: TONE.muted }, `通道 ${i}`);
    const qxPill = el(g, "rect", {
      x: 112,
      y: y + 6,
      width: 84,
      height: 32,
      rx: 6,
      fill: TONE.tokenSoft,
      stroke: TONE.token,
    });
    const qxText = el(g, "text", {
      x: 154,
      y: y + 27,
      "text-anchor": "middle",
      "font-size": 15,
      "font-weight": 650,
      fill: TONE.tokenInk,
      class: "quant-mono",
    });
    el(
      g,
      "text",
      { x: 212, y: y + 27, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: TONE.muted },
      "×",
    );
    const qwPill = el(g, "rect", {
      x: 228,
      y: y + 6,
      width: 84,
      height: 32,
      rx: 6,
      fill: TONE.weightSoft,
      stroke: TONE.weight,
    });
    const qwText = el(g, "text", {
      x: 270,
      y: y + 27,
      "text-anchor": "middle",
      "font-size": 15,
      "font-weight": 650,
      fill: TONE.weightInk,
      class: "quant-mono",
    });
    el(
      g,
      "text",
      { x: 328, y: y + 27, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: TONE.muted },
      "=",
    );
    const pPill = el(g, "rect", {
      x: 344,
      y: y + 6,
      width: 162,
      height: 32,
      rx: 6,
      fill: TONE.paper,
      stroke: TONE.line,
    });
    const pText = el(g, "text", {
      x: 425,
      y: y + 27,
      "text-anchor": "middle",
      "font-size": 16,
      "font-weight": 700,
      fill: TONE.kvInk,
      class: "quant-value quant-mono",
      "data-tensor": "逐通道乘积",
    });
    return { rowBg, qxPill, qxText, qwPill, qwText, pPill, pText };
  });

  // Row 2 Right: INT32 Wide Accumulator
  const accGroup = makeHit(4);
  const accCard = el(accGroup, "rect", {
    class: "quant-card-bg",
    x: 554,
    y: 312,
    width: 242,
    height: 212,
    rx: 12,
    fill: TONE.paper,
    stroke: TONE.line,
    "stroke-width": 1.4,
  });
  el(
    accGroup,
    "text",
    { x: 574, y: 340, "font-size": 14.5, "font-weight": 700, fill: TONE.kvInk },
    "INT32 宽整数累加器",
  );
  const accBox = el(accGroup, "rect", {
    x: 574,
    y: 358,
    width: 202,
    height: 76,
    rx: 10,
    fill: TONE.sunken,
    stroke: TONE.line,
    "stroke-width": 1.5,
  });
  const accText = el(accGroup, "text", {
    x: 675,
    y: 407,
    "text-anchor": "middle",
    "font-size": 28,
    "font-weight": 700,
    fill: TONE.kvInk,
    class: "quant-value quant-mono",
  });
  const warnBox = el(accGroup, "rect", {
    x: 574,
    y: 450,
    width: 202,
    height: 56,
    rx: 8,
    fill: TONE.dangerSoft,
    stroke: TONE.danger,
    "stroke-opacity": 0.45,
  });
  el(
    accGroup,
    "text",
    { x: 675, y: 472, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: TONE.danger },
    "10438 >> INT8 上限 127",
  );
  el(
    accGroup,
    "text",
    { x: 675, y: 493, "text-anchor": "middle", "font-size": 12.5, fill: TONE.danger },
    "累加器不能用 8 位，须宽整数",
  );

  // Row 3 Left: Dequantize + error attribution
  const deqGroup = makeHit(5);
  const deqCard = el(deqGroup, "rect", {
    class: "quant-card-bg",
    x: 24,
    y: 542,
    width: 488,
    height: 194,
    rx: 12,
    fill: TONE.paper,
    stroke: TONE.line,
    "stroke-width": 1.4,
  });
  el(
    deqGroup,
    "text",
    { x: 42, y: 570, "font-size": 14.5, "font-weight": 700, fill: TONE.commInk },
    "末步乘回行、列双缩放系数（反量化）",
  );
  const deqFormula = el(
    deqGroup,
    "text",
    { x: 42, y: 622, "font-size": 16, "font-weight": 600, fill: TONE.ink, class: "quant-mono" },
    "10438 × 0.01 × 0.02 =",
  );
  const deqBox = el(deqGroup, "rect", {
    x: 288,
    y: 590,
    width: 204,
    height: 52,
    rx: 9,
    fill: TONE.sunken,
    stroke: TONE.line,
    "stroke-width": 1.5,
  });
  const deqText = el(deqGroup, "text", {
    x: 390,
    y: 625,
    "text-anchor": "middle",
    "font-size": 24,
    "font-weight": 700,
    fill: TONE.commInk,
    class: "quant-value quant-mono",
  });
  const auditBg = el(deqGroup, "rect", { x: 42, y: 658, width: 450, height: 60, rx: 8, fill: TONE.sunken });
  const auditTop = el(
    deqGroup,
    "text",
    { x: 56, y: 682, "font-size": 13.5, "font-weight": 650, fill: TONE.ink },
    "BF16 原数精算：2.0888　｜　绝对误差：待比较",
  );
  el(
    deqGroup,
    "text",
    { x: 56, y: 704, "font-size": 12.5, fill: TONE.muted },
    "误差来源：仅通道 0 的 0.523 舍入为 0.52（0.003 × 0.40 = 0.0012）",
  );

  // Row 3 Right: Payload comparison
  const byteGroup = makeHit(6);
  const byteCard = el(byteGroup, "rect", {
    class: "quant-card-bg",
    x: 530,
    y: 542,
    width: 266,
    height: 194,
    rx: 12,
    fill: TONE.paper,
    stroke: TONE.line,
    "stroke-width": 1.4,
  });
  el(
    byteGroup,
    "text",
    { x: 548, y: 570, "font-size": 14.5, "font-weight": 700, fill: TONE.ink },
    "6 个元素的载荷对比",
  );
  el(
    byteGroup,
    "text",
    { x: 548, y: 602, "font-size": 13, fill: TONE.weightInk, "font-weight": 650 },
    "BF16 · 6 × 2 B = 12 B",
  );
  el(byteGroup, "rect", { x: 548, y: 612, width: 226, height: 16, rx: 4, fill: TONE.weight });
  el(
    byteGroup,
    "text",
    { x: 548, y: 654, "font-size": 13, fill: TONE.tokenInk, "font-weight": 650 },
    "INT8 · 6 × 1 B = 6 B（−50%）",
  );
  el(byteGroup, "rect", { x: 548, y: 664, width: 226, height: 16, rx: 4, fill: TONE.sunken });
  const int8Bar = el(byteGroup, "rect", { x: 548, y: 664, width: 113, height: 16, rx: 4, fill: TONE.token });
  el(
    byteGroup,
    "text",
    { x: 548, y: 712, "font-size": 12.5, fill: TONE.muted },
    "缩放系数、累加区与工作区另计",
  );

  const animate = (p: number) => {
    const f = quantState(p);
    const activeMultiply = f.phase === 3 && f.products < 3;
    bannerRect.setAttribute(
      "fill",
      activeMultiply ? TONE.weightSoft : f.restored ? TONE.tokenSoft : TONE.sunken,
    );
    bannerRect.setAttribute("stroke", activeMultiply ? TONE.weight : f.restored ? TONE.token : TONE.line);
    bannerDot.setAttribute("fill", activeMultiply ? TONE.weight : f.restored ? TONE.token : TONE.kv);
    bannerText.textContent =
      f.phase === 0
        ? "第 1 步 · 原数与缩放系数：激活按行取 sₓ=0.01，权重按列取 s𝑤=0.02"
        : f.phase === 1
          ? "第 2 步 · 权重离线量化：w ÷ 0.02 → [20, −127, 43]（部署前完成）"
          : f.phase === 2
            ? "第 3 步 · 激活在线量化：x ÷ 0.01 → [52, −31, 127]（0.523 舍入为 52）"
            : f.phase === 3
              ? activeMultiply
                ? `第 4 步 · INT8 乘加进行中：通道 ${f.channel}（${QUANT.qx[f.channel]} × ${QUANT.qw[f.channel]}）`
                : "第 4 步 · 三个通道整数乘积已全部落位（1040、3937、5461）"
              : f.phase === 4
                ? `第 5 步 · INT32 宽整数累加：1040 + 3937 + 5461 = ${f.summed ? "10438" : "…"}`
                : f.phase === 5
                  ? `第 6 步 · 乘回双系数：10438 × 0.01 × 0.02 = ${f.restored ? "2.0876" : "…"}`
                  : "第 7 步 · 核对完成：误差 0.0012，6 元素存储由 12 B 降至 6 B";

    actCard.setAttribute("stroke", f.phase === 2 ? TONE.token : activeMultiply ? TONE.weight : TONE.line);
    actCard.setAttribute("stroke-width", f.phase === 2 || activeMultiply ? "2" : "1.4");
    wCard.setAttribute("stroke", f.phase === 1 ? TONE.weight : activeMultiply ? TONE.weight : TONE.line);
    wCard.setAttribute("stroke-width", f.phase === 1 || activeMultiply ? "2" : "1.4");
    prodBg.setAttribute("stroke", f.phase === 3 ? TONE.kv : TONE.line);
    accCard.setAttribute("stroke", f.phase === 4 ? TONE.kv : TONE.line);
    deqCard.setAttribute("stroke", f.phase === 5 ? TONE.comm : TONE.line);
    byteCard.setAttribute("stroke", f.phase === 6 ? TONE.token : TONE.line);

    actOp.setAttribute("fill", f.phase === 2 ? TONE.tokenInk : TONE.muted);
    wOp.setAttribute("fill", f.phase === 1 ? TONE.weightInk : TONE.muted);

    QUANT.qx.forEach((v, i) => {
      const focus = activeMultiply && f.channel === i;
      xBoxes[i]!.rect.setAttribute("stroke-width", focus ? "2.4" : "1.2");
      qxBoxes[i]!.txt.textContent = f.activation ? String(v) : "";
      qxBoxes[i]!.rect.setAttribute(
        "fill",
        f.activation ? (focus ? TONE.token : TONE.tokenSoft) : TONE.sunken,
      );
      qxBoxes[i]!.rect.setAttribute("stroke", f.activation ? TONE.token : TONE.line);
      qxBoxes[i]!.rect.setAttribute("stroke-width", focus ? "2.4" : "1.2");
      qxBoxes[i]!.txt.setAttribute("fill", focus ? "#ffffff" : TONE.tokenInk);
    });
    QUANT.qw.forEach((v, i) => {
      const focus = activeMultiply && f.channel === i;
      wBoxes[i]!.rect.setAttribute("stroke-width", focus ? "2.4" : "1.2");
      qwBoxes[i]!.txt.textContent = f.weights ? String(v) : "";
      qwBoxes[i]!.rect.setAttribute(
        "fill",
        f.weights ? (focus ? TONE.weight : TONE.weightSoft) : TONE.sunken,
      );
      qwBoxes[i]!.rect.setAttribute("stroke", f.weights ? TONE.weight : TONE.line);
      qwBoxes[i]!.rect.setAttribute("stroke-width", focus ? "2.4" : "1.2");
      qwBoxes[i]!.txt.setAttribute("fill", focus ? "#ffffff" : TONE.weightInk);
    });

    chRows.forEach((row, i) => {
      const active = f.phase === 3 && f.channel === i && f.products <= i;
      const done = i < f.products;
      row.rowBg.setAttribute("fill", active ? TONE.kvSoft : done ? "#f4f6fb" : TONE.sunken);
      row.rowBg.setAttribute("stroke", active ? TONE.kv : "transparent");
      row.qxText.textContent = f.activation ? String(QUANT.qx[i]) : "—";
      row.qwText.textContent = f.weights ? String(QUANT.qw[i]) : "—";
      row.qxPill.setAttribute("opacity", f.activation ? "1" : "0.45");
      row.qwPill.setAttribute("opacity", f.weights ? "1" : "0.45");
      row.pPill.setAttribute("fill", done ? TONE.kv : active ? TONE.kvSoft : TONE.paper);
      row.pPill.setAttribute("stroke", done || active ? TONE.kv : TONE.line);
      row.pText.setAttribute("fill", done ? "#ffffff" : TONE.kvInk);
      row.pText.textContent = done ? String(QUANT.products[i]) : "";
    });

    accBox.setAttribute("fill", f.summed ? TONE.kv : f.phase === 4 ? TONE.kvSoft : TONE.sunken);
    accBox.setAttribute("stroke", f.summed || f.phase === 4 ? TONE.kv : TONE.line);
    accText.setAttribute("fill", f.summed ? "#ffffff" : TONE.kvInk);
    accText.textContent = f.summed ? String(QUANT.sum) : "";
    warnBox.setAttribute("opacity", f.phase >= 4 || f.products > 0 ? "1" : "0.4");

    deqFormula.setAttribute("opacity", f.summed ? "1" : "0.45");
    deqBox.setAttribute("fill", f.restored ? TONE.comm : f.phase === 5 ? TONE.commSoft : TONE.sunken);
    deqBox.setAttribute("stroke", f.restored || f.phase === 5 ? TONE.comm : TONE.line);
    deqText.setAttribute("fill", f.restored ? "#ffffff" : TONE.commInk);
    deqText.textContent = f.restored ? QUANT.restored.toFixed(4) : "";
    auditBg.setAttribute("fill", f.phase === 6 ? TONE.tokenSoft : TONE.sunken);
    auditTop.textContent = f.restored
      ? "BF16 原数精算：2.0888　｜　绝对误差：0.0012"
      : "BF16 原数精算：2.0888　｜　绝对误差：待反量化";
    int8Bar.setAttribute("opacity", f.activation && f.weights ? "1" : "0.35");
  };

  return {
    animate,
    reset() {},
    dispose() {
      svg.remove();
    },
  };
}
