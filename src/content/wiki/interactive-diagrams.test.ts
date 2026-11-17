import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import APPROVED_SVG from "../../../wiki/diagrams/quantization-intuition.svg?raw";
import { decodeXmlEntities } from "./diagram-sanitize";
import {
  QUANTIZATION_INTUITION_APPROVED_SHA256,
  registeredInteractiveDiagramIds,
  resolveInteractiveDiagram,
  sha256Hex,
} from "./interactive-diagrams";
import { WikiDiagram } from "./WikiDiagram";

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

describe("人工静态白名单交互式 React 2D 注册表与版本绑定", () => {
  it("纯 TS 同步 sha256Hex 与标准 Web Crypto SHA-256 完全一致，并锁定审定 quantization-intuition.svg 指纹", async () => {
    for (const sample of [
      "",
      "a",
      "a".repeat(55),
      "a".repeat(56),
      "a".repeat(64),
      "a".repeat(65),
      "普通动态 W8A8 Linear 🔍🧪🚀",
      APPROVED_SVG,
    ]) {
      const digestBuf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(sample));
      const expected = Array.from(new Uint8Array(digestBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(sha256Hex(sample)).toBe(expected);
    }
    expect(sha256Hex(APPROVED_SVG.replace(/\r\n/g, "\n"))).toBe(QUANTIZATION_INTUITION_APPROVED_SHA256);
    expect(registeredInteractiveDiagramIds()).toEqual(["quantization-intuition"]);
  });

  it("拒绝未知图 ID、非 kebab-case 路径与 Object.prototype 同名属性，绝不回落到原型对象", () => {
    for (const badId of [
      "unknown-diagram",
      "paged-attention",
      "../quantization-intuition",
      "Quantization-Intuition",
      "constructor",
      "toString",
      "__proto__",
      "valueOf",
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "toLocaleString",
    ]) {
      expect(
        resolveInteractiveDiagram({ id: badId, svg: APPROVED_SVG, allowInteractive: true }),
        `badId=${badId}`,
      ).toBeNull();
    }
  });

  it("allowInteractive 默认关闭；Review/候选预览与 live SVG 字节变化均自动回退真实静态清洗 SVG", () => {
    // 1) 未显式开启 allowInteractive（如 ReviewPane / 未发布预览）-> 静态渲染
    const previewHtml = renderToStaticMarkup(
      createElement(WikiDiagram, { id: "quantization-intuition", svg: APPROVED_SVG }),
    );
    expect(previewHtml).not.toContain('data-interactive="true"');
    expect(previewHtml).not.toContain("wiki-diagram-toolbar");
    expect(previewHtml).toContain("离线做一次：权重压成 INT8");

    // 2) 显式开启 allowInteractive 且匹配审定 SHA-256 -> 挂载四步交互外壳，默认静态总览
    const formalHtml = renderToStaticMarkup(
      createElement(WikiDiagram, {
        id: "quantization-intuition",
        svg: APPROVED_SVG.replace(/\n/g, "\r\n"),
        allowInteractive: true,
        onOpenEvidence: () => {},
      }),
    );
    expect(formalHtml).toContain('data-interactive="true"');
    expect(formalHtml).toContain('data-mode="overview"');
    expect(formalHtml).toContain('data-step="0"');
    expect(formalHtml).toContain("静态总览");
    expect(formalHtml).toContain("手动分步");
    expect(formalHtml).toContain('data-testid="diagram-evidence-quantization-intuition"');
    expect(formalHtml).not.toContain("-77");
    expect(formalHtml).not.toContain("127, -45");
    expect(formalHtml).not.toContain("—");

    // 3) 同 ID 的 live SVG 已改变（哪怕仅修改一处文案或几何）-> 自动回退展示新静态图，绝不遮盖新内容
    const liveChangedSvg = APPROVED_SVG.replace("BF16：每个数 2 字节", "LIVE_UPDATED_BF16_LABEL");
    expect(
      resolveInteractiveDiagram({
        id: "quantization-intuition",
        svg: liveChangedSvg,
        allowInteractive: true,
      }),
    ).toBeNull();
    const fallbackHtml = renderToStaticMarkup(
      createElement(WikiDiagram, {
        id: "quantization-intuition",
        svg: liveChangedSvg,
        allowInteractive: true,
      }),
    );
    expect(fallbackHtml).not.toContain('data-interactive="true"');
    expect(fallbackHtml).not.toContain("wiki-diagram-toolbar");
    expect(fallbackHtml).toContain("LIVE_UPDATED_BF16_LABEL");
  });

  it("同页双实例交互式 WikiDiagram 仍经过共用 sanitizeDiagram 清洗并按实例隔离内部 marker id", () => {
    const dualHtml = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(WikiDiagram, {
          id: "quantization-intuition",
          svg: APPROVED_SVG,
          allowInteractive: true,
        }),
        createElement(WikiDiagram, {
          id: "quantization-intuition",
          svg: APPROVED_SVG,
          allowInteractive: true,
        }),
      ),
    );
    const markerIds = [...dualHtml.matchAll(/<marker[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(markerIds).toHaveLength(4);
    expect(new Set(markerIds).size).toBe(4);
    expect(dualHtml).not.toContain('id="quantization-intuition-ah-ink"');
  });
});
