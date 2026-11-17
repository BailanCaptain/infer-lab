import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { expect, it } from "vitest";
import { WIKI_REHYPE_PLUGINS, WIKI_REMARK_PLUGINS } from "../../src/content/wiki/markdown";
import { compileMarkdown } from "./compile-markdown";

it("precompiled Markdown preserves headings, evidence, tables, fences and unsafe URL/HTML handling", () => {
  const body =
    "## 同名标题\n\n## 同名标题\n\n**正文** [C1]，`vllm-ascend`。\n\n| 项 | 值 |\n|---|---|\n| 配置 | 4 |\n\n```calc\ntitle: 数量\n结果 = 2 × 2 = 4\n```\n\n```wiki-diagram\nfile: sample\n```\n\n<script>alert(1)</script>\n\n[危险](javascript:alert%281%29) [引用](one-request.md#位置)\n";
  const expected = renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: WIKI_REMARK_PLUGINS,
        rehypePlugins: WIKI_REHYPE_PLUGINS,
      },
      body,
    ),
  );
  const compiled = compileMarkdown(body);
  const render = () =>
    renderToStaticMarkup(
      createElement(
        ReactMarkdown,
        {
          rehypePlugins: [() => () => structuredClone(compiled) as never],
        },
        "",
      ),
    );
  expect(render()).toBe(expected);
  expect(render()).toBe(expected);
  expect(expected).not.toContain('href="javascript:');
  expect(expected).not.toContain("<script>");
});

it("compileMarkdown preserves legacyAnchors injection identically to live rehype plugins", () => {
  const body = "## 改名后的标题\n\n内容。\n\n## 对照源码\n\n### 新锚点\n";
  const legacyAnchors = { "old-heading": "改名后的标题", "old-sub": "新锚点" };
  const compiled = compileMarkdown(body, legacyAnchors);
  const html = renderToStaticMarkup(
    createElement(ReactMarkdown, { rehypePlugins: [() => () => structuredClone(compiled) as never] }, ""),
  );
  expect(html).toContain('<span id="old-heading" class="wiki-legacy-anchor" aria-hidden="true"></span>');
  expect(html).toContain('<span id="old-sub" class="wiki-legacy-anchor" aria-hidden="true"></span>');
});

it("locks top-level katex stylesheet package to the exact katex instance resolved by rehype-katex", () => {
  const topRequire = createRequire(join(process.cwd(), "package.json"));
  const rendererRequire = createRequire(topRequire.resolve("rehype-katex"));
  const topKatexPkg = topRequire("katex/package.json") as { version: string };
  const rendererKatexPkg = rendererRequire("katex/package.json") as { version: string };

  expect(topKatexPkg.version).toBe(rendererKatexPkg.version);
  expect(realpathSync(topRequire.resolve("katex"))).toBe(realpathSync(rendererRequire.resolve("katex")));

  const css = readFileSync(topRequire.resolve("katex/dist/katex.min.css"), "utf8");
  const md = [
    "暴露通信耗时记为 $T_{\\text{comm,exposed}}$，单步耗时满足：",
    "",
    "$$",
    "T_{\\text{step}} \\ge \\max\\!\\left(T_{\\text{compute}}\\!\\left(\\left\\{\\frac{W_p}{P_{\\text{peak},p}}\\right\\}\\right),\\; \\frac{Q_{\\text{dram}}}{BW_{\\text{dram}}}\\right) + T_{\\text{comm,exposed}}",
    "$$",
    "",
  ].join("\n");

  const compiled = compileMarkdown(md);
  const compiledHtml = renderToStaticMarkup(
    createElement(ReactMarkdown, { rehypePlugins: [() => () => structuredClone(compiled) as never] }, ""),
  );

  for (const cls of [
    "base",
    "sizing",
    "reset-size6",
    "size3",
    "mfrac",
    "frac-line",
    "vlist-t",
    "vlist-r",
    "vlist",
    "msupsub",
    "pstrut",
    "nulldelimiter",
  ]) {
    expect(compiledHtml, `DOM 应包含 .${cls}`).toMatch(new RegExp(`\\bclass="[^"]*\\b${cls}\\b`));
    expect(css, `katex.min.css 应定义 .${cls}`).toMatch(new RegExp(`\\.${cls}(?=[\\s.,:{>+~\\[]|$)`));
  }
});
