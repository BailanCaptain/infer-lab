/**
 * 读 wiki 页面：gray-matter 解 frontmatter → 规范化（Date → 字符串）→ zod 校验。
 * 只负责 concepts/ 与 sources/；草稿由 ingest 引擎单独调用 parsePage。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import { type PageFrontmatter, pageFrontmatterSchema } from "../../src/content/wiki/schema";

export const PAGE_DIRS = ["concepts", "sources"] as const;

export interface WikiPage {
  /** 相对 wikiRoot 的 posix 路径 */
  file: string;
  fm: PageFrontmatter;
  body: string;
}

export interface PageProblem {
  file: string;
  rule: string;
  message: string;
}

function normalize(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  }
  return out;
}

export function parsePage(file: string, text: string): { page?: WikiPage; problems: PageProblem[] } {
  const problems: PageProblem[] = [];
  let data: Record<string, unknown>;
  let body: string;
  try {
    const m = matter(text);
    data = normalize(m.data as Record<string, unknown>);
    body = m.content;
  } catch (e) {
    return { problems: [{ file, rule: "schema", message: `frontmatter 解析失败：${(e as Error).message}` }] };
  }
  const r = pageFrontmatterSchema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join(".") || "frontmatter"}: ${i.message}`).join("；");
    return { problems: [{ file, rule: "schema", message: msg }] };
  }
  const stem = basename(file, ".md");
  if (stem !== r.data.id)
    problems.push({ file, rule: "id-file", message: `文件名 ${stem} 与 id ${r.data.id} 不一致` });
  return { page: { file, fm: r.data, body }, problems };
}

export function loadPages(wikiRoot: string): { pages: WikiPage[]; problems: PageProblem[] } {
  const pages: WikiPage[] = [];
  const problems: PageProblem[] = [];
  for (const dir of PAGE_DIRS) {
    const abs = join(wikiRoot, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)
      .filter((n) => n.endsWith(".md"))
      .sort()) {
      const file = `${dir}/${name}`;
      const r = parsePage(file, readFileSync(join(abs, name), "utf8"));
      if (r.page) pages.push(r.page);
      problems.push(...r.problems);
    }
  }
  return { pages, problems };
}
