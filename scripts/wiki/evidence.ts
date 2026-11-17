import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { type LockedEvidenceSnapshot, readLockedEvidenceSnapshot } from "../../server/snapshot";
import {
  type DiagramEvidenceGroup,
  type EvidenceEntry,
  formatSeedVersionLabel,
  normalizeRequestedLineRange,
  type ReaderPageEvidence,
  readerPageEvidenceSchema,
  repoSourceUrl,
  sortVersionLabels,
} from "../../src/content/wiki/evidence-schema";
import {
  parseRawRef,
  parseRepoRef,
  rawSourceHref,
  resolveCanonicalPageId,
  URL_RE,
} from "../../src/content/wiki/schema";
import { sourceLines } from "./audit";
import { diagramRefs, diagramSpecSchema, specPins } from "./diagrams";
import { createBlobReader, resetNegativeCommitCache, warmBlobs } from "./git";
import { readRawSnapshot } from "./raw";
import { collectSnapshotPublishedRawPaths } from "./raw-viewer";
import { configuredRefs, configuredRepoRoots, isGitRepoRoot } from "./repo-roots";

const MAX_WHOLE_FILE_LINES = 400;

function stripFrontmatter(text: string): string {
  if (!text.startsWith("---")) return text.trim();
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text.trim();
  const after = text.indexOf("\n", end + 1);
  return after < 0 ? "" : text.slice(after + 1).trim();
}

interface EvidenceBuildContext {
  root: string;
  locked: LockedEvidenceSnapshot;
  publishedRawPaths: Set<string>;
  pageTextByFile: Map<string, string>;
  filesByPath: Map<string, string>;
  repoRoots: Record<string, string>;
  refsByRepo: Record<string, Record<string, string>>;
  readBlob: ReturnType<typeof createBlobReader>;
}

function createEvidenceContext(root: string, locked: LockedEvidenceSnapshot): EvidenceBuildContext {
  return {
    root,
    locked,
    publishedRawPaths: collectSnapshotPublishedRawPaths(locked),
    pageTextByFile: new Map(locked.pageTexts.map((p) => [p.file, p.text])),
    filesByPath: new Map(locked.files.map((f) => [f.file, f.text])),
    repoRoots: configuredRepoRoots(root),
    refsByRepo: configuredRefs(root),
    readBlob: createBlobReader(),
  };
}

function warmRepoRefs(ctx: EvidenceBuildContext, refs: Iterable<string>): void {
  resetNegativeCommitCache();
  const byRoot = new Map<string, { commit: string; path: string }[]>();
  for (const ref of refs) {
    const parsed = parseRepoRef(ref);
    const repoRoot = parsed ? ctx.repoRoots[parsed.repo] : undefined;
    if (!parsed || !repoRoot || !isGitRepoRoot(repoRoot)) continue;
    let list = byRoot.get(repoRoot);
    if (!list) {
      list = [];
      byRoot.set(repoRoot, list);
    }
    list.push({ commit: parsed.commit, path: parsed.path });
  }
  for (const [repoRoot, requests] of byRoot) warmBlobs(repoRoot, requests);
}

function resolveVersionRefs(ctx: EvidenceBuildContext, repo: string, commit: string): string[] {
  const table = ctx.refsByRepo[repo];
  if (!table) return [];
  const matched: string[] = [];
  for (const [refName, seedCommit] of Object.entries(table)) {
    if (seedCommit.startsWith(commit) || commit.startsWith(seedCommit)) {
      matched.push(formatSeedVersionLabel(repo, refName));
    }
  }
  return sortVersionLabels(matched);
}

function resolveEvidenceEntry(ctx: EvidenceBuildContext, ref: string): EvidenceEntry | undefined {
  if (ref.startsWith("raw:")) {
    const raw = parseRawRef(ref);
    if (!raw) {
      return { ref, kind: "raw", status: "unavailable", reason: "invalid-raw-ref", rawViewerHref: null };
    }
    if (!ctx.publishedRawPaths.has(raw.path)) {
      return {
        ref,
        kind: "raw",
        status: "unavailable",
        reason: "unpublished-raw",
        path: raw.path,
        lineStart: raw.lineStart,
        lineEnd: raw.lineEnd,
        rawViewerHref: null,
      };
    }
    let rawText: string;
    try {
      rawText = readRawSnapshot(join(ctx.root, "wiki"), raw.path);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ref,
        kind: "raw",
        status: "unavailable",
        reason: msg.includes("不存在") ? "missing-raw" : "tampered-raw",
        path: raw.path,
        lineStart: raw.lineStart,
        lineEnd: raw.lineEnd,
        rawViewerHref: null,
      };
    }
    const allLines = sourceLines(rawText);
    const totalLines = allLines.length;
    if (raw.lineEnd > totalLines) {
      return {
        ref,
        kind: "raw",
        status: "unavailable",
        reason: "out-of-range",
        path: raw.path,
        lineStart: raw.lineStart,
        lineEnd: raw.lineEnd,
        totalLines,
        rawViewerHref: null,
      };
    }
    return {
      ref,
      kind: "raw",
      status: "ok",
      path: raw.path,
      lineStart: raw.lineStart,
      lineEnd: raw.lineEnd,
      totalLines,
      lines: allLines.slice(raw.lineStart - 1, raw.lineEnd).map((text, i) => ({
        number: raw.lineStart + i,
        text,
      })),
      rawViewerHref: rawSourceHref(ref),
    };
  }
  const repoRef = parseRepoRef(ref);
  if (repoRef) {
    const versionRefs = resolveVersionRefs(ctx, repoRef.repo, repoRef.commit);
    const externalHref = repoSourceUrl(repoRef);
    const range = normalizeRequestedLineRange(repoRef.lineStart, repoRef.lineEnd);
    const rangeMeta = range.kind === "valid" ? { lineStart: range.lineStart, lineEnd: range.lineEnd } : {};
    const repoRoot = ctx.repoRoots[repoRef.repo];
    if (!repoRoot || !isGitRepoRoot(repoRoot)) {
      return {
        ref,
        kind: "repo",
        status: "unavailable",
        reason: "unknown-repo",
        repo: repoRef.repo,
        commit: repoRef.commit,
        path: repoRef.path,
        versionRefs,
        ...rangeMeta,
        externalHref,
      };
    }
    const blob = ctx.readBlob(repoRoot, repoRef.commit, repoRef.path);
    if (blob.kind !== "ok") {
      return {
        ref,
        kind: "repo",
        status: "unavailable",
        reason: blob.kind,
        repo: repoRef.repo,
        commit: repoRef.commit,
        path: repoRef.path,
        versionRefs,
        ...rangeMeta,
        externalHref,
      };
    }
    const allLines = sourceLines(blob.text);
    const totalLines = allLines.length;
    if (range.kind === "invalid") {
      return {
        ref,
        kind: "repo",
        status: "unavailable",
        reason: "out-of-range",
        repo: repoRef.repo,
        commit: repoRef.commit,
        path: repoRef.path,
        versionRefs,
        totalLines,
        externalHref,
      };
    }
    if (range.kind === "valid") {
      if (range.lineEnd > totalLines) {
        return {
          ref,
          kind: "repo",
          status: "unavailable",
          reason: "out-of-range",
          repo: repoRef.repo,
          commit: repoRef.commit,
          path: repoRef.path,
          versionRefs,
          lineStart: range.lineStart,
          lineEnd: range.lineEnd,
          totalLines,
          externalHref,
        };
      }
      return {
        ref,
        kind: "repo",
        status: "ok",
        repo: repoRef.repo,
        commit: repoRef.commit,
        path: repoRef.path,
        versionRefs,
        lineStart: range.lineStart,
        lineEnd: range.lineEnd,
        totalLines,
        lines: allLines
          .slice(range.lineStart - 1, range.lineEnd)
          .map((text, i) => ({ number: range.lineStart + i, text })),
        externalHref,
      };
    }
    const end = Math.min(totalLines, MAX_WHOLE_FILE_LINES);
    return {
      ref,
      kind: "repo",
      status: "ok",
      repo: repoRef.repo,
      commit: repoRef.commit,
      path: repoRef.path,
      versionRefs,
      lineStart: 1,
      lineEnd: end,
      totalLines,
      lines: allLines.slice(0, end).map((text, i) => ({ number: i + 1, text })),
      externalHref,
    };
  }
  if (URL_RE.test(ref)) {
    return { ref, kind: "url", status: "external", externalHref: ref };
  }
  return undefined;
}

function extractPageDiagrams(ctx: EvidenceBuildContext, file: string): DiagramEvidenceGroup[] {
  const body = stripFrontmatter(ctx.pageTextByFile.get(file) ?? "");
  const groups: DiagramEvidenceGroup[] = [];
  for (const diagramId of new Set(diagramRefs(body))) {
    const specText = ctx.filesByPath.get(`diagrams/${diagramId}.yaml`);
    if (!specText) continue;
    const parsed = diagramSpecSchema.safeParse(parseYaml(specText));
    if (!parsed.success) continue;
    const pins = specPins(parsed.data).flatMap((pin, pinIndex) =>
      pin.source ? [{ pinIndex, ref: pin.source, symbols: [...pin.symbols] }] : [],
    );
    groups.push({ diagramId, caption: parsed.data.caption, pins });
  }
  return groups;
}

function buildPageInContext(
  ctx: EvidenceBuildContext,
  pageOrLegacyId: string,
  opts: { extraProbeRefs?: string[]; warm?: boolean } = {},
): ReaderPageEvidence | undefined {
  const canonicalId = resolveCanonicalPageId(ctx.locked.registry.pages, pageOrLegacyId);
  if (!canonicalId) return undefined;
  const fm = ctx.locked.registry.pages.find((p) => p.id === canonicalId);
  if (!fm) return undefined;
  const diagrams = extractPageDiagrams(ctx, fm.file);
  const refs = new Set<string>([
    ...fm.sources,
    ...diagrams.flatMap((d) => d.pins.map((p) => p.ref)),
    ...(opts.extraProbeRefs ?? []),
  ]);
  if (opts.warm !== false) warmRepoRefs(ctx, refs);
  const entries: Record<string, EvidenceEntry> = {};
  for (const ref of refs) {
    const resolved = resolveEvidenceEntry(ctx, ref);
    if (resolved) entries[ref] = resolved;
  }
  return readerPageEvidenceSchema.parse({
    version: 1,
    revision: ctx.locked.revision,
    pageId: canonicalId,
    pageSources: [...fm.sources],
    diagrams,
    entries,
  });
}

export function buildPageEvidenceFromLocked(
  root: string,
  locked: LockedEvidenceSnapshot,
  pageOrLegacyId: string,
  opts?: { extraProbeRefs?: string[] },
): ReaderPageEvidence | undefined {
  return buildPageInContext(createEvidenceContext(root, locked), pageOrLegacyId, opts);
}

export async function buildLockedPageEvidence(
  root: string,
  pageOrLegacyId: string,
  opts?: { extraProbeRefs?: string[] },
): Promise<ReaderPageEvidence | undefined> {
  const locked = await readLockedEvidenceSnapshot(root);
  return buildPageEvidenceFromLocked(root, locked, pageOrLegacyId, opts);
}

export function buildAllLockedEvidence(
  root: string,
  locked: LockedEvidenceSnapshot,
): Map<string, ReaderPageEvidence> {
  const ctx = createEvidenceContext(root, locked);
  const allRefs = new Set<string>();
  for (const page of locked.registry.pages) {
    for (const ref of page.sources) allRefs.add(ref);
    for (const group of extractPageDiagrams(ctx, page.file)) {
      for (const pin of group.pins) allRefs.add(pin.ref);
    }
  }
  warmRepoRefs(ctx, allRefs);
  const out = new Map<string, ReaderPageEvidence>();
  for (const page of locked.registry.pages) {
    const pack = buildPageInContext(ctx, page.id, { warm: false });
    if (pack) out.set(page.id, pack);
  }
  return out;
}
