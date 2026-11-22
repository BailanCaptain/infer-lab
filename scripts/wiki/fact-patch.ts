import matter from "gray-matter";
import { z } from "zod";
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
  cells: TableCellSpan[];
}

interface ParsedTable {
  heading: string;
  header: ParsedTableRow;
  separator: ParsedTableRow;
  rows: ParsedTableRow[];
  start: number;
  end: number;
}

const TABLE_SEP_RE = /^\s*\|(?:\s*:?-{2,}:?\s*\|)+\s*$/;

function stripInlineMd(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePipeRow(line: string, lineStart: number, lineIndex: number): ParsedTableRow | null {
  const firstPipe = line.indexOf("|");
  const lastPipe = line.lastIndexOf("|");
  if (firstPipe < 0 || lastPipe <= firstPipe) return null;

  const pipePositions: number[] = [];
  for (let i = firstPipe; i <= lastPipe; i++) {
    const ch = line[i]!;
    if (ch === "\\" && i + 1 <= lastPipe) {
      i++;
    } else if (ch === "|") {
      pipePositions.push(i);
    }
  }
  if (pipePositions.length < 2) return null;

  const cells: TableCellSpan[] = [];
  for (let c = 0; c < pipePositions.length - 1; c++) {
    const rawStart = lineStart + pipePositions[c]! + 1;
    const rawEnd = lineStart + pipePositions[c + 1]!;
    const raw = line.slice(pipePositions[c]! + 1, pipePositions[c + 1]!);
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
    pipeEnd: lineStart + lastPipe + 1,
    cells,
  };
}

function parseMarkdownTables(markdown: string): ParsedTable[] {
  const rawLines = markdown.split(/(?<=\n)/);
  const tables: ParsedTable[] = [];
  let offset = 0;
  let fence = "";
  let currentHeading = "";
  let inFrontmatter = false;

  const lineMeta: { text: string; start: number; end: number; heading: string; inCode: boolean }[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    const lineStart = offset;
    offset += raw.length;
    const text = raw.replace(/\r?\n$/, "");

    if (i === 0 && text === "---") {
      inFrontmatter = true;
      lineMeta.push({ text, start: lineStart, end: lineStart + text.length, heading: "", inCode: true });
      continue;
    }
    if (inFrontmatter) {
      if (text === "---") inFrontmatter = false;
      lineMeta.push({ text, start: lineStart, end: lineStart + text.length, heading: "", inCode: true });
      continue;
    }

    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (fence) {
      if (marker && marker[1]![0] === fence[0] && marker[1]!.length >= fence.length && !marker[2]!.trim()) {
        fence = "";
      }
      lineMeta.push({
        text,
        start: lineStart,
        end: lineStart + text.length,
        heading: currentHeading,
        inCode: true,
      });
      continue;
    }
    if (marker) {
      fence = marker[1]!;
      lineMeta.push({
        text,
        start: lineStart,
        end: lineStart + text.length,
        heading: currentHeading,
        inCode: true,
      });
      continue;
    }

    const headingMatch = /^ {0,3}#{1,6}\s+(.+?)\s*$/.exec(text);
    if (headingMatch) currentHeading = stripInlineMd(headingMatch[1]!);
    lineMeta.push({
      text,
      start: lineStart,
      end: lineStart + text.length,
      heading: currentHeading,
      inCode: false,
    });
  }

  let idx = 0;
  while (idx + 1 < lineMeta.length) {
    const cur = lineMeta[idx]!;
    const next = lineMeta[idx + 1]!;
    if (!cur.inCode && !next.inCode && /^\s*\|.*\|\s*$/.test(cur.text) && TABLE_SEP_RE.test(next.text)) {
      const header = parsePipeRow(cur.text, cur.start, idx);
      const separator = parsePipeRow(next.text, next.start, idx + 1);
      if (header && separator) {
        const rows: ParsedTableRow[] = [];
        let j = idx + 2;
        while (j < lineMeta.length && !lineMeta[j]!.inCode && /^\s*\|.*\|\s*$/.test(lineMeta[j]!.text)) {
          const parsed = parsePipeRow(lineMeta[j]!.text, lineMeta[j]!.start, j);
          if (!parsed) break;
          rows.push(parsed);
          j++;
        }
        const lastRow = rows.at(-1) ?? separator;
        tables.push({
          heading: cur.heading,
          header,
          separator,
          rows,
          start: header.lineStart,
          end: lastRow.lineEnd,
        });
        idx = j;
        continue;
      }
    }
    idx++;
  }
  return tables;
}

function matchesHeaderColumn(headerCell: string, versionColumn: string): boolean {
  const cleanCell = stripInlineMd(headerCell);
  const cleanCol = stripInlineMd(versionColumn);
  if (cleanCell === cleanCol) return true;
  const escaped = cleanCol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-zA-Z0-9._-])${escaped}([^a-zA-Z0-9._-]|$)`).test(cleanCell);
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

function matchesPathPrefixAt(text: string, anchorStart: number, expectedPath: string): boolean {
  const normExpected = expectedPath.replace(/\\/g, "/").trim();
  if (!normExpected) return false;
  let prefixStart = anchorStart;
  while (prefixStart > 0 && /[A-Za-z0-9_./:@-]/.test(text[prefixStart - 1]!)) {
    prefixStart--;
  }
  const rawPrefix = text.slice(prefixStart, anchorStart);
  const colonIdx = rawPrefix.lastIndexOf(":");
  const pathToken = (colonIdx >= 0 ? rawPrefix.slice(colonIdx + 1) : rawPrefix).replace(/\\/g, "/");
  if (!pathToken) return false;
  return pathToken === normExpected || normExpected.endsWith(`/${pathToken}`);
}

function findSourceRefEdits(
  markdown: string,
  oldRef: string,
  newRef: string,
  existingSpans: AllowedSpan[],
  expectedPath?: string,
): SpanEdit[] {
  if (!oldRef || oldRef === newRef) return [];
  const isBareAnchor = oldRef.startsWith("#");
  if (isBareAnchor && !expectedPath?.trim()) return [];
  const edits: SpanEdit[] = [];
  const fences = extractProtectedFences(markdown);
  for (const { start, end } of findAnchorMatches(markdown, oldRef)) {
    if (isBareAnchor && !matchesPathPrefixAt(markdown, start, expectedPath!)) continue;
    const overlapsExisting = existingSpans.some((s) => start < s.end && end > s.start);
    const overlapsFence = fences.some((f) => start < f.end && end > f.start);
    if (!overlapsExisting && !overlapsFence) {
      edits.push({
        start,
        end,
        oldText: markdown.slice(start, end),
        newText: newRef,
        reason: "source-ref",
      });
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
  const sourceSectionMatch = /^##[ \t]+对照源码[ \t]*$/m.exec(markdown.slice(bodyStart));
  const narrativeEnd = sourceSectionMatch ? bodyStart + sourceSectionMatch.index : markdown.length;
  const narrativeSlice = markdown.slice(bodyStart, narrativeEnd);
  const conflicts: NarrativeConflict[] = [];

  for (const guard of binding.narrativeGuards) {
    let searchBase = bodyStart;
    let searchText = narrativeSlice;
    if (guard.sectionHeading) {
      const escaped = escapeRegExp(guard.sectionHeading);
      const secRe = new RegExp(`^#{1,6}[ \\t]+[^\\r\\n]*${escaped}[^\\r\\n]*$`, "m");
      const secMatch = secRe.exec(narrativeSlice);
      if (secMatch) {
        const nextHeading = /\r?\n#{1,2}[ \t]+/.exec(
          narrativeSlice.slice(secMatch.index + secMatch[0].length),
        );
        const secEnd = nextHeading
          ? secMatch.index + secMatch[0].length + nextHeading.index
          : narrativeSlice.length;
        searchBase = bodyStart + secMatch.index;
        searchText = narrativeSlice.slice(secMatch.index, secEnd);
      }
    }

    const relIdx = searchText.indexOf(guard.anchorQuote);
    if (relIdx < 0) continue;
    if (!guardContradictsText(guard, currentText, options)) continue;

    const absOffset = searchBase + relIdx;
    const line = lineNumberAt(markdown, absOffset);
    const diagramNote = guard.diagramIds?.length ? ` (affects diagrams: ${guard.diagramIds.join(", ")})` : "";
    conflicts.push({
      line,
      anchorQuote: guard.anchorQuote,
      reason: `Protected narrative at L${line} still asserts "${guard.anchorQuote}" contradicting fact ${binding.factId} (${reasonLabel})${diagramNote}`,
    });
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

function findSourceAnchorMatchesInCell(
  cellText: string,
  expectedPath: string,
  lineStart: number,
  lineEnd: number,
): Array<{ start: number; end: number }> {
  const anchor = formatLineAnchor(lineStart, lineEnd);
  const normExpected = expectedPath.replace(/\\/g, "/");
  const matches: Array<{ start: number; end: number }> = [];
  for (const m of findAnchorMatches(cellText, anchor)) {
    let prefixStart = m.start;
    while (prefixStart > 0 && /[A-Za-z0-9_./:@-]/.test(cellText[prefixStart - 1]!)) {
      prefixStart--;
    }
    const rawPrefix = cellText.slice(prefixStart, m.start);
    const colonIdx = rawPrefix.lastIndexOf(":");
    const pathToken = (colonIdx >= 0 ? rawPrefix.slice(colonIdx + 1) : rawPrefix).replace(/\\/g, "/");
    if (!pathToken) continue;
    if (pathToken === normExpected || normExpected.endsWith(`/${pathToken}`)) {
      matches.push(m);
    }
  }
  return matches;
}

function stripMatchedAnchor(text: string, anchor: string): string {
  const escaped = escapeRegExp(anchor);
  const isRange = /#L\d+-L\d+$/.test(anchor);
  const isSingle = !isRange && /#L\d+$/.test(anchor);
  const left = anchor.startsWith("#") ? "" : "(?<![A-Za-z0-9_./@-])";
  const right = isRange ? "(?![0-9])" : isSingle ? "(?![0-9-])" : "";
  return text
    .replace(new RegExp(`[（(]\\s*\`?${left}${escaped}${right}\`?\\s*[）)]`, "g"), "")
    .replace(new RegExp(`\`?${left}${escaped}${right}\`?`, "g"), "");
}

function cellMatchesFactValue(cellText: string, val: FactValue): boolean {
  const formatted = formatFactValueForCell(val);
  if (normCodeExpr(cellText) === normCodeExpr(formatted)) return true;
  if (normCodeExpr(unescapeCellPipes(cellText)) === normCodeExpr(unescapeCellPipes(formatted))) return true;

  if (val.kind === "sourceAnchor") {
    return findSourceAnchorMatchesInCell(cellText, val.path, val.lineStart, val.lineEnd).length > 0;
  }

  if (val.kind === "versionMatrixCell") {
    const unescapedCell = unescapeCellPipes(cellText);
    const expectedSummary = normCodeExpr(unescapeCellPipes(val.summary));
    if (!val.anchor) {
      return normCodeExpr(unescapedCell) === expectedSummary;
    }
    const anchorMatches = findAnchorMatches(unescapedCell, val.anchor);
    if (anchorMatches.length === 0) return false;
    const withoutAnchor = stripMatchedAnchor(unescapedCell, val.anchor);
    return normCodeExpr(withoutAnchor) === expectedSummary;
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
    if (other.factId === currentBinding.factId || other.narrativeGuards.length === 0) continue;
    const candTables = other.target.tableHeading
      ? tables.filter((t) => stripInlineMd(t.heading).includes(stripInlineMd(other.target.tableHeading!)))
      : tables;
    const tbl = candTables.find((t) =>
      t.rows.some((r) => r.cells[0] && matchesRowKey(r.cells[0].text, other.target.rowKey)),
    );
    const row = tbl?.rows.find((r) => r.cells[0] && matchesRowKey(r.cells[0].text, other.target.rowKey));
    const col = tbl
      ? tbl.header.cells.findIndex((c) => matchesHeaderColumn(c.text, other.target.versionColumn))
      : -1;
    const cell = row && col >= 0 ? row.cells[col] : undefined;
    if (!cell) continue;
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
  return extra;
}

export function planSurgicalFactPatch(
  markdown: string,
  bindingInput: FactBinding,
  oldValInput: FactValue,
  newValInput: FactValue,
  meta: PlanFactPatchMeta,
): SurgicalFactPatchPlan {
  const binding = factBindingSchema.parse(bindingInput);
  const oldVal = factValueSchema.parse(oldValInput);
  const newVal = factValueSchema.parse(newValInput);
  const basePageHash = digest(markdown);
  const diffKind = diffFactValue(oldVal, newVal);

  const tables = parseMarkdownTables(markdown);
  const candidateTables = binding.target.tableHeading
    ? tables.filter((t) => stripInlineMd(t.heading).includes(stripInlineMd(binding.target.tableHeading!)))
    : tables;
  const targetTable = candidateTables.find((t) =>
    t.rows.some((r) => r.cells[0] && matchesRowKey(r.cells[0].text, binding.target.rowKey)),
  );
  if (!targetTable) {
    throw new Error(
      `Target version table not found for rowKey="${binding.target.rowKey}"${binding.target.tableHeading ? ` under "${binding.target.tableHeading}"` : ""}`,
    );
  }
  const targetRow = targetTable.rows.find(
    (r) => r.cells[0] && matchesRowKey(r.cells[0].text, binding.target.rowKey),
  )!;
  const colIdx = targetTable.header.cells.findIndex((c) =>
    matchesHeaderColumn(c.text, binding.target.versionColumn),
  );

  const edits: SpanEdit[] = [];
  const manualConflicts: ManualConflict[] = [];
  let operation: FactPatchOperation;
  let oldCellHash: string;

  if (colIdx >= 0) {
    const cell = targetRow.cells[colIdx];
    if (!cell) throw new Error(`Target column index ${colIdx} missing on row "${binding.target.rowKey}"`);
    oldCellHash = digest(cell.text);
    const formattedOld = formatFactValueForCell(oldVal);
    const formattedNew = formatFactValueForCell(newVal);
    const matchesOld = cellMatchesFactValue(cell.text, oldVal);
    const matchesNew = cellMatchesFactValue(cell.text, newVal);

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
    } else if (diffKind === "line-shift-only") {
      operation = "reanchor";
      const oldAnchor =
        oldVal.kind === "sourceAnchor"
          ? formatLineAnchor(oldVal.lineStart, oldVal.lineEnd)
          : oldVal.kind === "versionMatrixCell"
            ? oldVal.anchor
            : undefined;
      const newAnchor =
        newVal.kind === "sourceAnchor"
          ? formatLineAnchor(newVal.lineStart, newVal.lineEnd)
          : newVal.kind === "versionMatrixCell"
            ? newVal.anchor
            : undefined;

      if (oldAnchor && newAnchor && oldAnchor !== newAnchor) {
        const safeNewAnchor = sanitizeTableCellText(newAnchor);
        const matches =
          oldVal.kind === "sourceAnchor"
            ? findSourceAnchorMatchesInCell(cell.text, oldVal.path, oldVal.lineStart, oldVal.lineEnd)
            : findAnchorMatches(cell.text, oldAnchor);
        const newMatches =
          newVal.kind === "sourceAnchor"
            ? findSourceAnchorMatchesInCell(cell.text, newVal.path, newVal.lineStart, newVal.lineEnd)
            : findAnchorMatches(cell.text, newAnchor);
        if (matches.length > 0) {
          for (const m of matches) {
            edits.push({
              start: cell.contentStart + m.start,
              end: cell.contentStart + m.end,
              oldText: cell.text.slice(m.start, m.end),
              newText: safeNewAnchor,
              reason: "cell-reanchor",
            });
          }
        } else if (newMatches.length === 0) {
          edits.push({
            start: cell.contentStart,
            end: cell.contentEnd,
            oldText: cell.text,
            newText: formattedNew,
            reason: "cell-reanchor",
          });
        }
      } else if (!oldAnchor && newAnchor && findAnchorMatches(cell.text, newAnchor).length === 0) {
        edits.push({
          start: cell.contentStart,
          end: cell.contentEnd,
          oldText: cell.text,
          newText: formattedNew,
          reason: "cell-reanchor",
        });
      } else if (oldAnchor && !newAnchor && cell.text !== formattedNew) {
        edits.push({
          start: cell.contentStart,
          end: cell.contentEnd,
          oldText: cell.text,
          newText: formattedNew,
          reason: "cell-reanchor",
        });
      }
    } else if (diffKind === "value-changed" || diffKind === "guard-inverted") {
      operation = "replaceCell";
      if (!matchesNew && cell.text !== formattedNew) {
        edits.push({
          start: cell.contentStart,
          end: cell.contentEnd,
          oldText: cell.text,
          newText: formattedNew,
          reason: "replace-cell",
        });
      }
    } else {
      operation = "reanchor";
    }
  } else {
    operation = "appendVersionColumn";
    oldCellHash = digest(markdown.slice(targetRow.lineStart, targetRow.lineEnd));
    const headerLabel = sanitizeTableCellText(meta.newColumnHeader ?? `\`${binding.target.versionColumn}\``);
    const formattedNew = formatFactValueForCell(newVal);
    const fallbackCell = sanitizeTableCellText(meta.defaultOtherRowCell ?? "—");

    edits.push({
      start: targetTable.header.pipeEnd,
      end: targetTable.header.pipeEnd,
      oldText: "",
      newText: ` ${headerLabel} |`,
      reason: "append-column-header",
    });
    edits.push({
      start: targetTable.separator.pipeEnd,
      end: targetTable.separator.pipeEnd,
      oldText: "",
      newText: `---|`,
      reason: "append-column-separator",
    });
    for (const row of targetTable.rows) {
      const cellVal = row === targetRow ? formattedNew : fallbackCell;
      edits.push({
        start: row.pipeEnd,
        end: row.pipeEnd,
        oldText: "",
        newText: ` ${cellVal} |`,
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
  const canCertifyVerified = narrativeConflicts.length === 0 && manualConflicts.length === 0;

  if (
    manualConflicts.length === 0 &&
    meta.oldSourceRef &&
    meta.newSourceRef &&
    meta.oldSourceRef !== meta.newSourceRef
  ) {
    const existingSpans = edits.map(({ start, end, reason }) => ({ start, end, reason }));
    const sourcePath = oldVal.kind === "sourceAnchor" ? oldVal.path : binding.path;
    edits.push(
      ...findSourceRefEdits(markdown, meta.oldSourceRef, meta.newSourceRef, existingSpans, sourcePath),
    );
  }
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
      const expectedCols = origTable.rows[r]!.cells.length + delta;
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
    const parsedEdits = edits.map((e) => spanEditSchema.parse(e));
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
  if (
    edits.length !== patch.allowedSpans.length ||
    edits.some((e, i) => e.start !== patch.allowedSpans[i]!.start || e.end !== patch.allowedSpans[i]!.end)
  ) {
    throw new Error(`FactPatch ${patch.factId} edits do not match declared allowedSpans`);
  }

  verifyOldCellHash(originalMarkdown, patch);

  let candidate = originalMarkdown;
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i]!;
    if (originalMarkdown.slice(edit.start, edit.end) !== edit.oldText) {
      throw new Error(`FactPatch ${patch.factId} edit #${i} oldText mismatch on base document`);
    }
    candidate = candidate.slice(0, edit.start) + edit.newText + candidate.slice(edit.end);
  }

  verifySurgicalCandidate(originalMarkdown, candidate, patch);
  return candidate;
}
