import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegistry, renderIndex, runBuild } from "./build";
import type { WikiPage } from "./pages";
import { wikiFixture } from "./test-fixture";

const page = (id: string, type: WikiPage["fm"]["type"], chapters: string[]): WikiPage => ({
  file: `${type === "source" ? "sources" : "concepts"}/${id}.md`,
  body: "",
  fm: {
    origin: "seed",
    id,
    title: id.toUpperCase(),
    type,
    summary: `${id} 摘要`,
    aliases: [],
    order: 500,
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
  it("schema 失败时保留上一份 index 与 registry，不发布残缺派生物", () => {
    const f = wikiFixture();
    try {
      f.write("wiki/concepts/broken.md", "---\nid: broken\n---\n");
      f.write("wiki/index.md", "previous index");
      f.write("src/content/wiki/registry.json", "previous registry");
      expect(runBuild(f.root).problems).toBeGreaterThan(0);
      expect(readFileSync(join(f.root, "wiki/index.md"), "utf8")).toBe("previous index");
      expect(readFileSync(join(f.root, "src/content/wiki/registry.json"), "utf8")).toBe("previous registry");
    } finally {
      f.cleanup();
    }
  });
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
