import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COLL_COMM_DOMAINS,
  COLL_COMM_FIG_HCCS_VS_ROCE_APPROVED_SHA256,
  COLL_COMM_GROUP_SIZES,
  COLL_COMM_HCCS_ROCE_APPROVED_SHA256,
  CollCommHccsRoceInteractive,
  computeCollCommSandboxState,
} from "./CollCommHccsRoceInteractive";
import { decodeXmlEntities, sanitizeDiagram } from "./diagram-sanitize";
import {
  computeDpGroupBufferMiB,
  computeFusedMc2WindowMiB,
  computeHcclBufferLedgerState,
  HCCL_BUFFER_FIG_DOMAIN_LEDGER_APPROVED_SHA256,
  HCCL_BUFFER_LEDGER_APPROVED_SHA256,
  HCCL_EP_RANK_MODES,
  HCCL_TP_SIZES,
  HcclBufferLedgerInteractive,
} from "./HcclBufferLedgerInteractive";
import { sha256Hex } from "./interactive-diagrams";
import {
  computeMoeDispatchSandboxState,
  MOE_DISPATCH_FIG_STATE_MACHINE_APPROVED_SHA256,
  MOE_DISPATCH_STATE_APPROVED_SHA256,
  MOE_EP_WORLD_SIZES,
  MOE_SOC_FAMILIES,
  MoeDispatchStateInteractive,
} from "./MoeDispatchStateInteractive";

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

const WAVE4A_SOURCE_FILES = [
  "MoeDispatchStateInteractive.tsx",
  "CollCommHccsRoceInteractive.tsx",
  "HcclBufferLedgerInteractive.tsx",
] as const;

function loadDesignTokenColors(): Map<string, string> {
  const css = readFileSync(resolve(process.cwd(), "src/design/tokens.css"), "utf8");
  const raw = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
    raw.set(m[1]!, m[2]!.trim());
  }
  const resolved = new Map<string, string>();
  const resolveColor = (val: string, depth = 0): string | null => {
    if (depth > 6) return null;
    const trimmed = val.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      const m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(trimmed)!;
      return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase();
    }
    const vm = /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/.exec(trimmed);
    if (vm) {
      const target = raw.get(vm[1]!);
      return target ? resolveColor(target, depth + 1) : null;
    }
    return null;
  };
  for (const [k, v] of raw.entries()) {
    const hex = resolveColor(v);
    if (hex) resolved.set(k, hex);
  }
  return resolved;
}

const DESIGN_TOKEN_COLORS = loadDesignTokenColors();

function resolveCssColorToHex(colorExpr: string, contextLabel: string): string {
  const trimmed = colorExpr.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(trimmed)!;
    return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase();
  }
  const vm = /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/.exec(trimmed);
  if (vm) {
    const resolved = DESIGN_TOKEN_COLORS.get(vm[1]!);
    expect(resolved, `${contextLabel}: undefined CSS color token "${vm[1]}"`).toBeDefined();
    return resolved!;
  }
  const rm = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(trimmed);
  if (rm) {
    const hex = [rm[1], rm[2], rm[3]]
      .map((n) =>
        Math.max(0, Math.min(255, Number(n)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
    return `#${hex}`;
  }
  throw new Error(`${contextLabel}: unsupported CSS color "${colorExpr}"`);
}

function srgbToLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function wcagContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = srgbToLuminance(fgHex);
  const l2 = srgbToLuminance(bgHex);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function assertToolbarButtonsContrast(label: string, html: string) {
  const btnMatches = [...html.matchAll(/<button\b[^>]*>/g)];
  expect(btnMatches.length, `${label} has buttons`).toBeGreaterThanOrEqual(3);
  for (const bm of btnMatches) {
    const tag = bm[0];
    const styleVal = /\bstyle="([^"]+)"/.exec(tag)?.[1] ?? "";
    expect(styleVal.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], `${label} button style zero naked #hex`).toEqual([]);
    const fgRaw = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(styleVal)?.[1];
    const bgRaw = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(styleVal)?.[1];
    if (fgRaw && bgRaw) {
      const fgHex = resolveCssColorToHex(fgRaw, `${label} btn color`);
      const bgHex = resolveCssColorToHex(bgRaw, `${label} btn bg`);
      const ratio = wcagContrastRatio(fgHex, bgHex);
      expect(
        ratio,
        `${label} button contrast >= 4.5 (${fgRaw}=${fgHex} on ${bgRaw}=${bgHex})`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    const pressed = /\baria-pressed="true"/.test(tag);
    if (pressed && bgRaw) {
      const bgHex = resolveCssColorToHex(bgRaw, `${label} pressed btn bg`);
      expect(["#087f73", "#17211f"], `${label} pressed btn uses high-contrast dark/teal`).toContain(bgHex);
    }
  }
}

function assertZeroNakedHexInRenderedHtml(label: string, html: string) {
  const withoutStaticSvgFallback = html.replace(
    /<div class="wiki-diagram-svg[^"]*">(?:<svg[\s\S]*?<\/svg>)?<\/div>/g,
    "",
  );
  expect(
    withoutStaticSvgFallback.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [],
    `${label} entire rendered component SSR HTML (including shell mode actions) has zero naked #hex`,
  ).toEqual([]);
}

function assertSvgTextsNonOverlapping(label: string, html: string) {
  const svgHtml = /<svg\b[\s\S]*?<\/svg>/.exec(html)?.[0] ?? "";
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
  const ids = [...html.matchAll(/(?<![A-Za-z0-9_-])id="([^"]+)"/g)].map((m) => m[1]!);
  expect(ids.length, `${label} has DOM/SVG id attrs`).toBeGreaterThanOrEqual(2);
  expect(new Set(ids).size, `${label} zero duplicate DOM/SVG IDs`).toBe(ids.length);
}

function assertSvgWcagContrast(label: string, html: string) {
  const svgHtml = /<svg\b[\s\S]*?<\/svg>/.exec(html)?.[0] ?? "";
  expect(svgHtml.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], `${label} SVG zero naked hex`).toEqual([]);

  const rects = [...svgHtml.matchAll(/<rect\b([^>]*?)\/?>/g)].map((rm) => {
    const attrs = rm[1]!;
    const fillAttr = /\bfill="([^"]+)"/.exec(attrs)?.[1];
    return {
      x: Number(/\bx="([0-9.]+)"/.exec(attrs)?.[1] ?? 0),
      y: Number(/\by="([0-9.]+)"/.exec(attrs)?.[1] ?? 0),
      w: Number(/\bwidth="([0-9.]+)"/.exec(attrs)?.[1] ?? 0),
      h: Number(/\bheight="([0-9.]+)"/.exec(attrs)?.[1] ?? 0),
      fillHex: fillAttr && fillAttr !== "none" ? resolveCssColorToHex(fillAttr, `${label} rect fill`) : null,
    };
  });
  for (const tm of svgHtml.matchAll(/<text\b([^>]*)>([^<]+)<\/text>/g)) {
    const attrs = tm[1]!;
    const content = tm[2]!;
    const tx = Number(/\bx="([0-9.]+)"/.exec(attrs)?.[1]);
    const ty = Number(/\by="([0-9.]+)"/.exec(attrs)?.[1]);
    const anchor = /\btext-anchor="([^"]+)"/.exec(attrs)?.[1] ?? "start";
    const fillRaw = /\bfill="([^"]+)"/.exec(attrs)?.[1];
    expect(fillRaw, `${label} SVG <text> "${content}" specifies fill`).toBeDefined();
    const fillHex = resolveCssColorToHex(fillRaw!, `${label} text "${content}"`);
    const probeX = anchor === "end" ? tx - 4 : anchor === "middle" ? tx : tx + 4;
    const probeY = ty - 4;
    let bgHex = "#ffffff";
    for (const r of rects) {
      if (r.fillHex && probeX >= r.x && probeX <= r.x + r.w && probeY >= r.y && probeY <= r.y + r.h) {
        bgHex = r.fillHex;
      }
    }
    const ratio = wcagContrastRatio(fillHex, bgHex);
    expect(
      ratio,
      `${label} WCAG contrast >= 4.5 for "${content}" (${fillRaw}=${fillHex} on ${bgHex})`,
    ).toBeGreaterThanOrEqual(4.5);
  }
}

function assertSandboxInvariants(label: string, html: string) {
  expect(html, `${label} has unified edu shell`).toContain("wiki-edu-card");
  expect(html, `${label} has toolbar landmark`).toContain('role="toolbar"');
  expect(html, `${label} has live readout`).toContain('aria-live="polite"');
  expect(html, `${label} has collapsible details drawer`).toContain("wiki-edu-details");
  expect(html, `${label} has collapsible param drawer`).toContain("wiki-edu-param-drawer");
  expect(html, `${label} param drawer closed by default`).not.toMatch(
    /<details class="wiki-edu-param-drawer"[^>]*\bopen\b/,
  );
  expect(html, `${label} has responsive mobile view`).toContain("wiki-edu-w4a-mobile");

  const svgDomPos = html.search(/<svg\b[^>]*class="wiki-edu-w4a-svg"/);
  const mobileDomPos = html.search(/<section\b[^>]*class="wiki-edu-w4a-mobile"/);
  const drawerDomPos = html.search(/<details\b[^>]*class="wiki-edu-param-drawer"/);
  const dualGridDomPos = html.search(/<div\b[^>]*class="wiki-edu-dual-grid"/);
  expect(svgDomPos, `${label} renders primary SVG canvas`).toBeGreaterThan(-1);
  expect(mobileDomPos, `${label} renders mobile view after primary SVG`).toBeGreaterThan(svgDomPos);
  expect(drawerDomPos, `${label} moves param drawer below main canvas`).toBeGreaterThan(mobileDomPos);
  expect(dualGridDomPos, `${label} places param drawer above summary dual-grid`).toBeGreaterThan(
    drawerDomPos,
  );

  const toolbarHtml = /role="toolbar"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
  const toolbarBtnCount = [...toolbarHtml.matchAll(/<button\b/g)].length;
  expect(toolbarBtnCount, `${label} single-row toolbar <= 7 buttons`).toBeLessThanOrEqual(7);

  const svgMatches = [...html.matchAll(/<svg\b[^>]*>/g)];
  expect(svgMatches.length, `${label} <= 1 inline <svg>`).toBeLessThanOrEqual(1);
  if (svgMatches[0]) {
    const widthMatch = /\bwidth="(\d+)"/.exec(svgMatches[0][0]);
    const svgWidth = Number(widthMatch?.[1]);
    expect(svgWidth, `${label} width <= 900`).toBeLessThanOrEqual(900);
    expect(svgWidth, `${label} width > 0`).toBeGreaterThan(0);
    expect(svgMatches[0][0], `${label} SVG responsive max-width`).toContain("wiki-edu-w4a-svg");
    assertSvgTextsNonOverlapping(label, html);
    assertSvgWcagContrast(label, html);
  }
  for (const fm of html.matchAll(/\bfont-size="([0-9.]+)"/g)) {
    expect(Number(fm[1]), `${label} font-size >= 12`).toBeGreaterThanOrEqual(12);
  }
  assertToolbarButtonsContrast(label, html);
  assertZeroNakedHexInRenderedHtml(label, html);
  expect(html, `${label} desktop single-row toolbar media query`).toContain("@media (min-width: 821px)");
  expect(html, `${label} desktop single-row nowrap rule`).toContain("flex-wrap: nowrap;");
  assertUniqueHtmlIds(label, html);

  const summaryText =
    /<details class="wiki-edu-details">\s*<summary>([\s\S]*?)<\/summary>/.exec(html)?.[1] ?? "";
  expect(summaryText.length, `${label} non-empty summary`).toBeGreaterThan(4);
  const rawIdentifiers = [
    "select_moe_comm_method",
    "set_mc2_tokens_capacity",
    "use_cann_megamoe",
    "dispatch_ffn_combine",
    "enable_fused_mc2",
    "get_hccl_config_for_pg_options",
    "calculate_dp_buffer_size",
    "make_hccl_pg_key",
    "GetMaxWindowSize",
    "tensor_model_parallel_all_reduce",
    "isend_tensor_dict",
    "HCCL_BUFFSIZE_EP",
    "HCCL_BUFFSIZE",
    "AllGather",
    "AllToAll",
  ];
  for (const rawFn of rawIdentifiers) {
    expect(summaryText, `${label} <summary> hides ${rawFn}`).not.toContain(rawFn);
  }

  const withoutAnyDetails = html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, "");
  for (const rawCodeLeak of rawIdentifiers) {
    expect(withoutAnyDetails, `${label} canvas/cards hide ${rawCodeLeak}`).not.toContain(rawCodeLeak);
  }
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

describe("Wave 4A Pure-Ascend 2D Interactive Sandboxes（MoE Dispatch / HCCS vs RoCE / HCCL Buffer Ledger）", () => {
  const wave4aSpecs = [
    {
      id: "moe-dispatch-fig-state-machine",
      sha: MOE_DISPATCH_STATE_APPROVED_SHA256,
      aliasSha: MOE_DISPATCH_FIG_STATE_MACHINE_APPROVED_SHA256,
      render: (props: ReturnType<typeof baseProps> & { readonly initialMode?: "sandbox" | "svg" }) =>
        createElement(MoeDispatchStateInteractive, props),
    },
    {
      id: "coll-comm-fig-hccs-vs-roce",
      sha: COLL_COMM_HCCS_ROCE_APPROVED_SHA256,
      aliasSha: COLL_COMM_FIG_HCCS_VS_ROCE_APPROVED_SHA256,
      render: (props: ReturnType<typeof baseProps> & { readonly initialMode?: "sandbox" | "svg" }) =>
        createElement(CollCommHccsRoceInteractive, props),
    },
    {
      id: "hccl-buffer-fig-domain-ledger",
      sha: HCCL_BUFFER_LEDGER_APPROVED_SHA256,
      aliasSha: HCCL_BUFFER_FIG_DOMAIN_LEDGER_APPROVED_SHA256,
      render: (props: ReturnType<typeof baseProps> & { readonly initialMode?: "sandbox" | "svg" }) =>
        createElement(HcclBufferLedgerInteractive, props),
    },
  ] as const;

  it("1. 全部 3 张审定 SVG SHA-256 精确对齐、默认 sandbox 与 svg 双向渲染及双实例零重复 SVG/DOM ID", () => {
    expect(MOE_DISPATCH_STATE_APPROVED_SHA256).toBe(
      "5979740e16887dd78ddfcf185b3c2215c19f80ef298e86c22b203aa1785fce72",
    );
    expect(COLL_COMM_HCCS_ROCE_APPROVED_SHA256).toBe(
      "b67de3cb5834e67f6c51f8d9b0b9340dbb3fe9fdd42b852d993b2ac53cd586b7",
    );
    expect(HCCL_BUFFER_LEDGER_APPROVED_SHA256).toBe(
      "8a65f4c1611fba4e11f5f49087da0c595b2d38d420974dbbcb49af6fb0a691d8",
    );

    for (const srcName of WAVE4A_SOURCE_FILES) {
      const sourceText = readFileSync(resolve(process.cwd(), "src/content/wiki", srcName), "utf8");
      expect(sourceText.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], `${srcName} zero naked #hex literals`).toEqual(
        [],
      );
    }

    for (const item of wave4aSpecs) {
      expect(item.aliasSha).toBe(item.sha);
      const rawDisk = readFileSync(resolve(process.cwd(), "wiki", "diagrams", `${item.id}.svg`), "utf8");
      const lfSvg = rawDisk.replace(/\r\n/g, "\n");
      expect(sha256Hex(lfSvg), `${item.id} LF sha256`).toBe(item.sha);

      const defaultHtml = renderToStaticMarkup(item.render(baseProps(item.id)));
      expect(defaultHtml).toContain('data-mode="sandbox"');
      expect(defaultHtml).toContain("wiki-edu-dual-grid");
      expect(defaultHtml).toContain("c09d3e20");
      assertSandboxInvariants(`${item.id}-default`, defaultHtml);

      const svgHtml = renderToStaticMarkup(item.render({ ...baseProps(item.id), initialMode: "svg" }));
      expect(svgHtml).toContain('data-mode="svg"');
      expect(svgHtml).toContain('data-testid="diagram-mode-sandbox"');
      assertToolbarButtonsContrast(`${item.id}-svg`, svgHtml);
      assertZeroNakedHexInRenderedHtml(`${item.id}-svg`, svgHtml);

      const dualHtml = renderToStaticMarkup(
        createElement("div", null, item.render(baseProps(item.id)), item.render(baseProps(item.id))),
      );
      assertUniqueHtmlIds(`${item.id}-dual`, dualHtml);
      const markerIds = [...dualHtml.matchAll(/<marker[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
      if (markerIds.length > 0) {
        expect(markerIds.length).toBeGreaterThanOrEqual(2);
        expect(new Set(markerIds).size).toBe(markerIds.length);
      }
    }
  });

  it("2. MoeDispatchStateInteractive：两道全局闸门、四套芯片策略、动态容量门槛与预设/修复按钮核验", () => {
    // Gate 1: EP=1 -> ALLGATHER across all SoCs even when LoRA + MegaMoe requested
    for (const soc of MOE_SOC_FAMILIES) {
      const g1 = computeMoeDispatchSandboxState({
        soc,
        epWorldSize: 1,
        tpSize: 4,
        numTokens: 64,
        loraEnabled: true,
        enableFusedMc2: true,
        useCannMegamoe: true,
      });
      expect(g1.activeStage).toBe("gate1-ep1");
      expect(g1.selectedMethod).toBe("ALLGATHER");
      expect(g1.remediationKind).toBe("raise-ep-gt-1");

      // Gate 2: LoRA && EP > 1 -> ALLTOALL across all SoCs
      const g2 = computeMoeDispatchSandboxState({
        soc,
        epWorldSize: 16,
        tpSize: 4,
        numTokens: 64,
        loraEnabled: true,
        enableFusedMc2: true,
        useCannMegamoe: true,
      });
      expect(g2.activeStage).toBe("gate2-lora");
      expect(g2.selectedMethod).toBe("ALLTOALL");
      expect(g2.remediationKind).toBe("disable-lora");
    }

    // 310P: always ALLGATHER_310
    const p310 = computeMoeDispatchSandboxState({ soc: "310P", epWorldSize: 16, tpSize: 4, numTokens: 4096 });
    expect(p310.selectedMethod).toBe("ALLGATHER");
    expect(p310.selectedSubVariant).toBe("ALLGATHER_310");

    // A2: CAPACITY_AND_EXPERT_DENSITY (experts_per_rank <= 24, ep >= 16, tokens <= 512 * tp)
    const a2Ep8 = computeMoeDispatchSandboxState({
      soc: "A2",
      epWorldSize: 8,
      tpSize: 4,
      numTokens: 64,
      expertModel: "qwen3-128",
    });
    expect(a2Ep8.expertsPerRank).toBe(16);
    expect(a2Ep8.selectedMethod).toBe("ALLGATHER");
    expect(a2Ep8.remediationKind).toBe("raise-a2-ep16");

    const a2DenseFail = computeMoeDispatchSandboxState({
      soc: "A2",
      epWorldSize: 16,
      tpSize: 4,
      numTokens: 64,
      numExperts: 512,
    });
    expect(a2DenseFail.expertsPerRank).toBe(32);
    expect(a2DenseFail.selectedMethod).toBe("ALLGATHER");

    const a2Mc2Ok = computeMoeDispatchSandboxState({
      soc: "A2",
      epWorldSize: 16,
      tpSize: 2,
      maxCaptureSize: 512,
      enablePrefillMc2: true,
      maxBatchedTokens: 2048,
      numTokens: 1024,
      expertModel: "deepseek-256",
    });
    expect(a2Mc2Ok.expertsPerRank).toBe(16);
    expect(a2Mc2Ok.mc2TokensCapacity).toBe(1024);
    expect(a2Mc2Ok.selectedMethod).toBe("MC2");
    expect(
      computeMoeDispatchSandboxState({
        soc: "A2",
        epWorldSize: 16,
        tpSize: 2,
        maxCaptureSize: 512,
        enablePrefillMc2: true,
        maxBatchedTokens: 2048,
        numTokens: 1025,
        expertModel: "deepseek-256",
      }).selectedMethod,
    ).toBe("ALLGATHER");

    // maxCaptureSize=128, TP=4, enablePrefillMc2=false -> mc2TokensCapacity = 128:
    // A2 routes 256 > 128 -> ALLGATHER (c09d3e20#L297-L315); A3 (fused=false) routes 256 > 128 -> ALLTOALL
    const a2Cap128 = computeMoeDispatchSandboxState({
      soc: "A2",
      epWorldSize: 16,
      tpSize: 4,
      maxCaptureSize: 128,
      numTokens: 256,
      enablePrefillMc2: false,
      expertModel: "deepseek-256",
    });
    expect(a2Cap128.mc2TokensCapacity).toBe(128);
    expect(a2Cap128.withinCapacity).toBe(false);
    expect(a2Cap128.selectedMethod).toBe("ALLGATHER");

    const a3Cap128 = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 16,
      tpSize: 4,
      maxCaptureSize: 128,
      numTokens: 256,
      enablePrefillMc2: false,
      enableFusedMc2: false,
    });
    expect(a3Cap128.mc2TokensCapacity).toBe(128);
    expect(a3Cap128.selectedMethod).toBe("ALLTOALL");

    // A3: FUSED_OR_CAPACITY — MegaMoe & dispatch_ffn_combine (enable_fused_mc2=1, ep<=32) execute BEFORE capacity check!
    const a3Mega = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 64,
      tpSize: 2,
      numTokens: 8192,
      maxBatchedTokens: 32768,
      enableFusedMc2: true,
      useCannMegamoe: true,
    });
    expect(a3Mega.mc2TokensCapacity).toBe(32768);
    expect(a3Mega.selectedMethod).toBe("FUSED_MC2");
    expect(a3Mega.selectedSubVariant).toBe("CANN_MEGAMOE");

    const a3Fused32 = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 32,
      tpSize: 2,
      numTokens: 1024,
      enableFusedMc2: true,
      useCannMegamoe: false,
    });
    expect(a3Fused32.selectedMethod).toBe("FUSED_MC2");
    expect(a3Fused32.selectedSubVariant).toBe("DISPATCH_FFN_COMBINE");

    const a3FusedOverCap = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 16,
      tpSize: 1,
      numTokens: 2048,
      enableFusedMc2: true,
      useCannMegamoe: false,
      loraEnabled: false,
    });
    expect(a3FusedOverCap.mc2TokensCapacity).toBe(512);
    expect(a3FusedOverCap.selectedMethod).toBe("FUSED_MC2");
    expect(a3FusedOverCap.selectedSubVariant).toBe("DISPATCH_FFN_COMBINE");

    const a3Ep64NoMega = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 64,
      tpSize: 2,
      numTokens: 1024,
      maxCaptureSize: 512,
      enablePrefillMc2: true,
      maxBatchedTokens: 2048,
      enableFusedMc2: true,
      useCannMegamoe: false,
    });
    expect(a3Ep64NoMega.selectedMethod).toBe("MC2");

    const a3OverCap = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 16,
      tpSize: 1,
      numTokens: 2048,
      enableFusedMc2: false,
      useCannMegamoe: false,
    });
    expect(a3OverCap.selectedMethod).toBe("ALLTOALL");
    expect(a3OverCap.remediationKind).toBe("enable-megamoe");

    // A5: CAPACITY_AND_WORLD_SIZE (MegaMoe -> MC2 -> ep<=topK ALLGATHER -> ALLTOALL)
    expect(
      computeMoeDispatchSandboxState({
        soc: "A5",
        epWorldSize: 16,
        tpSize: 1,
        numTokens: 4096,
        enableFusedMc2: true,
        useCannMegamoe: true,
      }).selectedMethod,
    ).toBe("FUSED_MC2");
    expect(
      computeMoeDispatchSandboxState({ soc: "A5", epWorldSize: 8, tpSize: 1, numTokens: 512 }).selectedMethod,
    ).toBe("MC2");
    expect(
      computeMoeDispatchSandboxState({ soc: "A5", epWorldSize: 8, tpSize: 1, numTokens: 2048 })
        .selectedMethod,
    ).toBe("ALLGATHER");
    expect(
      computeMoeDispatchSandboxState({ soc: "A5", epWorldSize: 16, tpSize: 1, numTokens: 2048 })
        .selectedMethod,
    ).toBe("ALLTOALL");

    for (const soc of MOE_SOC_FAMILIES) {
      for (const ep of MOE_EP_WORLD_SIZES) {
        const html = renderToStaticMarkup(
          createElement(MoeDispatchStateInteractive, {
            ...baseProps("moe-dispatch-fig-state-machine"),
            initialSoc: soc,
            initialEpWorldSize: ep,
            initialNumTokens: ep === 16 ? 2048 : 64,
            initialLoraEnabled: soc === "A3" && ep === 32,
          }),
        );
        assertSandboxInvariants(`moe-${soc}-ep${ep}`, html);
      }
    }
    const presetA2Html = renderToStaticMarkup(
      createElement(MoeDispatchStateInteractive, {
        ...baseProps("moe-dispatch-fig-state-machine"),
        initialSoc: "A2",
        initialEpWorldSize: 8,
      }),
    );
    expect(presetA2Html).toContain('data-testid="moe-apply-remediation"');
    expect(presetA2Html).toContain('data-testid="moe-preset-a2-ep8" aria-pressed="true"');
    expect(presetA2Html).toContain('data-testid="moe-param-drawer"');

    // Audit-3 MoE fixes: over-capacity A2 & MegaMoe never claim "通算重叠已就绪"; A2 dual gap remediation covers both
    const a2OverCapState = computeMoeDispatchSandboxState({
      soc: "A2",
      epWorldSize: 16,
      tpSize: 4,
      maxCaptureSize: 512,
      numTokens: 1024,
    });
    expect(a2OverCapState.selectedMethod).toBe("ALLGATHER");
    expect(a2OverCapState.withinCapacity).toBe(false);
    expect(a2OverCapState.capacityRatioPct).toBe(200);
    expect(a2OverCapState.remediationKind).toBe("none");
    const a2OverCapHtml = renderToStaticMarkup(
      createElement(MoeDispatchStateInteractive, {
        ...baseProps("moe-dispatch-fig-state-machine"),
        initialSoc: "A2",
        initialEpWorldSize: 16,
        initialTpSize: 4,
        initialMaxCaptureSize: 512,
        initialNumTokens: 1024,
      }),
    );
    expect(a2OverCapHtml).not.toContain("通算重叠已就绪");

    const a2DualGapState = computeMoeDispatchSandboxState({
      soc: "A2",
      epWorldSize: 8,
      tpSize: 4,
      maxCaptureSize: 512,
      numTokens: 1024,
    });
    expect(a2DualGapState.remediationKind).toBe("raise-a2-ep16-and-fit");

    const a3MegaOverCapHtml = renderToStaticMarkup(
      createElement(MoeDispatchStateInteractive, {
        ...baseProps("moe-dispatch-fig-state-machine"),
        initialSoc: "A3",
        initialEpWorldSize: 16,
        initialTpSize: 4,
        initialEnableFusedMc2: true,
        initialUseCannMegamoe: true,
        initialMaxBatchedTokens: 2048,
        initialNumTokens: 4096,
      }),
    );
    expect(a3MegaOverCapHtml).not.toContain("通算重叠已就绪");
    expect(a3MegaOverCapHtml).not.toContain("全局闸门直判");

    // Slider range expands to keep value synced when initialNumTokens > 8192
    const moeBigTokensHtml = renderToStaticMarkup(
      createElement(MoeDispatchStateInteractive, {
        ...baseProps("moe-dispatch-fig-state-machine"),
        initialNumTokens: 16384,
      }),
    );
    expect(moeBigTokensHtml).toContain('max="16384"');
    expect(moeBigTokensHtml).toContain('value="16384"');

    // P3-1: aria-pressed stays false when any preset-controlled field differs; capture button pressed matches active style
    const partialLoraHtml = renderToStaticMarkup(
      createElement(MoeDispatchStateInteractive, {
        ...baseProps("moe-dispatch-fig-state-machine"),
        initialSoc: "A3",
        initialEpWorldSize: 16,
        initialEnablePrefillMc2: true,
        initialLoraEnabled: true,
        initialUseCannMegamoe: false,
      }),
    );
    expect(partialLoraHtml).toContain('data-testid="moe-preset-a3-lora" aria-pressed="false"');
    expect(partialLoraHtml).toContain('data-testid="moe-cap-512" aria-pressed="true"');

    // GPT-Signoff-15 P2-6: desktop SVG capacity fill uses same linear scale as capacity marker line (64/512 === 12.5%)
    const defaultMoeHtml = renderToStaticMarkup(
      createElement(MoeDispatchStateInteractive, baseProps("moe-dispatch-fig-state-machine")),
    );
    const fillW = Number(
      /<rect[^>]*x="28"[^>]*y="248"[^>]*width="([0-9.]+)"[^>]*height="16"[^>]*rx="5"[^>]*class="wiki-edu-w4a-anim"/.exec(
        defaultMoeHtml,
      )?.[1],
    );
    const capX = Number(/<line[^>]*x1="([0-9.]+)"[^>]*y1="244"/.exec(defaultMoeHtml)?.[1]);
    expect(fillW / (capX - 28)).toBeCloseTo(64 / 512, 5);

    // GPT-Signoff-16 P1: Qwen3-235B-A22B (moeIntermediateSize=1536) passes MegaMoe gate; Qwen3-30B-A3B (768 < 1024) clears MegaMoe to 0 -> MC2 at 64, ALLTOALL at 1024, never recommends enable-megamoe
    const qwen30bAt1024 = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 16,
      tpSize: 4,
      numTokens: 1024,
      expertModel: "qwen3-30b",
      enableFusedMc2: false,
      useCannMegamoe: false,
    });
    expect(qwen30bAt1024.megaMoeShapeSupported).toBe(false);
    expect(qwen30bAt1024.selectedMethod).toBe("ALLTOALL");
    expect(qwen30bAt1024.remediationKind).toBe("enable-prefill-mc2");
    expect(
      computeMoeDispatchSandboxState({
        soc: "A3",
        epWorldSize: 16,
        tpSize: 4,
        numTokens: 64,
        expertModel: "qwen3-30b",
        enableFusedMc2: true,
        useCannMegamoe: true,
      }).selectedMethod,
    ).toBe("MC2");
    expect(
      computeMoeDispatchSandboxState({
        soc: "A3",
        epWorldSize: 16,
        tpSize: 4,
        numTokens: 1024,
        expertModel: "qwen3-30b",
        enableFusedMc2: true,
        useCannMegamoe: true,
      }).selectedMethod,
    ).toBe("ALLTOALL");

    // GPT-Signoff-16 P2-2 & P2-3: EP=4, TP=8 invalid topology blocked; mobile capacity bar strictly monotonic at 1 / 8 / 16 tokens
    const invalidTopo = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 4,
      tpSize: 8,
      numTokens: 64,
    });
    expect(invalidTopo.topologyValid).toBe(false);
    expect(invalidTopo.selectedMethod).toBe("BLOCKED");
    expect(invalidTopo.remediationKind).toBe("fix-ep-tp-topology");

    const lowLoadWidths = [1, 8, 16].map((tok) => {
      const h = renderToStaticMarkup(
        createElement(MoeDispatchStateInteractive, {
          ...baseProps("moe-dispatch-fig-state-machine"),
          initialNumTokens: tok,
        }),
      );
      return Number(/class="wiki-edu-w4a-mbar-fill"\s+style="width:([0-9.]+)%/.exec(h)?.[1]);
    });
    expect(lowLoadWidths[0]).toBeLessThan(lowLoadWidths[1]!);
    expect(lowLoadWidths[1]).toBeLessThan(lowLoadWidths[2]!);
  });

  it("3. CollCommHccsRoceInteractive：15.68× 带宽悬崖、SP 双半防提前舍入、N=16 联动跨机与单指标核验", () => {
    const hccsTp4 = computeCollCommSandboxState({ domain: "hccs", groupSize: 4, payloadMiB: 16 });
    expect(hccsTp4.nominalGBps).toBe(392);
    expect(hccsTp4.cliffRatio).toBe(15.6);
    expect(hccsTp4.exactRatio).toBe(15.68);
    expect(hccsTp4.tpSendMiB).toBe(24);
    expect(hccsTp4.rows[0]?.sendDecimalMB).toBe(25.17);
    expect(hccsTp4.spSendMiB).toBe(24);
    expect(hccsTp4.spHalfStageMiB).toBe(12);
    expect(hccsTp4.epSendMiB).toBe(12);
    expect(hccsTp4.ppSendMiB).toBe(16);
    expect(hccsTp4.dpControlBytesPerDpRank).toBe(8);
    expect(hccsTp4.dpControlBytesAtDp2).toBe(16);
    expect(hccsTp4.isCrossNodeTpCliff).toBe(false);

    // Audit-3 CollComm fixes: SP does not round intermediate halves (N=16, M=6 -> 11.25 MiB) & intra-node N=16 forces cross-node
    const spExact = computeCollCommSandboxState({ domain: "roce", groupSize: 16, payloadMiB: 6 });
    expect(spExact.tpSendMiB).toBe(11.25);
    expect(spExact.spSendMiB).toBe(11.25);

    const intraN16 = computeCollCommSandboxState({ domain: "hccs", groupSize: 16, payloadMiB: 16 });
    expect(intraN16.domain).toBe("roce");
    expect(intraN16.forcedCrossNodeFromIntra).toBe(true);
    expect(intraN16.isCrossNodeTpCliff).toBe(true);
    expect(intraN16.nominalGBps).toBe(25);

    const roceTp16 = computeCollCommSandboxState({ domain: "roce", groupSize: 16, payloadMiB: 16 });
    expect(roceTp16.nominalGBps).toBe(25);
    expect(roceTp16.tpSendMiB).toBe(30);
    expect(roceTp16.tpPerLayerTwoCallsMiB).toBe(60);
    expect(roceTp16.spSendMiB).toBe(30);
    expect(roceTp16.epSendMiB).toBe(15);
    expect(roceTp16.ppSendMiB).toBe(16);
    expect(roceTp16.isCrossNodeTpCliff).toBe(true);
    expect(roceTp16.tpWireUs).toBeGreaterThan(hccsTp4.tpWireUs * 15);

    const safeHybrid = computeCollCommSandboxState({
      domain: "hccs",
      groupSize: 8,
      payloadMiB: 16,
      safeHybridApplied: true,
    });
    expect(safeHybrid.isCrossNodeTpCliff).toBe(false);
    expect(safeHybrid.tpSendMiB).toBe(28);
    expect(safeHybrid.takeawayTone).toBe("accent");

    // GPT-Signoff-16 P2-4: HCCS N=2, M=16 MiB preserves exact 2x bar ratio between TP (42.8 us) and EP (21.4 us)
    const hccsN2Html = renderToStaticMarkup(
      createElement(CollCommHccsRoceInteractive, {
        ...baseProps("coll-comm-fig-hccs-vs-roce"),
        initialDomain: "hccs",
        initialGroupSize: 2,
        initialPayloadMiB: 16,
      }),
    );
    const hccsN2SvgBars = [
      ...hccsN2Html.matchAll(
        /<rect[^>]*x="200"[^>]*width="([0-9.]+)"[^>]*height="16"[^>]*rx="5"[^>]*class="wiki-edu-w4a-anim"/g,
      ),
    ].map((m) => Number(m[1]));
    expect(hccsN2SvgBars[0]! / hccsN2SvgBars[2]!).toBeCloseTo(2, 2);
    const hccsN2MobileBars = [
      ...hccsN2Html.matchAll(/class="wiki-edu-w4a-mbar-fill"\s+style="width:([0-9.]+)%/g),
    ].map((m) => Number(m[1]));
    expect(hccsN2MobileBars[2]! / hccsN2MobileBars[4]!).toBeCloseTo(2, 1);

    for (const dom of COLL_COMM_DOMAINS) {
      for (const n of COLL_COMM_GROUP_SIZES) {
        const html = renderToStaticMarkup(
          createElement(CollCommHccsRoceInteractive, {
            ...baseProps("coll-comm-fig-hccs-vs-roce"),
            initialDomain: dom,
            initialGroupSize: n,
            initialPayloadMiB: n === 16 ? 64 : 16,
          }),
        );
        assertSandboxInvariants(`coll-${dom}-n${n}`, html);
        expect(html).toContain('data-testid="coll-param-drawer"');
        expect(html).toContain("8×DP B");
        expect(html).not.toContain("仅同步 <strong>8 B");
        if (dom === "roce" || n === 16) {
          expect(html).toContain('data-testid="coll-apply-safe-prescription"');
          expect(html).toContain("锁机内 TP=8 + 跨机 PP=2 或 DP=2");
        }
      }
    }
  });

  it("4. HcclBufferLedgerInteractive：五条分派规则、完整异序重排、单卡锚点零计入、step=8 刻度与超窗预设核验", () => {
    expect(computeDpGroupBufferMiB(1)).toBe(50);
    expect(computeDpGroupBufferMiB(2)).toBe(50);
    expect(computeDpGroupBufferMiB(20_000_000)).toBe(77);

    expect(computeFusedMc2WindowMiB(512, 4096, 8).requiredMiB).toBe(58);
    expect(computeFusedMc2WindowMiB(2048, 4096, 8).requiredMiB).toBe(202);
    expect(computeFusedMc2WindowMiB(4096, 4096, 8).requiredMiB).toBe(394);

    // P1-7: _MC2 is ALWAYS initialized (even when EP is off), spanning DP * PCP * TP ranks
    const noEpDp1 = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 4,
      pcpSize: 1,
      dpSize: 1,
      epMode: "off",
      dynamicEplb: false,
      sleepAnchor: false,
    });
    expect(noEpDp1.mc2GroupRankCount).toBe(4);
    expect(noEpDp1.logicalGroups.find((g) => g.groupName === "ep")).toBeUndefined();
    expect(noEpDp1.logicalGroups.find((g) => g.groupName === "mc2")?.ranksTuple).toBe("[0,1,2,3]");
    expect(noEpDp1.logicalGroups.find((g) => g.groupName === "mc2")?.reuseDomain).toBe("mc2");

    // Audit-3 HCCL fixes: single-rank sleep_lifecycle_anchor does NOT count into multiRankActiveSumMiB
    const singleCardSleep = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 1,
      pcpSize: 1,
      dpSize: 1,
      epMode: "off",
      dynamicEplb: false,
      sleepAnchor: true,
    });
    expect(
      singleCardSleep.logicalGroups.find((g) => g.groupName === "sleep_lifecycle_anchor")?.isSingleRank,
    ).toBe(true);
    expect(singleCardSleep.multiRankActiveSumMiB).toBe(0);

    // Audit-3 HCCL fixes: DP=4 lists all 4 DP ranks; DP=2 distinct EP permutes ALL 8 ranks (not 4)
    const dp4State = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 4,
      pcpSize: 1,
      dpSize: 4,
      epMode: "share-tp",
    });
    expect(dp4State.logicalGroups.find((g) => g.groupName === "dp")?.ranksTuple).toBe("[0,4,8,12]");

    const dp2Distinct = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 4,
      pcpSize: 1,
      dpSize: 2,
      epMode: "distinct",
    });
    expect(dp2Distinct.logicalGroups.find((g) => g.groupName === "ep")?.ranksTuple).toBe("[0,2,4,6,1,3,5,7]");
    expect(dp2Distinct.logicalGroups.find((g) => g.groupName === "ep")?.deduplicatedInto).toBeNull();

    const noEpDp2 = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 4,
      pcpSize: 1,
      dpSize: 2,
      epMode: "off",
      dynamicEplb: false,
      sleepAnchor: false,
    });
    expect(noEpDp2.mc2GroupRankCount).toBe(8);
    expect(noEpDp2.logicalGroups.find((g) => g.groupName === "tp")?.ranksTuple).toBe("[0,1,2,3]");
    expect(noEpDp2.logicalGroups.find((g) => g.groupName === "mc2")?.ranksTuple).toBe("[0..7]");
    expect(noEpDp2.logicalGroups.find((g) => g.groupName === "tp")?.deduplicatedInto).toBeNull();
    expect(noEpDp2.uniqueDomainCount).toBe(5);

    // EP sharing DP*PCP*TP deduplicates with world vs distinct order allocates +1 domain (+200 MiB)
    const sharedEp = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 4,
      dpEnabled: false,
      epMode: "share-tp",
      dynamicEplb: true,
      sleepAnchor: true,
      fusedMc2Tokens: 512,
    });
    const distinctEp = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 4,
      dpEnabled: false,
      epMode: "distinct",
      dynamicEplb: true,
      sleepAnchor: true,
      fusedMc2Tokens: 512,
    });
    expect(sharedEp.logicalGroupCount).toBe(10);
    expect(sharedEp.naiveConfigSumMiB).toBe(1551);
    expect(sharedEp.uniqueDomainCount).toBe(6);
    expect(sharedEp.dedupedConfigSumMiB).toBe(751);
    expect(sharedEp.savedByDedupMiB).toBe(800);
    expect(sharedEp.logicalGroups.find((g) => g.groupName === "mc2")?.optionsBufferMiB).toBeNull();

    expect(distinctEp.uniqueDomainCount).toBe(sharedEp.uniqueDomainCount + 1);
    expect(distinctEp.dedupedConfigSumMiB).toBe(sharedEp.dedupedConfigSumMiB + 200);

    // m=2048 requires 202 MiB > default HCCL_BUFFSIZE=200 MiB -> overflow + HCCL_BUFFSIZE_EP warning
    const overflowAndDeadEnv = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      epMode: "share-tp",
      fusedMc2Tokens: 2048,
      hcclBuffsizeEpSet: true,
    });
    expect(overflowAndDeadEnv.mc2RequiredWindowMiB).toBe(202);
    expect(overflowAndDeadEnv.isMc2WindowOverflow).toBe(true);
    expect(overflowAndDeadEnv.mc2WindowDeficitMiB).toBe(2);
    expect(overflowAndDeadEnv.recommendedBuffsizeMiB).toBe(256);
    expect(overflowAndDeadEnv.needsRemediation).toBe(true);
    expect(overflowAndDeadEnv.logicalGroups.find((g) => g.groupName === "ep")?.effectiveBufferMiB).toBe(200);
    expect(overflowAndDeadEnv.summaryText).toContain("闭源 CANN");

    // Wave-3 P2-6 & P2-7 regressions
    const moe4096Before = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 16,
      tpSize: 4,
      numTokens: 4096,
      maxBatchedTokens: 2048,
      enableFusedMc2: false,
      useCannMegamoe: false,
    });
    expect(moe4096Before.remediationLabel).toContain("4,096");
    const moe4096After = computeMoeDispatchSandboxState({
      soc: "A3",
      epWorldSize: 16,
      tpSize: 4,
      numTokens: 4096,
      maxBatchedTokens: Math.max(2048, 4096),
      enableFusedMc2: true,
      useCannMegamoe: true,
    });
    expect(moe4096After.withinCapacity).toBe(true);
    expect(moe4096After.mc2TokensCapacity).toBe(4096);

    const epOffSmallBuffHtml = renderToStaticMarkup(
      createElement(HcclBufferLedgerInteractive, {
        ...baseProps("hccl-buffer-fig-domain-ledger"),
        initialEpMode: "off",
        initialHcclBuffsizeMiB: 32,
        initialFusedMc2Tokens: 512,
      }),
    );
    expect(epOffSmallBuffHtml).toContain("跳过融合 MC2 窗口校验");
    expect(epOffSmallBuffHtml).not.toContain("完全落在");
    expect(epOffSmallBuffHtml).toContain('data-testid="hccl-param-drawer"');
    expect(epOffSmallBuffHtml).toContain('data-testid="hccl-preset-overflow"');
    expect(epOffSmallBuffHtml).toContain('step="8"');

    // Audit-3: unified bar scale at default 200 MiB gives equal 136px width for default domain and MC2 domain
    const defaultHcclHtml = renderToStaticMarkup(
      createElement(HcclBufferLedgerInteractive, baseProps("hccl-buffer-fig-domain-ledger")),
    );
    const mc2EqualWidthMatches = [
      ...defaultHcclHtml.matchAll(
        /<rect[^>]*y="(?:56|216)"[^>]*width="136"[^>]*fill="var\(--color-(?:kv|weight)\)"/g,
      ),
    ];
    expect(mc2EqualWidthMatches.length).toBe(2);

    // GPT-Signoff-16 P2-5 & P3-5: mobile quota bar fills 100% at 202/200 MiB and 29% at 58/200 MiB; 1 MiB sleep anchor scales linearly
    const defaultMobileWidths = [
      ...defaultHcclHtml.matchAll(/class="wiki-edu-w4a-mbar-fill"\s+style="width:([0-9.]+)%/g),
    ].map((m) => Number(m[1]));
    expect(defaultMobileWidths[3]).toBeCloseTo(0.5, 2);
    expect(defaultMobileWidths[5]).toBeCloseTo(29, 1);
    const overflowMobileHtml = renderToStaticMarkup(
      createElement(HcclBufferLedgerInteractive, {
        ...baseProps("hccl-buffer-fig-domain-ledger"),
        initialHcclBuffsizeMiB: 200,
        initialFusedMc2Tokens: 2048,
      }),
    );
    const overflowMobileWidths = [
      ...overflowMobileHtml.matchAll(/class="wiki-edu-w4a-mbar-fill"\s+style="width:([0-9.]+)%/g),
    ].map((m) => Number(m[1]));
    expect(overflowMobileWidths[5]).toBe(100);

    // RedTeam-4 P2-5: TP=2/4/8 scaling & independent fusedMc2Active toggle keep mc2 group resident while skipping window check
    const tp2State = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 2,
      dpSize: 1,
      epMode: "share-tp",
    });
    expect(tp2State.mc2GroupRankCount).toBe(2);
    expect(tp2State.logicalGroups.find((g) => g.groupName === "tp")?.ranksTuple).toBe("[0,1]");
    expect(tp2State.logicalGroups.find((g) => g.groupName === "mc2")?.ranksTuple).toBe("[0,1]");

    const tp8Dp2State = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 8,
      dpSize: 2,
      epMode: "share-tp",
    });
    expect(tp8Dp2State.mc2GroupRankCount).toBe(16);
    expect(tp8Dp2State.logicalGroups.find((g) => g.groupName === "tp")?.ranksTuple).toBe("[0..7]");
    expect(tp8Dp2State.logicalGroups.find((g) => g.groupName === "dp")?.ranksTuple).toBe("[0,8]");
    expect(tp8Dp2State.logicalGroups.find((g) => g.groupName === "mc2")?.ranksTuple).toBe("[0..15]");

    const fusedOnOverflow = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 4,
      epMode: "share-tp",
      fusedMc2Active: true,
      fusedMc2Tokens: 2048,
    });
    const fusedOffSameTopo = computeHcclBufferLedgerState({
      hcclBuffsizeMiB: 200,
      tpSize: 4,
      epMode: "share-tp",
      fusedMc2Active: false,
      fusedMc2Tokens: 2048,
    });
    expect(fusedOnOverflow.windowCheckActive).toBe(true);
    expect(fusedOnOverflow.isMc2WindowOverflow).toBe(true);
    expect(fusedOffSameTopo.fusedMc2Active).toBe(false);
    expect(fusedOffSameTopo.windowCheckActive).toBe(false);
    expect(fusedOffSameTopo.isMc2WindowOverflow).toBe(false);
    expect(fusedOffSameTopo.needsRemediation).toBe(false);
    expect(fusedOffSameTopo.logicalGroupCount).toBe(fusedOnOverflow.logicalGroupCount);
    expect(fusedOffSameTopo.uniqueDomainCount).toBe(fusedOnOverflow.uniqueDomainCount);
    expect(fusedOffSameTopo.dedupedConfigSumMiB).toBe(fusedOnOverflow.dedupedConfigSumMiB);
    expect(fusedOffSameTopo.uniqueDomains.find((g) => g.groupName === "mc2")).toMatchObject({
      optionsBufferMiB: null,
      effectiveBufferMiB: 200,
      reuseDomain: "mc2",
    });

    const fusedOffTp8Html = renderToStaticMarkup(
      createElement(HcclBufferLedgerInteractive, {
        ...baseProps("hccl-buffer-fig-domain-ledger"),
        initialTpSize: 8,
        initialEpMode: "share-tp",
        initialFusedMc2Active: false,
        initialFusedMc2Tokens: 2048,
        initialHcclBuffsizeMiB: 200,
      }),
    );
    assertSandboxInvariants("hccl-tp8-fused-off-m2048", fusedOffTp8Html);
    expect(fusedOffTp8Html).toContain('data-tp-size="8"');
    expect(fusedOffTp8Html).toContain('data-fused-mc2-active="false"');
    expect(fusedOffTp8Html).toContain('data-mc2-overflow="false"');
    expect(fusedOffTp8Html).toContain("纯 TP=8");
    for (const tp of HCCL_TP_SIZES) {
      expect(fusedOffTp8Html).toContain(`data-testid="hccl-tp-${tp}"`);
    }
    expect(fusedOffTp8Html).toContain('data-testid="hccl-tp-8" aria-pressed="true"');
    expect(fusedOffTp8Html).toContain('data-testid="hccl-toggle-fused-mc2" aria-pressed="false"');
    expect(fusedOffTp8Html).toContain("8卡 · 200 MiB");
    expect(fusedOffTp8Html).toContain("跳过融合 MC2 窗口校验");
    expect(fusedOffTp8Html).not.toContain('data-testid="hccl-apply-remediation"');

    for (const epMode of HCCL_EP_RANK_MODES) {
      for (const deadEnv of [false, true]) {
        for (const mTok of [512, 2048]) {
          const html = renderToStaticMarkup(
            createElement(HcclBufferLedgerInteractive, {
              ...baseProps("hccl-buffer-fig-domain-ledger"),
              initialEpMode: epMode,
              initialDpEnabled: epMode === "distinct",
              initialFusedMc2Tokens: mTok,
              initialHcclBuffsizeEpSet: deadEnv,
            }),
          );
          assertSandboxInvariants(`hccl-${epMode}-m${mTok}-dead${deadEnv}`, html);
          if (deadEnv || (epMode !== "off" && mTok === 2048)) {
            expect(html).toContain('data-testid="hccl-apply-remediation"');
          }
          if (epMode !== "off" && mTok === 2048) {
            expect(html).toContain("缺口 2 MiB");
          }
        }
      }
    }
  });
});
