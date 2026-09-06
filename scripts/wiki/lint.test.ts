import { describe, expect, it } from "vitest";
import { collectStepTerms, lintLog, lintPages } from "./lint";
import type { WikiPage } from "./pages";

const mk = (id: string, over: Partial<WikiPage["fm"]> = {}, body = ""): WikiPage => ({
  file: `concepts/${id}.md`,
  body,
  fm: {
    id,
    title: id,
    type: "concept",
    summary: "s",
    aliases: [],
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
