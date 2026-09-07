/**
 * pnpm wiki:audit --seeds wiki/seeds/<name>.yaml [--drafts]
 * 把页面（默认 concepts/ 与 sources/；--drafts 时改审 _drafts/）的每条来源
 * 拿到 tools/repos/ 下钉住的仓库里核对行号是否真实存在。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { auditPage, type RefAudit, summarize } from "./wiki/audit";
import { parseSeeds } from "./wiki/ingest";
import { loadPages, parsePage, type WikiPage } from "./wiki/pages";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const root = process.cwd();
const wikiRoot = join(root, "wiki");
const seedsPath = arg("--seeds");
if (!seedsPath) {
  console.error("用法：pnpm wiki:audit --seeds wiki/seeds/<name>.yaml [--drafts]");
  process.exit(2);
}
const seeds = parseSeeds(readFileSync(seedsPath, "utf8"));
const repoRoots: Record<string, string> = {};
for (const [name, r] of Object.entries(seeds.repos)) repoRoots[name] = resolve(root, r.path);

const useDrafts = process.argv.includes("--drafts");
let pages: WikiPage[] = [];
const schemaProblems: string[] = [];
if (useDrafts) {
  const dir = join(wikiRoot, "_drafts");
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .sort()) {
    const r = parsePage(`_drafts/${name}`, readFileSync(join(dir, name), "utf8"));
    if (r.page) pages.push(r.page);
    for (const p of r.problems) schemaProblems.push(`${p.file} [${p.rule}] ${p.message}`);
  }
} else {
  const r = loadPages(wikiRoot);
  pages = r.pages;
  for (const p of r.problems) schemaProblems.push(`${p.file} [${p.rule}] ${p.message}`);
}

const deps = {
  repoRoots,
  countLines: (repoRoot: string, path: string): number | null => {
    const abs = join(repoRoot, path);
    return existsSync(abs) ? readFileSync(abs, "utf8").split(/\r?\n/).length : null;
  },
  readRaw: (id: string): string => {
    const abs = join(wikiRoot, `raw/${id}.md`);
    return existsSync(abs) ? readFileSync(abs, "utf8") : "";
  },
};

const all: RefAudit[] = [];
for (const page of pages) {
  const audits = auditPage(page, deps);
  all.push(...audits);
  const bad = audits.filter((a) => a.verdict !== "ok" && a.verdict !== "url");
  const h2 = (page.body.match(/^## /gm) ?? []).length;
  console.log(
    `\n${page.file}  ${page.fm.title}  evidence=${page.fm.evidence}  章节=${page.fm.chapters.join(",") || "无"}  正文 ${page.body.length} 字 / ${h2} 节  来源 ${audits.length} 条${bad.length ? `  ✗ ${bad.length} 条有问题` : ""}`,
  );
  console.log(`  ${page.fm.summary}`);
  for (const a of audits) {
    const mark = a.verdict === "ok" ? "✓" : a.verdict === "url" ? "·" : "✗";
    const note = a.verdict === "ok" ? `文件 ${a.totalLines} 行` : a.verdict;
    console.log(`  ${mark} ${a.ref}  (${note})${a.inRaw ? "" : "  [raw 无对应片段]"}`);
  }
}

const s = summarize(all);
console.log(`\n审计 ${pages.length} 页，来源 ${all.length} 条`);
console.log(
  `  行号有效 ${s.ok}，URL ${s.url}，文件不存在 ${s["missing-file"]}，行号越界 ${s["out-of-range"]}，未知仓库 ${s["unknown-repo"]}，raw 缺片段 ${s.notInRaw}`,
);
for (const p of schemaProblems) console.error(`x ${p}`);
const failed = s["missing-file"] + s["out-of-range"] + s["unknown-repo"] + schemaProblems.length;
if (failed) {
  console.error(`\nwiki:audit 失败：${failed} 处`);
  process.exit(1);
}
console.log("ok wiki:audit 通过");
