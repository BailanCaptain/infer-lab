/**
 * SVG 逐属性正向值语法清洗与标题实体解码（纯 TypeScript，供前端渲染与离线语料门禁共用）。
 */

export const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "defs",
  "marker",
  "pattern",
  "title",
  // 自由画板那句必填说明：读屏软件能读到，页面上不显示
  "desc",
  "image",
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

/** 只允许指向同一张图内部的 marker / pattern，不允许任何外部引用 */
const INTERNAL_REF = /^url\(#[A-Za-z0-9_-]+\)$/;
/** 复合拆解剖面图仅允许引用 public/wiki-illustrations/ 下的同源静态插画，严禁外链或路径穿越 */
export const LOCAL_ILLUSTRATION_HREF = /^\.\/wiki-illustrations\/[a-z0-9-]+\.(?:webp|jpg|png)$/;
const PRESERVE_ASPECT_RATIO = /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const TOKEN_COLOR =
  /^var\(--color-[a-z0-9-]+(?:\s*,\s*#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}))?\)$/;
const NUM = /^-?\d+(?:\.\d+)?$/;
const NONNEG_NUM = /^\d+(?:\.\d+)?$/;
const OPACITY = /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/;
const VIEWBOX = /^-?\d+(?:\.\d+)?(?:[\s,]+-?\d+(?:\.\d+)?){3}$/;
const DASHARRAY = /^(?:none|\d+(?:\.\d+)?(?:[\s,]+\d+(?:\.\d+)?)*)$/;
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+-]+$/;
const POINTS = /^-?\d+(?:\.\d+)?(?:[\s,]+-?\d+(?:\.\d+)?)+$/;
const TRANSFORM =
  /^(?:translate|scale|rotate|skewX|skewY|matrix)\(\s*-?\d+(?:\.\d+)?(?:[\s,]+-?\d+(?:\.\d+)?)*\s*\)(?:\s+(?:translate|scale|rotate|skewX|skewY|matrix)\(\s*-?\d+(?:\.\d+)?(?:[\s,]+-?\d+(?:\.\d+)?)*\s*\))*$/;
const FONT_FAMILY =
  /^(?:var\(--font-(?:sans|mono|display)\)|(?:'[A-Za-z0-9 _-]+'|[A-Za-z0-9_-]+)(?:\s*,\s*(?:'[A-Za-z0-9 _-]+'|[A-Za-z0-9_-]+))*)$/;
const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const SAFE_CLASS = /^[A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*$/;

function isAllowedPaint(value: string): boolean {
  return (
    value === "none" ||
    value === "currentColor" ||
    HEX_COLOR.test(value) ||
    TOKEN_COLOR.test(value) ||
    INTERNAL_REF.test(value)
  );
}

/**
 * 分镜播放器时间轴（data-ms / data-show / data-hide / data-keys / data-fade）
 * 与硬件语义分组（data-hardware / data-port）正向校验。
 */
const DATA_ATTRS: ReadonlyMap<string, RegExp> = new Map<string, RegExp>([
  ["data-ms", /^\d+(\.\d+)?$/],
  ["data-show", /^\d+(\.\d+)?$/],
  ["data-hide", /^\d+(\.\d+)?$/],
  ["data-keys", /^(\d+(\.\d+)?|-)( (\d+(\.\d+)?|-))*$/],
  ["data-fade", /^\d+(\.\d+)? \d+(\.\d+)?$/],
  ["data-hardware", /^(?:chip|board|server|switch|rack|memory|port)$/],
  ["data-port", /^\d+$/],
]);

const ATTR_GRAMMARS: ReadonlyMap<string, (value: string) => boolean> = new Map<
  string,
  (value: string) => boolean
>([
  ["viewBox", (v) => VIEWBOX.test(v)],
  ["width", (v) => NONNEG_NUM.test(v)],
  ["height", (v) => NONNEG_NUM.test(v)],
  ["role", (v) => v === "img" || v === "presentation" || v === "group"],
  ["x", (v) => NUM.test(v)],
  ["y", (v) => NUM.test(v)],
  ["x1", (v) => NUM.test(v)],
  ["y1", (v) => NUM.test(v)],
  ["x2", (v) => NUM.test(v)],
  ["y2", (v) => NUM.test(v)],
  ["cx", (v) => NUM.test(v)],
  ["cy", (v) => NUM.test(v)],
  ["r", (v) => NONNEG_NUM.test(v)],
  ["rx", (v) => NONNEG_NUM.test(v)],
  ["ry", (v) => NONNEG_NUM.test(v)],
  ["d", (v) => v.length <= 100_000 && PATH_DATA.test(v)],
  ["points", (v) => v.length <= 100_000 && POINTS.test(v)],
  ["transform", (v) => TRANSFORM.test(v)],
  ["patternTransform", (v) => TRANSFORM.test(v)],
  ["fill", isAllowedPaint],
  ["stroke", isAllowedPaint],
  ["fill-opacity", (v) => OPACITY.test(v)],
  ["stroke-opacity", (v) => OPACITY.test(v)],
  ["opacity", (v) => OPACITY.test(v)],
  ["stroke-width", (v) => NONNEG_NUM.test(v)],
  ["stroke-dasharray", (v) => DASHARRAY.test(v)],
  ["stroke-linecap", (v) => v === "butt" || v === "round" || v === "square"],
  ["stroke-linejoin", (v) => v === "miter" || v === "round" || v === "bevel"],
  ["text-anchor", (v) => v === "start" || v === "middle" || v === "end"],
  [
    "dominant-baseline",
    (v) =>
      v === "auto" ||
      v === "middle" ||
      v === "central" ||
      v === "hanging" ||
      v === "alphabetic" ||
      v === "ideographic" ||
      v === "mathematical" ||
      v === "text-before-edge" ||
      v === "text-after-edge",
  ],
  ["font-family", (v) => FONT_FAMILY.test(v)],
  ["font-size", (v) => NONNEG_NUM.test(v)],
  ["font-weight", (v) => v === "normal" || v === "bold" || /^\d{3}$/.test(v)],
  ["font-style", (v) => v === "normal" || v === "italic" || v === "oblique"],
  ["id", (v) => SAFE_ID.test(v)],
  ["class", (v) => SAFE_CLASS.test(v)],
  ["refX", (v) => NUM.test(v)],
  ["refY", (v) => NUM.test(v)],
  ["markerWidth", (v) => NONNEG_NUM.test(v)],
  ["markerHeight", (v) => NONNEG_NUM.test(v)],
  [
    "orient",
    (v) => v === "auto" || v === "auto-start-reverse" || /^-?\d+(?:\.\d+)?(?:deg|rad|grad|turn)?$/.test(v),
  ],
  ["patternUnits", (v) => v === "userSpaceOnUse" || v === "objectBoundingBox"],
  ["marker-start", (v) => INTERNAL_REF.test(v)],
  ["marker-end", (v) => INTERNAL_REF.test(v)],
  ["href", (v) => LOCAL_ILLUSTRATION_HREF.test(v)],
  ["preserveAspectRatio", (v) => PRESERVE_ASPECT_RATIO.test(v)],
]);

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** 这个属性能不能留下：全部走逐属性正向值语法，并拒绝反斜杠 CSS 转义；href / preserveAspectRatio 仅允许在 <image> 上出现 */
export function allowedAttribute(name: string, value: string, tagName?: string): boolean {
  if (hasControlChar(value)) return false;
  if ((name === "href" || name === "preserveAspectRatio") && tagName !== undefined && tagName !== "image") {
    return false;
  }
  if (name === "aria-label") return value.length <= 500;
  if (value.includes("\\")) return false;
  const dataRule = DATA_ATTRS.get(name);
  if (dataRule) return dataRule.test(value);
  if (value.length > 1000 && name !== "d" && name !== "points") return false;
  const grammar = ATTR_GRAMMARS.get(name);
  return grammar ? grammar(value) : false;
}

interface DomAttrLike {
  readonly name: string;
  readonly value: string;
}

interface DomNodeLike {
  readonly nodeType: number;
  readonly nodeValue: string | null;
}

interface DomElementLike extends DomNodeLike {
  readonly tagName: string;
  readonly attributes: ArrayLike<DomAttrLike>;
  readonly childNodes: ArrayLike<DomNodeLike>;
  setAttribute(name: string, value: string): void;
  appendChild(child: DomNodeLike): DomNodeLike;
}

interface DomDocumentLike {
  readonly documentElement: DomElementLike;
  createElementNS(ns: string, tag: string): DomElementLike;
  createTextNode(text: string): DomNodeLike;
  getElementsByTagName(name: string): { readonly length: number };
}

export function encodeScopeToken(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (/[A-Za-z0-9-]/.test(ch)) out += ch;
    else out += `_${raw.charCodeAt(i).toString(36)}_`;
  }
  return out || "0";
}

function rewriteScopedAttribute(name: string, value: string, scopePrefix: string | undefined): string {
  if (!scopePrefix) return value;
  if (name === "id") return `${scopePrefix}-${value}`;
  if (INTERNAL_REF.test(value)) return `url(#${scopePrefix}-${value.slice(5, -1)})`;
  return value;
}

function clean(
  source: DomElementLike,
  target: DomElementLike,
  doc: DomDocumentLike,
  scopePrefix?: string,
): void {
  for (let i = 0; i < source.attributes.length; i++) {
    const attribute = source.attributes[i];
    if (attribute && allowedAttribute(attribute.name, attribute.value, source.tagName)) {
      target.setAttribute(
        attribute.name,
        rewriteScopedAttribute(attribute.name, attribute.value, scopePrefix),
      );
    }
  }
  for (let i = 0; i < source.childNodes.length; i++) {
    const child = source.childNodes[i];
    if (!child) continue;
    // 3 = TEXT_NODE, 4 = CDATA_SECTION_NODE：统一转为纯文本节点，不解析 HTML、不丢弃合法 CDATA
    if (child.nodeType === 3 || child.nodeType === 4) {
      target.appendChild(doc.createTextNode(child.nodeValue ?? ""));
      continue;
    }
    if (child.nodeType !== 1) continue;
    const element = child as DomElementLike;
    if (!ALLOWED_TAGS.has(element.tagName)) continue;
    const copy = doc.createElementNS("http://www.w3.org/2000/svg", element.tagName);
    clean(element, copy, doc, scopePrefix);
    target.appendChild(copy);
  }
}

export function sanitizeDiagram(svg: string, scopePrefix?: string): string | null {
  const g = globalThis as unknown as {
    DOMParser?: new () => { parseFromString(input: string, mime: string): DomDocumentLike };
    document?: { implementation: { createDocument(ns: string, qn: string, dt: null): DomDocumentLike } };
    XMLSerializer?: new () => { serializeToString(el: DomElementLike): string };
  };
  if (!g.DOMParser || !g.document || !g.XMLSerializer) return null;
  const source = svg.startsWith("\uFEFF") ? svg.slice(1) : svg;
  const parsed = new g.DOMParser().parseFromString(source, "image/svg+xml");
  const root = parsed.documentElement;
  if (parsed.getElementsByTagName("parsererror").length || root.tagName !== "svg") return null;
  const out = g.document.implementation.createDocument("http://www.w3.org/2000/svg", "svg", null);
  const normalizedScope =
    scopePrefix !== undefined && scopePrefix.length > 0 ? `wd-${encodeScopeToken(scopePrefix)}` : undefined;
  clean(root, out.documentElement, out, normalizedScope);
  out.documentElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new g.XMLSerializer().serializeToString(out.documentElement);
}

/** 单遍还原 XML 实体，避免 &amp;lt; 被二次反转义成 < */
export function decodeXmlEntities(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|lt|gt|quot|apos|amp);/g,
    (full, dec: string | undefined, hex: string | undefined) => {
      if (dec !== undefined) {
        const code = Number.parseInt(dec, 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
      }
      if (hex !== undefined) {
        const code = Number.parseInt(hex, 16);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
      }
      switch (full) {
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        case "&quot;":
          return '"';
        case "&apos;":
          return "'";
        case "&amp;":
          return "&";
        default:
          return full;
      }
    },
  );
}

function scanOpenTagEnd(src: string, start: number): { end: number; selfClosing: boolean } | null {
  let i = start;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '"' || ch === "'") {
      const close = src.indexOf(ch, i + 1);
      if (close < 0) return null;
      i = close + 1;
      continue;
    }
    if (ch === ">") {
      return { end: i + 1, selfClosing: src[i - 1] === "/" };
    }
    i++;
  }
  return null;
}

function readXmlTagName(src: string, start: number): { name: string; end: number } {
  let i = start;
  while (i < src.length && /[A-Za-z0-9._:-]/.test(src[i]!)) i++;
  return { name: src.slice(start, i), end: i };
}

/** 图说明的真相源是 spec 的 caption，渲染时落在首个真实 SVG `<title>` 里，按 XML 文本语义取回显示 */
export function captionOf(svg: string): string {
  const src = (svg.startsWith("\uFEFF") ? svg.slice(1) : svg).replace(/\r\n?/g, "\n");
  let pos = 0;
  while (pos < src.length) {
    const lt = src.indexOf("<", pos);
    if (lt < 0) return "";
    pos = lt;
    if (src.startsWith("<!--", pos)) {
      const end = src.indexOf("-->", pos + 4);
      if (end < 0) return "";
      pos = end + 3;
      continue;
    }
    if (src.startsWith("<![CDATA[", pos)) {
      const end = src.indexOf("]]>", pos + 9);
      if (end < 0) return "";
      pos = end + 3;
      continue;
    }
    if (src.startsWith("<?", pos)) {
      const end = src.indexOf("?>", pos + 2);
      if (end < 0) return "";
      pos = end + 2;
      continue;
    }
    if (src.startsWith("<!", pos)) {
      const decl = scanOpenTagEnd(src, pos + 2);
      if (!decl) return "";
      pos = decl.end;
      continue;
    }
    if (src.startsWith("</", pos)) {
      const end = src.indexOf(">", pos + 2);
      if (end < 0) return "";
      pos = end + 1;
      continue;
    }
    const { name: tagName, end: nameEnd } = readXmlTagName(src, pos + 1);
    if (!tagName) {
      pos++;
      continue;
    }
    const open = scanOpenTagEnd(src, nameEnd);
    if (!open) return "";
    pos = open.end;
    if (tagName !== "title") continue;
    if (open.selfClosing) return "";

    let out = "";
    let depth = 1;
    while (pos < src.length) {
      const nextLt = src.indexOf("<", pos);
      if (nextLt < 0) return (out + decodeXmlEntities(src.slice(pos))).trim();
      if (nextLt > pos) {
        out += decodeXmlEntities(src.slice(pos, nextLt));
        pos = nextLt;
      }
      if (src.startsWith("<![CDATA[", pos)) {
        const end = src.indexOf("]]>", pos + 9);
        if (end < 0) return "";
        out += src.slice(pos + 9, end);
        pos = end + 3;
        continue;
      }
      if (src.startsWith("<!--", pos)) {
        const end = src.indexOf("-->", pos + 4);
        if (end < 0) return "";
        pos = end + 3;
        continue;
      }
      if (src.startsWith("<?", pos)) {
        const end = src.indexOf("?>", pos + 2);
        if (end < 0) return "";
        pos = end + 2;
        continue;
      }
      if (src.startsWith("</", pos)) {
        const { name: closeName, end: closeNameEnd } = readXmlTagName(src, pos + 2);
        const end = src.indexOf(">", closeNameEnd);
        if (end < 0) return "";
        pos = end + 1;
        if (closeName === "title") {
          depth--;
          if (depth === 0) return out.trim();
        }
        continue;
      }
      const { name: childName, end: childNameEnd } = readXmlTagName(src, pos + 1);
      if (!childName) return "";
      const childOpen = scanOpenTagEnd(src, childNameEnd);
      if (!childOpen) return "";
      if (childName === "title" && !childOpen.selfClosing) depth++;
      pos = childOpen.end;
    }
    return out.trim();
  }
  return "";
}
