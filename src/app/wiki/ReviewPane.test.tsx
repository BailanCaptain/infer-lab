import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeXmlEntities } from "../../content/wiki/diagram-sanitize";
import { DropReceiptView } from "./DropReceiptView";
import { ReviewMarkdownLink } from "./DropReviewPreview";
import { parseReviewDiff } from "./diff";
import { FileDiff, ReviewSvgAssets } from "./ReviewPane";

interface MiniAttr {
  name: string;
  value: string;
}

abstract class MiniNode {
  static readonly ELEMENT_NODE = 1;
  static readonly TEXT_NODE = 3;
  abstract readonly nodeType: number;
}

class MiniText extends MiniNode {
  readonly nodeType = 3;
  constructor(public readonly nodeValue: string) {
    super();
  }
}

class MiniElement extends MiniNode {
  readonly nodeType = 1;
  readonly nodeValue = null;
  readonly attributes: MiniAttr[] = [];
  readonly childNodes: Array<MiniElement | MiniText> = [];
  constructor(public readonly tagName: string) {
    super();
  }
  setAttribute(name: string, value: string): void {
    const existing = this.attributes.find((a) => a.name === name);
    if (existing) existing.value = value;
    else this.attributes.push({ name, value });
  }
  appendChild(child: MiniElement | MiniText): MiniElement | MiniText {
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
    .map((child) => (child instanceof MiniText ? escapeXml(child.nodeValue) : serializeMini(child)))
    .join("");
  return `<${el.tagName}${attrs}>${inner}</${el.tagName}>`;
}

function parseSimpleXml(xml: string): MiniElement {
  const rootHolder = new MiniElement("holder");
  const stack: MiniElement[] = [rootHolder];
  const tokenRe = /<(\/?)([A-Za-z0-9:_-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null = tokenRe.exec(xml);
  while (match) {
    const [, closing, tag, attrText, selfClosing, rawText] = match;
    const current = stack[stack.length - 1]!;
    if (rawText !== undefined) {
      if (rawText.trim()) current.appendChild(new MiniText(decodeXmlEntities(rawText)));
    } else if (closing) {
      if (stack.length > 1) stack.pop();
    } else if (tag) {
      const el = new MiniElement(tag);
      const attrRe = /([A-Za-z0-9:_-]+)="([^"]*)"/g;
      let am: RegExpExecArray | null = attrRe.exec(attrText ?? "");
      while (am) {
        if (am[1] !== undefined && am[2] !== undefined) {
          el.setAttribute(am[1], decodeXmlEntities(am[2]));
        }
        am = attrRe.exec(attrText ?? "");
      }
      current.appendChild(el);
      if (!selfClosing) stack.push(el);
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
      const root = parseSimpleXml(source);
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

describe("ReviewSvgAssets 统一走 sanitizeDiagram 且隔离前后图实例 ID", () => {
  it("剥离恶意标签/外链/原型属性，不使用裸 data URI，并隔离前后同名 pattern 与 marker ID", () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" onload="alert(1)" constructor="x"><title>TP&gt;1 测试图</title><script>alert(1)</script><rect x="10" y="10" width="80" height="40" toString="y" fill="u\\72l(https://evil.example/fill)" stroke="url(https://evil.example/stroke)"/><text x="20" y="35" fill="#17211f">安全节点</text></svg>`;
    const singleHtml = renderToStaticMarkup(
      createElement(ReviewSvgAssets, {
        writes: [{ path: "wiki/diagrams/demo.svg", before: null, after: malicious }],
      }),
    );
    expect(singleHtml).not.toContain("data:image/svg+xml");
    expect(singleHtml).not.toContain("<script");
    expect(singleHtml).not.toContain("evil.example");
    expect(singleHtml).not.toContain("constructor=");
    expect(singleHtml).not.toContain("toString=");
    expect(singleHtml).toContain("安全节点");

    const makeDiagram = (paintHex: string, arrowHex: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" width="240" height="120">` +
      `<defs>` +
      `<pattern id="review-shared-paint" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${paintHex}"/></pattern>` +
      `<marker id="review-shared-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${arrowHex}"/></marker>` +
      `</defs>` +
      `<g class="wiki-anim-band" data-ms="600">` +
      `<rect class="wiki-anim-box" x="0" y="0" width="240" height="120" fill="none"/>` +
      `<text class="wiki-anim-title" x="12" y="18">第 1 步</text>` +
      `<rect x="16" y="28" width="120" height="60" fill="url(#review-shared-paint)" stroke="url(#review-shared-paint)"/>` +
      `<path d="M20 96 L180 96" stroke="${arrowHex}" marker-start="url(#review-shared-arrow)" marker-end="url(#review-shared-arrow)"/>` +
      `<g class="wiki-anim-move" data-keys="0 1"><path class="wiki-anim-route" d="M20 40 L160 40"/><g class="wiki-anim-payload"><rect x="20" y="32" width="24" height="16" fill="${paintHex}"/></g></g>` +
      `</g>` +
      `</svg>`;

    const reviewHtml = renderToStaticMarkup(
      createElement(ReviewSvgAssets, {
        writes: [
          {
            path: "wiki/diagrams/shared.svg",
            before: makeDiagram("#dc2626", "#991b1b"),
            after: makeDiagram("#2563eb", "#1d4ed8"),
          },
        ],
      }),
    );

    const allIds = [...reviewHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(allIds.length).toBe(4);
    expect(new Set(allIds).size).toBe(4);
    expect(reviewHtml).not.toContain('id="review-shared-paint"');
    expect(reviewHtml).not.toContain("url(#review-shared-paint)");

    const figures = reviewHtml.split('<figure class="wiki-diagram"').slice(1);
    expect(figures).toHaveLength(2);
    for (const [idx, expectedPaint, expectedArrow] of [
      [0, "#dc2626", "#991b1b"],
      [1, "#2563eb", "#1d4ed8"],
    ] as const) {
      const fig = figures[idx]!;
      const patternMatch = /<pattern[^>]*\bid="([^"]+)"[^>]*><rect[^>]*fill="([^"]+)"/.exec(fig);
      const markerMatch = /<marker[^>]*\bid="([^"]+)"[^>]*><path[^>]*fill="([^"]+)"/.exec(fig);
      expect(patternMatch?.[2]).toBe(expectedPaint);
      expect(markerMatch?.[2]).toBe(expectedArrow);
      const pid = patternMatch![1]!;
      const mid = markerMatch![1]!;
      expect(fig).toContain(`fill="url(#${pid})"`);
      expect(fig).toContain(`stroke="url(#${pid})"`);
      expect(fig).toContain(`marker-start="url(#${mid})"`);
      expect(fig).toContain(`marker-end="url(#${mid})"`);
      expect(fig).toContain('class="wiki-anim-band"');
      expect(fig).toContain('class="wiki-anim-payload"');
    }
  });
});

describe("审阅阅读模式与 Drop 审阅组件统一重写相对引用链接并保留待审 raw 通道", () => {
  it("将跨页相对链接、页内锚点及 DropReceipt 链接映射至 #/wiki 阅读路由，同时将待审 raw 链接保留在受保护 /api/wiki/raw 通道", () => {
    const answerId = "c68f109c21512e962fbd0a86dc354647511af4bebee558e20f680f4461319807";
    const rawHashA = "a".repeat(64);
    const rawHashB = "b".repeat(64);
    const addedMarkdown = [
      "---",
      `id: answer-${answerId}`,
      "title: 问答归档测试",
      "type: source",
      "summary: 测试引用跳转",
      "sources: [https://docs.vllm.ai/en/latest/]",
      "evidence: C",
      "updated: '2026-11-15'",
      "---",
      "",
      "见 [分块预填充算例](../concepts/chunked-prefill.md#怎么切) 与 [适用条件](#适用条件与限制)。",
      "",
      `原始对话见 [问答原文](raw:sha256-${rawHashA}.md#L1-L15) 与 [相对快照](../raw/sha256-${rawHashB}.md#L3-L9) 及 [官方文档](https://docs.vllm.ai/en/latest/)。`,
    ].join("\n");
    const diffText = [
      `wiki/sources/answer-${answerId}.md (新增)`,
      `@@ -0,0 +1,${addedMarkdown.split("\n").length} @@`,
      ...addedMarkdown.split("\n").map((line) => `+${line}`),
    ].join("\n");
    const [file] = parseReviewDiff(diffText);
    expect(file).toBeDefined();

    const html = renderToStaticMarkup(createElement(FileDiff, { file: file!, open: true }));

    expect(html).not.toContain('href="../concepts/chunked-prefill.md');
    expect(decodeURIComponent(html)).toContain('href="#/wiki/chunked-prefill#怎么切"');
    expect(decodeURIComponent(html)).toContain(`href="#/wiki/answer-${answerId}#适用条件与限制"`);
    expect(html).toContain(
      `href="/api/wiki/raw?ref=${encodeURIComponent(`raw:sha256-${rawHashA}.md#L1-L15`)}"`,
    );
    expect(html).toContain(
      `href="/api/wiki/raw?ref=${encodeURIComponent(`raw:sha256-${rawHashB}.md#L3-L9`)}"`,
    );
    expect(html).toContain('href="https://docs.vllm.ai/en/latest/" target="_blank" rel="noreferrer"');

    const receiptHtml = renderToStaticMarkup(
      createElement(DropReceiptView, {
        receipt: {
          protocol: 4,
          baseline: "0".repeat(64),
          budget: { contextWindowTokens: 128000, outputReserveTokens: 16384, algorithm: 1 },
          resources: [],
          requiredReads: [],
          inputs: [],
          queries: [],
          decisions: [],
          plans: [
            {
              path: "wiki/concepts/chunked-prefill.md",
              reason: "更新算例",
              evidence: [`raw:sha256-${rawHashA}.md#L1-L15`],
              comparisons: [{ page: "chunked-prefill", quote: "每轮预算", reason: "对照条件" }],
            },
          ],
          requiredChecks: [],
          checks: [],
          factDispositions: [
            {
              pageId: "one-request",
              baseHash: "1".repeat(64),
              candidateHash: "2".repeat(64),
              fact: "分块规则",
              outlet: "migrated",
              targetPage: "chunked-prefill",
              targetAnchor: "怎么切",
              verification: "semantic-check",
              targetQuote: "每轮预算",
              reason: "归口至专页",
              checkId: "fact-disposition:one-request",
            },
          ],
        },
      }),
    );
    expect(receiptHtml).not.toContain('href="/#/wiki/chunked-prefill"');
    expect(receiptHtml).toContain('href="#/wiki/chunked-prefill"');
    expect(decodeURIComponent(receiptHtml)).toContain('href="#/wiki/chunked-prefill#怎么切"');

    const directPreviewLink = renderToStaticMarkup(
      createElement(
        ReviewMarkdownLink,
        { href: "../concepts/one-request.md#一条请求要走过七站", currentId: "chunked-prefill" },
        "单请求主线",
      ),
    );
    expect(decodeURIComponent(directPreviewLink)).toContain('href="#/wiki/one-request#一条请求要走过七站"');
  });
});
