import { describe, expect, it } from "vitest";
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
  it("revalidates sealed history before approval, including proposals made before this policy", () => {
    expect(() => verifyRevision("sources/a.md", before, after, undefined, "")).toThrow(/修订分类/);
    const result = revisePage("sources/a.md", before, after, decision, "2026-09-15");
    expect(() => verifyRevision("sources/a.md", before, result, decision, "2026-09-15")).not.toThrow();
    expect(() =>
      verifyRevision(
        "sources/a.md",
        before,
        result.replace("历史记录，已废弃", "仍有效"),
        decision,
        "2026-09-15",
      ),
    ).toThrow(/历史/);
  });
  it("requires a disposition for a changed existing body", () => {
    expect(() => revisePage("sources/a.md", before, after, undefined, "2026-09-15")).toThrow(/修订分类/);
  });
  it("keeps the exact old claim, date, replacement and evidence in an engine-owned section", () => {
    const result = revisePage("sources/a.md", before, after, decision, "2026-09-15");
    expect(result).toContain("## 已废弃的说法");
    expect(result).toContain("X 默认开启。");
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
  it("carries earlier history through later revisions and refuses forged history", () => {
    const first = revisePage("sources/a.md", before, after, decision, "2026-09-15");
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
    expect(second).toContain("X 默认开启。");
    expect(second.match(/## 已废弃的说法/g)).toHaveLength(1);
    expect(() =>
      revisePage("sources/a.md", first, first.replace("X 默认开启。", "伪造旧文"), editorial, "2026-09-16"),
    ).toThrow(/历史/);
  });
});
