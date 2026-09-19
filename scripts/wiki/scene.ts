/**
 * 画面渲染器：一套有语义的图元，每张图自己摆。
 *
 * 为什么只剩这一种版式（2026-09-19）：先做的 flow 版式是「方块 + 自动折线」，
 * 毛病是**位置不携带信息**——方块挪到哪儿含义都一样，所以画出来是带边框的表格，
 * 不是图。用户的原话是「只有一个一个方块连着，这叫啥图」。
 *
 * 这里每个图元都对应现实中的一种东西，位置和面积本身就是内容：
 * - `regions` 地盘：落在哪块地里就代表归谁；
 * - `bands`   分层带：上下关系就是「谁在谁之上」，适合画栈；
 * - `boundaries` 界线：跨过它就换了责任方 / 换了进程；
 * - `spines` 时间轴 + `stops` 站点：轴上的先后就是发生的先后；
 * - `strips` 真实格子：格子数就是真实数量，高亮某格就是「落在这里」；
 * - `boxes` 卡片、`arrows` 箭头、`brackets` 括号、`pills` 端点、`notes` 旁注。
 *
 * 坐标全部手写。自动布局是上一版失败的根因，不要加回来。
 *
 * 字号纪律（2026-09-19 第二轮）：画布宽度按阅读栏实际宽度定（900），渲染时基本
 * 1:1，不再被缩到 0.78 倍；同时全图最小字号 12.5、标题 15、等宽 12.5。
 * 「字体不清晰」是缩放造成的，不是字体造成的。
 */

import type { SceneSpec, Tone } from "./diagrams";

const TONE: Record<Tone, string> = {
  upstream: "var(--color-control, #5b6763)",
  ascend: "var(--color-weight, #b87a00)",
  accent: "var(--color-accent, #e85b32)",
  neutral: "var(--color-kv, #4c65b6)",
  muted: "var(--color-ink-faint, #8a928f)",
};

const SOFT: Record<Tone, string> = {
  upstream: "var(--color-surface-sunken, #ece9df)",
  ascend: "var(--color-weight-soft, #fff4cf)",
  accent: "var(--color-accent-soft, #fff0e9)",
  neutral: "var(--color-kv-soft, #e8edff)",
  muted: "var(--color-canvas, #f5f2ea)",
};

const INK = "var(--color-ink, #17211f)";
const DIM = "var(--color-ink-muted, #5b6763)";
const SURFACE = "var(--color-surface, #fbfaf6)";
const INVERSE = "var(--color-ink-inverse, #ffffff)";
const FONT = "'Inter Variable','Noto Sans SC',system-ui,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,monospace";

/** 反引号在图上没有意义，漏出来就是画在图上的一个符号——一律去掉。 */
function esc(t: string): string {
  return t
    .replace(/`/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 文字宽度估算：中日韩字符约 1em，拉丁字母约 0.56em，标点约 0.4em。
 * 首版用 `label.length * 常数` 算胶囊宽度，中英混排时忽宽忽窄、还会裁掉半个字。
 */
function textWidth(s: string, size: number): number {
  let em = 0;
  for (const ch of s) {
    if (/[⺀-鿿＀-￯　-〿]/.test(ch)) em += 1;
    else if (/[A-Za-z0-9@_]/.test(ch)) em += 0.56;
    else em += 0.4;
  }
  return em * size;
}

/** 等宽字体每个字符 0.6em；用正文字体的估宽（0.56em）会让长标识符顶出边框，溢出检查也查不出来 */
const chipTextWidth = (text: string, size: number) =>
  Math.max(textWidth(text, size), [...text].length * 0.6 * size);

/** 按像素宽度断行。中日韩字符可在任意位置断，拉丁单词整体不拆。 */
function wrap(text: string, size: number, maxWidth: number): string[] {
  const atoms: string[] = [];
  let latin = "";
  for (const ch of text) {
    if (/[A-Za-z0-9_.:/@-]/.test(ch)) {
      latin += ch;
      continue;
    }
    if (latin) {
      atoms.push(latin);
      latin = "";
    }
    atoms.push(ch);
  }
  if (latin) atoms.push(latin);

  const lines: string[] = [];
  let cur = "";
  for (const atom of atoms) {
    const next = cur + atom;
    if (cur && textWidth(next, size) > maxWidth) {
      lines.push(cur);
      cur = atom === " " ? "" : atom;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

/**
 * 画出来的「墨」。背景块（地盘、分层带）不算墨——它们本来就是用来装东西的；
 * 文字、胶囊、图标方片、卡片才算。两块墨重叠就是画错了。
 */
export interface InkBox {
  where: string;
  what: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

let ink: InkBox[] = [];
let inkWhere = "";

function inkText(x: number, y: number, t: string, size: number, anchor?: string, mono = false): void {
  const w = mono ? chipTextWidth(t, size) : textWidth(t, size);
  const left = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  // y 是基线；字面大约在基线上方 0.78em 到下方 0.22em 之间
  ink.push({ where: inkWhere, what: t, x: left, y: y - size * 0.78, w, h: size });
}

function inkRect(what: string, x: number, y: number, w: number, h: number): void {
  ink.push({ where: inkWhere, what, x, y, w, h });
}

interface TextOpts {
  size?: number;
  fill?: string;
  weight?: number;
  mono?: boolean;
  anchor?: "start" | "middle" | "end";
}

function label(x: number, y: number, s: string, o: TextOpts = {}): string {
  const anchor = o.anchor ? ` text-anchor="${o.anchor}"` : "";
  inkText(x, y, s, o.size ?? 13.5, o.anchor, o.mono);
  return `<text x="${round(x)}" y="${round(y)}" font-family="${o.mono ? MONO : FONT}" font-size="${o.size ?? 13.5}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? INK}"${anchor}>${esc(s)}</text>`;
}

/** 实色胶囊 + 反白字：「这是一块地的名字」「这是入口 / 出口」。 */
function chip(x: number, y: number, text: string, fill: string, size = 13.5): string {
  const w = textWidth(text, size) + 22;
  const h = size + 13;
  inkRect(text, x, y, w, h);
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${round(h / 2)}" fill="${fill}"/>${label(x + 11, y + h / 2 + size * 0.36, text, { size, weight: 700, fill: INVERSE })}`;
}

/** 白底描边小胶囊，专放函数名 / 文件名。白底是必须的——用地盘色会和底色糊在一起。 */
function codeChip(cx: number, y: number, text: string, tone: string, size = 12.5): string {
  const w = chipTextWidth(text, size) + 18;
  const h = size + 9;
  inkRect(text, cx - w / 2, y - h + 4, w, h);
  return `<rect x="${round(cx - w / 2)}" y="${round(y - h + 4)}" width="${round(w)}" height="${round(h)}" rx="${round(h / 2)}" fill="${SURFACE}" stroke="${tone}" stroke-width="1"/>${label(cx, y, text, { size, fill: tone, anchor: "middle", mono: true })}`;
}

/**
 * 站点图标。极简线条，画在 24×24 的格子里，调用方给中心点。
 * 不引图标库：引进来要么风格不统一，要么跟不上主题色。
 */
const ICON: Record<string, string> = {
  queue: "M3 6h18M3 12h12M3 18h7",
  split: "M4 12h6m0 0l-4-4m4 4l-4 4M14 5h6v6h-6zM14 13h6v6h-6z",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  pick: "M12 3l8 5v8l-8 5-8-5V8z M12 3v18",
  slot: "M3 8h18v8H3z M9 8v8M15 8v8",
  chip: "M7 7h10v10H7z M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
  plug: "M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0z M12 18v3",
  patch: "M4 4h9v9H4z M11 11h9v9h-9z M13 4l7 7",
  proc: "M4 5h16v14H4z M4 9h16M8 5v4",
  file: "M6 3h8l4 4v14H6z M14 3v4h4",
  layers: "M12 3l9 5-9 5-9-5z M3 13l9 5 9-5",
  graph: "M5 19V9M12 19V5M19 19v-7M3 21h18",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16 16l5 5",
  diff: "M6 3v14M18 7v14M6 7c0 6 12 2 12 8",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
  calc: "M5 3h14v18H5z M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2",
  gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  box: "M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5M12 12v10",
  text: "M4 6h16M4 12h16M4 18h10",
};

function icon(name: string | undefined, cx: number, cy: number, color: string, scale = 1): string {
  const d = name ? ICON[name] : undefined;
  if (!d) return "";
  return `<g transform="translate(${round(cx - 12 * scale)} ${round(cy - 12 * scale)}) scale(${scale})" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`;
}

type Dir = "right" | "left" | "down" | "up";

function arrowHead(x: number, y: number, dir: Dir, fill: string, s = 7): string {
  const d =
    dir === "right"
      ? `M${round(x)} ${round(y)} l-${2 * s} -${s} l0 ${2 * s} z`
      : dir === "left"
        ? `M${round(x)} ${round(y)} l${2 * s} -${s} l0 ${2 * s} z`
        : dir === "down"
          ? `M${round(x)} ${round(y)} l-${s} -${2 * s} l${2 * s} 0 z`
          : `M${round(x)} ${round(y)} l-${s} ${2 * s} l${2 * s} 0 z`;
  return `<path d="${d}" fill="${fill}"/>`;
}

export function renderScene(spec: SceneSpec): string {
  ink = [];
  inkWhere = "";
  const [W, H] = spec.size;
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="${SURFACE}"/>`];

  // ---- 地盘：有面积的底色，不是一个边框。落在哪块地里就代表归谁。
  for (const [ri, r] of spec.regions.entries()) {
    inkWhere = `regions[${ri}]`;
    const [x, y] = r.at;
    const [w, h] = r.size;
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${SOFT[r.tone]}"/>`);
    if (r.chip !== "none") {
      const cy = r.chip === "bottom" ? y + h - 42 : y + 14;
      parts.push(chip(x + 16, cy, r.label, TONE[r.tone]));
      // 地盘名下面那行注要跟着地盘宽度断行，否则长句会伸到地盘外面
      if (r.note)
        for (const [i, ln] of wrap(r.note, 12.5, w - 36).entries())
          parts.push(label(x + 18, cy + 43 + i * 18, ln, { size: 12.5, fill: DIM }));
    }
  }

  // ---- 分层带：上下关系就是「谁在谁之上」
  for (const [bi, b] of spec.bands.entries()) {
    inkWhere = `bands[${bi}]`;
    const [x, y] = b.at;
    const [w, h] = b.size;
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${SOFT[b.tone]}"/>`,
      `<rect x="${x}" y="${y}" width="5" height="${h}" rx="2.5" fill="${TONE[b.tone]}"/>`,
      b.icon ? `${icon(b.icon, x + 34, y + h / 2, TONE[b.tone], 0.85)}` : "",
      label(x + (b.icon ? 58 : 22), y + (b.sub ? h / 2 - 3 : h / 2 + 5), b.label, {
        size: 15,
        weight: 700,
        fill: INK,
      }),
      b.sub ? label(x + (b.icon ? 58 : 22), y + h / 2 + 17, b.sub, { size: 12.5, fill: DIM }) : "",
      b.fn
        ? codeChip(x + w - chipTextWidth(b.fn, 12.5) / 2 - 28, y + h / 2 + 5, b.fn, TONE[b.tone])
        : b.right
          ? label(x + w - 16, y + h / 2 + 5, b.right, { size: 12.5, fill: DIM, anchor: "end" })
          : "",
    );
  }

  // ---- 时间轴。分段换色处就是责任交接处：这条线既是装饰也是内容。
  for (const s of spec.spines) {
    let from = s.from;
    const segs = [...s.segments, { x: s.to, tone: s.tone }];
    for (const seg of segs) {
      if (seg.x <= from) continue;
      parts.push(
        s.vertical
          ? `<line x1="${s.y}" y1="${from}" x2="${s.y}" y2="${seg.x}" stroke="${TONE[seg.tone]}" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>`
          : `<line x1="${from}" y1="${s.y}" x2="${seg.x}" y2="${s.y}" stroke="${TONE[seg.tone]}" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>`,
      );
      from = seg.x;
    }
    const last = segs[segs.length - 1]!;
    if (s.arrow !== false)
      parts.push(
        s.vertical
          ? arrowHead(s.y, s.to, "down", TONE[last.tone])
          : arrowHead(s.to, s.y, "right", TONE[last.tone]),
      );
  }

  // ---- 界线：跨过它就换了责任方 / 换了进程
  for (const [byi, b] of spec.boundaries.entries()) {
    inkWhere = `boundaries[${byi}]`;
    if (b.vertical !== false)
      parts.push(
        `<line x1="${b.at}" y1="${b.from}" x2="${b.at}" y2="${b.to}" stroke="${TONE.accent}" stroke-width="2.5" stroke-dasharray="7 5"/>`,
        label(b.at, b.from - 11, b.label, { size: 13, weight: 700, fill: TONE.accent, anchor: "middle" }),
      );
    else
      parts.push(
        `<line x1="${b.from}" y1="${b.at}" x2="${b.to}" y2="${b.at}" stroke="${TONE.accent}" stroke-width="2.5" stroke-dasharray="7 5"/>`,
        label(b.to - 4, b.at - 9, b.label, { size: 13, weight: 700, fill: TONE.accent, anchor: "end" }),
      );
  }

  // ---- 真实格子：格子数就是真实数量，高亮某格就是「落在这里」
  for (const [si, s] of spec.strips.entries()) {
    inkWhere = `strips[${si}]`;
    const cw = s.cell ?? 22;
    const ch = s.h ?? cw;
    const gap = s.gap ?? 3;
    const tiny = cw < 6;
    const on = new Set(s.highlights);
    if (s.highlight !== undefined) on.add(s.highlight);
    for (let i = 0; i < s.cells; i++) {
      const x = s.vertical ? s.at[0] : s.at[0] + i * (cw + gap);
      const y = s.vertical ? s.at[1] + i * (ch + gap) : s.at[1];
      parts.push(
        // 细格子不描边：3px 宽的格子配 0.5px 描边，整排会糊成斜纹。
        // 细的用实色加透明度区分选中，粗的才用「浅底 + 描边」。
        tiny
          ? `<rect x="${round(x)}" y="${round(y)}" width="${cw}" height="${ch}" fill="${TONE[s.tone]}" opacity="${on.has(i) ? 1 : 0.5}"/>`
          : `<rect x="${round(x)}" y="${round(y)}" width="${cw}" height="${ch}" rx="3" fill="${on.has(i) ? TONE[s.tone] : SOFT[s.tone]}" stroke="${TONE[s.tone]}" stroke-width="1.1"/>`,
      );
    }
    const len = s.cells * (cw + gap) - gap;
    const across = s.cells * ((s.vertical ? ch : cw) + gap) - gap;
    // overlay 是刻度条上的填充，本来就该盖在上一条上，不算撞
    if (!s.overlay)
      inkRect(
        s.label ?? `${s.cells} 格`,
        s.at[0],
        s.at[1],
        s.vertical ? cw : across,
        s.vertical ? across : ch,
      );
    if (s.label) {
      const lx = s.vertical ? s.at[0] + cw + 10 : s.at[0];
      const ly = s.vertical ? s.at[1] + 14 : s.at[1] + ch + 18;
      parts.push(label(lx, ly, s.label, { size: 12.5, fill: DIM }));
    }
    if (s.linkTo && !s.vertical)
      parts.push(
        `<line x1="${round(s.at[0] + len / 2)}" y1="${s.at[1] + ch + 26}" x2="${s.linkTo[0]}" y2="${s.linkTo[1]}" stroke="${TONE[s.tone]}" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>`,
      );
  }

  // ---- 卡片：一个有名字、有出处的东西
  for (const [bxi, b] of spec.boxes.entries()) {
    inkWhere = `boxes[${bxi}]`;
    const [x, y] = b.at;
    const [w, h] = b.size;
    const tone = TONE[b.tone];
    const hasIcon = Boolean(b.icon);
    const tx = hasIcon ? x + 52 : x + 16;
    const lines = wrap(b.title, 14.5, w - (hasIcon ? 68 : 32));
    const extra = (b.sub ? 17 : 0) + (b.fn ? 17 : 0);
    const base = y + h / 2 - ((lines.length - 1) * 18) / 2 - extra / 2 + 5;
    inkRect(b.title, x, y, w, h);
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" fill="${SURFACE}" stroke="${tone}" stroke-width="1.5"/>`,
      hasIcon
        ? `<rect x="${x + 12}" y="${round(y + h / 2 - 16)}" width="32" height="32" rx="9" fill="${SOFT[b.tone]}"/>${icon(b.icon, x + 28, y + h / 2, tone, 0.8)}`
        : "",
      ...lines.map((ln, i) => label(tx, base + i * 18, ln, { size: 14.5, weight: 700, fill: INK })),
      b.sub ? label(tx, base + lines.length * 18, b.sub, { size: 12.5, fill: DIM }) : "",
      b.fn
        ? label(tx, base + lines.length * 18 + (b.sub ? 17 : 0), b.fn, { size: 12.5, fill: tone, mono: true })
        : "",
    );
  }

  // ---- 轴上的站点
  for (const [sti, stop] of spec.stops.entries()) {
    inkWhere = `stops[${sti}]`;
    const axis = (spec.spines[stop.spine] ?? spec.spines[0])?.y ?? 0;
    const up = stop.side === "above";
    const tone = TONE[stop.tone];
    const stem = up ? axis - 28 : axis + 28;
    const iconY = up ? stem - 21 : stem + 21;
    const titleY = up ? iconY - 31 : iconY + 37;
    const detailY = titleY + (up ? -19 : 19);
    const fnY = (stop.detail ? detailY : titleY) + (up ? -22 : 22);
    inkRect(stop.title, stop.x - 20, iconY - 20, 40, 40);
    parts.push(
      `<line x1="${stop.x}" y1="${axis}" x2="${stop.x}" y2="${stem}" stroke="${tone}" stroke-width="1.5" opacity="0.5"/>`,
      `<circle cx="${stop.x}" cy="${axis}" r="9" fill="${SURFACE}"/>`,
      `<circle cx="${stop.x}" cy="${axis}" r="5.5" fill="${tone}"/>`,
      `<rect x="${stop.x - 20}" y="${iconY - 20}" width="40" height="40" rx="12" fill="${SURFACE}" stroke="${tone}" stroke-width="1.4"/>`,
      icon(stop.icon, stop.x, iconY, tone),
      label(stop.x, titleY, stop.title, { size: 15, weight: 700, fill: INK, anchor: "middle" }),
      stop.detail ? label(stop.x, detailY, stop.detail, { size: 12.5, fill: DIM, anchor: "middle" }) : "",
      stop.fn ? codeChip(stop.x, fnY, stop.fn, tone) : "",
    );
  }

  // ---- 自由箭头
  for (const [ai, a] of spec.arrows.entries()) {
    inkWhere = `arrows[${ai}]`;
    const tone = TONE[a.tone];
    const pts: [number, number][] = [a.from, ...a.via, a.to];
    const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
    const [px, py] = pts[pts.length - 2]!;
    const [qx, qy] = a.to;
    const dir: Dir =
      Math.abs(qx - px) >= Math.abs(qy - py) ? (qx >= px ? "right" : "left") : qy >= py ? "down" : "up";
    parts.push(
      `<path d="${d}" fill="none" stroke="${tone}" stroke-width="1.8"${a.style === "dashed" ? ' stroke-dasharray="6 4"' : ""}/>`,
      arrowHead(qx, qy, dir, tone, 5.5),
    );
    if (a.label) {
      const i = Math.floor((pts.length - 1) / 2);
      const mx = (pts[i]![0] + pts[i + 1]![0]) / 2;
      const my = (pts[i]![1] + pts[i + 1]![1]) / 2;
      const w = textWidth(a.label, 12.5) + 12;
      inkRect(a.label, mx - w / 2, my - 10, w, 19);
      parts.push(
        `<rect x="${round(mx - w / 2)}" y="${round(my - 10)}" width="${round(w)}" height="19" rx="6" fill="${SURFACE}"/>`,
        label(mx, my + 4, a.label, { size: 12.5, fill: DIM, anchor: "middle" }),
      );
    }
  }

  // ---- 括号：圈住一段范围并给它一个名字
  for (const [bri, b] of spec.brackets.entries()) {
    inkWhere = `brackets[${bri}]`;
    const [x, y] = b.at;
    const tone = TONE[b.tone];
    const vertical = b.dir === "left";
    const d = vertical
      ? `M${x + 8} ${y} l-8 0 L${x} ${y + b.span} l8 0`
      : b.dir === "down"
        ? `M${x} ${y} l0 9 L${x + b.span} ${y + 9} l0 -9`
        : `M${x} ${y} l0 -9 L${x + b.span} ${y - 9} l0 9`;
    parts.push(
      `<path d="${d}" fill="none" stroke="${tone}" stroke-width="1.4" opacity="0.75"/>`,
      vertical
        ? label(x + 14, y + b.span / 2 + 5, b.label, { size: 12.5, weight: 600, fill: tone })
        : label(x + b.span / 2, b.dir === "down" ? y + 27 : y - 17, b.label, {
            size: 12.5,
            weight: 600,
            fill: tone,
            anchor: "middle",
          }),
    );
  }

  // ---- 进出口胶囊
  for (const [pi, p] of spec.pills.entries()) {
    inkWhere = `pills[${pi}]`;
    parts.push(chip(p.at[0] - (textWidth(p.text, 14) + 22) / 2, p.at[1] - 13.5, p.text, TONE[p.tone], 14));
  }

  // ---- 旁注
  for (const [ni, n] of spec.notes.entries()) {
    inkWhere = `notes[${ni}]`;
    const size = n.size ?? 12.5;
    for (const [i, ln] of wrap(n.text, size, n.width ?? W).entries())
      parts.push(
        label(n.at[0], n.at[1] + i * (size + 6), ln, {
          size,
          fill: n.strong ? INK : DIM,
          weight: n.strong ? 600 : 400,
          ...(n.anchor ? { anchor: n.anchor } : {}),
        }),
      );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.caption)}">
  <title>${esc(spec.caption)}</title>
  ${parts.filter(Boolean).join("\n  ")}
</svg>
`;
}

/**
 * 「图上的字有没有跑出框」的检查。
 *
 * 为什么要有：这个版式的坐标全是手写的，一句中文长了两个字就会压到隔壁，
 * 而渲染本身不会报错——第一版之所以难看，一半是这种看不见的溢出造成的。
 * 所以把它做成一条能失败的检查，而不是靠每次改完自己盯着看。
 *
 * 只查宽度；纵向压不压得到一起由 sceneCollisions 查。
 */
export function sceneOverflows(spec: SceneSpec): string[] {
  const out: string[] = [];
  const W = spec.size[0];
  const say = (where: string, text: string, limit: number, size: number, mono = false) => {
    const w = mono ? chipTextWidth(text, size) : textWidth(text, size);
    if (w > limit + 0.5)
      out.push(`${where}：「${text}」约 ${Math.round(w)}px，只放得下 ${Math.round(limit)}px`);
  };

  for (const [i, b] of spec.bands.entries()) {
    const textLeft = b.at[0] + (b.icon ? 58 : 22);
    // 右端那块被 fn 胶囊或 right 文字占着，正文最多写到它左边
    const rightTaken = b.fn ? chipTextWidth(b.fn, 12.5) + 46 : b.right ? textWidth(b.right, 12.5) + 24 : 16;
    const room = b.at[0] + b.size[0] - rightTaken - textLeft;
    say(`bands[${i}].label`, b.label, room, 15);
    if (b.sub) say(`bands[${i}].sub`, b.sub, room, 12.5);
  }

  for (const [i, b] of spec.boxes.entries()) {
    const room = b.size[0] - (b.icon ? 68 : 32);
    if (b.sub) say(`boxes[${i}].sub`, b.sub, room, 12.5);
    if (b.fn) say(`boxes[${i}].fn`, b.fn, room, 12.5, true);
  }

  for (const [i, r] of spec.regions.entries())
    if (r.chip !== "none") say(`regions[${i}].label`, r.label, r.size[0] - 54, 13.5);

  for (const [i, s] of spec.stops.entries()) {
    // 站点的字以 x 为中心，两边各占一半；跑出画布就是真跑出去了
    const half = Math.min(s.x, W - s.x);
    say(`stops[${i}].title`, s.title, half * 2 - 8, 15);
    if (s.detail) say(`stops[${i}].detail`, s.detail, half * 2 - 8, 12.5);
    if (s.fn) say(`stops[${i}].fn`, s.fn, half * 2 - 26, 12.5, true);
  }

  for (const [i, n] of spec.notes.entries()) {
    const size = n.size ?? 12.5;
    // 给了 width 就按 width 断行，只需看这个框放不放得下；没给就要按整句的实际宽度量，
    // 否则一句长旁注会安静地画到画布外面——第一版正是这样漏掉的。
    const w = n.width ?? textWidth(n.text, size);
    const left = n.anchor === "end" ? n.at[0] - w : n.anchor === "middle" ? n.at[0] - w / 2 : n.at[0];
    if (left < -0.5 || left + w > W + 0.5)
      out.push(
        `notes[${i}]：「${n.text.slice(0, 18)}…」落在 ${Math.round(left)}–${Math.round(left + w)}，画布只有 0–${W}`,
      );
  }

  return out;
}

/**
 * 「图上有没有两块东西压在一起」的检查。
 *
 * 为什么要有：sceneOverflows 只量宽度，它的第一版注释还写着「高度靠手摆，查不出
 * 有意义的结论」——这句话是错的。engine-core-loop 那张图里，轴上站点的字朝上堆，
 * 正好撞进地盘的标题胶囊和说明行：SVG 画得出来、检查全绿、看上去却糊成一团。
 * 手摆坐标就一定会撞，所以把「撞了」做成一条能失败的检查。
 *
 * 只认「墨」：背景块（地盘、分层带）本来就是拿来装东西的，不算。
 * 同一个元素自己的字和自己的胶囊当然重叠，按 where 跳过。
 */
export function sceneCollisions(spec: SceneSpec): string[] {
  renderScene(spec);
  const boxes = ink;
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (a.where === b.where) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      // 1px 以内当作描边挨着，不算压住
      if (ox <= 1 || oy <= 1) continue;
      const key = `${a.where}|${b.where}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        `${a.where} 压住 ${b.where}：「${a.what.slice(0, 14)}」与「${b.what.slice(0, 14)}」重叠 ${Math.round(ox)}×${Math.round(oy)}px`,
      );
    }
  }
  return out;
}
