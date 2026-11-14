import { describe, expect, it } from "vitest";
import { parsePage } from "./pages";
import { revisePage, revisionSchema, verifyRevision } from "./revisions";

const source = "r@1234567:config.py#L1";
const page = (body: string) =>
  `---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [${source}]\nevidence: I\nupdated: '2026-09-15'\n---\n## 一句话\n${body}\n`;
const before = page("X 默认开启。");
const after = page("X 已被移除。");
const decision = revisionSchema.parse({
  id: "a",
  kind: "supersede",
  reason: "版本变更",
  claims: [{ old: "X 默认开启。", replacement: "X 已被移除。", sources: [source] }],
});

describe("explicit page revision history", () => {
  it("publishes only the current explanation and rejects legacy tails even on unchanged proposals", () => {
    expect(revisePage("sources/a.md", before, after, decision, "2026-11-03")).toBe(after);
    const legacy = `${after}\n## 已废弃的说法\n\n### 2026-09-15 · 修订 aaaaaaaaaaaaaaaa\n旧结论。\n`;
    expect(() => verifyRevision("sources/a.md", legacy, legacy, undefined, "")).toThrow(/历史/);
  });
  it("does not add historical sources to the parser cache of the supplied new page", () => {
    const oldSource = "r@7654321:old.py#L1";
    const older = before.replace(source, oldSource);
    const result = revisePage("sources/a.md", older, after, decision, "2026-09-15");
    expect(parsePage("sources/a.md", result).page!.fm.sources).toEqual([source]);
    expect(parsePage("sources/a.md", after).page!.fm.sources).toEqual([source]);
  });
  it("revalidates sealed history before approval, including proposals made before this policy", () => {
    expect(() => verifyRevision("sources/a.md", before, after, undefined, "")).toThrow(/修订分类/);
    const result = revisePage("sources/a.md", before, after, decision, "2026-09-15");
    expect(() => verifyRevision("sources/a.md", before, result, decision, "2026-09-15")).not.toThrow();
    expect(() =>
      verifyRevision(
        "sources/a.md",
        before,
        `${result}\n## 已废弃的说法\n伪造旧文。`,
        decision,
        "2026-09-15",
      ),
    ).toThrow(/历史/);
  });
  it("requires a disposition for a changed existing body", () => {
    expect(() => revisePage("sources/a.md", before, after, undefined, "2026-09-15")).toThrow(/修订分类/);
  });
  it("keeps the replacement and current evidence without repeating the recorded old claim", () => {
    const result = revisePage("sources/a.md", before, after, decision, "2026-09-15");
    expect(result).not.toContain("## 已废弃的说法");
    expect(result).not.toContain("X 默认开启。");
    expect(result).toContain("X 已被移除。");
    expect(result).toContain("2026-09-15");
    expect(result).toContain(source);
  });
  it("does not label a pure supplement as obsolete, and catches deletion disguised as a supplement", () => {
    const addition = revisionSchema.parse({ id: "a", kind: "supplement", reason: "补充边界" });
    expect(
      revisePage("sources/a.md", before, `${before}\n仅适用于旧版。\n`, addition, "2026-09-15"),
    ).not.toContain("已废弃的说法");
    expect(() => revisePage("sources/a.md", before, after, addition, "2026-09-15")).toThrow(/补充.*删改/);
  });
  it.each(["old", "replacement", "sources"])("rejects a fabricated %s in a supersession", (field) => {
    const value = JSON.parse(JSON.stringify(decision));
    value.claims[0][field] = field === "sources" ? ["https://example.test/fake"] : "不存在的说法";
    expect(() =>
      revisePage("sources/a.md", before, after, revisionSchema.parse(value), "2026-09-15"),
    ).toThrow();
  });
  it("accepts a legacy baseline but requires a clean candidate and refuses forged history", () => {
    const first = `${after}\n## 已废弃的说法\nX 默认开启。\n`;
    const editorial = revisionSchema.parse({
      id: "a",
      kind: "editorial",
      reason: "说明版本范围，不改变结论",
    });
    const second = revisePage(
      "sources/a.md",
      first,
      page("X 已被移除。此处指新版。"),
      editorial,
      "2026-09-16",
    );
    expect(second).not.toContain("X 默认开启。");
    expect(second).not.toContain("## 已废弃的说法");
    expect(() =>
      revisePage("sources/a.md", first, first.replace("X 默认开启。", "伪造旧文"), editorial, "2026-09-16"),
    ).toThrow(/历史/);
  });
});
