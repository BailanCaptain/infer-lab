import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deserialize, serialize } from "node:v8";
import { buildRegistry, renderIndex } from "../scripts/wiki/build";
import { compileMarkdown } from "../scripts/wiki/compile-markdown";
import { diagramRefs, loadDiagrams } from "../scripts/wiki/diagrams";
import { sliceHandbook } from "../scripts/wiki/handbook";
import { loadPages, PAGE_DIRS, type PageProblem, parsePage } from "../scripts/wiki/pages";
import { readRawSnapshot } from "../scripts/wiki/raw";
import { listReviewSummaries } from "../scripts/wiki/review";
import { fileStamp, localFile } from "../scripts/wiki/review-files";
import { atomicText, digest, WorkflowStore } from "../scripts/wiki/workflow";
import { buildIndex } from "../src/content/wiki/retrieve";
import { parseRawRef, readerSnapshotSchema, type SkippedPage } from "../src/content/wiki/schema";

/** Each new request observes one complete publication; an interrupted publication is unavailable. */
export function readKnowledgeSnapshot(root: string) {
  return new WorkflowStore(root).locked(() => readKnowledgeSnapshotInLock(root));
}

/** Caller must hold WorkflowStore.locked; shared by reads and atomic result publication checks. */
export function readKnowledgeSnapshotInLock(root: string) {
  return cachedSnapshot(root, "reject");
}

/**
 * 有一页不合法时怎么办。问答（reject）要一份完整一致的知识，整份拒绝；
 * 读者（skip）把坏页拿出快照、记下原因，其余页照常显示。
 * 2026-10-02 前读者也走 reject：写手存了半页草稿，整站就打不开。
 */
type InvalidPagePolicy = "reject" | "skip";

const reasonOf = (problems: PageProblem[]) => problems.map((p) => `[${p.rule}] ${p.message}`).join("；");

type Snapshot = ReturnType<typeof collectSnapshot>["snapshot"];
const snapshots = new Map<string, { stamp: string; snapshot: Snapshot }>();

// Derived caches are disposable. Pin their producer too, so a parser/schema update cannot reuse old validation.
const implementation = digest([
  "server/snapshot.ts", "scripts/wiki/compile-markdown.ts", "scripts/wiki/build.ts", "scripts/wiki/diagrams.ts",
  "scripts/wiki/pages.ts", "scripts/wiki/raw.ts", "scripts/wiki/handbook.ts", "scripts/wiki/review-files.ts", "src/content/wiki/schema.ts",
  "src/content/wiki/markdown.ts", "src/content/wiki/anchors.ts", "src/content/wiki/evidenceMarks.ts",
  "src/content/wiki/retrieve.ts", "src/content/wiki/relations.ts", "pnpm-lock.yaml",
].map((path) => `${path}:${fileStamp(fileURLToPath(new URL(`../${path}`, import.meta.url)))}`).join("\n"));
const rawFiles = (snapshot: Snapshot) => snapshot.files.filter((f) => f.file.startsWith("raw/")).map((f) => `wiki/${f.file}`);
type PersistedSnapshot = { implementation: string; root: string; stamp: string; snapshot: Snapshot; chatSafe: boolean };
function readSharedSnapshot(root: string, policy: InvalidPagePolicy): PersistedSnapshot | undefined {
  try {
    const bytes = readFileSync(localFile(root, "tools/wiki-runtime/reader-snapshot.bin"));
    const payload = bytes.subarray(32);
    if (bytes.length < 32 || digest(payload) !== bytes.subarray(0, 32).toString("hex")) return;
    const cached = deserialize(payload) as PersistedSnapshot;
    if (cached.implementation !== implementation || cached.root !== resolve(root) || (policy === "reject" && !cached.chatSafe)) return;
    if (inputStamp(root, rawFiles(cached.snapshot)) !== cached.stamp) return;
    return cached;
  } catch { return; }
}
function persistSnapshot(root: string, entry: PersistedSnapshot): void {
  let temp: string | undefined;
  try {
    const path = localFile(root, "tools/wiki-runtime/reader-snapshot.bin");
    mkdirSync(dirname(path), { recursive: true });
    const payload = serialize(entry);
    temp = `${path}.${randomUUID()}.tmp`;
    writeFileSync(temp, Buffer.concat([Buffer.from(digest(payload), "hex"), payload]));
    renameSync(temp, path);
  } catch {
    // A read-only cache directory must not make valid knowledge unavailable.
  } finally {
    if (temp) {
      try { rmSync(temp, { force: true }); } catch { /* Disposable cache cleanup is best effort. */ }
    }
  }
}

function inputStamp(root: string, rawFiles: string[]): string {
  const stamps = ["wiki/HANDBOOK.md", ...rawFiles].map((path) => [path, fileStamp(localFile(root, path))]);
  for (const dir of [...PAGE_DIRS, "diagrams"]) {
    const full = localFile(root, `wiki/${dir}`);
    if (!existsSync(full)) continue;
    for (const name of readdirSync(full).sort())
      if (dir === "diagrams" ? /\.(yaml|svg)$/.test(name) : name.endsWith(".md"))
        stamps.push([`wiki/${dir}/${name}`, fileStamp(join(full, name))]);
  }
  return JSON.stringify(stamps);
}

/** Called under the publication lock. Inventory checks include additions, removals and archived evidence. */
function cachedSnapshot(root: string, policy: InvalidPagePolicy) {
  if (listReviewSummaries(root).some((r) => r.state === "publishing"))
    throw new Error("知识库发布尚未恢复，暂不接受新问答");
  const key = `${resolve(root)}:${policy}`;
  const cached = snapshots.get(key);
  if (cached) {
    try {
      if (inputStamp(root, rawFiles(cached.snapshot)) === cached.stamp) return cached.snapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const shared = readSharedSnapshot(root, policy);
  if (shared) {
    snapshots.set(key, shared);
    if (shared.chatSafe) {
      snapshots.set(`${resolve(root)}:reject`, shared);
      snapshots.set(`${resolve(root)}:skip`, shared);
    }
    return shared.snapshot;
  }
  const before = inputStamp(root, []);
  const { snapshot, chatSafe } = collectSnapshot(root, policy);
  if (inputStamp(root, []) !== before) throw new Error("知识库在读取时改变，请重试");
  const entry = { stamp: inputStamp(root, rawFiles(snapshot)), snapshot };
  persistSnapshot(root, { ...entry, implementation, root: resolve(root), chatSafe });
  snapshots.set(key, entry);
  // A complete reader snapshot already has the validated retrieval index needed by chat.
  if (chatSafe) {
    snapshots.set(`${resolve(root)}:reject`, entry);
    snapshots.set(`${resolve(root)}:skip`, entry);
  }
  return snapshot;
}

function collectSnapshot(root: string, policy: InvalidPagePolicy) {
  const wiki = join(root, "wiki");
  const skipped: SkippedPage[] = [];
  // id 取文件名：frontmatter 坏了读不出 id，而路由 #/wiki/<id> 本来就要求 id 与文件名一致
  const invalid = (rejectMessage: string, file: string, reason: string) => {
    if (policy === "reject") throw new Error(rejectMessage);
    skipped.push({ id: basename(file, ".md"), file, reason });
  };
  const { pages: inventory, problems } = loadPages(wiki);
  const badFiles = new Set(problems.map((p) => p.file));
  for (const file of badFiles)
    invalid(
      "知识库页面不合法，暂不接受新问答",
      file,
      reasonOf(problems.filter((p) => p.file === file)),
    );
  const read = inventory
    .filter((page) => !badFiles.has(page.file))
    .flatMap((page) => {
      const text = readFileSync(localFile(root, `wiki/${page.file}`), "utf8");
      const parsed = parsePage(page.file, text);
      if (parsed.page && !parsed.problems.length) return [{ text, page: parsed.page }];
      invalid("知识库页面在读取时改变，请重试", page.file, reasonOf(parsed.problems));
      return [];
    });
  // 图也进快照：spec 是问答 agent 真正能读的那一份（nodes / edges 是显式的），
  // SVG 是渲染层读的那一份。两者都必须进 digest，否则改了图 revision 不变，
  // 快照保证就有个洞——问答会拿旧版本号引用新画面。
  const { diagrams, problems: diagramProblems } = loadDiagrams(wiki);
  if (policy === "reject" && diagramProblems.length) throw new Error("知识库图 spec 不合法，暂不接受新问答");
  const brokenDiagrams = new Set(diagramProblems.map((p) => basename(p.file, ".yaml")));
  const diagramIssue = (id: string): string[] => {
    const diagram = diagrams.get(id);
    if (!diagram) return [`正文引用的图 ${id} 不存在`];
    if (brokenDiagrams.has(id)) return [`正文引用的图 ${id} 的 spec 不合法`];
    if (!existsSync(localFile(root, `wiki/${diagram.svgFile}`))) return [`正文引用的图 ${id} 还没有 SVG`];
    return [];
  };
  const kept = read.filter(({ page }) => {
    const issues = [...new Set(diagramRefs(page.body))].flatMap(diagramIssue);
    if (!issues.length) return true;
    invalid(issues[0] ?? "", page.file, issues.join("；"));
    return false;
  });
  const pages = kept.map((r) => r.page);
  const pageTexts = kept.map((r) => ({ file: r.page.file, text: r.text }));
  const compiledPages = Object.fromEntries(kept.map((r) => [r.page.file, compileMarkdown(r.page.body.trim())]));
  const registry = buildRegistry(pages);
  const handbookText = readFileSync(localFile(root, "wiki/HANDBOOK.md"), "utf8");
  const indexMd = renderIndex(pages);
  const rawPaths = new Set(
    pages.flatMap((p) => [
      ...(p.fm.rawSources ?? []),
      ...p.fm.sources.flatMap((ref) => {
        const raw = parseRawRef(ref);
        return raw ? [raw.path] : [];
      }),
    ]),
  );
  const diagramFiles = [...new Set(pages.flatMap((p) => diagramRefs(p.body)))].sort().flatMap((id) => {
    const diagram = diagrams.get(id);
    if (!diagram) throw new Error(`正文引用的图 ${id} 不存在`);
    return [diagram.specFile, diagram.svgFile].map((file) => ({
      file,
      text: readFileSync(localFile(root, `wiki/${file}`), "utf8"),
    }));
  });
  const files = [
    ...pageTexts,
    { file: "index.md", text: indexMd },
    { file: "HANDBOOK.md", text: handbookText },
    ...[...rawPaths].map((file) => ({ file, text: readRawSnapshot(wiki, file) })),
    ...diagramFiles,
  ].sort((a, b) => a.file.localeCompare(b.file));
  const revision = digest(JSON.stringify(files));
  const textByFile = new Map(pageTexts.map((p) => [p.file, p.text]));
  const snapshot = {
    revision,
    files,
    pageTexts,
    compiledPages,
    diagrams: diagramFiles
      .filter((f) => f.file.endsWith(".svg"))
      .map((f) => ({ id: f.file.slice("diagrams/".length, -".svg".length), svg: f.text })),
    registry,
    handbook: sliceHandbook(handbookText),
    index: buildIndex(registry.pages.map((page) => ({ ...page, text: textByFile.get(page.file)! }))),
    skipped,
  };
  return { snapshot, chatSafe: !skipped.length && !diagramProblems.length };
}

export type KnowledgeSnapshot = Awaited<ReturnType<typeof readKnowledgeSnapshot>>;

const readerSnapshots = new WeakMap<Snapshot, ReturnType<typeof readerSnapshotSchema.parse>>();

/** Shared payload for static builds and the live reader API. Invalid pages are skipped, not fatal. */
export async function readReaderSnapshot(root: string) {
  const snapshot = await new WorkflowStore(root).locked(() => cachedSnapshot(root, "skip"));
  const cached = readerSnapshots.get(snapshot);
  if (cached) return cached;
  const reader = readerSnapshotSchema.parse({
    ...snapshot,
    pageTexts: snapshot.pageTexts.map((page) => ({ ...page, compiled: snapshot.compiledPages[page.file] })),
  });
  readerSnapshots.set(snapshot, reader);
  return reader;
}

/** An atomic ready pointer exposes a complete immutable directory, without a Windows directory rename. */
export async function materializeSnapshot(root: string, snapshot: KnowledgeSnapshot): Promise<string> {
  const store = new WorkflowStore(root);
  const base = "tools/wiki-runtime/knowledge";
  if (!/^[a-f0-9]{64}$/.test(snapshot.revision)) throw new Error("快照版本无效");
  const pointer = localFile(root, `${base}/${snapshot.revision}.json`);
  const name = `object-${randomUUID()}`;
  const staging = localFile(root, `${base}/${name}`);
  const readCached = () => {
    if (digest(JSON.stringify(snapshot.files)) !== snapshot.revision) throw new Error("快照内容与版本不一致");
    let destination = localFile(root, `${base}/${snapshot.revision}`);
    if (existsSync(pointer)) {
      const object = JSON.parse(readFileSync(pointer, "utf8")) as unknown;
      if (typeof object !== "string" || !/^object-[a-f0-9-]{36}$/.test(object))
        throw new Error("快照就绪指针无效");
      destination = localFile(root, `${base}/${object}`);
      if (!existsSync(destination)) throw new Error("快照就绪指针的目录缺失");
    }
    // Previously materialized revisions remain usable with exactly the same bytes and cwd.
    if (existsSync(destination)) {
      verifySnapshot(root, destination, snapshot);
      return destination;
    }
    return undefined;
  };
  const cached = await store.locked(readCached);
  if (cached) return cached;
  let retained = false;
  try {
    mkdirSync(staging, { recursive: true });
    for (const { file, text } of snapshot.files) {
      const path = localFile(staging, file);
      mkdirSync(dirname(path), { recursive: true });
      atomicText(path, text);
    }
    verifySnapshot(root, staging, snapshot);
    return await store.locked(() => {
      const other = readCached();
      if (other) return other;
      atomicText(pointer, JSON.stringify(name));
      retained = true;
      return staging;
    });
  } finally {
    const inside = relative(resolve(root, base), resolve(staging));
    if (inside !== name) throw new Error("快照暂存目录越界");
    if (!retained) rmSync(staging, { recursive: true, force: true });
  }
}

export function verifySnapshot(root: string, location: string, snapshot: KnowledgeSnapshot): void {
  const expected = new Map(snapshot.files.map((p) => [p.file, p.text]));
  const visit = (path: string) => {
    for (const entry of readdirSync(
      localFile(root, relative(root, join(location, path)).replace(/\\/g, "/")),
      { withFileTypes: true },
    )) {
      const file = path ? `${path}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error("快照中存在链接");
      if (entry.isDirectory()) visit(file);
      else if (expected.get(file) !== readFileSync(join(location, file), "utf8"))
        throw new Error("快照被修改或含额外文件");
      else expected.delete(file);
    }
  };
  visit("");
  if (expected.size) throw new Error("快照缺少文件");
}
