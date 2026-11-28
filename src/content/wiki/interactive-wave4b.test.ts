import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  _compute_dcp_slot_mapping,
  CP_ATTN_MODES,
  CP_DCP_SIZES,
  CP_INTERLEAVE_SIZES,
  CP_INTERLEAVE_SLOTS_APPROVED_SHA256,
  CP_PCP_SIZES,
  CP_TP_SIZES,
  CpInterleaveSlotsInteractive,
  computeCpInterleaveState,
  computeDcpSlotMapping,
  computePrefillHeadTailPairs,
} from "./CpInterleaveSlotsInteractive";
import {
  advanceDpStepTick,
  computeDpSandboxState,
  DP_ARCH_MODES,
  DP_DUMMY_EXCLUSION_APPROVED_SHA256,
  DP_EXEC_PATHS,
  DP_WAVE_STEPS,
  DP_WORKLOAD_MODES,
  DpDummyExclusionInteractive,
} from "./DpDummyExclusionInteractive";
import { decodeXmlEntities, sanitizeDiagram } from "./diagram-sanitize";
import { sha256Hex } from "./interactive-diagrams";
import {
  advanceTpStepTick,
  computeTpGqaReplicationState,
  computeTpSandboxState,
  divide,
  formatTpVec,
  reduceTpViewSwitch,
  TP_GQA_MODELS,
  TP_GQA_SIZES,
  TP_PAIRING_MODES,
  TP_STEPS,
  TP_TWO_SPLITS_APPROVED_SHA256,
  TpTwoSplitsInteractive,
} from "./TpTwoSplitsInteractive";

interface MiniAttr {
  name: string;
  value: string;
}

abstract class MiniNode {
  static readonly ELEMENT_NODE = 1;
  static readonly TEXT_NODE = 3;
  static readonly CDATA_SECTION_NODE = 4;
  abstract readonly nodeType: number;
}

class MiniText extends MiniNode {
  readonly nodeType = 3;
  constructor(public readonly nodeValue: string) {
    super();
  }
}

class MiniCdata extends MiniNode {
  readonly nodeType = 4;
  constructor(public readonly nodeValue: string) {
    super();
  }
}

class MiniElement extends MiniNode {
  readonly nodeType = 1;
  readonly nodeValue = null;
  readonly attributes: MiniAttr[] = [];
  readonly childNodes: Array<MiniElement | MiniText | MiniCdata> = [];
  constructor(public readonly tagName: string) {
    super();
  }
  setAttribute(name: string, value: string): void {
    const existing = this.attributes.find((a) => a.name === name);
    if (existing) existing.value = value;
    else this.attributes.push({ name, value });
  }
  appendChild(child: MiniElement | MiniText | MiniCdata): MiniElement | MiniText | MiniCdata {
    this.childNodes.push(child);
    return child;
  }
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function serializeMini(el: MiniElement): string {
  const attrs = el.attributes.map((a) => ` ${a.name}="${escapeXml(a.value)}"`).join("");
  if (el.childNodes.length === 0) return `<${el.tagName}${attrs}/>`;
  const inner = el.childNodes
    .map((child) =>
      child instanceof MiniText || child instanceof MiniCdata
        ? escapeXml(child.nodeValue)
        : serializeMini(child),
    )
    .join("");
  return `<${el.tagName}${attrs}>${inner}</${el.tagName}>`;
}

function parseSimpleXml(xml: string): MiniElement {
  const rootHolder = new MiniElement("holder");
  const stack: MiniElement[] = [rootHolder];
  const tokenRe =
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z0-9:_-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null = tokenRe.exec(xml);
  while (match) {
    const [full, cdataText, closing, tag, attrText, selfClosing, rawText] = match;
    const current = stack[stack.length - 1]!;
    if (!full.startsWith("<!--") && !full.startsWith("<?")) {
      if (cdataText !== undefined) {
        current.appendChild(new MiniCdata(cdataText));
      } else if (rawText !== undefined) {
        if (stack.length > 1 || rawText.trim()) current.appendChild(new MiniText(decodeXmlEntities(rawText)));
      } else if (closing) {
        if (stack.length > 1) stack.pop();
      } else if (tag) {
        const el = new MiniElement(tag);
        const attrRe = /([A-Za-z0-9:_-]+)="([^"]*)"/g;
        let am: RegExpExecArray | null = attrRe.exec(attrText ?? "");
        while (am) {
          if (am[1] !== undefined && am[2] !== undefined) {
            el.setAttribute(am[1], decodeXmlEntities(am[2].replace(/[\r\n\t]/g, " ")));
          }
          am = attrRe.exec(attrText ?? "");
        }
        current.appendChild(el);
        if (!selfClosing) stack.push(el);
      }
    }
    match = tokenRe.exec(xml);
  }
  const first = rootHolder.childNodes.find((c): c is MiniElement => c instanceof MiniElement);
  return first ?? new MiniElement("invalid");
}

const savedGlobals: Record<string, unknown> = {};

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const key of ["Node", "DOMParser", "document", "XMLSerializer"]) savedGlobals[key] = g[key];
  g.Node = MiniNode;
  g.DOMParser = class {
    parseFromString(source: string) {
      const root = parseSimpleXml(source.startsWith("\uFEFF") ? source.slice(1) : source);
      return {
        documentElement: root,
        getElementsByTagName: () => ({ length: 0 }),
      };
    }
  };
  g.document = {
    implementation: {
      createDocument(_ns: string, qn: string) {
        const root = new MiniElement(qn);
        return {
          documentElement: root,
          createElementNS: (_childNs: string, tag: string) => new MiniElement(tag),
          createTextNode: (text: string) => new MiniText(text),
          getElementsByTagName: () => ({ length: 0 }),
        };
      },
    },
  };
  g.XMLSerializer = class {
    serializeToString(el: MiniElement) {
      return serializeMini(el);
    }
  };
});

afterAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(savedGlobals)) {
    if (value === undefined) delete g[key];
    else g[key] = value;
  }
});

const TOKEN_HEX_MAP = (() => {
  const css = readFileSync(resolve(process.cwd(), "src", "design", "tokens.css"), "utf8");
  const map = new Map<string, string>();
  for (const m of css.matchAll(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    map.set(m[1]!, m[2]!.toLowerCase());
  }
  return map;
})();

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function resolveCssColorToHex(raw: string, allowRawHex = false): string {
  const val = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    if (!allowRawHex) {
      throw new Error(`SVG/组件样式禁用裸十六进制色值: ${val}`);
    }
    return val.toLowerCase();
  }
  const varMatch = /^var\(\s*(--color-[a-z0-9-]+)\s*\)$/.exec(val);
  if (varMatch) {
    const resolved = TOKEN_HEX_MAP.get(varMatch[1]!);
    if (!resolved) {
      throw new Error(`tokens.css 未定义颜色变量: ${varMatch[1]}`);
    }
    return resolved;
  }
  const mixMatch =
    /^color-mix\(\s*in\s+srgb\s*,\s*(var\([^)]+\)|#[0-9a-fA-F]{6})\s+(\d+(?:\.\d+)?)%\s*,\s*(var\([^)]+\)|#[0-9a-fA-F]{6})\s*\)$/.exec(
      val,
    );
  if (mixMatch) {
    const c1 = hexToRgb(resolveCssColorToHex(mixMatch[1]!, allowRawHex));
    const pct = Number(mixMatch[2]) / 100;
    const c2 = hexToRgb(resolveCssColorToHex(mixMatch[3]!, allowRawHex));
    return rgbToHex(
      c1[0] * pct + c2[0] * (1 - pct),
      c1[1] * pct + c2[1] * (1 - pct),
      c1[2] * pct + c2[2] * (1 - pct),
    );
  }
  throw new Error(`无法解析的颜色表达式: ${val}`);
}

function baseProps(id: string) {
  const raw = readFileSync(resolve(process.cwd(), "wiki", "diagrams", `${id}.svg`), "utf8");
  return {
    id,
    safeSvg: sanitizeDiagram(raw, `${id}::test`) ?? "",
    caption: id,
    scrollRef: () => {},
    scrollable: false,
    onScroll: () => {},
  };
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function wcagContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function assertToolbarButtonsContrast(label: string, html: string) {
  const btnMatches = [...html.matchAll(/<button\b[^>]*>/g)];
  expect(btnMatches.length, `${label} has toolbar buttons`).toBeGreaterThanOrEqual(3);
  for (const bm of btnMatches) {
    const tag = bm[0];
    const styleStr = /\bstyle="([^"]+)"/.exec(tag)?.[1] ?? "";
    const colorRaw = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(styleStr)?.[1];
    const bgRaw = /(?:^|;)\s*background\s*:\s*([^;]+)/.exec(styleStr)?.[1];
    expect(colorRaw, `${label} button has explicit color`).toBeTruthy();
    expect(bgRaw, `${label} button has explicit background`).toBeTruthy();
    const fgHex = resolveCssColorToHex(colorRaw!, true);
    const bgHex = resolveCssColorToHex(bgRaw!, true);
    const accentHex = TOKEN_HEX_MAP.get("--color-accent");
    expect(
      bgHex === accentHex && fgHex === "#ffffff",
      `${label} must not use low-contrast white-on-accent`,
    ).toBe(false);
    const ratio = wcagContrastRatio(fgHex, bgHex);
    expect(ratio, `${label} button (${fgHex} on ${bgHex}) contrast >= 4.5`).toBeGreaterThanOrEqual(4.5);
  }
}

function assertSvgTextsNonOverlapping(label: string, svgHtml: string) {
  const texts = [...svgHtml.matchAll(/<text\b([^>]*)>([^<]+)<\/text>/g)].map((tm) => {
    const attrs = tm[1]!;
    const content = tm[2]!;
    const x = Number(/\bx="([0-9.]+)"/.exec(attrs)?.[1]);
    const y = Number(/\by="([0-9.]+)"/.exec(attrs)?.[1]);
    const anchor = /\btext-anchor="([^"]+)"/.exec(attrs)?.[1] ?? "start";
    const estW = content.length * 8;
    const x0 = anchor === "end" ? x - estW : anchor === "middle" ? x - estW / 2 : x;
    return { content, x0, x1: x0 + estW, y0: y - 11, y1: y + 2 };
  });
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      expect(overlap, `${label} SVG text overlap: "${a.content}" vs "${b.content}"`).toBe(false);
    }
  }
}

function assertUniqueHtmlIds(label: string, html: string) {
  const ids = [...html.matchAll(/(?<![-\w])id="([^"]+)"/g)].map((m) => m[1]!);
  expect(new Set(ids).size, `${label} duplicate DOM/SVG id detected`).toBe(ids.length);
}

function assertSvgWcagContrast(label: string, svgHtml: string) {
  expect(svgHtml.match(/#[0-9a-fA-F]{3,8}\b/g), `${label} SVG zero bare #hex`).toBeNull();

  const surfaceBg = TOKEN_HEX_MAP.get("--color-surface-elevated")!;
  const rects = [...svgHtml.matchAll(/<rect\b([^>]*)\/?>/g)]
    .map((rm) => {
      const attrs = rm[1]!;
      const x = Number(/\bx="([0-9.]+)"/.exec(attrs)?.[1] ?? "0");
      const y = Number(/\by="([0-9.]+)"/.exec(attrs)?.[1] ?? "0");
      const width = Number(/\bwidth="([0-9.]+)"/.exec(attrs)?.[1] ?? "0");
      const height = Number(/\bheight="([0-9.]+)"/.exec(attrs)?.[1] ?? "0");
      const rawFill = /\bfill="([^"]+)"/.exec(attrs)?.[1];
      const fill = rawFill && rawFill !== "none" ? resolveCssColorToHex(rawFill, false) : surfaceBg;
      return { x, y, width, height, fill };
    })
    .filter((r) => r.width > 0 && r.height > 0);

  for (const tm of svgHtml.matchAll(/<text\b([^>]*)>([^<]+)<\/text>/g)) {
    const attrs = tm[1]!;
    const content = tm[2]!;
    const tx = Number(/\bx="([0-9.]+)"/.exec(attrs)?.[1] ?? "0");
    const ty = Number(/\by="([0-9.]+)"/.exec(attrs)?.[1] ?? "0");
    const rawFg = /\bfill="([^"]+)"/.exec(attrs)?.[1] ?? "var(--color-ink)";
    const fg = resolveCssColorToHex(rawFg, false);
    let bg = surfaceBg;
    for (const r of rects) {
      if (tx >= r.x && tx <= r.x + r.width && ty - 5 >= r.y && ty - 5 <= r.y + r.height) {
        bg = r.fill;
      }
    }
    const ratio = wcagContrastRatio(fg, bg);
    expect(ratio, `${label} SVG text "${content}" (${fg} on ${bg}) contrast >= 4.5`).toBeGreaterThanOrEqual(
      4.5,
    );
  }
}

function assertSandboxInvariants(label: string, html: string) {
  expect(html, `${label} has unified edu shell`).toContain("wiki-edu-card");
  expect(html, `${label} has toolbar landmark`).toContain('role="toolbar"');
  expect(html, `${label} has live readout`).toContain('aria-live="polite"');
  expect(html, `${label} has collapsible details drawer`).toContain("wiki-edu-details");

  const toolbarMatch =
    /<div class="wiki-diagram-toolbar[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="wiki-edu-stage">/.exec(html);
  if (toolbarMatch) {
    expect(toolbarMatch[1], `${label} toolbar does not embed <details>`).not.toContain("<details");
  }

  // P2-7: 沙盘模式整棵 SSR HTML 零裸 #hex（含 WikiEduSandboxShell useTokenVariables 顶部模式切换钮）
  expect(
    html.match(/#[0-9a-fA-F]{3,8}\b/g),
    `${label} full rendered sandbox HTML must contain zero bare #hex`,
  ).toBeNull();

  // P2-8: 次级参数抽屉位于主画布 </svg> 之后、底部摘要卡 .wiki-edu-dual-grid 之前
  const drawerIdx = html.indexOf('class="wiki-edu-param-drawer"');
  if (drawerIdx !== -1) {
    const svgCloseIdx = html.indexOf("</svg>");
    const dualGridIdx = html.indexOf('class="wiki-edu-dual-grid"');
    expect(svgCloseIdx, `${label} param drawer requires preceding </svg>`).toBeGreaterThan(-1);
    expect(drawerIdx, `${label} param drawer must appear after </svg>`).toBeGreaterThan(svgCloseIdx);
    expect(dualGridIdx, `${label} param drawer requires following .wiki-edu-dual-grid`).toBeGreaterThan(-1);
    expect(drawerIdx, `${label} param drawer must appear before .wiki-edu-dual-grid`).toBeLessThan(
      dualGridIdx,
    );
  }

  const svgMatches = [...html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)];
  expect(svgMatches.length, `${label} <= 1 inline <svg>`).toBeLessThanOrEqual(1);
  if (svgMatches[0]) {
    const svgHtml = svgMatches[0][0];
    const widthMatch = /\bwidth="(\d+)"/.exec(svgHtml);
    const svgWidth = Number(widthMatch?.[1]);
    expect(svgWidth, `${label} width <= 900`).toBeLessThanOrEqual(900);
    expect(svgWidth, `${label} width > 0`).toBeGreaterThan(0);
    expect(svgHtml, `${label} svg max-width:900px`).toContain("max-width:900px");
    assertSvgTextsNonOverlapping(label, svgHtml);
    assertSvgWcagContrast(label, svgHtml);
  }
  for (const fm of html.matchAll(/\bfont-size="([0-9.]+)"/g)) {
    expect(Number(fm[1]), `${label} font-size >= 12`).toBeGreaterThanOrEqual(12);
  }
  assertToolbarButtonsContrast(label, html);
  assertUniqueHtmlIds(label, html);
}

describe("Wave 4B · Pure-Ascend TP / CP / DP 2D 交互沙盘：SVG 指纹、GQA 复制拐点、数学闭环与零裸色门禁", () => {
  it("0. 源码级零裸 #hex 门禁：3 份 TSX 源码禁止任何十六进制色值字面量，tokens.css 变量全覆盖", () => {
    expect(TOKEN_HEX_MAP.size).toBeGreaterThan(20);
    for (const file of [
      "TpTwoSplitsInteractive.tsx",
      "CpInterleaveSlotsInteractive.tsx",
      "DpDummyExclusionInteractive.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), "src", "content", "wiki", file), "utf8");
      const hexMatches = [...src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
      expect(hexMatches, `${file} must have zero bare #hex color literals`).toEqual([]);
      expect(src, `${file} must use tokenBtnStyle instead of eduBtnStyle`).not.toContain("eduBtnStyle");
      expect(src, `${file} must use 820px narrow breakpoint`).toContain("max-width: 820px");
      expect(src, `${file} must not retain 720px breakpoint`).not.toContain("max-width: 720px");
      for (const vm of src.matchAll(/var\(\s*(--color-[a-z0-9-]+)\s*\)/g)) {
        expect(TOKEN_HEX_MAP.has(vm[1]!), `${file} references undefined token ${vm[1]}`).toBe(true);
      }
    }
  });

  it("1. 核对 3 张底层静态 SVG 指纹、默认 sandbox、真实清洗后 svg 回退与双实例 SVG ID 零冲突", () => {
    const specs = [
      {
        id: "tensor-parallel-two-splits",
        sha: TP_TWO_SPLITS_APPROVED_SHA256,
        Comp: TpTwoSplitsInteractive,
      },
      {
        id: "context-parallel-fig-interleave-slots",
        sha: CP_INTERLEAVE_SLOTS_APPROVED_SHA256,
        Comp: CpInterleaveSlotsInteractive,
      },
      {
        id: "dp-fig-dummy-and-exclusion",
        sha: DP_DUMMY_EXCLUSION_APPROVED_SHA256,
        Comp: DpDummyExclusionInteractive,
      },
    ] as const;

    for (const item of specs) {
      const rawSvg = readFileSync(resolve(process.cwd(), "wiki", "diagrams", `${item.id}.svg`), "utf8");
      const lfSvg = rawSvg.replace(/\r\n/g, "\n");
      expect(sha256Hex(lfSvg), `${item.id} SHA-256 matches disk`).toBe(item.sha);

      const props = baseProps(item.id);
      expect(props.safeSvg.length, `${item.id} sanitized SVG is non-empty`).toBeGreaterThan(100);
      expect(props.safeSvg).toContain("<svg");

      const defaultHtml = renderToStaticMarkup(createElement(item.Comp, props));
      expect(defaultHtml).toContain('data-mode="sandbox"');
      assertSandboxInvariants(`${item.id}-default`, defaultHtml);

      const svgHtml = renderToStaticMarkup(createElement(item.Comp, { ...props, initialMode: "svg" }));
      expect(svgHtml).toContain('data-mode="svg"');
      expect(svgHtml).toContain('data-testid="diagram-mode-sandbox"');
      expect(svgHtml).toContain("<svg");
      assertToolbarButtonsContrast(`${item.id}-svg`, svgHtml);

      const dualHtml = renderToStaticMarkup(
        createElement("div", null, createElement(item.Comp, props), createElement(item.Comp, props)),
      );
      assertUniqueHtmlIds(`${item.id}-dual-ssr`, dualHtml);
      const markers = [...dualHtml.matchAll(/<marker[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
      expect(markers.length).toBeGreaterThanOrEqual(2);
      expect(new Set(markers).size).toBe(markers.length);
    }
  });

  it("2. TpTwoSplitsInteractive：矩阵三模式×四步闭环 + GQA TP>n_kv 复制拐点六行精确字节表、整除守卫与视图切换", () => {
    const paired = computeTpSandboxState("col-then-row", 4);
    expect(paired.x).toEqual([1, 2]);
    expect(paired.colCard0).toEqual([5, 1]);
    expect(paired.colCard1).toEqual([3, -2]);
    expect(paired.fullW1Out).toEqual([5, 1, 3, -2]);
    expect(formatTpVec(paired.fullW1Out)).toBe("[5, 1, 3, −2]");
    expect(paired.rowCard0).toEqual([1, 3, -1, 2]);
    expect(paired.rowCard1).toEqual([4, -2, 4, -4]);
    expect(paired.rowReducedSum).toEqual([5, 1, 3, -2]);
    expect(paired.colReluCard0).toEqual([5, 1]);
    expect(paired.colReluCard1).toEqual([3, 0]);
    expect(paired.trueRelu).toEqual([5, 1, 3, 0]);
    expect(paired.w2Card0Partial).toEqual([7, 1]);
    expect(paired.w2Card1Partial).toEqual([3, 3]);
    expect(paired.finalMlpOut).toEqual([10, 4]);
    expect(paired.commCount).toBe(1);

    const trap = computeTpSandboxState("row-first-trap", 2);
    expect(trap.wrongRowReluCard0).toEqual([1, 3, 0, 2]);
    expect(trap.wrongRowReluCard1).toEqual([4, 0, 4, 0]);
    expect(trap.wrongRowFirstReluSum).toEqual([5, 3, 4, 2]);
    expect(trap.wrongRowFirstReluSum).not.toEqual(trap.trueRelu);
    expect(trap.wrongMlpOut).toEqual([17, 11]);
    expect(trap.wrongMlpOut).not.toEqual(trap.finalMlpOut);
    expect(trap.siluWrongSumCh3).toBeGreaterThan(1.6);
    expect(trap.siluTrueCh3).toBeLessThan(-0.2);
    expect(trap.commCount).toBe(2);
    const trapStep4 = computeTpSandboxState("row-first-trap", 4);
    expect(trapStep4.takeaway).toContain("多 1 次跨卡同步");
    expect(trapStep4.takeaway).not.toContain("慢一倍");

    // 6 行 GQA 精确整数字节表（vllm@ced6857a:linear.py#L1045-L1060 & #L1295-L1304）
    const expectedRows = [
      { m: "qwen3-8b", tp: 2, q: 16, kv: 4, rep: 1, repFlag: false, sB: 262144, aB: 9437184, gB: 18874368 },
      { m: "qwen3-8b", tp: 4, q: 8, kv: 2, rep: 1, repFlag: false, sB: 131072, aB: 4718592, gB: 18874368 },
      { m: "qwen3-8b", tp: 8, q: 4, kv: 1, rep: 1, repFlag: false, sB: 65536, aB: 2359296, gB: 18874368 },
      {
        m: "qwen3-30b-a3b",
        tp: 2,
        q: 16,
        kv: 2,
        rep: 1,
        repFlag: false,
        sB: 131072,
        aB: 6291456,
        gB: 12582912,
      },
      {
        m: "qwen3-30b-a3b",
        tp: 4,
        q: 8,
        kv: 1,
        rep: 1,
        repFlag: false,
        sB: 65536,
        aB: 3145728,
        gB: 12582912,
      },
      { m: "qwen3-30b-a3b", tp: 8, q: 4, kv: 1, rep: 2, repFlag: true, sB: 65536, aB: 3145728, gB: 25165824 },
    ] as const;

    for (const row of expectedRows) {
      const st = computeTpGqaReplicationState(row.m, row.tp);
      expect(st.localQHeads, `${row.m} TP=${row.tp} localQHeads`).toBe(row.q);
      expect(st.localKvHeads, `${row.m} TP=${row.tp} localKvHeads`).toBe(row.kv);
      expect(st.numKvHeadReplicas, `${row.m} TP=${row.tp} replicas`).toBe(row.rep);
      expect(st.isKvReplicated, `${row.m} TP=${row.tp} isKvReplicated`).toBe(row.repFlag);
      expect(st.perCardSingleLayerBlockBytes, `${row.m} TP=${row.tp} singleLayerB`).toBe(row.sB);
      expect(st.perCardAllLayersBlockBytes, `${row.m} TP=${row.tp} allLayerB`).toBe(row.aB);
      expect(st.groupAllLayersBlockBytes, `${row.m} TP=${row.tp} groupB`).toBe(row.gB);
    }

    const moe30bTp8 = computeTpGqaReplicationState("qwen3-30b-a3b", 8);
    expect(moe30bTp8.rankKvHeadIndices).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(moe30bTp8.headDim).toBe(128);
    const dense8bTp8 = computeTpGqaReplicationState("qwen3-8b", 8);
    expect(dense8bTp8.rankKvHeadIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(dense8bTp8.numKvHeadReplicas).toBe(1);
    expect(dense8bTp8.isKvReplicated).toBe(false);
    expect(computeTpGqaReplicationState("qwen3-30b-a3b", 4).numKvHeadReplicas).toBe(1);
    expect(computeTpGqaReplicationState("qwen3-30b-a3b", 4).isKvReplicated).toBe(false);

    // 整除守卫：两分支非整除必抛错（24Q/6KV 配 TP=4 与 TP=8，及 Q 头非整除）
    expect(() => divide(6, 4)).toThrow(/not divisible/);
    expect(() => computeTpGqaReplicationState("qwen3-8b", 4, { totalQHeads: 24, totalKvHeads: 6 })).toThrow(
      /not divisible/,
    );
    expect(() => computeTpGqaReplicationState("qwen3-8b", 8, { totalQHeads: 24, totalKvHeads: 6 })).toThrow(
      /not divisible/,
    );
    expect(() => computeTpGqaReplicationState("qwen3-8b", 5, { totalQHeads: 24, totalKvHeads: 6 })).toThrow(
      /not divisible/,
    );

    // 视图切换立即停播，切回矩阵保留原模式与步数；抵达第 4 步当次停播
    const playingAtStep2 = {
      mode: "sandbox" as const,
      viewMode: "matrix" as const,
      pairingMode: "row-first-trap" as const,
      step: 2 as const,
      playing: true,
    };
    const switchedToGqa = reduceTpViewSwitch(playingAtStep2, "gqa");
    expect(switchedToGqa.viewMode).toBe("gqa");
    expect(switchedToGqa.playing).toBe(false);
    const switchedBack = reduceTpViewSwitch(switchedToGqa, "matrix");
    expect(switchedBack.viewMode).toBe("matrix");
    expect(switchedBack.pairingMode).toBe("row-first-trap");
    expect(switchedBack.step).toBe(2);
    expect(switchedBack.playing).toBe(false);

    const step3To4 = advanceTpStepTick({ ...playingAtStep2, step: 3 });
    expect(step3To4.step).toBe(4);
    expect(step3To4.playing).toBe(false);

    for (const pm of TP_PAIRING_MODES) {
      for (const s of TP_STEPS) {
        const html = renderToStaticMarkup(
          createElement(TpTwoSplitsInteractive, {
            ...baseProps("tensor-parallel-two-splits"),
            initialPairingMode: pm,
            initialStep: s,
          }),
        );
        assertSandboxInvariants(`tp-${pm}-step-${s}`, html);
        expect(html).toContain(`data-pairing-mode="${pm}"`);
        expect(html).toContain(`data-step="${s}"`);
        expect(html).toContain('data-testid="tp-param-drawer"');
        expect(html).toContain('data-testid="tp-view-matrix"');
        expect(html).toContain('data-testid="tp-view-gqa"');
        expect(html).toContain("[in, out]");
        expect(html).not.toContain("慢一倍");
      }
    }

    for (const gm of TP_GQA_MODELS) {
      for (const gtp of TP_GQA_SIZES) {
        const html = renderToStaticMarkup(
          createElement(TpTwoSplitsInteractive, {
            ...baseProps("tensor-parallel-two-splits"),
            initialViewMode: "gqa",
            initialGqaModel: gm,
            initialGqaTpSize: gtp,
          }),
        );
        assertSandboxInvariants(`tp-gqa-${gm}-${gtp}`, html);
        expect(html).toContain('data-view-mode="gqa"');
        expect(html).toContain(`data-gqa-model="${gm}"`);
        expect(html).toContain(`data-gqa-tp="${gtp}"`);
        expect(html).not.toContain("[10, 4]");
        expect(html).not.toContain('data-testid="tp-param-drawer"');
        const visibleGqa = html.split('<details class="wiki-edu-details">')[0] ?? "";
        expect(visibleGqa).not.toContain("head_dim");
        expect(visibleGqa).not.toContain("num_kv_head_replicas");
        expect(visibleGqa).not.toContain("n_kv");
        expect(html).toContain("查看工程与源码细节（头分片与复制规则 / 整除守卫 / 头宽与块字节公式）");
        expect(html).not.toContain("查看工程与源码细节（QKVParallelLinear");
        expect(visibleGqa).toContain("头宽 128 维");
        if (gm === "qwen3-30b-a3b" && gtp === 8) {
          expect(html).toContain("每卡 3 MiB/块 · 2× 复制");
          expect(visibleGqa).toContain("每头跨 2 卡复制");
        }
      }
    }
  });

  it("3. CpInterleaveSlotsInteractive：_compute_dcp_slot_mapping 边界校验、p15→p16 滑窗、SFA 覆写与全拓扑一键修复闭环", () => {
    const pos8 = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(_compute_dcp_slot_mapping).toBe(computeDcpSlotMapping);
    expect(computeDcpSlotMapping(pos8, 1, 1, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(computeDcpSlotMapping(pos8, 2, 1, 0)).toEqual([0, -1, 1, -1, 2, -1, 3, -1]);
    expect(computeDcpSlotMapping(pos8, 2, 1, 1)).toEqual([-1, 0, -1, 1, -1, 2, -1, 3]);
    expect(computeDcpSlotMapping(pos8, 2, 4, 0, undefined, 4)).toEqual([0, 1, 2, 3, -1, -1, -1, -1]);
    expect(computeDcpSlotMapping(pos8, 2, 4, 1, undefined, 4)).toEqual([-1, -1, -1, -1, 0, 1, 2, 3]);
    expect(computeDcpSlotMapping([0, 15, 16, 31], 2, 16, 0, [5], 16)).toEqual([80, 95, -1, -1]);
    expect(computeDcpSlotMapping([0, 15, 16, 31], 2, 16, 1, [5], 16)).toEqual([-1, -1, 80, 95]);

    // 通用守卫：block 不整除 interleave、rank 越界、显式块表缺项必抛错
    expect(() => computeDcpSlotMapping([0, 1], 2, 3, 0, undefined, 16)).toThrow(/整除/);
    expect(() => computeDcpSlotMapping([0, 1], 2, 1, 2, undefined, 16)).toThrow(/超出范围/);
    expect(() => computeDcpSlotMapping([32], 2, 16, 0, [5], 16)).toThrow(/physicalBlockTable/);

    // 位置起点滑块 p12..p19 在粒度 16, DCP=2 下亲眼跨过 p15→p16 换卡边界
    const boundaryWin = computeCpInterleaveState(2, 1, 2, 16, "mla-gqa", 12);
    expect(boundaryWin.visiblePositions).toEqual([12, 13, 14, 15, 16, 17, 18, 19]);
    expect(boundaryWin.positionOwners).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    expect(boundaryWin.rankRows[0]?.slotMapping).toEqual([12, 13, 14, 15, -1, -1, -1, -1]);
    expect(boundaryWin.rankRows[1]?.slotMapping).toEqual([-1, -1, -1, -1, 0, 1, 2, 3]);

    const zigzag = computePrefillHeadTailPairs(2);
    expect(zigzag[0]?.positions).toEqual([0, 1, 6, 7]);
    expect(zigzag[0]?.causalPairs).toBe(18);
    expect(zigzag[1]?.positions).toEqual([2, 3, 4, 5]);
    expect(zigzag[1]?.causalPairs).toBe(18);

    const trapSt = computeCpInterleaveState(4, 2, 2, 1);
    expect(trapSt.isTopologyValid).toBe(true);
    expect(trapSt.totalDevices).toBe(4);
    expect(trapSt.v030VirtualBlockSlots).toBe(64);
    expect(trapSt.legacyOverMultipliedSlots).toBe(128);
    expect(trapSt.phantomSlots).toBe(64);
    expect(trapSt.mainKvBytesPerCard).toBe(256);
    expect(trapSt.replicatedIndexerBytesPerCard).toBe(0);

    // P2-6: gqa-strict (32Q:4KV) 必须同时满足 tpSize > 4 且 dcp <= tpSize / 4（且每 KV 的 Q 数整除 dcp）
    expect(computeCpInterleaveState(2, 1, 2, 1, "gqa-strict").isTopologyValid).toBe(false);
    expect(computeCpInterleaveState(2, 1, 4, 1, "gqa-strict").isTopologyValid).toBe(false);
    expect(computeCpInterleaveState(2, 2, 2, 1, "gqa-strict").isTopologyValid).toBe(false);
    expect(computeCpInterleaveState(4, 1, 8, 1, "gqa-strict").isTopologyValid).toBe(false);
    expect(computeCpInterleaveState(2, 1, 8, 1, "gqa-strict").isTopologyValid).toBe(true);
    expect(computeCpInterleaveState(2, 2, 8, 1, "gqa-strict").isTopologyValid).toBe(true);

    // gqa-strict TP=2, PCP=1, DCP=4 修复后必变为真实合法拓扑（升至 TP=8, DCP=2）
    const gqaInvalid = computeCpInterleaveState(4, 1, 2, 1, "gqa-strict");
    expect(gqaInvalid.isTopologyValid).toBe(false);
    expect(gqaInvalid.recommendedFix?.tpSize).toBe(8);
    expect(gqaInvalid.recommendedFix?.dcpSize).toBe(2);
    expect(gqaInvalid.recommendedFix?.pcpSize).toBe(1);
    expect(
      computeCpInterleaveState(
        gqaInvalid.recommendedFix!.dcpSize,
        gqaInvalid.recommendedFix!.pcpSize,
        gqaInvalid.recommendedFix!.tpSize,
        1,
        "gqa-strict",
      ).isTopologyValid,
    ).toBe(true);

    // SFA 覆写：保留 requestedInterleaveSize=1，effectiveInterleaveSize=16
    const sfaOverride = computeCpInterleaveState(4, 2, 2, 1, "sfa-sparse");
    expect(sfaOverride.requestedInterleaveSize).toBe(1);
    expect(sfaOverride.effectiveInterleaveSize).toBe(16);
    expect(sfaOverride.sfaOverrodeInterleave).toBe(true);
    expect(sfaOverride.replicatedIndexerBytesPerCard).toBe(64);

    const pcp2Dcp1Html = renderToStaticMarkup(
      createElement(CpInterleaveSlotsInteractive, {
        ...baseProps("context-parallel-fig-interleave-slots"),
        initialDcpSize: 1,
        initialPcpSize: 2,
        initialTpSize: 2,
        initialInterleaveSize: 1,
      }),
    );
    expect(pcp2Dcp1Html).toContain("PCP&gt;1 旧式误乘 2×");
    expect(pcp2Dcp1Html).not.toContain("PCP=1 新旧等值");
    expect(pcp2Dcp1Html).toContain('data-testid="cp-param-drawer"');
    expect(pcp2Dcp1Html).toContain('data-testid="cp-tp-8"');
    expect(pcp2Dcp1Html).toContain('data-testid="cp-pos-slider"');
    expect(pcp2Dcp1Html).toContain("var(--color-rank0)");
    expect(pcp2Dcp1Html).toContain("var(--color-kv)");

    const trapExactHtml = renderToStaticMarkup(
      createElement(CpInterleaveSlotsInteractive, {
        ...baseProps("context-parallel-fig-interleave-slots"),
        initialDcpSize: 4,
        initialPcpSize: 2,
        initialTpSize: 2,
        initialInterleaveSize: 1,
        initialAttnMode: "mla-gqa",
      }),
    );
    expect(trapExactHtml).toMatch(/data-testid="cp-preset-trap"[^>]*aria-pressed="true"/);

    for (const attn of CP_ATTN_MODES) {
      for (const dcp of CP_DCP_SIZES) {
        for (const pcp of CP_PCP_SIZES) {
          for (const tp of CP_TP_SIZES) {
            const st = computeCpInterleaveState(dcp, pcp, tp, 1, attn);
            const expectedValid =
              attn === "sfa-sparse"
                ? dcp === 1 || dcp === pcp || dcp === tp * pcp
                : attn === "gqa-strict"
                  ? (pcp === 1 ? tp % dcp === 0 : dcp === 1 || dcp === pcp) &&
                    (dcp === 1 || (tp > 4 && dcp <= Math.floor(tp / 4) && 8 % dcp === 0))
                  : pcp === 1
                    ? tp % dcp === 0
                    : dcp === 1 || dcp === pcp || dcp === tp * pcp;
            expect(st.isTopologyValid, `attn=${attn} d=${dcp} p=${pcp} t=${tp}`).toBe(expectedValid);
            if (!expectedValid) {
              expect(st.recommendedFix, `fix exists for ${attn} d=${dcp} p=${pcp} t=${tp}`).not.toBeNull();
              const fixed = computeCpInterleaveState(
                st.recommendedFix!.dcpSize,
                st.recommendedFix!.pcpSize,
                st.recommendedFix!.tpSize,
                1,
                attn,
              );
              expect(fixed.isTopologyValid, `applied fix valid for ${attn} d=${dcp} p=${pcp} t=${tp}`).toBe(
                true,
              );
            }
          }
        }
      }
    }

    for (const attn of CP_ATTN_MODES) {
      for (const dcp of CP_DCP_SIZES) {
        for (const pcp of CP_PCP_SIZES) {
          for (const tp of CP_TP_SIZES) {
            for (const gran of CP_INTERLEAVE_SIZES) {
              const html = renderToStaticMarkup(
                createElement(CpInterleaveSlotsInteractive, {
                  ...baseProps("context-parallel-fig-interleave-slots"),
                  initialDcpSize: dcp,
                  initialPcpSize: pcp,
                  initialTpSize: tp,
                  initialInterleaveSize: gran,
                  initialAttnMode: attn,
                }),
              );
              assertSandboxInvariants(`cp-${attn}-d${dcp}-p${pcp}-t${tp}-g${gran}`, html);
            }
          }
        }
      }
    }
  });

  it("3b. CpInterleaveSlotsInteractive：预设精确激活校验、非合法拓扑一键修复按钮渲染", () => {
    const trapWrongGranHtml = renderToStaticMarkup(
      createElement(CpInterleaveSlotsInteractive, {
        ...baseProps("context-parallel-fig-interleave-slots"),
        initialDcpSize: 4,
        initialPcpSize: 2,
        initialTpSize: 2,
        initialInterleaveSize: 16,
        initialAttnMode: "mla-gqa",
      }),
    );
    expect(trapWrongGranHtml).toMatch(/data-testid="cp-preset-trap"[^>]*aria-pressed="false"/);

    const trapWrongAttnHtml = renderToStaticMarkup(
      createElement(CpInterleaveSlotsInteractive, {
        ...baseProps("context-parallel-fig-interleave-slots"),
        initialDcpSize: 4,
        initialPcpSize: 2,
        initialTpSize: 2,
        initialInterleaveSize: 1,
        initialAttnMode: "sfa-sparse",
      }),
    );
    expect(trapWrongAttnHtml).toMatch(/data-testid="cp-preset-trap"[^>]*aria-pressed="false"/);

    const gqaBadHtml = renderToStaticMarkup(
      createElement(CpInterleaveSlotsInteractive, {
        ...baseProps("context-parallel-fig-interleave-slots"),
        initialDcpSize: 4,
        initialPcpSize: 1,
        initialTpSize: 2,
        initialInterleaveSize: 1,
        initialAttnMode: "gqa-strict",
      }),
    );
    expect(gqaBadHtml).toContain('data-topology-valid="false"');
    expect(gqaBadHtml).toContain('data-testid="cp-fix-topology"');
    expect(gqaBadHtml).toContain("DCP=2");
  });

  it("4. DpDummyExclusionInteractive：稠密真休眠、MoE 陪跑 [4,1] vs [3,2]、画布零源码符与停播边界核验", () => {
    const denseSkew = computeDpSandboxState("dense-dp2", "skewed-4-0", 2);
    expect(denseSkew.requiresDummyEscort).toBe(false);
    expect(denseSkew.group1.dummyTokens).toBe(0);
    expect(denseSkew.dpMetadataBytes).toBe(0);
    expect(denseSkew.isDeadlocked).toBe(false);
    expect(denseSkew.canvasHeading).not.toContain("填假词");

    const moeSkew = computeDpSandboxState("moe-dp2", "skewed-4-0", 2, "none", "aclgraph-or-mc2");
    expect(moeSkew.requiresDummyEscort).toBe(true);
    expect(moeSkew.group1.dummyTokens).toBe(1);
    expect(moeSkew.numTokensAcrossDp).toEqual([4, 1]);
    expect(moeSkew.numTokensAfterPadding).toEqual([4, 4]);
    expect(moeSkew.isWidthPadded).toBe(true);
    expect(moeSkew.dpMetadataBytes).toBe(16);
    expect(moeSkew.alignedStepWidth).toBe(4);
    expect(moeSkew.dpSyncInterval).toBe(16);
    expect(moeSkew.dpHcclMinMiB).toBe(50);

    const moeEagerSkew = computeDpSandboxState("moe-dp2", "skewed-4-0", 2, "none", "eager-alltoall");
    expect(moeEagerSkew.requiresDummyEscort).toBe(true);
    expect(moeEagerSkew.group1.dummyTokens).toBe(1);
    expect(moeEagerSkew.numTokensAcrossDp).toEqual([4, 1]);
    expect(moeEagerSkew.numTokensAfterPadding).toEqual([4, 1]);
    expect(moeEagerSkew.isWidthPadded).toBe(false);
    expect(moeEagerSkew.dpMetadataBytes).toBe(16);

    const moeBalEager = computeDpSandboxState("moe-dp2", "balanced-3-2", 2, "none", "eager-alltoall");
    expect(moeBalEager.requiresDummyEscort).toBe(false);
    expect(moeBalEager.numTokensAfterPadding).toEqual([3, 2]);
    expect(moeBalEager.alignedStepWidth).toBe(3);

    expect(computeDpSandboxState("roce-pp-dp-ban", "skewed-4-0", 1, "none").isDeadlocked).toBe(false);
    expect(computeDpSandboxState("roce-pp-dp-ban", "skewed-4-0", 3, "none").isDeadlocked).toBe(true);
    expect(computeDpSandboxState("roce-pp-dp-ban", "skewed-4-0", 3, "pp1-dp2-ep").isDeadlocked).toBe(false);
    const dp1Pp2 = computeDpSandboxState("roce-pp-dp-ban", "skewed-4-0", 3, "dp1-pp2");
    expect(dp1Pp2.isDeadlocked).toBe(false);
    expect(dp1Pp2.widthPillText).not.toContain("[4, 0]");
    expect(dp1Pp2.canvasHeading).not.toContain("填假词");

    const dpStep3To4 = advanceDpStepTick({ mode: "sandbox", step: 3, playing: true });
    expect(dpStep3To4.step).toBe(4);
    expect(dpStep3To4.playing).toBe(false);

    const forbiddenCanvasIdentifiers = [
      "START_DP_WAVE",
      "dummy_batch",
      "MoeDistributeDispatch",
      "dp_sync_interval",
      "--enable-expert-parallel",
      "uniform_decode_query_len",
      "num_tokens_after_padding",
      "engines_running",
      "sync_dp_state",
    ];

    for (const arch of DP_ARCH_MODES) {
      for (const wl of DP_WORKLOAD_MODES) {
        for (const stp of DP_WAVE_STEPS) {
          for (const execPath of DP_EXEC_PATHS) {
            for (const fix of arch === "roce-pp-dp-ban"
              ? (["none", "pp1-dp2-ep", "dp1-pp2"] as const)
              : (["none"] as const)) {
              const html = renderToStaticMarkup(
                createElement(DpDummyExclusionInteractive, {
                  ...baseProps("dp-fig-dummy-and-exclusion"),
                  initialArchMode: arch,
                  initialWorkload: wl,
                  initialStep: stp,
                  initialRoceSafeFix: fix,
                  initialExecPath: execPath,
                }),
              );
              assertSandboxInvariants(`dp-${arch}-${wl}-s${stp}-${execPath}-${fix}`, html);
              expect(html).toContain('data-testid="dp-param-drawer"');

              const svgBlock = /<svg\b[^>]*>[\s\S]*?<\/svg>/.exec(html)?.[0] ?? "";
              for (const ident of forbiddenCanvasIdentifiers) {
                expect(svgBlock, `SVG must hide ${ident}`).not.toContain(ident);
              }
              const liveReadoutBeforeDetails =
                /<output\b[^>]*>([\s\S]*?)<details class="wiki-edu-details"/.exec(html)?.[1] ?? "";
              for (const ident of forbiddenCanvasIdentifiers) {
                expect(liveReadoutBeforeDetails, `Takeaway/KPI must hide ${ident}`).not.toContain(ident);
              }

              if (arch === "moe-dp2" && wl === "skewed-4-0" && execPath === "eager-alltoall") {
                expect(html).toContain('data-after-padding="[4,1]"');
              }
              if (arch === "roce-pp-dp-ban") {
                expect(html).toContain('data-testid="dp-fix-pp1-dp2"');
                expect(html).toContain('data-testid="dp-fix-dp1-pp2"');
                if (fix !== "none") {
                  expect(html).toContain('data-deadlocked="false"');
                  expect(html).toContain("已解除通信挂死");
                }
              }
            }
          }
        }
      }
    }
  });
});
