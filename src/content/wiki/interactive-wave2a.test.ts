import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BATCH_TRACE_STEPS,
  CONTINUOUS_BATCHING_TRACE_APPROVED_SHA256,
  ContinuousBatchingTraceInteractive,
} from "./ContinuousBatchingTraceInteractive";
import { decodeXmlEntities, sanitizeDiagram } from "./diagram-sanitize";
import {
  computeGqaSandboxMetrics,
  GQA_RATIO_MODES,
  GQA_SHARED_KV_APPROVED_SHA256,
  GqaSharedKvInteractive,
} from "./GqaSharedKvInteractive";
import { sha256Hex } from "./interactive-diagrams";
import {
  MLA_INTUITION_APPROVED_SHA256,
  MLA_INTUITION_STEPS,
  MlaIntuitionInteractive,
} from "./MlaIntuitionInteractive";
import {
  MOE_CALC_STEPS,
  MOE_ROUTER_CALC_APPROVED_SHA256,
  MoeRouterCalcInteractive,
} from "./MoeRouterCalcInteractive";
import {
  computePagedWasteComparison,
  MAX_MODEL_LEN_OPTIONS,
  PAGED_ATTENTION_WASTE_APPROVED_SHA256,
  PagedAttentionWasteInteractive,
} from "./PagedAttentionWasteInteractive";
import {
  REQUEST_CAUSAL_KV_MLP_APPROVED_SHA256,
  REQUEST_LAYER_STEPS,
  RequestCausalKvMlpInteractive,
} from "./RequestCausalKvMlpInteractive";
import {
  SPEC_DECODE_STEPS,
  SPECULATIVE_DECODING_APPROVED_SHA256,
  SpeculativeDecodingInteractive,
} from "./SpeculativeDecodingInteractive";
import { TOKEN_BPE_APPROVED_SHA256, TOKEN_BPE_STEPS, TokenBpeInteractive } from "./TokenBpeInteractive";

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

const ALLOWED_WARM_MINERAL_HEX = new Set([
  "#fbfaf6",
  "#ece9df",
  "#d8d8cf",
  "#17211f",
  "#66716d",
  "#e85b32",
  "#087f73",
  "#ddf4ef",
  "#c78300",
  "#fff4cf",
  "#4c65b6",
  "#e8edff",
  "#9a4b86",
  "#f7e7f2",
  "#b54237",
  "#fff0e9",
  "#ffffff",
]);

function assertToolbarButtonsContrast(label: string, html: string): void {
  const btnMatches = [...html.matchAll(/<button\b[^>]*>/g)];
  expect(btnMatches.length, `${label} has toolbar buttons`).toBeGreaterThanOrEqual(4);
  for (const bm of btnMatches) {
    const tag = bm[0];
    const pressed = /\baria-pressed="true"/.test(tag);
    if (pressed) {
      expect(tag, `${label} pressed btn white text`).toContain("color:#ffffff");
      expect(tag, `${label} pressed btn dark bg`).toMatch(/background:#(087f73|17211f|e85b32|b54237)/);
    } else {
      expect(tag, `${label} idle btn dark text`).toContain("color:#17211f");
      expect(tag, `${label} idle btn light bg`).toContain("background:#ffffff");
    }
  }
}

function assertSandboxInvariants(label: string, html: string): void {
  expect(html, `${label} has unified edu shell`).toContain("wiki-edu-card");
  expect(html, `${label} has collapsible details drawer`).toContain("wiki-edu-details");
  const svgMatches = [...html.matchAll(/<svg\b[^>]*>/g)];
  expect(svgMatches.length, `${label} <= 1 inline <svg>`).toBeLessThanOrEqual(1);
  if (svgMatches[0]) {
    const widthMatch = /\bwidth="(\d+)"/.exec(svgMatches[0][0]);
    expect(Number(widthMatch?.[1]), `${label} width <= 900`).toBeLessThanOrEqual(900);
  }
  for (const fm of html.matchAll(/\bfont-size="([0-9.]+)"/g)) {
    expect(Number(fm[1]), `${label} font-size >= 12`).toBeGreaterThanOrEqual(12);
  }
  for (const hm of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    expect(ALLOWED_WARM_MINERAL_HEX.has(hm[0].toLowerCase()), `${label} hex ${hm[0]}`).toBe(true);
  }
  assertToolbarButtonsContrast(label, html);
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

describe("Wave 2A (#1–#8) 2D 教学交互沙盘全量契约与领域算例核验", () => {
  it("全部 8 个组件导出的 APPROVED_SHA256 与磁盘 LF 归一 SVG 精确一致，默认进入交互态且支持静态图切换与双实例 marker 隔离", () => {
    const entries = [
      {
        id: "request-fig-causal-kv-mlp",
        sha: REQUEST_CAUSAL_KV_MLP_APPROVED_SHA256,
        Comp: RequestCausalKvMlpInteractive,
      },
      {
        id: "token-bpe",
        sha: TOKEN_BPE_APPROVED_SHA256,
        Comp: TokenBpeInteractive,
      },
      {
        id: "gqa-fig-shared-kv-cost-split",
        sha: GQA_SHARED_KV_APPROVED_SHA256,
        Comp: GqaSharedKvInteractive,
      },
      {
        id: "moe-router-calc-qwen3",
        sha: MOE_ROUTER_CALC_APPROVED_SHA256,
        Comp: MoeRouterCalcInteractive,
      },
      {
        id: "continuous-batching-two-queues-trace",
        sha: CONTINUOUS_BATCHING_TRACE_APPROVED_SHA256,
        Comp: ContinuousBatchingTraceInteractive,
      },
      {
        id: "paged-attention-fig-waste-vs-paging",
        sha: PAGED_ATTENTION_WASTE_APPROVED_SHA256,
        Comp: PagedAttentionWasteInteractive,
      },
      {
        id: "mla-intuition",
        sha: MLA_INTUITION_APPROVED_SHA256,
        Comp: MlaIntuitionInteractive,
      },
      {
        id: "speculative-decoding",
        sha: SPECULATIVE_DECODING_APPROVED_SHA256,
        Comp: SpeculativeDecodingInteractive,
      },
    ] as const;

    for (const entry of entries) {
      const svgPath = resolve(process.cwd(), "wiki", "diagrams", `${entry.id}.svg`);
      const lfSvg = readFileSync(svgPath, "utf8").replace(/\r\n/g, "\n");
      expect(sha256Hex(lfSvg), `${entry.id} sha256`).toBe(entry.sha);

      const defaultHtml = renderToStaticMarkup(createElement(entry.Comp, baseProps(entry.id)));
      expect(defaultHtml, `${entry.id} default sandbox`).toContain('data-mode="sandbox"');
      assertSandboxInvariants(`${entry.id}-default`, defaultHtml);

      const svgHtml = renderToStaticMarkup(
        createElement(entry.Comp, { ...baseProps(entry.id), initialMode: "svg" }),
      );
      expect(svgHtml, `${entry.id} svg mode`).toContain('data-mode="svg"');
      expect(svgHtml, `${entry.id} return btn`).toContain('data-testid="diagram-mode-sandbox"');
      assertToolbarButtonsContrast(`${entry.id}-svg-mode`, svgHtml);

      const dualHtml = renderToStaticMarkup(
        createElement(
          "div",
          null,
          createElement(entry.Comp, baseProps(entry.id)),
          createElement(entry.Comp, baseProps(entry.id)),
        ),
      );
      const markers = [...dualHtml.matchAll(/<marker[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
      expect(markers.length, `${entry.id} has isolated markers`).toBeGreaterThanOrEqual(2);
      expect(new Set(markers).size, `${entry.id} unique marker ids`).toBe(markers.length);
    }
  });

  it("1–4 号沙盘（Request / Token BPE / GQA / MoE）全状态切换、暖矿物色板与页面数字 100% 对齐", () => {
    for (const s of REQUEST_LAYER_STEPS) {
      const html = renderToStaticMarkup(
        createElement(RequestCausalKvMlpInteractive, {
          ...baseProps("request-fig-causal-kv-mlp"),
          initialStep: s.step,
        }),
      );
      assertSandboxInvariants(`request-step-${s.step}`, html);
      expect(html).toContain(`data-step="${s.step}"`);
      if (s.step === 4) {
        expect(html).toContain("末行 h₁ [1, 4]");
        expect(html).toContain("★ 选出「猫」");
      }
    }

    expect(TOKEN_BPE_STEPS.map((s) => s.pieces.length)).toEqual([6, 4, 2, 1, 1]);
    for (const s of TOKEN_BPE_STEPS) {
      const html = renderToStaticMarkup(
        createElement(TokenBpeInteractive, {
          ...baseProps("token-bpe"),
          initialStep: s.step,
        }),
      );
      assertSandboxInvariants(`token-bpe-${s.step}`, html);
      if (s.step === 5) {
        expect(html).toContain("Token ID = 9123");
        expect(html).toContain("151,936");
      }
    }

    const mha = computeGqaSandboxMetrics("mha-1-1");
    const gqa4 = computeGqaSandboxMetrics("gqa-4-1");
    const gqa8 = computeGqaSandboxMetrics("gqa-8-1");
    const mqa = computeGqaSandboxMetrics("mqa-32-1");
    expect([mha.kv4kMiB, gqa4.kv4kMiB, gqa8.kv4kMiB, mqa.kv4kMiB]).toEqual([2048, 512, 256, 64]);
    expect(gqa4.wqWoPct).toBe(100);
    expect(gqa4.scoreMergePct).toBe(100);
    for (const rm of GQA_RATIO_MODES) {
      const html = renderToStaticMarkup(
        createElement(GqaSharedKvInteractive, {
          ...baseProps("gqa-fig-shared-kv-cost-split"),
          initialRatioMode: rm,
        }),
      );
      assertSandboxInvariants(`gqa-${rm}`, html);
      expect(html).toContain(`data-ratio-mode="${rm}"`);
      expect(html).toContain("[0.82, 0.27]");
    }

    for (const s of MOE_CALC_STEPS) {
      const html = renderToStaticMarkup(
        createElement(MoeRouterCalcInteractive, {
          ...baseProps("moe-router-calc-qwen3"),
          initialStep: s.step,
        }),
      );
      assertSandboxInvariants(`moe-step-${s.step}`, html);
      if (s.step === 4) {
        expect(html).toContain("[1.46, 0.27, 1.27, −0.46]");
      }
    }
  });

  it("5–8 号沙盘（Continuous Batching / PagedAttention / MLA / Speculative Decoding）全状态切换与单调性成立", () => {
    expect(BATCH_TRACE_STEPS.map((s) => s.queryStartLoc)).toEqual([
      "[0, 3, 5]",
      "[0, 1, 2, 6]",
      "[0, 1, 2, 6]",
      "[0, 1, 2]",
    ]);
    for (const s of BATCH_TRACE_STEPS) {
      const html = renderToStaticMarkup(
        createElement(ContinuousBatchingTraceInteractive, {
          ...baseProps("continuous-batching-two-queues-trace"),
          initialStep: s.step,
        }),
      );
      assertSandboxInvariants(`batch-trace-${s.step}`, html);
      expect(html).toContain(s.queryStartLoc);
    }

    const short8k = computePagedWasteComparison(300, 8192);
    const short16k = computePagedWasteComparison(300, 16384);
    const long8k = computePagedWasteComparison(2000, 8192);
    expect(short8k.blocksPerReq).toBe(3);
    expect(short8k.tailInternalSlack).toBe(84);
    expect(short8k.pagedConcurrency).toBe(189);
    expect(short16k.concurrencyGain).toBeGreaterThan(short8k.concurrencyGain);
    expect(short8k.pagedConcurrency).toBeGreaterThan(long8k.pagedConcurrency);

    for (const maxLen of MAX_MODEL_LEN_OPTIONS) {
      for (const actLen of [300, 1200, 3000]) {
        const cmp = computePagedWasteComparison(actLen, maxLen);
        expect(cmp.tailInternalSlack).toBeLessThan(128);
        const html = renderToStaticMarkup(
          createElement(PagedAttentionWasteInteractive, {
            ...baseProps("paged-attention-fig-waste-vs-paging"),
            initialActualLen: actLen,
            initialMaxModelLen: maxLen,
          }),
        );
        assertSandboxInvariants(`paged-${actLen}-${maxLen}`, html);
      }
    }

    for (const s of MLA_INTUITION_STEPS) {
      const html = renderToStaticMarkup(
        createElement(MlaIntuitionInteractive, {
          ...baseProps("mla-intuition"),
          initialStep: s.step,
        }),
      );
      assertSandboxInvariants(`mla-step-${s.step}`, html);
      if (s.step === 4) {
        expect(html).toContain("k=[1,4]");
        expect(html).toContain("k=[2,1]");
      }
    }

    for (const s of SPEC_DECODE_STEPS) {
      const html = renderToStaticMarkup(
        createElement(SpeculativeDecodingInteractive, {
          ...baseProps("speculative-decoding"),
          initialStep: s.step,
        }),
      );
      assertSandboxInvariants(`spec-decode-${s.step}`, html);
      if (s.step === 4) {
        expect(html).toContain("垫子（位置 8 · 主模型改写）");
        expect(html).toContain("✗ 作废不写");
      }
    }
  });
});
