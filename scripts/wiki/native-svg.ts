import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_TAGS,
  allowedAttribute,
  LOCAL_ILLUSTRATION_HREF,
} from "../../src/content/wiki/diagram-sanitize";

export interface StrictXmlAttr {
  readonly name: string;
  readonly value: string;
}

export interface StrictXmlElement {
  readonly tagName: string;
  readonly attributes: readonly StrictXmlAttr[];
  readonly children: readonly StrictXmlElement[];
}

const XML_NAME_RE = /^[A-Za-z_:][A-Za-z0-9._:-]*$/;
const INTERNAL_URL_RE = /^url\(#([A-Za-z0-9_-]+)\)$/;
const MAX_XML_DEPTH = 64;

function isXmlSpace(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
}

function isValidXmlCodePoint(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

function hasIllegalXmlChars(raw: string): boolean {
  for (const ch of raw) {
    const code = ch.codePointAt(0)!;
    if (!isValidXmlCodePoint(code)) return true;
  }
  return false;
}

/** 解码单个 XML 1.0 预定义实体或字符引用 token（不含首尾 & 与 ;） */
function decodeStrictXmlEntityToken(
  token: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (token === "lt") return { ok: true, value: "<" };
  if (token === "gt") return { ok: true, value: ">" };
  if (token === "amp") return { ok: true, value: "&" };
  if (token === "apos") return { ok: true, value: "'" };
  if (token === "quot") return { ok: true, value: '"' };
  if (/^#\d+$/.test(token)) {
    const code = Number.parseInt(token.slice(1), 10);
    if (!isValidXmlCodePoint(code)) return { ok: false, error: `非法 XML 数字字符引用 &${token};` };
    return { ok: true, value: String.fromCodePoint(code) };
  }
  if (/^#x[0-9a-fA-F]+$/.test(token)) {
    const code = Number.parseInt(token.slice(2), 16);
    if (!isValidXmlCodePoint(code)) return { ok: false, error: `非法 XML 十六进制字符引用 &${token};` };
    return { ok: true, value: String.fromCodePoint(code) };
  }
  return { ok: false, error: `未转义的 & 或未知 XML 实体 &${token};` };
}

/** 严格解码 XML 1.0 元素正文中的预定义实体与字符引用 */
function decodeStrictXmlEntities(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const amp = raw.indexOf("&", i);
    if (amp < 0) {
      out += raw.slice(i);
      break;
    }
    out += raw.slice(i, amp);
    const semi = raw.indexOf(";", amp + 1);
    if (semi < 0) return { ok: false, error: "XML 含未转义的 &" };
    const decoded = decodeStrictXmlEntityToken(raw.slice(amp + 1, semi));
    if (!decoded.ok) return decoded;
    out += decoded.value;
    i = semi + 1;
  }
  return { ok: true, value: out };
}

/**
 * XML 1.0 §3.3.3 属性值正规化：字面空白（\t/\r/\n）转为空格 0x20，
 * 而字符引用（如 &#10; / &#9;）保留其真实控制字符语义，不折算为空格。
 */
function decodeStrictXmlAttributeValue(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i]!;
    if (ch === "&") {
      const semi = raw.indexOf(";", i + 1);
      if (semi < 0) return { ok: false, error: "XML 属性含未转义的 &" };
      const decoded = decodeStrictXmlEntityToken(raw.slice(i + 1, semi));
      if (!decoded.ok) return decoded;
      out += decoded.value;
      i = semi + 1;
      continue;
    }
    out += ch === "\t" || ch === "\n" || ch === "\r" ? " " : ch;
    i++;
  }
  return { ok: true, value: out };
}

export function parseStrictSvgXml(
  input: string,
): { ok: true; root: StrictXmlElement } | { ok: false; error: string } {
  const withoutBom = input.startsWith("\uFEFF") ? input.slice(1) : input;
  if (!withoutBom.trim()) return { ok: false, error: "SVG 文件为空" };
  if (hasIllegalXmlChars(withoutBom)) return { ok: false, error: "SVG 含非法 XML 控制字符" };
  // XML 1.0 §2.11：输入流先将 \r\n 与孤立 \r 归一为 \n（仅内存解析态，不改磁盘原文件）
  const src = withoutBom.replace(/\r\n?/g, "\n");

  let pos = 0;
  const skipSpace = () => {
    while (pos < src.length && isXmlSpace(src[pos])) pos++;
  };
  const readComment = (): string | null => {
    const close = src.indexOf("-->", pos + 4);
    if (close < 0) return "XML 注释未闭合";
    const body = src.slice(pos + 4, close);
    if (body.includes("--") || body.endsWith("-")) return "XML 注释内部不能出现 --";
    pos = close + 3;
    return null;
  };
  const skipMisc = (): string | null => {
    while (pos < src.length) {
      skipSpace();
      if (src.startsWith("<!--", pos)) {
        const err = readComment();
        if (err) return err;
        continue;
      }
      break;
    }
    return null;
  };

  // XML 1.0 §2.8 [23] XMLDecl ::= '<?xml' VersionInfo EncodingDecl? SDDecl? S? '?>'
  if (src.startsWith("<?xml", 0) && (isXmlSpace(src[5]) || src[5] === "?")) {
    const endDecl = src.indexOf("?>", 5);
    if (endDecl < 0) return { ok: false, error: "XML 声明未闭合" };
    pos = 5;
    const declAttrs: StrictXmlAttr[] = [];
    while (pos < endDecl) {
      const hadSpace = isXmlSpace(src[pos]);
      while (pos < endDecl && isXmlSpace(src[pos])) pos++;
      if (pos === endDecl) break;
      if (!hadSpace) return { ok: false, error: "XML 声明属性之间缺少空白" };
      const nameStart = pos;
      while (pos < endDecl && /[A-Za-z0-9._:-]/.test(src[pos]!)) pos++;
      const name = src.slice(nameStart, pos);
      if (!name) return { ok: false, error: "XML 声明含非法伪属性名" };
      while (pos < endDecl && isXmlSpace(src[pos])) pos++;
      if (src[pos] !== "=") return { ok: false, error: `XML 声明属性 ${name} 缺少 =` };
      pos++;
      while (pos < endDecl && isXmlSpace(src[pos])) pos++;
      const quote = src[pos];
      if (quote !== '"' && quote !== "'") return { ok: false, error: `XML 声明属性 ${name} 必须加引号` };
      pos++;
      const closeQuote = src.indexOf(quote, pos);
      if (closeQuote < 0 || closeQuote > endDecl)
        return { ok: false, error: `XML 声明属性 ${name} 引号未闭合` };
      declAttrs.push({ name, value: src.slice(pos, closeQuote) });
      pos = closeQuote + 1;
    }
    let idx = 0;
    const ver = declAttrs[idx];
    if (ver?.name !== "version" || !/^1\.[0-9]+$/.test(ver.value)) {
      return { ok: false, error: 'XML 声明必须以合法的 version="1.x" 开头' };
    }
    idx++;
    if (declAttrs[idx]?.name === "encoding") {
      if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(declAttrs[idx]!.value)) {
        return { ok: false, error: "XML 声明 encoding 名称不合法" };
      }
      idx++;
    }
    if (declAttrs[idx]?.name === "standalone") {
      if (declAttrs[idx]!.value !== "yes" && declAttrs[idx]!.value !== "no") {
        return { ok: false, error: "XML 声明 standalone 只能为 yes 或 no" };
      }
      idx++;
    }
    if (idx !== declAttrs.length) {
      return { ok: false, error: "XML 声明存在重复、顺序错误或不支持的伪属性" };
    }
    pos = endDecl + 2;
  }
  const preErr = skipMisc();
  if (preErr) return { ok: false, error: preErr };
  if (src.startsWith("<!", pos) || src.startsWith("<?", pos)) {
    return { ok: false, error: "原生 SVG 禁止包含 DOCTYPE、ENTITY 或外部处理指令" };
  }

  const readName = (): string => {
    const start = pos;
    while (pos < src.length && /[A-Za-z0-9._:-]/.test(src[pos]!)) pos++;
    return src.slice(start, pos);
  };

  const parseElement = (depth: number): { ok: true; el: StrictXmlElement } | { ok: false; error: string } => {
    if (depth > MAX_XML_DEPTH) return { ok: false, error: "SVG 嵌套深度超过上限" };
    if (src[pos] !== "<") return { ok: false, error: "期望元素起始 <" };
    pos++;
    const tagName = readName();
    if (!XML_NAME_RE.test(tagName)) return { ok: false, error: `非法 XML 标签名 ${tagName || "(空)"}` };

    const attributes: StrictXmlAttr[] = [];
    const seenAttrs = new Set<string>();
    while (pos < src.length) {
      const hadSpace = isXmlSpace(src[pos]);
      skipSpace();
      if (src.startsWith("/>", pos)) {
        pos += 2;
        return { ok: true, el: { tagName, attributes, children: [] } };
      }
      if (src[pos] === ">") {
        pos++;
        break;
      }
      if (!hadSpace) return { ok: false, error: `<${tagName}> 属性之间缺少空白或标签未正确闭合` };
      const attrName = readName();
      if (!XML_NAME_RE.test(attrName))
        return { ok: false, error: `<${tagName}> 含非法属性名 ${attrName || "(空)"}` };
      if (seenAttrs.has(attrName)) return { ok: false, error: `<${tagName}> 含重复属性 ${attrName}` };
      seenAttrs.add(attrName);
      skipSpace();
      if (src[pos] !== "=") return { ok: false, error: `<${tagName}> 属性 ${attrName} 缺少 =` };
      pos++;
      skipSpace();
      const quote = src[pos];
      if (quote !== '"' && quote !== "'")
        return { ok: false, error: `<${tagName}> 属性 ${attrName} 的值必须加引号` };
      pos++;
      const closeQuote = src.indexOf(quote, pos);
      if (closeQuote < 0) return { ok: false, error: `<${tagName}> 属性 ${attrName} 引号未闭合` };
      const rawVal = src.slice(pos, closeQuote);
      if (rawVal.includes("<"))
        return { ok: false, error: `<${tagName}> 属性 ${attrName} 值中不能包含未转义 <` };
      const decoded = decodeStrictXmlAttributeValue(rawVal);
      if (!decoded.ok) return decoded;
      attributes.push({ name: attrName, value: decoded.value });
      pos = closeQuote + 1;
    }

    const children: StrictXmlElement[] = [];
    while (pos < src.length) {
      if (src.startsWith("<!--", pos)) {
        const err = readComment();
        if (err) return { ok: false, error: err };
        continue;
      }
      if (src.startsWith("<![CDATA[", pos)) {
        const endCdata = src.indexOf("]]>", pos + 9);
        if (endCdata < 0) return { ok: false, error: "CDATA 未闭合" };
        pos = endCdata + 3;
        continue;
      }
      if (src.startsWith("</", pos)) {
        pos += 2;
        const closeName = readName();
        skipSpace();
        if (closeName !== tagName || src[pos] !== ">") {
          return { ok: false, error: `XML 闭合标签 </${closeName}> 与开启标签 <${tagName}> 不匹配` };
        }
        pos++;
        return { ok: true, el: { tagName, attributes, children } };
      }
      if (src.startsWith("<!", pos) || src.startsWith("<?", pos)) {
        return { ok: false, error: "原生 SVG 内部禁止出现声明或处理指令" };
      }
      if (src[pos] === "<") {
        const child = parseElement(depth + 1);
        if (!child.ok) return child;
        children.push(child.el);
        continue;
      }
      const nextLt = src.indexOf("<", pos);
      const rawText = nextLt < 0 ? src.slice(pos) : src.slice(pos, nextLt);
      if (rawText.includes("]]>")) return { ok: false, error: "XML 文本中不能包含 ]]>" };
      const decodedText = decodeStrictXmlEntities(rawText);
      if (!decodedText.ok) return decodedText;
      pos = nextLt < 0 ? src.length : nextLt;
    }
    return { ok: false, error: `XML 标签 <${tagName}> 未闭合` };
  };

  const rootRes = parseElement(0);
  if (!rootRes.ok) return rootRes;
  const postErr = skipMisc();
  if (postErr) return { ok: false, error: postErr };
  if (pos !== src.length) return { ok: false, error: "根元素 </svg> 之后存在多余内容" };
  return { ok: true, root: rootRes.el };
}

const SIGNED_PX_ATTRS = new Set(["x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "refX", "refY"]);
const NONNEG_PX_ATTRS = new Set([
  "font-size",
  "width",
  "height",
  "r",
  "rx",
  "ry",
  "stroke-width",
  "markerWidth",
  "markerHeight",
]);
const NAMED_PAINT_MAP: Record<string, string> = {
  white: "#ffffff",
  black: "#17211f",
  transparent: "none",
};

function normalizeAttrValue(name: string, rawValue: string): string {
  const trimmed = rawValue.trim();
  if (NONNEG_PX_ATTRS.has(name)) {
    const m = /^(\d+(?:\.\d+)?)\s*px$/i.exec(trimmed);
    if (m) return m[1]!;
    return rawValue;
  }
  if (SIGNED_PX_ATTRS.has(name)) {
    const m = /^(-?\d+(?:\.\d+)?)\s*px$/i.exec(trimmed);
    if (m) return m[1]!;
    return rawValue;
  }
  if (name === "fill" || name === "stroke") {
    const mapped = NAMED_PAINT_MAP[trimmed.toLowerCase()];
    if (mapped) return mapped;
    return rawValue;
  }
  if (name === "font-family") {
    // Already valid as-is: keep exact bytes untouched.
    if (allowedAttribute("font-family", rawValue)) return rawValue;
    const unquoted = trimmed.replace(/&quot;/g, "'").replace(/"/g, "'");
    const parts = unquoted
      .split(",")
      .map((part) => {
        const p = part.trim();
        if (/^'[A-Za-z0-9 _-]+'$/.test(p) || /^[A-Za-z0-9_-]+$/.test(p) || /^var\(--font-/.test(p)) {
          return p;
        }
        if (/^[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)+$/.test(p)) {
          return `'${p}'`;
        }
        return p;
      })
      .join(", ");
    return allowedAttribute("font-family", parts) ? parts : unquoted;
  }
  return rawValue;
}

/**
 * 面向开源/纯文本模型的安全 SVG 属性预规范化器（严格在开启标签属性值边界内工作，绝不改动注释、CDATA、文本或已合法字节）：
 * - 去掉数值属性末尾的 `px` 单位（`font-size="14px"` -> `font-size="14"`、`width`/`height`/`rx`/`stroke-width` 等）
 * - 常用命名色映射为暖矿物语义值（`white`->`#ffffff`、`black`->`#17211f`、`transparent`->`none`）
 * - 将 `font-family` 中的双引号 / `&quot;` 或无引号多词字体名规范为单引号
 * 任何真正的非法标签/脚本/事件/外链/`<style>`/`rgba()` 均原样保留交由严格 `validateNativeSvg` 拦截。
 */
export function normalizeNativeSvg(rawSvg: string): string {
  let out = "";
  let pos = 0;
  const len = rawSvg.length;
  while (pos < len) {
    const lt = rawSvg.indexOf("<", pos);
    if (lt < 0) {
      out += rawSvg.slice(pos);
      break;
    }
    out += rawSvg.slice(pos, lt);
    pos = lt;
    if (rawSvg.startsWith("<!--", pos)) {
      const end = rawSvg.indexOf("-->", pos + 4);
      if (end < 0) {
        out += rawSvg.slice(pos);
        break;
      }
      out += rawSvg.slice(pos, end + 3);
      pos = end + 3;
      continue;
    }
    if (rawSvg.startsWith("<![CDATA[", pos)) {
      const end = rawSvg.indexOf("]]>", pos + 9);
      if (end < 0) {
        out += rawSvg.slice(pos);
        break;
      }
      out += rawSvg.slice(pos, end + 3);
      pos = end + 3;
      continue;
    }
    if (rawSvg.startsWith("<?", pos)) {
      const end = rawSvg.indexOf("?>", pos + 2);
      if (end < 0) {
        out += rawSvg.slice(pos);
        break;
      }
      out += rawSvg.slice(pos, end + 2);
      pos = end + 2;
      continue;
    }
    if (rawSvg.startsWith("</", pos) || rawSvg.startsWith("<!", pos)) {
      const end = rawSvg.indexOf(">", pos + 2);
      if (end < 0) {
        out += rawSvg.slice(pos);
        break;
      }
      out += rawSvg.slice(pos, end + 1);
      pos = end + 1;
      continue;
    }

    // Parse opening tag header + attributes without touching well-formed spacing/quotes.
    let i = pos + 1;
    while (i < len && /[A-Za-z0-9._:-]/.test(rawSvg[i]!)) i++;
    if (i === pos + 1) {
      out += "<";
      pos++;
      continue;
    }
    let tagOut = rawSvg.slice(pos, i);
    let aborted = false;
    while (i < len) {
      const wsStart = i;
      while (i < len && isXmlSpace(rawSvg[i])) i++;
      const ws = rawSvg.slice(wsStart, i);
      if (rawSvg.startsWith("/>", i)) {
        tagOut += `${ws}/>`;
        i += 2;
        break;
      }
      if (rawSvg[i] === ">") {
        tagOut += `${ws}>`;
        i++;
        break;
      }
      const nameStart = i;
      while (i < len && /[A-Za-z0-9._:-]/.test(rawSvg[i]!)) i++;
      if (i === nameStart) {
        aborted = true;
        break;
      }
      const attrName = rawSvg.slice(nameStart, i);
      const eqStart = i;
      while (i < len && isXmlSpace(rawSvg[i])) i++;
      if (rawSvg[i] !== "=") {
        aborted = true;
        break;
      }
      i++;
      while (i < len && isXmlSpace(rawSvg[i])) i++;
      const quote = rawSvg[i];
      if (quote !== '"' && quote !== "'") {
        aborted = true;
        break;
      }
      const eqPrefix = rawSvg.slice(eqStart, i);
      const valStart = i + 1;
      const closeQuote = rawSvg.indexOf(quote, valStart);
      if (closeQuote < 0) {
        aborted = true;
        break;
      }
      const rawVal = rawSvg.slice(valStart, closeQuote);
      const nextVal = normalizeAttrValue(attrName, rawVal);
      // If a single-quoted font-family now contains single quotes, switch outer delimiter to double quotes.
      const outQuote = quote === "'" && nextVal.includes("'") && !nextVal.includes('"') ? '"' : quote;
      tagOut += `${ws}${attrName}${eqPrefix}${outQuote}${nextVal}${outQuote}`;
      i = closeQuote + 1;
    }
    if (aborted) {
      out += rawSvg.slice(pos);
      break;
    }
    out += tagOut;
    pos = i;
  }
  return out;
}

export interface ValidateNativeSvgOptions {
  /** 指定静态资源目录（一般为 `<root>/public`）时，前置核验 `<image href="./wiki-illustrations/...">` 磁盘存在性 */
  publicRoot?: string;
}

export function validateNativeSvg(
  rawSvg: string,
  expectedSize: readonly [number, number],
  options: ValidateNativeSvgOptions = {},
): string[] {
  const parsed = parseStrictSvgXml(rawSvg);
  if (!parsed.ok) return [parsed.error];
  const root = parsed.root;
  if (root.tagName !== "svg") return [`根元素必须是 <svg>，实际为 <${root.tagName}>`];

  const issues: string[] = [];
  const getAttr = (el: StrictXmlElement, name: string) => el.attributes.find((a) => a.name === name)?.value;
  const xmlns = getAttr(root, "xmlns");
  if (xmlns !== "http://www.w3.org/2000/svg") {
    issues.push('根 <svg> 必须声明 xmlns="http://www.w3.org/2000/svg"');
  }

  const [expW, expH] = expectedSize;
  if (!(expW > 0 && expH > 0 && expW <= 900)) {
    issues.push(`原生 SVG 画布尺寸 ${expW}×${expH} 不合法（必须为正数且宽度 ≤ 900）`);
  }
  const viewBox = getAttr(root, "viewBox");
  const widthAttr = getAttr(root, "width");
  const heightAttr = getAttr(root, "height");
  if (!viewBox || !allowedAttribute("viewBox", viewBox)) {
    issues.push("根 <svg> 缺少合法 viewBox");
  } else {
    const nums = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n)) || nums[2] !== expW || nums[3] !== expH) {
      issues.push(`根 <svg> viewBox（${viewBox}）宽高必须与伴生 YAML size（${expW}×${expH}）一致`);
    }
  }
  if (
    !widthAttr ||
    !heightAttr ||
    !allowedAttribute("width", widthAttr) ||
    !allowedAttribute("height", heightAttr) ||
    Number(widthAttr) !== expW ||
    Number(heightAttr) !== expH
  ) {
    issues.push(
      `根 <svg> width/height（${widthAttr ?? "缺失"}×${heightAttr ?? "缺失"}）必须与 size（${expW}×${expH}）一致`,
    );
  }

  const definedIds = new Set<string>();
  const referencedIds: string[] = [];
  const walk = (el: StrictXmlElement, isRoot: boolean) => {
    if (!ALLOWED_TAGS.has(el.tagName)) {
      issues.push(`不允许的 SVG 标签 <${el.tagName}>`);
      return;
    }
    for (const attr of el.attributes) {
      if (isRoot && attr.name === "xmlns") continue;
      if (!allowedAttribute(attr.name, attr.value, el.tagName)) {
        issues.push(`不允许的 SVG 属性或值 <${el.tagName} ${attr.name}>`);
        continue;
      }
      if (
        el.tagName === "image" &&
        attr.name === "href" &&
        options.publicRoot &&
        LOCAL_ILLUSTRATION_HREF.test(attr.value)
      ) {
        const diskPath = join(options.publicRoot, attr.value.slice(2));
        if (!existsSync(diskPath)) {
          issues.push(
            `引用的静态插画 public/${attr.value.slice(2)} 在磁盘上不存在；自动化 Drop / 纯文本模型严禁虚构 ./wiki-illustrations/ 位图路径，请改用纯矢量 native-svg（等距/分层几何路径 + 暖矿物配色）或 layout: figure 绘制`,
          );
        }
      }
      if (attr.name === "id") {
        if (definedIds.has(attr.value)) issues.push(`SVG 内部存在重复 id="${attr.value}"`);
        definedIds.add(attr.value);
      }
      const refMatch = INTERNAL_URL_RE.exec(attr.value);
      if (refMatch) referencedIds.push(refMatch[1]!);
    }
    for (const child of el.children) walk(child, false);
  };
  walk(root, true);

  for (const refId of referencedIds) {
    if (!definedIds.has(refId)) {
      issues.push(`SVG 内部引用 url(#${refId}) 未找到对应定义`);
    }
  }
  return issues;
}
