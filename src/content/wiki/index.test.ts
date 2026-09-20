import { describe, expect, it } from "vitest";
import { findByAlias, getPage, listPages, pageHref, rewriteRelativeLink, sourceUrl } from "./index";
import { parseRepoRef } from "./schema";

describe("读取器", () => {
  it("registry 与 wiki/ 下的 md 文件集合一致", () => {
    const pages = listPages();
    expect(pages.length).toBeGreaterThan(0);
    // 构建快照覆盖全部正式页，不依赖另一份手动维护的 glob 清单。
    for (const p of pages) {
      const full = getPage(p.id);
      expect(full, `registry 有 ${p.id} 但找不到对应 md`).toBeTruthy();
      expect(full?.body.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("getPage 返回 frontmatter 与正文，正文不含 frontmatter 分隔符", () => {
    const page = getPage("block-table");
    expect(page).toBeTruthy();
    expect(page?.fm.title).toMatch(/^Block Table/);
    expect(page?.body.startsWith("---")).toBe(false);
    expect(page?.body).toContain("## 一句话");
  });

  it("getPage 对不存在的 id 返回 undefined", () => {
    expect(getPage("no-such-page")).toBeUndefined();
  });

  it("listPages 按 title 稳定排序，重复调用结果一致", () => {
    const a = listPages().map((p) => p.id);
    const b = listPages().map((p) => p.id);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(a.slice().sort());
  });

  it("findByAlias 命中 id、title 与 aliases，忽略大小写", () => {
    expect(findByAlias("block-table")?.id).toBe("block-table");
    expect(findByAlias("Block Table")?.id).toBe("block-table");
    expect(findByAlias("BLOCK TABLE")?.id).toBe("block-table");
    expect(findByAlias("块表")?.id).toBe("block-table");
    expect(findByAlias("完全不存在的词")).toBeUndefined();
  });

  it("pageHref 生成 hash 路由", () => {
    expect(pageHref("kv-cache")).toBe("#/wiki/kv-cache");
  });

  it("sourceUrl 把 repo@commit:path#L起-L止 变成 GitHub 链接", () => {
    const ref = parseRepoRef("vllm-ascend@28bf3a2e:vllm_ascend/worker/block_table.py#L84-L98");
    expect(ref).toBeTruthy();
    expect(sourceUrl(ref!)).toBe(
      "https://github.com/vllm-project/vllm-ascend/blob/28bf3a2e/vllm_ascend/worker/block_table.py#L84-L98",
    );
  });

  it("sourceUrl 支持单行与无行号", () => {
    const one = parseRepoRef("vllm-ascend@28bf3a2e:a/b.py#L5");
    expect(sourceUrl(one!)).toBe("https://github.com/vllm-project/vllm-ascend/blob/28bf3a2e/a/b.py#L5");
    const none = parseRepoRef("vllm-ascend@28bf3a2e:a/b.py");
    expect(sourceUrl(none!)).toBe("https://github.com/vllm-project/vllm-ascend/blob/28bf3a2e/a/b.py");
  });

  it("sourceUrl 对未知 repo 返回 null，不猜 URL", () => {
    const ref = parseRepoRef("infer-lab@abc1234:src/x.ts#L1-L2");
    expect(sourceUrl(ref!)).toBeNull();
  });

  it("rewriteRelativeLink 把页面间相对链接改写成 hash 路由", () => {
    expect(rewriteRelativeLink("paged-attention.md")).toBe("#/wiki/paged-attention");
    expect(rewriteRelativeLink("../sources/some-doc.md")).toBe("#/wiki/some-doc");
    expect(rewriteRelativeLink("https://example.com/a")).toBe("https://example.com/a");
    expect(rewriteRelativeLink("#anchor")).toBe("#anchor");
  });
});
