/**
 * wiki 静态检查。规则清单与 HANDBOOK「Lint」切片一一对应。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { fragmentId } from "../../src/content/wiki/anchors";
import { CHAPTER_IDS } from "../../src/content/wiki/chapters";
import { EVIDENCE_MARK_RE, NUMBERED_EVIDENCE_LEVELS } from "../../src/content/wiki/evidenceMarks";
import { WIKI_REHYPE_PLUGINS, WIKI_REMARK_PLUGINS } from "../../src/content/wiki/markdown";
import { isSymmetric, parseRawRef } from "../../src/content/wiki/schema";
import { buildLayerTimeline } from "../../src/sim/model/forwardLayer";
import { getTokenPreset } from "../../src/sim/model/presets";
import { getPresetSpec } from "../../src/sim/modelspec/presets";
import { sourceLines, warmPageSources } from "./audit";
import { auditDiagram } from "./diagram-audit";
import { loadDiagrams } from "./diagrams";
import { createBlobReader } from "./git";
import { FACTS_BUDGET, MARK_FLOOD } from "./limits";
import { loadPages, type PageProblem, type WikiPage } from "./pages";
import { readPageRaw, readRawSnapshot } from "./raw";
import { configuredRefs, configuredRepoRoots, PRIMARY_REPO } from "./repo-roots";
import { classifySource, supportsOfficialEvidence } from "./sources";

/**
 * 只警告不阻塞的规则。两个调用方共用这一份：`pnpm wiki:lint` 与 ingest 收尾。
 *
 * 分开维护过一次，结果 ingest 用裸的 runLint、把一条 mark-flood 警告当成错误，
 * 让整条流水线在 11 页都已正确落盘之后报失败（2026-09-12）。
 */
export const WARN_ONLY: ReadonlySet<string> = new Set([
  // 白名单外的来源配低等级证据是合法的，只是值得人审时扫一眼
  "source-unlisted",
  // 迁移期：无类型 related 待重跑成 relations，归零后删掉这条
  "legacy-relations",
  // 标记密度是质量提示不是硬错，人审时看一眼就行
  "mark-flood",
  // 迁移期：现有 11 页还是「两列 + 来源列 + 20 行」的旧事实表，等多版本重跑
  // 才会变成「项 / 值 / 意味着什么 ≤10 行」。跑完这条清单应归零，届时删掉豁免。
  "facts-overflow",
]);

/** 把 lint 结果分成阻塞的与只提示的 */
export function splitProblems(problems: PageProblem[]): {
  errors: PageProblem[];
  warnings: PageProblem[];
} {
  return {
    errors: problems.filter((p) => !WARN_ONLY.has(p.rule)),
    warnings: problems.filter((p) => WARN_ONLY.has(p.rule)),
  };
}

export interface LintOptions {
  chapterIds: string[];
  /** 相对 wikiRoot 的文件是否存在（正文链接可指向 raw/ 等非页面文件） */
  existsFile: (rel: string) => boolean;
  requiredTerms?: string[];
  /** seeds 里登记过的版本名；给了就检查 `verified` 里有没有写错的 */
  knownRefs?: string[];
}

/**
 * LintOptions.existsFile 的唯一实现：lint、夜间巡检、草稿准入都用它。
 * 越出 wiki/ 的链接在 lintPages 里先报 link-outside-wiki，不会走到这里。
 */
export const wikiFileExists =
  (wikiRoot: string) =>
  (rel: string): boolean =>
    existsSync(join(wikiRoot, rel));

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

interface RenderedBody {
  /** 阅读页上这段正文里能跳到的 id（标题 id，以及管线渲染出的其它 id） */
  ids: Set<string>;
  /** 渲染出来的每个链接：href 与它在正文里的行号（1 起） */
  links: { href: string; line: number }[];
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#x27": "'",
  "#39": "'",
};

/**
 * 按阅读页同一条 markdown 管线渲染正文，取出全部 id 与全部链接。
 *
 * 锚点不另写一套规则：阅读页能跳到哪个 id，这里就认哪个。标题 id 的算法（anchors.ts）、
 * 代码块里的 `##` 不算标题、同名标题加 -1、行内代码按文字算，都由同一条管线决定；
 * 链接也取渲染结果里真正的 <a>，代码里的 `[x](y.md#z)` 不算，引用式链接照样算。
 */
function renderBody(body: string): RenderedBody {
  const links: RenderedBody["links"] = [];
  const html = renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: WIKI_REMARK_PLUGINS,
        rehypePlugins: WIKI_REHYPE_PLUGINS,
        components: {
          a: ({ href, node, children }) => {
            links.push({ href: href ?? "", line: node?.position?.start.line ?? 1 });
            return createElement("a", { href }, children);
          },
        },
      },
      body,
    ),
  );
  const ids = new Set(
    [...html.matchAll(/\sid="([^"]*)"/g)].map((m) =>
      (m[1] ?? "").replace(/&(amp|lt|gt|quot|#x27|#39);/g, (all, e: string) => HTML_ENTITIES[e] ?? all),
    ),
  );
  return { ids, links };
}

/**
 * `xxx.md#锚点` 与本页 `#锚点` 必须落在目标页阅读页上真有的 id 上。
 * 目标页标题改名后，指向旧标题的链接在阅读页上静默失效——prefill、moe 各出过一次，
 * 都是审查员手工发现的（2026-09-29）。
 * 目标不是知识页的不看：文件缺失由 broken-link 报，raw/ 等原文没有标题锚点。
 */
function anchorProblems(pages: WikiPage[]): PageProblem[] {
  const rendered = new Map(pages.map((p) => [p.file, renderBody(p.body)]));
  const out: PageProblem[] = [];
  for (const p of pages) {
    const dir = posix.dirname(p.file);
    for (const { href, line } of rendered.get(p.file)?.links ?? []) {
      const cut = href.indexOf("#");
      if (cut < 0 || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#/") || href.startsWith("/"))
        continue;
      const path = href.slice(0, cut);
      if (path && !path.endsWith(".md")) continue;
      const anchor = fragmentId(href.slice(cut));
      const file = path ? posix.normalize(posix.join(dir, path)) : p.file;
      const target = rendered.get(file);
      if (!anchor || !target || target.ids.has(anchor)) continue;
      out.push({
        file: p.file,
        rule: "broken-anchor",
        message: `第 ${(p.bodyLine ?? 1) + line - 1} 行：锚点 #${anchor} 在 ${file} 里不存在——目标标题改过名，或锚点没按 anchors.ts 的规则写`,
      });
    }
  }
  return out;
}

/**
 * 各页型的必需 H2，与 HANDBOOK「页面格式」一一对应。
 * 改这里之前先改 HANDBOOK——规则的真相源是那份文件，这里只是执行。
 *
 * 2026-09-19 放开固定骨架：知识点各不相同，原来那套「为什么需要它 / 怎么工作 /
 * 事实表 / 常见误解」按住所有 concept 与 feature，等于每页都长一个样。现在只留
 * `## 一句话`——它确实承重（compile-raw.ts 拿它当草稿准入门槛，阅读页与问答都拿它
 * 当开场），其余小节按这一页讲的东西自己定。质量由证据类规则守（sources 非空、
 * 标记编号绑定、relation note、来源白名单），不由标题模板守。
 * 参数页保持四节：那四节是 params/pages.ts 生成的参考骨架，不是人写的排版。
 *
 * 2026-09-25 读者定为初学者，「一句话」也不再强制：它把开头写成定义，初学者读完
 * 还是不知道这东西解决什么问题。现在开头只要求先给一个具体问题（机器查不了，写在
 * HANDBOOK）。随后教学改版允许就近引用与按主题分节；机器继续检查来源、编号、
 * 链接和关系，不以证据出现位置或固定标题模板判错。
 */
const REQUIRED_SECTIONS: Record<string, string[]> = {
  concept: [],
  feature: [],
  param: ["一句话", "事实表", "为什么存在", "开了的代价"],
};

/** 2026-09-11 改版前的四节格式，用于识别待迁移的旧页 */
const LEGACY_SECTIONS = ["是什么", "形状与数值", "在哪一步出现", "常见误解"];

/**
 * 样板标题：cross-page-overlap 比对正文时要跳过它们，否则每页的「一句话」都会
 * 互相撞。以前这张表是从 REQUIRED_SECTIONS 派生的，2026-09-19 放开必需小节时
 * 必须解耦——否则「不再强制」会顺手把重复检测也一起关掉。
 */
const BOILERPLATE_HEADINGS = [
  "一句话",
  "为什么需要它",
  "怎么工作",
  "事实表",
  "常见误解",
  "为什么存在",
  "开了的代价",
  ...LEGACY_SECTIONS,
  "版本谱系",
  "参数定义（自动生成）",
  "已废弃的说法",
  "拿真实数字走一遍",
];

const H2_RE = /^##\s+(.+?)\s*$/gm;
/**
 * 整行只有一个 HTML 标签——多半是 agent 写文件时漏出的包装标签。
 * 2026-09-12 整合 agent 给全部 11 页尾部都留了一个 `</content>`，页面上原样显示。
 * 正文不走 rehype-raw，任何裸标签都只会变成字面量，没有正当用途。
 */
const STRAY_TAG_RE = /^\s*(?:<\/?[a-zA-Z][a-zA-Z0-9-]*\s*\/?>|<!--[\s\S]*?-->)\s*$/;
const FENCE_RE = /^\s*```/;
const PLACEHOLDER_RE = /\{\{[^}]*\}\}/;
const MERMAID_RE = /```mermaid\r?\n([\s\S]*?)```/g;
/** 图里出现的文件名，如 attention_v1.py、block_table.py */
const DIAGRAM_FILE_RE = /[A-Za-z0-9_./-]+\.(?:py|ts|cpp|h|md)/g;

/**
 * 还在用无类型 `related`、没有 `relations` 的页 = 2026-09-11 关系改版前的旧页。
 * 新规则（带编号的内联标记、无 ## 接着看、至少一条边）不套在它们头上。
 */
function isLegacyPage(p: WikiPage): boolean {
  return p.fm.relations.length === 0 && p.fm.related.length > 0;
}

export { FACTS_BUDGET };

/**
 * 取 `## 事实表` 一节里的表格行（不含表头与分隔行）与表头单元格。
 * 事实表是给学习者扫数的，不是 API 手册——2026-09-12 实测 17 到 25 行、
 * 还带一整列源码路径，真正重要的几行被淹掉了。
 */
export function factsTable(body: string): { rows: number; header: string[] } | null {
  const i = body.indexOf("## 事实表");
  if (i < 0) return null;
  const rest = body.slice(i + "## 事实表".length);
  const end = rest.search(/^##\s/m);
  const seg = end < 0 ? rest : rest.slice(0, end);
  const lines = seg.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return null;
  const header = splitRow(lines[0] ?? "");
  // 第二行是 | --- | --- | 分隔行
  return { rows: Math.max(0, lines.length - 2), header };
}

/** 按 `|` 切单元格，反引号里的 `|` 不算分隔符 */
function splitRow(row: string): string[] {
  const out: string[] = [];
  let cur = "";
  let tick = false;
  for (const ch of row.trim().replace(/^\||\|$/g, "")) {
    if (ch === "`") tick = !tick;
    if (ch === "|" && !tick) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * 一条来源算不算「官方文档」：仓库里的 `docs/` 本地副本，或「官方」「论文」档的 URL。
 *
 * 两个判据必须共用一个函数。分开写过一次，结果 docCount 认 `:docs/`、hasOfficial
 * 不认，同一条来源在一个分支里算官方、另一个分支里不算，把一页引了三份官方文档的
 * 参数页判成「evidence 标 S 但没有官方来源」（2026-09-14）。
 */
function isOfficialDoc(ref: string): boolean {
  return ref.includes(":docs/") || supportsOfficialEvidence(classifySource(ref));
}

/** 代码围栏外、整行是标签的行号（1 起） */
function strayTagLines(body: string): number[] {
  const out: number[] = [];
  let inFence = false;
  body.split(/\r?\n/).forEach((line, i) => {
    if (FENCE_RE.test(line)) inFence = !inFence;
    else if (!inFence && STRAY_TAG_RE.test(line)) out.push(i + 1);
  });
  return out;
}

function sectionsOf(body: string): string[] {
  return [...body.matchAll(H2_RE)].map((m) => (m[1] ?? "").trim());
}

/**
 * 内联证据标记：`[C3]` 的 3 指向 sources 的第 3 条（从 1 数起）。
 * PLAN §1.4 的原设计就是带编号的 `[C##]`，这样读者能点进去核对具体哪一行。
 */
const MARK_RE = EVIDENCE_MARK_RE;
const NUMBERED_LEVELS = NUMBERED_EVIDENCE_LEVELS;
const MARK_DOMINANCE = 0.8;

function markProblems(p: WikiPage): PageProblem[] {
  const out: PageProblem[] = [];
  const counts = new Map<string, number>();
  let total = 0;
  // 围栏中的 [C99] 等是代码内容，与阅读页的证据标记处理保持一致。
  let fence = "";
  const prose = p.body
    .split(/\r?\n/)
    .filter((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (fence) {
        if (marker && marker[1]?.[0] === fence[0] && marker[1].length >= fence.length && !marker[2]?.trim())
          fence = "";
        return false;
      }
      if (marker) {
        fence = marker[1] ?? "";
        return false;
      }
      return true;
    })
    .join("\n");
  for (const m of prose.matchAll(MARK_RE)) {
    const level = m[1] ?? "";
    const num = m[2] ?? "";
    total++;
    counts.set(level, (counts.get(level) ?? 0) + 1);
    if (num === "") {
      if (NUMBERED_LEVELS.has(level)) {
        out.push({
          file: p.file,
          rule: "mark-unnumbered",
          message: `[${level}] 没带来源编号——它声称有一手来源，要写成 [${level}1] 指向 sources 的某一条`,
        });
      }
      continue;
    }
    const i = Number(num);
    if (i < 1 || i > p.fm.sources.length) {
      out.push({
        file: p.file,
        rule: "mark-index",
        message: `[${level}${num}] 指向第 ${i} 条来源，但本页只有 ${p.fm.sources.length} 条`,
      });
    } else if (!NUMBERED_LEVELS.has(level)) {
      out.push({
        file: p.file,
        rule: "mark-index",
        message: `[${level}${num}] 不该带编号——推导、推断、假设、冲突没有单一来源可指`,
      });
    }
  }
  // 密度：上一版 11 页标了 400 处、66% 是 [C]，牌子挂满就不携带信息了
  if (total > MARK_FLOOD) {
    out.push({
      file: p.file,
      rule: "mark-flood",
      message: `内联标记 ${total} 处，超过 ${MARK_FLOOD}——只标数值、反直觉结论与 D/I/A/! 这几类`,
    });
  } else if (total > 0) {
    for (const [level, n] of counts) {
      if (n / total > MARK_DOMINANCE && total >= 10) {
        out.push({
          file: p.file,
          rule: "mark-flood",
          message: `${Math.round((n / total) * 100)}% 的标记都是 [${level}]，这个等级已经不携带信息`,
        });
      }
    }
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
    for (const ref of opts.knownRefs ? p.fm.verified : []) {
      if (!opts.knownRefs?.includes(ref))
        problems.push({
          file: p.file,
          rule: "unknown-verified-ref",
          message: `verified 里的「${ref}」不是 seeds 登记过的版本（有 ${opts.knownRefs?.join("、")}）`,
        });
    }
    // direct 的意思就是「没有 raw 快照、直接撰写」；两样都有说明标注不如实
    if (p.fm.origin === "direct" && p.fm.rawSources)
      problems.push({
        file: p.file,
        rule: "origin-direct-raw",
        message: "origin: direct（直接撰写）的页不应有 rawSources；有 raw 快照就按实际入口标",
      });
    // 旧的无类型 related 只做迁移提示，不再检查对称性——新模型只写单向
    if (isLegacyPage(p)) {
      problems.push({
        file: p.file,
        rule: "legacy-relations",
        message: `还在用无类型的 related（${p.fm.related.length} 条），待重跑为 relations`,
      });
      for (const r of p.fm.related) if (ids.has(r)) inbound.add(r);
    }

    const seenEdge = new Set<string>();
    for (const r of p.fm.relations) {
      if (r.to === p.fm.id) {
        problems.push({ file: p.file, rule: "relation-selfloop", message: "relations 指向了自己" });
        continue;
      }
      if (!ids.has(r.to)) {
        problems.push({
          file: p.file,
          rule: "relation-missing",
          message: `relations 指向不存在的 ${r.to}`,
        });
        continue;
      }
      const key = `${r.to}|${r.kind}`;
      if (seenEdge.has(key)) {
        problems.push({
          file: p.file,
          rule: "relation-duplicate",
          message: `(${r.to}, ${r.kind}) 写了两次`,
        });
      }
      seenEdge.add(key);
      // 反向边由 wiki:build 派生。两边各写一次会让「接着看」重复出现同一页。
      const back = ids.get(r.to)?.fm.relations ?? [];
      if (!isSymmetric(r.kind) && back.some((b) => b.to === p.fm.id && b.kind === r.kind)) {
        problems.push({
          file: p.file,
          rule: "relation-duplicate",
          message: `${r.to} 也写了 ${r.kind} 指回来——有向边只写在依赖方那一侧，反向由程序派生`,
        });
      }
      inbound.add(r.to);
    }
    for (const t of linkTargets(p)) {
      const target = pages.find((q) => q.file === t);
      if (target) inbound.add(target.fm.id);
      else if (t === ".." || t.startsWith("../")) {
        // 阅读页只发布 wiki/ 里的内容，越界的相对链接在站上必然打不开
        problems.push({
          file: p.file,
          rule: "link-outside-wiki",
          message: `链接 ${t} 越出 wiki/ 目录，阅读页上打不开——改链站内页，或改成不带链接的文字`,
        });
      } else if (!files.has(t) && !opts.existsFile(t)) {
        problems.push({ file: p.file, rule: "broken-link", message: `链接 ${t} 不存在` });
      }
    }
  }
  problems.push(...anchorProblems(pages));
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

    // 下面几条是 2026-09-11 关系改版后的规则。旧页只报一条 legacy-relations，
    // 不逐条刷屏——它们要重跑才会变成新格式，在那之前既不该被静默放过，
    // 也不该拿几百条噪声淹掉真问题。重跑完这个分支就走不到了。
    if (isLegacyPage(p)) continue;

    // 「接着看」改由 relations 生成，手写会与 note 漂移
    if (p.body.includes("## 接着看")) {
      problems.push({
        file: p.file,
        rule: "stray-whatsnext",
        message: "正文里还有 ## 接着看——它由 relations 自动生成，理由写进边的 note",
      });
    }

    // 教学页至少要在图上有一条边——出边或入边都算。没有任何边的知识点串不起来。
    // 只有一页的知识库没东西可连，不算孤立。
    const teaching = p.fm.type === "concept" || p.fm.type === "feature";
    const isolated = p.fm.relations.length === 0 && p.fm.related.length === 0 && !inbound.has(p.fm.id);
    if (teaching && pages.length > 1 && isolated) {
      problems.push({
        file: p.file,
        rule: "relation-empty",
        message: "一条 relations 都没有——孤立的知识点串不起来",
      });
    }

    const facts = factsTable(p.body);
    if (facts) {
      if (facts.rows > FACTS_BUDGET) {
        problems.push({
          file: p.file,
          rule: "facts-overflow",
          message: `事实表 ${facts.rows} 行，超过 ${FACTS_BUDGET}——它是给学习者扫数的，不是 API 手册`,
        });
      }
      if (facts.header.includes("来源")) {
        problems.push({
          file: p.file,
          rule: "facts-overflow",
          message: "事实表还带「来源」列——依据写成正文里的内联标记 [C6]，表里那一列占宽又没人点",
        });
      }
    }

    for (const line of strayTagLines(p.body)) {
      problems.push({
        file: p.file,
        rule: "stray-tag",
        message: `第 ${line} 行只有一个 HTML 标签——agent 写文件时漏出的包装标签，正文不渲染裸 HTML`,
      });
    }

    problems.push(...markProblems(p));

    if (PLACEHOLDER_RE.test(p.body)) {
      problems.push({
        file: p.file,
        rule: "unexpanded-placeholder",
        message: "正文残留 {{ }} 占位符——本地文档的变量要去官网取展开值，否则会给出跑不了的命令",
      });
    }

    // 能读什么不限，能引什么才限——白名单见 HANDBOOK「可引来源」，
    // 与 sources.ts 的 CITABLE_DOMAINS 由测试锁住一致
    const kinds = p.fm.sources.map((x) => ({ ref: x, kind: classifySource(x) }));
    if (p.fm.evidence === "C" && kinds.every((k) => k.kind === "raw")) {
      problems.push({
        file: p.file,
        rule: "source-local-evidence",
        message: "仅存下本地材料不构成源码实证；补可核对的上游引用或降低证据等级",
      });
    }
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
    const docCount = p.fm.sources.filter(isOfficialDoc).length;
    const otherCount = p.fm.sources.length - docCount;
    const hasOfficial = p.fm.sources.some(isOfficialDoc);
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
  const templateHeadings = new Set(BOILERPLATE_HEADINGS);
  const signatures = (page: WikiPage) => {
    const body = page.body.replace(/```[\s\S]*?```/g, "");
    const normalize = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
    return new Set(
      [...body.matchAll(/^##\s+([^\r\n]+)\r?\n+([^#\r\n][\s\S]*?)(?=\r?\n\s*\r?\n|\r?\n##|$)/gm)]
        .filter((m) => !templateHeadings.has(m[1]!.trim()) && normalize(m[2]!).length >= 16)
        .map((m) => `${normalize(m[1]!)}\n${normalize(m[2]!)}`),
    );
  };
  const linked = (a: WikiPage, b: WikiPage) =>
    a.fm.relations.some((r) => r.to === b.fm.id) ||
    a.fm.related.includes(b.fm.id) ||
    linkTargets(a).includes(b.file);
  const fingerprints = pages.map(signatures);
  for (let i = 0; i < pages.length; i++)
    for (let j = i + 1; j < pages.length; j++) {
      const a = pages[i]!;
      const b = pages[j]!;
      if (linked(a, b) || linked(b, a) || ![...fingerprints[i]!].some((s) => fingerprints[j]!.has(s)))
        continue;
      for (const [page, other] of [
        [a, b],
        [b, a],
      ] as const)
        problems.push({
          file: page.file,
          rule: "cross-page-overlap",
          message: `与 ${other.file} 的非模板标题和首段重复，缺少交叉引用`,
        });
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

export function runLint(
  rootDir: string,
  flags: { terms: boolean; repoRoots?: Record<string, string> },
): PageProblem[] {
  const wikiRoot = join(rootDir, "wiki");
  const { pages, problems } = loadPages(wikiRoot);
  const { diagrams, problems: diagramProblems } = loadDiagrams(wikiRoot);
  problems.push(...diagramProblems);
  const diagramDeps = {
    repoRoots: flags.repoRoots ?? configuredRepoRoots(rootDir),
    readBlob: createBlobReader(),
    diagrams,
  };
  warmPageSources(pages, diagramDeps.repoRoots);
  problems.push(...pages.flatMap((page) => auditDiagram(page, diagramDeps)));
  // spec 在但 SVG 没生成，页面上就是一个空框——渲染层读的是 SVG，不是 spec
  for (const diagram of diagrams.values())
    if (!existsSync(join(wikiRoot, diagram.svgFile)))
      problems.push({
        file: diagram.specFile,
        rule: "diagram-missing",
        message: `缺 ${diagram.svgFile}，跑 pnpm wiki:diagrams 生成`,
      });
  for (const page of pages) {
    try {
      if (page.fm.rawSources) readPageRaw(wikiRoot, page.fm.id, page.fm.rawSources);
      for (const source of page.fm.sources) {
        const ref = parseRawRef(source);
        if (!ref) continue;
        const total = sourceLines(readRawSnapshot(wikiRoot, ref.path)).length;
        if (ref.lineEnd > total)
          problems.push({
            file: page.file,
            rule: "raw-line-range",
            message: `${source} 超出原文 ${total} 行`,
          });
      }
    } catch (error) {
      problems.push({ file: page.file, rule: "raw-integrity", message: String(error) });
    }
  }
  const opts: LintOptions = { chapterIds: CHAPTER_IDS, existsFile: wikiFileExists(wikiRoot) };
  // 不带仓库前缀的版本沿用社区分支名；独立工作版用 repo:ref，避免混淆两个 main。
  const refsByRepo = configuredRefs(rootDir);
  const knownRefs = [
    ...Object.keys(refsByRepo[PRIMARY_REPO] ?? {}),
    ...Object.entries(refsByRepo).flatMap(([repo, refs]) => Object.keys(refs).map((ref) => `${repo}:${ref}`)),
  ];
  if (knownRefs.length > 0) opts.knownRefs = knownRefs;
  if (flags.terms) opts.requiredTerms = collectStepTerms();
  const logPath = join(wikiRoot, "log.md");
  const logProblems = existsSync(logPath) ? lintLog(readFileSync(logPath, "utf8")) : [];
  return [...problems, ...lintPages(pages, opts), ...logProblems];
}
