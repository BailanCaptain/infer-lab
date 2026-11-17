/**
 * 确定性 AST 迁移只读计划器（阶段一工程交付：默认只读分析与确定性偏移拟议，不改写任何正式 Markdown）。
 *
 * - 解析器复用 `remark-parse` 与 `WIKI_REMARK_PLUGINS`（在剥离 position 前读取原始 MDAST 偏移）；
 * - 严格保护 frontmatter（含 sources 顺序、verified、id、aliases）、BOM、CRLF/LF、自动生成 H2（精确至下一真实 H2）、
 *   代码围栏/行内代码、数学公式、HTML、既有链接与标题锚点、以及 `wiki-scene` 冻结块；
 * - 纯文本 `来源 N` 仅在 `## 对照源码` 与 `type: param` 的 `## 事实表` 数据单元格内结合 `classifySource` 生成拟议角标，
 *   精确消歧源码行号区间（如 `来源 13，262–274 行` vs 歧义 `来源4，303–345`），教学叙述区绝不新增机器角标；
 * - 版本补丁段默认仅做 AST 盘点与目标节定位（留二阶段人工审阅），仅在显式无歧义选中单段时生成逐字节保留的搬移拟议。
 */
import { createHash, randomBytes } from "node:crypto";
import {
  type Dirent,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { EVIDENCE_MARK_RE } from "../../src/content/wiki/evidenceMarks";
import { WIKI_REMARK_PLUGINS } from "../../src/content/wiki/markdown";
import { PARAM_SECTION } from "../../src/content/wiki/param-display";
import type { PageType } from "../../src/content/wiki/schema";
import { LINEAGE_SECTION } from "./lineage";
import { PAGE_DIRS, parsePage } from "./pages";
import { classifySource, type SourceKind, supportsOfficialEvidence } from "./sources";
import { loadStandardConfig } from "./standard";

export interface VersionParagraphMoveSelection {
  file: string;
  startOffset?: number;
  endOffset?: number;
  blockSha256?: string;
  prefix?: string;
  destinationHeading?: string;
}

export interface ProposedAstEdit {
  kind: "source-reference-mark" | "version-paragraph-delete" | "version-paragraph-insert";
  file: string;
  lineStart: number;
  lineEnd: number;
  startOffset: number;
  endOffset: number;
  beforeText: string;
  afterText: string;
  reason: string;
  sourceOrdinals?: number[];
  marksAdded?: string[];
}

export interface ManualAstItem {
  kind:
    | "narrative-source-reference"
    | "ambiguous-code-line-context"
    | "invalid-source-ordinal"
    | "non-citable-or-raw-source-kind"
    | "version-paragraph-phase-two"
    | "ambiguous-paragraph-selection"
    | "missing-move-destination";
  file: string;
  section: string | null;
  lineStart: number;
  lineEnd: number;
  startOffset: number;
  endOffset: number;
  excerpt: string;
  reason: string;
  sourceOrdinals?: number[];
}

export interface VersionParagraphInventoryItem {
  file: string;
  section: string | null;
  lineStart: number;
  lineEnd: number;
  startOffset: number;
  endOffset: number;
  blockSha256: string;
  leadStrongText: string;
  alreadyInSourceCheck: boolean;
  destination: {
    exists: boolean;
    heading: string | null;
    insertOffset: number | null;
    line: number | null;
  };
  selectedForMove: boolean;
  disposition: "already-in-source-check" | "proposed-move" | "manual-phase-two" | "manual-blocked";
  reason: string;
}

export interface PageAstMigrationPlan {
  file: string;
  id: string;
  type: PageType;
  inputByteSha256: string;
  inputUtf16Length: number;
  hasBom: boolean;
  lineEnding: "LF" | "CRLF" | "MIXED";
  protectedSections: {
    heading: string;
    startOffset: number;
    endOffset: number;
    lineStart: number;
    lineEnd: number;
  }[];
  proposedEdits: ProposedAstEdit[];
  proposedDiff: string;
  previewOutputByteSha256: string;
  manualItems: ManualAstItem[];
  versionParagraphs: VersionParagraphInventoryItem[];
  stats: {
    protectedReferenceSkips: number;
    alreadyMarkedReferenceSkips: number;
    proposedSourceReferenceEdits: number;
    proposedParagraphMoves: number;
    manualCount: number;
  };
}

export interface AstMigrationPlanReport {
  schemaVersion: 1;
  mode: "dry-run-plan";
  wikiRoot: string;
  pageCount: number;
  summary: {
    pagesWithProposedEdits: number;
    totalProposedEdits: number;
    proposedSourceReferenceEdits: number;
    proposedParagraphMoves: number;
    pagesWithVersionParagraphs: number;
    totalVersionParagraphsOutsideSourceCheck: number;
    totalManualItems: number;
    protectedReferenceSkips: number;
    alreadyMarkedReferenceSkips: number;
  };
  pages: PageAstMigrationPlan[];
}

type MdastPoint = { line: number; column: number; offset?: number };
type MdastNode = {
  type: string;
  depth?: number;
  value?: string;
  url?: string;
  children?: MdastNode[];
  data?: { hProperties?: Record<string, unknown> };
  position?: { start: MdastPoint; end: MdastPoint };
};

const sha256Hex = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

const astProcessor = unified()
  .use(remarkParse)
  .use(WIKI_REMARK_PLUGINS ?? []);

const CODE_URL_EXT_RE = /\.(?:py|pyi|c|cc|cpp|cxx|h|hpp|cu|cuh|rs|go|js|jsx|ts|tsx|sh)$/i;

/** 严格复用 classifySource 与 lint.ts 的官方文档/源码判据；raw/unlisted/community/ecosystem 绝不臆猜 S 或 C。 */
export function classifySourceEvidenceMark(
  ref: string,
): { mark: "C" | "S"; kind: SourceKind } | { mark: null; kind: SourceKind; reason: string } {
  const kind = classifySource(ref);
  if (kind === "repo") {
    return { mark: ref.includes(":docs/") ? "S" : "C", kind };
  }
  if (supportsOfficialEvidence(kind)) {
    try {
      const url = new URL(ref);
      const isGithubCodeBlob =
        url.hostname.toLowerCase() === "github.com" &&
        /^\/[^/]+\/[^/]+\/blob\//.test(url.pathname) &&
        CODE_URL_EXT_RE.test(url.pathname);
      return { mark: isGithubCodeBlob ? "C" : "S", kind };
    } catch {
      return { mark: null, kind, reason: `URL 解析失败：${ref}` };
    }
  }
  return {
    mark: null,
    kind,
    reason: `来源分类为 ${kind}（非固定源码或权威官方文档/论文），不自动假定 C 或 S`,
  };
}

const GENERATED_H2_TITLES = new Set([PARAM_SECTION.slice(3), LINEAGE_SECTION.slice(3), "已废弃的说法"]);

function isGeneratedH2Heading(title: string): boolean {
  const trimmed = title.trim();
  return GENERATED_H2_TITLES.has(trimmed) || /[（(]自动生成[）)]$/.test(trimmed);
}

function detectLineEnding(text: string): "LF" | "CRLF" | "MIXED" {
  let crlf = 0;
  let bareLf = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      if (i > 0 && text[i - 1] === "\r") crlf++;
      else bareLf++;
    }
  }
  if (crlf > 0 && bareLf > 0) return "MIXED";
  return crlf > 0 ? "CRLF" : "LF";
}

function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineOfOffset(lineStarts: readonly number[], offset: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStarts[mid]! <= offset) lo = mid + 1;
    else hi = mid - 1;
  }
  return Math.max(1, hi + 1);
}

function extractPlainText(node: MdastNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(extractPlainText).join("");
}

function collectHeadingAnchorIds(bodyText: string): string[] {
  const tree = astProcessor.runSync(astProcessor.parse(bodyText)) as MdastNode;
  const ids: string[] = [];
  const walk = (node: MdastNode) => {
    if (node.type === "heading") {
      const id = node.data?.hProperties?.id;
      if (typeof id === "string") ids.push(id);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return ids;
}

const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const RAW_TEXT_HTML_TAGS = new Set([
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
]);

function maskHtmlCommentsAndCdata(slice: string): string {
  return slice
    .replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length))
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (m) => " ".repeat(m.length));
}

function spanTouchesProtectedRanges(
  ranges: readonly { start: number; end: number }[],
  startOffset: number,
  endOffset: number,
): boolean {
  if (startOffset === endOffset) {
    return ranges.some((r) => startOffset > r.start && startOffset < r.end);
  }
  return ranges.some((r) => startOffset < r.end && endOffset > r.start);
}

function computeHtmlProtectedRanges(
  root: MdastNode,
  bodyStartOffset: number,
  rawText: string,
): { start: number; end: number }[] {
  const rawRanges: { start: number; end: number }[] = [];
  const openStack: { tag: string; openStart: number }[] = [];
  let activeRawTag: { tag: string; openStart: number } | null = null;
  const normalTagRe = /<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*(\/?)>/g;

  const visit = (node: MdastNode) => {
    if (node.type === "html") {
      const nStart = node.position?.start.offset;
      const nEnd = node.position?.end.offset;
      if (nStart !== undefined && nEnd !== undefined) {
        const nodeRawStart = bodyStartOffset + nStart;
        const nodeRawEnd = bodyStartOffset + nEnd;
        rawRanges.push({ start: nodeRawStart, end: nodeRawEnd });
        const rawSlice = rawText.slice(nodeRawStart, nodeRawEnd);
        const maskedSlice = maskHtmlCommentsAndCdata(rawSlice);
        let pos = 0;
        while (pos < rawSlice.length) {
          if (activeRawTag) {
            if (activeRawTag.tag === "plaintext") break;
            const closeRe = new RegExp(`</${activeRawTag.tag}(?=[\\s>/])[^>]*>`, "ig");
            closeRe.lastIndex = pos;
            const cm = closeRe.exec(rawSlice);
            if (!cm) break;
            const closeEnd = cm.index + cm[0].length;
            rawRanges.push({ start: activeRawTag.openStart, end: nodeRawStart + closeEnd });
            activeRawTag = null;
            pos = closeEnd;
            continue;
          }
          normalTagRe.lastIndex = pos;
          const tm = normalTagRe.exec(maskedSlice);
          if (!tm) break;
          const full = tm[0];
          const tag = tm[1]!.toLowerCase();
          const selfClosing = tm[2] === "/" || VOID_HTML_TAGS.has(tag);
          const tagRelStart = tm.index;
          const tagRelEnd = tagRelStart + full.length;
          const tagRawStart = nodeRawStart + tagRelStart;
          const tagRawEnd = nodeRawStart + tagRelEnd;
          if (full.startsWith("</")) {
            for (let k = openStack.length - 1; k >= 0; k--) {
              if (openStack[k]!.tag === tag) {
                rawRanges.push({ start: openStack[k]!.openStart, end: tagRawEnd });
                openStack.length = k;
                break;
              }
            }
          } else if (!selfClosing) {
            if (RAW_TEXT_HTML_TAGS.has(tag)) {
              activeRawTag = { tag, openStart: tagRawStart };
            } else {
              openStack.push({ tag, openStart: tagRawStart });
            }
          }
          pos = tagRelEnd;
        }
      }
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };

  visit(root);
  if (rawRanges.length === 0) return [];
  rawRanges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: { start: number; end: number }[] = [{ ...rawRanges[0]! }];
  for (let i = 1; i < rawRanges.length; i++) {
    const curr = rawRanges[i]!;
    const last = merged[merged.length - 1]!;
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

const PROTECTED_NODE_TYPES = new Set([
  "code",
  "inlineCode",
  "math",
  "inlineMath",
  "html",
  "link",
  "linkReference",
  "definition",
  "image",
  "imageReference",
  "heading",
]);

const SOURCE_REF_RE =
  /来源\s*(\d+(?:\s*[–—\-~～]\s*\d+)?(?:\s*、\s*\d+(?:\s*[–—\-~～]\s*\d+)?)*)(?![0-9A-Za-z_])/g;

/** 逗号后紧接裸数字区间但未写明「行」（如 `来源4，303–345`）：语义上疑似代码行段，绝不展开为来源号，也绝不臆改。 */
const AMBIGUOUS_COMMA_RANGE_RE = /^(?:[,，]\s*\d+\s*[–—\-~～]\s*\d+(?![\d\s]*行)|,\s*\d+(?![\d\s]*行))/;

function parseOrdinalExpression(
  spec: string,
  maxSourceCount: number,
): { ok: true; ordinals: number[] } | { ok: false; reason: string; rawNumbers: number[] } {
  const parts = spec.split(/\s*、\s*/);
  const ordinals: number[] = [];
  const rawNumbers: number[] = [];
  for (const part of parts) {
    const rangeMatch = /^(\d+)\s*[–—\-~～]\s*(\d+)$/.exec(part.trim());
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      rawNumbers.push(start, end);
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 1 ||
        end < start ||
        end > maxSourceCount
      ) {
        return {
          ok: false,
          reason: `来源区间 ${part.trim()} 超出本页合法来源范围 1..${maxSourceCount}`,
          rawNumbers,
        };
      }
      for (let n = start; n <= end; n++) {
        if (!ordinals.includes(n)) ordinals.push(n);
      }
    } else {
      const n = Number(part.trim());
      rawNumbers.push(n);
      if (!Number.isSafeInteger(n) || n < 1 || n > maxSourceCount) {
        return {
          ok: false,
          reason: `来源编号 ${part.trim()} 超出本页合法来源范围 1..${maxSourceCount}`,
          rawNumbers,
        };
      }
      if (!ordinals.includes(n)) ordinals.push(n);
    }
  }
  return { ok: true, ordinals };
}

function collectExistingNumberedMarksInSlice(slice: string): Set<number> {
  const found = new Set<number>();
  for (const m of slice.matchAll(new RegExp(EVIDENCE_MARK_RE.source, "g"))) {
    const num = m[2];
    if (num) found.add(Number(num));
  }
  return found;
}

interface PhysicalDiffLine {
  content: string;
  hasNewline: boolean;
}

function splitPhysicalDiffLines(text: string): PhysicalDiffLine[] {
  if (text.length === 0) return [];
  const parts = text.split("\n");
  const hasTrailingLf = text.endsWith("\n");
  const count = hasTrailingLf ? parts.length - 1 : parts.length;
  const lines: PhysicalDiffLine[] = [];
  for (let i = 0; i < count; i++) {
    lines.push({
      content: parts[i]!,
      hasNewline: i < count - 1 ? true : hasTrailingLf,
    });
  }
  return lines;
}

function renderUnifiedDiff(file: string, beforeText: string, afterText: string): string {
  if (beforeText === afterText) return "";
  const a = splitPhysicalDiffLines(beforeText);
  const b = splitPhysicalDiffLines(afterText);
  const eq = (x: PhysicalDiffLine, y: PhysicalDiffLine) =>
    x.content === y.content && x.hasNewline === y.hasNewline;

  let prefixLen = 0;
  while (prefixLen < a.length && prefixLen < b.length && eq(a[prefixLen]!, b[prefixLen]!)) {
    prefixLen++;
  }
  let suffixLen = 0;
  while (
    suffixLen < a.length - prefixLen &&
    suffixLen < b.length - prefixLen &&
    eq(a[a.length - 1 - suffixLen]!, b[b.length - 1 - suffixLen]!)
  ) {
    suffixLen++;
  }

  const aMid = a.slice(prefixLen, a.length - suffixLen);
  const bMid = b.slice(prefixLen, b.length - suffixLen);
  const m = aMid.length;
  const n = bMid.length;
  const dp: Int32Array[] = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]!;
    const nextRow = dp[i + 1]!;
    for (let j = n - 1; j >= 0; j--) {
      row[j] = eq(aMid[i]!, bMid[j]!) ? nextRow[j + 1]! + 1 : Math.max(nextRow[j]!, row[j + 1]!);
    }
  }

  type DiffOp = { type: "eq" | "del" | "add"; i: number; j: number };
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && eq(aMid[i]!, bMid[j]!)) {
      ops.push({ type: "eq", i: prefixLen + i, j: prefixLen + j });
      i++;
      j++;
    } else if (i < m && (j === n || dp[i + 1]![j]! >= dp[i]![j + 1]!)) {
      ops.push({ type: "del", i: prefixLen + i, j: prefixLen + j });
      i++;
    } else {
      ops.push({ type: "add", i: prefixLen + i, j: prefixLen + j });
      j++;
    }
  }

  const out = [`--- a/wiki/${file}`, `+++ b/wiki/${file}`];
  let idx = 0;
  while (idx < ops.length) {
    if (ops[idx]!.type === "eq") {
      idx++;
      continue;
    }
    const startI = ops[idx]!.i;
    const startJ = ops[idx]!.j;
    const dels: PhysicalDiffLine[] = [];
    const adds: PhysicalDiffLine[] = [];
    while (idx < ops.length && ops[idx]!.type !== "eq") {
      const op = ops[idx]!;
      if (op.type === "del") dels.push(a[op.i]!);
      else adds.push(b[op.j]!);
      idx++;
    }
    const oldStart = dels.length === 0 ? startI : startI + 1;
    const newStart = adds.length === 0 ? startJ : startJ + 1;
    const oldSpec = dels.length === 1 ? `${oldStart}` : `${oldStart},${dels.length}`;
    const newSpec = adds.length === 1 ? `${newStart}` : `${newStart},${adds.length}`;
    out.push(`@@ -${oldSpec} +${newSpec} @@`);
    for (const d of dels) {
      out.push(`-${d.content}`);
      if (!d.hasNewline) out.push("\\ No newline at end of file");
    }
    for (const ad of adds) {
      out.push(`+${ad.content}`);
      if (!ad.hasNewline) out.push("\\ No newline at end of file");
    }
  }
  return out.join("\n");
}

/** 纯内存按 UTF-16 偏移预览拟议编辑，严格校验输入哈希、原文切片匹配与不重叠单调区间，零磁盘写入。 */
export function renderPlanPreviewText(rawText: string, pagePlan: PageAstMigrationPlan): string {
  const actualSha = sha256Hex(Buffer.from(rawText, "utf8"));
  if (actualSha !== pagePlan.inputByteSha256) {
    throw new Error(
      `陈旧输入拒绝预览：${pagePlan.file} 当前哈希 ${actualSha} 与计划哈希 ${pagePlan.inputByteSha256} 不一致`,
    );
  }
  if (pagePlan.proposedEdits.length === 0) return rawText;
  const sorted = [...pagePlan.proposedEdits].sort(
    (a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset,
  );
  let cursor = 0;
  let out = "";
  for (const edit of sorted) {
    if (edit.startOffset < cursor || edit.endOffset < edit.startOffset || edit.endOffset > rawText.length) {
      throw new Error(`拟议编辑区间非法或重叠：${pagePlan.file} [${edit.startOffset}, ${edit.endOffset})`);
    }
    const actualBefore = rawText.slice(edit.startOffset, edit.endOffset);
    if (actualBefore !== edit.beforeText) {
      throw new Error(`拟议编辑原文切片不匹配：${pagePlan.file} [${edit.startOffset}, ${edit.endOffset})`);
    }
    out += rawText.slice(cursor, edit.startOffset) + edit.afterText;
    cursor = edit.endOffset;
  }
  out += rawText.slice(cursor);
  return out;
}

const VERSION_PATCH_LEAD_RE =
  /^(?:v\d+\.\d+(?:\.\d+)?(?:rc\d*)?|releases\/v\d+\.\d+(?:rc\d*)?|rc\d+|版本(?:对照|差异|补丁)|四版对照)(?:\s|[：:。]|的)/i;

interface H2SectionInfo {
  heading: string;
  role: "generated" | "sourceCheck" | "paramFactsSection" | "narrative";
  startOffset: number;
  endOffset: number;
  lineStart: number;
  lineEnd: number;
}

export function planPageAstMigration(
  file: string,
  rawBytesOrText: Buffer | string,
  options?: {
    selectedMoves?: readonly VersionParagraphMoveSelection[];
    sourceSectionName?: string;
  },
): PageAstMigrationPlan {
  const normFile = file.replace(/\\/g, "/").replace(/^wiki\//, "");
  const rawBuf = Buffer.isBuffer(rawBytesOrText) ? rawBytesOrText : Buffer.from(rawBytesOrText, "utf8");
  const rawText = Buffer.isBuffer(rawBytesOrText) ? rawBytesOrText.toString("utf8") : rawBytesOrText;
  const inputByteSha256 = sha256Hex(rawBuf);
  const hasBom = rawText.startsWith("\uFEFF");
  const bomOffset = hasBom ? 1 : 0;
  const lineEnding = detectLineEnding(rawText);
  const eol = lineEnding === "CRLF" ? "\r\n" : "\n";
  const lineStarts = buildLineStarts(rawText);

  const parsedPage = parsePage(normFile, rawText.slice(bomOffset));
  if (!parsedPage.page) {
    const reasons = parsedPage.problems.map((p) => p.message).join("；");
    throw new Error(`页面解析失败（${normFile}）：${reasons}`);
  }
  const page = parsedPage.page;
  const sourceSectionName = options?.sourceSectionName ?? loadStandardConfig().sourceSection;

  const fmMatch = /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(rawText);
  const bodyStartOffset = fmMatch ? fmMatch[0].length : bomOffset;
  const bodyText = rawText.slice(bodyStartOffset);
  const mdast = astProcessor.parse(bodyText) as MdastNode;
  const topChildren = mdast.children ?? [];

  const h2Headings: { title: string; rawStart: number }[] = [];
  for (const child of topChildren) {
    if (child.type === "heading" && child.depth === 2 && child.position?.start.offset !== undefined) {
      h2Headings.push({
        title: extractPlainText(child).trim(),
        rawStart: bodyStartOffset + child.position.start.offset,
      });
    }
  }

  const sections: H2SectionInfo[] = [];
  for (let i = 0; i < h2Headings.length; i++) {
    const curr = h2Headings[i]!;
    const endOffset = i + 1 < h2Headings.length ? h2Headings[i + 1]!.rawStart : rawText.length;
    const role: H2SectionInfo["role"] = isGeneratedH2Heading(curr.title)
      ? "generated"
      : curr.title === sourceSectionName
        ? "sourceCheck"
        : page.fm.type === "param" && curr.title === "事实表"
          ? "paramFactsSection"
          : "narrative";
    sections.push({
      heading: curr.title,
      role,
      startOffset: curr.rawStart,
      endOffset,
      lineStart: lineOfOffset(lineStarts, curr.rawStart),
      lineEnd: lineOfOffset(lineStarts, Math.max(curr.rawStart, endOffset - 1)),
    });
  }

  const sectionAt = (rawOffset: number): H2SectionInfo | null => {
    for (const sec of sections) {
      if (rawOffset >= sec.startOffset && rawOffset < sec.endOffset) return sec;
    }
    return null;
  };

  const protectedSections = sections
    .filter((s) => s.role === "generated")
    .map(({ heading, startOffset, endOffset, lineStart, lineEnd }) => ({
      heading,
      startOffset,
      endOffset,
      lineStart,
      lineEnd,
    }));

  // 定位现成承接节（优先 ## 对照源码 下的 ### 版本差异，其次 ## 对照源码 末尾；绝不凭空新建标题）
  const sourceCheckSec = sections.find((s) => s.role === "sourceCheck") ?? null;
  let destination: VersionParagraphInventoryItem["destination"] = {
    exists: false,
    heading: null,
    insertOffset: null,
    line: null,
  };
  if (sourceCheckSec) {
    let destHeading = `## ${sourceCheckSec.heading}`;
    let destSpanEnd = sourceCheckSec.endOffset;
    for (let idx = 0; idx < topChildren.length; idx++) {
      const n = topChildren[idx]!;
      if (n.type !== "heading" || n.depth !== 3 || n.position?.start.offset === undefined) continue;
      const rawStart = bodyStartOffset + n.position.start.offset;
      if (rawStart < sourceCheckSec.startOffset || rawStart >= sourceCheckSec.endOffset) continue;
      if (extractPlainText(n).trim() === "版本差异") {
        destHeading = "### 版本差异";
        for (let k = idx + 1; k < topChildren.length; k++) {
          const next = topChildren[k]!;
          if (
            next.type === "heading" &&
            (next.depth ?? 6) <= 3 &&
            next.position?.start.offset !== undefined
          ) {
            const nextRaw = bodyStartOffset + next.position.start.offset;
            if (nextRaw <= sourceCheckSec.endOffset) {
              destSpanEnd = nextRaw;
              break;
            }
          }
        }
        break;
      }
    }
    let trimEnd = destSpanEnd;
    while (trimEnd > sourceCheckSec.startOffset && /[\r\n \t]/.test(rawText[trimEnd - 1]!)) {
      trimEnd--;
    }
    destination = {
      exists: true,
      heading: destHeading,
      insertOffset: trimEnd,
      line: lineOfOffset(lineStarts, trimEnd),
    };
  }

  const proposedEdits: ProposedAstEdit[] = [];
  const manualItems: ManualAstItem[] = [];
  const versionParagraphs: VersionParagraphInventoryItem[] = [];
  let protectedReferenceSkips = 0;
  let alreadyMarkedReferenceSkips = 0;
  let proposedSourceReferenceEdits = 0;
  let proposedParagraphMoves = 0;

  const htmlProtectedRanges = computeHtmlProtectedRanges(mdast, bodyStartOffset, rawText);
  const generatedProtectedRanges = protectedSections.map((s) => ({
    start: s.startOffset,
    end: s.endOffset,
  }));
  const overlapsHtmlProtectedRange = (startOffset: number, endOffset: number) =>
    spanTouchesProtectedRanges(htmlProtectedRanges, startOffset, endOffset);
  const touchesAnyProtectedRange = (startOffset: number, endOffset: number) =>
    spanTouchesProtectedRanges(htmlProtectedRanges, startOffset, endOffset) ||
    spanTouchesProtectedRanges(generatedProtectedRanges, startOffset, endOffset);

  // 1) 版本补丁段落 AST 盘点（仅检查顶层 paragraph 首子节点为 strong 的版本引导段，忽略受保护自动生成区、HTML 保护区与代码围栏）
  for (const block of topChildren) {
    if (block.type !== "paragraph") continue;
    const pStartRel = block.position?.start.offset;
    const pEndRel = block.position?.end.offset;
    if (pStartRel === undefined || pEndRel === undefined) continue;
    const rawStart = bodyStartOffset + pStartRel;
    const rawEnd = bodyStartOffset + pEndRel;
    const sec = sectionAt(rawStart);
    if (sec?.role === "generated" || overlapsHtmlProtectedRange(rawStart, rawEnd)) continue;
    const firstChild = block.children?.[0];
    if (firstChild?.type !== "strong") continue;
    const leadStrongText = extractPlainText(firstChild).trim();
    if (!VERSION_PATCH_LEAD_RE.test(leadStrongText)) continue;

    const rawPara = rawText.slice(rawStart, rawEnd);
    const alreadyInSourceCheck = sec?.role === "sourceCheck";
    versionParagraphs.push({
      file: normFile,
      section: sec?.heading ?? null,
      lineStart: lineOfOffset(lineStarts, rawStart),
      lineEnd: lineOfOffset(lineStarts, Math.max(rawStart, rawEnd - 1)),
      startOffset: rawStart,
      endOffset: rawEnd,
      blockSha256: sha256Hex(Buffer.from(rawPara, "utf8")),
      leadStrongText,
      alreadyInSourceCheck,
      destination,
      selectedForMove: false,
      disposition: alreadyInSourceCheck ? "already-in-source-check" : "manual-phase-two",
      reason: alreadyInSourceCheck
        ? "已在『## 对照源码』核验区内，无需搬移"
        : "默认保留全部事实、版本限定与就地条件原文，留二阶段人工审阅决定去向",
    });
  }

  // 2) 显式无歧义选中段落搬移拟议（仅对明确指定的单段生成逐字节无损搬移）
  const movedSourceSpans: { start: number; end: number }[] = [];
  const fileMoves = (options?.selectedMoves ?? []).filter(
    (s) => s.file.replace(/\\/g, "/").replace(/^wiki\//, "") === normFile,
  );
  for (const sel of fileMoves) {
    const candidates = versionParagraphs.filter((vp) => {
      if (vp.alreadyInSourceCheck) return false;
      if (sel.startOffset !== undefined && vp.startOffset !== sel.startOffset) return false;
      if (sel.endOffset !== undefined && vp.endOffset !== sel.endOffset) return false;
      if (sel.blockSha256 !== undefined && vp.blockSha256 !== sel.blockSha256) return false;
      if (sel.prefix !== undefined && !vp.leadStrongText.startsWith(sel.prefix)) return false;
      return true;
    });
    if (candidates.length > 1) {
      for (const c of candidates) {
        c.disposition = "manual-blocked";
        c.reason = "存在多处同前缀版本补丁段落，拒绝无精确偏移/哈希绑定的模糊跨节搬移";
      }
      const first = candidates[0]!;
      manualItems.push({
        kind: "ambiguous-paragraph-selection",
        file: normFile,
        section: first.section,
        lineStart: first.lineStart,
        lineEnd: first.lineEnd,
        startOffset: first.startOffset,
        endOffset: first.endOffset,
        excerpt: first.leadStrongText,
        reason: `模糊选择匹配到 ${candidates.length} 处同前缀段落，已拒绝自动搬移以防串节或重复编辑`,
      });
      continue;
    }
    if (candidates.length === 0) continue;
    const targetVp = candidates[0]!;
    const destProtected =
      Boolean(sourceCheckSec) &&
      destination.insertOffset !== null &&
      (touchesAnyProtectedRange(sourceCheckSec!.startOffset, sourceCheckSec!.startOffset + 1) ||
        touchesAnyProtectedRange(destination.insertOffset, destination.insertOffset));
    if (!destination.exists || destination.insertOffset === null || !sourceCheckSec || destProtected) {
      targetVp.disposition = "manual-blocked";
      targetVp.reason = destProtected
        ? "目标『## 对照源码』承接位置处于受保护 HTML 或自动生成区间内，保持原文不动"
        : "目标页缺少现成『## 对照源码』承接小节，保持原文不动";
      manualItems.push({
        kind: "missing-move-destination",
        file: normFile,
        section: targetVp.section,
        lineStart: targetVp.lineStart,
        lineEnd: targetVp.lineEnd,
        startOffset: targetVp.startOffset,
        endOffset: targetVp.endOffset,
        excerpt: targetVp.leadStrongText,
        reason: destProtected
          ? "目标承接位置位于受保护 HTML 或自动生成区间内，拒绝破坏受保护区间或单边删源"
          : "缺少现成『## 对照源码』承接小节，拒绝凭空新建标题或丢弃段落",
      });
      continue;
    }
    const exactPara = rawText.slice(targetVp.startOffset, targetVp.endOffset);
    const destCurrentSlice = rawText.slice(sourceCheckSec.startOffset, sourceCheckSec.endOffset);
    if (destCurrentSlice.includes(exactPara)) continue;

    let delEnd = targetVp.endOffset;
    if (rawText.slice(delEnd).startsWith(`${eol}${eol}`)) delEnd += eol.length * 2;
    else if (rawText.slice(delEnd).startsWith(eol)) delEnd += eol.length;
    if (touchesAnyProtectedRange(targetVp.startOffset, delEnd)) {
      targetVp.disposition = "manual-blocked";
      targetVp.reason = "迁出段落边界紧邻或触碰受保护 HTML/自动生成区间，保持原文不动";
      manualItems.push({
        kind: "missing-move-destination",
        file: normFile,
        section: targetVp.section,
        lineStart: targetVp.lineStart,
        lineEnd: targetVp.lineEnd,
        startOffset: targetVp.startOffset,
        endOffset: targetVp.endOffset,
        excerpt: targetVp.leadStrongText,
        reason: "迁出删除区间触碰受保护 HTML 或自动生成区间，保持原文不动",
      });
      continue;
    }

    targetVp.selectedForMove = true;
    targetVp.disposition = "proposed-move";
    targetVp.reason = `显式选中搬移至 ${destination.heading}，整段原文逐字节保留`;
    movedSourceSpans.push({ start: targetVp.startOffset, end: delEnd });

    proposedEdits.push({
      kind: "version-paragraph-delete",
      file: normFile,
      lineStart: targetVp.lineStart,
      lineEnd: lineOfOffset(lineStarts, Math.max(targetVp.startOffset, delEnd - 1)),
      startOffset: targetVp.startOffset,
      endOffset: delEnd,
      beforeText: rawText.slice(targetVp.startOffset, delEnd),
      afterText: "",
      reason: `显式选中版本补丁段迁出（目标：${destination.heading}）`,
    });
    proposedEdits.push({
      kind: "version-paragraph-insert",
      file: normFile,
      lineStart: destination.line ?? targetVp.lineStart,
      lineEnd: destination.line ?? targetVp.lineEnd,
      startOffset: destination.insertOffset,
      endOffset: destination.insertOffset,
      beforeText: "",
      afterText: `${eol}${eol}${exactPara}`,
      reason: `显式选中版本补丁段原样迁入 ${destination.heading}（逐字节保留事实与条件）`,
    });
    proposedParagraphMoves++;
  }

  for (const vp of versionParagraphs) {
    if (vp.disposition === "manual-phase-two") {
      manualItems.push({
        kind: "version-paragraph-phase-two",
        file: normFile,
        section: vp.section,
        lineStart: vp.lineStart,
        lineEnd: vp.lineEnd,
        startOffset: vp.startOffset,
        endOffset: vp.endOffset,
        excerpt: vp.leadStrongText,
        reason: vp.reason,
      });
    }
  }

  // 3) AST 扫描纯文本 `来源 N` 引用（保护自动生成区、代码、数学公式、HTML、链接、标题与已搬移区）
  const overlapsMovedSpan = (s: number, e: number) => movedSourceSpans.some((m) => s < m.end && e > m.start);

  const scanInlineContainer = (
    containerNode: MdastNode,
    containerRole: "sourceCheck" | "paramFactsCell" | "narrative",
  ) => {
    const cStartRel = containerNode.position?.start.offset;
    const cEndRel = containerNode.position?.end.offset;
    if (cStartRel === undefined || cEndRel === undefined) return;
    const containerRawSlice = rawText.slice(bodyStartOffset + cStartRel, bodyStartOffset + cEndRel);
    const existingBlockMarks = collectExistingNumberedMarksInSlice(containerRawSlice);

    const walkChildren = (nodes: readonly MdastNode[]) => {
      for (const child of nodes) {
        if (PROTECTED_NODE_TYPES.has(child.type)) {
          const nStart = child.position?.start.offset;
          const nEnd = child.position?.end.offset;
          if (nStart !== undefined && nEnd !== undefined) {
            const rawProtected = rawText.slice(bodyStartOffset + nStart, bodyStartOffset + nEnd);
            if (/来源\s*\d/.test(rawProtected)) protectedReferenceSkips++;
          }
          continue;
        }
        if (child.type === "text") {
          const tStartRel = child.position?.start.offset;
          const tEndRel = child.position?.end.offset;
          if (tStartRel === undefined || tEndRel === undefined) continue;
          const tRawStart = bodyStartOffset + tStartRel;
          const tRawEnd = bodyStartOffset + tEndRel;
          const tSlice = rawText.slice(tRawStart, tRawEnd);
          if (overlapsHtmlProtectedRange(tRawStart, tRawEnd)) {
            if (/来源\s*\d/.test(tSlice)) protectedReferenceSkips++;
            continue;
          }
          SOURCE_REF_RE.lastIndex = 0;
          let m: RegExpExecArray | null = SOURCE_REF_RE.exec(tSlice);
          while (m) {
            const fullExpr = m[0];
            const ordinalSpec = m[1]!;
            const exprStart = tRawStart + m.index;
            const exprEnd = exprStart + fullExpr.length;
            if (!overlapsMovedSpan(exprStart, exprEnd)) {
              const sec = sectionAt(exprStart);
              const lineStart = lineOfOffset(lineStarts, exprStart);
              const lineEnd = lineOfOffset(lineStarts, Math.max(exprStart, exprEnd - 1));
              const trailingInNode = tSlice.slice(m.index + fullExpr.length);
              const trailingInDoc = rawText.slice(exprEnd, Math.min(rawText.length, exprEnd + 48));

              if (containerRole === "narrative") {
                manualItems.push({
                  kind: "narrative-source-reference",
                  file: normFile,
                  section: sec?.heading ?? null,
                  lineStart,
                  lineEnd,
                  startOffset: exprStart,
                  endOffset: exprEnd,
                  excerpt: fullExpr,
                  reason: "教学叙述区不新增机器证据角标，保留自然语言条件供二阶段人工审阅",
                });
              } else if (/^\s*(?:[)）]\s*)?\[[SCDAIM!]\d*\]/.test(trailingInDoc)) {
                alreadyMarkedReferenceSkips++;
              } else if (AMBIGUOUS_COMMA_RANGE_RE.test(trailingInNode)) {
                manualItems.push({
                  kind: "ambiguous-code-line-context",
                  file: normFile,
                  section: sec?.heading ?? null,
                  lineStart,
                  lineEnd,
                  startOffset: exprStart,
                  endOffset: exprEnd,
                  excerpt: `${fullExpr}${trailingInNode.slice(0, 16)}`,
                  reason: "来源编号后紧接未标『行』的逗号数值区间（疑似源码行段），保持原文不动留人工确认",
                });
              } else {
                const parsedOrd = parseOrdinalExpression(ordinalSpec, page.fm.sources.length);
                if (!parsedOrd.ok) {
                  manualItems.push({
                    kind: "invalid-source-ordinal",
                    file: normFile,
                    section: sec?.heading ?? null,
                    lineStart,
                    lineEnd,
                    startOffset: exprStart,
                    endOffset: exprEnd,
                    excerpt: fullExpr,
                    reason: parsedOrd.reason,
                    sourceOrdinals: parsedOrd.rawNumbers,
                  });
                } else if (parsedOrd.ordinals.every((n) => existingBlockMarks.has(n))) {
                  alreadyMarkedReferenceSkips++;
                } else {
                  const marks: string[] = [];
                  let blockedReason: string | null = null;
                  for (const ord of parsedOrd.ordinals) {
                    const classified = classifySourceEvidenceMark(page.fm.sources[ord - 1]!);
                    if (!classified.mark) {
                      blockedReason = `来源 ${ord}：${classified.reason}`;
                      break;
                    }
                    marks.push(`[${classified.mark}${ord}]`);
                  }
                  if (blockedReason) {
                    manualItems.push({
                      kind: "non-citable-or-raw-source-kind",
                      file: normFile,
                      section: sec?.heading ?? null,
                      lineStart,
                      lineEnd,
                      startOffset: exprStart,
                      endOffset: exprEnd,
                      excerpt: fullExpr,
                      reason: blockedReason,
                      sourceOrdinals: parsedOrd.ordinals,
                    });
                  } else {
                    const markSuffix = marks.join("");
                    proposedEdits.push({
                      kind: "source-reference-mark",
                      file: normFile,
                      lineStart,
                      lineEnd,
                      startOffset: exprStart,
                      endOffset: exprEnd,
                      beforeText: fullExpr,
                      afterText: `${fullExpr} ${markSuffix}`,
                      reason:
                        containerRole === "paramFactsCell"
                          ? `参数事实表单元格确定性补充已登记来源角标 ${markSuffix}`
                          : `源码对照区确定性补充已登记来源角标 ${markSuffix}`,
                      sourceOrdinals: parsedOrd.ordinals,
                      marksAdded: marks,
                    });
                    proposedSourceReferenceEdits++;
                  }
                }
              }
            }
            m = SOURCE_REF_RE.exec(tSlice);
          }
          continue;
        }
        if (child.children?.length) {
          walkChildren(child.children);
        }
      }
    };
    walkChildren(containerNode.children ?? []);
  };

  const walkBlock = (node: MdastNode) => {
    const startRel = node.position?.start.offset;
    const endRel = node.position?.end.offset;
    if (startRel === undefined || endRel === undefined) return;
    const rawStart = bodyStartOffset + startRel;
    const rawEnd = bodyStartOffset + endRel;
    const sec = sectionAt(rawStart);
    if (sec?.role === "generated") {
      if (/来源\s*\d/.test(rawText.slice(rawStart, rawEnd))) protectedReferenceSkips++;
      return;
    }
    if (PROTECTED_NODE_TYPES.has(node.type)) {
      if (/来源\s*\d/.test(rawText.slice(rawStart, rawEnd))) protectedReferenceSkips++;
      return;
    }
    if (node.type === "paragraph") {
      const role = sec?.role === "sourceCheck" ? "sourceCheck" : "narrative";
      scanInlineContainer(node, role);
      return;
    }
    if (node.type === "table") {
      const rows = node.children ?? [];
      const headerRow = rows[0];
      const headerCells = (headerRow?.children ?? []).map((c) => extractPlainText(c).trim());
      const hasSourceColumn = headerCells.includes("来源");
      rows.forEach((row, rowIdx) => {
        for (const cell of row.children ?? []) {
          const cellRole: "sourceCheck" | "paramFactsCell" | "narrative" =
            sec?.role === "sourceCheck"
              ? "sourceCheck"
              : sec?.role === "paramFactsSection" && rowIdx >= 1 && !hasSourceColumn
                ? "paramFactsCell"
                : "narrative";
          scanInlineContainer(cell, cellRole);
        }
      });
      return;
    }
    for (const child of node.children ?? []) walkBlock(child);
  };

  for (const top of topChildren) walkBlock(top);

  proposedEdits.sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
  for (const edit of proposedEdits) {
    if (touchesAnyProtectedRange(edit.startOffset, edit.endOffset)) {
      throw new Error(
        `内部保护断言失败：${normFile} 拟议编辑 [${edit.startOffset}, ${edit.endOffset}) 触碰受保护 HTML 或自动生成区间`,
      );
    }
  }

  const partialPlan: PageAstMigrationPlan = {
    file: normFile,
    id: page.fm.id,
    type: page.fm.type,
    inputByteSha256,
    inputUtf16Length: rawText.length,
    hasBom,
    lineEnding,
    protectedSections,
    proposedEdits,
    proposedDiff: "",
    previewOutputByteSha256: inputByteSha256,
    manualItems,
    versionParagraphs,
    stats: {
      protectedReferenceSkips,
      alreadyMarkedReferenceSkips,
      proposedSourceReferenceEdits,
      proposedParagraphMoves,
      manualCount: manualItems.length,
    },
  };

  const previewText = renderPlanPreviewText(rawText, partialPlan);
  // 自校验：BOM + frontmatter 字节 100% 不变、受保护自动生成 H2 逐字节不变、全页标题锚点集合不变
  if (previewText.slice(0, bodyStartOffset) !== rawText.slice(0, bodyStartOffset)) {
    throw new Error(`内部保护断言失败：${normFile} frontmatter 或 BOM 发生偏移`);
  }
  const beforeAnchors = collectHeadingAnchorIds(bodyText);
  const afterAnchors = collectHeadingAnchorIds(previewText.slice(bodyStartOffset));
  if (JSON.stringify(beforeAnchors) !== JSON.stringify(afterAnchors)) {
    throw new Error(`内部保护断言失败：${normFile} 标题锚点集合发生变化`);
  }
  for (const prot of protectedSections) {
    const protSlice = rawText.slice(prot.startOffset, prot.endOffset);
    if (!previewText.includes(protSlice)) {
      throw new Error(`内部保护断言失败：${normFile} 受保护小节「${prot.heading}」内容变化`);
    }
  }
  for (const hr of htmlProtectedRanges) {
    const htmlSlice = rawText.slice(hr.start, hr.end);
    if (!previewText.includes(htmlSlice)) {
      throw new Error(`内部保护断言失败：${normFile} 受保护 HTML 区间 [${hr.start}, ${hr.end}) 内容变化`);
    }
  }

  partialPlan.previewOutputByteSha256 = sha256Hex(Buffer.from(previewText, "utf8"));
  partialPlan.proposedDiff = renderUnifiedDiff(normFile, rawText, previewText);
  return partialPlan;
}

export function normalizeWikiRelativeFile(wikiRoot: string, rawFile: string): string {
  const trimmed = rawFile.trim().replace(/\\/g, "/");
  if (
    !trimmed ||
    trimmed.includes("\0") ||
    isAbsolute(rawFile) ||
    trimmed.startsWith("/") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    throw new Error(`非法或越出 wiki 目录的 --file 输入路径：${rawFile}`);
  }
  const rel = trimmed.replace(/^wiki\//, "");
  const segments = rel.split("/");
  if (!rel.endsWith(".md") || segments.some((seg) => seg === "" || seg === "." || seg === "..")) {
    throw new Error(`非法或越出 wiki 目录的 --file 输入路径：${rawFile}`);
  }
  const absWiki = resolve(wikiRoot);
  const absTarget = resolve(absWiki, rel);
  if (!isSameOrSubpath(absWiki, absTarget) || platformPathKey(absTarget) === platformPathKey(absWiki)) {
    throw new Error(`拒绝越出 wiki 目录的 --file 输入路径：${rawFile}`);
  }
  return rel;
}

export function buildWikiAstMigrationPlan(
  wikiRoot: string,
  options?: {
    files?: readonly string[];
    selectedMoves?: readonly VersionParagraphMoveSelection[];
  },
): AstMigrationPlanReport {
  const discoveredFiles: string[] = [];
  if (options?.files?.length) {
    for (const f of options.files) {
      discoveredFiles.push(normalizeWikiRelativeFile(wikiRoot, f));
    }
  } else {
    for (const dir of PAGE_DIRS) {
      let names: string[] = [];
      try {
        names = readdirSync(join(wikiRoot, dir))
          .filter((n) => n.endsWith(".md"))
          .sort();
      } catch {
        names = [];
      }
      for (const n of names) discoveredFiles.push(`${dir}/${n}`);
    }
  }
  discoveredFiles.sort();

  const pages = discoveredFiles.map((relFile) => {
    const rawBuf = readFileSync(join(wikiRoot, relFile));
    return planPageAstMigration(relFile, rawBuf, { selectedMoves: options?.selectedMoves });
  });

  return {
    schemaVersion: 1,
    mode: "dry-run-plan",
    wikiRoot,
    pageCount: pages.length,
    summary: {
      pagesWithProposedEdits: pages.filter((p) => p.proposedEdits.length > 0).length,
      totalProposedEdits: pages.reduce((acc, p) => acc + p.proposedEdits.length, 0),
      proposedSourceReferenceEdits: pages.reduce((acc, p) => acc + p.stats.proposedSourceReferenceEdits, 0),
      proposedParagraphMoves: pages.reduce((acc, p) => acc + p.stats.proposedParagraphMoves, 0),
      pagesWithVersionParagraphs: pages.filter((p) =>
        p.versionParagraphs.some((vp) => !vp.alreadyInSourceCheck),
      ).length,
      totalVersionParagraphsOutsideSourceCheck: pages.reduce(
        (acc, p) => acc + p.versionParagraphs.filter((vp) => !vp.alreadyInSourceCheck).length,
        0,
      ),
      totalManualItems: pages.reduce((acc, p) => acc + p.manualItems.length, 0),
      protectedReferenceSkips: pages.reduce((acc, p) => acc + p.stats.protectedReferenceSkips, 0),
      alreadyMarkedReferenceSkips: pages.reduce((acc, p) => acc + p.stats.alreadyMarkedReferenceSkips, 0),
    },
    pages,
  };
}

function canonicalizeWithExistingAncestor(targetPath: string): string {
  let cur = resolve(targetPath);
  while (true) {
    try {
      lstatSync(cur);
      const realPrefix = realpathSync.native(cur);
      const tail = relative(cur, resolve(targetPath));
      return tail ? resolve(realPrefix, tail) : realPrefix;
    } catch {
      const parent = dirname(cur);
      if (parent === cur) return resolve(targetPath);
      cur = parent;
    }
  }
}

function platformPathKey(p: string): string {
  const norm = resolve(p);
  return process.platform === "win32" ? norm.toLowerCase() : norm;
}

function isSameOrSubpath(parentPath: string, candidatePath: string): boolean {
  const rel = relative(platformPathKey(parentPath), platformPathKey(candidatePath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

const REPO_FORMAL_WIKI_ROOT = resolve(import.meta.dirname, "../../wiki");
let cachedRepoFormalProtectedTargets: {
  inodes: Set<string>;
  realDirs: string[];
  realFiles: Set<string>;
} | null = null;

function collectProtectedInputTargets(
  absWiki: string,
  realWiki: string,
  explicitRelFiles: readonly string[],
): {
  inodes: Set<string>;
  realDirs: string[];
  realFiles: Set<string>;
} {
  if (
    explicitRelFiles.length === 0 &&
    platformPathKey(absWiki) === platformPathKey(REPO_FORMAL_WIKI_ROOT) &&
    cachedRepoFormalProtectedTargets
  ) {
    return cachedRepoFormalProtectedTargets;
  }
  const inodes = new Set<string>();
  const realDirSet = new Set<string>([resolve(absWiki), resolve(realWiki)]);
  const realFiles = new Set<string>();
  const visitedDirs = new Set<string>();

  const visit = (dir: string) => {
    let realDir: string;
    let dirKey: string;
    try {
      const stDir = statSync(dir, { bigint: true });
      realDir = realpathSync.native(dir);
      dirKey = stDir.ino !== 0n ? `${stDir.dev}:${stDir.ino}` : platformPathKey(realDir);
      if (visitedDirs.has(dirKey)) return;
      visitedDirs.add(dirKey);
      if (stDir.ino !== 0n) inodes.add(`${stDir.dev}:${stDir.ino}`);
      realDirSet.add(realDir);
    } catch {
      return;
    }
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = join(dir, ent.name);
      try {
        const st = statSync(full, { bigint: true });
        if (st.ino !== 0n) inodes.add(`${st.dev}:${st.ino}`);
        if (st.isDirectory()) {
          visit(full);
        } else {
          realFiles.add(
            platformPathKey(ent.isSymbolicLink() ? realpathSync.native(full) : join(realDir, ent.name)),
          );
        }
      } catch {
        // 忽略悬空链接或不可访问项
      }
    }
  };

  visit(realWiki);
  for (const rel of explicitRelFiles) {
    const full = join(absWiki, rel);
    try {
      const st = statSync(full, { bigint: true });
      if (st.ino !== 0n) inodes.add(`${st.dev}:${st.ino}`);
      realFiles.add(platformPathKey(realpathSync.native(full)));
    } catch {
      // 交由后续读取阶段处理缺失文件报错
    }
  }

  const result = { inodes, realDirs: [...realDirSet], realFiles };
  if (explicitRelFiles.length === 0 && platformPathKey(absWiki) === platformPathKey(REPO_FORMAL_WIKI_ROOT)) {
    cachedRepoFormalProtectedTargets = result;
  }
  return result;
}

/** 校验计划报告输出路径：拒绝落入 wiki 输入树（含大小写变体、子目录 junction/符号链接目标）或覆盖输入硬链接节点。 */
export function assertSafePlanOutputPath(
  wikiRoot: string,
  outPath: string,
  explicitFiles?: readonly string[],
): {
  absOut: string;
  realWiki: string;
  wikiInodes: Set<string>;
} {
  const normalizedExplicit = (explicitFiles ?? []).map((f) => normalizeWikiRelativeFile(wikiRoot, f));
  const absWiki = resolve(wikiRoot);
  const absOut = resolve(outPath);
  const realWiki = canonicalizeWithExistingAncestor(absWiki);
  const canonicalOut = canonicalizeWithExistingAncestor(absOut);
  const {
    inodes: wikiInodes,
    realDirs,
    realFiles,
  } = collectProtectedInputTargets(absWiki, realWiki, normalizedExplicit);

  for (const protectedDir of realDirs) {
    if (isSameOrSubpath(protectedDir, canonicalOut)) {
      throw new Error(`拒绝将计划报告写入 wiki 目录或其路径别名内部：${outPath}`);
    }
    if (isSameOrSubpath(canonicalOut, protectedDir)) {
      throw new Error(`拒绝将计划报告覆盖 wiki 目录或其祖先路径：${outPath}`);
    }
  }
  if (realFiles.has(platformPathKey(canonicalOut))) {
    throw new Error(`拒绝覆盖实际读取的 wiki 输入文章路径：${outPath}`);
  }

  let outExists = false;
  try {
    const lst = lstatSync(absOut);
    outExists = true;
    if (lst.isSymbolicLink()) {
      throw new Error(`拒绝通过符号链接或 junction 目标路径写入计划报告：${outPath}`);
    }
    if (lst.isDirectory()) {
      throw new Error(`计划报告输出路径不能是目录：${outPath}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  if (outExists) {
    const stOut = statSync(absOut, { bigint: true });
    if (stOut.ino !== 0n && wikiInodes.has(`${stOut.dev}:${stOut.ino}`)) {
      throw new Error(`拒绝覆盖与 wiki 输入文件共享底层节点（hardlink/别名）的目标路径：${outPath}`);
    }
    if (stOut.nlink > 1n) {
      throw new Error(`拒绝覆盖存在多个硬链接（nlink=${stOut.nlink}）的目标文件：${outPath}`);
    }
  }

  return { absOut, realWiki, wikiInodes };
}

/** 安全原子写入计划报告 JSON：先写独占新节点临时文件，复验输出边界后再原子重命名。 */
export function writeSafePlanOutputFile(
  wikiRoot: string,
  outPath: string,
  payload: string,
  explicitFiles?: readonly string[],
): void {
  const { absOut } = assertSafePlanOutputPath(wikiRoot, outPath, explicitFiles);
  mkdirSync(dirname(absOut), { recursive: true });
  // 创建父目录后再次按真实路径与底层节点复验，防止祖先别名穿透或 TOCTOU
  assertSafePlanOutputPath(wikiRoot, absOut, explicitFiles);
  const tmpOut = `${absOut}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  writeFileSync(tmpOut, payload, { encoding: "utf8", flag: "wx" });
  try {
    assertSafePlanOutputPath(wikiRoot, absOut, explicitFiles);
    renameSync(tmpOut, absOut);
  } catch (err) {
    rmSync(tmpOut, { force: true });
    throw err;
  }
}

export interface AstMigrationApplyPageResult {
  file: string;
  status: "written" | "unchanged" | "already-applied";
  beforeByteSha256: string;
  afterByteSha256: string;
  inputByteSha256: string;
  previewOutputByteSha256: string;
  appliedEditCount: number;
}

export interface AstMigrationApplyReport {
  schemaVersion: 1;
  generatedAt: string;
  mode: "apply-plan";
  status: "applied" | "already-applied-idempotent";
  alreadyApplied: boolean;
  wikiRoot: string;
  planPath: string | null;
  planSha256: string;
  pageCount: number;
  writtenPageCount: number;
  writtenPages: number;
  unchangedPageCount: number;
  totalAppliedEdits: number;
  pages: AstMigrationApplyPageResult[];
}

const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * 严格校验隔离副本 apply 目标目录：
 * - 拒绝指向或重叠正式仓库 wiki/ 目录（含大小写变体、父/子目录、junction/符号链接、底层 dev:ino 别名）；
 * - 拒绝目标根或其祖先/内部子目录包含符号链接/junction，或内部文件存在硬链接（nlink > 1）。
 */
export function assertSafeIsolatedApplyRoot(
  targetWikiRoot: string,
  protectedWikiRoot?: string,
): {
  absTarget: string;
  realTarget: string;
  protectedInodes: Set<string>;
  protectedRealDirs: string[];
  protectedRealFiles: Set<string>;
} {
  const absTarget = resolve(targetWikiRoot);
  let lstRoot: ReturnType<typeof lstatSync>;
  try {
    lstRoot = lstatSync(absTarget);
  } catch {
    throw new Error(`Refusing to apply: isolated wikiRoot does not exist: ${targetWikiRoot}`);
  }
  if (lstRoot.isSymbolicLink()) {
    throw new Error(`Refusing to apply to symbolic link or junction wikiRoot: ${targetWikiRoot}`);
  }
  if (!lstRoot.isDirectory()) {
    throw new Error(`Refusing to apply: wikiRoot is not a directory: ${targetWikiRoot}`);
  }

  let curAncestor = absTarget;
  while (true) {
    const lstAnc = lstatSync(curAncestor);
    if (lstAnc.isSymbolicLink()) {
      throw new Error(`Refusing to apply through symbolic link or junction ancestor: ${curAncestor}`);
    }
    const parent = dirname(curAncestor);
    if (parent === curAncestor) break;
    curAncestor = parent;
  }

  const realTarget = realpathSync.native(absTarget);
  const stTarget = statSync(absTarget, { bigint: true });

  const protectedRoots = new Set<string>([
    resolve(process.cwd(), "wiki"),
    resolve(import.meta.dirname, "../../wiki"),
  ]);
  if (protectedWikiRoot) {
    protectedRoots.add(resolve(protectedWikiRoot));
  }

  const protectedRealDirSet = new Set<string>();
  const protectedInodes = new Set<string>();
  const protectedRealFiles = new Set<string>();

  for (const candRoot of protectedRoots) {
    try {
      lstatSync(candRoot);
      const realCand = canonicalizeWithExistingAncestor(candRoot);
      protectedRealDirSet.add(resolve(candRoot));
      protectedRealDirSet.add(resolve(realCand));
      const collected = collectProtectedInputTargets(candRoot, realCand, []);
      for (const ino of collected.inodes) protectedInodes.add(ino);
      for (const d of collected.realDirs) protectedRealDirSet.add(resolve(d));
      for (const f of collected.realFiles) protectedRealFiles.add(f);
    } catch {
      protectedRealDirSet.add(resolve(candRoot));
    }
  }

  const protectedRealDirs = [...protectedRealDirSet];
  if (stTarget.ino !== 0n && protectedInodes.has(`${stTarget.dev}:${stTarget.ino}`)) {
    throw new Error(`Refusing to apply to protected formal wiki directory inode: ${targetWikiRoot}`);
  }
  for (const pDir of protectedRealDirs) {
    if (
      isSameOrSubpath(pDir, realTarget) ||
      isSameOrSubpath(realTarget, pDir) ||
      isSameOrSubpath(pDir, absTarget) ||
      isSameOrSubpath(absTarget, pDir)
    ) {
      throw new Error(
        `Refusing to apply to protected formal wiki directory or overlapping path: ${targetWikiRoot}`,
      );
    }
  }

  const scanTargetTree = (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = join(dir, ent.name);
      const lst = lstatSync(full);
      if (lst.isSymbolicLink()) {
        throw new Error(`Refusing to apply inside directory containing symbolic link or junction: ${full}`);
      }
      const realFull = realpathSync.native(full);
      if (!isSameOrSubpath(realTarget, realFull)) {
        throw new Error(`Refusing to apply: entry escapes isolated wikiRoot: ${full}`);
      }
      for (const pDir of protectedRealDirs) {
        if (isSameOrSubpath(pDir, realFull) || isSameOrSubpath(realFull, pDir)) {
          throw new Error(`Refusing to apply: entry resolves inside protected formal wiki: ${full}`);
        }
      }
      const st = statSync(full, { bigint: true });
      if (st.ino !== 0n && protectedInodes.has(`${st.dev}:${st.ino}`)) {
        throw new Error(`Refusing to apply: entry shares inode with protected formal wiki: ${full}`);
      }
      if (st.isDirectory()) {
        scanTargetTree(full);
      } else if (st.isFile()) {
        if (protectedRealFiles.has(platformPathKey(realFull))) {
          throw new Error(`Refusing to apply: target file aliases protected formal wiki file: ${full}`);
        }
        if (st.nlink > 1n) {
          throw new Error(
            `Refusing to apply to hardlinked file (nlink=${st.nlink}) inside target wikiRoot: ${full}`,
          );
        }
      }
    }
  };
  scanTargetTree(absTarget);

  return { absTarget, realTarget, protectedInodes, protectedRealDirs, protectedRealFiles };
}

/**
 * 校验隔离 apply 报告输出路径：
 * - 拒绝通过任何符号链接或目录 junction 祖先写入报告（阻断经 junction 覆写外部受保护目录文章或输入计划）；
 * - 拒绝写入 .md/.markdown 路径；
 * - 同時に对隔离 wikiRoot 与所有受保护正式 wiki 根（含子目录 junction 目标与底层 dev:ino）执行 assertSafePlanOutputPath；
 * - 拒绝覆盖或通过硬链接/路径别名命中输入 applyPlanPath。
 */
export function assertSafeApplyReportOutputPath(
  isolatedWikiRoot: string,
  outPath: string,
  options?: {
    applyPlanPath?: string;
    protectedWikiRoot?: string;
  },
): { absOut: string; canonicalOut: string } {
  const absOut = resolve(outPath);
  if (/\.(?:md|markdown)$/i.test(absOut)) {
    throw new Error(`Refusing to write apply JSON report to Markdown file path: ${outPath}`);
  }

  let cur = absOut;
  while (true) {
    try {
      const lst = lstatSync(cur);
      if (lst.isSymbolicLink()) {
        throw new Error(
          `Refusing to write apply report through symbolic link or junction path/ancestor: ${cur}`,
        );
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  const canonicalOut = canonicalizeWithExistingAncestor(absOut);
  assertSafePlanOutputPath(isolatedWikiRoot, absOut);

  const protectedRoots = new Set<string>([
    resolve(process.cwd(), "wiki"),
    resolve(import.meta.dirname, "../../wiki"),
  ]);
  if (options?.protectedWikiRoot) {
    protectedRoots.add(resolve(options.protectedWikiRoot));
  }
  for (const candRoot of protectedRoots) {
    try {
      lstatSync(candRoot);
      assertSafePlanOutputPath(candRoot, absOut);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  if (options?.applyPlanPath) {
    const absPlan = resolve(options.applyPlanPath);
    const canonicalPlan = canonicalizeWithExistingAncestor(absPlan);
    if (
      platformPathKey(absOut) === platformPathKey(absPlan) ||
      platformPathKey(canonicalOut) === platformPathKey(canonicalPlan)
    ) {
      throw new Error(`Refusing to overwrite input migration plan file with --out report: ${outPath}`);
    }
    try {
      const stPlan = statSync(absPlan, { bigint: true });
      const stOut = statSync(absOut, { bigint: true });
      if (stPlan.ino !== 0n && stPlan.dev === stOut.dev && stPlan.ino === stOut.ino) {
        throw new Error(
          `Refusing to overwrite hardlink/inode alias of input migration plan file: ${outPath}`,
        );
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  return { absOut, canonicalOut };
}

export function writeSafeApplyReportOutputFile(
  isolatedWikiRoot: string,
  outPath: string,
  payload: string,
  options?: {
    applyPlanPath?: string;
    protectedWikiRoot?: string;
  },
): void {
  const { absOut } = assertSafeApplyReportOutputPath(isolatedWikiRoot, outPath, options);
  mkdirSync(dirname(absOut), { recursive: true });
  assertSafeApplyReportOutputPath(isolatedWikiRoot, absOut, options);
  const tmpOut = `${absOut}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  writeFileSync(tmpOut, payload, { encoding: "utf8", flag: "wx" });
  try {
    assertSafeApplyReportOutputPath(isolatedWikiRoot, absOut, options);
    renameSync(tmpOut, absOut);
  } catch (err) {
    rmSync(tmpOut, { force: true });
    throw err;
  }
}

/**
 * 显式隔离副本 apply 执行器（All-or-Nothing 原子预检 + 幂等校验）：
 * - 在改写任何单页前先对全部计划页面完成 SHA-256、偏移、AST 保护区与确定性重算校验；
 * - 若全部页面匹配 inputByteSha256 且预检 100% 通过，仅原子改写存在 proposedEdits 的页面；
 * - 若全部页面已等于 previewOutputByteSha256 且重算无待改项，以 0 写入幂等返回；
 * - 若任一页面过期、处于部分应用混合态、或计划/保护区被篡改，预检直接抛错且 0 写入。
 */
export function applyWikiAstMigrationPlan(
  targetWikiRoot: string,
  planOrPath: AstMigrationPlanReport | string,
  options?: {
    protectedWikiRoot?: string;
    planPath?: string;
  },
): AstMigrationApplyReport {
  const { absTarget, realTarget, protectedInodes, protectedRealDirs, protectedRealFiles } =
    assertSafeIsolatedApplyRoot(targetWikiRoot, options?.protectedWikiRoot);

  let plan: AstMigrationPlanReport;
  let planPath: string | null = options?.planPath ? resolve(options.planPath) : null;
  let planSha256: string;

  if (typeof planOrPath === "string") {
    planPath = resolve(planOrPath);
    const rawPlanBuf = readFileSync(planPath);
    planSha256 = sha256Hex(rawPlanBuf);
    try {
      plan = JSON.parse(rawPlanBuf.toString("utf8")) as AstMigrationPlanReport;
    } catch (err) {
      throw new Error(`Invalid or corrupted migration plan JSON (${planPath}): ${(err as Error).message}`);
    }
  } else {
    plan = planOrPath;
    if (planPath) {
      planSha256 = sha256Hex(readFileSync(planPath));
    } else {
      planSha256 = sha256Hex(Buffer.from(JSON.stringify(plan), "utf8"));
    }
  }

  if (
    !plan ||
    typeof plan !== "object" ||
    plan.schemaVersion !== 1 ||
    plan.mode !== "dry-run-plan" ||
    !Array.isArray(plan.pages) ||
    plan.pages.length === 0 ||
    plan.pageCount !== plan.pages.length ||
    !plan.summary ||
    typeof plan.summary !== "object"
  ) {
    throw new Error(
      "Invalid migration plan structure: expected schemaVersion=1, mode='dry-run-plan', summary object, and matching non-empty pages array",
    );
  }

  interface PreparedPage {
    relFile: string;
    fullPath: string;
    pagePlan: PageAstMigrationPlan;
    rawText: string;
    actualSha: string;
    matchesInput: boolean;
    matchesPreview: boolean;
    needsChangeInPlan: boolean;
    previewBuf?: Buffer;
  }

  const seenFiles = new Set<string>();
  const preparedPages: PreparedPage[] = [];

  for (const pagePlan of plan.pages) {
    if (!pagePlan || typeof pagePlan !== "object" || typeof pagePlan.file !== "string") {
      throw new Error("Invalid page entry in migration plan");
    }
    if (pagePlan.file.includes("\\")) {
      throw new Error(`Invalid backslash in planned page file path: ${pagePlan.file}`);
    }
    const relFile = normalizeWikiRelativeFile(absTarget, pagePlan.file);
    if (relFile !== pagePlan.file) {
      throw new Error(`Non-canonical page file path in migration plan: ${pagePlan.file}`);
    }
    if (seenFiles.has(relFile)) {
      throw new Error(`Duplicate page file entry in migration plan: ${relFile}`);
    }
    seenFiles.add(relFile);

    if (!HEX64_RE.test(pagePlan.inputByteSha256) || !HEX64_RE.test(pagePlan.previewOutputByteSha256)) {
      throw new Error(`Invalid SHA-256 digest in migration plan for ${relFile}`);
    }
    if (!Array.isArray(pagePlan.proposedEdits)) {
      throw new Error(`Invalid proposedEdits array in migration plan for ${relFile}`);
    }

    const needsChangeInPlan = pagePlan.inputByteSha256 !== pagePlan.previewOutputByteSha256;
    if (!needsChangeInPlan && pagePlan.proposedEdits.length > 0) {
      throw new Error(
        `Tampered or inconsistent plan for ${relFile}: non-empty proposedEdits but inputByteSha256 === previewOutputByteSha256`,
      );
    }
    if (needsChangeInPlan && pagePlan.proposedEdits.length === 0) {
      throw new Error(
        `Tampered or inconsistent plan for ${relFile}: 0 proposedEdits but inputByteSha256 !== previewOutputByteSha256`,
      );
    }

    let prevEditEnd = 0;
    for (const edit of pagePlan.proposedEdits) {
      if (
        !edit ||
        typeof edit !== "object" ||
        (edit.kind !== "source-reference-mark" &&
          edit.kind !== "version-paragraph-delete" &&
          edit.kind !== "version-paragraph-insert") ||
        !Number.isInteger(edit.startOffset) ||
        !Number.isInteger(edit.endOffset) ||
        edit.startOffset < prevEditEnd ||
        edit.endOffset < edit.startOffset ||
        typeof edit.beforeText !== "string" ||
        typeof edit.afterText !== "string" ||
        edit.beforeText === edit.afterText ||
        edit.endOffset - edit.startOffset !== edit.beforeText.length
      ) {
        throw new Error(`Invalid or tampered proposedEdit entry in migration plan for ${relFile}`);
      }
      prevEditEnd = edit.endOffset;
    }

    const fullPath = join(absTarget, relFile);
    let lstFile: ReturnType<typeof lstatSync>;
    try {
      lstFile = lstatSync(fullPath);
    } catch {
      throw new Error(`Pre-flight failed: planned target file does not exist: ${relFile}`);
    }
    if (lstFile.isSymbolicLink() || !lstFile.isFile()) {
      throw new Error(`Pre-flight failed: planned target is not a regular file: ${relFile}`);
    }
    const realFile = realpathSync.native(fullPath);
    if (
      !isSameOrSubpath(realTarget, realFile) ||
      protectedRealFiles.has(platformPathKey(realFile)) ||
      protectedRealDirs.some((d) => isSameOrSubpath(d, realFile) || isSameOrSubpath(realFile, d))
    ) {
      throw new Error(
        `Pre-flight failed: target file escapes isolated wikiRoot or aliases protected wiki: ${relFile}`,
      );
    }
    const stFile = statSync(fullPath, { bigint: true });
    if (stFile.nlink > 1n || (stFile.ino !== 0n && protectedInodes.has(`${stFile.dev}:${stFile.ino}`))) {
      throw new Error(
        `Pre-flight failed: target file has hardlink (nlink=${stFile.nlink}) or protected inode: ${relFile}`,
      );
    }

    const rawBuf = readFileSync(fullPath);
    const rawText = rawBuf.toString("utf8");
    const actualSha = sha256Hex(rawBuf);
    const matchesInput = actualSha === pagePlan.inputByteSha256;
    const matchesPreview = actualSha === pagePlan.previewOutputByteSha256;

    if (!matchesInput && !matchesPreview) {
      throw new Error(
        `Pre-flight SHA-256 mismatch (stale or modified file) for ${relFile}: disk=${actualSha}, expected inputByteSha256=${pagePlan.inputByteSha256}`,
      );
    }

    preparedPages.push({
      relFile,
      fullPath,
      pagePlan,
      rawText,
      actualSha,
      matchesInput,
      matchesPreview,
      needsChangeInPlan,
    });
  }

  const expectedPagesWithEdits = preparedPages.filter((p) => p.pagePlan.proposedEdits.length > 0).length;
  const expectedTotalEdits = preparedPages.reduce((acc, p) => acc + p.pagePlan.proposedEdits.length, 0);
  if (
    plan.summary.pagesWithProposedEdits !== expectedPagesWithEdits ||
    plan.summary.totalProposedEdits !== expectedTotalEdits
  ) {
    throw new Error(
      `Tampered or inconsistent plan summary: summary=(${plan.summary.pagesWithProposedEdits}, ${plan.summary.totalProposedEdits}) !== pages=(${expectedPagesWithEdits}, ${expectedTotalEdits})`,
    );
  }

  const allMatchInput = preparedPages.every((p) => p.matchesInput);
  const allMatchPreview = preparedPages.every((p) => p.matchesPreview);

  if (!allMatchInput && !allMatchPreview) {
    throw new Error(
      "Pre-flight rejected partial or mixed apply state across batch: some pages match inputByteSha256 while others already match previewOutputByteSha256",
    );
  }

  const anyNeedsWrite = allMatchInput && preparedPages.some((p) => p.needsChangeInPlan);

  if (!anyNeedsWrite && allMatchPreview) {
    for (const p of preparedPages) {
      const postPlan = planPageAstMigration(p.relFile, p.rawText);
      if (postPlan.proposedEdits.length > 0) {
        throw new Error(
          `Pre-flight idempotence check failed for ${p.relFile}: disk matches previewOutputByteSha256 but ${postPlan.proposedEdits.length} edits remain unapplied`,
        );
      }
      if (p.needsChangeInPlan) {
        let cursorOrig = 0;
        let cursorPreview = 0;
        const chunks: string[] = [];
        for (const edit of p.pagePlan.proposedEdits) {
          const unchangedLen = edit.startOffset - cursorOrig;
          const afterStart = cursorPreview + unchangedLen;
          const afterEnd = afterStart + edit.afterText.length;
          if (unchangedLen < 0 || afterEnd > p.rawText.length) {
            throw new Error(
              `Pre-flight idempotence inverse reconstruction out of bounds (tampered plan) for ${p.relFile}`,
            );
          }
          const actualAfterSlice = p.rawText.slice(afterStart, afterEnd);
          if (actualAfterSlice !== edit.afterText) {
            throw new Error(
              `Pre-flight idempotence inverse reconstruction mismatch (tampered proposedEdits) for ${p.relFile}`,
            );
          }
          chunks.push(p.rawText.slice(cursorPreview, afterStart));
          chunks.push(edit.beforeText);
          cursorOrig = edit.endOffset;
          cursorPreview = afterEnd;
        }
        chunks.push(p.rawText.slice(cursorPreview));
        const reconstructedInputText = chunks.join("");
        const reconstructedInputSha = sha256Hex(Buffer.from(reconstructedInputText, "utf8"));
        if (reconstructedInputSha !== p.pagePlan.inputByteSha256) {
          throw new Error(
            `Pre-flight idempotence inputByteSha256 mismatch (tampered or fabricated plan) for ${p.relFile}: reconstructed=${reconstructedInputSha}, planned=${p.pagePlan.inputByteSha256}`,
          );
        }
        const selectedMoves: VersionParagraphMoveSelection[] = Array.isArray(p.pagePlan.versionParagraphs)
          ? p.pagePlan.versionParagraphs
              .filter((vp) => vp && (vp.selectedForMove === true || vp.disposition === "proposed-move"))
              .map((vp) => ({
                file: p.relFile,
                startOffset: vp.startOffset,
                endOffset: vp.endOffset,
                blockSha256: vp.blockSha256,
              }))
          : [];
        const recomputed = planPageAstMigration(p.relFile, reconstructedInputText, { selectedMoves });
        if (
          recomputed.previewOutputByteSha256 !== p.pagePlan.previewOutputByteSha256 ||
          recomputed.proposedEdits.length !== p.pagePlan.proposedEdits.length
        ) {
          throw new Error(
            `Pre-flight idempotence AST planner verification failed (tampered plan) for ${p.relFile}`,
          );
        }
        for (let i = 0; i < recomputed.proposedEdits.length; i++) {
          const expEdit = recomputed.proposedEdits[i]!;
          const gotEdit = p.pagePlan.proposedEdits[i]!;
          if (
            expEdit.kind !== gotEdit.kind ||
            expEdit.startOffset !== gotEdit.startOffset ||
            expEdit.endOffset !== gotEdit.endOffset ||
            expEdit.beforeText !== gotEdit.beforeText ||
            expEdit.afterText !== gotEdit.afterText
          ) {
            throw new Error(
              `Pre-flight idempotence edit #${i} mismatch against deterministic planner for ${p.relFile}`,
            );
          }
        }
      }
    }
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      mode: "apply-plan",
      status: "already-applied-idempotent",
      alreadyApplied: true,
      wikiRoot: absTarget,
      planPath,
      planSha256,
      pageCount: preparedPages.length,
      writtenPageCount: 0,
      writtenPages: 0,
      unchangedPageCount: preparedPages.length,
      totalAppliedEdits: 0,
      pages: preparedPages.map((p) => ({
        file: p.relFile,
        status: p.needsChangeInPlan ? "already-applied" : "unchanged",
        beforeByteSha256: p.actualSha,
        afterByteSha256: p.actualSha,
        inputByteSha256: p.pagePlan.inputByteSha256,
        previewOutputByteSha256: p.pagePlan.previewOutputByteSha256,
        appliedEditCount: 0,
      })),
    };
  }

  // Case A: Fresh apply pre-flight verification across all pages before writing a single file
  for (const p of preparedPages) {
    const previewText = renderPlanPreviewText(p.rawText, p.pagePlan);
    const previewBuf = Buffer.from(previewText, "utf8");
    const previewSha = sha256Hex(previewBuf);
    if (previewSha !== p.pagePlan.previewOutputByteSha256) {
      throw new Error(
        `Pre-flight previewOutputByteSha256 mismatch (tampered plan) for ${p.relFile}: computed=${previewSha}, planned=${p.pagePlan.previewOutputByteSha256}`,
      );
    }

    const selectedMoves: VersionParagraphMoveSelection[] = Array.isArray(p.pagePlan.versionParagraphs)
      ? p.pagePlan.versionParagraphs
          .filter((vp) => vp && (vp.selectedForMove === true || vp.disposition === "proposed-move"))
          .map((vp) => ({
            file: p.relFile,
            startOffset: vp.startOffset,
            endOffset: vp.endOffset,
            blockSha256: vp.blockSha256,
          }))
      : [];

    const recomputed = planPageAstMigration(p.relFile, p.rawText, { selectedMoves });
    if (
      recomputed.previewOutputByteSha256 !== p.pagePlan.previewOutputByteSha256 ||
      recomputed.proposedEdits.length !== p.pagePlan.proposedEdits.length
    ) {
      throw new Error(
        `Pre-flight AST protection and plan integrity check failed (tampered edits or protected range violation) for ${p.relFile}`,
      );
    }
    for (let i = 0; i < recomputed.proposedEdits.length; i++) {
      const expEdit = recomputed.proposedEdits[i]!;
      const gotEdit = p.pagePlan.proposedEdits[i]!;
      if (
        expEdit.kind !== gotEdit.kind ||
        expEdit.startOffset !== gotEdit.startOffset ||
        expEdit.endOffset !== gotEdit.endOffset ||
        expEdit.beforeText !== gotEdit.beforeText ||
        expEdit.afterText !== gotEdit.afterText
      ) {
        throw new Error(
          `Pre-flight AST protection check failed: edit #${i} in ${p.relFile} does not match deterministic planner output`,
        );
      }
    }

    const postPreviewPlan = planPageAstMigration(p.relFile, previewText);
    if (postPreviewPlan.proposedEdits.length > 0) {
      throw new Error(
        `Pre-flight convergence check failed for ${p.relFile}: previewText still has ${postPreviewPlan.proposedEdits.length} proposedEdits`,
      );
    }
    p.previewBuf = previewBuf;
  }

  // Re-verify isolated root safety immediately before atomic disk writes
  assertSafeIsolatedApplyRoot(targetWikiRoot, options?.protectedWikiRoot);

  let writtenPageCount = 0;
  let totalAppliedEdits = 0;
  const pageResults: AstMigrationApplyPageResult[] = [];

  for (const p of preparedPages) {
    if (p.needsChangeInPlan && p.previewBuf) {
      const tmpPath = `${p.fullPath}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
      writeFileSync(tmpPath, p.previewBuf, { flag: "wx" });
      try {
        renameSync(tmpPath, p.fullPath);
      } catch (err) {
        rmSync(tmpPath, { force: true });
        throw err;
      }
      const verifySha = sha256Hex(readFileSync(p.fullPath));
      if (verifySha !== p.pagePlan.previewOutputByteSha256) {
        throw new Error(`Post-write SHA-256 verification failed for ${p.relFile}`);
      }
      writtenPageCount++;
      totalAppliedEdits += p.pagePlan.proposedEdits.length;
      pageResults.push({
        file: p.relFile,
        status: "written",
        beforeByteSha256: p.actualSha,
        afterByteSha256: verifySha,
        inputByteSha256: p.pagePlan.inputByteSha256,
        previewOutputByteSha256: p.pagePlan.previewOutputByteSha256,
        appliedEditCount: p.pagePlan.proposedEdits.length,
      });
    } else {
      pageResults.push({
        file: p.relFile,
        status: "unchanged",
        beforeByteSha256: p.actualSha,
        afterByteSha256: p.actualSha,
        inputByteSha256: p.pagePlan.inputByteSha256,
        previewOutputByteSha256: p.pagePlan.previewOutputByteSha256,
        appliedEditCount: 0,
      });
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "apply-plan",
    status: "applied",
    alreadyApplied: false,
    wikiRoot: absTarget,
    planPath,
    planSha256,
    pageCount: preparedPages.length,
    writtenPageCount,
    writtenPages: writtenPageCount,
    unchangedPageCount: preparedPages.length - writtenPageCount,
    totalAppliedEdits,
    pages: pageResults,
  };
}
