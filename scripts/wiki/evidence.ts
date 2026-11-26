import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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
import { type BlobRead, createBlobReader, readBlobsAsync, resetNegativeCommitCache, warmBlobs } from "./git";
import { parsePage } from "./pages";
import { readRawSnapshot } from "./raw";
import { collectPublishedRawPathsFromPages, collectSnapshotPublishedRawPaths } from "./raw-viewer";
import { configuredRefs, configuredRepoRoots, isGitRepoRoot } from "./repo-roots";

const MAX_WHOLE_FILE_LINES = 400;

function stripFrontmatter(text: string): string {
  if (!text.startsWith("---")) return text.trim();
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text.trim();
  const after = text.indexOf("\n", end + 1);
  return after < 0 ? "" : text.slice(after + 1).trim();
}

/**
 * 同一 (项目根, revision) 复用的只读上下文。revision 是页面、图文件与 raw 快照的内容摘要，
 * 因此页面文本映射、图文件映射与已发布 raw 白名单在该键下不可变。
 */
interface SharedLockedContext {
  pageTextByFile: Map<string, string>;
  filesByPath?: Map<string, string>;
  /** 页文件 → 图证据分组（YAML 解析结果；revision 内不可变，装配时经 schema.parse 复制） */
  diagramsByFile: Map<string, DiagramEvidenceGroup[]>;
  published?: Set<string>;
  publishedTask?: Promise<Set<string>>;
}

/**
 * seeds 映射（仓库根 + 版本表）按文件原文复用解析结果：原文任何变化（含 clone 路径、ref 改钉）立即重解析，
 * 原文不变时省掉每次请求约 20ms 的 YAML 解析。fingerprint 参与在线证据缓存键。
 */
const seedsCache = new Map<
  string,
  {
    raw: string;
    repoRoots: Record<string, string>;
    refsByRepo: Record<string, Record<string, string>>;
    fingerprint: string;
  }
>();

function seedsConfig(root: string) {
  const dir = join(root, "wiki/seeds");
  let raw = "";
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .sort()) {
      raw += `${file}${String.fromCharCode(0)}${readFileSync(join(dir, file), "utf8")}${String.fromCharCode(0)}`;
    }
  }
  const key = resolve(root);
  const hit = seedsCache.get(key);
  if (hit && hit.raw === raw) return hit;
  const repoRoots = configuredRepoRoots(root);
  const refsByRepo = configuredRefs(root);
  const fresh = { raw, repoRoots, refsByRepo, fingerprint: JSON.stringify([repoRoots, refsByRepo]) };
  seedsCache.set(key, fresh);
  return fresh;
}

const MAX_SHARED_CONTEXTS = 4;
const sharedContexts = new Map<string, SharedLockedContext>();
const sharedKey = (root: string, revision: string) => [resolve(root), revision].join(String.fromCharCode(0));

function sharedContextFor(
  root: string,
  snap: {
    revision: string;
    pageTexts: { file: string; text: string }[];
    files?: { file: string; text: string }[];
  },
): SharedLockedContext {
  const key = sharedKey(root, snap.revision);
  const existing = sharedContexts.get(key);
  if (existing) {
    sharedContexts.delete(key);
    sharedContexts.set(key, existing);
    if (snap.files && !existing.filesByPath)
      existing.filesByPath = new Map(snap.files.map((f) => [f.file, f.text]));
    return existing;
  }
  const created: SharedLockedContext = {
    pageTextByFile: new Map(snap.pageTexts.map((p) => [p.file, p.text])),
    diagramsByFile: new Map(),
    ...(snap.files ? { filesByPath: new Map(snap.files.map((f) => [f.file, f.text])) } : {}),
  };
  sharedContexts.set(key, created);
  while (sharedContexts.size > MAX_SHARED_CONTEXTS)
    sharedContexts.delete(sharedContexts.keys().next().value!);
  return created;
}

/**
 * 与 collectSnapshotPublishedRawPaths 完全一致的白名单（逐页取并集，页序与页内顺序相同），
 * 但每处理约 8ms 就 setImmediate 让出事件循环：全库 Markdown 解析约 2s，不能整段阻塞在线请求。
 */
async function computePublishedRawPathsAsync(
  pageTexts: { file: string; text: string }[],
): Promise<Set<string>> {
  const out = new Set<string>();
  let sliceStart = performance.now();
  for (const entry of pageTexts) {
    const parsed = parsePage(entry.file, entry.text);
    if (parsed.page && !parsed.problems.length) {
      for (const path of collectPublishedRawPathsFromPages([parsed.page])) out.add(path);
    }
    if (performance.now() - sliceStart > 8) {
      await new Promise<void>((r) => setImmediate(r));
      sliceStart = performance.now();
    }
  }
  return out;
}

/** 异步取得 (root, revision) 的已发布 raw 白名单；并发调用共享同一个计算任务，失败后可重试。 */
export function publishedRawPathsAsync(
  root: string,
  snap: { revision: string; pageTexts: { file: string; text: string }[] },
): Promise<Set<string>> {
  const shared = sharedContextFor(root, snap);
  if (shared.published) return Promise.resolve(shared.published);
  if (!shared.publishedTask) {
    const task = computePublishedRawPathsAsync(snap.pageTexts).then((set) => {
      shared.published ??= set;
      return shared.published;
    });
    shared.publishedTask = task;
    task.catch(() => {
      if (shared.publishedTask === task) shared.publishedTask = undefined;
    });
  }
  return shared.publishedTask;
}

function publishedRawPathsSync(shared: SharedLockedContext, locked: LockedEvidenceSnapshot): Set<string> {
  shared.published ??= collectSnapshotPublishedRawPaths(locked);
  return shared.published;
}

interface EvidenceBuildContext {
  root: string;
  locked: LockedEvidenceSnapshot;
  shared: SharedLockedContext;
  /** 仅在遇到 raw 引用时求值；异步路径传入已算好的集合 */
  publishedRawPaths: () => Set<string>;
  repoRoots: Record<string, string>;
  refsByRepo: Record<string, Record<string, string>>;
  readBlob: (root: string, commit: string, path: string) => BlobRead;
}

function createEvidenceContext(root: string, locked: LockedEvidenceSnapshot): EvidenceBuildContext {
  const shared = sharedContextFor(root, locked);
  const seeds = seedsConfig(root);
  return {
    root,
    locked,
    shared,
    publishedRawPaths: () => publishedRawPathsSync(shared, locked),
    repoRoots: seeds.repoRoots,
    refsByRepo: seeds.refsByRepo,
    readBlob: createBlobReader(),
  };
}

function groupRepoRequests(
  ctx: Pick<EvidenceBuildContext, "repoRoots">,
  refs: Iterable<string>,
): Map<string, { commit: string; path: string }[]> {
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
  return byRoot;
}

function warmRepoRefs(ctx: EvidenceBuildContext, refs: Iterable<string>): void {
  resetNegativeCommitCache();
  for (const [repoRoot, requests] of groupRepoRequests(ctx, refs)) warmBlobs(repoRoot, requests);
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
    if (!ctx.publishedRawPaths().has(raw.path)) {
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
  const cached = ctx.shared.diagramsByFile.get(file);
  if (cached) return cached;
  const body = stripFrontmatter(ctx.shared.pageTextByFile.get(file) ?? "");
  const groups: DiagramEvidenceGroup[] = [];
  for (const diagramId of new Set(diagramRefs(body))) {
    const specText = ctx.shared.filesByPath?.get(`diagrams/${diagramId}.yaml`);
    if (!specText) continue;
    const parsed = diagramSpecSchema.safeParse(parseYaml(specText));
    if (!parsed.success) continue;
    const pins = specPins(parsed.data).flatMap((pin, pinIndex) =>
      pin.source ? [{ pinIndex, ref: pin.source, symbols: [...pin.symbols] }] : [],
    );
    groups.push({ diagramId, caption: parsed.data.caption, pins });
  }
  ctx.shared.diagramsByFile.set(file, groups);
  return groups;
}

/** 列举一页的全部证据引用：页 sources、图 pins（保持 pinIndex 与来源顺序）、可选探针引用。 */
function collectPageRefs(
  ctx: EvidenceBuildContext,
  pageOrLegacyId: string,
  extraProbeRefs: string[] = [],
):
  | {
      canonicalId: string;
      fm: LockedEvidenceSnapshot["registry"]["pages"][number];
      diagrams: DiagramEvidenceGroup[];
      refs: Set<string>;
    }
  | undefined {
  const canonicalId = resolveCanonicalPageId(ctx.locked.registry.pages, pageOrLegacyId);
  if (!canonicalId) return undefined;
  const fm = ctx.locked.registry.pages.find((p) => p.id === canonicalId);
  if (!fm) return undefined;
  const diagrams = extractPageDiagrams(ctx, fm.file);
  const refs = new Set<string>([
    ...fm.sources,
    ...diagrams.flatMap((d) => d.pins.map((p) => p.ref)),
    ...extraProbeRefs,
  ]);
  return { canonicalId, fm, diagrams, refs };
}

/** 按引用原顺序装配并校验证据包；repo 条目只经 ctx.readBlob 读取。 */
function assemblePack(ctx: EvidenceBuildContext, page: NonNullable<ReturnType<typeof collectPageRefs>>) {
  const entries: Record<string, EvidenceEntry> = {};
  for (const ref of page.refs) {
    const resolved = resolveEvidenceEntry(ctx, ref);
    if (resolved) entries[ref] = resolved;
  }
  return readerPageEvidenceSchema.parse({
    version: 1,
    revision: ctx.locked.revision,
    pageId: page.canonicalId,
    pageSources: [...page.fm.sources],
    diagrams: page.diagrams,
    entries,
  });
}

function buildPageInContext(
  ctx: EvidenceBuildContext,
  pageOrLegacyId: string,
  opts: { extraProbeRefs?: string[]; warm?: boolean } = {},
): ReaderPageEvidence | undefined {
  const page = collectPageRefs(ctx, pageOrLegacyId, opts.extraProbeRefs);
  if (!page) return undefined;
  if (opts.warm !== false) warmRepoRefs(ctx, page.refs);
  return assemblePack(ctx, page);
}

export function buildPageEvidenceFromLocked(
  root: string,
  locked: LockedEvidenceSnapshot,
  pageOrLegacyId: string,
  opts?: { extraProbeRefs?: string[] },
): ReaderPageEvidence | undefined {
  return buildPageInContext(createEvidenceContext(root, locked), pageOrLegacyId, opts);
}

const blobTableKey = (repoRoot: string, commit: string, path: string) =>
  [repoRoot, commit, path].join(String.fromCharCode(0));

/**
 * 非阻塞单页证据构建：Git 读取走异步批处理（按 repo 并行），已发布 raw 白名单分片计算且仅在页含
 * raw 引用时等待。装配阶段 repo 条目只查本批结果表——表里没有就是编程错误，绝不回落同步 git。
 */
export async function buildPageEvidenceFromLockedAsync(
  root: string,
  locked: LockedEvidenceSnapshot,
  pageOrLegacyId: string,
  opts: { extraProbeRefs?: string[] } = {},
): Promise<ReaderPageEvidence | undefined> {
  const shared = sharedContextFor(root, locked);
  const seeds = seedsConfig(root);
  const table = new Map<string, BlobRead>();
  let published: Set<string> | undefined;
  const ctx: EvidenceBuildContext = {
    root,
    locked,
    shared,
    publishedRawPaths: () => {
      if (!published) throw new Error("内部错误：已发布 raw 白名单尚未就绪");
      return published;
    },
    repoRoots: seeds.repoRoots,
    refsByRepo: seeds.refsByRepo,
    readBlob: (repoRoot, commit, path) => {
      const read = table.get(blobTableKey(repoRoot, commit, path));
      if (!read) throw new Error(`内部错误：未预取的源码引用 ${commit}:${path}`);
      return read;
    },
  };
  const page = collectPageRefs(ctx, pageOrLegacyId, opts.extraProbeRefs);
  if (!page) return undefined;
  const needsRaw = [...page.refs].some((ref) => ref.startsWith("raw:"));
  const [rawSet] = await Promise.all([
    needsRaw ? publishedRawPathsAsync(root, locked) : Promise.resolve(undefined),
    ...[...groupRepoRequests(ctx, page.refs)].map(async ([repoRoot, requests]) => {
      const reads = await readBlobsAsync(repoRoot, requests);
      requests.forEach(({ commit, path }, i) => {
        table.set(blobTableKey(repoRoot, commit, path), reads[i]!);
      });
    }),
  ]);
  published = rawSet;
  return assemblePack(ctx, page);
}

// ---------------------------------------------------------------------------
// 在线证据包缓存：(项目根, revision, canonicalId, seeds 指纹) → 成功包；同键在途任务单飞。
// ---------------------------------------------------------------------------

/** 依赖可在同一知识 revision 下改变（clone 补齐、fetch、raw 文件被改）的结论不长期缓存，只共享在途任务。 */
const VOLATILE_REASONS = new Set(["invalid-commit", "unknown-repo", "missing-raw", "tampered-raw"]);
const MAX_READY_PACKS = 256;
const readyPacks = new Map<string, { pack: ReaderPageEvidence; rawPaths: string[] }>();
const pendingPacks = new Map<string, Promise<ReaderPageEvidence | undefined>>();
let packGeneration = 0;

export function clearEvidenceCaches(): void {
  packGeneration++;
  readyPacks.clear();
  pendingPacks.clear();
  sharedContexts.clear();
  seedsCache.clear();
}

/** 命中缓存时重新校验 raw 快照完整性，避免锁定后被篡改的原文从旧缓存绕过检查。 */
function rawStillIntact(root: string, rawPaths: string[]): boolean {
  for (const path of rawPaths) {
    try {
      readRawSnapshot(join(root, "wiki"), path);
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * 在线入口（API 与 Vite 共用）：同键并发只构建一次；仅缓存依赖仍可验证的成功包。
 * extraProbeRefs 直接绕过公共整页缓存，避免探针条目泄入普通请求。
 */
export async function getPageEvidenceCached(
  root: string,
  locked: LockedEvidenceSnapshot,
  pageOrLegacyId: string,
  opts: { extraProbeRefs?: string[] } = {},
): Promise<ReaderPageEvidence | undefined> {
  if (opts.extraProbeRefs?.length)
    return buildPageEvidenceFromLockedAsync(root, locked, pageOrLegacyId, opts);
  const canonicalId = resolveCanonicalPageId(locked.registry.pages, pageOrLegacyId);
  if (!canonicalId) return undefined;
  const key = [resolve(root), locked.revision, canonicalId, seedsConfig(root).fingerprint].join(
    String.fromCharCode(0),
  );
  const ready = readyPacks.get(key);
  if (ready) {
    readyPacks.delete(key);
    if (rawStillIntact(root, ready.rawPaths)) {
      readyPacks.set(key, ready);
      return ready.pack;
    }
  }
  const inflight = pendingPacks.get(key);
  if (inflight) return inflight;
  const generation = packGeneration;
  const task = buildPageEvidenceFromLockedAsync(root, locked, canonicalId).then((pack) => {
    if (pack && generation === packGeneration) {
      const entries = Object.values(pack.entries);
      const volatile = entries.some((e) => e.status === "unavailable" && VOLATILE_REASONS.has(e.reason));
      if (!volatile) {
        const rawPaths = entries.flatMap((e) => (e.kind === "raw" && e.status === "ok" ? [e.path] : []));
        readyPacks.set(key, { pack, rawPaths: [...new Set(rawPaths)] });
        while (readyPacks.size > MAX_READY_PACKS) readyPacks.delete(readyPacks.keys().next().value!);
      }
    }
    return pack;
  });
  pendingPacks.set(key, task);
  const cleanup = () => {
    if (pendingPacks.get(key) === task) pendingPacks.delete(key);
  };
  task.then(cleanup, cleanup);
  return task;
}

export async function buildLockedPageEvidence(
  root: string,
  pageOrLegacyId: string,
  opts?: { extraProbeRefs?: string[] },
): Promise<ReaderPageEvidence | undefined> {
  const locked = await readLockedEvidenceSnapshot(root);
  return buildPageEvidenceFromLockedAsync(root, locked, pageOrLegacyId, opts);
}

/** 静态发布：一次全库预热后逐页装配（构建期同步执行即可）。 */
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
