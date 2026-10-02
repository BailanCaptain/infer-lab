import { describe, expect, it } from "vitest";
import { collectStepTerms, lintLog, lintPages } from "./lint";
import { parsePage, type WikiPage } from "./pages";

/** 概念页的合法骨架，让不关心分节的用例不必自己写全七节 */
const SKELETON = ["一句话", "为什么需要它", "怎么工作", "事实表", "常见误解"]
  .map((h) => `## ${h}\nx`)
  .join("\n");

/** 默认带合法骨架；传入的 body 追加在后面 */
const mk = (id: string, over: Partial<WikiPage["fm"]> = {}, body = ""): WikiPage => ({
  file: `concepts/${id}.md`,
  body: body ? `${SKELETON}\n${body}` : SKELETON,
  fm: {
    origin: "seed",
    id,
    title: id,
    type: "concept",
    summary: "s",
    aliases: [],
    order: 500,
    prerequisites: [],
    chapters: ["11"],
    sources: ["https://docs.vllm.ai/projects/ascend/en/latest/index.html"],
    evidence: "S",
    relations: [],
    related: [],
    contradicts: [],
    verified: [],
    updated: "2026-09-07",
    ...over,
  },
});
const opts = { chapterIds: ["11", "12"], existsFile: (rel: string) => rel === "raw/a.md" };

it("flags substantive cross-page overlap unless either page links to the other", () => {
  const body = "## 相同的调度限制\n调度队列达到上限之后会暂停接纳新的请求。\n";
  const a = mk("a", {}, body);
  const b = mk("b", {}, body);
  const overlap = () => lintPages([a, b], opts).filter((p) => p.rule === "cross-page-overlap");
  expect(overlap()).toHaveLength(2);
  b.fm.relations = [{ to: "a", kind: "builds-on", note: "复用 a 的队列限制" }];
  expect(overlap()).toHaveLength(0);
  b.fm.relations = [];
  b.body += "\n[a](a.md)";
  expect(overlap()).toHaveLength(0);
  expect(lintPages([mk("c"), mk("d")], opts).filter((p) => p.rule === "cross-page-overlap")).toEqual([]);
});

/**
 * 2026-09-19 放开必需小节时，样板标题表必须和 REQUIRED_SECTIONS 解耦。
 * 不解耦的话「不再强制骨架」会顺手把重复检测一起关掉：样板小节从豁免名单里
 * 掉出来，每页的「怎么工作」都会互相撞成 cross-page-overlap。
 */
it("样板小节不参与重复比对，自定小节参与", () => {
  const long = "调度队列达到上限之后会暂停接纳新的请求，直到有请求退出。";
  const boilerplate = `## 一句话\n${long}\n## 怎么工作\n${long}\n## 常见误解\n${long}\n`;
  const overlap = (pages: WikiPage[]) =>
    lintPages(pages, opts).filter((p) => p.rule === "cross-page-overlap");
  expect(overlap([mkRaw("a", {}, boilerplate), mkRaw("b", {}, boilerplate)])).toEqual([]);
  const custom = `## 一句话\nx\n## 目录地图\n${long}\n`;
  expect(overlap([mkRaw("a", {}, custom), mkRaw("b", {}, custom)])).toHaveLength(2);
});

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
  it("unknown-verified-ref：verified 里写了 seeds 没登记的版本名", () => {
    const pages = [mk("a", { verified: ["main", "releases/v0.26"] })];
    const r = lintPages(pages, { ...opts, knownRefs: ["main", "releases/v0.26.0rc"] });
    expect(r.map((p) => p.rule)).toEqual(["unknown-verified-ref"]);
    expect(r[0]?.message).toContain("releases/v0.26");
    // 没给 knownRefs（没有 seeds 的环境）就不查
    expect(lintPages(pages, opts)).toEqual([]);
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
  it("link-outside-wiki：链接越出 wiki/ 就报，不看目标文件在不在", () => {
    // 阅读页只发布 wiki/ 里的东西，越界的相对链接在站上一定是死链；
    // 也不能把越界路径交给 existsFile——巡检那边的实现会因此抛错（2026-10-03 夜间崩溃）
    const asked: string[] = [];
    const r = lintPages([mk("a", {}, "[底稿](../../docs/mainline/02-forward.md#13-x) [ok](../raw/a.md)")], {
      ...opts,
      existsFile: (rel) => {
        asked.push(rel);
        return true;
      },
    });
    expect(r).toEqual([
      {
        file: "concepts/a.md",
        rule: "link-outside-wiki",
        message: expect.stringContaining("../docs/mainline/02-forward.md"),
      },
    ]);
    expect(asked).toEqual(["raw/a.md"]);
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

  // 2026-09-19 放开固定骨架，只留 `## 一句话`；2026-09-25 读者定为初学者，一句话也不再强制，
  // 开头改成「先给一个具体问题」——那条机器查不了，写在 HANDBOOK。
  it("概念页与特性页不再强制 ## 一句话，自定分节照样放行", () => {
    for (const type of ["concept", "feature"] as const) {
      const rules = lintPages([mkRaw("a", { type }, "## 为什么要拆\nx\n## 从报错找到文件\nz")], opts).map(
        (p) => p.rule,
      );
      expect(rules).not.toContain("missing-section");
    }
    expect(lintPages([mkRaw("a", {}, fullBody)], opts).map((p) => p.rule)).not.toContain("missing-section");
  });

  describe("教学分节按主题组织，证据可就近出现", () => {
    const upper = "## 一个模型装不下\n讲解。";
    it("兼容旧页的五类小标题", () => {
      const body = `${upper}\n## 对照源码\n### 怎么开\n开法 [C1]\n### 版本差异\n差异 [C1]\n### 源码位置\n位置 [C1]`;
      const rules = lintPages([mkRaw("a", {}, body)], opts).map((p) => p.rule);
      expect(rules).not.toContain("source-half-heading");
      expect(rules).not.toContain("mark-in-upper-half");
    });
    it("对照源码允许按本页职责组织小节，不强制开关模板和顺序", () => {
      const invented = `${upper}\n## 对照源码\n### 实现细节\nx`;
      const shuffled = `${upper}\n## 对照源码\n### 源码位置\nx\n### 怎么开\ny`;
      for (const body of [invented, shuffled]) {
        const bad = lintPages([mkRaw("a", {}, body)], opts).filter((p) => p.rule === "source-half-heading");
        expect(bad).toEqual([]);
      }
    });
    it("讲解中的引用可就近出现，错误编号仍然拒收", () => {
      const body = `## 请求交给谁\nScheduler 的职责有来源 [C1]。\n## 对照源码\n### 调度输入与状态\n位置 [C1]`;
      const formatRules = ["mark-in-upper-half", "source-half-heading", "mark-index"];
      const problems = lintPages([mkRaw("a", {}, body)], opts);
      expect(problems.filter((p) => formatRules.includes(p.rule))).toEqual([]);
      for (const type of ["concept", "feature"] as const) {
        const invalid = body.replace("来源 [C1]", "来源 [C2]");
        expect(lintPages([mkRaw("a", { type }, invalid)], opts).map((p) => p.rule)).toContain("mark-index");
      }
    });
    it.each(["```", "~~~~"])("%s 代码围栏里的方括号不是引用，围栏外仍检查", (fence) => {
      const fenced = `## 一个模型装不下\n${fence}text\nx[C99]\n${fence}\n## 对照源码\n### 源码位置\n位置 [C1]`;
      expect(lintPages([mkRaw("a", {}, fenced)], opts).map((p) => p.rule)).not.toContain("mark-index");
      expect(lintPages([mkRaw("a", {}, `${fenced}\n结论 [C99]`)], opts).map((p) => p.rule)).toContain(
        "mark-index",
      );
    });
    it("不强制为概念页另设「对照源码」段", () => {
      const rules = lintPages([mkRaw("a", {}, "## 一句话\n结论 [C1]")], opts).map((p) => p.rule);
      expect(rules).not.toContain("mark-in-upper-half");
      expect(rules).not.toContain("source-half-heading");
    });
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

  it("stray-tag：正文里裸露的 HTML 标签报红，代码块里的不算", () => {
    // 2026-09-12：整合 agent 给 11 页尾部各留了一个 </content>，block-table 还留了 </invoke>。
    // 正文不走 rehype-raw，这些标签会原样显示在页面上。
    const leaked = lintPages([mkRaw("a", {}, `${fullBody}\n</content>`)], opts);
    expect(leaked.find((p) => p.rule === "stray-tag")?.message).toContain("HTML 标签");

    // HTML 注释同样会原样显示——wiki:lineage 自己就漏过一个（2026-09-14）
    const comment = lintPages([mkRaw("a", {}, `${fullBody}\n<!-- 由脚本生成，勿手改 -->`)], opts);
    expect(comment.map((p) => p.rule)).toContain("stray-tag");

    // mermaid 节点标签里的 <br/> 是合法的，围栏内不能误伤
    const fenced = [fullBody, "```mermaid", "flowchart TD", '  A["x<br/>y"]', "```"].join("\n");
    expect(lintPages([mkRaw("a", {}, fenced)], opts).map((p) => p.rule)).not.toContain("stray-tag");
    expect(lintPages([mkRaw("a", {}, fullBody)], opts).map((p) => p.rule)).not.toContain("stray-tag");
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

  it("两种格式都不沾的页，照常报缺小节（概念页已不强制小节，拿参数页验）", () => {
    const rules = lintPages([mkRaw("a", { type: "param" }, "## 随便写的\nx")], opts).map((p) => p.rule);
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

  it("doc-evidence：仓库里的 docs/ 本地副本算官方来源，两个分支判据一致", () => {
    // 2026-09-14：docCount 认 :docs/ 而 hasOfficial 不认，同一条来源在一个分支
    // 算官方、另一个分支不算，把引了三份官方文档的参数页判成「标 S 却没有官方来源」
    const localDocs = mkRaw(
      "a",
      {
        sources: [
          "r@abc1234:docs/source/user_guide/feature_guide/sleep_mode.md#L48-L58",
          "r@abc1234:vllm_ascend/worker/worker.py#L216-L228",
          "r@abc1234:vllm_ascend/worker/worker.py#L272-L280",
        ],
        evidence: "S",
      },
      body,
    );
    expect(lintPages([localDocs], opts).map((p) => p.rule)).not.toContain("doc-evidence");

    // 一条官方文档都没有时才该报
    const noDocs = mkRaw(
      "a",
      { sources: ["r@abc1234:vllm_ascend/worker/worker.py#L1-L2"], evidence: "S" },
      body,
    );
    expect(lintPages([noDocs], opts).map((p) => p.rule)).toContain("doc-evidence");
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

/**
 * 标题改名后，别的页指向旧标题的 `xxx.md#旧锚点` 在阅读页上静默失效（prefill、moe 各出过一次，
 * 都是审查员手工发现的）。锚点必须按阅读页同一条 markdown 管线算，不能另写一套。
 */
describe("broken-anchor：链接里的 #锚点 必须是目标页阅读页上真有的 id", () => {
  const target = mkRaw(
    "b",
    {},
    [
      "## 新标题",
      "x",
      "## `--max-model-len` 为什么是 128K？",
      "## KV cache 怎么算",
      "## 怎么开",
      "## 怎么开",
      "```text",
      "## 代码块里的不是标题",
      "```",
    ].join("\n"),
  );
  const anchors = (body: string) =>
    lintPages([mkRaw("a", {}, body), target], opts).filter((p) => p.rule === "broken-anchor");

  it("跨页锚点：目标页标题改名后，指向旧标题的链接报错，给出行号与失效锚点", () => {
    const bad = anchors("## 一节\n\n见 [b](b.md#旧标题)。");
    expect(bad).toHaveLength(1);
    expect(bad[0]?.file).toBe("concepts/a.md");
    expect(bad[0]?.message).toContain("第 3 行");
    expect(bad[0]?.message).toContain("#旧标题");
    expect(bad[0]?.message).toContain("concepts/b.md");
  });

  it("与阅读页同一套规则：小写、去全角标点、空格变 -、行内代码按文字、同名依次加 -1", () => {
    expect(
      anchors(
        "[1](b.md#新标题) [2](b.md#--max-model-len-为什么是-128k) [3](b.md#kv-cache-怎么算) [4](b.md#怎么开) [5](b.md#怎么开-1)",
      ),
    ).toEqual([]);
    expect(anchors("[x](b.md#怎么开-2)")).toHaveLength(1);
    // 阅读页按 id 精确查找，大小写不同就跳不到
    expect(anchors("[x](b.md#KV-cache-怎么算)")).toHaveLength(1);
    // 带全角问号的原文不是锚点
    expect(anchors("[x](b.md#--max-model-len-为什么是-128k？)")).toHaveLength(1);
  });

  it("百分号编码的锚点按解码后比对", () => {
    expect(anchors(`[x](b.md#${encodeURIComponent("新标题")})`)).toEqual([]);
    expect(anchors(`[x](b.md#${encodeURIComponent("旧标题")})`)).toHaveLength(1);
  });

  it("本页锚点 (#x) 查本页的标题", () => {
    expect(anchors("## 本页一节\n[上](#本页一节)")).toEqual([]);
    expect(anchors("## 本页一节\n[上](#别的一节)")).toHaveLength(1);
  });

  it("代码块里的标题不生成锚点，代码里的链接不算链接；引用式链接照样检查", () => {
    expect(anchors("[x](b.md#代码块里的不是标题)")).toHaveLength(1);
    expect(anchors("```\n[x](b.md#旧标题)\n```\n\n`[y](b.md#旧标题)`")).toEqual([]);
    expect(anchors("见 [b][r]。\n\n[r]: b.md#旧标题")).toHaveLength(1);
  });

  it("指向非页面文件、外链的锚点不归这条管", () => {
    expect(anchors("[r](../raw/a.md#L3) [w](https://example.org/a#b)")).toEqual([]);
  });

  it("行号是文件里的行号，算上 frontmatter", () => {
    const text = [
      "---",
      "id: a",
      "title: A",
      "type: concept",
      "summary: s",
      'chapters: ["11"]',
      "sources:",
      "  - https://docs.vllm.ai/projects/ascend/en/latest/index.html",
      'evidence: "S"',
      "updated: 2026-09-07",
      "---",
      "",
      "## 一节",
      "见 [b](b.md#旧标题)。",
      "",
    ].join("\n");
    const page = parsePage("concepts/a.md", text).page;
    if (!page) throw new Error("frontmatter 应当合法");
    const bad = lintPages([page, target], opts).filter((p) => p.rule === "broken-anchor");
    expect(bad).toHaveLength(1);
    expect(bad[0]?.message).toContain("第 14 行");
  });
});
