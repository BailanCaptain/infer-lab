/**
 * 派生物生成：index.md（人读目录）与 src/content/wiki/registry.json（前端读）。
 * 完全由 frontmatter 决定，不含时间戳，重复运行无 diff。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAPTER_TITLES } from "../../src/content/wiki/chapters";
import { PAGE_TYPES, type PageType, type Registry } from "../../src/content/wiki/schema";
import { loadPages, type WikiPage } from "./pages";

const TYPE_LABEL: Record<PageType, string> = { concept: "概念", feature: "特性", source: "来源", pr: "PR" };

const byId = (a: WikiPage, b: WikiPage) => a.fm.id.localeCompare(b.fm.id);
const link = (p: WikiPage) => `[${p.fm.title}](${p.file})`;

export function renderIndex(pages: WikiPage[]): string {
  const sorted = [...pages].sort(byId);
  const out: string[] = [
    "# Wiki 索引",
    "",
    `派生文件，由 \`pnpm wiki:build\` 生成，勿手改。共 ${sorted.length} 页。`,
    "",
  ];
  for (const type of PAGE_TYPES) {
    const group = sorted.filter((p) => p.fm.type === type);
    if (!group.length) continue;
    out.push(`## ${TYPE_LABEL[type]}（${type}）`);
    for (const p of group) {
      const ch = p.fm.chapters.length ? ` \`${p.fm.chapters.join(" ")}\`` : "";
      out.push(`- ${link(p)} — ${p.fm.summary}${ch}`);
    }
    out.push("");
  }
  out.push("## 按章节", "");
  for (const [id, title] of Object.entries(CHAPTER_TITLES)) {
    const group = sorted.filter((p) => p.fm.chapters.includes(id));
    if (!group.length) continue;
    out.push(`### ${id} ${title}`);
    for (const p of group) out.push(`- ${link(p)}`);
    out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}

export function buildRegistry(pages: WikiPage[]): Registry {
  return { version: 1, pages: [...pages].sort(byId).map((p) => ({ ...p.fm, file: p.file })) };
}

export function runBuild(rootDir: string): { pageCount: number; problems: number } {
  const wikiRoot = join(rootDir, "wiki");
  const { pages, problems } = loadPages(wikiRoot);
  for (const p of problems) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
  writeFileSync(join(wikiRoot, "index.md"), renderIndex(pages));
  const outDir = join(rootDir, "src/content/wiki");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "registry.json"), `${JSON.stringify(buildRegistry(pages), null, 2)}\n`);
  return { pageCount: pages.length, problems: problems.length };
}
