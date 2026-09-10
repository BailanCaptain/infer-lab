import { describe, expect, it } from "vitest";
import { collectStepTerms, lintLog, lintPages } from "./lint";
import type { WikiPage } from "./pages";

/** 概念页的合法骨架，让不关心分节的用例不必自己写全七节 */
const SKELETON = ["一句话", "为什么需要它", "怎么工作", "事实表", "常见误解", "接着看"]
  .map((h) => `## ${h}\nx`)
  .join("\n");

/** 默认带合法骨架；传入的 body 追加在后面 */
const mk = (id: string, over: Partial<WikiPage["fm"]> = {}, body = ""): WikiPage => ({
  file: `concepts/${id}.md`,
  body: body ? `${SKELETON}\n${body}` : SKELETON,
  fm: {
    id,
    title: id,
    type: "concept",
    summary: "s",
    aliases: [],
    prerequisites: [],
    chapters: ["11"],
    sources: ["https://x"],
    evidence: "S",
    related: [],
    contradicts: [],
    updated: "2026-09-07",
    ...over,
  },
});
const opts = { chapterIds: ["11", "12"], existsFile: (rel: string) => rel === "raw/a.md" };

describe("lintPages", () => {
  it("干净输入无问题", () => {
    expect(
      lintPages(
        [mk("a", { related: ["b"] }, "[b](b.md) [raw](../raw/a.md)"), mk("b", { related: ["a"] })],
        opts,
      ),
    ).toEqual([]);
  });
  it("dup-id / dup-alias（忽略大小写，alias 撞 id 也算）", () => {
    const r = lintPages([mk("a"), { ...mk("a"), file: "sources/a.md" }, mk("b", { aliases: ["A"] })], opts);
    expect(r.map((p) => p.rule)).toEqual(expect.arrayContaining(["dup-id", "dup-alias"]));
  });
  it("unknown-chapter / related-missing / broken-link", () => {
    const r = lintPages(
      [mk("a", { chapters: ["99"], related: ["nope"] }, "[x](nope.md) [ok](../raw/a.md) [web](https://z)")],
      opts,
    );
    expect(r.map((p) => p.rule).sort()).toEqual(["broken-link", "related-missing", "unknown-chapter"]);
    expect(r.find((p) => p.rule === "broken-link")?.message).toContain("nope.md");
  });
  it("related-asymmetric：A 指 B 而 B 不回指 A", () => {
    const r = lintPages([mk("a", { related: ["b"] }), mk("b")], opts);
    expect(r).toEqual([
      { file: "concepts/a.md", rule: "related-asymmetric", message: "related 含 b，但 b 没有回指 a" },
    ]);
    expect(lintPages([mk("a", { related: ["b"] }), mk("b", { related: ["a"] })], opts)).toEqual([]);
  });
  it("orphan：无 chapters 且无入链；有入链即不算", () => {
    expect(lintPages([mk("lonely", { chapters: [] })], opts)[0]?.rule).toBe("orphan");
    expect(lintPages([mk("lonely", { chapters: [] }), mk("a", {}, "[l](lonely.md)")], opts)).toEqual([]);
    expect(lintPages([mk("doc", { chapters: [], type: "source" })], opts)).toEqual([]);
  });
  it("missing-term 只在给了 requiredTerms 时检查", () => {
    expect(lintPages([mk("a")], { ...opts, requiredTerms: ["a", "kv-cache"] })).toEqual([
      {
        file: "src/sim/model/forwardLayer.ts",
        rule: "missing-term",
        message: "Step.terms 引用的 kv-cache 没有页面",
      },
    ]);
  });
});

describe("lintLog", () => {
  it("H2 必须是 ## [YYYY-MM-DD] ingest|build|review | 标题", () => {
    expect(lintLog("## [2026-09-07] ingest | KV Cache\n内容\n")).toEqual([]);
    expect(lintLog("## 2026-09-07 随便\n")[0]?.rule).toBe("log-format");
  });
});

describe("collectStepTerms", () => {
  it("从真实 forwardLayer 收到 30 个不重复 id", () => {
    const terms = collectStepTerms();
    expect(terms).toHaveLength(30);
    expect(terms).toContain("kv-cache");
  });
});

/**
 * HANDBOOK 声明的六条新规则（Task 29）。规则声明了却不执行等于没有，
 * 所以每条都配一红一绿。
 */
/** 精确控制正文的用例用它，不自动补骨架 */
const mkRaw = (id: string, over: Partial<WikiPage["fm"]> = {}, body = ""): WikiPage => ({
  ...mk(id, over),
  body,
});

describe("lintPages · HANDBOOK 新规则", () => {
  const SECTIONS = ["一句话", "为什么需要它", "怎么工作", "事实表", "常见误解", "接着看"];
  const fullBody = SECTIONS.map((h) => `## ${h}\nx`).join("\n");

  it("missing-section：缺必需小节报红，齐全放行", () => {
    const bad = lintPages([mkRaw("a", {}, "## 一句话\nx\n## 常见误解\ny")], opts);
    expect(bad.map((p) => p.rule)).toContain("missing-section");
    const good = lintPages([mkRaw("a", {}, fullBody)], opts);
    expect(good.map((p) => p.rule)).not.toContain("missing-section");
  });

  it("whatsnext-overflow：接着看超过五条报红", () => {
    const six = `${fullBody}\n${Array.from({ length: 6 }, (_, i) => `- [p${i}](p${i}.md)`).join("\n")}`;
    const bad = lintPages([mkRaw("a", {}, six)], { ...opts, existsFile: () => true });
    expect(bad.map((p) => p.rule)).toContain("whatsnext-overflow");
    const five = `${fullBody}\n${Array.from({ length: 5 }, (_, i) => `- [p${i}](p${i}.md)`).join("\n")}`;
    const good = lintPages([mkRaw("a", {}, five)], { ...opts, existsFile: () => true });
    expect(good.map((p) => p.rule)).not.toContain("whatsnext-overflow");
  });

  it("unexpanded-placeholder：正文残留 {{ }} 报红", () => {
    const bad = lintPages([mkRaw("a", {}, `${fullBody}\npip install vllm-ascend=={{ pip_version }}`)], opts);
    expect(bad.map((p) => p.rule)).toContain("unexpanded-placeholder");
    expect(lintPages([mkRaw("a", {}, fullBody)], opts).map((p) => p.rule)).not.toContain(
      "unexpanded-placeholder",
    );
  });

  it("prerequisites-missing：指向不存在的 id 报红", () => {
    const bad = lintPages([mkRaw("a", { prerequisites: ["nope"] }, fullBody)], opts);
    expect(bad.map((p) => p.rule)).toContain("prerequisites-missing");
    const good = lintPages(
      [
        mkRaw("a", { prerequisites: ["b"], related: ["b"] }, fullBody),
        mkRaw("b", { related: ["a"] }, fullBody),
      ],
      opts,
    );
    expect(good.map((p) => p.rule)).not.toContain("prerequisites-missing");
  });

  it("doc-evidence：主体来自文档却不标 S 报红；源码为主标 C 放行", () => {
    const docHeavy = mkRaw(
      "a",
      {
        sources: [
          "r@abc1234:docs/source/x.md#L1-L2",
          "r@abc1234:docs/source/y.md#L1-L2",
          "r@abc1234:a.py#L1",
        ],
        evidence: "C",
      },
      fullBody,
    );
    expect(lintPages([docHeavy], opts).map((p) => p.rule)).toContain("doc-evidence");

    // 七页试点的真实形态：源码 15 条、文档 2 条，标 C 是对的
    const codeHeavy = mkRaw(
      "a",
      {
        sources: [
          ...Array.from({ length: 15 }, (_, i) => `r@abc1234:a${i}.py#L1`),
          "r@abc1234:docs/source/x.md#L1",
        ],
        evidence: "C",
      },
      fullBody,
    );
    expect(lintPages([codeHeavy], opts).map((p) => p.rule)).not.toContain("doc-evidence");
  });

  it("doc-evidence：标 S 却一条文档来源都没有也报红", () => {
    const bad = mkRaw("a", { sources: ["r@abc1234:a.py#L1"], evidence: "S" }, fullBody);
    expect(lintPages([bad], opts).map((p) => p.rule)).toContain("doc-evidence");
  });

  it("diagram-identifier：图里的文件在 sources 覆盖范围外报红", () => {
    const withDiagram = (file: string) =>
      `${fullBody}\n\`\`\`mermaid\nflowchart TD\n  A[${file}] --> B[x]\n\`\`\``;
    const bad = mkRaw("a", { sources: ["r@abc1234:real.py#L1"] }, withDiagram("fake.py"));
    expect(lintPages([bad], opts).map((p) => p.rule)).toContain("diagram-identifier");
    const good = mkRaw("a", { sources: ["r@abc1234:real.py#L1"] }, withDiagram("real.py"));
    expect(lintPages([good], opts).map((p) => p.rule)).not.toContain("diagram-identifier");
  });

  it("参数页用自己的必需小节，不套用概念页那套", () => {
    const paramBody = ["一句话", "事实表", "为什么存在", "开了的代价", "接着看"]
      .map((h) => `## ${h}\nx`)
      .join("\n");
    const good = lintPages([mkRaw("p", { type: "param" }, paramBody)], opts);
    expect(good.map((x) => x.rule)).not.toContain("missing-section");
  });
});

describe("lintPages · 旧格式页的过渡（Task 29）", () => {
  const legacyBody = ["是什么", "形状与数值", "在哪一步出现", "常见误解"].map((h) => `## ${h}\nx`).join("\n");

  it("旧四节格式的页报 legacy-format，而不是逐条报缺小节", () => {
    const problems = lintPages([mkRaw("a", {}, legacyBody)], opts);
    const rules = problems.map((p) => p.rule);
    expect(rules).toContain("legacy-format");
    expect(rules).not.toContain("missing-section");
  });

  it("legacy-format 只报一次，不刷屏", () => {
    const problems = lintPages([mkRaw("a", {}, legacyBody)], opts);
    expect(problems.filter((p) => p.rule === "legacy-format").length).toBe(1);
  });

  it("新格式页不会被误判成旧格式", () => {
    const rules = lintPages([mk("a")], opts).map((p) => p.rule);
    expect(rules).not.toContain("legacy-format");
  });

  it("两种格式都不沾的页，照常报缺小节", () => {
    const rules = lintPages([mkRaw("a", {}, "## 随便写的\nx")], opts).map((p) => p.rule);
    expect(rules).toContain("missing-section");
    expect(rules).not.toContain("legacy-format");
  });
});
