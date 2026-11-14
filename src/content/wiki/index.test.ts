import { describe, expect, it } from "vitest";
import {
  ensurePage,
  findByAlias,
  getPage,
  listPages,
  pageHref,
  rewriteRelativeLink,
  sourceUrl,
} from "./index";
import { parseRepoRef } from "./schema";

describe("读取器", () => {
  it("registry 与 wiki/ 下的 md 文件集合一致", async () => {
    const pages = listPages();
    expect(pages.length).toBeGreaterThan(0);
    // 构建快照覆盖全部正式页，不依赖另一份手动维护的 glob 清单。
    // Load independent page chunks together, as separate readers can; don't serialize Vite's module transforms.
    await Promise.all(pages.map((p) => ensurePage(p.id)));
    for (const p of pages) {
      const full = getPage(p.id);
      expect(full, `registry 有 ${p.id} 但找不到对应 md`).toBeTruthy();
      expect(full?.body.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("getPage 返回 frontmatter 与正文，正文不含 frontmatter 分隔符", async () => {
    await ensurePage("block-table");
    const page = getPage("block-table");
    expect(page).toBeTruthy();
    expect(page?.fm.title).toMatch(/^Block Table/);
    expect(page?.body.startsWith("---")).toBe(false);

    // 写作标准（docs/wiki-writing-standard.md）不再设「## 一句话」H2：正文紧接 frontmatter，
    // 以问题式 H2 开篇，先一句定义本页术语，只隔讲解段落就到直觉图；页末是「## 对照源码」。
    const body = page?.body ?? "";
    const lines = body.split(/\r?\n/);
    expect(lines.some((l) => /^## 一句话\s*$/.test(l))).toBe(false);
    expect(lines[0]).toMatch(/^## \S.*[？?]\s*$/);
    const figure = lines.findIndex((l) => /^```wiki-diagram\s*$/.test(l));
    expect(figure).toBeGreaterThan(0);
    const opening = lines.slice(1, figure).filter((l) => l.trim());
    expect(opening.length).toBeGreaterThan(0);
    // 表、calc、列表、小标题都不能插在定义与直觉图之间
    expect(opening.filter((l) => /^\s*(#|\||```|~~~|[-*+] |\d+\. )/.test(l))).toEqual([]);
    const term = page?.fm.title.split(/[：:]/)[0] ?? "";
    expect(opening[0]?.split("。")[0]?.toLowerCase()).toMatch(new RegExp(`${term.toLowerCase()}.*是`));

    // 给学习者的事实表在讲解部分：末列是「意味着什么」，不带来源列。
    // 「## 对照源码」下的五个 H3 由 tests/wiki.spec.ts 复用 wiki:audit 的 measureStandard 检查
    // （scripts/ 依赖 node 类型，不能进 src 的 tsconfig）。
    const sourceH2 = lines.indexOf("## 对照源码");
    expect(sourceH2).toBeGreaterThan(figure);
    const factHeaders = lines.slice(0, sourceH2).filter((l) => /^\|.*\|\s*意味着什么\s*\|\s*$/.test(l));
    expect(factHeaders.length).toBeGreaterThan(0);
    expect(factHeaders.every((l) => !/\|\s*来源\s*\|/.test(l))).toBe(true);
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

  it("RFork 工作版引用指向同事仓库，与社区仓库分开", () => {
    const ref = parseRepoRef("rfork@3284850:vllm_ascend/model_loader/rfork/session.py#L103-L148");
    expect(sourceUrl(ref!)).toBe(
      "https://github.com/yangsonglin13/vllm-ascend/blob/3284850/vllm_ascend/model_loader/rfork/session.py#L103-L148",
    );
  });

  it("rewriteRelativeLink 把页面间相对链接改写成 hash 路由", () => {
    expect(rewriteRelativeLink("paged-attention.md")).toBe("#/wiki/paged-attention");
    expect(rewriteRelativeLink("../sources/some-doc.md")).toBe("#/wiki/some-doc");
    expect(rewriteRelativeLink("https://example.com/a")).toBe("https://example.com/a");
    expect(rewriteRelativeLink("#anchor")).toBe("#anchor");
  });

  it("rewriteRelativeLink 保留跨页链接的 #锚点，页内锚点挂到当前页的路由上", () => {
    // one-request.md 里的真实写法；以前只认结尾是 .md 的链接，这条原样留着，点开是 404
    expect(rewriteRelativeLink("glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache")).toBe(
      "#/wiki/glm-5-3-flash-two-node#剩下的显存变成多少-kv-cache",
    );
    // react-markdown 交给 <a> 的 href 已经百分号编码过，锚点原样带过去
    expect(rewriteRelativeLink("../concepts/two-node.md#%E5%89%A9%E4%B8%8B-kv")).toBe(
      "#/wiki/two-node#%E5%89%A9%E4%B8%8B-kv",
    );
    // hash 路由下裸 #frag 会被当成路径；知道当前页时改写成「当前页 + 锚点」
    expect(rewriteRelativeLink("#对照源码", "one-request")).toBe("#/wiki/one-request#对照源码");
    // 已经是站内路由的不再动
    expect(rewriteRelativeLink("#/wiki/kv-cache", "one-request")).toBe("#/wiki/kv-cache");
  });
});
