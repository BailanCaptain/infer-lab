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
import { classifySource, supportsOfficialEvidence } from "./sources";

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

/**
 * 各页型的必需 H2，与 HANDBOOK「页面格式」一一对应。
 * 改这里之前先改 HANDBOOK——规则的真相源是那份文件，这里只是执行。
 */
const REQUIRED_SECTIONS: Record<string, string[]> = {
  concept: ["一句话", "为什么需要它", "怎么工作", "事实表", "常见误解", "接着看"],
  feature: ["一句话", "为什么需要它", "怎么工作", "事实表", "常见误解", "接着看"],
  param: ["一句话", "事实表", "为什么存在", "开了的代价", "接着看"],
};

/** 2026-09-11 改版前的四节格式，用于识别待迁移的旧页 */
const LEGACY_SECTIONS = ["是什么", "形状与数值", "在哪一步出现", "常见误解"];

const H2_RE = /^##\s+(.+?)\s*$/gm;
const PLACEHOLDER_RE = /\{\{[^}]*\}\}/;
const MERMAID_RE = /```mermaid\r?\n([\s\S]*?)```/g;
/** 图里出现的文件名，如 attention_v1.py、block_table.py */
const DIAGRAM_FILE_RE = /[A-Za-z0-9_./-]+\.(?:py|ts|cpp|h|md)/g;
const MAX_WHATSNEXT = 5;

function sectionsOf(body: string): string[] {
  return [...body.matchAll(H2_RE)].map((m) => (m[1] ?? "").trim());
}

/** 取「接着看」一节的正文（到下一个 H2 或文末） */
function whatsNextBlock(body: string): string | null {
  const i = body.indexOf("## 接着看");
  if (i < 0) return null;
  const rest = body.slice(i + "## 接着看".length);
  const next = rest.search(/^##\s/m);
  return next < 0 ? rest : rest.slice(0, next);
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
  // ---------- HANDBOOK 新规则（Task 29）----------
  for (const p of pages) {
    const required = REQUIRED_SECTIONS[p.fm.type];
    if (required) {
      const have = new Set(sectionsOf(p.body));
      // 2026-09-11 页面格式改版前的旧四节页：只报一条 legacy-format，不逐节刷屏。
      // 它们要 AC5 重跑才会变成新格式，在那之前既不该被静默放过，也不该阻塞无关工作。
      if (LEGACY_SECTIONS.every((h) => have.has(h))) {
        problems.push({
          file: p.file,
          rule: "legacy-format",
          message: "旧四节格式，待 AC5 重跑为新格式",
        });
        continue;
      }
      const missing = required.filter((h) => !have.has(h));
      if (missing.length > 0) {
        problems.push({
          file: p.file,
          rule: "missing-section",
          message: `缺必需小节：${missing.join("、")}`,
        });
      }
    }

    const block = whatsNextBlock(p.body);
    if (block) {
      const items = block.split(/\r?\n/).filter((l) => /^\s*[-*]\s/.test(l)).length;
      if (items > MAX_WHATSNEXT) {
        problems.push({
          file: p.file,
          rule: "whatsnext-overflow",
          message: `接着看 ${items} 条，超过 ${MAX_WHATSNEXT} 条上限`,
        });
      }
    }

    if (PLACEHOLDER_RE.test(p.body)) {
      problems.push({
        file: p.file,
        rule: "unexpanded-placeholder",
        message: "正文残留 {{ }} 占位符——本地文档的变量要去官网取展开值，否则会给出跑不了的命令",
      });
    }

    for (const q of p.fm.prerequisites) {
      if (!ids.has(q)) {
        problems.push({
          file: p.file,
          rule: "prerequisites-missing",
          message: `prerequisites 指向不存在的 ${q}`,
        });
      }
    }

    // 能读什么不限，能引什么才限——白名单见 HANDBOOK「可引来源」，
    // 与 sources.ts 的 CITABLE_DOMAINS 由测试锁住一致
    const kinds = p.fm.sources.map((x) => ({ ref: x, kind: classifySource(x) }));
    const unlisted = kinds.filter((k) => k.kind === "unlisted");
    if (unlisted.length > 0) {
      // 白名单管的是「什么配得上高等级证据」，不是「什么都不许引」。
      // 引一篇博客并诚实标成推断（I）是有用的——它告诉读者这个理解从哪来、
      // 且没能从一手来源确认。真问题是拿博客冒充官方实证。
      const highEvidence = p.fm.evidence === "S" || p.fm.evidence === "C";
      const allUnlisted = unlisted.length === p.fm.sources.length;
      const refs = unlisted.map((u) => u.ref).join("、");
      if (highEvidence) {
        problems.push({
          file: p.file,
          rule: "source-domain",
          message: `${refs} 不在可引来源白名单里，撑不起 evidence ${p.fm.evidence}——降到 D/I 或换一手来源`,
        });
      } else if (allUnlisted) {
        problems.push({
          file: p.file,
          rule: "source-domain",
          message: "全部来源都不在白名单里，这页没有任何可核对的一手依据",
        });
      } else {
        problems.push({
          file: p.file,
          rule: "source-unlisted",
          message: `${refs} 不在白名单里（配 evidence ${p.fm.evidence} 可以，人审时留意）`,
        });
      }
    }

    // 页级 evidence 要与主体来源一致。引了一两条文档不该逼着改标签——
    // 试点 7 页就是源码 15 条、文档 2 条，标 C 是对的（2026-09-11 实测）。
    // 「官方文档来源」= 仓库里的 docs/ 本地副本，或官方/论文档的 URL。
    // 生态站（PyTorch、HF 等）不算——它们能引，但不是本项目的权威说法。
    const docCount = p.fm.sources.filter(
      (x) => x.includes(":docs/") || supportsOfficialEvidence(classifySource(x)),
    ).length;
    const otherCount = p.fm.sources.length - docCount;
    const hasOfficial = kinds.some((k) => supportsOfficialEvidence(k.kind));
    if (docCount > otherCount && p.fm.evidence !== "S") {
      problems.push({
        file: p.file,
        rule: "doc-evidence",
        message: `主体来源是官方文档（${docCount}/${p.fm.sources.length}）但 evidence 是 ${p.fm.evidence}`,
      });
    } else if (p.fm.evidence === "S" && !hasOfficial) {
      problems.push({
        file: p.file,
        rule: "doc-evidence",
        message: "evidence 标 S 但没有「官方」或「论文」档的来源——生态站撑不起 S",
      });
    }

    // 图里标的文件必须在 sources 覆盖范围内，防止为了画得好看编造盒子
    const covered = p.fm.sources.map((x) => x.split("#")[0] ?? "");
    for (const m of p.body.matchAll(MERMAID_RE)) {
      for (const file of (m[1] ?? "").match(DIAGRAM_FILE_RE) ?? []) {
        if (!covered.some((c) => c.endsWith(file) || c.includes(file))) {
          problems.push({
            file: p.file,
            rule: "diagram-identifier",
            message: `图里的 ${file} 不在 sources 覆盖范围内`,
          });
        }
      }
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
