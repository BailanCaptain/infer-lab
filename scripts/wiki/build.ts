/**
 * 派生物生成：index.md（人读目录）与 src/content/wiki/registry.json（前端读）。
 * 完全由 frontmatter 决定，不含时间戳，重复运行无 diff。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAPTER_TITLES } from "../../src/content/wiki/chapters";
import {
  type Backlink,
  INVERSE_KIND,
  PAGE_TYPES,
  type PageType,
  type Registry,
} from "../../src/content/wiki/schema";
import { loadPages, type WikiPage } from "./pages";

const TYPE_LABEL: Record<PageType, string> = {
  concept: "概念",
  feature: "特性",
  param: "参数",
  source: "来源",
  pr: "PR",
};

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

/**
 * 反向边由这里派生，页面里只写一个方向。
 *
 * 「A builds-on B」写在 A 上，B 自动得到「enables A」。对称的边（互斥、替代）
 * 两边都得到同一个关系名。note 原样带过去——它说的是这条边本身是什么关系，
 * 从哪头看都成立。
 */
export function deriveBacklinks(pages: WikiPage[]): Map<string, Backlink[]> {
  const out = new Map<string, Backlink[]>();
  const known = new Set(pages.map((p) => p.fm.id));
  for (const p of pages) {
    for (const r of p.fm.relations) {
      if (!known.has(r.to)) continue; // 断边由 lint 报，这里不生成半截数据
      const list = out.get(r.to) ?? [];
      list.push({ from: p.fm.id, kind: INVERSE_KIND[r.kind], note: r.note });
      out.set(r.to, list);
    }
  }
  for (const [, list] of out) {
    list.sort((a, b) => a.kind.localeCompare(b.kind) || a.from.localeCompare(b.from));
  }
  return out;
}

export function buildRegistry(pages: WikiPage[]): Registry {
  const backlinks = deriveBacklinks(pages);
  return {
    version: 1,
    pages: [...pages]
      .sort(byId)
      .map((p) => ({ ...p.fm, file: p.file, backlinks: backlinks.get(p.fm.id) ?? [] })),
  };
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
