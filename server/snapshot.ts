import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { buildRegistry, renderIndex } from "../scripts/wiki/build";
import { diagramRefs, loadDiagrams } from "../scripts/wiki/diagrams";
import { sliceHandbook } from "../scripts/wiki/handbook";
import { loadPages, parsePage } from "../scripts/wiki/pages";
import { readRawSnapshot } from "../scripts/wiki/raw";
import { listReviews } from "../scripts/wiki/review";
import { localFile } from "../scripts/wiki/review-files";
import { atomicText, digest, WorkflowStore } from "../scripts/wiki/workflow";
import { buildIndex } from "../src/content/wiki/retrieve";
import { parseRawRef, readerSnapshotSchema } from "../src/content/wiki/schema";

/** Each new request observes one complete publication; an interrupted publication is unavailable. */
export function readKnowledgeSnapshot(root: string) {
  return new WorkflowStore(root).locked(() => readKnowledgeSnapshotInLock(root));
}

/** Caller must hold WorkflowStore.locked; shared by reads and atomic result publication checks. */
export function readKnowledgeSnapshotInLock(root: string) {
  if (listReviews(root).some((r) => r.state === "publishing"))
    throw new Error("知识库发布尚未恢复，暂不接受新问答");
  const wiki = join(root, "wiki");
  const { pages: inventory, problems } = loadPages(wiki);
  if (problems.length) throw new Error("知识库页面不合法，暂不接受新问答");
  const pageTexts = inventory.map((page) => ({
    file: page.file,
    text: readFileSync(localFile(root, `wiki/${page.file}`), "utf8"),
  }));
  const pages = pageTexts.map((p) => {
    const parsed = parsePage(p.file, p.text);
    if (!parsed.page || parsed.problems.length) throw new Error("知识库页面在读取时改变，请重试");
    return parsed.page;
  });
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
  // 图也进快照：spec 是问答 agent 真正能读的那一份（nodes / edges 是显式的），
  // SVG 是渲染层读的那一份。两者都必须进 digest，否则改了图 revision 不变，
  // 快照保证就有个洞——问答会拿旧版本号引用新画面。
  const { diagrams, problems: diagramProblems } = loadDiagrams(wiki);
  if (diagramProblems.length) throw new Error("知识库图 spec 不合法，暂不接受新问答");
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
  return {
    revision,
    files,
    pageTexts,
    diagrams: diagramFiles
      .filter((f) => f.file.endsWith(".svg"))
      .map((f) => ({ id: f.file.slice("diagrams/".length, -".svg".length), svg: f.text })),
    registry,
    handbook: sliceHandbook(handbookText),
    index: buildIndex(registry.pages.map((page) => ({ ...page, text: textByFile.get(page.file)! }))),
  };
}

export type KnowledgeSnapshot = Awaited<ReturnType<typeof readKnowledgeSnapshot>>;

/** Shared payload for static builds and the live reader API. */
export async function readReaderSnapshot(root: string) {
  const { registry, pageTexts, revision, diagrams } = await readKnowledgeSnapshot(root);
  return readerSnapshotSchema.parse({ registry, pageTexts, revision, diagrams });
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
