import { describe, expect, it } from "vitest";
import { collectStepTerms, lintLog, lintPages } from "./lint";
import type { WikiPage } from "./pages";

/** 概念页的合法骨架，让不关心分节的用例不必自己写全七节 */
const SKELETON = ["一句话", "为什么需要它", "怎么工作", "事实表", "常见误解"]
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
    sources: ["https://docs.vllm.ai/projects/ascend/en/latest/index.html"],
    evidence: "S",
    relations: [],
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
        [
          mk(
            "a",
            { relations: [{ to: "b", kind: "builds-on", note: "a 的形状由 b 决定" }] },
            "[b](b.md) [raw](../raw/a.md)",
          ),
          mk("b"),
        ],
        opts,
      ),
    ).toEqual([]);
  });
  it("dup-id / dup-alias（忽略大小写，alias 撞 id 也算）", () => {
    const r = lintPages([mk("a"), { ...mk("a"), file: "sources/a.md" }, mk("b", { aliases: ["A"] })], opts);
    expect(r.map((p) => p.rule)).toEqual(expect.arrayContaining(["dup-id", "dup-alias"]));
  });
  it("unknown-chapter / relation-missing / broken-link", () => {
    const r = lintPages(
      [
        mk(
          "a",
          { chapters: ["99"], relations: [{ to: "nope", kind: "builds-on", note: "x" }] },
          "[x](nope.md) [ok](../raw/a.md) [web](https://z)",
        ),
      ],
      opts,
    );
    expect(r.map((p) => p.rule).sort()).toEqual(["broken-link", "relation-missing", "unknown-chapter"]);
    expect(r.find((p) => p.rule === "broken-link")?.message).toContain("nope.md");
  });
  it("relation-duplicate：有向边两边各写一次", () => {
    // 反向边由 wiki:build 派生，手写第二次会让「接着看」重复出现同一页
    const both = lintPages(
      [
        mk("a", { relations: [{ to: "b", kind: "builds-on", note: "n" }] }),
        mk("b", { relations: [{ to: "a", kind: "builds-on", note: "n" }] }),
      ],
      opts,
    );
    expect(both.map((p) => p.rule)).toEqual(["relation-duplicate", "relation-duplicate"]);
    // 对称边两边都写不算重复——它本来就没有方向
    const sym = lintPages(
      [
        mk("a", { relations: [{ to: "b", kind: "conflicts-with", note: "n" }] }),
        mk("b", { relations: [{ to: "a", kind: "conflicts-with", note: "n" }] }),
      ],
      opts,
    );
    expect(sym).toEqual([]);
  });

  it("relation-selfloop / 同一对 (to, kind) 写两次", () => {
    const self = lintPages([mk("a", { relations: [{ to: "a", kind: "builds-on", note: "n" }] })], opts);
    expect(self.map((p) => p.rule)).toEqual(["relation-selfloop"]);
    const twice = lintPages(
      [
        mk("a", {
          relations: [
            { to: "b", kind: "builds-on", note: "n" },
            { to: "b", kind: "builds-on", note: "n2" },
          ],
        }),
        mk("b"),
      ],
      opts,
    );
    expect(twice.map((p) => p.rule)).toEqual(["relation-duplicate"]);
  });

  it("relation-empty：多页知识库里没有任何边的教学页报红", () => {
    const r = lintPages([mk("a"), mk("b")], opts);
    expect(r.map((p) => p.rule)).toEqual(["relation-empty", "relation-empty"]);
    // 只有一页时没东西可连，不算孤立
    expect(lintPages([mk("a")], opts)).toEqual([]);
  });
  it("orphan：无 chapters 且无入链；有入链即不算", () => {
    expect(lintPages([mk("lonely", { chapters: [] })], opts)[0]?.rule).toBe("orphan");
    expect(
      lintPages(
        [
          mk("lonely", { chapters: [], relations: [{ to: "a", kind: "builds-on", note: "n" }] }),
          mk("a", {}, "[l](lonely.md)"),
        ],
        opts,
      ),
    ).toEqual([]);
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
  const SECTIONS = ["一句话", "为什么需要它", "怎么工作", "事实表", "常见误解"];
  const fullBody = SECTIONS.map((h) => `## ${h}\nx`).join("\n");

  it("missing-section：缺必需小节报红，齐全放行", () => {
    const bad = lintPages([mkRaw("a", {}, "## 一句话\nx\n## 常见误解\ny")], opts);
    expect(bad.map((p) => p.rule)).toContain("missing-section");
    const good = lintPages([mkRaw("a", {}, fullBody)], opts);
    expect(good.map((p) => p.rule)).not.toContain("missing-section");
  });

  it("stray-whatsnext：正文手写 ## 接着看报红（它由 relations 生成）", () => {
    const withIt = `${fullBody}\n## 接着看\n- [b](b.md)`;
    const bad = lintPages([mkRaw("a", {}, withIt)], { ...opts, existsFile: () => true });
    expect(bad.map((p) => p.rule)).toContain("stray-whatsnext");
    expect(lintPages([mkRaw("a", {}, fullBody)], opts).map((p) => p.rule)).not.toContain("stray-whatsnext");
  });

  it("unexpanded-placeholder：正文残留 {{ }} 报红", () => {
    const bad = lintPages([mkRaw("a", {}, `${fullBody}\npip install vllm-ascend=={{ pip_version }}`)], opts);
    expect(bad.map((p) => p.rule)).toContain("unexpanded-placeholder");
    expect(lintPages([mkRaw("a", {}, fullBody)], opts).map((p) => p.rule)).not.toContain(
      "unexpanded-placeholder",
    );
  });

  it("mark-unnumbered：[C] 不带来源编号报红，[D] 不带编号是对的", () => {
    // PLAN §1.4 的原设计是 [C##]：声称有一手来源就要给得出编号，读者才能核对
    const bare = lintPages([mkRaw("a", {}, `${fullBody}\n块大小是 128 [C]。`)], opts);
    expect(bare.map((p) => p.rule)).toContain("mark-unnumbered");
    const numbered = lintPages([mkRaw("a", {}, `${fullBody}\n块大小是 128 [C1]。`)], opts);
    expect(numbered.map((p) => p.rule)).not.toContain("mark-unnumbered");
    const derived = lintPages([mkRaw("a", {}, `${fullBody}\n由此推出 112 KiB [D]。`)], opts);
    expect(derived.map((p) => p.rule)).toEqual([]);
  });

  it("mark-index：编号越界，或推导类标记带了编号", () => {
    const over = lintPages([mkRaw("a", {}, `${fullBody}\nx [C9]。`)], opts);
    expect(over.find((p) => p.rule === "mark-index")?.message).toContain("只有 1 条");
    const wrong = lintPages([mkRaw("a", {}, `${fullBody}\nx [D1]。`)], opts);
    expect(wrong.find((p) => p.rule === "mark-index")?.message).toContain("不该带编号");
  });

  it("mark-flood：标记过密只警告", () => {
    const many = `${fullBody}\n${"句子 [C1]。".repeat(31)}`;
    expect(lintPages([mkRaw("a", {}, many)], opts).map((p) => p.rule)).toContain("mark-flood");
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

describe("lintPages · 可引来源分级", () => {
  const body = SKELETON;
  const official = "https://docs.vllm.ai/projects/ascend/en/latest/x.html";

  it("表外来源 + 高等级（S/C）报错——拿博客冒充官方实证", () => {
    for (const ev of ["S", "C"] as const) {
      const bad = mkRaw("a", { sources: [official, "https://zhuanlan.zhihu.com/p/1"], evidence: ev }, body);
      expect(
        lintPages([bad], opts).map((p) => p.rule),
        ev,
      ).toContain("source-domain");
    }
  });

  it("表外来源 + 低等级（D/I/A）只警告，不阻塞——引博客并诚实标成推断是合理的", () => {
    for (const ev of ["D", "I", "A"] as const) {
      const rules = lintPages(
        [mkRaw("a", { sources: [official, "https://zhuanlan.zhihu.com/p/1"], evidence: ev }, body)],
        opts,
      ).map((p) => p.rule);
      expect(rules, ev).toContain("source-unlisted");
      expect(rules, ev).not.toContain("source-domain");
    }
  });

  it("一页的来源全在表外则报错——没有任何可核对的一手依据", () => {
    const bad = mkRaw("a", { sources: ["https://zhuanlan.zhihu.com/p/1"], evidence: "I" }, body);
    expect(lintPages([bad], opts).map((p) => p.rule)).toContain("source-domain");
  });

  it("昇腾在 gitee / gitcode 的一手仓库放行", () => {
    const ok = mkRaw(
      "a",
      { sources: ["https://gitee.com/ascend/ascend-transformer-boost"], evidence: "S" },
      body,
    );
    const rules = lintPages([ok], opts).map((p) => p.rule);
    expect(rules).not.toContain("source-domain");
    expect(rules).not.toContain("source-unlisted");
  });

  it("evidence S 需要官方或论文档的来源，生态站撑不起", () => {
    const eco = mkRaw("a", { sources: ["https://pytorch.org/docs/stable/x.html"], evidence: "S" }, body);
    const rules = lintPages([eco], opts).map((p) => p.rule);
    expect(rules).not.toContain("source-domain");
    expect(rules).toContain("doc-evidence");
  });

  it("生态站配 D 就没问题", () => {
    const eco = mkRaw("a", { sources: ["https://pytorch.org/docs/stable/x.html"], evidence: "D" }, body);
    expect(lintPages([eco], opts).map((p) => p.rule)).toEqual([]);
  });

  it("论文可以撑起 S", () => {
    const paper = mkRaw("a", { sources: ["https://arxiv.org/abs/2309.06180"], evidence: "S" }, body);
    expect(lintPages([paper], opts).map((p) => p.rule)).not.toContain("doc-evidence");
  });
});
