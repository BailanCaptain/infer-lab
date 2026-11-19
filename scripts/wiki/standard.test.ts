import { describe, expect, it } from "vitest";
import { diagramSpecSchema, type LoadedDiagram } from "./diagrams";
import { parsePage } from "./pages";
import { revisePage, verifyRevision } from "./revisions";
import {
  auditStandard,
  bodyLineOffset,
  checkStandard,
  formatStandard,
  formatStandardAuditSummary,
  loadStandardConfig,
  measureStandard,
  STANDARD_ADVISORY_RULES,
  type StandardConfig,
} from "./standard";

const cfg: StandardConfig = {
  pages: ["good", "guide"],
  skip: { guide: ["source-sections", "diagram-first"] },
  advisoryRules: [...STANDARD_ADVISORY_RULES],
  sourceSection: "对照源码",
  maxCalcPerK: 1.2,
  maxHedgeRatio: 0.03,
  hedgeWords: ["待核", "尚未核实", "未验证", "可能", "不确定"],
  maxDiagramWidth: 900,
};

/** n 句、每句 8 个汉字，字数正好 8n */
const prose = (n: number) => "这是一段讲解文字。".repeat(n);
const diagram = (id = "demo") => `\`\`\`wiki-diagram\nfile: ${id}\n\`\`\``;
const calc = "```calc\n乘 = 2 × 3\n```";
const table = "| 项 | 值 |\n|---|---|\n| 甲 | 1 |";
const tailOf = (h3s: string[]) =>
  ["## 对照源码", "", "开关。[C1]", "", ...h3s.flatMap((h) => [`### ${h}`, "", "说明。[C1]", ""])].join("\n");
const sourceTail = tailOf(["怎么开", "会报什么错", "开销和什么时候别开", "版本差异", "源码位置"]);

/**
 * 一页达标的页：「一句话」「讲解」两个 H2 小节共 1000 字（标题 5 字 + 表格 3 字 + 正文 992 字），
 * 图在第一节，calc 和表格之间隔着正文。
 */
function goodBody(parts: { head?: string; middle?: string; tail?: string } = {}) {
  return [
    "## 一句话",
    "",
    parts.head ?? prose(60),
    "",
    diagram(),
    "",
    "## 讲解",
    "",
    parts.middle ?? `${calc}\n\n${prose(30)}\n\n${table}\n\n${prose(34)}`,
    "",
    parts.tail ?? sourceTail,
  ].join("\n");
}

const rules = (body: string, id = "good", diagrams?: Map<string, LoadedDiagram>) =>
  checkStandard({ file: `concepts/${id}.md`, fm: { id }, body }, cfg, diagrams).problems.map((p) => p.rule);
const advisories = (body: string, id = "good", diagrams?: Map<string, LoadedDiagram>) =>
  checkStandard({ file: `concepts/${id}.md`, fm: { id }, body }, cfg, diagrams).advisories.map((p) => p.rule);

function diagramOf(width: number): Map<string, LoadedDiagram> {
  const spec = diagramSpecSchema.parse({ layout: "scene", id: "demo", caption: "演示", size: [width, 200] });
  return new Map([
    ["demo", { id: "demo", spec, specFile: "diagrams/demo.yaml", svgFile: "diagrams/demo.svg" }],
  ]);
}

describe("writing standard measure", () => {
  it("counts Han characters plus Latin words in the prose before 对照源码, skipping fenced blocks", () => {
    const body =
      "## 一句话\n\n中文 abc def_1 `x_y` 和 [链接](https://example.test/a-b)。\n\n```calc\n很多很多 abc\n```\n\n## 对照源码\n\n不算的字 abc\n";
    // 一句话 3 + 中文 2 + abc/def_1/x_y 3 + 和 1 + 链接 2 + 对照源码不算
    expect(measureStandard(body, cfg).words).toBe(11);
  });
  it("passes the well-formed page with every value inside the thresholds", () => {
    const m = measureStandard(goodBody(), cfg, diagramOf(900));
    expect(m.words).toBe(1000);
    expect(m.calc).toBe(1);
    expect(m.calcPerK).toBe(1);
    expect(m.marks).toBe(0);
    expect(m.stacked).toEqual([]);
    expect(rules(goodBody(), "good", diagramOf(900))).toEqual([]);
  });
});

describe("a. inline code measurement without artificial quota", () => {
  const withCodes = (n: number) => goodBody({ head: `${prose(60)}${"`1`".repeat(n)}` });
  it("measures inline code spans without failing high-density technical pages", () => {
    expect(measureStandard(withCodes(13), cfg).codePerK).toBe(13);
    expect(measureStandard(withCodes(30), cfg).codePerK).toBe(30);
    expect(rules(withCodes(30))).toEqual([]);
  });
  it("does not count backticks inside fenced blocks or after 对照源码", () => {
    const body = goodBody({
      middle: `\`\`\`text\n${"`1`".repeat(30)}\n\`\`\`\n\n${prose(65)}这里三个字`,
      tail: `${sourceTail}\n${"`1`".repeat(30)}\n`,
    });
    expect(measureStandard(body, cfg).inlineCode).toBe(0);
  });
});

describe("b. evidence marks in prose", () => {
  it("rejects a mark before 对照源码", () => {
    expect(rules(goodBody({ head: `${prose(60)}[C1]` }))).toEqual(["prose-marks"]);
    expect(rules(goodBody({ head: `${prose(60)}[D]` }))).toEqual(["prose-marks"]);
  });
  it("allows marks after 对照源码, inside code, and look-alikes such as arr[0]", () => {
    const body = goodBody({ head: `${prose(59)}\`[C2]\` arr[0]\n\n\`\`\`text\n[S1]\n\`\`\`` });
    expect(measureStandard(body, cfg).marks).toBe(0);
    expect(rules(body)).not.toContain("prose-marks");
  });
});

describe("c. 对照源码 sections", () => {
  it("accepts clean revisions and rejects trailing H2 audit or teaching sections", () => {
    const source = "r@1234567:config.py#L1";
    const before = `---\nid: good\ntitle: Good\ntype: concept\nsummary: Example\nsources: [${source}]\nevidence: I\nupdated: '2026-10-08'\n---\n${goodBody()}\n旧开关默认开启。\n`;
    const after = before.replace("旧开关默认开启。", "新版已移除旧开关。");
    const decision = {
      id: "good",
      kind: "supersede" as const,
      reason: "固定版本纠错",
      claims: [{ old: "旧开关默认开启。", replacement: "新版已移除旧开关。", sources: [source] }],
    };
    const revised = revisePage("concepts/good.md", before, after, decision, "2026-10-08");
    const body = parsePage("concepts/good.md", revised).page!.body;
    expect(() => verifyRevision("concepts/good.md", before, revised, decision, "2026-10-08")).not.toThrow();
    expect(rules(body)).toEqual([]);
    for (const invalid of [
      `${body}\n## 延伸阅读\n正文。`,
      `${body}\n## 已废弃的说法\n### 2026-10-08 · 修订 aaaaaaaaaaaaaaaa\n旧文。`,
      `${goodBody()}\n## 已废弃的说法\n正文。`,
    ])
      expect(rules(invalid)).toContain("source-sections");
  });

  it("rejects a page without 对照源码", () => {
    expect(rules(goodBody({ tail: "" }))).toEqual(["source-sections"]);
  });
  it("allows topic-adaptive H3 subsections under 对照源码 instead of locking 5 fixed H3s", () => {
    const matrixAndAnchors = tailOf(["四版本核验矩阵", "核心源码锚点"]);
    const subset = tailOf(["怎么开", "版本差异", "源码位置"]);
    const compact = "## 对照源码\n\n紧凑源码锚点与四版本对照 [C1]。\n";
    for (const tail of [matrixAndAnchors, subset, compact]) expect(rules(goodBody({ tail }))).toEqual([]);
  });
  it("rejects an H2 after 对照源码 but ignores headings inside fences", () => {
    expect(rules(goodBody({ tail: `${sourceTail}## 延伸阅读\n` }))).toEqual(["source-sections"]);
    expect(rules(goodBody({ tail: `${sourceTail}\`\`\`text\n## 不是标题\n### 也不是\n\`\`\`\n` }))).toEqual(
      [],
    );
  });
  it("allows protected auto-generated param H2 sections after 对照源码 without counting their marks as prose", () => {
    const paramTail = [
      sourceTail.trimEnd(),
      "",
      "## 版本谱系",
      "",
      "| 版本 | 状态 |",
      "|---|---|",
      "| v0.30.0 | 已定义 |",
      "",
      "## 参数定义（自动生成）",
      "",
      "默认值：`False` [C1]。",
      "",
    ].join("\n");
    const m = measureStandard(goodBody({ tail: paramTail }), cfg);
    expect(m.sourceSections).toBeNull();
    expect(m.marks).toBe(0);
    expect(rules(goodBody({ tail: paramTail }))).toEqual([]);
    expect(rules(goodBody({ tail: `${paramTail}\n## 延伸阅读\n` }))).toEqual(["source-sections"]);
  });
});

describe("d. calc density (advisory, non-blocking)", () => {
  it("surfaces >1.2 calc blocks per thousand words as a visible advisory without blocking", () => {
    const two = goodBody({ middle: `${calc}\n\n${prose(30)}\n\n${calc}\n\n${prose(34)}甲乙丙` });
    expect(measureStandard(two, cfg).calcPerK).toBe(2);
    expect(rules(two)).toEqual([]);
    expect(advisories(two)).toEqual(["calc-density"]);
    expect(formatStandard(measureStandard(two, cfg), cfg)).toContain("!calc 2.00/千字");
  });
  it("does not count calc blocks after 对照源码", () => {
    const body = goodBody({ tail: `${sourceTail}${calc}\n\n说明\n\n${calc}\n` });
    expect(measureStandard(body, cfg).calc).toBe(1);
    expect(rules(body)).toEqual([]);
    expect(advisories(body)).toEqual([]);
  });
});

describe("e. stacked calc blocks and tables (advisory, non-blocking)", () => {
  const middle = (between: string) => `${prose(30)}\n\n${between}\n\n${prose(34)}这里三个字`;
  it("surfaces adjacent calc/table blocks as an advisory without blocking", () => {
    for (const pair of [
      `${calc}\n\n${table}`,
      `${table}\n\n\n${calc}`,
      `${table}\n\n${table}`,
      `${calc}\n${table}`,
    ]) {
      const body = goodBody({ middle: middle(pair) });
      expect(measureStandard(body, cfg).stacked.length).toBe(1);
      expect(rules(body)).toEqual([]);
      expect(advisories(body)).toContain("stacked-blocks");
      expect(formatStandard(measureStandard(body, cfg), cfg)).toContain("!相邻块 1");
    }
  });
  it("produces no stacked-blocks advisory when a prose paragraph sits between", () => {
    const body = goodBody({ middle: middle(`${calc}\n\n说一句。\n\n${table}`) });
    expect(rules(body)).toEqual([]);
    expect(advisories(body)).toEqual([]);
  });
  it("only checks the prose: adjacent version tables after 对照源码 are allowed", () => {
    const body = goodBody({ tail: `${sourceTail}${table}\n\n${table}\n\n${calc}\n` });
    expect(measureStandard(body, cfg).stacked).toEqual([]);
    expect(rules(body)).toEqual([]);
    expect(advisories(body)).toEqual([]);
  });
});

describe("f. diagram first (advisory, non-blocking)", () => {
  it("surfaces a calc block before the first diagram as an advisory without blocking", () => {
    const body = goodBody({ head: `${calc}\n\n${prose(59)}` });
    expect(rules(body)).toEqual([]);
    expect(advisories(body)).toContain("diagram-first");
    expect(formatStandard(measureStandard(body, cfg), cfg)).toContain("!图先行");
  });
  it("surfaces a first diagram outside the first two H2 sections as an advisory without blocking", () => {
    const body = goodBody({
      middle: `${prose(30)}\n\n## 第三节\n\n${diagram("demo2")}\n\n${prose(34)}`,
    }).replace(`${diagram()}\n`, "");
    expect(rules(body)).toEqual([]);
    expect(advisories(body)).toContain("diagram-first");
  });
  it("accepts a page with no filler diagram, and accepts a diagram before the first H2", () => {
    expect(rules(goodBody().replace(diagram(), ""))).toEqual([]);
    expect(advisories(goodBody().replace(diagram(), ""))).toEqual([]);
    const early = `${diagram()}\n\n${goodBody().replace(diagram(), "")}`;
    expect(rules(early)).toEqual([]);
    expect(advisories(early)).not.toContain("diagram-first");
  });
});

describe("g. hedge sentences (advisory, non-blocking, preserves applicability conditions)", () => {
  const withHedges = (n: number) =>
    goodBody({ head: `${prose(60 - n)}${"这里可能不对。".repeat(n)}`, middle: prose(40) });
  it("counts sentences in the prose and surfaces >=3% share as a non-blocking advisory warning against deleting real conditions", () => {
    const checked = checkStandard({ file: "concepts/good.md", fm: { id: "good" }, body: withHedges(3) }, cfg);
    expect(checked.measure.sentences).toBe(100);
    expect(checked.measure.hedged).toBe(3);
    expect(checked.problems).toEqual([]);
    expect(checked.advisories.map((p) => p.rule)).toContain("hedge-ratio");
    expect(checked.advisories[0]?.message).toMatch(/切勿.*删减真实限制条件/);
    expect(formatStandard(checked.measure, cfg)).toContain("!免责 3.0%");
  });
  it("does not emit hedge-ratio advisory below 3%", () => {
    expect(measureStandard(withHedges(2), cfg).hedgeRatio).toBe(0.02);
    expect(rules(withHedges(2))).toEqual([]);
    expect(advisories(withHedges(2))).not.toContain("hedge-ratio");
  });
});

describe("line numbers", () => {
  it("reports file line numbers once the frontmatter offset is known", () => {
    const body = `${calc}\n\n${table}\n`;
    const raw = `---\nid: x\n---\n${body}`;
    expect(bodyLineOffset(raw, body)).toBe(3);
    expect(measureStandard(body, cfg, undefined, bodyLineOffset(raw, body)).stacked).toEqual([8]);
  });
  it("names both diagram-first failures when both happen", () => {
    const body = `## 一\n\n${calc}\n\n说明。\n\n## 二\n\n说明。\n\n## 三\n\n${diagram()}\n`;
    expect(measureStandard(body, cfg).diagramFirst).toMatch(/之前.*第 3 个 H2/);
  });
});

describe("diagram width", () => {
  it("rejects a referenced diagram wider than 900", () => {
    expect(rules(goodBody(), "good", diagramOf(901))).toEqual(["diagram-width"]);
    expect(rules(goodBody(), "good", diagramOf(900))).toEqual([]);
  });
});

describe("page list", () => {
  it("honours per-page skips for both blocking rules and advisories", () => {
    const guideWithLateDiagram = goodBody({
      head: `${calc}\n\n${prose(59)}`,
      tail: "",
    });
    expect(rules(guideWithLateDiagram, "guide")).toEqual([]);
    expect(advisories(guideWithLateDiagram, "guide")).not.toContain("diagram-first");
    expect(formatStandard(measureStandard(guideWithLateDiagram, cfg), cfg, cfg.skip.guide)).toContain(
      "–图先行",
    );
  });
  it("enforces blocking rules on listed pages while keeping advisory diagnostics non-blocking and visible", () => {
    const advisoryBody = goodBody({
      head: `${calc}\n\n${table}\n\n${"在特定配置下可能改变耗时。".repeat(5)}${prose(50)}`,
    });
    const pages = [
      { file: "concepts/good.md", fm: { id: "good" }, body: advisoryBody },
      { file: "concepts/guide.md", fm: { id: "guide" }, body: `${prose(20)}[C1]` },
      { file: "concepts/other.md", fm: { id: "other" }, body: goodBody({ tail: "" }) },
    ];
    const r = auditStandard(pages, cfg);
    expect(r.problems.map((p) => `${p.file} ${p.rule}`)).toEqual(["concepts/guide.md prose-marks"]);
    expect(r.advisories.map((p) => p.rule)).toEqual([
      "calc-density",
      "stacked-blocks",
      "diagram-first",
      "hedge-ratio",
    ]);
    expect(r.enforced.map((e) => e.id)).toEqual(["good", "guide"]);
    expect(r.missing).toEqual([]);
    expect(r.unlisted.pages).toBe(1);
    expect(r.unlisted.failing).toEqual({ "source-sections": 1 });

    const formatted = formatStandardAuditSummary(r);
    expect(formatted.summaryLine).toContain("名单 2 页，达标 1 页");
    expect(formatted.advisoryLines[0]).toMatch(/^! 写作建议 4 处（供教学审阅参考，不阻塞）：$/);
    expect(formatted.problemLines).toEqual([
      "x concepts/guide.md [prose-marks] [写作标准] 「## 对照源码」之前还有 1 个证据角标，正文里不写角标",
    ]);
  });
  it("loads the committed page list and advisory rule set", () => {
    const real = loadStandardConfig();
    expect(real.pages).toContain("tensor-parallel");
    expect(real.skip["learning-guide"]).toContain("source-sections");
    expect(real.advisoryRules).toEqual(["calc-density", "stacked-blocks", "diagram-first", "hedge-ratio"]);
  });
});
