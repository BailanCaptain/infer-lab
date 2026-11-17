/**
 * pnpm wiki:audit [--seeds wiki/seeds/<name>.yaml] [--drafts]
 * 不给 --seeds 时认 wiki/seeds/ 下全部 seeds 声明的仓库（与 wiki:lint、wiki:stage 同一个来源）；
 * 以前必须点名一份 seeds，而三份 seeds 的仓库表互不包含，点错一份就报几十处「未知仓库」。
 * 把页面（默认 concepts/ 与 sources/；--drafts 时改审 _drafts/）的每条来源
 * 拿到 tools/repos/ 下钉住的仓库里核对行号是否真实存在。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditPage, type RefAudit, summarize, warmPageSources } from "./wiki/audit";
import { auditDiagrams } from "./wiki/diagram-audit";
import { loadDiagrams } from "./wiki/diagrams";
import { createBlobReader } from "./wiki/git";
import { loadPages, parsePage, type WikiPage } from "./wiki/pages";
import { readPageRaw, readRawSnapshot } from "./wiki/raw";
import { configuredRepoRoots } from "./wiki/repo-roots";
import {
  auditStandard,
  bodyLineOffset,
  formatStandard,
  formatStandardAuditSummary,
  loadStandardConfig,
} from "./wiki/standard";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const root = process.cwd();
const wikiRoot = join(root, "wiki");
const repoRoots = configuredRepoRoots(root, arg("--seeds"));

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

const { diagrams, problems: diagramProblems } = loadDiagrams(wikiRoot);

const deps = {
  repoRoots,
  readBlob: createBlobReader(),
  diagrams,
  readRaw: (id: string, paths?: string[]): string => readPageRaw(wikiRoot, id, paths),
  readSnapshot: (path: string): string => readRawSnapshot(wikiRoot, path),
};

warmPageSources(pages, repoRoots, diagrams);
const all: RefAudit[] = [];
const symbolProblems = [...diagramProblems, ...auditDiagrams(pages, deps)];
for (const p of symbolProblems) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
// 写作标准：只对 scripts/wiki/standard-pages.json 名单里的页强制，其余页只统计
const standardConfig = loadStandardConfig();
const standard = auditStandard(
  pages.map((p) => ({
    ...p,
    lineOffset: bodyLineOffset(readFileSync(join(wikiRoot, p.file), "utf8"), p.body),
  })),
  standardConfig,
  diagrams,
);
const standardByFile = new Map(standard.enforced.map((e) => [e.file, e]));
for (const page of pages) {
  const audits = auditPage(page, deps);
  all.push(...audits);
  const bad = audits.filter((a) => a.verdict !== "ok" && a.verdict !== "url");
  const h2 = (page.body.match(/^## /gm) ?? []).length;
  console.log(
    `\n${page.file}  ${page.fm.title}  evidence=${page.fm.evidence}  章节=${page.fm.chapters.join(",") || "无"}  正文 ${page.body.length} 字 / ${h2} 节  来源 ${audits.length} 条${bad.length ? `  ✗ ${bad.length} 条有问题` : ""}`,
  );
  console.log(`  ${page.fm.summary}`);
  const std = standardByFile.get(page.file);
  if (std) console.log(`  写作标准 ${formatStandard(std.measure, standardConfig, std.skip)}`);
  for (const a of audits) {
    const mark = a.verdict === "ok" ? "✓" : a.verdict === "url" ? "·" : "✗";
    const note = a.verdict === "ok" ? `文件 ${a.totalLines} 行` : a.verdict;
    console.log(
      `  ${mark} ${a.ref}  (${note})${a.inRaw ? "" : "  [raw 未定位同版本完整引用，摘录尚未验证]"}`,
    );
  }
}

const s = summarize(all);
console.log(`\n审计 ${pages.length} 页，来源 ${all.length} 条`);
console.log(
  `  行号有效 ${s.ok}，URL 未联网验证 ${s.url}，无效 commit ${s["invalid-commit"]}，文件不存在 ${s["missing-file"]}，行号越界 ${s["out-of-range"]}，未知仓库 ${s["unknown-repo"]}，raw 引用待核对 ${s.notInRaw}`,
);
const standardSummary = formatStandardAuditSummary(standard);
console.log(standardSummary.summaryLine);
if (standard.missing.length) console.log(`  名单里这些页本次没有读到：${standard.missing.join("、")}`);
for (const line of standardSummary.advisoryLines) console.warn(line);
for (const p of schemaProblems) console.error(`x ${p}`);
for (const line of standardSummary.problemLines) console.error(line);
const failed =
  s["invalid-commit"] +
  s["missing-file"] +
  s["out-of-range"] +
  s["unknown-repo"] +
  schemaProblems.length +
  symbolProblems.length +
  standard.problems.length;
if (failed) {
  console.error(`\nwiki:audit 失败：${failed} 处`);
  process.exit(1);
}
console.log(
  "ok wiki:audit 本地引用与行号校验、名单页写作标准通过（URL、raw 摘录内容和结论语义不在本次通过范围内）",
);
