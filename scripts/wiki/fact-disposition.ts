import { z } from "zod";
import { createSlugger, fragmentId } from "../../src/content/wiki/anchors";
import type { FactDispositionEntry } from "../../src/content/wiki/drop";
import { EVIDENCE_MARK_RE } from "../../src/content/wiki/evidenceMarks";
import { parsePage, type WikiPage } from "./pages";
import { type Revision, splitHistory } from "./revisions";
import { digest } from "./workflow";

export type SiblingWrite = {
  path: string;
  before: string | null;
  after: string | null;
};

export type ExtractedFactUnit = {
  text: string;
  start: number;
  end: number;
  headingPath: string[];
  sectionKey: string;
  blockIndexInSection: number;
  tableHeader?: string;
  context?: string;
  kind: "prose" | "table" | "code";
  normalizedKey: string;
};

export type SectionBlockGroup = {
  sectionKey: string;
  headingPath: string[];
  isSourceSection: boolean;
  units: ExtractedFactUnit[];
};

export type PendingFactUnit = {
  index: number;
  fact: string;
  context?: string;
  headingPath: string[];
  tableHeader?: string;
};

export type WikiLinkRef = {
  targetId: string;
  anchor?: string;
};

export type SiblingTargetPage = {
  page: WikiPage;
  active: string;
  hash: string;
};

export type PlannedFactDispositions = {
  pageId: string;
  oldActive: string;
  nextActive: string;
  baseHash: string;
  candidateHash: string;
  units: ExtractedFactUnit[];
  deterministic: Map<number, FactDispositionEntry>;
  pendingUnits: PendingFactUnit[];
  siblings: Map<string, SiblingTargetPage>;
  outgoingLinks: WikiLinkRef[];
};

const PROMPT_RESIDUE_RE =
  /(?:给定材料中的?|本次材料中的?|根据给定材料[，,：:]?\s*|由给定材料可知[，,：:]?\s*)/g;
const TABLE_SEP_RE = /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/;

/**
 * 归一化散文段落/列表块：先原样保护行内代码反引号片段（不压缩反引号内的字符串空白或符号），
 * 仅对非代码散文剥除证据角标、提示词残留与行内链接外壳，并保留块内行边界。
 */
export function normalizeVerbatim(raw: string): string {
  const lf = raw.replace(/\r\n/g, "\n");
  const codeSpans: string[] = [];
  const shielded = lf.replace(/(`+)([\s\S]*?)\1/g, (match) => {
    const token = `\uE000${codeSpans.length}\uE001`;
    codeSpans.push(match);
    return token;
  });
  const cleaned = shielded
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(EVIDENCE_MARK_RE, "")
    .replace(PROMPT_RESIDUE_RE, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]+/g, " ")
        .replace(/[ \t]+([,，。！？；：:.)）\]])/g, "$1")
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join("\n");
  return cleaned.replace(/\uE000(\d+)\uE001/g, (_, idx) => codeSpans[Number(idx)] ?? "");
}

function normalizeTableRow(row: string): string {
  const codeSpans: string[] = [];
  const shielded = row
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/(`+)([\s\S]*?)\1/g, (match) => {
      const token = `\uE000${codeSpans.length}\uE001`;
      codeSpans.push(match);
      return token;
    });
  return shielded
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) =>
      normalizeVerbatim(cell.replace(/\uE000(\d+)\uE001/g, (_, idx) => codeSpans[Number(idx)] ?? "")),
    )
    .join(" | ");
}

export function formatFactContext(headingPath: string[], tableHeader?: string): string | undefined {
  const parts: string[] = [];
  if (headingPath.length > 0) parts.push(headingPath.join(" > "));
  if (tableHeader) parts.push(`表头: ${tableHeader}`);
  return parts.length > 0 ? parts.join(" | ") : undefined;
}

export function extractSectionGroups(activeBody: string): SectionBlockGroup[] {
  const rawLines = activeBody.split(/(?<=\n)/);
  const headings: { level: number; text: string }[] = [];
  const occurrences = new Map<string, number>();
  const groups: SectionBlockGroup[] = [];

  const openGroup = (): SectionBlockGroup => {
    const headingPath = headings.map((h) => h.text);
    const pathId = headingPath.length > 0 ? headingPath.join("\u001f") : "__root__";
    const occ = (occurrences.get(pathId) ?? 0) + 1;
    occurrences.set(pathId, occ);
    const group: SectionBlockGroup = {
      sectionKey: `${pathId}#${occ}`,
      headingPath,
      isSourceSection: headingPath[0] === "对照源码",
      units: [],
    };
    groups.push(group);
    return group;
  };

  let currentGroup = openGroup();
  let fence = "";
  let skipFence = false;
  let fenceStart = -1;
  let proseStart = -1;
  let proseEnd = -1;
  let tableStart = -1;
  let tableEnd = -1;
  let tableLines: string[] = [];

  const flushProse = () => {
    if (proseStart < 0) return;
    const slice = activeBody.slice(proseStart, proseEnd).replace(/\r?\n$/, "");
    const cleanBlock = slice.trim();
    const startRef = proseStart;
    proseStart = -1;
    proseEnd = -1;
    if (!cleanBlock) return;
    const normalizedKey = normalizeVerbatim(cleanBlock);
    if (normalizedKey.replace(/\s+/g, "").length < 2) return;
    const rel = slice.indexOf(cleanBlock);
    const exactStart = startRef + (rel >= 0 ? rel : 0);
    currentGroup.units.push({
      text: cleanBlock,
      start: exactStart,
      end: exactStart + cleanBlock.length,
      headingPath: currentGroup.headingPath,
      sectionKey: currentGroup.sectionKey,
      blockIndexInSection: currentGroup.units.length,
      context: formatFactContext(currentGroup.headingPath),
      kind: "prose",
      normalizedKey,
    });
  };

  const flushTable = () => {
    if (tableStart < 0) return;
    const slice = activeBody.slice(tableStart, tableEnd).replace(/\r?\n$/, "");
    const cleanTable = slice.trim();
    const lines = tableLines;
    const startRef = tableStart;
    tableStart = -1;
    tableEnd = -1;
    tableLines = [];
    if (!cleanTable || lines.length === 0) return;
    const headerRow = normalizeTableRow(lines[0]!);
    const normalizedRows = lines
      .filter((l, i) => i === 0 || !TABLE_SEP_RE.test(l))
      .map((l) => normalizeTableRow(l));
    const normalizedKey = normalizedRows.join("\n");
    if (normalizedKey.replace(/[|\s]/g, "").length < 2) return;
    const rel = slice.indexOf(cleanTable);
    const exactStart = startRef + (rel >= 0 ? rel : 0);
    currentGroup.units.push({
      text: cleanTable,
      start: exactStart,
      end: exactStart + cleanTable.length,
      headingPath: currentGroup.headingPath,
      sectionKey: currentGroup.sectionKey,
      blockIndexInSection: currentGroup.units.length,
      tableHeader: headerRow,
      context: formatFactContext(currentGroup.headingPath, headerRow),
      kind: "table",
      normalizedKey,
    });
  };

  const flushCode = (endOffset: number) => {
    if (fenceStart < 0) return;
    const slice = activeBody.slice(fenceStart, endOffset).replace(/\r?\n$/, "");
    const startRef = fenceStart;
    const ignored = skipFence;
    fence = "";
    skipFence = false;
    fenceStart = -1;
    if (ignored || !slice.trim()) return;
    const normalizedKey = slice.replace(/\r\n/g, "\n");
    currentGroup.units.push({
      text: slice,
      start: startRef,
      end: startRef + slice.length,
      headingPath: currentGroup.headingPath,
      sectionKey: currentGroup.sectionKey,
      blockIndexInSection: currentGroup.units.length,
      context: formatFactContext(currentGroup.headingPath),
      kind: "code",
      normalizedKey,
    });
  };

  let offset = 0;
  for (let idx = 0; idx < rawLines.length; idx++) {
    const rawLine = rawLines[idx]!;
    const lineStart = offset;
    offset += rawLine.length;
    const line = rawLine.replace(/\r?\n$/, "");
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);

    if (fence) {
      if (marker && marker[1]![0] === fence[0] && marker[1]!.length >= fence.length && !marker[2]!.trim()) {
        flushCode(offset);
      }
      continue;
    }

    if (marker) {
      flushProse();
      flushTable();
      fence = marker[1]!;
      fenceStart = lineStart;
      const info = marker[2]!.trim().toLowerCase();
      skipFence = info.startsWith("wiki-diagram") || info.startsWith("wiki-scene");
      continue;
    }

    const headingMatch = /^ {0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      flushProse();
      flushTable();
      const level = headingMatch[1]!.length;
      const text = headingMatch[2]!
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(EVIDENCE_MARK_RE, "")
        .replace(/[`*_~]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      while (headings.length > 0 && headings.at(-1)!.level >= level) headings.pop();
      headings.push({ level, text });
      currentGroup = openGroup();
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed || /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) || /^<!--[\s\S]*-->$/.test(trimmed)) {
      flushProse();
      flushTable();
      continue;
    }

    const isPipeRow = /^\s*\|.*\|\s*$/.test(line);
    const nextLine = (rawLines[idx + 1] ?? "").replace(/\r?\n$/, "");
    if (isPipeRow && (tableStart >= 0 || TABLE_SEP_RE.test(nextLine))) {
      flushProse();
      if (tableStart < 0) tableStart = lineStart;
      tableEnd = offset;
      tableLines.push(trimmed);
      continue;
    }

    flushTable();
    if (proseStart < 0) proseStart = lineStart;
    proseEnd = offset;
  }

  if (fenceStart >= 0) flushCode(offset);
  flushProse();
  flushTable();

  return groups.filter((g) => g.headingPath.length > 0 || g.units.length > 0);
}

export function extractUnitsWithContext(activeBody: string): ExtractedFactUnit[] {
  return extractSectionGroups(activeBody).flatMap((g) => g.units);
}

function extractOutgoingWikiLinks(newPage: WikiPage, activeBody: string): WikiLinkRef[] {
  const links: WikiLinkRef[] = [];
  const mdLinkRe =
    /\[[^\]]*\]\((?:(?:\.\.?\/)?(?:concepts|params|sources)\/|#\/wiki\/)?([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.md)?(?:#([^\s)]+))?\)/g;
  for (const m of activeBody.matchAll(mdLinkRe)) {
    const targetId = m[1]!;
    if (targetId === newPage.fm.id) continue;
    links.push({ targetId, anchor: m[2] ? fragmentId(m[2]) : undefined });
  }
  for (const rel of newPage.fm.relations) {
    if (rel.to !== newPage.fm.id && !links.some((l) => l.targetId === rel.to)) {
      links.push({ targetId: rel.to });
    }
  }
  return links;
}

export function sliceHeadingSection(
  activeBody: string,
  wantedSlug: string,
): { exists: boolean; text: string } {
  const slugger = createSlugger();
  const lines = activeBody.split(/\r?\n/);
  let capturing = false;
  let captureLevel = 0;
  const captured: string[] = [];
  let fence = "";

  for (const line of lines) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = "";
      if (capturing) captured.push(line);
      continue;
    }
    if (marker) {
      fence = marker;
      if (capturing) captured.push(line);
      continue;
    }
    const h = /^ {0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const headingText = h[2]!
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(EVIDENCE_MARK_RE, "")
        .replace(/[`*_~]/g, "");
      const slug = slugger(headingText);
      if (capturing) {
        if (level <= captureLevel) break;
        captured.push(line);
      } else if (slug === wantedSlug) {
        capturing = true;
        captureLevel = level;
        captured.push(line);
      }
      continue;
    }
    if (capturing) captured.push(line);
  }
  return { exists: capturing, text: captured.join("\n") };
}

export function locateQuoteContext(
  activeBody: string,
  quote: string,
  precomputedUnits?: ExtractedFactUnit[],
): string | undefined {
  const idx = activeBody.indexOf(quote);
  if (idx < 0) return undefined;
  const units = precomputedUnits ?? extractUnitsWithContext(activeBody);
  const overlapping = units.find((u) => u.end > idx && u.start < idx + quote.length);
  if (overlapping) return overlapping.context;
  const headings: { level: number; text: string }[] = [];
  let fence = "";
  let offset = 0;
  for (const rawLine of activeBody.split(/(?<=\n)/)) {
    if (offset > idx) break;
    offset += rawLine.length;
    const line = rawLine.replace(/\r?\n$/, "");
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = "";
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    const h = /^ {0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const text = h[2]!
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(EVIDENCE_MARK_RE, "")
        .replace(/[`*_~]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      while (headings.length > 0 && headings.at(-1)!.level >= level) headings.pop();
      headings.push({ level, text });
    }
  }
  return formatFactContext(headings.map((h) => h.text));
}

function buildSiblingPages(
  selfId: string,
  siblingWrites: SiblingWrite[] | undefined,
): Map<string, SiblingTargetPage> {
  const map = new Map<string, SiblingTargetPage>();
  for (const w of siblingWrites ?? []) {
    if (!w.after || !/^wiki\/(concepts|params|sources)\/[^/]+\.md$/.test(w.path)) continue;
    const parsed = parsePage(w.path.slice(5), w.after);
    if (!parsed.page || parsed.problems.length || parsed.page.fm.id === selfId) continue;
    const active = splitHistory(parsed.page.body).active;
    map.set(parsed.page.fm.id, { page: parsed.page, active, hash: digest(active) });
  }
  return map;
}

function projectSupersedeClaims(
  oldActive: string,
  claimSpans: { claim: { old: string; replacement: string }; start: number; end: number }[],
): string {
  if (!claimSpans.length) return oldActive;
  const sorted = [...claimSpans].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.start < sorted[i - 1]!.end) return oldActive;
  }
  let out = oldActive;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const s = sorted[i]!;
    out = out.slice(0, s.start) + s.claim.replacement + out.slice(s.end);
  }
  return out;
}

export function planPageFactDispositions(
  file: string,
  oldPage: WikiPage,
  newPage: WikiPage,
  revision: Revision | undefined,
  siblingWrites?: SiblingWrite[],
): PlannedFactDispositions {
  const oldActive = splitHistory(oldPage.body).active;
  const nextActive = splitHistory(newPage.body).active;
  const baseHash = digest(oldActive);
  const candidateHash = digest(nextActive);
  const oldGroups = extractSectionGroups(oldActive);
  const units = oldGroups.flatMap((g) => g.units);
  const siblings = buildSiblingPages(oldPage.fm.id, siblingWrites);
  const outgoingLinks = extractOutgoingWikiLinks(newPage, nextActive);

  for (const link of outgoingLinks) {
    if (!link.anchor) continue;
    const target = siblings.get(link.targetId);
    if (!target) continue;
    const section = sliceHeadingSection(target.active, link.anchor);
    if (!section.exists) {
      throw new Error(
        `旧页修订事实去向未闭合（${file}）：跨页拆分链接锚点 #${link.anchor} 在同批目标页 ${link.targetId} 中不存在`,
      );
    }
  }

  const claimSpans =
    revision?.kind === "supersede"
      ? revision.claims
          .map((claim) => {
            const start = oldActive.indexOf(claim.old);
            return { claim, start, end: start >= 0 ? start + claim.old.length : -1 };
          })
          .filter((c) => c.start >= 0)
      : [];

  const projectedActive = projectSupersedeClaims(oldActive, claimSpans);
  const projectedGroups = claimSpans.length > 0 ? extractSectionGroups(projectedActive) : oldGroups;
  const candGroups = extractSectionGroups(nextActive);

  const unitGlobalIdx = new Map<ExtractedFactUnit, number>();
  for (let i = 0; i < units.length; i++) unitGlobalIdx.set(units[i]!, i);

  const deterministic = new Map<number, FactDispositionEntry>();

  for (let i = 0; i < units.length; i++) {
    const unit = units[i]!;
    const fullClaim = claimSpans.find((c) => unit.start >= c.start && unit.end <= c.end);
    if (fullClaim) {
      deterministic.set(i, {
        pageId: oldPage.fm.id,
        baseHash,
        candidateHash,
        fact: unit.text,
        ...(unit.context ? { context: unit.context } : {}),
        outlet: "superseded",
        verification: "supersede-claim",
        claimOld: fullClaim.claim.old,
      });
      continue;
    }

    let remainderText = unit.text;
    let partialClaimOld: string | undefined;
    for (const c of claimSpans) {
      if (c.start < unit.end && c.end > unit.start) {
        const sub = oldActive.slice(Math.max(unit.start, c.start), Math.min(unit.end, c.end));
        if (sub) {
          remainderText = remainderText.replace(sub, " ");
          partialClaimOld ??= c.claim.old;
        }
      }
    }
    if (partialClaimOld && unit.kind !== "code") {
      const remainderNorm = normalizeVerbatim(remainderText);
      if (remainderNorm.replace(/[|\s]/g, "").length < 2) {
        deterministic.set(i, {
          pageId: oldPage.fm.id,
          baseHash,
          candidateHash,
          fact: unit.text,
          ...(unit.context ? { context: unit.context } : {}),
          outlet: "superseded",
          verification: "supersede-claim",
          claimOld: partialClaimOld,
        });
      }
    }
  }

  let lastMatchedCandGroupIdx = -1;
  for (const oldGroup of oldGroups) {
    const candGroupIdx = candGroups.findIndex((cg) => cg.sectionKey === oldGroup.sectionKey);
    if (candGroupIdx <= lastMatchedCandGroupIdx) continue;
    const candGroup = candGroups[candGroupIdx]!;
    const projGroup = projectedGroups.find((pg) => pg.sectionKey === oldGroup.sectionKey);
    if (!projGroup || projGroup.units.length !== oldGroup.units.length) continue;

    if (!oldGroup.isSourceSection) {
      const exactSectionMatch =
        projGroup.units.length === candGroup.units.length &&
        projGroup.units.every(
          (pu, k) =>
            pu.kind === candGroup.units[k]!.kind && pu.normalizedKey === candGroup.units[k]!.normalizedKey,
        );
      if (!exactSectionMatch) continue;
      lastMatchedCandGroupIdx = candGroupIdx;
      for (const u of oldGroup.units) {
        const gIdx = unitGlobalIdx.get(u)!;
        if (deterministic.has(gIdx)) continue;
        deterministic.set(gIdx, {
          pageId: oldPage.fm.id,
          baseHash,
          candidateHash,
          fact: u.text,
          ...(u.context ? { context: u.context } : {}),
          outlet: "retained",
          verification: "verbatim",
        });
      }
    } else {
      let matchedAny = oldGroup.units.length === 0;
      for (let k = 0; k < projGroup.units.length && k < candGroup.units.length; k++) {
        const pu = projGroup.units[k]!;
        const cu = candGroup.units[k]!;
        if (pu.kind !== cu.kind || pu.normalizedKey !== cu.normalizedKey) break;
        matchedAny = true;
        const u = oldGroup.units[k]!;
        const gIdx = unitGlobalIdx.get(u)!;
        if (deterministic.has(gIdx)) continue;
        deterministic.set(gIdx, {
          pageId: oldPage.fm.id,
          baseHash,
          candidateHash,
          fact: u.text,
          ...(u.context ? { context: u.context } : {}),
          outlet: "retained",
          verification: "verbatim",
        });
      }
      if (matchedAny) lastMatchedCandGroupIdx = candGroupIdx;
    }
  }

  const pendingUnits: PendingFactUnit[] = [];
  for (let i = 0; i < units.length; i++) {
    if (deterministic.has(i)) continue;
    const unit = units[i]!;
    pendingUnits.push({
      index: i,
      fact: unit.text,
      ...(unit.context ? { context: unit.context } : {}),
      headingPath: unit.headingPath,
      ...(unit.tableHeader ? { tableHeader: unit.tableHeader } : {}),
    });
  }

  return {
    pageId: oldPage.fm.id,
    oldActive,
    nextActive,
    baseHash,
    candidateHash,
    units,
    deterministic,
    pendingUnits,
    siblings,
    outgoingLinks,
  };
}

export function verifyFactDispositions(
  file: string,
  oldPage: WikiPage,
  newPage: WikiPage,
  revision: Revision,
  siblingWrites?: SiblingWrite[],
  sealedEntries?: FactDispositionEntry[],
): FactDispositionEntry[] {
  const plan = planPageFactDispositions(file, oldPage, newPage, revision, siblingWrites);
  if (!plan.units.length) return [];

  const provided = (
    sealedEntries ??
    (revision.kind === "editorial" || revision.kind === "supersede"
      ? revision.factDispositions
      : undefined) ??
    []
  ).filter((e) => e.pageId === plan.pageId);

  for (const entry of provided) {
    if (entry.baseHash !== plan.baseHash || entry.candidateHash !== plan.candidateHash) {
      throw new Error(`旧页修订事实去向未闭合（${file}）：回执候选 hash 已过期或不匹配`);
    }
  }

  const targetUnits = extractUnitsWithContext(plan.nextActive);
  const resolved = new Map<number, FactDispositionEntry>(plan.deterministic);
  const unresolved: string[] = [];

  for (const pending of plan.pendingUnits) {
    const exactMatches = provided.filter(
      (e) =>
        e.verification === "semantic-check" &&
        e.fact === pending.fact &&
        (e.context !== undefined ? e.context === pending.context : true),
    );
    const preferred =
      exactMatches.find((e) => e.context === pending.context) ??
      (exactMatches.length === 1 && plan.pendingUnits.filter((p) => p.fact === pending.fact).length === 1
        ? exactMatches[0]
        : undefined);

    if (!preferred || !preferred.reason?.trim() || !preferred.targetQuote?.trim()) {
      unresolved.push(pending.fact);
      continue;
    }

    if (preferred.outlet === "retained") {
      if (!plan.nextActive.includes(preferred.targetQuote)) {
        throw new Error(`旧页修订事实去向未闭合（${file}）：回执引文不存在于候选正文`);
      }
      const actualTargetCtx = locateQuoteContext(plan.nextActive, preferred.targetQuote, targetUnits);
      if (preferred.targetContext !== undefined && preferred.targetContext !== actualTargetCtx) {
        throw new Error(`旧页修订事实去向未闭合（${file}）：回执目标上下文与候选正文不一致`);
      }
      resolved.set(pending.index, {
        pageId: plan.pageId,
        baseHash: plan.baseHash,
        candidateHash: plan.candidateHash,
        fact: pending.fact,
        ...(pending.context ? { context: pending.context } : {}),
        outlet: "retained",
        verification: "semantic-check",
        targetQuote: preferred.targetQuote,
        ...(actualTargetCtx ? { targetContext: actualTargetCtx } : {}),
        reason: preferred.reason.trim(),
        ...(preferred.checkId ? { checkId: preferred.checkId } : {}),
      });
      continue;
    }

    if (preferred.outlet === "migrated") {
      if (!preferred.targetPage || !preferred.targetAnchor) {
        throw new Error(`旧页修订事实去向未闭合（${file}）：跨页迁移回执缺少 targetPage 或 targetAnchor`);
      }
      const target = plan.siblings.get(preferred.targetPage);
      if (!target) {
        throw new Error(
          `旧页修订事实去向未闭合（${file}）：跨页承接目标页 ${preferred.targetPage} 不在同批写入中`,
        );
      }
      if (preferred.targetCandidateHash !== target.hash) {
        throw new Error(
          `旧页修订事实去向未闭合（${file}）：跨页承接目标页 ${preferred.targetPage} 候选 hash 不匹配`,
        );
      }
      const wantedSlug = fragmentId(preferred.targetAnchor);
      const hasOutgoingLink = plan.outgoingLinks.some(
        (l) => l.targetId === preferred.targetPage && (!l.anchor || l.anchor === wantedSlug),
      );
      if (!hasOutgoingLink) {
        throw new Error(
          `旧页修订事实去向未闭合（${file}）：旧页缺少指向同批目标页 ${preferred.targetPage}#${wantedSlug} 的有效链接`,
        );
      }
      const section = sliceHeadingSection(target.active, wantedSlug);
      if (!section.exists || !section.text.includes(preferred.targetQuote)) {
        throw new Error(
          `旧页修订事实去向未闭合（${file}）：目标页 ${preferred.targetPage}#${wantedSlug} 章节不存在或不包含回执引文`,
        );
      }
      const targetCtx = locateQuoteContext(target.active, preferred.targetQuote);
      resolved.set(pending.index, {
        pageId: plan.pageId,
        baseHash: plan.baseHash,
        candidateHash: plan.candidateHash,
        fact: pending.fact,
        ...(pending.context ? { context: pending.context } : {}),
        outlet: "migrated",
        verification: "semantic-check",
        targetPage: preferred.targetPage,
        targetAnchor: preferred.targetAnchor,
        targetCandidateHash: target.hash,
        targetQuote: preferred.targetQuote,
        ...(targetCtx ? { targetContext: targetCtx } : {}),
        reason: preferred.reason.trim(),
        ...(preferred.checkId ? { checkId: preferred.checkId } : {}),
      });
      continue;
    }

    unresolved.push(pending.fact);
  }

  if (unresolved.length > 0) {
    throw new Error(
      `旧页修订事实去向未闭合（${file}）：以下事实或限定条件既未逐字保留且未获独立语义复核回执，也未由 supersede.claims 声明替代或迁入同批带有效锚点的关联新页：${unresolved.slice(0, 3).join(" ｜ ")}`,
    );
  }

  return plan.units.map((_, idx) => resolved.get(idx)!);
}

export function collectPageFactDispositions(
  file: string,
  before: string,
  after: string,
  revision: Revision | undefined,
  siblingWrites?: SiblingWrite[],
  sealedEntries?: FactDispositionEntry[],
): FactDispositionEntry[] {
  const oldParsed = parsePage(file, before);
  const newParsed = parsePage(file, after);
  if (!oldParsed.page || !newParsed.page) return [];
  if (revision && (revision.kind === "editorial" || revision.kind === "supersede")) {
    return verifyFactDispositions(
      file,
      oldParsed.page,
      newParsed.page,
      revision,
      siblingWrites,
      sealedEntries,
    );
  }
  const oldActive = splitHistory(oldParsed.page.body).active;
  const nextActive = splitHistory(newParsed.page.body).active;
  const baseHash = digest(oldActive);
  const candidateHash = digest(nextActive);
  const units = extractUnitsWithContext(oldActive);
  return units.map((u) => ({
    pageId: oldParsed.page!.fm.id,
    baseHash,
    candidateHash,
    fact: u.text,
    ...(u.context ? { context: u.context } : {}),
    outlet: "retained" as const,
    verification: "verbatim" as const,
  }));
}

export const factDispositionVerdictItemSchema = z
  .object({
    index: z.number().int().nonnegative(),
    preserved: z.boolean(),
    outlet: z.enum(["retained", "migrated"]).optional(),
    targetQuote: z.string().min(1).optional(),
    targetPage: z.string().min(1).optional(),
    targetAnchor: z.string().min(1).optional(),
    reason: z.string().min(1).max(2000),
  })
  .strict();

export const FACT_DISPOSITION_CHECK_RULES =
  '只返回严格 JSON。你是独立的旧页事实去向语义复核器，逐条核对 pendingFacts 中的完整语义块（连同其标题链 headingPath、表头 tableHeader、代码块注释与空白及行序）是否在候选页面（或同批关联目标页指定章节）中等价保留。任何条件反转、否定丢失、单位删减、版本/数值错位、主客体颠倒、块间上下文错配、代码语句重排、字符串空白篡改、注释条件删除、或移入反面/错误章节都必须判 preserved=false。等价改写或合法拆表保留时设 preserved=true、outlet="retained" 并给出候选正文中逐字存在的 targetQuote；合法跨页迁入同批 siblingTargets 且旧页带锚点链接时设 preserved=true、outlet="migrated" 并填写 targetPage、targetAnchor 与目标章节逐字存在的 targetQuote。';
