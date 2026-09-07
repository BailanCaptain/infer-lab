/**
 * wiki 静态检查。规则清单与 HANDBOOK「Lint」切片一一对应。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { CHAPTER_IDS } from "../../src/content/wiki/chapters";
import { buildLayerTimeline } from "../../src/sim/model/forwardLayer";
import { getTokenPreset } from "../../src/sim/model/presets";
import { getPresetSpec } from "../../src/sim/modelspec/presets";
import { loadPages, type PageProblem, type WikiPage } from "./pages";

export interface LintOptions {
  chapterIds: string[];
  /** 相对 wikiRoot 的文件是否存在（正文链接可指向 raw/ 等非页面文件） */
  existsFile: (rel: string) => boolean;
  requiredTerms?: string[];
}

const LINK_RE = /\]\(([^)\s]+)\)/g;

function linkTargets(page: WikiPage): string[] {
  const dir = posix.dirname(page.file);
  const out: string[] = [];
  for (const m of page.body.matchAll(LINK_RE)) {
    const raw = m[1] ?? "";
    if (/^(https?:|mailto:|#)/.test(raw)) continue;
    out.push(posix.normalize(posix.join(dir, raw.split("#")[0] ?? "")));
  }
  return out;
}

export function lintPages(pages: WikiPage[], opts: LintOptions): PageProblem[] {
  const problems: PageProblem[] = [];
  const ids = new Map<string, WikiPage>();
  const files = new Set(pages.map((p) => p.file));
  const inbound = new Set<string>();

  for (const p of pages) {
    const prev = ids.get(p.fm.id);
    if (prev)
      problems.push({ file: p.file, rule: "dup-id", message: `id ${p.fm.id} 已被 ${prev.file} 使用` });
    else ids.set(p.fm.id, p);
  }
  const names = new Map<string, string>();
  for (const p of pages) names.set(p.fm.id.toLowerCase(), p.file);
  for (const p of pages) {
    for (const a of p.fm.aliases) {
      const key = a.toLowerCase();
      const owner = names.get(key);
      if (owner && owner !== p.file) {
        problems.push({ file: p.file, rule: "dup-alias", message: `alias「${a}」与 ${owner} 重复` });
      } else names.set(key, p.file);
    }
  }
  for (const p of pages) {
    for (const c of p.fm.chapters) {
      if (!opts.chapterIds.includes(c)) {
        problems.push({ file: p.file, rule: "unknown-chapter", message: `章节 ${c} 不存在` });
      }
    }
    for (const r of p.fm.related) {
      if (!ids.has(r)) {
        problems.push({ file: p.file, rule: "related-missing", message: `related 指向不存在的 ${r}` });
        continue;
      }
      inbound.add(r);
      // HANDBOOK「整合」要求 related 双向；只单边写会让图不连通
      if (!ids.get(r)?.fm.related.includes(p.fm.id)) {
        problems.push({
          file: p.file,
          rule: "related-asymmetric",
          message: `related 含 ${r}，但 ${r} 没有回指 ${p.fm.id}`,
        });
      }
    }
    for (const t of linkTargets(p)) {
      const target = pages.find((q) => q.file === t);
      if (target) inbound.add(target.fm.id);
      else if (!files.has(t) && !opts.existsFile(t)) {
        problems.push({ file: p.file, rule: "broken-link", message: `链接 ${t} 不存在` });
      }
    }
  }
  for (const p of pages) {
    const teach = p.fm.type === "concept" || p.fm.type === "feature";
    if (teach && !p.fm.chapters.length && !inbound.has(p.fm.id)) {
      problems.push({ file: p.file, rule: "orphan", message: "没有章节归属，也没有任何页链接到它" });
    }
  }
  for (const t of opts.requiredTerms ?? []) {
    if (!ids.has(t)) {
      problems.push({
        file: "src/sim/model/forwardLayer.ts",
        rule: "missing-term",
        message: `Step.terms 引用的 ${t} 没有页面`,
      });
    }
  }
  return problems;
}

const LOG_H2 = /^## \[\d{4}-\d{2}-\d{2}\] (ingest|build|review) \| .+$/;

export function lintLog(text: string): PageProblem[] {
  const out: PageProblem[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.startsWith("## ") && !LOG_H2.test(line)) {
      out.push({ file: "log.md", rule: "log-format", message: `第 ${i + 1} 行：${line}` });
    }
  });
  return out;
}

export function collectStepTerms(): string[] {
  const tl = buildLayerTimeline(getPresetSpec("qwen3-0.6b"), getTokenPreset());
  return [...new Set(tl.steps.flatMap((s) => s.terms))].sort();
}

export function runLint(rootDir: string, flags: { terms: boolean }): PageProblem[] {
  const wikiRoot = join(rootDir, "wiki");
  const { pages, problems } = loadPages(wikiRoot);
  const opts: LintOptions = { chapterIds: CHAPTER_IDS, existsFile: (rel) => existsSync(join(wikiRoot, rel)) };
  if (flags.terms) opts.requiredTerms = collectStepTerms();
  const logPath = join(wikiRoot, "log.md");
  const logProblems = existsSync(logPath) ? lintLog(readFileSync(logPath, "utf8")) : [];
  return [...problems, ...lintPages(pages, opts), ...logProblems];
}
