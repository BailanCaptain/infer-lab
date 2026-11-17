import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowedAttribute, captionOf, decodeXmlEntities } from "./diagram-sanitize";
import { createScrollHintController, type ScrollHintHostLike, WikiDiagram } from "./WikiDiagram";

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
    if (full.startsWith("<!--") || full.startsWith("<?")) {
      // 忽略注释与声明
    } else if (cdataText !== undefined) {
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
      if (source.startsWith("\uFEFF")) {
        return {
          documentElement: new MiniElement("parsererror"),
          getElementsByTagName: (name: string) => ({ length: name === "parsererror" ? 1 : 0 }),
        };
      }
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

describe("WikiDiagram 正向属性值语法、标题解码与 ReviewPane 统一走线", () => {
  it("拒绝外链 url(...)、大小写/空白绕过、单反斜杠 CSS 转义与危险属性值", () => {
    expect(allowedAttribute("stroke", "url(https://evil.example/track.svg#p)")).toBe(false);
    expect(allowedAttribute("fill", "url(https://evil.example/track.svg#p)")).toBe(false);
    expect(allowedAttribute("fill", "URL(#demo-hatch)")).toBe(false);
    expect(allowedAttribute("fill", "  url(#demo-hatch) ")).toBe(false);
    expect(allowedAttribute("fill", "u\\72l(https://evil.example/x)")).toBe(false);
    expect(allowedAttribute("stroke", "\\75rl(https://evil.example/x)")).toBe(false);
    expect(allowedAttribute("font-family", "'Inter';background:url(https://evil.example)")).toBe(false);
    expect(allowedAttribute("transform", "url(https://evil.example)")).toBe(false);
    expect(allowedAttribute("d", "M0 0 url(https://evil.example)")).toBe(false);
    expect(allowedAttribute("onload", "alert(1)")).toBe(false);
    expect(allowedAttribute("href", "https://evil.example")).toBe(false);
    for (const protoKey of [
      "constructor",
      "__proto__",
      "toString",
      "valueOf",
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "toLocaleString",
    ]) {
      expect(allowedAttribute(protoKey, "#fff"), `protoKey=${protoKey}`).toBe(false);
    }
  });

  it("保留合法的内部引用、设计令牌颜色、双字体栈、几何变换与硬件语义属性", () => {
    expect(allowedAttribute("fill", "url(#tp-hatch)")).toBe(true);
    expect(allowedAttribute("marker-end", "url(#tp-arrow-comm)")).toBe(true);
    expect(allowedAttribute("fill", "var(--color-token, #087f73)")).toBe(true);
    expect(allowedAttribute("stroke", "#17211f")).toBe(true);
    expect(allowedAttribute("fill", "none")).toBe(true);
    expect(allowedAttribute("font-family", "'Inter Variable','Noto Sans SC',system-ui,sans-serif")).toBe(
      true,
    );
    expect(allowedAttribute("font-family", "'JetBrains Mono',ui-monospace,monospace")).toBe(true);
    expect(allowedAttribute("transform", "translate(159.8 282.8) scale(0.85)")).toBe(true);
    expect(allowedAttribute("patternTransform", "rotate(45)")).toBe(true);
    expect(allowedAttribute("data-hardware", "server")).toBe(true);
    expect(allowedAttribute("data-port", "3")).toBe(true);
  });

  it("解码 SVG <title> 中的 XML 实体，并剥离恶意标签与外链", () => {
    expect(captionOf("<svg><title>TP&gt;1 下 &lt;think&gt; 与 A &amp; B</title></svg>")).toBe(
      "TP>1 下 <think> 与 A & B",
    );
    expect(captionOf("<svg><title>&amp;lt;script&amp;gt;</title></svg>")).toBe("&lt;script&gt;");

    const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" onload="alert(1)"><title>TP&gt;1 测试图</title><script>alert(1)</script><rect x="10" y="10" width="80" height="40" fill="u\\72l(https://evil.example/fill)" stroke="url(https://evil.example/stroke)"/><text x="20" y="35" fill="#17211f">安全节点</text></svg>`;

    const diagramHtml = renderToStaticMarkup(createElement(WikiDiagram, { id: "demo", svg: malicious }));
    expect(diagramHtml).toContain("<figcaption>TP&gt;1 测试图</figcaption>");
    expect(diagramHtml).not.toContain("&amp;gt;");
    expect(diagramHtml).not.toContain("<script");
    expect(diagramHtml).not.toContain("evil.example");
  });

  it("面对携带 Object.prototype 同名属性的 SVG 输入不抛异常并干净剥离原型同名属性", () => {
    const protoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" constructor="#fff" __proto__="1"><rect x="4" y="6" width="80" height="24" toString="x" hasOwnProperty="y" valueOf="z" fill="#087f73"/><text x="12" y="22" fill="#17211f">原型安全</text></svg>`;

    const diagramHtml = renderToStaticMarkup(createElement(WikiDiagram, { id: "proto", svg: protoSvg }));
    expect(diagramHtml).toContain("原型安全");
    expect(diagramHtml).toContain('fill="#087f73"');
    expect(diagramHtml).not.toContain("constructor=");
    expect(diagramHtml).not.toContain("__proto__=");
    expect(diagramHtml).not.toContain("toString=");
    expect(diagramHtml).not.toContain("hasOwnProperty=");
    expect(diagramHtml).not.toContain("valueOf=");
  });

  it("同页多实例 WikiDiagram（含相同逻辑 id）按渲染实例隔离 id 与 url(#id)，且保留分镜播放器选择器", () => {
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

    const redSvg = makeDiagram("#dc2626", "#991b1b");
    const blueSvg = makeDiagram("#2563eb", "#1d4ed8");

    const dualSameIdHtml = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(WikiDiagram, { id: "same-diagram", svg: redSvg }),
        createElement(WikiDiagram, { id: "same-diagram", svg: blueSvg }),
      ),
    );
    const dualIds = [...dualSameIdHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(dualIds.length).toBe(4);
    expect(new Set(dualIds).size).toBe(4);
    expect(dualSameIdHtml).not.toContain('id="review-shared-paint"');
    expect(dualSameIdHtml).not.toContain("url(#review-shared-paint)");

    const figures = dualSameIdHtml.split('<figure class="wiki-diagram"').slice(1);
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
      expect(fig).toContain('class="wiki-anim-box"');
      expect(fig).toContain('class="wiki-anim-move"');
      expect(fig).toContain('class="wiki-anim-route"');
      expect(fig).toContain('class="wiki-anim-payload"');
    }
  });

  it("保留 CDATA 纯文本与混合文本、按真实文本语义提取 <title>、不二次解码实体且兼容首字符 BOM", () => {
    const cdataTextSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><title>XML 原生文本</title><text x="20" y="50" font-size="16" fill="currentColor"><![CDATA[score = q < k && raw]]></text></svg>`;
    const cdataTextHtml = renderToStaticMarkup(
      createElement(WikiDiagram, { id: "cdata-text", svg: cdataTextSvg }),
    );
    expect(cdataTextHtml).toContain("score = q &lt; k &amp;&amp; raw");

    const cdataMixedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><title id="caption-title">混合文本图</title><text x="20" y="50" font-size="16" fill="currentColor">before <![CDATA[a < b]]> after</text></svg>`;
    const cdataMixedHtml = renderToStaticMarkup(
      createElement(WikiDiagram, { id: "cdata-mixed", svg: cdataMixedSvg }),
    );
    expect(cdataMixedHtml).toContain("before a &lt; b after");
    expect(cdataMixedHtml).toContain("<figcaption>混合文本图</figcaption>");

    const cdataScriptLiteralSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><title><![CDATA[Q < K & V]]></title><text x="20" y="50" font-size="16" fill="currentColor"><![CDATA[<script>alert(1)</script>]]> </text><text x="20" y="80" font-size="14" fill="currentColor">&amp;lt;keep&amp;gt;</text></svg>`;
    const cdataTitleHtml = renderToStaticMarkup(
      createElement(WikiDiagram, { id: "cdata-title", svg: cdataScriptLiteralSvg }),
    );
    expect(cdataTitleHtml).toContain("<title>Q &lt; K &amp; V</title>");
    expect(cdataTitleHtml).toContain("<figcaption>Q &lt; K &amp; V</figcaption>");
    expect(cdataTitleHtml).not.toContain("<![CDATA[");
    expect(cdataTitleHtml).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(cdataTitleHtml).not.toContain("<script>");
    expect(cdataTitleHtml).toContain("&amp;lt;keep&amp;gt;");

    expect(captionOf("<!-- <title>COMMENT_ONLY</title> --><svg><title>真实标题</title></svg>")).toBe(
      "真实标题",
    );
    expect(captionOf("<svg><desc><![CDATA[<title>FAKE</title>]]></desc><title>真实标题</title></svg>")).toBe(
      "真实标题",
    );
    expect(captionOf("<svg><title><![CDATA[&lt;literal&gt;]]> &amp;lt;</title></svg>")).toBe(
      "&lt;literal&gt; &lt;",
    );

    const bomSvg = `\uFEFF<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><title>BOM 标题</title><text x="20" y="50" fill="currentColor">BOM_OK</text></svg>`;
    const bomHtml = renderToStaticMarkup(createElement(WikiDiagram, { id: "bom-svg", svg: bomSvg }));
    expect(bomHtml).toContain("BOM_OK");
    expect(bomHtml).toContain("<figcaption>BOM 标题</figcaption>");
  });

  it("滚动宿主在交互与静态分支间双向切换、同宿主替换 SVG 子节点及卸载时，正确断连旧观察器并实时重测", () => {
    interface FakeObserverRecord {
      readonly callback: () => void;
      readonly targets: unknown[];
      disconnected: boolean;
    }
    const records: FakeObserverRecord[] = [];
    const controller = createScrollHintController<ScrollHintHostLike>((callback) => {
      const rec: FakeObserverRecord = { callback, targets: [], disconnected: false };
      records.push(rec);
      return {
        observe(target) {
          rec.targets.push(target);
        },
        disconnect() {
          rec.disconnected = true;
        },
      };
    });

    let notifyCount = 0;
    const unsubscribe = controller.subscribe(() => {
      notifyCount++;
    });

    const stageChild = { tag: "div.wiki-diagram-stage" } as unknown as Element;
    const interactiveHost = {
      clientWidth: 937,
      scrollWidth: 937,
      scrollLeft: 0,
      children: [stageChild],
    };
    controller.ref(interactiveHost);
    expect(controller.hostRef.current).toBe(interactiveHost);
    expect(controller.getSnapshot()).toEqual({ scrollable: false, atEnd: false });
    expect(records).toHaveLength(1);
    expect(records[0]!.targets).toEqual([interactiveHost, stageChild]);
    expect(records[0]!.disconnected).toBe(false);

    // 交互分支 -> 静态分支（live SVG 回退）：先解绑旧宿主再挂新宿主
    const svgChild1 = { tag: "svg#live-v1" } as unknown as Element;
    const staticHost = {
      clientWidth: 1166,
      scrollWidth: 1166,
      scrollLeft: 0,
      children: [svgChild1],
    };
    controller.ref(null);
    expect(records[0]!.disconnected).toBe(true);
    controller.ref(staticHost);
    expect(controller.hostRef.current).toBe(staticHost);
    expect(records).toHaveLength(2);
    expect(records[1]!.targets).toEqual([staticHost, svgChild1]);
    expect(records[1]!.disconnected).toBe(false);

    // 静态新宿主缩窄至 1200px 视口（clientWidth=802, scrollWidth=880, slack=78）：新观察器立即驱动溢出提示
    staticHost.clientWidth = 802;
    staticHost.scrollWidth = 880;
    records[1]!.callback();
    expect(controller.getSnapshot()).toEqual({ scrollable: true, atEnd: false });
    expect(notifyCount).toBe(1);

    // 横滚到右端 -> atEnd=true
    staticHost.scrollLeft = 78;
    controller.measure();
    expect(controller.getSnapshot()).toEqual({ scrollable: true, atEnd: true });

    // 反向从溢出静态宿主切回宽屏交互宿主：切换当下立即断连旧观察器并重测清零，不残留提示
    interactiveHost.clientWidth = 1166;
    interactiveHost.scrollWidth = 880;
    controller.ref(interactiveHost);
    expect(records[1]!.disconnected).toBe(true);
    expect(controller.hostRef.current).toBe(interactiveHost);
    expect(controller.getSnapshot()).toEqual({ scrollable: false, atEnd: false });
    expect(records).toHaveLength(3);

    // 同一静态宿主内替换 SVG 子节点（rebind）：断连旧子节点观察器、观察新子节点并立即更新溢出态
    staticHost.clientWidth = 1000;
    staticHost.scrollWidth = 880;
    staticHost.scrollLeft = 0;
    controller.ref(staticHost);
    expect(controller.getSnapshot()).toEqual({ scrollable: false, atEnd: false });
    const prevObserverIdx = records.length - 1;
    const svgChild2Wide = { tag: "svg#live-v2-wide" } as unknown as Element;
    staticHost.children = [svgChild2Wide];
    staticHost.scrollWidth = 1300;
    controller.rebind();
    expect(records[prevObserverIdx]!.disconnected).toBe(true);
    expect(records.at(-1)!.targets).toEqual([staticHost, svgChild2Wide]);
    expect(controller.getSnapshot()).toEqual({ scrollable: true, atEnd: false });

    // 卸载清空宿主：观察器断连、状态归零
    controller.ref(null);
    expect(records.at(-1)!.disconnected).toBe(true);
    expect(controller.hostRef.current).toBeNull();
    expect(controller.getSnapshot()).toEqual({ scrollable: false, atEnd: false });
    unsubscribe();
  });
});
