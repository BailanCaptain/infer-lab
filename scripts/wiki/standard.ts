/**
 * 写作标准检查：
 * - 对 standard-pages.json 名单页硬性校验真实结构与画布边界（prose-marks、source-sections、diagram-width）；
 * - 对 advisoryRules（calc-density、stacked-blocks、diagram-first、hedge-ratio）保留精确度量与可读诊断建议，
 *   不作为写作或批准硬拦截，且严禁为压低词语/算式比例删减真实适用条件。
 *
 * 「正文」指 `## 对照源码` 之前的部分，不含围栏块（代码、calc、wiki-diagram）；
 * 字数 = 汉字数 + 拉丁单词数。阈值、建议规则集、免责词表只在配置文件里定义一次。
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { EVIDENCE_MARK_RE } from "../../src/content/wiki/evidenceMarks";
import { diagramRefs, type LoadedDiagram } from "./diagrams";
import type { PageProblem } from "./pages";

export const STANDARD_RULES = [
  "prose-marks",
  "source-sections",
  "calc-density",
  "stacked-blocks",
  "diagram-first",
  "hedge-ratio",
  "diagram-width",
] as const;
export type StandardRule = (typeof STANDARD_RULES)[number];

export const STANDARD_ADVISORY_RULES = [
  "calc-density",
  "stacked-blocks",
  "diagram-first",
  "hedge-ratio",
] as const;
export type StandardAdvisoryRule = (typeof STANDARD_ADVISORY_RULES)[number];

export const standardConfigSchema = z.object({
  note: z.string().optional(),
  pages: z.array(z.string().min(1)),
  skip: z.record(z.string(), z.array(z.enum(STANDARD_RULES))).default({}),
  advisoryRules: z.array(z.enum(STANDARD_RULES)).default([...STANDARD_ADVISORY_RULES]),
  sourceSection: z.string().min(1),
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
/** 参数页文末由脚本生成的受保护 H2，可位于「## 对照源码」之后且不计入正文 */
const PROTECTED_PARAM_TRAILING_H2 = new Set(["版本谱系", "参数定义（自动生成）"]);

/** Keep existing prose intact while refusing newly introduced teaching citations. */
export function proseEvidenceLines(body: string, cfg: StandardConfig): string[] {
  const blocks = blocksOf(body, 0);
  const cut = blocks.findIndex((b) => b.kind === "heading" && b.level === 2 && b.text === cfg.sourceSection);
  return (cut < 0 ? blocks : blocks.slice(0, cut))
    .flatMap((b) => ("text" in b ? b.text.split(/\r?\n/) : []))
    .filter((line) => [...line.replace(INLINE_CODE_RE, "").matchAll(EVIDENCE_MARK_RE)].length > 0);
}

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
    const h2 = blocks
      .slice(cut + 1)
      .filter(
        (b): b is Extract<Block, { kind: "heading" }> =>
          b.kind === "heading" && b.level === 2 && !PROTECTED_PARAM_TRAILING_H2.has(b.text),
      )
      .map((b) => b.text);
    if (h2.length) sourceSections = `「## ${cfg.sourceSection}」之后不应再有 H2，实际有 ${h2.join(" / ")}`;
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
  if (firstDiagram) {
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

function standardEntries(m: StandardMeasure, cfg: StandardConfig): [StandardRule, string | null][] {
  return [
    [
      "prose-marks",
      m.marks ? `「## ${cfg.sourceSection}」之前还有 ${m.marks} 个证据角标，正文里不写角标` : null,
    ],
    ["source-sections", m.sourceSections],
    [
      "calc-density",
      m.calcPerK > cfg.maxCalcPerK
        ? `正文 calc 块 ${m.calc} 个 / ${m.words} 字 = ${fmt(m.calcPerK, 2)} 个每千字（参考值 ≤${cfg.maxCalcPerK}；分步推演确有必要时可保留）`
        : null,
    ],
    [
      "stacked-blocks",
      m.stacked.length
        ? `第 ${m.stacked.join("、")} 行的 calc 块或表格紧跟在上一个 calc 块或表格后面，建议确认是否需要过渡说明（对照确需并列时可保留）`
        : null,
    ],
    [
      "diagram-first",
      m.diagramFirst && `${m.diagramFirst}；如有助于建立直觉可考虑前置示意图，按教学需要自然安排即可`,
    ],
    [
      "hedge-ratio",
      m.hedgeRatio >= cfg.maxHedgeRatio
        ? `正文含不确定词句 ${m.hedged} / ${m.sentences} 句 = ${fmt(m.hedgeRatio * 100)}%（参考提示线 ${fmt(cfg.maxHedgeRatio * 100)}%；请直接说明成立条件或待验证边界，切勿为压低比例删减真实限制条件）`
        : null,
    ],
    [
      "diagram-width",
      m.wideDiagrams.length ? `图宽超过 ${cfg.maxDiagramWidth}：${m.wideDiagrams.join("、")}` : null,
    ],
  ];
}

/** 硬性边界超标时的阻塞报错；advisoryRules 与 skip 里的项不进阻塞报错 */
export function standardProblems(
  file: string,
  m: StandardMeasure,
  cfg: StandardConfig,
  skip: readonly string[] = [],
): PageProblem[] {
  const advisory = new Set<string>(cfg.advisoryRules);
  return standardEntries(m, cfg).flatMap(([rule, message]) =>
    message && !skip.includes(rule) && !advisory.has(rule)
      ? [{ file, rule, message: `[写作标准] ${message}` }]
      : [],
  );
}

/** 教学可读性诊断建议（不阻塞写作或批准）；skip 里的项不报 */
export function standardAdvisories(
  file: string,
  m: StandardMeasure,
  cfg: StandardConfig,
  skip: readonly string[] = [],
): PageProblem[] {
  const advisory = new Set<string>(cfg.advisoryRules);
  return standardEntries(m, cfg).flatMap(([rule, message]) =>
    message && !skip.includes(rule) && advisory.has(rule)
      ? [{ file, rule, message: `[写作建议] ${message}` }]
      : [],
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
  return {
    measure,
    skip,
    problems: standardProblems(page.file, measure, cfg, skip),
    advisories: standardAdvisories(page.file, measure, cfg, skip),
  };
}

/** 名单内的页对硬性规则强制，建议项仅作可见诊断不计入失败；名单外的页只统计不报错 */
export function auditStandard(
  pages: StandardPage[],
  cfg: StandardConfig,
  diagrams?: Map<string, LoadedDiagram>,
) {
  const listed = new Set(cfg.pages);
  const enforced: (ReturnType<typeof checkStandard> & { id: string; file: string })[] = [];
  const failing: Partial<Record<StandardRule, number>> = {};
  const unlistedAdvisories: Partial<Record<StandardRule, number>> = {};
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
    for (const rule of new Set(r.advisories.map((p) => p.rule as StandardRule)))
      unlistedAdvisories[rule] = (unlistedAdvisories[rule] ?? 0) + 1;
  }
  const found = new Set(enforced.map((e) => e.id));
  return {
    enforced,
    problems: enforced.flatMap((e) => e.problems),
    advisories: enforced.flatMap((e) => e.advisories),
    missing: cfg.pages.filter((id) => !found.has(id)),
    unlisted: { pages: unlisted, failing, advisories: unlistedAdvisories },
  };
}

export function formatStandardAuditSummary(standard: ReturnType<typeof auditStandard>) {
  const standardPassed = standard.enforced.filter((e) => !e.problems.length).length;
  const unlistedFailing = Object.entries(standard.unlisted.failing).map(([rule, n]) => `${rule} ${n} 页`);
  const unlistedAdvisories = Object.entries(standard.unlisted.advisories).map(
    ([rule, n]) => `${rule} ${n} 页`,
  );
  const unlistedNote = [
    unlistedFailing.length ? unlistedFailing.join("，") : "无硬项超标",
    ...(unlistedAdvisories.length ? [`建议项：${unlistedAdvisories.join("，")}`] : []),
  ].join("；");
  const advisorySuffix = standard.advisories.length
    ? `（另有教学建议 ${standard.advisories.length} 处）`
    : "";
  const summaryLine = `写作标准：名单 ${standard.enforced.length} 页，达标 ${standardPassed} 页${advisorySuffix}；名单外 ${standard.unlisted.pages} 页只统计不报错（${unlistedNote}）`;
  const advisoryLines = standard.advisories.length
    ? [
        `! 写作建议 ${standard.advisories.length} 处（供教学审阅参考，不阻塞）：`,
        ...standard.advisories.map((a) => `  ${a.file} [${a.rule}] ${a.message}`),
      ]
    : [];
  const problemLines = standard.problems.map((p) => `x ${p.file} [${p.rule}] ${p.message}`);
  return { summaryLine, advisoryLines, problemLines };
}

/** 一行实测值，给 wiki:audit 逐页打印；skip 标「–」，建议项标「!」，硬错误标「✗」 */
export function formatStandard(
  m: StandardMeasure,
  cfg: StandardConfig,
  skip: readonly string[] = [],
): string {
  const advisory = new Set<string>(cfg.advisoryRules);
  const mark = (rule: StandardRule, ok: boolean) =>
    skip.includes(rule) ? "–" : ok ? "✓" : advisory.has(rule) ? "!" : "✗";
  return [
    `${m.words} 字`,
    `行内代码 ${fmt(m.codePerK)}/千字`,
    `${mark("prose-marks", !m.marks)}角标 ${m.marks}`,
    `${mark("source-sections", !m.sourceSections)}对照源码`,
    `${mark("calc-density", m.calcPerK <= cfg.maxCalcPerK)}calc ${fmt(m.calcPerK, 2)}/千字`,
    `${mark("stacked-blocks", !m.stacked.length)}相邻块 ${m.stacked.length}`,
    `${mark("diagram-first", !m.diagramFirst)}图先行`,
    `${mark("hedge-ratio", m.hedgeRatio < cfg.maxHedgeRatio)}免责 ${fmt(m.hedgeRatio * 100)}%`,
    `${mark("diagram-width", !m.wideDiagrams.length)}图宽`,
  ].join(" · ");
}
