/**
 * 知识页正文的 markdown 管线。阅读页只从这里取插件，单测也按这一份渲染，
 * 测到的就是读者看到的。
 */
import type { Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { remarkHeadingIds } from "./anchors";
import { remarkEvidenceMarks } from "./evidenceMarks";
import { inlineRawSourceHref } from "./schema";

export type MarkdownLinkAstNode = {
  type: string;
  url?: string;
  identifier?: string;
  children?: MarkdownLinkAstNode[];
};

/**
 * CommonMark §4.7 / mdast-util-definitions：同名引用标识以文档中第一条 definition 为准。
 * remark-parse 已完成 CommonMark 空白折叠与 Unicode case-folding，统一按大写键首条落表。
 */
export function collectFirstMarkdownDefinitions(root: MarkdownLinkAstNode): Map<string, MarkdownLinkAstNode> {
  const definitions = new Map<string, MarkdownLinkAstNode>();
  const walk = (node: MarkdownLinkAstNode) => {
    if (node.type === "definition" && typeof node.identifier === "string" && typeof node.url === "string") {
      const key = node.identifier.toUpperCase();
      if (key && !definitions.has(key)) definitions.set(key, node);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  return definitions;
}

export function collectResolvedMarkdownLinkUrls(root: MarkdownLinkAstNode): string[] {
  const definitions = collectFirstMarkdownDefinitions(root);
  const urls: string[] = [];
  const walk = (node: MarkdownLinkAstNode) => {
    if (node.type === "link" && typeof node.url === "string") {
      urls.push(node.url);
    } else if (node.type === "linkReference" && typeof node.identifier === "string") {
      const def = definitions.get(node.identifier.toUpperCase());
      if (def && typeof def.url === "string") urls.push(def.url);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  return urls;
}

/**
 * ReactMarkdown 的默认 urlTransform 只放行常见网络协议与相对路径，会把 `raw:sha256-...` 清空成 `""`。
 * 在共享 remark 管线里预先按白名单校验并改写成静态相对路径 `./wiki-raw/...`；
 * 非法 `raw:` 或被首条定义遮蔽的后续重复 `raw:` 定义直接置空，其它协议原样交给 ReactMarkdown 默认安全过滤。
 */
export function remarkRewriteRawLinks() {
  return (root: MarkdownLinkAstNode) => {
    const firstDefs = new Set(collectFirstMarkdownDefinitions(root).values());
    const walk = (node: MarkdownLinkAstNode) => {
      if (
        node.type === "link" &&
        typeof node.url === "string" &&
        (node.url.startsWith("raw:") || node.url.startsWith("../raw/"))
      ) {
        node.url = inlineRawSourceHref(node.url) ?? "";
      } else if (
        node.type === "definition" &&
        typeof node.url === "string" &&
        (node.url.startsWith("raw:") || node.url.startsWith("../raw/"))
      ) {
        node.url = firstDefs.has(node) ? (inlineRawSourceHref(node.url) ?? "") : "";
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(root);
  };
}

export const WIKI_REMARK_SYNTAX_PLUGINS: NonNullable<Options["remarkPlugins"]> = [
  remarkGfm,
  remarkMath,
  remarkCjkFriendly,
];

/** 标题 id 排在证据角标之前：`## 标题 [C3]` 的锚点按作者写下的文字算，和 GitHub 一致 */
export const WIKI_REMARK_PLUGINS: Options["remarkPlugins"] = [
  ...WIKI_REMARK_SYNTAX_PLUGINS,
  remarkHeadingIds,
  remarkEvidenceMarks,
  remarkRewriteRawLinks,
];

const SEPARATORS = "/_-.";

/**
 * 行内代码里可以断行的位置：`/`、`_`、`-`、`.` 之后。
 * 连写的分隔符（`--flag`、`__init__`）不断，两边都是数字的（`0.85`、`2026-09-27`）不断。
 *
 * 以前表格单元格用 `overflow-wrap: anywhere`，它把每个字符都算成断点，
 * 表格按最小内容宽度分列时 `--tensor-parallel-size` 会从单词中间断开。
 */
export function codeBreakPoints(text: string): number[] {
  const out: number[] = [];
  for (let i = 1; i < text.length - 1; i++) {
    const c = text[i] ?? "";
    const prev = text[i - 1] ?? "";
    const next = text[i + 1] ?? "";
    if (!SEPARATORS.includes(c) || SEPARATORS.includes(prev) || SEPARATORS.includes(next)) continue;
    if (/\d/.test(prev) && /\d/.test(next)) continue;
    out.push(i + 1);
  }
  return out;
}

export type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const WBR: HastNode = { type: "element", tagName: "wbr", properties: {}, children: [] };

/**
 * 浏览器自己也会在一串分隔符末尾的 `-`、`/` 后面断行：`--quantization` 断成 `--` 和
 * `quantization`，`https://` 断在 `//` 后面。codeBreakPoints 不在这些位置断，所以含这种
 * 连写的一段整段不断（.wiki-nobr）。其余的段不包：包了 nowrap，超长的哈希在手机上就没法兜底断开。
 */
const BROWSER_ONLY_BREAK = /[/_.-][-/][^/_.-]/;

function segment(text: string): HastNode {
  if (!BROWSER_ONLY_BREAK.test(text)) return { type: "text", value: text };
  return span("wiki-nobr", [{ type: "text", value: text }]);
}

/**
 * 不超过这么多个字符的行内代码连同其中的空格整段不断行（`8 - 2 = 6`、`--data-parallel-size-local 1`）。
 * 断开只会碎成「8 -」「2 = 6」、参数名一行取值一行这种两截，放得下就不该断。
 */
const CODE_WHOLE_MAX = 30;

/**
 * 单个标识符（中间没有空白）不超过这么多个字符就整个不断（`vllm-ascend@db701c1f`、
 * `num_speculative_tokens`）：40 个等宽字符在正文里约 310px，手机的正文栏也放得下，
 * 放得下的名字从中间断开只会让人读错。更长的（带行号的源码位置）才在 codeBreakPoints 处插 <wbr>，
 * 包一层 .wiki-code-long，由 wiki.css 决定它在一行放得下时也不断。
 *
 * 以前是「不短于 20 个字符就插 <wbr>」，`vllm-` 与 `ascend@db701c1f` 常被拆在两行。
 */
const WORD_WHOLE_MAX = 40;

const charCount = (text: string) => [...text].length;

function span(className: string, children: HastNode[]): HastNode {
  return { type: "element", tagName: "span", properties: { className: [className] }, children };
}

/** 长代码里的标识符：浏览器会在 `-`、`/` 后面自己断，带这两个字符的整段包 nowrap */
function wholeWord(word: string): HastNode {
  if (!/[-/]/.test(word)) return { type: "text", value: word };
  return span("wiki-nobr", [{ type: "text", value: word }]);
}

/** 超长标识符：只在 codeBreakPoints 处插 <wbr> */
function longWord(word: string): HastNode {
  const cuts = [0, ...codeBreakPoints(word), word.length];
  const kids: HastNode[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    if (i > 0) kids.push({ ...WBR });
    kids.push(segment(word.slice(cuts[i], cuts[i + 1])));
  }
  return span("wiki-code-long", kids);
}

function withBreaks(node: HastNode): HastNode[] {
  if (node.type !== "text" || !node.value) return [node];
  const out: HastNode[] = [];
  const push = (n: HastNode) => {
    const last = out[out.length - 1];
    if (n.type === "text" && last?.type === "text") last.value = `${last.value ?? ""}${n.value ?? ""}`;
    else out.push(n);
  };
  // 空白照常可断，逐词处理
  for (const word of node.value.split(/(\s+)/)) {
    if (!word) continue;
    if (/^\s+$/.test(word)) push({ type: "text", value: word });
    else push(charCount(word) <= WORD_WHOLE_MAX ? wholeWord(word) : longWord(word));
  }
  return out;
}

export function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

function addClass(node: HastNode, name: string): void {
  const props = node.properties ?? {};
  const cls = Array.isArray(props.className) ? props.className : [];
  node.properties = { ...props, className: [...cls, name] };
}

/** 行内代码：短的、单个不太长的标识符整段不断（加 .wiki-nobr，文字原样），其余逐词按上面的规则处理 */
function breakInlineCode(code: HastNode): void {
  const text = textOf(code);
  const n = charCount(text);
  if (n <= CODE_WHOLE_MAX || (n <= WORD_WHOLE_MAX && !/\s/.test(text))) {
    addClass(code, "wiki-nobr");
    return;
  }
  code.children = (code.children ?? []).flatMap(withBreaks);
}

/**
 * 正文里的专名：字母数字之间夹 `-`、`.`、`_` 的连写，如 `GLM-5.3-Flash`、`vllm-ascend`。
 * 浏览器默认在连字符后断行，读者会看到「认识 GLM-」换行「5.3-Flash」。
 *
 * 只挡短的：太长的标识符（配置键名那种）包上 nowrap 之后，窄栏里会整个顶出屏幕。
 */
const PROPER_NOUN = /[A-Za-z0-9]+(?:[-._][A-Za-z0-9]+)+/g;
const PROPER_NOUN_MAX = 20;

function withNounGuards(node: HastNode): HastNode[] {
  if (node.type !== "text" || !node.value) return [node];
  const value = node.value;
  const out: HastNode[] = [];
  let last = 0;
  PROPER_NOUN.lastIndex = 0;
  let m = PROPER_NOUN.exec(value);
  while (m) {
    const word = m[0];
    if (word.length <= PROPER_NOUN_MAX) {
      if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
      out.push({
        type: "element",
        tagName: "span",
        properties: { className: ["wiki-nobr"] },
        children: [{ type: "text", value: word }],
      });
      last = m.index + word.length;
    }
    m = PROPER_NOUN.exec(value);
  }
  if (out.length === 0) return [node];
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function hasClass(node: HastNode, name: string): boolean {
  const cls = node.properties?.className;
  return Array.isArray(cls) && cls.includes(name);
}

function isKatexSubtree(node: HastNode): boolean {
  return node.tagName === "math" || hasClass(node, "katex") || hasClass(node, "katex-display");
}

/** 这些元素里的文字不动：代码自有 withBreaks 的规则，公式、脚本等不需要 */
const SKIP_NOUN_GUARD = new Set(["pre", "code", "script", "style", "math"]);

/**
 * 行内代码只在 codeBreakPoints 处断行（插 `<wbr>`，复制出来的文字不变），短的整段不断；
 * 正文里的专名整体不断。代码块（pre 里的）与 KaTeX 公式子树两者都不动。
 */
export function rehypeCodeBreaks() {
  const walk = (node: HastNode) => {
    if (node.type === "element" && (SKIP_NOUN_GUARD.has(node.tagName ?? "") || isKatexSubtree(node))) {
      if (node.tagName === "code") breakInlineCode(node);
      return;
    }
    const kids = node.children ?? [];
    for (const child of kids) walk(child);
    if (kids.some((c) => c.type === "text")) node.children = kids.flatMap(withNounGuards);
  };
  return walk;
}

/**
 * 东亚宽字符：谚文字母、CJK 标点与部首、假名、汉字（含扩展 A 与兼容区）、彝文、谚文音节、竖排与全角形式，
 * 以及汉字扩展 B 起的增补平面。正文里占一个汉字宽，等宽排版里占两个半角格。
 * 码位写在字符串里：写成正则字面量时 biome 会把 \u 转义换成字符本身，其中有看不见的谚文填充符。
 */
const WIDE_CHAR = new RegExp(
  "[\\u1100-\\u115f\\u2e80-\\u303e\\u3041-\\u33ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\ua000-\\ua4cf" +
    "\\uac00-\\ud7a3\\uf900-\\ufaff\\ufe30-\\ufe4f\\uff00-\\uff60\\uffe0-\\uffe6\\u{20000}-\\u{3fffd}]",
  "u",
);

/** 排出来有几个汉字宽：宽字符算 1，其余（拉丁字母、数字、空格、半角标点）算半个 */
function hanWidth(text: string): number {
  return [...text].reduce((w, c) => w + (WIDE_CHAR.test(c) ? 1 : 0.5), 0);
}

/**
 * 表格首列多是行标签（「router 打分」「Q、K、V 投影」）。表按内容分列宽时，首列常被后面的长句
 * 挤到最小宽度，短标签断成「router 打 / 分」。首列里排得下这么多个汉字宽的格子标 is-label，
 * 由 wiki.css 让它整格不折行；更长的首列格在那里给一个最小宽度，两三行排完，不被挤成一字一行。
 *
 * 按宽度而不是字数算：「总 attention 头数不能被 TP 整除」有 23 个字符，排出来只有 15.5 个汉字宽，
 * 以前按「不超过 16 个字」算它不是标签，被拆成「……TP」「整除」两行。18 个汉字宽在表格字号下约 234px，
 * 不到正文栏的四分之一，给别的列留足了位置。
 */
const LABEL_MAX_WIDTH = 18;

function elementsOf(node: HastNode, tags: string[]): HastNode[] {
  return (node.children ?? []).filter((c) => c.type === "element" && tags.includes(c.tagName ?? ""));
}

export function rehypeTableLabels() {
  const walk = (node: HastNode) => {
    if (node.type === "element" && node.tagName === "table") {
      for (const row of elementsOf(node, ["tbody"]).flatMap((b) => elementsOf(b, ["tr"]))) {
        const [first] = elementsOf(row, ["td", "th"]);
        if (first?.tagName === "td" && hanWidth(textOf(first).trim()) <= LABEL_MAX_WIDTH)
          addClass(first, "is-label");
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  return walk;
}

/** 不标语言或标 text 的代码块里的 code 元素；别的代码块（带语言的、图、算式）返回 null */
export function plainFenceCode(pre: HastNode | undefined): HastNode | null {
  const code = pre?.children?.[0];
  if (code?.type !== "element" || code.tagName !== "code") return null;
  const cls = code.properties?.className;
  return Array.isArray(cls) && !cls.includes("language-text") ? null : code;
}

/** 要进字格的字符：可见 ASCII、空白和零宽的格式字符以外的一个字符，连同跟在它后面的组合符号 */
const GRID_CHAR = /[^\x20-\x7e\t\r\n\p{Cf}]\p{M}*/gu;

function gridCells(text: string): HastNode[] {
  const out: HastNode[] = [];
  let last = 0;
  for (const m of text.matchAll(GRID_CHAR)) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({
      type: "element",
      tagName: "span",
      properties: { className: WIDE_CHAR.test(m[0]) ? ["wiki-cell", "is-wide"] : ["wiki-cell"] },
      children: [{ type: "text", value: m[0] }],
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/**
 * 纯文本块（```text 或不标语言）多是作者用空格对齐的「形状块」：张量快照、逐层清单。作者按终端的规矩排，
 * 汉字和全角符号占两个半角格，其余字符占一格。可等宽字体栈里没有中英文等宽的字体：汉字回退到思源黑体，
 * 一个字 1em 宽，不到两个半角字（JetBrains Mono 是 1.2em）；→ 不在 JetBrains Mono 的子集里，回退到别的
 * 字体又是另一种宽度。同一列的字因此上下错开。
 *
 * 这里把每个非 ASCII 字符包成一个字格（.wiki-cell，宽字符再加 is-wide），格宽由 wiki.css 按 1ch、2ch 定，
 * 字在格里居中，和终端的排法一样：不管哪个字体画出来都落在作者排的那一列，汉字之间均匀多出 0.2em。
 * 试过把连着的汉字并成一格、字挨着排：词读着自然，可多出的空全堆在词尾，「展开为」后面空出将近两个字，
 * 看着像排错了。ASCII 原样；复制出来的文字不变。
 */
export function rehypeTextGrid() {
  const walk = (node: HastNode) => {
    if (node.type === "element" && isKatexSubtree(node)) return;
    if (node.type === "element" && node.tagName === "pre") {
      const code = plainFenceCode(node);
      if (code)
        code.children = (code.children ?? []).flatMap((c) =>
          c.type === "text" ? gridCells(c.value ?? "") : [c],
        );
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  return walk;
}

/**
 * 页末「## 对照源码」承载源码路径、行号与版本核验细节：默认折叠让初学者顺畅读完教学主干，
 * 同时完整保留原 DOM 子树与标题 id，支持手动展开、#锚点直达自动展开与页内查找命中自动展开。
 */
export function rehypeCollapsibleSourceSection() {
  return (root: HastNode) => {
    const kids = root.children;
    if (!kids?.length) return;
    const idx = kids.findIndex(
      (c) =>
        c.type === "element" &&
        c.tagName === "h2" &&
        (c.properties?.id === "对照源码" || textOf(c).trim() === "对照源码"),
    );
    if (idx < 0) return;
    let end = idx + 1;
    while (end < kids.length && !(kids[end]?.type === "element" && kids[end]?.tagName === "h2")) {
      end++;
    }
    const heading = kids[idx]!;
    const trailing = kids.slice(idx + 1, end);
    const details: HastNode = {
      type: "element",
      tagName: "details",
      properties: {
        className: ["wiki-source-check"],
        "data-testid": "wiki-source-check",
      },
      children: [
        {
          type: "element",
          tagName: "summary",
          properties: { className: ["wiki-source-summary"] },
          children: [heading],
        },
        {
          type: "element",
          tagName: "div",
          properties: { className: ["wiki-source-check-body"] },
          children: trailing,
        },
      ],
    };
    root.children = [...kids.slice(0, idx), details, ...kids.slice(end)];
  };
}

export const WIKI_REHYPE_PLUGINS: Options["rehypePlugins"] = [
  rehypeKatex,
  rehypeCodeBreaks,
  rehypeTableLabels,
  rehypeTextGrid,
  rehypeCollapsibleSourceSection,
];
