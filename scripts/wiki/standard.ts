/**
 * 写作标准检查（2026-09-28）：写手自查时，已达标页一旦超标就在 wiki:audit 里被拦下。
 *
 * 只对 standard-pages.json 名单里的页强制；其余页大多还没重写，全量报错没有意义，只统计。
 * 「正文」指 `## 对照源码` 之前的部分，不含围栏块（代码、calc、wiki-diagram）；
 * 字数 = 汉字数 + 拉丁单词数。阈值、H3 顺序、免责词表都只在配置文件里定义一次。
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { EVIDENCE_MARK_RE } from "../../src/content/wiki/evidenceMarks";
import { diagramRefs, type LoadedDiagram } from "./diagrams";
import type { PageProblem } from "./pages";

export const STANDARD_RULES = [
  "code-density",
  "prose-marks",
  "source-sections",
  "calc-density",
  "stacked-blocks",
  "diagram-first",
  "hedge-ratio",
  "diagram-width",
] as const;
export type StandardRule = (typeof STANDARD_RULES)[number];

export const standardConfigSchema = z.object({
  note: z.string().optional(),
  pages: z.array(z.string().min(1)),
  skip: z.record(z.string(), z.array(z.enum(STANDARD_RULES))).default({}),
  sourceSection: z.string().min(1),
  sourceSubsections: z.array(z.string().min(1)).min(1),
  maxInlineCodePerK: z.number().positive(),
  maxCalcPerK: z.number().positive(),
  maxHedgeRatio: z.number().positive(),
  hedgeWords: z.array(z.string().min(1)).min(1),
  maxDiagramWidth: z.number().positive(),
});
export type StandardConfig = z.infer<typeof standardConfigSchema>;

export function loadStandardConfig(path: string | URL = new URL("./standard-pages.json", import.meta.url)) {
  return standardConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

type Block =
  | { kind: "fence"; lang: string; line: number }
  | { kind: "heading"; level: number; text: string; line: number }
  | { kind: "table"; line: number; text: string }
  | { kind: "prose"; line: number; text: string }
  | { kind: "blank"; line: number };

/**
 * 按行切块；围栏开合与 lint 的证据标记检查同一套认法（``` 或 ~~~，闭合不短于开启）。
 * lineOffset 是 frontmatter 占的行数，报出的行号就是文件里的行号。
 */
function blocksOf(body: string, lineOffset: number): Block[] {
  const out: Block[] = [];
  let fence = "";
  body.split(/\r?\n/).forEach((text, i) => {
    const line = i + 1 + lineOffset;
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (fence) {
      if (marker && marker[1]?.[0] === fence[0] && marker[1].length >= fence.length && !marker[2]?.trim())
        fence = "";
      return;
    }
    if (marker) {
      fence = marker[1] ?? "";
      out.push({ kind: "fence", lang: (marker[2] ?? "").trim().split(/\s+/)[0] ?? "", line });
      return;
    }
    const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(text);
    if (heading) out.push({ kind: "heading", level: heading[1]!.length, text: heading[2]!.trim(), line });
    else if (!text.trim()) out.push({ kind: "blank", line });
    else if (/^\s*\|/.test(text)) {
      const last = out[out.length - 1];
      if (last?.kind === "table") last.text += `\n${text}`;
      else out.push({ kind: "table", line, text });
    } else out.push({ kind: "prose", line, text });
  });
  return out;
}

const INLINE_CODE_RE = /`[^`\n]+`/g;
const HAN_RE = /\p{Script=Han}/gu;
const LATIN_WORD_RE = /[A-Za-z][A-Za-z0-9_]*/g;

function wordCount(text: string): number {
  const visible = text.replace(/\]\([^)\s]*\)/g, "]");
  return (visible.match(HAN_RE) ?? []).length + (visible.match(LATIN_WORD_RE) ?? []).length;
}

export interface StandardMeasure {
  words: number;
  inlineCode: number;
  codePerK: number;
  /** 正文里的证据角标（[C1]、[D] 等），不含行内代码里的 */
  marks: number;
  calc: number;
  calcPerK: number;
  sentences: number;
  hedged: number;
  hedgeRatio: number;
  /** 对照源码结构的问题；null 表示合格 */
  sourceSections: string | null;
  /** 正文里与前一个 calc / 表格之间只隔空行的块的行号 */
  stacked: number[];
  /** 直觉图先行的问题；null 表示合格 */
  diagramFirst: string | null;
  /** 超宽的图，形如 `demo 1200` */
  wideDiagrams: string[];
}

const perK = (n: number, words: number) => (words ? (n * 1000) / words : n ? Number.POSITIVE_INFINITY : 0);

export function measureStandard(
  body: string,
  cfg: StandardConfig,
  diagrams?: Map<string, LoadedDiagram>,
  lineOffset = 0,
): StandardMeasure {
  const blocks = blocksOf(body, lineOffset);
  const isSourceH2 = (b: Block) => b.kind === "heading" && b.level === 2 && b.text === cfg.sourceSection;
  const cut = blocks.findIndex(isSourceH2);
  const prose = cut < 0 ? blocks : blocks.slice(0, cut);

  let words = 0;
  let inlineCode = 0;
  let marks = 0;
  let calc = 0;
  let sentences = 0;
  let hedged = 0;
  for (const b of prose) {
    if (b.kind === "fence") {
      if (b.lang === "calc") calc++;
      continue;
    }
    if (b.kind === "blank") continue;
    words += wordCount(b.text);
    inlineCode += (b.text.match(INLINE_CODE_RE) ?? []).length;
    const plain = b.text.replace(INLINE_CODE_RE, "");
    marks += [...plain.matchAll(EVIDENCE_MARK_RE)].length;
    if (b.kind !== "prose") continue;
    for (const s of plain.split(/[。！？!?]/)) {
      if (!/[\p{Script=Han}A-Za-z]/u.test(s)) continue;
      sentences++;
      if (cfg.hedgeWords.some((w) => s.includes(w))) hedged++;
    }
  }

  let sourceSections: string | null = null;
  if (cut < 0) sourceSections = `缺少「## ${cfg.sourceSection}」`;
  else {
    const after = blocks.slice(cut + 1).filter((b) => b.kind === "heading");
    const h2 = after.filter((b) => b.level === 2).map((b) => b.text);
    const h3 = after.filter((b) => b.level === 3).map((b) => b.text);
    const want = cfg.sourceSubsections;
    const problems: string[] = [];
    if (h3.join("/") !== want.join("/"))
      problems.push(`H3 应依次是 ${want.join(" / ")}，实际是 ${h3.join(" / ") || "（无）"}`);
    if (h2.length) problems.push(`之后不应再有 H2，实际有 ${h2.join(" / ")}`);
    if (problems.length) sourceSections = `「## ${cfg.sourceSection}」${problems.join("；")}`;
  }

  // 只查正文：对照源码里的版本表挨着放是允许的
  const stacked: number[] = [];
  let prev: Block | undefined;
  for (const b of prose) {
    if (b.kind === "blank") continue;
    const dense = (x?: Block) => x?.kind === "table" || (x?.kind === "fence" && x.lang === "calc");
    if (dense(b) && dense(prev)) stacked.push(b.line);
    prev = b;
  }

  let diagramFirst: string | null = null;
  let h2Seen = 0;
  let firstCalc: number | null = null;
  let firstDiagram: { line: number; h2: number } | null = null;
  for (const b of blocks) {
    if (b.kind === "heading" && b.level === 2) h2Seen++;
    if (b.kind !== "fence") continue;
    if (b.lang === "calc") firstCalc ??= b.line;
    if (b.lang === "wiki-diagram" && !firstDiagram) firstDiagram = { line: b.line, h2: h2Seen };
  }
  if (!firstDiagram) diagramFirst = "全页没有 wiki-diagram";
  else {
    const why: string[] = [];
    if (firstCalc !== null && firstCalc < firstDiagram.line)
      why.push(`第一个 calc 块（第 ${firstCalc} 行）在第一张图（第 ${firstDiagram.line} 行）之前`);
    if (firstDiagram.h2 > 2)
      why.push(`第一张图在第 ${firstDiagram.h2} 个 H2 小节（第 ${firstDiagram.line} 行）`);
    if (why.length) diagramFirst = why.join("；");
  }

  const wideDiagrams = diagrams
    ? [...new Set(diagramRefs(body))].flatMap((id) => {
        const w = diagrams.get(id)?.spec.size[0];
        return w !== undefined && w > cfg.maxDiagramWidth ? [`${id} ${w}`] : [];
      })
    : [];

  return {
    words,
    inlineCode,
    codePerK: perK(inlineCode, words),
    marks,
    calc,
    calcPerK: perK(calc, words),
    sentences,
    hedged,
    hedgeRatio: sentences ? hedged / sentences : 0,
    sourceSections,
    stacked,
    diagramFirst,
    wideDiagrams,
  };
}

const fmt = (n: number, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits) : "∞");

/** 各项超标时的报错；skip 里的项不报 */
export function standardProblems(
  file: string,
  m: StandardMeasure,
  cfg: StandardConfig,
  skip: readonly string[] = [],
): PageProblem[] {
  const all: [StandardRule, string | null][] = [
    [
      "code-density",
      m.codePerK > cfg.maxInlineCodePerK
        ? `正文行内代码 ${m.inlineCode} 处 / ${m.words} 字 = ${fmt(m.codePerK)} 处每千字，上限 ${cfg.maxInlineCodePerK}`
        : null,
    ],
    [
      "prose-marks",
      m.marks ? `「## ${cfg.sourceSection}」之前还有 ${m.marks} 个证据角标，正文里不写角标` : null,
    ],
    ["source-sections", m.sourceSections],
    [
      "calc-density",
      m.calcPerK > cfg.maxCalcPerK
        ? `正文 calc 块 ${m.calc} 个 / ${m.words} 字 = ${fmt(m.calcPerK, 2)} 个每千字，上限 ${cfg.maxCalcPerK}`
        : null,
    ],
    [
      "stacked-blocks",
      m.stacked.length
        ? `第 ${m.stacked.join("、")} 行的 calc 块或表格紧跟在上一个 calc 块或表格后面，中间没有正文段落`
        : null,
    ],
    ["diagram-first", m.diagramFirst && `${m.diagramFirst}；直觉图要先于 calc，且落在前两个 H2 小节内`],
    [
      "hedge-ratio",
      m.hedgeRatio >= cfg.maxHedgeRatio
        ? `正文免责句 ${m.hedged} / ${m.sentences} 句 = ${fmt(m.hedgeRatio * 100)}%，须低于 ${fmt(cfg.maxHedgeRatio * 100)}%`
        : null,
    ],
    [
      "diagram-width",
      m.wideDiagrams.length ? `图宽超过 ${cfg.maxDiagramWidth}：${m.wideDiagrams.join("、")}` : null,
    ],
  ];
  return all.flatMap(([rule, message]) =>
    message && !skip.includes(rule) ? [{ file, rule, message: `[写作标准] ${message}` }] : [],
  );
}

interface StandardPage {
  file: string;
  fm: { id: string };
  body: string;
  /** frontmatter 占的行数；给了就按文件行号报 */
  lineOffset?: number;
}

/** body 在原文件里从第几行之后开始（gray-matter 的 content 是原文的后缀） */
export function bodyLineOffset(raw: string, body: string): number {
  return raw.endsWith(body) ? raw.slice(0, raw.length - body.length).split("\n").length - 1 : 0;
}

export function checkStandard(
  page: StandardPage,
  cfg: StandardConfig,
  diagrams?: Map<string, LoadedDiagram>,
) {
  const measure = measureStandard(page.body, cfg, diagrams, page.lineOffset);
  const skip = cfg.skip[page.fm.id] ?? [];
  return { measure, skip, problems: standardProblems(page.file, measure, cfg, skip) };
}

/** 名单内的页逐项强制；名单外的页只按规则统计有几页超标，不进失败数 */
export function auditStandard(
  pages: StandardPage[],
  cfg: StandardConfig,
  diagrams?: Map<string, LoadedDiagram>,
) {
  const listed = new Set(cfg.pages);
  const enforced: (ReturnType<typeof checkStandard> & { id: string; file: string })[] = [];
  const failing: Partial<Record<StandardRule, number>> = {};
  let unlisted = 0;
  for (const page of pages) {
    const r = checkStandard(page, cfg, diagrams);
    if (listed.has(page.fm.id)) {
      enforced.push({ ...r, id: page.fm.id, file: page.file });
      continue;
    }
    unlisted++;
    for (const rule of new Set(r.problems.map((p) => p.rule as StandardRule)))
      failing[rule] = (failing[rule] ?? 0) + 1;
  }
  const found = new Set(enforced.map((e) => e.id));
  return {
    enforced,
    problems: enforced.flatMap((e) => e.problems),
    missing: cfg.pages.filter((id) => !found.has(id)),
    unlisted: { pages: unlisted, failing },
  };
}

/** 一行实测值，给 wiki:audit 逐页打印；skip 的项标「不适用」 */
export function formatStandard(
  m: StandardMeasure,
  cfg: StandardConfig,
  skip: readonly string[] = [],
): string {
  const mark = (rule: StandardRule, ok: boolean) => (skip.includes(rule) ? "–" : ok ? "✓" : "✗");
  return [
    `${m.words} 字`,
    `${mark("code-density", m.codePerK <= cfg.maxInlineCodePerK)}行内代码 ${fmt(m.codePerK)}/千字`,
    `${mark("prose-marks", !m.marks)}角标 ${m.marks}`,
    `${mark("source-sections", !m.sourceSections)}对照源码`,
    `${mark("calc-density", m.calcPerK <= cfg.maxCalcPerK)}calc ${fmt(m.calcPerK, 2)}/千字`,
    `${mark("stacked-blocks", !m.stacked.length)}相邻块 ${m.stacked.length}`,
    `${mark("diagram-first", !m.diagramFirst)}图先行`,
    `${mark("hedge-ratio", m.hedgeRatio < cfg.maxHedgeRatio)}免责 ${fmt(m.hedgeRatio * 100)}%`,
    `${mark("diagram-width", !m.wideDiagrams.length)}图宽`,
  ].join(" · ");
}
