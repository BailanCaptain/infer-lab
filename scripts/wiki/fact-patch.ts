import matter from "gray-matter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import { z } from "zod";
import { REPO_GITHUB } from "../../src/content/wiki/evidence-schema";
import { digest } from "./workflow";

export const SHA256_RE = /^[a-f0-9]{64}$/;
export const DEFAULT_EXTRACTOR_VERSION = "fact-patch-v1";

export const factKindSchema = z.enum(["default", "orderedGuards", "sourceAnchor", "versionMatrixCell"]);
export type FactKind = z.infer<typeof factKindSchema>;

export const orderedGuardSchema = z
  .object({
    condition: z.string().min(1),
    precondition: z.string().min(1).optional(),
    outcome: z.string().min(1),
  })
  .strict();
export type OrderedGuard = z.infer<typeof orderedGuardSchema>;

export const factValueSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("default"),
      expr: z.string().min(1),
      valueType: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("orderedGuards"),
      guards: z.array(orderedGuardSchema).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("sourceAnchor"),
      repo: z.string().min(1),
      commit: z.string().min(7).max(40),
      path: z.string().min(1),
      lineStart: z.number().int().positive(),
      lineEnd: z.number().int().positive(),
      quoteHash: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("versionMatrixCell"),
      status: z.string().min(1),
      summary: z.string().min(1),
      anchor: z.string().min(1).optional(),
    })
    .strict(),
]);
export type FactValue = z.infer<typeof factValueSchema>;

export const narrativeGuardSchema = z
  .object({
    sectionHeading: z.string().min(1).optional(),
    anchorQuote: z.string().min(1),
    contradictsValues: z.array(z.string().min(1)).optional(),
    expectedValue: z.string().min(1).optional(),
    diagramIds: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type NarrativeGuard = z.infer<typeof narrativeGuardSchema>;

export const factBindingSchema = z
  .object({
    factId: z.string().min(1),
    pageId: z.string().min(1),
    repo: z.string().min(1),
    path: z.string().min(1),
    qualifiedSymbol: z.string().min(1),
    kind: factKindSchema,
    target: z
      .object({
        tableHeading: z.string().min(1).optional(),
        rowKey: z.string().min(1),
        versionColumn: z.string().min(1),
      })
      .strict(),
    narrativeGuards: z.array(narrativeGuardSchema),
  })
  .strict();
export type FactBinding = z.infer<typeof factBindingSchema>;

export const allowedSpanSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    reason: z.string().min(1),
    replacementLength: z.number().int().nonnegative().optional(),
    replacementSha256: z.string().regex(SHA256_RE).optional(),
  })
  .strict();
export type AllowedSpan = z.infer<typeof allowedSpanSchema>;

export const spanEditSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    oldText: z.string(),
    newText: z.string(),
    reason: z.string().min(1),
  })
  .strict();
export type SpanEdit = z.infer<typeof spanEditSchema>;

export const narrativeConflictSchema = z
  .object({
    line: z.number().int().positive(),
    anchorQuote: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();
export type NarrativeConflict = z.infer<typeof narrativeConflictSchema>;

export const manualConflictSchema = z
  .object({
    rowKey: z.string().min(1),
    versionColumn: z.string().min(1),
    actualCell: z.string(),
    expectedOldCell: z.string(),
    expectedNewCell: z.string(),
    reason: z.string().min(1),
  })
  .strict();
export type ManualConflict = z.infer<typeof manualConflictSchema>;

export const factPatchOperationSchema = z.enum(["reanchor", "appendVersionColumn", "replaceCell"]);
export type FactPatchOperation = z.infer<typeof factPatchOperationSchema>;

export const factDiffKindSchema = z.enum(["unchanged", "line-shift-only", "value-changed", "guard-inverted"]);
export type FactDiffKind = z.infer<typeof factDiffKindSchema>;

export const factPatchSchema = z
  .object({
    factId: z.string().min(1),
    pageId: z.string().min(1),
    oldCommit: z.string().min(1),
    newCommit: z.string().min(1),
    basePageHash: z.string().regex(SHA256_RE),
    extractorVersion: z.string().min(1),
    oldCellHash: z.string().regex(SHA256_RE),
    oldValue: factValueSchema,
    newValue: factValueSchema,
    oldSourceRef: z.string().min(1).optional(),
    newSourceRef: z.string().min(1).optional(),
    operation: factPatchOperationSchema,
    allowedSpans: z.array(allowedSpanSchema),
    protectedEnvelopeHash: z.string().regex(SHA256_RE),
    canCertifyVerified: z.boolean(),
    narrativeConflicts: z.array(narrativeConflictSchema),
    manualConflicts: z.array(manualConflictSchema).default([]),
    edits: z.array(spanEditSchema),
  })
  .strict();
export type FactPatch = z.infer<typeof factPatchSchema>;

export interface PlanFactPatchMeta {
  oldCommit: string;
  newCommit: string;
  extractorVersion?: string;
  oldSourceRef?: string;
  newSourceRef?: string;
  verifiedTag?: string;
  newColumnHeader?: string;
  defaultOtherRowCell?: string;
  pageBindings?: readonly FactBinding[];
}

export type SurgicalFactPatchPlan =
  | {
      noop: true;
      reason: string;
      basePageHash: string;
      protectedEnvelopeHash: string;
      canCertifyVerified: boolean;
      narrativeConflicts: NarrativeConflict[];
      manualConflicts: ManualConflict[];
    }
  | ({ noop: false } & FactPatch);

function normText(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

/** Normalize whitespace outside quoted string literals while preserving exact characters inside quotes. */
function normCodeExpr(s: string): string {
  const normalized = s.replace(/\r\n/g, "\n");
  let out = "";
  let i = 0;
  let pendingSpace = false;

  while (i < normalized.length) {
    const ch = normalized[i]!;
    if (ch === '"' || ch === "'" || ch === "`") {
      if (pendingSpace && out.length > 0) out += " ";
      pendingSpace = false;
      const triple = normalized.slice(i, i + 3);
      const delim = (ch === '"' || ch === "'") && triple === ch.repeat(3) ? triple : ch;
      out += delim;
      i += delim.length;
      while (i < normalized.length) {
        if (delim.length === 1 && normalized[i] === "\\" && i + 1 < normalized.length) {
          out += normalized.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (normalized.startsWith(delim, i)) {
          out += delim;
          i += delim.length;
          break;
        }
        out += normalized[i]!;
        i++;
      }
      continue;
    }

    if (/\s/.test(ch)) {
      pendingSpace = true;
      i++;
      continue;
    }

    if (pendingSpace && out.length > 0) out += " ";
    pendingSpace = false;
    out += ch;
    i++;
  }
  return out;
}

function normGuard(g: OrderedGuard): { cond: string; pre: string; out: string } {
  return {
    cond: normCodeExpr(g.condition),
    pre: normCodeExpr(g.precondition ?? ""),
    out: normCodeExpr(g.outcome),
  };
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Deterministically classify semantic changes between two structured FactValues.
 * Specifically detects ordered-guard inversions (e.g. swapping outcomes across
 * conditions or reordering guard precedence) that bag-of-tokens Jaccard misses.
 */
export function diffFactValue(oldVal: FactValue, newVal: FactValue): FactDiffKind {
  const prev = factValueSchema.parse(oldVal);
  const next = factValueSchema.parse(newVal);
  if (prev.kind !== next.kind) {
    throw new Error(`FactValue kind mismatch: ${prev.kind} vs ${next.kind}`);
  }

  if (prev.kind === "default" && next.kind === "default") {
    const sameExpr = normCodeExpr(prev.expr) === normCodeExpr(next.expr);
    const sameType = normText(prev.valueType ?? "") === normText(next.valueType ?? "");
    return sameExpr && sameType ? "unchanged" : "value-changed";
  }

  if (prev.kind === "sourceAnchor" && next.kind === "sourceAnchor") {
    const sameTarget =
      prev.repo === next.repo && prev.path === next.path && prev.quoteHash === next.quoteHash;
    if (!sameTarget) return "value-changed";
    if (prev.commit === next.commit && prev.lineStart === next.lineStart && prev.lineEnd === next.lineEnd) {
      return "unchanged";
    }
    return "line-shift-only";
  }

  if (prev.kind === "versionMatrixCell" && next.kind === "versionMatrixCell") {
    const sameStatus = normText(prev.status) === normText(next.status);
    const sameSummary = normCodeExpr(prev.summary) === normCodeExpr(next.summary);
    const sameAnchor = normText(prev.anchor ?? "") === normText(next.anchor ?? "");
    if (sameStatus && sameSummary && sameAnchor) return "unchanged";
    if (sameStatus && sameSummary && !sameAnchor) return "line-shift-only";
    return "value-changed";
  }

  if (prev.kind === "orderedGuards" && next.kind === "orderedGuards") {
    const oldG = prev.guards.map(normGuard);
    const newG = next.guards.map(normGuard);
    const exactMatch =
      oldG.length === newG.length &&
      oldG.every((g, i) => g.cond === newG[i]!.cond && g.pre === newG[i]!.pre && g.out === newG[i]!.out);
    if (exactMatch) return "unchanged";

    // 1. Same exact guard tuples, but priority order changed
    const oldPairs = oldG.map((g) => `${g.pre}\u001f${g.cond}\u001f${g.out}`);
    const newPairs = newG.map((g) => `${g.pre}\u001f${g.cond}\u001f${g.out}`);
    if (sameMultiset(oldPairs, newPairs)) return "guard-inverted";

    // 2. Same condition keys and same outcome multiset, but outcomes reassigned across conditions
    const oldConds = oldG.map((g) => `${g.pre}\u001f${g.cond}`);
    const newConds = newG.map((g) => `${g.pre}\u001f${g.cond}`);
    const oldOuts = oldG.map((g) => g.out);
    const newOuts = newG.map((g) => g.out);
    if (sameMultiset(oldConds, newConds) && sameMultiset(oldOuts, newOuts)) {
      return "guard-inverted";
    }

    // 3. Any explicit pairwise outcome swap between two surviving conditions
    const oldByCond = new Map(oldG.map((g) => [`${g.pre}\u001f${g.cond}`, g.out]));
    const newByCond = new Map(newG.map((g) => [`${g.pre}\u001f${g.cond}`, g.out]));
    for (const [c1, o1] of oldByCond) {
      const no1 = newByCond.get(c1);
      if (!no1 || no1 === o1) continue;
      for (const [c2, o2] of oldByCond) {
        if (c2 === c1) continue;
        if (newByCond.get(c2) === o1 && no1 === o2) return "guard-inverted";
      }
    }

    return "value-changed";
  }

  return "value-changed";
}

export interface ProtectedFence {
  kind: "wiki-diagram" | "wiki-scene";
  start: number;
  end: number;
  content: string;
  sha256: string;
}

function parseBlockquotePrefix(line: string): { quoteDepth: number; rest: string } {
  let rest = line;
  let quoteDepth = 0;
  while (true) {
    const m = /^ {0,3}>[ \t]?(.*)$/.exec(rest);
    if (!m) break;
    quoteDepth++;
    rest = m[1]!;
  }
  return { quoteDepth, rest };
}

/** Extract all `wiki-diagram` and `wiki-scene` fenced blocks with exact byte/char offsets. */
export function extractProtectedFences(markdown: string): ProtectedFence[] {
  const rawLines = markdown.split(/(?<=\n)/);
  const fences: ProtectedFence[] = [];
  let offset = 0;
  let activeFence = "";
  let activeQuoteDepth = 0;
  let activeKind: "wiki-diagram" | "wiki-scene" | null = null;
  let fenceStart = -1;

  const closeFenceAt = (endOffset: number) => {
    if (activeKind && fenceStart >= 0) {
      const content = markdown.slice(fenceStart, endOffset);
      fences.push({ kind: activeKind, start: fenceStart, end: endOffset, content, sha256: digest(content) });
    }
    activeFence = "";
    activeQuoteDepth = 0;
    activeKind = null;
    fenceStart = -1;
  };

  for (const rawLine of rawLines) {
    const lineStart = offset;
    offset += rawLine.length;
    const line = rawLine.replace(/\r?\n$/, "");
    const { quoteDepth, rest } = parseBlockquotePrefix(line);
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(rest);

    if (activeFence) {
      if (quoteDepth > activeQuoteDepth) {
        continue;
      }
      if (quoteDepth < activeQuoteDepth) {
        closeFenceAt(lineStart);
      } else {
        if (
          marker &&
          marker[1]![0] === activeFence[0] &&
          marker[1]!.length >= activeFence.length &&
          !marker[2]!.trim()
        ) {
          closeFenceAt(offset);
        }
        continue;
      }
    }

    if (marker && !(marker[1]![0] === "`" && marker[2]!.includes("`"))) {
      activeFence = marker[1]!;
      activeQuoteDepth = quoteDepth;
      fenceStart = lineStart;
      const info = marker[2]!.trim().toLowerCase();
      if (info.startsWith("wiki-diagram")) activeKind = "wiki-diagram";
      else if (info.startsWith("wiki-scene")) activeKind = "wiki-scene";
      else activeKind = null;
    }
  }
  if (activeFence) {
    closeFenceAt(markdown.length);
  }
  return fences;
}

export function normalizeAllowedSpans(spans: AllowedSpan[], docLength: number): AllowedSpan[] {
  const sorted = spans
    .map((s) => allowedSpanSchema.parse(s))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (cur.start > cur.end || cur.end > docLength) {
      throw new Error(`Invalid allowedSpan [${cur.start}, ${cur.end}] for document length ${docLength}`);
    }
    if (i > 0 && cur.start < sorted[i - 1]!.end) {
      throw new Error(`Overlapping allowedSpans at offset ${cur.start}`);
    }
  }
  return sorted;
}

export function sliceOutsideSpans(markdown: string, spans: AllowedSpan[]): string[] {
  const sorted = normalizeAllowedSpans(spans, markdown.length);
  const slices: string[] = [];
  let cursor = 0;
  for (const span of sorted) {
    slices.push(markdown.slice(cursor, span.start));
    cursor = span.end;
  }
  slices.push(markdown.slice(cursor));
  return slices;
}

export function computeProtectedEnvelopeHash(markdown: string, allowedSpans: AllowedSpan[]): string {
  const sorted = normalizeAllowedSpans(allowedSpans, markdown.length);
  const fences = extractProtectedFences(markdown);
  for (const fence of fences) {
    for (const span of sorted) {
      const overlaps =
        span.start === span.end
          ? span.start > fence.start && span.start < fence.end
          : span.start < fence.end && span.end > fence.start;
      if (overlaps) {
        throw new Error(`AllowedSpan (${span.reason}) overlaps protected ${fence.kind} fence`);
      }
    }
  }
  const outsideSlices = sliceOutsideSpans(markdown, sorted);
  const fenceDigests = fences.map((f) => ({ kind: f.kind, sha256: f.sha256 }));
  return digest(JSON.stringify({ outsideSlices, fenceDigests }));
}

interface TableCellSpan {
  text: string;
  rawStart: number;
  rawEnd: number;
  contentStart: number;
  contentEnd: number;
}

interface ParsedTableRow {
  lineIndex: number;
  lineStart: number;
  lineEnd: number;
  pipeEnd: number;
  hasTrailingPipe: boolean;
  cells: TableCellSpan[];
}

interface ParsedTable {
  heading: string;
  headingStack: string[];
  header: ParsedTableRow;
  separator: ParsedTableRow;
  rows: ParsedTableRow[];
  start: number;
  end: number;
}

function stripInlineMd(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeadingTitle(raw: string): string {
  const withoutLinks = raw
    .replace(/^ {0,3}#{1,6}[ \t]+/, "")
    .replace(/(?:[ \t]+#+)?[ \t]*$/, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  return stripInlineMd(withoutLinks);
}

function assertPageIdMatches(markdown: string, expectedPageId: string): void {
  const fm = findFrontmatterBounds(markdown);
  if (!fm) {
    throw new Error(`Page ID mismatch: expected frontmatter id="${expectedPageId}", got "<missing>"`);
  }
  const parsed = matter(markdown.slice(fm.start, fm.end));
  const actualId = typeof parsed.data?.id === "string" ? parsed.data.id.trim() : "";
  if (actualId !== expectedPageId.trim()) {
    throw new Error(`Page ID mismatch: expected "${expectedPageId}", got "${actualId || "<missing>"}"`);
  }
}

function parsePipeRow(
  line: string,
  lineStart: number,
  lineIndex: number,
  allowPipelessSingleCell = false,
): ParsedTableRow | null {
  if (/^(?: {4,}|\t)/.test(line)) return null;
  const leadingTrimIdx = line.search(/\S/);
  if (leadingTrimIdx < 0) return null;
  const trimmedLead = line.slice(leadingTrimIdx);
  if (
    /^(?:#{1,6}[ \t]|`{3,}|~{3,}|>|:::|\$\$|(?:[-*+]|\d+\.)[ \t]|(?:-[ \t]*){3,}$|(?:\*[ \t]*){3,}$|(?:_[ \t]*){3,}$)/.test(
      trimmedLead,
    )
  ) {
    return null;
  }

  const pipePositions: number[] = [];
  for (let i = leadingTrimIdx; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === "\\" && i + 1 < line.length) {
      i++;
      continue;
    }
    if (ch === "|") {
      pipePositions.push(i);
    }
  }
  const trailingTrimEnd = line.replace(/\s+$/, "").length;
  if (pipePositions.length === 0) {
    if (!allowPipelessSingleCell) return null;
    const rawStart = lineStart + leadingTrimIdx;
    const rawEnd = lineStart + trailingTrimEnd;
    const trimmed = line.slice(leadingTrimIdx, trailingTrimEnd).trim();
    return {
      lineIndex,
      lineStart,
      lineEnd: lineStart + line.length,
      pipeEnd: rawEnd,
      hasTrailingPipe: false,
      cells: [
        {
          text: trimmed,
          rawStart,
          rawEnd,
          contentStart: rawStart,
          contentEnd: rawStart + trimmed.length,
        },
      ],
    };
  }

  const firstPipe = pipePositions[0]!;
  const lastPipe = pipePositions[pipePositions.length - 1]!;
  const hasLeadingPipe = firstPipe === leadingTrimIdx;
  const hasTrailingPipe = lastPipe + 1 === trailingTrimEnd && (!hasLeadingPipe || pipePositions.length >= 2);
  if (hasLeadingPipe && pipePositions.length === 1 && lastPipe + 1 === trailingTrimEnd) {
    return null;
  }

  const internalPipes = pipePositions.slice(
    hasLeadingPipe ? 1 : 0,
    hasTrailingPipe ? pipePositions.length - 1 : pipePositions.length,
  );
  const segStarts: number[] = [hasLeadingPipe ? firstPipe + 1 : leadingTrimIdx];
  const segEnds: number[] = [];
  for (const p of internalPipes) {
    segEnds.push(p);
    segStarts.push(p + 1);
  }
  segEnds.push(hasTrailingPipe ? lastPipe : trailingTrimEnd);

  const cells: TableCellSpan[] = [];
  for (let c = 0; c < segStarts.length; c++) {
    const s = segStarts[c]!;
    const e = segEnds[c]!;
    const rawStart = lineStart + s;
    const rawEnd = lineStart + e;
    const raw = line.slice(s, e);
    const trimmed = raw.trim();
    const rel = trimmed.length > 0 ? raw.indexOf(trimmed) : 0;
    const contentStart = trimmed.length > 0 ? rawStart + rel : rawStart;
    const contentEnd = trimmed.length > 0 ? contentStart + trimmed.length : rawEnd;
    cells.push({ text: trimmed, rawStart, rawEnd, contentStart, contentEnd });
  }
  return {
    lineIndex,
    lineStart,
    lineEnd: lineStart + line.length,
    pipeEnd: hasTrailingPipe ? lineStart + lastPipe + 1 : lineStart + trailingTrimEnd,
    hasTrailingPipe,
    cells,
  };
}

function isSeparatorRow(row: ParsedTableRow | null): row is ParsedTableRow {
  return Boolean(
    row &&
      row.cells.length > 0 &&
      (row.cells.length >= 2 || (row.hasTrailingPipe && row.cells.length >= 1)) &&
      row.cells.every((c) => /^:?-{2,}:?$/.test(c.text)),
  );
}

interface AstPosPoint {
  line: number;
  offset?: number | undefined;
}
interface AstNode {
  type: string;
  depth?: number | undefined;
  children?: AstNode[] | undefined;
  position?: { start: AstPosPoint; end: AstPosPoint } | undefined;
}

interface ParsedHeadingInfo {
  level: number;
  rawTitle: string;
  title: string;
  lineStart: number;
  lineEnd: number;
}

const gfmAstProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

function parseMarkdownStructure(markdown: string): {
  headings: ParsedHeadingInfo[];
  tables: ParsedTable[];
  nonRewritable: Array<{ start: number; end: number }>;
} {
  const fm = findFrontmatterBounds(markdown);
  const bodyStart = fm ? fm.end : 0;
  const nonRewritable = [
    ...extractProtectedFences(markdown).map((f) => ({ start: f.start, end: f.end })),
    ...extractNonRewritableSpans(markdown),
  ];
  const isEnclosedInNonRewritableBlock = (start: number, end: number) =>
    nonRewritable.some((s) => s.start <= start && s.end >= end);

  const rawLines = markdown.split(/(?<=\n)/);
  const docLines: Array<{ text: string; start: number; rawEnd: number }> = [];
  let offset = 0;
  for (const raw of rawLines) {
    const start = offset;
    offset += raw.length;
    docLines.push({ text: raw.replace(/\r?\n$/, ""), start, rawEnd: offset });
  }

  let fmLineCount = 0;
  if (fm) {
    for (let i = 0; i < bodyStart; i++) {
      if (markdown[i] === "\n") fmLineCount++;
    }
  }

  const body = markdown.slice(bodyStart);
  const root = gfmAstProcessor.parse(body) as unknown as AstNode;
  const headings: ParsedHeadingInfo[] = [];
  const tables: ParsedTable[] = [];
  const headingStack: Array<{ level: number; title: string }> = [];

  for (const node of root.children ?? []) {
    if (!node.position) continue;
    const nodeStart = bodyStart + (node.position.start.offset ?? 0);
    const nodeEnd = bodyStart + (node.position.end.offset ?? 0);
    if (isEnclosedInNonRewritableBlock(nodeStart, nodeEnd)) continue;

    if (node.type === "heading" && typeof node.depth === "number") {
      const lineIdx = fmLineCount + node.position.start.line - 1;
      const lineInfo = docLines[lineIdx];
      if (!lineInfo) continue;
      const hm = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(lineInfo.text);
      const rawTitle = hm ? hm[2]! : lineInfo.text;
      const title = normalizeHeadingTitle(rawTitle);
      while (headingStack.length > 0 && headingStack.at(-1)!.level >= node.depth) {
        headingStack.pop();
      }
      headingStack.push({ level: node.depth, title });
      headings.push({
        level: node.depth,
        rawTitle,
        title,
        lineStart: lineInfo.start,
        lineEnd: lineInfo.rawEnd,
      });
      continue;
    }

    if (node.type === "table" && node.children && node.children.length >= 1) {
      const headerLineIdx = fmLineCount + (node.children[0]?.position?.start.line ?? 1) - 1;
      const sepLineIdx = headerLineIdx + 1;
      const headerLine = docLines[headerLineIdx];
      const sepLine = docLines[sepLineIdx];
      if (!headerLine || !sepLine) continue;
      const header = parsePipeRow(headerLine.text, headerLine.start, headerLineIdx, false);
      const separator = parsePipeRow(sepLine.text, sepLine.start, sepLineIdx, false);
      if (!header || !isSeparatorRow(separator) || header.cells.length !== separator.cells.length) {
        continue;
      }
      const rows: ParsedTableRow[] = [];
      for (const rowNode of node.children.slice(1)) {
        if (!rowNode.position) continue;
        const rIdx = fmLineCount + rowNode.position.start.line - 1;
        const rLine = docLines[rIdx];
        if (!rLine) continue;
        const parsedRow = parsePipeRow(rLine.text, rLine.start, rIdx, true);
        if (parsedRow) rows.push(parsedRow);
      }
      const lastRow = rows.at(-1) ?? separator;
      tables.push({
        heading: headingStack.at(-1)?.title ?? "",
        headingStack: headingStack.map((h) => h.title),
        header,
        separator,
        rows,
        start: header.lineStart,
        end: lastRow.lineEnd,
      });
    }
  }

  return { headings, tables, nonRewritable };
}

function parseMarkdownTables(markdown: string): ParsedTable[] {
  return parseMarkdownStructure(markdown).tables;
}

function matchesHeaderColumn(headerCell: string, versionColumn: string): boolean {
  const cleanCell = stripInlineMd(unescapeCellPipes(headerCell));
  const cleanCol = stripInlineMd(unescapeCellPipes(versionColumn));
  if (cleanCell === cleanCol) return true;
  const escaped = cleanCol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-zA-Z0-9._-])${escaped}([^a-zA-Z0-9._-]|$)`).test(cleanCell);
}

function matchesCustomColumnHeader(headerCell: string, customHeader: string): boolean {
  const sanitized = sanitizeTableCellText(customHeader);
  if (unescapeCellPipes(headerCell).trim() === unescapeCellPipes(sanitized).trim()) return true;
  return stripInlineMd(unescapeCellPipes(headerCell)) === stripInlineMd(unescapeCellPipes(sanitized));
}

function filterTablesByExactHeading(tables: ParsedTable[], tableHeading?: string): ParsedTable[] {
  if (!tableHeading) return tables;
  const expected = normalizeHeadingTitle(tableHeading);
  const direct = tables.filter((t) => t.heading === expected);
  if (direct.length > 0) return direct;
  return tables.filter((t) => t.headingStack.includes(expected));
}

function matchesRowKey(firstCell: string, rowKey: string): boolean {
  return stripInlineMd(firstCell) === stripInlineMd(rowKey);
}

function sanitizeTableCellText(text: string): string {
  if (/[\r\n]/.test(text)) {
    throw new Error(
      `Invalid GFM table cell text: newline characters are not allowed (${JSON.stringify(text)})`,
    );
  }
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "\\" && i + 1 < text.length) {
      const next = text[i + 1]!;
      if (next === "|" || next === "\\") {
        out += ch + next;
        i++;
        continue;
      }
    }
    if (ch === "|") {
      out += "\\|";
    } else {
      out += ch;
    }
  }
  return out;
}

export function formatFactValueForCell(value: FactValue): string {
  const val = factValueSchema.parse(value);
  let raw: string;
  switch (val.kind) {
    case "default":
      raw = val.valueType ? `\`${val.expr}\` (${val.valueType})` : `\`${val.expr}\``;
      break;
    case "orderedGuards":
      raw = val.guards
        .map((g) => `${g.precondition ? `[${g.precondition}] ` : ""}${g.condition} → ${g.outcome}`)
        .join("；");
      break;
    case "sourceAnchor":
      raw = `\`${val.path}#L${val.lineStart}${val.lineEnd !== val.lineStart ? `-L${val.lineEnd}` : ""}\``;
      break;
    case "versionMatrixCell":
      raw =
        val.anchor && findAnchorMatches(val.summary, val.anchor).length === 0
          ? `${val.summary}（\`${val.anchor}\`）`
          : val.summary;
      break;
  }
  return sanitizeTableCellText(raw);
}

function findFrontmatterBounds(markdown: string): { start: number; end: number } | null {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) return null;
  const match = /\r?\n---(?:\r?\n|$)/.exec(markdown.slice(3));
  if (!match) return null;
  return { start: 0, end: 3 + match.index + match[0].length };
}

function stripYamlQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function stripUnquotedYamlComment(raw: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (quote) {
      if (ch === "\\" && quote === '"' && i + 1 < raw.length) i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "#" && (i === 0 || /[ \t]/.test(raw[i - 1]!))) {
      return raw.slice(0, i).trim();
    }
  }
  return raw.trim();
}

type VerifiedYamlBlock =
  | {
      kind: "inline";
      start: number;
      end: number;
      oldText: string;
      items: Array<{ raw: string; value: string }>;
      comment: string;
      eol: string;
    }
  | {
      kind: "block";
      start: number;
      end: number;
      keyLineEnd: number;
      items: Array<{ start: number; end: number; rawLine: string; indent: string; value: string }>;
      nl: string;
    };

function parseVerifiedBlock(markdown: string): VerifiedYamlBlock | null {
  const fm = findFrontmatterBounds(markdown);
  if (!fm) return null;
  const header = markdown.slice(fm.start, fm.end);
  const nl = header.includes("\r\n") ? "\r\n" : "\n";
  const rawLines = header.split(/(?<=\n)/);
  let offset = fm.start + (rawLines[0]?.length ?? 0);

  for (let i = 1; i < rawLines.length; i++) {
    const rawLine = rawLines[i]!;
    const lineStart = offset;
    offset += rawLine.length;
    const eolMatch = /\r?\n$/.exec(rawLine);
    const eol = eolMatch ? eolMatch[0] : "";
    const text = rawLine.slice(0, rawLine.length - eol.length);
    if (text === "---") break;

    const inlineMatch = /^verified:[ \t]*\[([^\r\n]*)\]([ \t]*(?:#[^\r\n]*)?)$/.exec(text);
    if (inlineMatch) {
      return {
        kind: "inline",
        start: lineStart,
        end: offset,
        oldText: rawLine,
        items: splitInlineYamlArray(inlineMatch[1]!),
        comment: inlineMatch[2] ?? "",
        eol,
      };
    }

    if (/^verified:[ \t]*(?:#[^\r\n]*)?$/.test(text)) {
      const items: Array<{ start: number; end: number; rawLine: string; indent: string; value: string }> = [];
      const keyLineEnd = offset;
      let blockEnd = offset;
      let scanOffset = offset;
      for (let j = i + 1; j < rawLines.length; j++) {
        const subRaw = rawLines[j]!;
        const subStart = scanOffset;
        scanOffset += subRaw.length;
        const subText = subRaw.replace(/\r?\n$/, "");
        if (subText === "---") break;
        const itemMatch = /^([ \t]*)-[ \t]+(.+?)[ \t]*$/.exec(subText);
        if (itemMatch) {
          const val = stripYamlQuotes(stripUnquotedYamlComment(itemMatch[2]!));
          items.push({
            start: subStart,
            end: scanOffset,
            rawLine: subRaw,
            indent: itemMatch[1]!,
            value: val,
          });
          blockEnd = scanOffset;
          continue;
        }
        if (/^[ \t]*(?:#.*)?$/.test(subText)) continue;
        break;
      }
      return { kind: "block", start: lineStart, end: blockEnd, keyLineEnd, items, nl };
    }
  }
  return null;
}

function readFrontmatterVerified(markdown: string): string[] {
  const block = parseVerifiedBlock(markdown);
  if (!block) return [];
  return block.items.map((it) => it.value);
}

interface FrontmatterSourceItemSpan {
  start: number;
  end: number;
  rawValue: string;
  decodedValue: string;
}

function parseFrontmatterSources(markdown: string): {
  hasSourcesSeq: boolean;
  items: FrontmatterSourceItemSpan[];
} {
  const fm = findFrontmatterBounds(markdown);
  if (!fm) return { hasSourcesSeq: false, items: [] };
  const header = markdown.slice(fm.start, fm.end);
  const openMatch = /^---\r?\n/.exec(header);
  const closeMatch = /\r?\n---(?:\r?\n|$)$/.exec(header);
  if (!openMatch || !closeMatch) return { hasSourcesSeq: false, items: [] };
  const yamlBase = fm.start + openMatch[0].length;
  const yamlSlice = header.slice(openMatch[0].length, closeMatch.index);
  const doc = parseDocument(yamlSlice);
  if (!isMap(doc.contents)) return { hasSourcesSeq: false, items: [] };
  const sourcesNode = doc.contents.get("sources", true);
  if (!isSeq(sourcesNode)) return { hasSourcesSeq: false, items: [] };
  const items: FrontmatterSourceItemSpan[] = [];
  for (const item of sourcesNode.items) {
    if (!isScalar(item) || typeof item.value !== "string" || !item.range) continue;
    let s = yamlBase + item.range[0];
    let e = yamlBase + item.range[1];
    if (
      e - s >= 2 &&
      ((markdown[s] === "'" && markdown[e - 1] === "'") || (markdown[s] === '"' && markdown[e - 1] === '"'))
    ) {
      s += 1;
      e -= 1;
    }
    if (e > s) {
      items.push({
        start: s,
        end: e,
        rawValue: markdown.slice(s, e),
        decodedValue: String(item.value),
      });
    }
  }
  return { hasSourcesSeq: true, items };
}

function verifyFrontmatterYamlEdit(markdown: string, edit: SpanEdit): SpanEdit {
  const fm = findFrontmatterBounds(markdown);
  if (fm) {
    const candidateHeader =
      markdown.slice(fm.start, edit.start) + edit.newText + markdown.slice(edit.end, fm.end);
    const parsed = matter(candidateHeader);
    if (!Array.isArray(parsed.data.verified)) {
      throw new Error("Invalid frontmatter verified edit: expected YAML array after edit");
    }
  }
  return edit;
}

function splitInlineYamlArray(inner: string): Array<{ raw: string; value: string }> {
  if (!inner.trim()) return [];
  const items: Array<{ raw: string; value: string }> = [];
  let start = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i <= inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      if (ch === "\\" && quote === '"' && i + 1 < inner.length) {
        i++;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "," || i === inner.length) {
      const raw = inner.slice(start, i).trim();
      if (raw) items.push({ raw, value: stripYamlQuotes(raw) });
      start = i + 1;
    }
  }
  return items;
}

function findVerifiedInsertEdit(markdown: string, verifiedTag: string): SpanEdit | null {
  const block = parseVerifiedBlock(markdown);
  if (!block) return null;
  if (block.items.some((it) => it.value === verifiedTag)) return null;

  if (block.kind === "inline") {
    const useQuotes = block.items.some((it) => it.raw.startsWith('"') || it.raw.startsWith("'"));
    const nextItem = useQuotes ? JSON.stringify(verifiedTag) : verifiedTag;
    const newText = `verified: [${[...block.items.map((it) => it.raw), nextItem].join(", ")}]${block.comment}${block.eol}`;
    return verifyFrontmatterYamlEdit(markdown, {
      start: block.start,
      end: block.end,
      oldText: block.oldText,
      newText,
      reason: "frontmatter-verified",
    });
  }

  const indent = block.items[0]?.indent ?? "  ";
  const insertAt = block.end;
  return verifyFrontmatterYamlEdit(markdown, {
    start: insertAt,
    end: insertAt,
    oldText: "",
    newText: `${indent}- ${verifiedTag}${block.nl}`,
    reason: "frontmatter-verified",
  });
}

function findVerifiedRemoveEdit(markdown: string, verifiedTag: string): SpanEdit | null {
  const block = parseVerifiedBlock(markdown);
  if (!block) return null;

  if (block.kind === "inline") {
    const remaining = block.items.filter((it) => it.value !== verifiedTag);
    if (remaining.length === block.items.length) return null;
    const newText = `verified: [${remaining.map((it) => it.raw).join(", ")}]${block.comment}${block.eol}`;
    return verifyFrontmatterYamlEdit(markdown, {
      start: block.start,
      end: block.end,
      oldText: block.oldText,
      newText,
      reason: "frontmatter-unverify",
    });
  }

  const matching = block.items.filter((it) => it.value === verifiedTag);
  if (matching.length === 0) return null;

  if (matching.length === block.items.length) {
    return verifyFrontmatterYamlEdit(markdown, {
      start: block.start,
      end: block.end,
      oldText: markdown.slice(block.start, block.end),
      newText: `verified: []${block.nl}`,
      reason: "frontmatter-unverify",
    });
  }
  if (matching.length === 1) {
    const target = matching[0]!;
    return verifyFrontmatterYamlEdit(markdown, {
      start: target.start,
      end: target.end,
      oldText: target.rawLine,
      newText: "",
      reason: "frontmatter-unverify",
    });
  }
  const keptLines = block.items.filter((it) => it.value !== verifiedTag).map((it) => it.rawLine);
  return verifyFrontmatterYamlEdit(markdown, {
    start: block.start,
    end: block.end,
    oldText: markdown.slice(block.start, block.end),
    newText: `${markdown.slice(block.start, block.keyLineEnd)}${keptLines.join("")}`,
    reason: "frontmatter-unverify",
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAnchorMatches(text: string, ref: string): Array<{ start: number; end: number }> {
  if (!ref) return [];
  const escaped = escapeRegExp(ref);
  const isRangeAnchor = /#L\d+-L\d+$/.test(ref);
  const isSingleAnchor = !isRangeAnchor && /#L\d+$/.test(ref);
  const leftGuard = ref.startsWith("#") ? "" : "(?<![A-Za-z0-9_./@-])";
  const rightGuard = isRangeAnchor ? "(?![0-9])" : isSingleAnchor ? "(?![0-9-])" : "";
  const re = new RegExp(`${leftGuard}${escaped}${rightGuard}`, "g");
  const matches: Array<{ start: number; end: number }> = [];
  for (const m of text.matchAll(re)) {
    if (m.index !== undefined) {
      matches.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  return matches;
}

interface ParsedFullSourceRef {
  repo: string;
  commit: string;
  path: string;
  anchor: string;
}

interface RepoSourceToken {
  start: number;
  end: number;
  kind: "repo-ref" | "github-url";
  urlPrefix?: string | undefined;
  repo: string;
  commit: string;
  path: string;
  anchor?: string | undefined;
}

const GITHUB_SLUG_TO_REPO_ID = new Map<string, string>(
  Object.entries(REPO_GITHUB).map(([repoId, slug]) => [slug.toLowerCase(), repoId]),
);

function mapGitHubOwnerRepoToRepoId(owner: string, repoName: string): string {
  const slug = `${owner}/${repoName}`.toLowerCase();
  return GITHUB_SLUG_TO_REPO_ID.get(slug) ?? `${owner}/${repoName}`;
}

const FULL_SOURCE_REF_SINGLE_RE =
  /^([A-Za-z0-9_.-]+)@([0-9a-fA-F]{7,40}):([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)$/;
const GITHUB_FULL_SOURCE_REF_SINGLE_RE =
  /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(?:blob|tree)\/([0-9a-fA-F]{7,40})\/([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)$/;
const ALL_REPO_SOURCE_SCAN_RE =
  /(?<![A-Za-z0-9_./@-])([A-Za-z0-9_.-]+)@([0-9a-fA-F]{7,40}):([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)?(?![A-Za-z0-9_./#-])/g;
const GITHUB_BLOB_URL_SCAN_RE =
  /(https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(?:blob|tree))\/([0-9a-fA-F]{7,40})\/([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)?(?![A-Za-z0-9_./#-])/g;

function parseFullSourceRef(ref: string): ParsedFullSourceRef | null {
  const trimmed = ref.trim();
  const m = FULL_SOURCE_REF_SINGLE_RE.exec(trimmed);
  if (m) return { repo: m[1]!, commit: m[2]!, path: m[3]!, anchor: m[4]! };
  const gm = GITHUB_FULL_SOURCE_REF_SINGLE_RE.exec(trimmed);
  if (gm) {
    return {
      repo: mapGitHubOwnerRepoToRepoId(gm[1]!, gm[2]!),
      commit: gm[3]!,
      path: gm[4]!,
      anchor: gm[5]!,
    };
  }
  return null;
}

function findAllRepoSourceTokens(text: string): RepoSourceToken[] {
  const tokens: RepoSourceToken[] = [];
  for (const m of text.matchAll(ALL_REPO_SOURCE_SCAN_RE)) {
    if (m.index !== undefined) {
      tokens.push({
        start: m.index,
        end: m.index + m[0].length,
        kind: "repo-ref",
        repo: m[1]!,
        commit: m[2]!,
        path: m[3]!,
        anchor: m[4] || undefined,
      });
    }
  }
  for (const gm of text.matchAll(GITHUB_BLOB_URL_SCAN_RE)) {
    if (gm.index !== undefined) {
      tokens.push({
        start: gm.index,
        end: gm.index + gm[0].length,
        kind: "github-url",
        urlPrefix: gm[1]!,
        repo: mapGitHubOwnerRepoToRepoId(gm[2]!, gm[3]!),
        commit: gm[4]!,
        path: gm[5]!,
        anchor: gm[6] || undefined,
      });
    }
  }
  tokens.sort((a, b) => a.start - b.start || a.end - b.end);
  return tokens;
}

function formatRepoSourceToken(
  tok: RepoSourceToken,
  nextRepo: string,
  nextCommit: string,
  nextPath: string,
  nextAnchor?: string,
): string {
  if (tok.kind === "github-url" && tok.urlPrefix) {
    return `${tok.urlPrefix}/${nextCommit}/${nextPath}${nextAnchor ?? ""}`;
  }
  return `${nextRepo}@${nextCommit}:${nextPath}${nextAnchor ?? ""}`;
}

function commitsMatch(a: string, b: string): boolean {
  const la = a.trim().toLowerCase();
  const lb = b.trim().toLowerCase();
  if (!la || !lb) return false;
  return la === lb || la.startsWith(lb) || lb.startsWith(la);
}

function exactPathsEqual(tokenPath: string, expectedPath: string): boolean {
  const normToken = tokenPath.replace(/\\/g, "/").trim();
  const normExpected = expectedPath.replace(/\\/g, "/").trim();
  return Boolean(normToken && normExpected && normToken === normExpected);
}

function matchesCellPath(tokenPath: string, expectedPath: string, allowBasenameShorthand: boolean): boolean {
  if (exactPathsEqual(tokenPath, expectedPath)) return true;
  if (!allowBasenameShorthand) return false;
  const normToken = tokenPath.replace(/\\/g, "/").trim();
  const normExpected = expectedPath.replace(/\\/g, "/").trim();
  if (!normToken || !normExpected || normToken.includes("/")) return false;
  return normExpected.endsWith(`/${normToken}`);
}

function extractUnifiedRefPaths(text: string): Array<{ path: string; commitQualified: boolean }> {
  const out: Array<{ path: string; commitQualified: boolean }> = [];
  const covered: Array<{ start: number; end: number }> = [];
  for (const tok of findAllRepoSourceTokens(text)) {
    out.push({ path: tok.path.replace(/\\/g, "/").trim(), commitQualified: true });
    covered.push({ start: tok.start, end: tok.end });
  }
  for (const bm of text.matchAll(/\b(?:blob|tree)\/[0-9a-fA-F]{7,40}\/([A-Za-z0-9_./-]+)#L\d+/g)) {
    const start = bm.index ?? 0;
    const end = start + bm[0].length;
    if (covered.some((c) => start < c.end && end > c.start)) continue;
    out.push({ path: bm[1]!.replace(/\\/g, "/").trim(), commitQualified: true });
    covered.push({ start, end });
  }
  for (const cm of text.matchAll(/(?<![A-Za-z0-9_./@-])[0-9a-fA-F]{7,40}:([A-Za-z0-9_./-]+)#L\d+/g)) {
    const start = cm.index ?? 0;
    const end = start + cm[0].length;
    if (covered.some((c) => start < c.end && end > c.start)) continue;
    out.push({ path: cm[1]!.replace(/\\/g, "/").trim(), commitQualified: true });
    covered.push({ start, end });
  }
  for (const m of text.matchAll(/(?<![A-Za-z0-9_./:@-])([A-Za-z0-9_./-]+)#L\d+/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (covered.some((c) => start < c.end && end > c.start)) continue;
    out.push({ path: m[1]!.replace(/\\/g, "/").trim(), commitQualified: false });
  }
  return out;
}

function hasAmbiguousBasenameInDoc(markdown: string, expectedPath: string, tableSlice = ""): boolean {
  const normExpected = expectedPath.replace(/\\/g, "/").trim();
  const slashIdx = normExpected.lastIndexOf("/");
  if (slashIdx < 0) return false;
  const basename = normExpected.slice(slashIdx + 1);
  if (!basename) return false;

  const docRefs = extractUnifiedRefPaths(markdown);
  let sawBareBasenameInDoc = false;
  let sawBareExpectedInDoc = false;
  for (const ref of docRefs) {
    if (ref.path !== normExpected && ref.path.endsWith(`/${basename}`)) return true;
    if (ref.commitQualified && ref.path === basename) return true;
    if (!ref.commitQualified && ref.path === basename) sawBareBasenameInDoc = true;
    if (!ref.commitQualified && ref.path === normExpected) sawBareExpectedInDoc = true;
  }
  if (sawBareBasenameInDoc && sawBareExpectedInDoc) return true;

  if (tableSlice) {
    const tableRefs = extractUnifiedRefPaths(tableSlice);
    const hasBareBaseInTable = tableRefs.some((r) => !r.commitQualified && r.path === basename);
    const hasExplicitExpectedInTable = tableRefs.some((r) => r.path === normExpected);
    if (hasBareBaseInTable && hasExplicitExpectedInTable) return true;
  }

  return false;
}

function findInlineMathSpansInText(line: string, lineStart = 0): Array<{ start: number; end: number }> {
  const mathSpans: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "\\") {
      i += 2;
      continue;
    }
    if (line[i] === "`") {
      let tickLen = 1;
      while (i + tickLen < line.length && line[i + tickLen] === "`") tickLen++;
      const ticks = "`".repeat(tickLen);
      const closeIdx = line.indexOf(ticks, i + tickLen);
      if (closeIdx >= 0) {
        i = closeIdx + tickLen;
        continue;
      }
      i += tickLen;
      continue;
    }
    if (line[i] === "$" && line[i + 1] === "$") {
      const closeIdx = line.indexOf("$$", i + 2);
      if (closeIdx >= 0) {
        mathSpans.push({ start: lineStart + i, end: lineStart + closeIdx + 2 });
        i = closeIdx + 2;
        continue;
      }
      i += 2;
      continue;
    }
    if (line[i] === "$" && i + 1 < line.length && !/\s/.test(line[i + 1]!)) {
      let j = i + 1;
      let foundClose = -1;
      while (j < line.length) {
        if (line[j] === "\\") {
          j += 2;
          continue;
        }
        if (line[j] === "$" && !/\s/.test(line[j - 1]!) && !/[0-9$]/.test(line[j + 1] ?? "")) {
          foundClose = j;
          break;
        }
        j++;
      }
      if (foundClose >= 0) {
        mathSpans.push({ start: lineStart + i, end: lineStart + foundClose + 1 });
        i = foundClose + 1;
        continue;
      }
    }
    i++;
  }
  return mathSpans;
}

/**
 * Extract byte/char ranges of all Markdown blocks/spans where source anchors must never be rewritten:
 * fenced code blocks (` ``` ` / `~~~`, including `calc` / `wiki-diagram` / `wiki-scene` & blockquote fences),
 * indented code blocks, `:::calc` directives, `$$...$$` display math, and `$...$` inline math (outside inline code).
 */
function extractNonRewritableSpans(markdown: string): Array<{ start: number; end: number }> {
  const rawLines = markdown.split(/(?<=\n)/);
  const spans: Array<{ start: number; end: number }> = [];
  let offset = 0;
  let inFrontmatter = false;
  let activeFence = "";
  let activeQuoteDepth = 0;
  let blockStart = -1;
  let inMathBlock = false;
  let inCalcDirective = false;
  let directiveStart = -1;
  let directiveInnerFence = "";
  let inIndentedCode = false;
  let prevBlankOrBoundary = true;

  const extractInlineMathInLine = (line: string, lineStart: number) => {
    spans.push(...findInlineMathSpansInText(line, lineStart));
  };

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    const lineStart = offset;
    offset += raw.length;
    const text = raw.replace(/\r?\n$/, "");

    if (i === 0 && text === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (text === "---") {
        inFrontmatter = false;
        prevBlankOrBoundary = true;
      }
      continue;
    }

    const { quoteDepth, rest } = parseBlockquotePrefix(text);
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(rest);

    if (inCalcDirective) {
      if (directiveInnerFence) {
        if (
          marker &&
          marker[1]![0] === directiveInnerFence[0] &&
          marker[1]!.length >= directiveInnerFence.length &&
          !marker[2]!.trim()
        ) {
          directiveInnerFence = "";
        }
        continue;
      }
      if (marker && !(marker[1]![0] === "`" && marker[2]!.includes("`"))) {
        directiveInnerFence = marker[1]!;
        continue;
      }
      if (/^ {0,3}:::[ \t]*$/.test(rest)) {
        spans.push({ start: directiveStart, end: offset });
        inCalcDirective = false;
        directiveStart = -1;
        prevBlankOrBoundary = true;
      }
      continue;
    }

    if (activeFence) {
      if (quoteDepth > activeQuoteDepth) continue;
      if (quoteDepth < activeQuoteDepth) {
        spans.push({ start: blockStart, end: lineStart });
        activeFence = "";
        activeQuoteDepth = 0;
        blockStart = -1;
        prevBlankOrBoundary = true;
      } else {
        if (
          marker &&
          marker[1]![0] === activeFence[0] &&
          marker[1]!.length >= activeFence.length &&
          !marker[2]!.trim()
        ) {
          spans.push({ start: blockStart, end: offset });
          activeFence = "";
          activeQuoteDepth = 0;
          blockStart = -1;
          prevBlankOrBoundary = true;
        }
        continue;
      }
    }

    if (marker && !(marker[1]![0] === "`" && marker[2]!.includes("`"))) {
      if (inIndentedCode && blockStart >= 0) {
        spans.push({ start: blockStart, end: lineStart });
        inIndentedCode = false;
      }
      activeFence = marker[1]!;
      activeQuoteDepth = quoteDepth;
      blockStart = lineStart;
      continue;
    }

    if (/^ {0,3}:::[ \t]*[A-Za-z0-9_-]+/.test(rest)) {
      if (inIndentedCode && blockStart >= 0) {
        spans.push({ start: blockStart, end: lineStart });
        inIndentedCode = false;
        blockStart = -1;
      }
      inCalcDirective = true;
      directiveStart = lineStart;
      directiveInnerFence = "";
      continue;
    }

    if (inMathBlock) {
      if (/\$\$[ \t]*$/.test(rest)) {
        spans.push({ start: blockStart, end: offset });
        inMathBlock = false;
        blockStart = -1;
        prevBlankOrBoundary = true;
      }
      continue;
    }

    if (/^ {0,3}\$\$/.test(rest)) {
      if (inIndentedCode && blockStart >= 0) {
        spans.push({ start: blockStart, end: lineStart });
        inIndentedCode = false;
      }
      const afterOpen = rest.replace(/^ {0,3}\$\$/, "");
      if (/\$\$[ \t]*$/.test(afterOpen)) {
        spans.push({ start: lineStart, end: offset });
      } else {
        inMathBlock = true;
        blockStart = lineStart;
      }
      prevBlankOrBoundary = true;
      continue;
    }

    if (/^[ \t]*$/.test(text)) {
      prevBlankOrBoundary = true;
      continue;
    }

    if (quoteDepth === 0 && /^(?: {4,}|\t)/.test(text)) {
      if (inIndentedCode) continue;
      if (prevBlankOrBoundary) {
        inIndentedCode = true;
        blockStart = lineStart;
        continue;
      }
    } else if (inIndentedCode && blockStart >= 0) {
      spans.push({ start: blockStart, end: lineStart });
      inIndentedCode = false;
      blockStart = -1;
    }

    prevBlankOrBoundary = /^ {0,3}#{1,6}[ \t]+/.test(text);
    extractInlineMathInLine(text, lineStart);
  }

  if (inCalcDirective && directiveStart >= 0) {
    spans.push({ start: directiveStart, end: markdown.length });
  } else if ((activeFence || inMathBlock || inIndentedCode) && blockStart >= 0) {
    spans.push({ start: blockStart, end: markdown.length });
  }
  return spans;
}

function extractBarePathAt(
  text: string,
  anchorStart: number,
): { tokenStart: number; pathToken: string } | null {
  let prefixStart = anchorStart;
  while (prefixStart > 0 && /[A-Za-z0-9_./:@-]/.test(text[prefixStart - 1]!)) {
    prefixStart--;
  }
  const rawPrefix = text.slice(prefixStart, anchorStart);
  if (rawPrefix.includes("@") && rawPrefix.includes(":")) return null;
  const colonIdx = rawPrefix.lastIndexOf(":");
  const tokenStart = colonIdx >= 0 ? prefixStart + colonIdx + 1 : prefixStart;
  const pathToken = text.slice(tokenStart, anchorStart).replace(/\\/g, "/");
  if (!pathToken) return null;
  return { tokenStart, pathToken };
}

interface SourceRefRewriteContext {
  repo: string;
  oldCommit: string;
  newCommit: string;
  oldPath: string;
  newPath: string;
  oldAnchor?: string | undefined;
  newAnchor?: string | undefined;
  targetColumnRanges: Array<{ start: number; end: number }>;
  otherTableRanges: Array<{ start: number; end: number }>;
}

function findSourceRefEdits(
  markdown: string,
  oldRef: string,
  newRef: string,
  existingSpans: AllowedSpan[],
  ctx: SourceRefRewriteContext,
): SpanEdit[] {
  if (!oldRef) return [];
  const parsedOld = parseFullSourceRef(oldRef);
  const parsedNew = parseFullSourceRef(newRef);
  const isBareAnchor = oldRef.startsWith("#");
  const wantOldAnchor = parsedOld?.anchor ?? (isBareAnchor ? oldRef : ctx.oldAnchor);
  const wantNewAnchor = parsedNew?.anchor ?? (newRef.startsWith("#") ? newRef : ctx.newAnchor);
  const wantRepo = parsedOld?.repo ?? ctx.repo;
  const wantOldCommit = parsedOld?.commit ?? ctx.oldCommit;
  const wantNewCommit = parsedNew?.commit ?? ctx.newCommit;
  const wantOldPath = parsedOld?.path ?? ctx.oldPath;
  const wantNewPath = parsedNew?.path ?? ctx.newPath;

  if (
    oldRef === newRef &&
    commitsMatch(wantOldCommit, wantNewCommit) &&
    exactPathsEqual(wantOldPath, wantNewPath)
  ) {
    return [];
  }

  const edits: SpanEdit[] = [];
  const fm = findFrontmatterBounds(markdown);
  const fmSources = parseFrontmatterSources(markdown);
  const fmSourceSpans = fmSources.items;
  const isOutsideFrontmatter = (start: number, end: number) => !fm || end <= fm.start || start >= fm.end;
  const isAllowedInFrontmatter = (start: number, end: number) =>
    isOutsideFrontmatter(start, end) || fmSourceSpans.some((s) => start >= s.start && end <= s.end);
  const nonRewritable = [
    ...extractProtectedFences(markdown).map((f) => ({ start: f.start, end: f.end })),
    ...extractNonRewritableSpans(markdown),
  ];
  const isBlocked = (start: number, end: number) =>
    existingSpans.some((s) => start < s.end && end > s.start) ||
    nonRewritable.some((s) => start < s.end && end > s.start) ||
    edits.some((e) => start < e.end && end > e.start);

  // Pass 1a (Body): Match full `repo@commit:path#Lstart-Lend` and GitHub `blob/<commit>/<path>#L...` tokens outside frontmatter.
  if (wantOldAnchor && wantNewAnchor && wantOldPath.trim()) {
    for (const tok of findAllRepoSourceTokens(markdown)) {
      if (!tok.anchor) continue;
      if (!isOutsideFrontmatter(tok.start, tok.end)) continue;
      if (tok.repo !== wantRepo) continue;
      if (!commitsMatch(tok.commit, wantOldCommit)) continue;
      if (!exactPathsEqual(tok.path, wantOldPath)) continue;
      if (tok.anchor !== wantOldAnchor) continue;
      if (ctx.otherTableRanges.some((r) => tok.start < r.end && tok.end > r.start)) continue;
      if (isBlocked(tok.start, tok.end)) continue;
      const nextPath = !exactPathsEqual(wantOldPath, wantNewPath) ? wantNewPath : tok.path;
      const replacement = formatRepoSourceToken(
        tok,
        parsedNew?.repo ?? tok.repo,
        wantNewCommit,
        nextPath,
        wantNewAnchor,
      );
      if (replacement !== markdown.slice(tok.start, tok.end)) {
        edits.push({
          start: tok.start,
          end: tok.end,
          oldText: markdown.slice(tok.start, tok.end),
          newText: replacement,
          reason: "source-ref",
        });
      }
    }
  }

  // Pass 1b (Frontmatter YAML `sources:`): Match both `#L`-anchored and file-level tokens on decoded YAML scalars (handling `\u0023` etc.).
  if (fmSourceSpans.length > 0 && wantOldPath.trim()) {
    for (const sp of fmSourceSpans) {
      const matchingTokens = findAllRepoSourceTokens(sp.decodedValue).filter((tok) => {
        if (tok.repo !== wantRepo) return false;
        if (!commitsMatch(tok.commit, wantOldCommit)) return false;
        if (!exactPathsEqual(tok.path, wantOldPath)) return false;
        if (tok.anchor) {
          return Boolean(wantOldAnchor && wantNewAnchor && tok.anchor === wantOldAnchor);
        }
        return true;
      });
      if (matchingTokens.length === 0) continue;

      if (sp.rawValue === sp.decodedValue) {
        for (const tok of matchingTokens) {
          const absStart = sp.start + tok.start;
          const absEnd = sp.start + tok.end;
          if (isBlocked(absStart, absEnd)) continue;
          const nextPath = !exactPathsEqual(wantOldPath, wantNewPath) ? wantNewPath : tok.path;
          const replacement = formatRepoSourceToken(
            tok,
            parsedNew?.repo ?? tok.repo,
            wantNewCommit,
            nextPath,
            tok.anchor ? wantNewAnchor : undefined,
          );
          if (replacement !== markdown.slice(absStart, absEnd)) {
            edits.push({
              start: absStart,
              end: absEnd,
              oldText: markdown.slice(absStart, absEnd),
              newText: replacement,
              reason: "source-ref",
            });
          }
        }
      } else if (!isBlocked(sp.start, sp.end)) {
        let nextDecoded = sp.decodedValue;
        for (let i = matchingTokens.length - 1; i >= 0; i--) {
          const tok = matchingTokens[i]!;
          const nextPath = !exactPathsEqual(wantOldPath, wantNewPath) ? wantNewPath : tok.path;
          const replacement = formatRepoSourceToken(
            tok,
            parsedNew?.repo ?? tok.repo,
            wantNewCommit,
            nextPath,
            tok.anchor ? wantNewAnchor : undefined,
          );
          nextDecoded = nextDecoded.slice(0, tok.start) + replacement + nextDecoded.slice(tok.end);
        }
        const quoteChar = sp.start > 0 ? markdown[sp.start - 1] : "";
        const safeScalarText =
          quoteChar === '"'
            ? JSON.stringify(nextDecoded).slice(1, -1)
            : quoteChar === "'"
              ? nextDecoded.replace(/'/g, "''")
              : nextDecoded;
        if (safeScalarText !== sp.rawValue) {
          edits.push({
            start: sp.start,
            end: sp.end,
            oldText: sp.rawValue,
            newText: safeScalarText,
            reason: "source-ref",
          });
        }
      }
    }
  }

  // If oldRef is a non-bare, non-full custom string ref, match exact non-blocked occurrences outside other table columns.
  if (!parsedOld && !isBareAnchor) {
    if (oldRef === newRef) return edits;
    const allRepoTokens = findAllRepoSourceTokens(markdown);
    for (const { start, end } of findAnchorMatches(markdown, oldRef)) {
      if (!isAllowedInFrontmatter(start, end)) continue;
      if (allRepoTokens.some((t) => start < t.end && end > t.start)) continue;
      if (ctx.otherTableRanges.some((r) => start < r.end && end > r.start)) continue;
      if (isBlocked(start, end)) continue;
      edits.push({
        start,
        end,
        oldText: markdown.slice(start, end),
        newText: newRef,
        reason: "source-ref",
      });
    }
    return edits;
  }

  // Pass 2: Scoped bare `<exactPath>#L...` replacements ONLY within the target version column.
  const pathChanged = Boolean(wantNewPath.trim()) && !exactPathsEqual(wantOldPath, wantNewPath);
  if (
    (isBareAnchor || parsedOld) &&
    wantOldPath.trim() &&
    wantOldAnchor &&
    wantNewAnchor &&
    (wantOldAnchor !== wantNewAnchor || pathChanged)
  ) {
    const safeNewAnchor = sanitizeTableCellText(wantNewAnchor);
    const safeNewFullBare = sanitizeTableCellText(`${wantNewPath}${wantNewAnchor}`);
    for (const range of ctx.targetColumnRanges) {
      const slice = markdown.slice(range.start, range.end);
      const cellMath = findInlineMathSpansInText(slice, 0);
      for (const m of findAnchorMatches(slice, wantOldAnchor)) {
        if (cellMath.some((ms) => m.start < ms.end && m.end > ms.start)) continue;
        const bare = extractBarePathAt(slice, m.start);
        if (!bare || !exactPathsEqual(bare.pathToken, wantOldPath)) continue;
        const absStart = range.start + (pathChanged ? bare.tokenStart : m.start);
        const absEnd = range.start + m.end;
        const replacement = pathChanged ? safeNewFullBare : safeNewAnchor;
        if (isBlocked(absStart, absEnd) || markdown.slice(absStart, absEnd) === replacement) continue;
        edits.push({
          start: absStart,
          end: absEnd,
          oldText: markdown.slice(absStart, absEnd),
          newText: replacement,
          reason: "source-ref",
        });
      }
    }
  }

  return edits;
}

function lineNumberAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

function factValueSearchableText(val: FactValue): string {
  switch (val.kind) {
    case "default":
      return `${val.expr} ${val.valueType ?? ""}`.toLowerCase();
    case "versionMatrixCell":
      return `${val.status} ${val.summary} ${val.anchor ?? ""}`.toLowerCase();
    case "orderedGuards":
      return val.guards
        .map((g) => `${g.precondition ?? ""} ${g.condition} ${g.outcome}`)
        .join(" ")
        .toLowerCase();
    case "sourceAnchor":
      return `${val.repo}@${val.commit}:${val.path}#L${val.lineStart}-L${val.lineEnd}`.toLowerCase();
  }
}

const NARRATIVE_POSITIVE_TERMS = [
  "on",
  "true",
  "enabled",
  "enable",
  "yes",
  "allow",
  "allowed",
  "supported",
  "开启",
  "启用",
  "默认开启",
  "支持",
  "允许",
] as const;

const NARRATIVE_NEGATIVE_TERMS = [
  "off",
  "false",
  "disabled",
  "disable",
  "no",
  "deny",
  "denied",
  "unsupported",
  "关闭",
  "禁用",
  "默认关闭",
  "不支持",
  "拒绝",
] as const;

function containsSemanticTerm(text: string, term: string): boolean {
  if (/^[a-z0-9_]+$/i.test(term)) {
    return new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(term)}(?![A-Za-z0-9_])`, "i").test(text);
  }
  if (term === "支持" || term === "开启" || term === "启用" || term === "允许") {
    return new RegExp(`(?<![不未禁])${escapeRegExp(term)}`).test(text);
  }
  return text.toLowerCase().includes(term.toLowerCase());
}

function textPolarity(text: string): { pos: boolean; neg: boolean } {
  return {
    pos: NARRATIVE_POSITIVE_TERMS.some((t) => containsSemanticTerm(text, t)),
    neg: NARRATIVE_NEGATIVE_TERMS.some((t) => containsSemanticTerm(text, t)),
  };
}

function extractDeclaredLiteral(quote: string): string | null {
  const m = /(?:default(?:s\s+to|\s+is)?|默认为|默认是|设为)\s*[`"'“]?([A-Za-z0-9_.-]+)[`"'”]?/i.exec(quote);
  return m ? m[1]!.toLowerCase() : null;
}

function extractTargetLiteral(text: string): string | null {
  const cleaned = stripInlineMd(text).trim();
  const eqMatch = /=\s*[`"']?([A-Za-z0-9_.-]+)[`"']?/.exec(cleaned);
  if (eqMatch) return eqMatch[1]!.toLowerCase();
  const single = /^[`"']?([A-Za-z0-9_.-]+)[`"']?(?:\s*\([^)]+\))?$/.exec(cleaned);
  return single ? single[1]!.toLowerCase() : null;
}

function quoteMatchesCurrentText(guard: NarrativeGuard, currentText: string): boolean {
  if (guard.expectedValue) {
    const expected = normCodeExpr(guard.expectedValue).toLowerCase();
    const actualNorm = normCodeExpr(stripInlineMd(currentText)).toLowerCase();
    return actualNorm === expected || containsSemanticTerm(currentText, expected);
  }
  const curPol = textPolarity(currentText);
  const qPol = textPolarity(guard.anchorQuote);
  if (
    (curPol.pos && !curPol.neg && qPol.pos && !qPol.neg) ||
    (curPol.neg && !curPol.pos && qPol.neg && !qPol.pos)
  ) {
    return true;
  }
  const declared = extractDeclaredLiteral(guard.anchorQuote);
  const targetLit = extractTargetLiteral(currentText);
  return Boolean(declared && targetLit && declared === targetLit);
}

interface GuardConflictOptions {
  diffKind?: FactDiffKind;
  certifyingUnverifiedTarget?: boolean;
  isSourceAnchorOnly?: boolean;
}

function guardContradictsText(
  guard: NarrativeGuard,
  currentText: string,
  options: GuardConflictOptions = {},
): boolean {
  const lowerCurrent = currentText.toLowerCase();
  if (guard.contradictsValues && guard.contradictsValues.length > 0) {
    if (guard.contradictsValues.some((needle) => lowerCurrent.includes(needle.toLowerCase()))) return true;
    if (
      options.certifyingUnverifiedTarget &&
      !options.isSourceAnchorOnly &&
      !quoteMatchesCurrentText(guard, currentText)
    ) {
      return true;
    }
    return false;
  }
  if (options.diffKind === "value-changed" || options.diffKind === "guard-inverted") return true;
  if (guard.expectedValue) {
    const expected = normCodeExpr(guard.expectedValue).toLowerCase();
    const actualNorm = normCodeExpr(stripInlineMd(currentText)).toLowerCase();
    if (actualNorm !== expected && !containsSemanticTerm(currentText, expected)) return true;
  }
  const curPol = textPolarity(currentText);
  const qPol = textPolarity(guard.anchorQuote);
  if (
    (curPol.pos && !curPol.neg && qPol.neg && !qPol.pos) ||
    (curPol.neg && !curPol.pos && qPol.pos && !qPol.neg)
  ) {
    return true;
  }
  const declared = extractDeclaredLiteral(guard.anchorQuote);
  const targetLit = extractTargetLiteral(currentText);
  if (
    declared &&
    targetLit &&
    declared !== targetLit &&
    !containsSemanticTerm(guard.anchorQuote, targetLit)
  ) {
    return true;
  }
  if (
    options.certifyingUnverifiedTarget &&
    !options.isSourceAnchorOnly &&
    !quoteMatchesCurrentText(guard, currentText)
  ) {
    return true;
  }
  return false;
}

function findNarrativeGuardConflictsForText(
  markdown: string,
  binding: FactBinding,
  currentText: string,
  reasonLabel: string,
  options: GuardConflictOptions = {},
): NarrativeConflict[] {
  if (binding.narrativeGuards.length === 0) return [];
  const fm = findFrontmatterBounds(markdown);
  const bodyStart = fm ? fm.end : 0;
  const { headings: realHeadings, nonRewritable } = parseMarkdownStructure(markdown);
  const isInNonRewritableLine = (lineStart: number, lineEnd: number) =>
    nonRewritable.some((s) => s.start <= lineStart && s.end >= lineEnd);

  const sourceHeading = realHeadings.find((h) => h.level === 2 && h.title === "对照源码");
  const narrativeEnd = sourceHeading ? sourceHeading.lineStart : markdown.length;
  const conflicts: NarrativeConflict[] = [];

  for (const guard of binding.narrativeGuards) {
    const searchWindows: Array<{ start: number; end: number }> = [];
    if (guard.sectionHeading) {
      const normSec = normalizeHeadingTitle(guard.sectionHeading);
      let matchedSecs = realHeadings.filter((h) => h.lineStart < narrativeEnd && h.title === normSec);
      if (matchedSecs.length === 0) {
        matchedSecs = realHeadings.filter(
          (h) =>
            h.lineStart < narrativeEnd &&
            (h.title.startsWith(`${normSec}：`) || h.title.startsWith(`${normSec}:`)),
        );
      }
      if (matchedSecs.length > 0) {
        for (const secHeading of matchedSecs) {
          const nextHeading = realHeadings.find(
            (nh) =>
              nh.lineStart > secHeading.lineStart &&
              nh.lineStart < narrativeEnd &&
              nh.level <= secHeading.level,
          );
          searchWindows.push({
            start: secHeading.lineStart,
            end: nextHeading ? nextHeading.lineStart : narrativeEnd,
          });
        }
      } else {
        searchWindows.push({ start: bodyStart, end: narrativeEnd });
      }
    } else {
      searchWindows.push({ start: bodyStart, end: narrativeEnd });
    }

    for (const win of searchWindows) {
      const searchText = markdown.slice(win.start, win.end);
      let relIdx = searchText.indexOf(guard.anchorQuote);
      while (relIdx >= 0) {
        const candStart = win.start + relIdx;
        const candEnd = candStart + guard.anchorQuote.length;
        if (!isInNonRewritableLine(candStart, candEnd)) break;
        relIdx = searchText.indexOf(guard.anchorQuote, relIdx + 1);
      }
      if (relIdx < 0) continue;
      if (!guardContradictsText(guard, currentText, options)) continue;

      const absOffset = win.start + relIdx;
      const line = lineNumberAt(markdown, absOffset);
      const diagramNote = guard.diagramIds?.length
        ? ` (affects diagrams: ${guard.diagramIds.join(", ")})`
        : "";
      conflicts.push({
        line,
        anchorQuote: guard.anchorQuote,
        reason: `Protected narrative at L${line} still asserts "${guard.anchorQuote}" contradicting fact ${binding.factId} (${reasonLabel})${diagramNote}`,
      });
      break;
    }
  }
  return conflicts;
}

export function detectNarrativeConflicts(
  markdown: string,
  binding: FactBinding,
  diffKind: FactDiffKind,
  newVal: FactValue,
  options?: { certifyingUnverifiedTarget?: boolean },
): NarrativeConflict[] {
  return findNarrativeGuardConflictsForText(markdown, binding, factValueSearchableText(newVal), diffKind, {
    diffKind,
    certifyingUnverifiedTarget: options?.certifyingUnverifiedTarget,
    isSourceAnchorOnly: newVal.kind === "sourceAnchor",
  });
}

function formatLineAnchor(lineStart: number, lineEnd: number): string {
  return lineEnd !== lineStart ? `#L${lineStart}-L${lineEnd}` : `#L${lineStart}`;
}

function unescapeCellPipes(text: string): string {
  return text.replace(/\\\|/g, "|");
}

type CellSourceSpan =
  | {
      kind: "full";
      start: number;
      end: number;
      tok: RepoSourceToken;
      repo: string;
      commit: string;
      path: string;
      anchor: string;
    }
  | { kind: "commit-colon"; start: number; end: number; commit: string; path: string; anchor: string }
  | {
      kind: "blob-url";
      start: number;
      end: number;
      mode: string;
      commit: string;
      path: string;
      anchor: string;
    }
  | { kind: "bare"; start: number; end: number; anchorStart: number; anchorEnd: number; path: string };

function findCellSourceSpans(
  cellText: string,
  expectedRepo: string,
  expectedCommit: string,
  expectedPath: string,
  lineStart: number,
  lineEnd: number,
  allowBasenameShorthand = false,
): { spans: CellSourceSpan[]; hasCommitMismatch: boolean } {
  const anchor = formatLineAnchor(lineStart, lineEnd);
  const inlineMath = findInlineMathSpansInText(cellText, 0);
  const inMath = (s: number, e: number) => inlineMath.some((m) => s < m.end && e > m.start);
  const repoTokens = findAllRepoSourceTokens(cellText).filter((t) => Boolean(t.anchor));
  const spans: CellSourceSpan[] = [];
  let hasCommitMismatch = false;

  for (const tok of repoTokens) {
    if (inMath(tok.start, tok.end)) continue;
    if (tok.repo !== expectedRepo || !exactPathsEqual(tok.path, expectedPath)) continue;
    if (tok.anchor === anchor) {
      if (commitsMatch(tok.commit, expectedCommit)) {
        spans.push({
          kind: "full",
          start: tok.start,
          end: tok.end,
          tok,
          repo: tok.repo,
          commit: tok.commit,
          path: tok.path,
          anchor: tok.anchor,
        });
      } else {
        hasCommitMismatch = true;
      }
    }
  }

  for (const bm of cellText.matchAll(
    /\b(blob|tree)\/([0-9a-fA-F]{7,40})\/([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)(?![0-9-])/g,
  )) {
    const start = bm.index ?? 0;
    const end = start + bm[0].length;
    if (inMath(start, end)) continue;
    if (repoTokens.some((t) => start < t.end && end > t.start)) continue;
    if (!exactPathsEqual(bm[3]!, expectedPath) || bm[4] !== anchor) continue;
    if (commitsMatch(bm[2]!, expectedCommit)) {
      spans.push({
        kind: "blob-url",
        start,
        end,
        mode: bm[1]!,
        commit: bm[2]!,
        path: bm[3]!,
        anchor: bm[4]!,
      });
    } else {
      hasCommitMismatch = true;
    }
  }

  for (const m of findAnchorMatches(cellText, anchor)) {
    if (inMath(m.start, m.end)) continue;
    if (repoTokens.some((t) => m.start < t.end && m.end > t.start)) continue;
    if (spans.some((s) => m.start < s.end && m.end > s.start)) continue;
    let prefixStart = m.start;
    while (prefixStart > 0 && /[A-Za-z0-9_./:@-]/.test(cellText[prefixStart - 1]!)) {
      prefixStart--;
    }
    const rawPrefix = cellText.slice(prefixStart, m.start);
    if (!rawPrefix.includes("@") && rawPrefix.includes(":")) {
      const colonIdx = rawPrefix.lastIndexOf(":");
      const beforeColon = rawPrefix.slice(0, colonIdx);
      const afterColon = rawPrefix.slice(colonIdx + 1).replace(/\\/g, "/");
      if (/^[0-9a-fA-F]{7,40}$/.test(beforeColon)) {
        if (exactPathsEqual(afterColon, expectedPath)) {
          if (commitsMatch(beforeColon, expectedCommit)) {
            spans.push({
              kind: "commit-colon",
              start: prefixStart,
              end: m.end,
              commit: beforeColon,
              path: afterColon,
              anchor,
            });
          } else {
            hasCommitMismatch = true;
          }
        }
        continue;
      }
    }
    const bare = extractBarePathAt(cellText, m.start);
    if (!bare || !matchesCellPath(bare.pathToken, expectedPath, allowBasenameShorthand)) continue;
    spans.push({
      kind: "bare",
      start: bare.tokenStart,
      end: m.end,
      anchorStart: m.start,
      anchorEnd: m.end,
      path: bare.pathToken,
    });
  }

  return { spans, hasCommitMismatch };
}

function findScopedMatrixAnchorMatches(
  cellText: string,
  anchor: string,
  expectedRepo = "",
  expectedPath = "",
  allowBasenameShorthand = false,
): Array<{ start: number; end: number }> {
  const cellMath = findInlineMathSpansInText(cellText, 0);
  const inMath = (s: number, e: number) => cellMath.some((ms) => s < ms.end && e > ms.start);
  const fullTokens = findAllRepoSourceTokens(cellText).filter((t) => Boolean(t.anchor));

  if (anchor.startsWith("#")) {
    const pathMatched: Array<{ start: number; end: number }> = [];
    const standalone: Array<{ start: number; end: number }> = [];
    for (const m of findAnchorMatches(cellText, anchor)) {
      if (inMath(m.start, m.end)) continue;
      const enclosingFull = fullTokens.find((t) => m.start >= t.start && m.end <= t.end);
      if (enclosingFull) {
        if (
          (!expectedRepo || enclosingFull.repo === expectedRepo) &&
          (!expectedPath.trim() || exactPathsEqual(enclosingFull.path, expectedPath)) &&
          enclosingFull.anchor === anchor
        ) {
          pathMatched.push(m);
        }
        continue;
      }
      let prefixStart = m.start;
      while (prefixStart > 0 && /[A-Za-z0-9_./:@-]/.test(cellText[prefixStart - 1]!)) {
        prefixStart--;
      }
      if (prefixStart === m.start) {
        standalone.push(m);
        continue;
      }
      const bare = extractBarePathAt(cellText, m.start);
      if (
        bare &&
        (!expectedPath.trim() || matchesCellPath(bare.pathToken, expectedPath, allowBasenameShorthand))
      ) {
        pathMatched.push(m);
      }
    }
    return pathMatched.length > 0 ? pathMatched : standalone;
  }

  const parsedFullAnchor = parseFullSourceRef(anchor);
  if (parsedFullAnchor && expectedPath.trim() && !exactPathsEqual(parsedFullAnchor.path, expectedPath)) {
    return [];
  }
  const bareAnchorMatch = /^([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)$/.exec(anchor.trim());
  if (
    bareAnchorMatch &&
    expectedPath.trim() &&
    !matchesCellPath(bareAnchorMatch[1]!, expectedPath, allowBasenameShorthand)
  ) {
    return [];
  }
  return findAnchorMatches(cellText, anchor).filter((m) => !inMath(m.start, m.end));
}

function stripScopedMatrixAnchors(
  text: string,
  matches: ReadonlyArray<{ start: number; end: number }>,
): string {
  let out = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const { start, end } = matches[i]!;
    if (start > 0 && /[A-Za-z0-9_./:@-]/.test(out[start - 1]!)) {
      out = out.slice(0, start) + out.slice(end);
      continue;
    }
    let rmStart = start;
    let rmEnd = end;
    if (rmStart > 0 && out[rmStart - 1] === "`" && rmEnd < out.length && out[rmEnd] === "`") {
      rmStart--;
      rmEnd++;
    }
    const beforeParen = out.slice(0, rmStart).match(/[（(]\s*$/);
    const afterParen = out.slice(rmEnd).match(/^\s*[）)]/);
    if (beforeParen && afterParen) {
      rmStart -= beforeParen[0].length;
      rmEnd += afterParen[0].length;
    }
    out = out.slice(0, rmStart) + out.slice(rmEnd);
  }
  return out;
}

function cellEqualsMachineValue(
  cellText: string,
  val: FactValue,
  allowBasenameShorthand = false,
  expectedRepo = "",
  expectedPath = "",
): boolean {
  const formatted = formatFactValueForCell(val);
  if (normCodeExpr(cellText) === normCodeExpr(formatted)) return true;
  if (normCodeExpr(unescapeCellPipes(cellText)) === normCodeExpr(unescapeCellPipes(formatted))) return true;
  if (val.kind === "sourceAnchor") {
    const unwrapped = stripInlineMd(unescapeCellPipes(cellText));
    const parsed = parseFullSourceRef(unwrapped);
    const wantAnchor = formatLineAnchor(val.lineStart, val.lineEnd);
    if (parsed) {
      return (
        parsed.repo === val.repo &&
        commitsMatch(parsed.commit, val.commit) &&
        exactPathsEqual(parsed.path, val.path) &&
        parsed.anchor === wantAnchor
      );
    }
    const anchorIdx = unwrapped.indexOf(wantAnchor);
    if (anchorIdx > 0 && anchorIdx + wantAnchor.length === unwrapped.length) {
      return matchesCellPath(unwrapped.slice(0, anchorIdx), val.path, allowBasenameShorthand);
    }
  }
  if (val.kind === "versionMatrixCell") {
    const unescapedCell = unescapeCellPipes(cellText);
    const expectedSummary = normCodeExpr(unescapeCellPipes(val.summary));
    if (!val.anchor) return normCodeExpr(unescapedCell) === expectedSummary;
    const matches = findScopedMatrixAnchorMatches(
      unescapedCell,
      val.anchor,
      expectedRepo,
      expectedPath,
      allowBasenameShorthand,
    );
    if (matches.length === 0) return false;
    return (
      normCodeExpr(unescapedCell) === expectedSummary ||
      normCodeExpr(stripScopedMatrixAnchors(unescapedCell, matches)) === expectedSummary
    );
  }
  return false;
}

function cellMatchesFactValue(
  cellText: string,
  val: FactValue,
  expectedRepo = "",
  allowBasenameShorthand = false,
  expectedPath = "",
): boolean {
  if (cellEqualsMachineValue(cellText, val, allowBasenameShorthand, expectedRepo, expectedPath)) return true;

  if (val.kind === "sourceAnchor") {
    const { spans, hasCommitMismatch } = findCellSourceSpans(
      cellText,
      expectedRepo || val.repo,
      val.commit,
      val.path,
      val.lineStart,
      val.lineEnd,
      allowBasenameShorthand,
    );
    return !hasCommitMismatch && spans.length > 0;
  }

  if (val.kind === "versionMatrixCell") {
    const unescapedCell = unescapeCellPipes(cellText);
    const expectedSummary = normCodeExpr(unescapeCellPipes(val.summary));
    if (!val.anchor) {
      return normCodeExpr(unescapedCell) === expectedSummary;
    }
    const anchorMatches = findScopedMatrixAnchorMatches(
      unescapedCell,
      val.anchor,
      expectedRepo,
      expectedPath,
      allowBasenameShorthand,
    );
    if (anchorMatches.length === 0) return false;
    const withoutAnchor = stripScopedMatrixAnchors(unescapedCell, anchorMatches);
    return normCodeExpr(unescapedCell) === expectedSummary || normCodeExpr(withoutAnchor) === expectedSummary;
  }

  return false;
}

function detectPageBindingConflicts(
  markdown: string,
  tables: ParsedTable[],
  currentBinding: FactBinding,
  pageBindings?: readonly FactBinding[],
  certifyingUnverifiedTarget = false,
): NarrativeConflict[] {
  if (!pageBindings || pageBindings.length === 0) return [];
  const extra: NarrativeConflict[] = [];
  for (const rawOther of pageBindings) {
    const other = factBindingSchema.parse(rawOther);
    if (other.pageId !== currentBinding.pageId) {
      throw new Error(
        `Page ID mismatch in pageBindings: expected "${currentBinding.pageId}", got "${other.pageId}"`,
      );
    }
    if (other.factId === currentBinding.factId) continue;
    const quoteFallback = other.narrativeGuards[0]?.anchorQuote ?? other.target.rowKey;
    const candTables = filterTablesByExactHeading(tables, other.target.tableHeading);
    const matchingTables = candTables.filter((t) =>
      t.rows.some((r) => r.cells[0] && matchesRowKey(r.cells[0].text, other.target.rowKey)),
    );
    if (matchingTables.length === 0) {
      extra.push({
        line: 1,
        anchorQuote: quoteFallback,
        reason: `Sibling binding ${other.factId} target row "${other.target.rowKey}" not found; refusing verified certification`,
      });
      continue;
    }
    for (const tbl of matchingTables) {
      const matchingRows = tbl.rows.filter(
        (r) => r.cells[0] && matchesRowKey(r.cells[0].text, other.target.rowKey),
      );
      const matchingCols = tbl.header.cells.flatMap((c, idx) =>
        matchesHeaderColumn(c.text, other.target.versionColumn) ? [idx] : [],
      );
      if (matchingCols.length === 0) {
        const missColLine = lineNumberAt(markdown, matchingRows[0]?.lineStart ?? tbl.start);
        extra.push({
          line: missColLine,
          anchorQuote: quoteFallback,
          reason: `Sibling binding ${other.factId} missing target column "${other.target.versionColumn}"; refusing verified certification`,
        });
        continue;
      }
      if (matchingTables.length > 1 || matchingRows.length > 1 || matchingCols.length > 1) {
        const ambigLine = lineNumberAt(markdown, matchingRows[0]?.lineStart ?? tbl.start);
        extra.push({
          line: ambigLine,
          anchorQuote: quoteFallback,
          reason: `Ambiguous sibling target for ${other.factId} (${other.target.rowKey}, ${other.target.versionColumn}); refusing verified certification`,
        });
      }
      for (const row of matchingRows) {
        for (const col of matchingCols) {
          const cell = row.cells[col];
          if (!cell || !cell.text.trim()) {
            extra.push({
              line: lineNumberAt(markdown, row.lineStart),
              anchorQuote: quoteFallback,
              reason: `Sibling binding ${other.factId} missing cell for (${other.target.rowKey}, ${other.target.versionColumn}); refusing verified certification`,
            });
            continue;
          }
          if (other.narrativeGuards.length > 0) {
            extra.push(
              ...findNarrativeGuardConflictsForText(
                markdown,
                other,
                stripInlineMd(cell.text),
                "page-guard-conflict",
                {
                  certifyingUnverifiedTarget,
                  isSourceAnchorOnly: other.kind === "sourceAnchor",
                },
              ),
            );
          }
        }
      }
    }
  }
  return extra;
}

function normalizeMatrixValueForTargetCommit(
  val: FactValue,
  expectedRepo: string,
  oldCommit: string,
  targetCommit: string,
  oldPath: string,
  newPath: string,
  oldAnchor?: string,
  targetAnchor?: string,
): FactValue {
  if (val.kind !== "versionMatrixCell") return val;
  const commitChanged = Boolean(
    oldCommit.trim() && targetCommit.trim() && !commitsMatch(oldCommit, targetCommit),
  );
  const pathChanged = Boolean(oldPath.trim() && newPath.trim() && !exactPathsEqual(oldPath, newPath));
  const anchorChanged = Boolean(oldAnchor && targetAnchor && oldAnchor !== targetAnchor);
  if (!commitChanged && !pathChanged && !anchorChanged) return val;

  const rewriteTokens = (text: string): string => {
    const edits: Array<{ start: number; end: number; rep: string }> = [];
    const allRepo = findAllRepoSourceTokens(text);
    for (const tok of allRepo) {
      if (
        (!expectedRepo || tok.repo === expectedRepo) &&
        (!oldCommit.trim() || commitsMatch(tok.commit, oldCommit)) &&
        (!oldPath.trim() || exactPathsEqual(tok.path, oldPath))
      ) {
        const nextPath = pathChanged ? newPath : tok.path;
        const nextAnc =
          tok.anchor && oldAnchor && tok.anchor === oldAnchor && targetAnchor ? targetAnchor : tok.anchor;
        const nextSha = targetCommit.trim() || tok.commit;
        edits.push({
          start: tok.start,
          end: tok.end,
          rep: formatRepoSourceToken(tok, tok.repo, nextSha, nextPath, nextAnc),
        });
      }
    }
    if (oldPath.trim() && (pathChanged || anchorChanged)) {
      const escapedOldPath = escapeRegExp(oldPath.replace(/\\/g, "/").trim());
      const bareRe = new RegExp(
        `(?<![A-Za-z0-9_./:@-])(${escapedOldPath})(#L\\d+(?:-L\\d+)?)?(?![A-Za-z0-9_./-])`,
        "g",
      );
      for (const m of text.matchAll(bareRe)) {
        const s = m.index ?? 0;
        const e = s + m[0].length;
        if (allRepo.some((t) => s < t.end && e > t.start)) continue;
        if (edits.some((ed) => s < ed.end && e > ed.start)) continue;
        const curAnc = m[2];
        const nextAnc =
          curAnc && oldAnchor && curAnc === oldAnchor && targetAnchor ? targetAnchor : (curAnc ?? "");
        const nextP = pathChanged ? newPath : m[1]!;
        edits.push({ start: s, end: e, rep: `${nextP}${nextAnc}` });
      }
    }
    if (edits.length === 0) return text;
    edits.sort((a, b) => b.start - a.start);
    let out = text;
    for (const ed of edits) {
      out = out.slice(0, ed.start) + ed.rep + out.slice(ed.end);
    }
    return out;
  };

  const nextSummary = rewriteTokens(val.summary);
  const nextAnchor = val.anchor ? rewriteTokens(val.anchor) : undefined;
  if (nextSummary === val.summary && nextAnchor === val.anchor) return val;
  return {
    ...val,
    summary: nextSummary,
    ...(nextAnchor !== undefined ? { anchor: nextAnchor } : {}),
  };
}

function extractScopedAnchorForPath(
  val: FactValue,
  formatted: string,
  expectedRepo: string,
  expectedPath: string,
  allowBasename: boolean,
): string | undefined {
  if (val.kind === "sourceAnchor") {
    return formatLineAnchor(val.lineStart, val.lineEnd);
  }
  if (val.kind === "versionMatrixCell" && val.anchor) {
    const trimmedAnchor = val.anchor.trim();
    if (trimmedAnchor.startsWith("#")) return trimmedAnchor;
    const parsedFull = parseFullSourceRef(trimmedAnchor);
    if (parsedFull) {
      return !expectedPath.trim() || exactPathsEqual(parsedFull.path, expectedPath)
        ? parsedFull.anchor
        : undefined;
    }
    const bareMatch = /^([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)$/.exec(trimmedAnchor);
    if (bareMatch) {
      return !expectedPath.trim() || matchesCellPath(bareMatch[1]!, expectedPath, allowBasename)
        ? bareMatch[2]!
        : undefined;
    }
  }
  const repoTokens = findAllRepoSourceTokens(formatted);
  for (const tok of repoTokens) {
    if (
      tok.anchor &&
      (!expectedRepo || tok.repo === expectedRepo) &&
      (!expectedPath.trim() || exactPathsEqual(tok.path, expectedPath))
    ) {
      return tok.anchor;
    }
  }
  for (const bm of formatted.matchAll(
    /\b(?:blob|tree)\/[0-9a-fA-F]{7,40}\/([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)/g,
  )) {
    if (!expectedPath.trim() || exactPathsEqual(bm[1]!, expectedPath)) return bm[2]!;
  }
  for (const cm of formatted.matchAll(
    /(?<![A-Za-z0-9_./@-])[0-9a-fA-F]{7,40}:([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)/g,
  )) {
    if (!expectedPath.trim() || exactPathsEqual(cm[1]!, expectedPath)) return cm[2]!;
  }
  for (const m of formatted.matchAll(/(?<![A-Za-z0-9_./:@-])([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (repoTokens.some((t) => start < t.end && end > t.start)) continue;
    if (!expectedPath.trim() || matchesCellPath(m[1]!, expectedPath, allowBasename)) return m[2]!;
  }
  if (!expectedPath.trim()) {
    return /(#L\d+(?:-L\d+)?)/.exec(formatted)?.[1];
  }
  return undefined;
}

export function planSurgicalFactPatch(
  markdown: string,
  bindingInput: FactBinding,
  oldValInput: FactValue,
  newValInput: FactValue,
  meta: PlanFactPatchMeta,
): SurgicalFactPatchPlan {
  const binding = factBindingSchema.parse(bindingInput);
  assertPageIdMatches(markdown, binding.pageId);
  const oldVal = factValueSchema.parse(oldValInput);
  const newVal = factValueSchema.parse(newValInput);
  const basePageHash = digest(markdown);
  const diffKind = diffFactValue(oldVal, newVal);

  const parsedNewSourceRef = meta.newSourceRef ? parseFullSourceRef(meta.newSourceRef) : null;
  if (parsedNewSourceRef && !commitsMatch(parsedNewSourceRef.commit, meta.newCommit)) {
    throw new Error(
      `Commit SHA mismatch between meta.newCommit (${meta.newCommit}) and meta.newSourceRef (${parsedNewSourceRef.commit})`,
    );
  }
  const effectiveNewCommit = parsedNewSourceRef?.commit ?? meta.newCommit;
  const customColumnHeader = meta.newColumnHeader?.trim() ? meta.newColumnHeader : undefined;

  const tables = parseMarkdownTables(markdown);
  const candidateTables = filterTablesByExactHeading(tables, binding.target.tableHeading);
  if (binding.target.tableHeading && candidateTables.length > 1) {
    throw new Error(
      `Ambiguous target table: ${candidateTables.length} tables found under heading "${binding.target.tableHeading}"`,
    );
  }
  const matchingTables = candidateTables.filter((t) =>
    t.rows.some((r) => r.cells[0] && matchesRowKey(r.cells[0].text, binding.target.rowKey)),
  );
  if (matchingTables.length === 0) {
    throw new Error(
      `Target version table not found for rowKey="${binding.target.rowKey}"${binding.target.tableHeading ? ` under "${binding.target.tableHeading}"` : ""}`,
    );
  }
  if (matchingTables.length > 1) {
    throw new Error(
      `Ambiguous target table: ${matchingTables.length} tables contain rowKey="${binding.target.rowKey}"`,
    );
  }
  const targetTable = matchingTables[0]!;
  const matchingRows = targetTable.rows.filter(
    (r) => r.cells[0] && matchesRowKey(r.cells[0].text, binding.target.rowKey),
  );
  if (matchingRows.length > 1) {
    throw new Error(
      `Ambiguous target row: ${matchingRows.length} rows match rowKey="${binding.target.rowKey}"`,
    );
  }
  const targetRow = matchingRows[0]!;
  const matchingCols = targetTable.header.cells.flatMap((c, idx) =>
    matchesHeaderColumn(c.text, binding.target.versionColumn) ||
    (customColumnHeader ? matchesCustomColumnHeader(c.text, customColumnHeader) : false)
      ? [idx]
      : [],
  );
  if (matchingCols.length > 1) {
    throw new Error(
      `Ambiguous target column: ${matchingCols.length} columns match versionColumn="${binding.target.versionColumn}"`,
    );
  }
  const colIdx = matchingCols[0] ?? -1;

  const edits: SpanEdit[] = [];
  const manualConflicts: ManualConflict[] = [];
  let operation: FactPatchOperation;
  let oldCellHash: string;

  const effectiveNewPathForMatrix = parsedNewSourceRef?.path ?? binding.path;
  const oldMatrixAnchorHint =
    oldVal.kind === "versionMatrixCell" && oldVal.anchor?.startsWith("#")
      ? oldVal.anchor
      : meta.oldSourceRef
        ? parseFullSourceRef(meta.oldSourceRef)?.anchor
        : undefined;
  const newMatrixAnchorHint =
    parsedNewSourceRef?.anchor ??
    (newVal.kind === "versionMatrixCell" && newVal.anchor?.startsWith("#") ? newVal.anchor : undefined);
  const effectiveNewValForCell = normalizeMatrixValueForTargetCommit(
    newVal,
    binding.repo,
    meta.oldCommit,
    effectiveNewCommit,
    binding.path,
    effectiveNewPathForMatrix,
    oldMatrixAnchorHint,
    newMatrixAnchorHint,
  );
  const formattedOld = formatFactValueForCell(oldVal);
  const formattedNew = formatFactValueForCell(effectiveNewValForCell);
  const hasEmbeddedCommitConflict =
    (newVal.kind === "sourceAnchor" &&
      (!binding.repo || newVal.repo === binding.repo) &&
      !commitsMatch(newVal.commit, effectiveNewCommit)) ||
    findAllRepoSourceTokens(formattedNew).some(
      (tok) => (!binding.repo || tok.repo === binding.repo) && !commitsMatch(tok.commit, effectiveNewCommit),
    );
  const tableSlice = markdown.slice(targetTable.start, targetTable.end);
  const allowOldBasename = !hasAmbiguousBasenameInDoc(
    markdown,
    oldVal.kind === "sourceAnchor" ? oldVal.path : binding.path,
    tableSlice,
  );
  const allowNewBasename = !hasAmbiguousBasenameInDoc(
    markdown,
    newVal.kind === "sourceAnchor" ? newVal.path : effectiveNewPathForMatrix,
    tableSlice,
  );

  if (hasEmbeddedCommitConflict) {
    operation =
      colIdx >= 0 ? (diffKind === "value-changed" ? "replaceCell" : "reanchor") : "appendVersionColumn";
    const actualCellText =
      colIdx >= 0
        ? (targetRow.cells[colIdx]?.text ?? "")
        : markdown.slice(targetRow.lineStart, targetRow.lineEnd);
    oldCellHash = digest(actualCellText);
    manualConflicts.push({
      rowKey: binding.target.rowKey,
      versionColumn: binding.target.versionColumn,
      actualCell: actualCellText,
      expectedOldCell: formattedOld,
      expectedNewCell: formattedNew,
      reason: `Embedded commit conflict in (${binding.target.rowKey}, ${binding.target.versionColumn}): newValue commit conflicts with meta.newCommit (${effectiveNewCommit})`,
    });
  } else if (colIdx >= 0) {
    const cell = targetRow.cells[colIdx];
    if (!cell) throw new Error(`Target column index ${colIdx} missing on row "${binding.target.rowKey}"`);
    oldCellHash = digest(cell.text);
    const matchesOld = cellMatchesFactValue(cell.text, oldVal, binding.repo, allowOldBasename, binding.path);
    const matchesNew = cellMatchesFactValue(
      cell.text,
      effectiveNewValForCell,
      binding.repo,
      allowNewBasename,
      effectiveNewPathForMatrix,
    );
    const isPureOldMachineCell = cellEqualsMachineValue(
      cell.text,
      oldVal,
      allowOldBasename,
      binding.repo,
      binding.path,
    );

    if (!matchesOld && !matchesNew) {
      operation = diffKind === "value-changed" || diffKind === "guard-inverted" ? "replaceCell" : "reanchor";
      manualConflicts.push({
        rowKey: binding.target.rowKey,
        versionColumn: binding.target.versionColumn,
        actualCell: cell.text,
        expectedOldCell: formattedOld,
        expectedNewCell: formattedNew,
        reason: `Manual divergence in (${binding.target.rowKey}, ${binding.target.versionColumn}): cell "${cell.text}" matches neither oldValue nor newValue`,
      });
    } else if (oldVal.kind === "sourceAnchor" && newVal.kind === "sourceAnchor") {
      operation = diffKind === "value-changed" ? "replaceCell" : "reanchor";
      const safeNewAnchor = sanitizeTableCellText(formatLineAnchor(newVal.lineStart, newVal.lineEnd));
      const { spans: oldSpans } = findCellSourceSpans(
        cell.text,
        binding.repo || oldVal.repo,
        oldVal.commit,
        oldVal.path,
        oldVal.lineStart,
        oldVal.lineEnd,
        allowOldBasename,
      );
      const formatSpanReplacement = (sp: CellSourceSpan): { start: number; end: number; text: string } => {
        const nextAnchor = formatLineAnchor(newVal.lineStart, newVal.lineEnd);
        if (sp.kind === "full") {
          return {
            start: sp.start,
            end: sp.end,
            text: sanitizeTableCellText(
              formatRepoSourceToken(sp.tok, newVal.repo, effectiveNewCommit, newVal.path, nextAnchor),
            ),
          };
        }
        if (sp.kind === "commit-colon") {
          return {
            start: sp.start,
            end: sp.end,
            text: sanitizeTableCellText(`${effectiveNewCommit}:${newVal.path}${nextAnchor}`),
          };
        }
        if (sp.kind === "blob-url") {
          return {
            start: sp.start,
            end: sp.end,
            text: sanitizeTableCellText(`${sp.mode}/${effectiveNewCommit}/${newVal.path}${nextAnchor}`),
          };
        }
        if (exactPathsEqual(oldVal.path, newVal.path)) {
          return { start: sp.anchorStart, end: sp.anchorEnd, text: safeNewAnchor };
        }
        return {
          start: sp.start,
          end: sp.end,
          text: sanitizeTableCellText(`${newVal.path}${nextAnchor}`),
        };
      };

      if (diffKind === "unchanged" || (matchesNew && oldSpans.length === 0)) {
        // Already at new anchor/commit state
      } else if (
        (diffKind === "line-shift-only" || oldVal.quoteHash === newVal.quoteHash) &&
        oldSpans.length > 0
      ) {
        const reason = diffKind === "value-changed" ? "replace-cell" : "cell-reanchor";
        for (const sp of oldSpans) {
          const rep = formatSpanReplacement(sp);
          const curSlice = cell.text.slice(rep.start, rep.end);
          if (curSlice !== rep.text) {
            edits.push({
              start: cell.contentStart + rep.start,
              end: cell.contentStart + rep.end,
              oldText: curSlice,
              newText: rep.text,
              reason,
            });
          }
        }
      } else if (isPureOldMachineCell) {
        const reason = diffKind === "value-changed" ? "replace-cell" : "cell-reanchor";
        if (oldSpans.length === 1 && oldSpans[0]!.kind !== "bare") {
          const rep = formatSpanReplacement(oldSpans[0]!);
          edits.push({
            start: cell.contentStart + rep.start,
            end: cell.contentStart + rep.end,
            oldText: cell.text.slice(rep.start, rep.end),
            newText: rep.text,
            reason,
          });
        } else if (cell.text !== formattedNew) {
          edits.push({
            start: cell.contentStart,
            end: cell.contentEnd,
            oldText: cell.text,
            newText: formattedNew,
            reason,
          });
        }
      } else {
        manualConflicts.push({
          rowKey: binding.target.rowKey,
          versionColumn: binding.target.versionColumn,
          actualCell: cell.text,
          expectedOldCell: formattedOld,
          expectedNewCell: formattedNew,
          reason: `Manual prose/multi-ref conflict in (${binding.target.rowKey}, ${binding.target.versionColumn}): refusing to overwrite manual cell "${cell.text}"`,
        });
      }
    } else if (diffKind === "line-shift-only") {
      operation = "reanchor";
      const oldAnchor = oldVal.kind === "versionMatrixCell" ? oldVal.anchor : undefined;
      const newAnchor = newVal.kind === "versionMatrixCell" ? newVal.anchor : undefined;

      if (matchesNew) {
        // Already at normalized post-patch cell state (idempotent rerun)
      } else if (oldAnchor && newAnchor && oldAnchor !== newAnchor) {
        const safeNewAnchor = sanitizeTableCellText(newAnchor);
        const matches = findScopedMatrixAnchorMatches(
          cell.text,
          oldAnchor,
          binding.repo,
          binding.path,
          allowOldBasename,
        );
        const newMatches = findScopedMatrixAnchorMatches(
          cell.text,
          newAnchor,
          binding.repo,
          effectiveNewPathForMatrix,
          allowNewBasename,
        );
        if (matches.length > 0) {
          const fullInCell = findAllRepoSourceTokens(cell.text).filter((t) => Boolean(t.anchor));
          const nextMatrixPath = effectiveNewPathForMatrix;
          const nextAnchorSuffix = newAnchor.startsWith("#")
            ? safeNewAnchor
            : (/(#L\d+(?:-L\d+)?)$/.exec(safeNewAnchor)?.[1] ?? safeNewAnchor);
          for (const m of matches) {
            const enclosingFull = fullInCell.find((t) => m.start >= t.start && m.end <= t.end);
            if (
              enclosingFull &&
              (!binding.repo || enclosingFull.repo === binding.repo) &&
              commitsMatch(enclosingFull.commit, meta.oldCommit)
            ) {
              const fullRep = sanitizeTableCellText(
                formatRepoSourceToken(
                  enclosingFull,
                  parsedNewSourceRef?.repo ?? enclosingFull.repo,
                  effectiveNewCommit,
                  nextMatrixPath || enclosingFull.path,
                  nextAnchorSuffix,
                ),
              );
              if (cell.text.slice(enclosingFull.start, enclosingFull.end) !== fullRep) {
                edits.push({
                  start: cell.contentStart + enclosingFull.start,
                  end: cell.contentStart + enclosingFull.end,
                  oldText: cell.text.slice(enclosingFull.start, enclosingFull.end),
                  newText: fullRep,
                  reason: "cell-reanchor",
                });
              }
              continue;
            }
            if (!exactPathsEqual(binding.path, nextMatrixPath)) {
              const bare = extractBarePathAt(cell.text, m.start);
              if (bare && matchesCellPath(bare.pathToken, binding.path, allowOldBasename)) {
                const bareRep = sanitizeTableCellText(`${nextMatrixPath}${nextAnchorSuffix}`);
                edits.push({
                  start: cell.contentStart + bare.tokenStart,
                  end: cell.contentStart + m.end,
                  oldText: cell.text.slice(bare.tokenStart, m.end),
                  newText: bareRep,
                  reason: "cell-reanchor",
                });
                continue;
              }
            }
            edits.push({
              start: cell.contentStart + m.start,
              end: cell.contentStart + m.end,
              oldText: cell.text.slice(m.start, m.end),
              newText: safeNewAnchor,
              reason: "cell-reanchor",
            });
          }
        } else if (newMatches.length === 0 && isPureOldMachineCell) {
          edits.push({
            start: cell.contentStart,
            end: cell.contentEnd,
            oldText: cell.text,
            newText: formattedNew,
            reason: "cell-reanchor",
          });
        } else if (newMatches.length === 0) {
          manualConflicts.push({
            rowKey: binding.target.rowKey,
            versionColumn: binding.target.versionColumn,
            actualCell: cell.text,
            expectedOldCell: formattedOld,
            expectedNewCell: formattedNew,
            reason: `Manual prose conflict in (${binding.target.rowKey}, ${binding.target.versionColumn})`,
          });
        }
      } else if (
        !oldAnchor &&
        newAnchor &&
        findScopedMatrixAnchorMatches(
          cell.text,
          newAnchor,
          binding.repo,
          effectiveNewPathForMatrix,
          allowNewBasename,
        ).length === 0
      ) {
        if (isPureOldMachineCell) {
          edits.push({
            start: cell.contentStart,
            end: cell.contentEnd,
            oldText: cell.text,
            newText: formattedNew,
            reason: "cell-reanchor",
          });
        } else {
          manualConflicts.push({
            rowKey: binding.target.rowKey,
            versionColumn: binding.target.versionColumn,
            actualCell: cell.text,
            expectedOldCell: formattedOld,
            expectedNewCell: formattedNew,
            reason: `Manual prose conflict in (${binding.target.rowKey}, ${binding.target.versionColumn})`,
          });
        }
      } else if (oldAnchor && !newAnchor && cell.text !== formattedNew) {
        if (isPureOldMachineCell) {
          edits.push({
            start: cell.contentStart,
            end: cell.contentEnd,
            oldText: cell.text,
            newText: formattedNew,
            reason: "cell-reanchor",
          });
        } else {
          manualConflicts.push({
            rowKey: binding.target.rowKey,
            versionColumn: binding.target.versionColumn,
            actualCell: cell.text,
            expectedOldCell: formattedOld,
            expectedNewCell: formattedNew,
            reason: `Manual prose conflict in (${binding.target.rowKey}, ${binding.target.versionColumn})`,
          });
        }
      }
    } else if (diffKind === "value-changed" || diffKind === "guard-inverted") {
      operation = "replaceCell";
      if (!matchesNew && cell.text !== formattedNew) {
        if (isPureOldMachineCell) {
          edits.push({
            start: cell.contentStart,
            end: cell.contentEnd,
            oldText: cell.text,
            newText: formattedNew,
            reason: "replace-cell",
          });
        } else {
          manualConflicts.push({
            rowKey: binding.target.rowKey,
            versionColumn: binding.target.versionColumn,
            actualCell: cell.text,
            expectedOldCell: formattedOld,
            expectedNewCell: formattedNew,
            reason: `Manual prose conflict in (${binding.target.rowKey}, ${binding.target.versionColumn})`,
          });
        }
      }
    } else {
      operation = "reanchor";
    }
  } else {
    operation = "appendVersionColumn";
    oldCellHash = digest(markdown.slice(targetRow.lineStart, targetRow.lineEnd));
    const headerCols = targetTable.header.cells.length;
    const headerLabel = sanitizeTableCellText(customColumnHeader ?? `\`${binding.target.versionColumn}\``);
    const fallbackCell = sanitizeTableCellText(meta.defaultOtherRowCell ?? "—");
    const headerClose = targetTable.header.hasTrailingPipe ? "" : " |";
    const sepClose = targetTable.separator.hasTrailingPipe ? "" : "|";

    edits.push({
      start: targetTable.header.pipeEnd,
      end: targetTable.header.pipeEnd,
      oldText: "",
      newText: `${headerClose} ${headerLabel} |`,
      reason: "append-column-header",
    });
    edits.push({
      start: targetTable.separator.pipeEnd,
      end: targetTable.separator.pipeEnd,
      oldText: "",
      newText: `${sepClose}---|`,
      reason: "append-column-separator",
    });
    for (const row of targetTable.rows) {
      if (row.cells.length > headerCols) {
        throw new Error(
          `Malformed GFM table row #${row.lineIndex}: row has ${row.cells.length} cells, exceeding header column count ${headerCols}`,
        );
      }
      const missingCols = headerCols - row.cells.length;
      const rowClose = row.hasTrailingPipe ? "" : " |";
      const padPrefix = `${rowClose}${" |".repeat(missingCols)}`;
      const cellVal = row === targetRow ? formattedNew : fallbackCell;
      edits.push({
        start: row.pipeEnd,
        end: row.pipeEnd,
        oldText: "",
        newText: `${padPrefix} ${cellVal} |`,
        reason: row === targetRow ? "append-column-target-cell" : "append-column-other-cell",
      });
    }
  }

  const currentVerified = readFrontmatterVerified(markdown);
  const targetVerifyTag = meta.verifiedTag ?? binding.target.versionColumn;
  const certifyingUnverifiedTarget = Boolean(targetVerifyTag && !currentVerified.includes(targetVerifyTag));

  const narrativeConflicts = [
    ...detectNarrativeConflicts(markdown, binding, diffKind, newVal, { certifyingUnverifiedTarget }),
    ...detectPageBindingConflicts(markdown, tables, binding, meta.pageBindings, certifyingUnverifiedTarget),
  ];

  const oldCommitForRef = oldVal.kind === "sourceAnchor" ? oldVal.commit : meta.oldCommit;
  const oldPathForRef = oldVal.kind === "sourceAnchor" ? oldVal.path : binding.path;
  const newPathForRef = newVal.kind === "sourceAnchor" ? newVal.path : effectiveNewPathForMatrix;
  const oldAnchorForRef = extractScopedAnchorForPath(
    oldVal,
    formattedOld,
    binding.repo,
    oldPathForRef,
    allowOldBasename,
  );
  const newAnchorForRef = extractScopedAnchorForPath(
    effectiveNewValForCell,
    formattedNew,
    binding.repo,
    newPathForRef,
    allowNewBasename,
  );

  const baseFmSources = parseFrontmatterSources(markdown);
  const hasFrontmatterMatchingOldRef = baseFmSources.items.some((sp) =>
    findAllRepoSourceTokens(sp.decodedValue).some(
      (tok) =>
        tok.repo === binding.repo &&
        commitsMatch(tok.commit, oldCommitForRef) &&
        exactPathsEqual(tok.path, oldPathForRef) &&
        (!tok.anchor || !oldAnchorForRef || tok.anchor === oldAnchorForRef),
    ),
  );
  const hasEmbeddedOldNewCommitRef =
    oldVal.kind === "sourceAnchor" ||
    hasFrontmatterMatchingOldRef ||
    findAllRepoSourceTokens(formattedOld).length > 0 ||
    /[0-9a-fA-F]{7,40}[:/][A-Za-z0-9_./-]+#L\d+/.test(formattedOld);
  const effectiveOldSourceRef =
    meta.oldSourceRef ??
    (hasEmbeddedOldNewCommitRef && oldPathForRef.trim()
      ? `${binding.repo}@${oldCommitForRef}:${oldPathForRef}${oldAnchorForRef ?? ""}`
      : undefined);
  const effectiveNewSourceRef =
    meta.newSourceRef ??
    (hasEmbeddedOldNewCommitRef && newPathForRef.trim()
      ? `${binding.repo}@${effectiveNewCommit}:${newPathForRef}${newAnchorForRef ?? ""}`
      : undefined);

  if (
    manualConflicts.length === 0 &&
    effectiveOldSourceRef &&
    effectiveNewSourceRef &&
    (effectiveOldSourceRef !== effectiveNewSourceRef ||
      !commitsMatch(oldCommitForRef, effectiveNewCommit) ||
      !exactPathsEqual(oldPathForRef, newPathForRef))
  ) {
    const existingSpans = edits.map(({ start, end, reason }) => ({ start, end, reason }));
    const targetColumnRanges =
      colIdx >= 0
        ? targetTable.rows.flatMap((r) => {
            const c = r.cells[colIdx];
            return c ? [{ start: c.rawStart, end: c.rawEnd }] : [];
          })
        : [];
    const otherTableRanges: Array<{ start: number; end: number }> = [];
    for (const tbl of tables) {
      if (tbl !== targetTable) {
        otherTableRanges.push({ start: tbl.start, end: tbl.end });
        continue;
      }
      otherTableRanges.push({ start: tbl.header.lineStart, end: tbl.separator.lineEnd });
      for (const r of tbl.rows) {
        for (let cIdx = 0; cIdx < r.cells.length; cIdx++) {
          if (cIdx !== colIdx) {
            const c = r.cells[cIdx]!;
            otherTableRanges.push({ start: c.rawStart, end: c.rawEnd });
          }
        }
      }
    }
    edits.push(
      ...findSourceRefEdits(markdown, effectiveOldSourceRef, effectiveNewSourceRef, existingSpans, {
        repo: binding.repo,
        oldCommit: oldCommitForRef,
        newCommit: effectiveNewCommit,
        oldPath: oldPathForRef,
        newPath: newPathForRef,
        oldAnchor: oldAnchorForRef,
        newAnchor: newAnchorForRef,
        targetColumnRanges,
        otherTableRanges,
      }),
    );
  }

  // Post-Projection 3-Way Commit SHA & Line-Anchor Equality Gate (Target Cell === Frontmatter `sources:` === effectiveNewCommit)
  if (manualConflicts.length === 0 && effectiveNewCommit.trim()) {
    const descEdits = [...edits].sort((a, b) => b.start - a.start);
    let projectedDoc = markdown;
    for (const e of descEdits) {
      projectedDoc = projectedDoc.slice(0, e.start) + e.newText + projectedDoc.slice(e.end);
    }

    const matchesBoundPath = (p: string) =>
      exactPathsEqual(p, oldPathForRef) || exactPathsEqual(p, newPathForRef);
    const otherColumnHeaderShas: string[] = [];
    targetTable.header.cells.forEach((hc, idx) => {
      if (idx === 0 || idx === colIdx) return;
      for (const sm of hc.text.matchAll(/\b([0-9a-fA-F]{7,40})\b/g)) {
        otherColumnHeaderShas.push(sm[1]!);
      }
    });

    // 1. Projected target cell commit-bearing refs for bound path must all equal effectiveNewCommit
    const projTables = parseMarkdownTables(projectedDoc);
    const projCand = filterTablesByExactHeading(projTables, binding.target.tableHeading).find((t) =>
      t.rows.some((r) => r.cells[0] && matchesRowKey(r.cells[0].text, binding.target.rowKey)),
    );
    const projRow = projCand?.rows.find(
      (r) => r.cells[0] && matchesRowKey(r.cells[0].text, binding.target.rowKey),
    );
    const projColIdx =
      colIdx >= 0
        ? colIdx
        : projCand
          ? projCand.header.cells.findIndex(
              (c) =>
                matchesHeaderColumn(c.text, binding.target.versionColumn) ||
                (customColumnHeader ? matchesCustomColumnHeader(c.text, customColumnHeader) : false),
            )
          : -1;
    const projCellText = projRow && projColIdx >= 0 ? (projRow.cells[projColIdx]?.text ?? "") : "";
    const projCellBoundAnchors: string[] = [];
    if (projCellText) {
      const cellShas: string[] = [];
      const projCellMath = findInlineMathSpansInText(projCellText, 0);
      const inProjCellMath = (s: number, e: number) => projCellMath.some((m) => s < m.end && e > m.start);
      const coveredCellSpans: Array<{ start: number; end: number }> = [];
      for (const tok of findAllRepoSourceTokens(projCellText)) {
        if (inProjCellMath(tok.start, tok.end)) continue;
        coveredCellSpans.push({ start: tok.start, end: tok.end });
        if ((!binding.repo || tok.repo === binding.repo) && matchesBoundPath(tok.path)) {
          cellShas.push(tok.commit);
          if (tok.anchor) projCellBoundAnchors.push(tok.anchor);
        }
      }
      for (const bm of projCellText.matchAll(
        /\b(?:blob|tree)\/([0-9a-fA-F]{7,40})\/([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)/g,
      )) {
        const s = bm.index ?? 0;
        const e = s + bm[0].length;
        if (inProjCellMath(s, e) || coveredCellSpans.some((c) => s < c.end && e > c.start)) continue;
        coveredCellSpans.push({ start: s, end: e });
        if (matchesBoundPath(bm[2]!)) {
          cellShas.push(bm[1]!);
          projCellBoundAnchors.push(bm[3]!);
        }
      }
      for (const cm of projCellText.matchAll(
        /(?<![A-Za-z0-9_./@-])([0-9a-fA-F]{7,40}):([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)/g,
      )) {
        const s = cm.index ?? 0;
        const e = s + cm[0].length;
        if (inProjCellMath(s, e) || coveredCellSpans.some((c) => s < c.end && e > c.start)) continue;
        coveredCellSpans.push({ start: s, end: e });
        if (matchesBoundPath(cm[2]!)) {
          cellShas.push(cm[1]!);
          projCellBoundAnchors.push(cm[3]!);
        }
      }
      for (const m of projCellText.matchAll(/(?<![A-Za-z0-9_./:@-])([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)/g)) {
        const s = m.index ?? 0;
        const e = s + m[0].length;
        if (inProjCellMath(s, e) || coveredCellSpans.some((c) => s < c.end && e > c.start)) continue;
        if (matchesCellPath(m[1]!, newPathForRef, allowNewBasename)) {
          projCellBoundAnchors.push(m[2]!);
        }
      }
      const badCellSha = cellShas.find((sha) => !commitsMatch(sha, effectiveNewCommit));
      if (badCellSha) {
        manualConflicts.push({
          rowKey: binding.target.rowKey,
          versionColumn: binding.target.versionColumn,
          actualCell: projCellText,
          expectedOldCell: formattedOld,
          expectedNewCell: formattedNew,
          reason: `Projected cell SHA (${badCellSha}) does not match target commit (${effectiveNewCommit})`,
        });
      }
    }

    // 2. Projected YAML `sources:` entries (decoded via `yaml` AST; both `#L`-anchored and file-level, `repo@sha:path` & GitHub `blob/` URLs) must align on SHA and bi-directional `#L...` coverage
    const projFmBounds = findFrontmatterBounds(projectedDoc);
    if (projFmBounds && manualConflicts.length === 0) {
      const projFmSources = parseFrontmatterSources(projectedDoc);
      const relevantFmTokens = projFmSources.items
        .flatMap((sp) => findAllRepoSourceTokens(sp.decodedValue))
        .filter(
          (tok) =>
            tok.repo === binding.repo &&
            matchesBoundPath(tok.path) &&
            !otherColumnHeaderShas.some((otherSha) => commitsMatch(tok.commit, otherSha)),
        );
      const badFmTok = relevantFmTokens.find((tok) => !commitsMatch(tok.commit, effectiveNewCommit));
      if (badFmTok) {
        manualConflicts.push({
          rowKey: binding.target.rowKey,
          versionColumn: binding.target.versionColumn,
          actualCell: projCellText,
          expectedOldCell: formattedOld,
          expectedNewCell: formattedNew,
          reason: `Frontmatter sources entry ${badFmTok.repo}@${badFmTok.commit}:${badFmTok.path}${badFmTok.anchor ?? ""} does not match target commit (${effectiveNewCommit}); refusing verified certification`,
        });
      } else {
        // Forward check: every `#L...` anchor on `(binding.repo, newPathForRef)` in the projected target cell itself MUST be covered in `sources:` (by matching `#L...` or file-level entry)!
        if (projFmSources.hasSourcesSeq && projCellBoundAnchors.length > 0) {
          const hasFileLevelCoverage = relevantFmTokens.some(
            (tok) =>
              !tok.anchor &&
              exactPathsEqual(tok.path, newPathForRef) &&
              commitsMatch(tok.commit, effectiveNewCommit),
          );
          if (!hasFileLevelCoverage) {
            const uncoveredCellAnchor = projCellBoundAnchors.find(
              (cellAnc) =>
                !relevantFmTokens.some(
                  (tok) =>
                    tok.anchor === cellAnc &&
                    exactPathsEqual(tok.path, newPathForRef) &&
                    commitsMatch(tok.commit, effectiveNewCommit),
                ),
            );
            if (uncoveredCellAnchor) {
              manualConflicts.push({
                rowKey: binding.target.rowKey,
                versionColumn: binding.target.versionColumn,
                actualCell: projCellText,
                expectedOldCell: formattedOld,
                expectedNewCell: formattedNew,
                reason: `Projected target cell anchor (${newPathForRef}${uncoveredCellAnchor}) is not covered in frontmatter sources; refusing verified certification`,
              });
            }
          }
        }

        // Reverse check: every `#L`-anchored `sources:` entry for the bound path must belong to projected bound-path anchors in the target column
        if (manualConflicts.length === 0) {
          const anchoredFmTokens = relevantFmTokens.filter((tok) => Boolean(tok.anchor));
          const expectedNewAnchor = parsedNewSourceRef?.anchor ?? newAnchorForRef;
          const projColumnBoundAnchors: string[] = [...projCellBoundAnchors];
          if (projCand && projColIdx >= 0) {
            for (const otherRow of projCand.rows) {
              if (otherRow === projRow) continue;
              const otherText = otherRow.cells[projColIdx]?.text ?? "";
              if (!otherText) continue;
              const otherMath = findInlineMathSpansInText(otherText, 0);
              const inOtherMath = (s: number, e: number) => otherMath.some((m) => s < m.end && e > m.start);
              const coveredOther: Array<{ start: number; end: number }> = [];
              for (const tok of findAllRepoSourceTokens(otherText)) {
                if (inOtherMath(tok.start, tok.end)) continue;
                coveredOther.push({ start: tok.start, end: tok.end });
                if (
                  (!binding.repo || tok.repo === binding.repo) &&
                  exactPathsEqual(tok.path, newPathForRef) &&
                  tok.anchor
                ) {
                  projColumnBoundAnchors.push(tok.anchor);
                }
              }
              for (const m of otherText.matchAll(
                /(?<![A-Za-z0-9_./:@-])([A-Za-z0-9_./-]+)(#L\d+(?:-L\d+)?)/g,
              )) {
                const s = m.index ?? 0;
                const e = s + m[0].length;
                if (inOtherMath(s, e) || coveredOther.some((c) => s < c.end && e > c.start)) continue;
                if (matchesCellPath(m[1]!, newPathForRef, allowNewBasename)) {
                  projColumnBoundAnchors.push(m[2]!);
                }
              }
            }
          }
          const allowedPathAnchors = new Set(
            projColumnBoundAnchors.length > 0
              ? projColumnBoundAnchors
              : expectedNewAnchor
                ? [expectedNewAnchor]
                : [],
          );
          if (anchoredFmTokens.length > 0 && allowedPathAnchors.size > 0) {
            const invalidFmAnchorTok = anchoredFmTokens.find(
              (tok) => !exactPathsEqual(tok.path, newPathForRef) || !allowedPathAnchors.has(tok.anchor!),
            );
            if (invalidFmAnchorTok) {
              manualConflicts.push({
                rowKey: binding.target.rowKey,
                versionColumn: binding.target.versionColumn,
                actualCell: projCellText,
                expectedOldCell: formattedOld,
                expectedNewCell: formattedNew,
                reason: `Frontmatter sources entry (${invalidFmAnchorTok.path}${invalidFmAnchorTok.anchor}) does not match projected bound-path anchor (${[...allowedPathAnchors].join(", ")}); refusing verified certification`,
              });
            }
          }
        }
      }
    }
  }

  const canCertifyVerified = narrativeConflicts.length === 0 && manualConflicts.length === 0;
  if (canCertifyVerified && meta.verifiedTag) {
    const verifiedEdit = findVerifiedInsertEdit(markdown, meta.verifiedTag);
    if (verifiedEdit) edits.push(verifiedEdit);
  } else if (!canCertifyVerified) {
    const revokeTag = meta.verifiedTag ?? binding.target.versionColumn;
    const unverifyEdit = findVerifiedRemoveEdit(markdown, revokeTag);
    if (unverifyEdit) edits.push(unverifyEdit);
  }

  if (edits.length === 0) {
    const reason =
      manualConflicts.length > 0
        ? manualConflicts[0]!.reason
        : narrativeConflicts.length > 0
          ? narrativeConflicts[0]!.reason
          : "Target cell, source refs, and verified state already match";
    return {
      noop: true,
      reason,
      basePageHash,
      protectedEnvelopeHash: computeProtectedEnvelopeHash(markdown, []),
      canCertifyVerified,
      narrativeConflicts,
      manualConflicts,
    };
  }

  edits.sort((a, b) => a.start - b.start || a.end - b.end);
  const allowedSpans: AllowedSpan[] = edits.map(({ start, end, newText, reason }) => ({
    start,
    end,
    reason,
    replacementLength: newText.length,
    replacementSha256: digest(newText),
  }));
  const protectedEnvelopeHash = computeProtectedEnvelopeHash(markdown, allowedSpans);

  const patch = factPatchSchema.parse({
    factId: binding.factId,
    pageId: binding.pageId,
    oldCommit: meta.oldCommit,
    newCommit: meta.newCommit,
    basePageHash,
    extractorVersion: meta.extractorVersion ?? DEFAULT_EXTRACTOR_VERSION,
    oldCellHash,
    oldValue: oldVal,
    newValue: newVal,
    ...(meta.oldSourceRef ? { oldSourceRef: meta.oldSourceRef } : {}),
    ...(meta.newSourceRef ? { newSourceRef: meta.newSourceRef } : {}),
    operation,
    allowedSpans,
    protectedEnvelopeHash,
    canCertifyVerified,
    narrativeConflicts,
    manualConflicts,
    edits,
  });

  return { noop: false, ...patch };
}

function verifyTableColumnInvariance(
  originalMarkdown: string,
  candidateMarkdown: string,
  allowedSpans: AllowedSpan[],
): void {
  const origTables = parseMarkdownTables(originalMarkdown);
  const candTables = parseMarkdownTables(candidateMarkdown);
  if (origTables.length !== candTables.length) {
    throw new Error(
      `GFM table structure altered: expected ${origTables.length} table(s), got ${candTables.length}`,
    );
  }
  for (let t = 0; t < origTables.length; t++) {
    const origTable = origTables[t]!;
    const candTable = candTables[t]!;
    const isAppend = allowedSpans.some(
      (s) => s.reason === "append-column-header" && s.start >= origTable.start && s.end <= origTable.end,
    );
    const delta = isAppend ? 1 : 0;
    if (candTable.header.cells.length !== origTable.header.cells.length + delta) {
      throw new Error(
        `GFM table column count mismatch on header of table #${t}: expected ${origTable.header.cells.length + delta}, got ${candTable.header.cells.length}`,
      );
    }
    if (candTable.separator.cells.length !== origTable.separator.cells.length + delta) {
      throw new Error(
        `GFM table column count mismatch on separator of table #${t}: expected ${origTable.separator.cells.length + delta}, got ${candTable.separator.cells.length}`,
      );
    }
    if (candTable.rows.length !== origTable.rows.length) {
      throw new Error(
        `GFM table row count mismatch on table #${t}: expected ${origTable.rows.length}, got ${candTable.rows.length}`,
      );
    }
    for (let r = 0; r < origTable.rows.length; r++) {
      if (origTable.rows[r]!.cells.length > origTable.header.cells.length) {
        throw new Error(
          `GFM table column count mismatch on table #${t} row #${r}: original row exceeds header width`,
        );
      }
      const expectedCols = isAppend ? origTable.header.cells.length + 1 : origTable.rows[r]!.cells.length;
      const actualCols = candTable.rows[r]!.cells.length;
      if (actualCols !== expectedCols) {
        throw new Error(
          `GFM table column count mismatch on table #${t} row #${r}: expected ${expectedCols}, got ${actualCols}`,
        );
      }
    }
  }
}

export type VerifySurgicalPatchInput = Pick<FactPatch, "allowedSpans" | "protectedEnvelopeHash" | "edits">;

/**
 * Strictly verify that `candidateMarkdown` modifies ONLY bytes inside `allowedSpans`
 * of `originalMarkdown` and preserves the entire protected envelope, every
 * `wiki-diagram` and `wiki-scene` fence byte-for-byte, and GFM table column counts.
 */
export function verifySurgicalCandidate(
  originalMarkdown: string,
  candidateMarkdown: string,
  patch: VerifySurgicalPatchInput,
): { verified: true; envelopeHash: string };
export function verifySurgicalCandidate(
  originalMarkdown: string,
  candidateMarkdown: string,
  allowedSpans: AllowedSpan[],
  expectedEnvelopeHash: string,
): { verified: true; envelopeHash: string };
export function verifySurgicalCandidate(
  originalMarkdown: string,
  candidateMarkdown: string,
  patchOrSpans: VerifySurgicalPatchInput | AllowedSpan[],
  expectedEnvelopeHashArg?: string,
): { verified: true; envelopeHash: string } {
  const isPatch = !Array.isArray(patchOrSpans);
  const allowedSpans = isPatch ? patchOrSpans.allowedSpans : patchOrSpans;
  const expectedEnvelopeHash = isPatch ? patchOrSpans.protectedEnvelopeHash : expectedEnvelopeHashArg!;
  const edits = isPatch ? patchOrSpans.edits : undefined;

  const sorted = normalizeAllowedSpans(allowedSpans, originalMarkdown.length);
  const origEnvelopeHash = computeProtectedEnvelopeHash(originalMarkdown, sorted);
  if (origEnvelopeHash !== expectedEnvelopeHash) {
    throw new Error(
      `Protected envelope hash mismatch on base document: expected ${expectedEnvelopeHash}, got ${origEnvelopeHash}`,
    );
  }

  verifyTableColumnInvariance(originalMarkdown, candidateMarkdown, sorted);

  const candidateSpans: AllowedSpan[] = [];

  if (edits) {
    const parsedEdits = edits
      .map((e) => spanEditSchema.parse(e))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    if (parsedEdits.length !== sorted.length) {
      throw new Error("Protected envelope tampered: edits count does not match allowedSpans");
    }
    let prevOldEnd = 0;
    let prevNewEnd = 0;
    for (let i = 0; i < parsedEdits.length; i++) {
      const edit = parsedEdits[i]!;
      const span = sorted[i]!;
      if (edit.start !== span.start || edit.end !== span.end) {
        throw new Error(`Protected envelope tampered: edit #${i} coordinates do not match allowedSpans`);
      }
      if (edit.start < prevOldEnd || edit.start > edit.end || edit.end > originalMarkdown.length) {
        throw new Error(`Protected envelope tampered: edit #${i} is unsorted or out of bounds`);
      }
      if (originalMarkdown.slice(edit.start, edit.end) !== edit.oldText) {
        throw new Error(`Protected envelope tampered: edit #${i} oldText mismatch on base document`);
      }
      const protectedLen = edit.start - prevOldEnd;
      const origProt = originalMarkdown.slice(prevOldEnd, edit.start);
      const candProt = candidateMarkdown.slice(prevNewEnd, prevNewEnd + protectedLen);
      if (candProt !== origProt) {
        throw new Error(
          `Protected envelope tampered: protected segment #${i} outside allowedSpans was altered`,
        );
      }
      const candEditStart = prevNewEnd + protectedLen;
      const candEditEnd = candEditStart + edit.newText.length;
      if (
        candEditEnd > candidateMarkdown.length ||
        candidateMarkdown.slice(candEditStart, candEditEnd) !== edit.newText
      ) {
        throw new Error(`Protected envelope tampered: edit #${i} replacement mismatch in candidate`);
      }
      if (span.replacementLength !== undefined && edit.newText.length !== span.replacementLength) {
        throw new Error(
          `Protected envelope tampered: span #${i} replacementLength mismatch (expected ${span.replacementLength}, got ${edit.newText.length})`,
        );
      }
      if (
        span.replacementSha256 &&
        digest(candidateMarkdown.slice(candEditStart, candEditEnd)) !== span.replacementSha256
      ) {
        throw new Error(
          `Protected envelope tampered: span #${i} replacementSha256 hash mismatch in candidate`,
        );
      }
      candidateSpans.push({ start: candEditStart, end: candEditEnd, reason: edit.reason });
      prevOldEnd = edit.end;
      prevNewEnd = candEditEnd;
    }
    const origTail = originalMarkdown.slice(prevOldEnd);
    const candTail = candidateMarkdown.slice(prevNewEnd);
    if (candTail !== origTail) {
      throw new Error("Protected envelope tampered: trailing bytes outside allowedSpans were modified");
    }
  } else if (sorted.length === 0) {
    if (candidateMarkdown !== originalMarkdown) {
      throw new Error("Protected envelope tampered: no allowedSpans permitted, but candidate bytes differ");
    }
  } else if (sorted.every((s) => s.replacementLength !== undefined)) {
    let prevOldEnd = 0;
    let prevNewEnd = 0;
    for (let i = 0; i < sorted.length; i++) {
      const span = sorted[i]!;
      const protectedLen = span.start - prevOldEnd;
      const origProt = originalMarkdown.slice(prevOldEnd, span.start);
      const candProt = candidateMarkdown.slice(prevNewEnd, prevNewEnd + protectedLen);
      if (candProt !== origProt) {
        throw new Error(
          `Protected envelope tampered: protected segment #${i} outside allowedSpans was altered`,
        );
      }
      const candEditStart = prevNewEnd + protectedLen;
      const candEditEnd = candEditStart + span.replacementLength!;
      if (candEditEnd > candidateMarkdown.length) {
        throw new Error(`Protected envelope tampered: span #${i} replacement exceeds candidate bounds`);
      }
      if (
        span.replacementSha256 &&
        digest(candidateMarkdown.slice(candEditStart, candEditEnd)) !== span.replacementSha256
      ) {
        throw new Error(`Protected envelope tampered: span #${i} replacement hash mismatch in candidate`);
      }
      candidateSpans.push({ start: candEditStart, end: candEditEnd, reason: span.reason });
      prevOldEnd = span.end;
      prevNewEnd = candEditEnd;
    }
    if (candidateMarkdown.slice(prevNewEnd) !== originalMarkdown.slice(prevOldEnd)) {
      throw new Error("Protected envelope tampered: trailing bytes outside allowedSpans were modified");
    }
  } else if (sorted.length === 1) {
    const span = sorted[0]!;
    const prefix = originalMarkdown.slice(0, span.start);
    const suffix = originalMarkdown.slice(span.end);
    if (!candidateMarkdown.startsWith(prefix)) {
      throw new Error("Protected envelope tampered: leading bytes outside allowedSpans were modified");
    }
    const suffixStart = candidateMarkdown.length - suffix.length;
    if (suffixStart < prefix.length || !candidateMarkdown.endsWith(suffix)) {
      throw new Error("Protected envelope tampered: trailing bytes outside allowedSpans were modified");
    }
    if (
      span.replacementSha256 &&
      digest(candidateMarkdown.slice(prefix.length, suffixStart)) !== span.replacementSha256
    ) {
      throw new Error("Protected envelope tampered: span #0 replacement hash mismatch in candidate");
    }
    candidateSpans.push({ start: prefix.length, end: suffixStart, reason: span.reason });
  } else {
    throw new Error(
      "Protected envelope verification failed: multi-span 4-arg verification requires replacementLength on every AllowedSpan",
    );
  }

  const origFences = extractProtectedFences(originalMarkdown);
  const candFences = extractProtectedFences(candidateMarkdown);
  if (
    origFences.length !== candFences.length ||
    origFences.some((f, i) => f.kind !== candFences[i]!.kind || f.sha256 !== candFences[i]!.sha256)
  ) {
    throw new Error("Protected fence tampered: wiki-diagram or wiki-scene block was modified");
  }

  const candEnvelopeHash = computeProtectedEnvelopeHash(candidateMarkdown, candidateSpans);
  if (candEnvelopeHash !== expectedEnvelopeHash) {
    throw new Error(
      `Protected envelope verification failed: expected ${expectedEnvelopeHash}, candidate produced ${candEnvelopeHash}`,
    );
  }

  return { verified: true, envelopeHash: candEnvelopeHash };
}

function verifyOldCellHash(originalMarkdown: string, patch: FactPatch): void {
  const edits = patch.edits ?? [];
  if (patch.operation === "appendVersionColumn") {
    const targetEdit = edits.find((e) => e.reason === "append-column-target-cell");
    if (!targetEdit) {
      if (!patch.canCertifyVerified && edits.every((e) => e.reason === "frontmatter-unverify")) {
        return;
      }
      throw new Error(`Patch ${patch.factId} missing append-column-target-cell edit`);
    }
    const lineStart = originalMarkdown.lastIndexOf("\n", targetEdit.start - 1) + 1;
    const rawLineEnd = originalMarkdown.indexOf("\n", targetEdit.start);
    const lineEnd = rawLineEnd < 0 ? originalMarkdown.length : rawLineEnd;
    const lineText = originalMarkdown.slice(lineStart, lineEnd).replace(/\r$/, "");
    const actualHash = digest(lineText);
    if (actualHash !== patch.oldCellHash) {
      throw new Error(
        `Stale cell hash for ${patch.factId}: expected ${patch.oldCellHash}, got ${actualHash}`,
      );
    }
    return;
  }

  const cellEdit = edits.find((e) => e.reason === "replace-cell" || e.reason === "cell-reanchor");
  if (!cellEdit) return;
  const lineStart = originalMarkdown.lastIndexOf("\n", cellEdit.start - 1) + 1;
  const rawLineEnd = originalMarkdown.indexOf("\n", cellEdit.end);
  const lineEnd = rawLineEnd < 0 ? originalMarkdown.length : rawLineEnd;
  const parsedRow = parsePipeRow(originalMarkdown.slice(lineStart, lineEnd).replace(/\r$/, ""), lineStart, 0);
  const cell = parsedRow?.cells.find((c) => cellEdit.start >= c.rawStart && cellEdit.end <= c.rawEnd);
  if (!cell || digest(cell.text) !== patch.oldCellHash) {
    throw new Error(
      `Stale cell hash for ${patch.factId}: expected ${patch.oldCellHash}, got ${cell ? digest(cell.text) : "<missing>"}`,
    );
  }
}

export function applySurgicalFactPatch(
  originalMarkdown: string,
  patchInput: FactPatch | ({ noop: false } & FactPatch),
): string {
  const { noop: _noop, ...rawPatch } = patchInput as FactPatch & { noop?: false };
  const patch = factPatchSchema.parse(rawPatch);
  assertPageIdMatches(originalMarkdown, patch.pageId);
  const actualBaseHash = digest(originalMarkdown);
  if (actualBaseHash !== patch.basePageHash) {
    throw new Error(
      `Stale base page for ${patch.pageId}: expected basePageHash ${patch.basePageHash}, got ${actualBaseHash}`,
    );
  }

  const edits = patch.edits;
  if (!edits || edits.length === 0) {
    throw new Error(`FactPatch ${patch.factId} has no concrete span edits to apply`);
  }
  const sortedSpans = normalizeAllowedSpans(patch.allowedSpans, originalMarkdown.length);
  const sortedEdits = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  if (
    sortedEdits.length !== sortedSpans.length ||
    sortedEdits.some((e, i) => e.start !== sortedSpans[i]!.start || e.end !== sortedSpans[i]!.end)
  ) {
    throw new Error(`FactPatch ${patch.factId} edits do not match declared allowedSpans`);
  }
  for (let i = 0; i < sortedEdits.length; i++) {
    const edit = sortedEdits[i]!;
    const span = sortedSpans[i]!;
    if (span.replacementLength !== undefined && edit.newText.length !== span.replacementLength) {
      throw new Error(
        `FactPatch ${patch.factId} span #${i} replacementLength mismatch (expected ${span.replacementLength}, got ${edit.newText.length})`,
      );
    }
    if (span.replacementSha256 && digest(edit.newText) !== span.replacementSha256) {
      throw new Error(`FactPatch ${patch.factId} span #${i} replacementSha256 hash mismatch`);
    }
  }

  verifyOldCellHash(originalMarkdown, { ...patch, allowedSpans: sortedSpans, edits: sortedEdits });

  let candidate = originalMarkdown;
  for (let i = sortedEdits.length - 1; i >= 0; i--) {
    const edit = sortedEdits[i]!;
    if (originalMarkdown.slice(edit.start, edit.end) !== edit.oldText) {
      throw new Error(`FactPatch ${patch.factId} edit #${i} oldText mismatch on base document`);
    }
    candidate = candidate.slice(0, edit.start) + edit.newText + candidate.slice(edit.end);
  }

  verifySurgicalCandidate(originalMarkdown, candidate, {
    ...patch,
    allowedSpans: sortedSpans,
    edits: sortedEdits,
  });
  return candidate;
}
