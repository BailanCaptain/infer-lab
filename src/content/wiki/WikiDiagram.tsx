import { useMemo } from "react";

/**
 * 渲染正文里的 ```wiki-diagram 围栏。
 *
 * 图的真相源是 `wiki/diagrams/<id>.yaml`（手写 spec），SVG 由 `pnpm wiki:diagrams`
 * 渲染并随同一份知识快照送到这里。内联而不是 `<img>`：内联才吃页面的 CSS 变量，
 * 图跟着暖白底走，不会变成一块和页面无关的贴片。
 *
 * SVG 是我们自己的渲染器从 schema 校验过的 spec 产的，但快照里的字节仍可能被手改过，
 * 所以注入前按白名单重建一遍——只留几何与排版，删掉 script、事件属性和任何外链。
 */

const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "defs",
  "marker",
  "pattern",
  "title",
  // 自由画板那句必填说明：读屏软件能读到，页面上不显示
  "desc",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
]);

const ALLOWED_ATTRS = new Set([
  "viewBox",
  "width",
  "height",
  "role",
  "aria-label",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "text-anchor",
  "dominant-baseline",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "id",
  "class",
  "refX",
  "refY",
  "markerWidth",
  "markerHeight",
  "orient",
  "patternUnits",
  "patternTransform",
]);

/** 只允许指向同一张图内部的 marker / pattern，不允许任何外部引用 */
const INTERNAL_REF = /^url\(#[A-Za-z0-9_-]+\)$/;

function clean(source: Element, target: Element, doc: Document): void {
  for (const attribute of [...source.attributes]) {
    const name = attribute.name;
    if (name === "marker-end" || name === "marker-start") {
      if (INTERNAL_REF.test(attribute.value)) target.setAttribute(name, attribute.value);
      continue;
    }
    // fill 可以是颜色，也可以是同一张图里的斜线填充（figure 版式的「其他权重」那一段）
    if (name === "fill" && attribute.value.startsWith("url(")) {
      if (INTERNAL_REF.test(attribute.value)) target.setAttribute(name, attribute.value);
      continue;
    }
    if (ALLOWED_ATTRS.has(name)) target.setAttribute(name, attribute.value);
  }
  for (const child of [...source.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      target.appendChild(doc.createTextNode(child.nodeValue ?? ""));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as Element;
    if (!ALLOWED_TAGS.has(element.tagName)) continue;
    const copy = doc.createElementNS("http://www.w3.org/2000/svg", element.tagName);
    clean(element, copy, doc);
    target.appendChild(copy);
  }
}

export function sanitizeDiagram(svg: string): string | null {
  if (typeof DOMParser === "undefined") return null;
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsed.documentElement;
  if (parsed.getElementsByTagName("parsererror").length || root.tagName !== "svg") return null;
  const out = document.implementation.createDocument("http://www.w3.org/2000/svg", "svg", null);
  clean(root, out.documentElement, out);
  out.documentElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(out.documentElement);
}

/** 图说明的真相源是 spec 的 caption，渲染时落在 SVG 的 `<title>` 里，这里取回来显示 */
function captionOf(svg: string): string {
  return /<title>([\s\S]*?)<\/title>/.exec(svg)?.[1]?.trim() ?? "";
}

export function WikiDiagram({ id, svg }: { id: string; svg: string | undefined }) {
  const safe = useMemo(() => (svg ? sanitizeDiagram(svg) : null), [svg]);
  const caption = svg ? captionOf(svg) : "";
  if (!safe) {
    // 图缺了要看得出来，不能静静地少一张图
    return (
      <figure className="wiki-diagram wiki-diagram-failed" data-diagram={id}>
        <figcaption>这张图（{id}）没能渲染。</figcaption>
      </figure>
    );
  }
  return (
    <figure className="wiki-diagram" data-diagram={id} data-status="ok">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizeDiagram 按白名单重建，只留几何与排版 */}
      <div className="wiki-diagram-svg" dangerouslySetInnerHTML={{ __html: safe }} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
