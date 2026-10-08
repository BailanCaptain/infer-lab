import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPages, parsePage } from "./pages";

const good = `---
id: kv-cache
title: KV Cache
type: concept
summary: 一句话
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:a.py#L1-L2
evidence: "C"
updated: 2026-09-07
---
## 是什么
正文
`;

describe("parsePage", () => {
  it("解析 frontmatter，未加引号的日期规范化成字符串", () => {
    const r = parsePage("concepts/kv-cache.md", good);
    expect(r.problems).toEqual([]);
    expect(r.page?.fm.updated).toBe("2026-09-07");
    expect(r.page?.body.trim()).toBe("## 是什么\n正文");
  });
  it("文件名与 id 不一致 / schema 错误 → problems 指名文件与规则", () => {
    expect(parsePage("concepts/other.md", good).problems[0]).toMatchObject({
      file: "concepts/other.md",
      rule: "id-file",
    });
    const r = parsePage(
      "concepts/kv-cache.md",
      good.replace("sources:\n  - vllm-ascend@28bf3a2e:a.py#L1-L2", "sources: []"),
    );
    expect(r.page).toBeUndefined();
    expect(r.problems[0]).toMatchObject({ rule: "schema" });
    expect(r.problems[0]?.message).toContain("sources");
  });
  it("没有 frontmatter → schema 错误", () => {
    expect(parsePage("concepts/x.md", "# 裸文件").problems[0]?.rule).toBe("schema");
  });
});

describe("loadPages", () => {
  it("只读 concepts/ 与 sources/，跳过 _drafts/ 与 raw/", () => {
    const root = mkdtempSync(join(tmpdir(), "wiki-"));
    for (const d of ["concepts", "sources", "_drafts", "raw"]) mkdirSync(join(root, d));
    writeFileSync(join(root, "concepts/kv-cache.md"), good);
    writeFileSync(
      join(root, "sources/doc.md"),
      good.replace("id: kv-cache", "id: doc").replace("type: concept", "type: source"),
    );
    writeFileSync(join(root, "_drafts/kv-cache.md"), good);
    writeFileSync(join(root, "raw/kv-cache.md"), "# raw");
    const { pages, problems } = loadPages(root);
    expect(problems).toEqual([]);
    expect(pages.map((p) => p.file).sort()).toEqual(["concepts/kv-cache.md", "sources/doc.md"]);
  });
});
