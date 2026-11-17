/**
 * 主章节直接使用知识库正文，磁盘正文、registry.json 与 wiki/index.md 必须双向一一对应。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectLegacyIdConflicts, formatLegacyIdConflict, registrySchema } from "../src/content/wiki/schema";
import { buildToc } from "../src/content/wiki/toc";
import { buildRegistry, renderIndex } from "./wiki/build";
import { loadPages } from "./wiki/pages";

export function checkContent(rootDir = process.cwd()): { pageCount: number; topicCount: number } {
  const registryPath = join(rootDir, "src/content/wiki/registry.json");
  if (!existsSync(registryPath)) {
    throw new Error("缺少知识库 registry.json，请先运行 pnpm wiki:build");
  }
  const rawRegistry = readFileSync(registryPath, "utf8");
  const r = registrySchema.safeParse(JSON.parse(rawRegistry));
  if (!r.success) {
    throw new Error(`registry.json 不合法：${r.error.issues[0]?.message}`);
  }

  const toc = buildToc(r.data.pages);
  const ordered = toc.flatMap((part) => part.sections.flatMap((section) => section.pages));
  if (
    ordered.length !== r.data.pages.length ||
    new Set(ordered.map((page) => page.id)).size !== ordered.length
  ) {
    throw new Error("主题目录必须完整收录各篇正文，且每页只出现一次");
  }
  for (const page of ordered) {
    if (!existsSync(join(rootDir, "wiki", page.file))) {
      throw new Error(`主章节正文不存在：${page.file}`);
    }
  }

  const wikiRoot = join(rootDir, "wiki");
  const { pages, problems } = loadPages(wikiRoot);
  if (problems.length > 0) {
    const first = problems[0]!;
    throw new Error(`知识库正文解析失败：${first.file} [${first.rule}] ${first.message}`);
  }
  const legacyConflicts = collectLegacyIdConflicts(
    pages.map((p) => ({ id: p.fm.id, file: p.file, legacyIds: p.fm.legacyIds })),
  );
  if (legacyConflicts.length > 0) {
    const first = legacyConflicts[0]!;
    throw new Error(`知识库 legacyIds 冲突：${first.file ?? first.pageId} ${formatLegacyIdConflict(first)}`);
  }

  const registeredFiles = new Set(r.data.pages.map((page) => page.file));
  const orphans = pages.map((page) => page.file).filter((file) => !registeredFiles.has(file));
  if (orphans.length > 0) {
    throw new Error(`磁盘存在未注册到 registry.json 的孤儿页：${orphans.join("、")}，请运行 pnpm wiki:build`);
  }

  const expectedRegistry = `${JSON.stringify(buildRegistry(pages), null, 2)}\n`;
  if (rawRegistry.replace(/\r\n/g, "\n") !== expectedRegistry) {
    throw new Error("src/content/wiki/registry.json 与磁盘正文不一致，请运行 pnpm wiki:build");
  }

  const indexPath = join(wikiRoot, "index.md");
  if (
    !existsSync(indexPath) ||
    readFileSync(indexPath, "utf8").replace(/\r\n/g, "\n") !== renderIndex(pages)
  ) {
    throw new Error("wiki/index.md 与磁盘正文不一致，请运行 pnpm wiki:build");
  }

  return { pageCount: r.data.pages.length, topicCount: toc.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { pageCount, topicCount } = checkContent();
    console.log(`ok 内容校验：registry ${pageCount} 页，与磁盘正文及 wiki/index.md 完全一致`);
    console.log(`ok 主章节：${topicCount} 个主题，${pageCount} 篇正文完整且无重复`);
  } catch (error) {
    console.error(`x ${(error as Error).message}`);
    process.exit(1);
  }
}
