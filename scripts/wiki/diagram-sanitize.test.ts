import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type DefaultTreeAdapterMap, parseFragment } from "parse5";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ALLOWED_TAGS,
  allowedAttribute,
  captionOf,
  sanitizeDiagram,
} from "../../src/content/wiki/diagram-sanitize";

interface FakeAttr {
  name: string;
  value: string;
}

abstract class FakeNode {
  static readonly ELEMENT_NODE = 1;
  static readonly TEXT_NODE = 3;
  abstract readonly nodeType: number;
}

class FakeText extends FakeNode {
  readonly nodeType = 3;
  constructor(public nodeValue: string) {
    super();
  }
}

class FakeElement extends FakeNode {
  readonly nodeType = 1;
  readonly nodeValue = null;
  readonly attributes: FakeAttr[] = [];
  readonly childNodes: Array<FakeElement | FakeText> = [];
  constructor(public readonly tagName: string) {
    super();
  }
  setAttribute(name: string, value: string): void {
    const existing = this.attributes.find((a) => a.name === name);
    if (existing) existing.value = value;
    else this.attributes.push({ name, value });
  }
  appendChild(child: FakeElement | FakeText): FakeElement | FakeText {
    this.childNodes.push(child);
    return child;
  }
  getElementsByTagName(name: string): FakeElement[] {
    const found: FakeElement[] = [];
    const visit = (el: FakeElement) => {
      for (const child of el.childNodes) {
        if (child instanceof FakeElement) {
          if (child.tagName === name) found.push(child);
          visit(child);
        }
      }
    };
    visit(this);
    return found;
  }
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function serializeFakeElement(el: FakeElement): string {
  const attrs = el.attributes.map((a) => ` ${a.name}="${escapeXml(a.value)}"`).join("");
  if (el.childNodes.length === 0) return `<${el.tagName}${attrs}/>`;
  const inner = el.childNodes
    .map((child) => (child instanceof FakeText ? escapeXml(child.nodeValue) : serializeFakeElement(child)))
    .join("");
  return `<${el.tagName}${attrs}>${inner}</${el.tagName}>`;
}

function fromParse5Node(node: DefaultTreeAdapterMap["childNode"]): FakeElement | FakeText | null {
  if (node.nodeName === "#text") {
    return new FakeText((node as DefaultTreeAdapterMap["textNode"]).value);
  }
  if ("tagName" in node) {
    const el = new FakeElement(node.tagName);
    for (const attr of node.attrs) {
      el.setAttribute(attr.name, attr.value);
    }
    for (const child of node.childNodes) {
      const converted = fromParse5Node(child);
      if (converted) el.appendChild(converted);
    }
    return el;
  }
  return null;
}

const savedGlobals: Record<string, unknown> = {};

beforeAll(() => {
  for (const key of ["Node", "DOMParser", "document", "XMLSerializer"]) {
    savedGlobals[key] = (globalThis as Record<string, unknown>)[key];
  }
  (globalThis as Record<string, unknown>).Node = FakeNode;
  (globalThis as Record<string, unknown>).DOMParser = class {
    parseFromString(source: string) {
      const fragment = parseFragment(source);
      const firstEl = fragment.childNodes.find((n) => "tagName" in n);
      const root = firstEl ? (fromParse5Node(firstEl) as FakeElement) : new FakeElement("invalid");
      return {
        documentElement: root,
        getElementsByTagName: (name: string) =>
          name === "parsererror" ? [] : root.getElementsByTagName(name),
      };
    }
  };
  (globalThis as Record<string, unknown>).document = {
    implementation: {
      createDocument(_ns: string, qualifiedName: string) {
        const root = new FakeElement(qualifiedName);
        return {
          documentElement: root,
          createElementNS: (_childNs: string, tag: string) => new FakeElement(tag),
          createTextNode: (text: string) => new FakeText(text),
        };
      },
    },
  };
  (globalThis as Record<string, unknown>).XMLSerializer = class {
    serializeToString(el: FakeElement) {
      return serializeFakeElement(el);
    }
  };
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedGlobals)) {
    if (value === undefined) delete (globalThis as Record<string, unknown>)[key];
    else (globalThis as Record<string, unknown>)[key] = value;
  }
});

describe("SVG 清洗器全量真实语料兼容性", () => {
  it("剥离恶意标签/事件/外链/CSS 转义并解码标题实体", () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" onload="alert(1)">
      <title>TP&gt;1 与 &lt;think&gt; 测试图</title>
      <script>alert(1)</script>
      <style>rect { fill: url(https://evil.example/bg); }</style>
      <foreignObject width="100" height="50"><div>bad</div></foreignObject>
      <rect x="10" y="10" width="80" height="40" fill="u\\72l(https://evil.example/fill)" stroke="url(https://evil.example/stroke)" onclick="evil()"/>
      <text x="20" y="35" font-family="'Inter Variable','Noto Sans SC',system-ui,sans-serif" font-size="13" fill="var(--color-ink, #17211f)">安全节点</text>
    </svg>`;

    const sanitized = sanitizeDiagram(malicious);
    expect(sanitized).toBeTruthy();
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("<style");
    expect(sanitized).not.toContain("foreignObject");
    expect(sanitized).not.toContain("onload");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("evil.example");
    expect(sanitized).toContain("安全节点");
    expect(captionOf(malicious)).toBe("TP>1 与 <think> 测试图");

    const protoDomInput = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" constructor="#fff" __proto__="1"><g toString="1" hasOwnProperty="2"><rect x="2" y="4" width="60" height="20" valueOf="3" isPrototypeOf="4" fill="#087f73"/></g></svg>`;
    const sanitizedProto = sanitizeDiagram(protoDomInput);
    expect(sanitizedProto).toBeTruthy();
    expect(sanitizedProto).toContain('fill="#087f73"');
    expect(sanitizedProto).not.toContain("constructor=");
    expect(sanitizedProto).not.toContain("__proto__=");
    expect(sanitizedProto).not.toContain("tostring=");
    expect(sanitizedProto).not.toContain("hasownproperty=");
    expect(sanitizedProto).not.toContain("valueof=");
  });

  it("仓库现有的全部 wiki/diagrams/*.svg 均 100% 通过正向标签与属性值白名单，零误删节点或属性", () => {
    const dir = join(process.cwd(), "wiki/diagrams");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".svg"))
      .sort();
    expect(files.length).toBeGreaterThanOrEqual(350);

    const rejected: string[] = [];
    for (const file of files) {
      const raw = readFileSync(join(dir, file), "utf8");
      const fragment = parseFragment(raw);
      const rootNode = fragment.childNodes.find((n) => "tagName" in n);
      expect(rootNode, `${file} missing root svg`).toBeTruthy();
      const rootEl = fromParse5Node(rootNode!) as FakeElement;

      const checkEl = (el: FakeElement) => {
        if (!ALLOWED_TAGS.has(el.tagName)) {
          rejected.push(`${file} disallowed tag <${el.tagName}>`);
        }
        for (const attr of el.attributes) {
          if (attr.name === "xmlns") continue;
          if (!allowedAttribute(attr.name, attr.value)) {
            rejected.push(`${file} <${el.tagName} ${attr.name}="${attr.value}">`);
          }
        }
        for (const child of el.childNodes) {
          if (child instanceof FakeElement) checkEl(child);
        }
      };
      checkEl(rootEl);

      const out = sanitizeDiagram(raw);
      expect(out, `${file} sanitizeDiagram returned null`).toBeTruthy();
    }

    expect(rejected).toEqual([]);
  });

  it("captionOf 对带属性 <title>、注释/CDATA 诱饵与 CDATA+实体混合标题按真实 XML 文本语义取值", () => {
    expect(captionOf('<svg><title id="t1">带属性标题</title></svg>')).toBe("带属性标题");
    expect(captionOf("<!-- <title>DECOY</title> --><svg><title><![CDATA[Q < K & V]]></title></svg>")).toBe(
      "Q < K & V",
    );
    expect(captionOf("<svg><title><![CDATA[&lt;literal&gt;]]> &amp;lt;</title></svg>")).toBe(
      "&lt;literal&gt; &lt;",
    );
  });
});
