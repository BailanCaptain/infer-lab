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
