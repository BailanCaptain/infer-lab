import { describe, expect, it } from "vitest";
import { buildRegistry, renderIndex } from "./build";
import type { WikiPage } from "./pages";

const page = (id: string, type: WikiPage["fm"]["type"], chapters: string[]): WikiPage => ({
  file: `${type === "source" ? "sources" : "concepts"}/${id}.md`,
  body: "",
  fm: {
    id,
    title: id.toUpperCase(),
    type,
    summary: `${id} 摘要`,
    aliases: [],
    prerequisites: [],
    chapters,
    sources: ["https://x"],
    evidence: "S",
    relations: [],
    related: [],
    contradicts: [],
    updated: "2026-09-07",
  },
});

describe("renderIndex", () => {
  it("按 type 分组再按章节分组，输出确定且不含时间", () => {
    const pages = [
      page("b", "concept", ["11"]),
      page("a", "feature", ["11", "12"]),
      page("doc", "source", []),
    ];
    const md = renderIndex(pages);
    expect(md).toContain("## 概念（concept）\n- [B](concepts/b.md) — b 摘要");
    expect(md).toContain("## 特性（feature）\n- [A](concepts/a.md) — a 摘要");
    expect(md).toContain("### 11 KV Cache 内存系统\n- [A](concepts/a.md)\n- [B](concepts/b.md)");
    expect(md).toContain("### 12 调度\n- [A](concepts/a.md)");
    expect(md).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(renderIndex([...pages].reverse())).toBe(md);
  });
});

describe("buildRegistry", () => {
  it("按 id 排序，每项带 file", () => {
    const r = buildRegistry([page("b", "concept", []), page("a", "concept", [])]);
    expect(r.version).toBe(1);
    expect(r.pages.map((p) => p.id)).toEqual(["a", "b"]);
    expect(r.pages[0]?.file).toBe("concepts/a.md");
  });
});
