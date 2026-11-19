import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useInRouterContext } from "react-router";
import { CalcBlock } from "../../content/wiki/CalcBlock";
import { parseCalcFence, textFenceAsCalc } from "../../content/wiki/calc";
import { rewriteRelativeLink, routePathOf } from "../../content/wiki/index";
import { type HastNode, textOf, WIKI_REHYPE_PLUGINS, WIKI_REMARK_PLUGINS } from "../../content/wiki/markdown";

export const reviewPageId = (path: string) => path.split("/").at(-1)!.replace(/\.md$/, "");

export function ReviewMarkdownLink({
  href,
  currentId,
  children,
}: {
  href?: string | undefined;
  currentId?: string | undefined;
  children?: ReactNode;
}) {
  const inRouter = useInRouterContext();
  const to = rewriteRelativeLink(href ?? "", currentId);
  const rawMatch = /^\.\/wiki-raw\/sha256-([a-f0-9]{64})\.html\?lines=(\d+)(?:-(\d+))?(?:#L\d+)?$/.exec(to);
  if (rawMatch) {
    const apiHref = `/api/wiki/raw?ref=${encodeURIComponent(
      `raw:sha256-${rawMatch[1]}.md#L${rawMatch[2]}${rawMatch[3] ? `-L${rawMatch[3]}` : ""}`,
    )}`;
    return (
      <a href={apiHref} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  const route = routePathOf(to);
  if (route && inRouter) {
    return <Link to={route}>{children}</Link>;
  }
  const external = /^https?:/i.test(to);
  return (
    <a href={to} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      {children}
    </a>
  );
}

type Change = { path: string; before: string | null; after: string | null };

/**
 * 提取审阅前后公式预览块：同时兼容存量 ```calc 围栏与二阶段标准 KaTeX 块级 `$$...$$` / 行内 `$...$` 公式
 * （跳过普通代码围栏、行内代码与 `$10` 货币数字）。
 */
export function extractReviewFormulas(text: string | null): string {
  const raw = (text ?? "").split("\n## 已废弃的说法")[0]!;
  // Strip YAML frontmatter so frontmatter values are never scanned as math.
  const active = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const items: { index: number; content: string }[] = [];
  const fenceRanges: { start: number; end: number }[] = [];

  for (const m of active.matchAll(/^```([^\n]*)\r?\n([\s\S]*?)^```[\t ]*$/gm)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    fenceRanges.push({ start, end });
    const lang = m[1]!.trim();
    if (lang === "calc" || (["", "text"].includes(lang) && textFenceAsCalc(m[2]!.trim()))) {
      items.push({ index: start, content: m[0] });
    }
  }

  const insideFence = (pos: number) => fenceRanges.some((r) => pos >= r.start && pos < r.end);
  const blockMathRanges: { start: number; end: number }[] = [];

  // Block KaTeX: $$...$$
  for (const m of active.matchAll(/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g)) {
    const start = m.index ?? 0;
    if (insideFence(start)) continue;
    const body = m[1]!.trim();
    if (!body) continue;
    const end = start + m[0].length;
    blockMathRanges.push({ start, end });
    items.push({ index: start, content: `$$\n${body}\n$$` });
  }

  const insideBlockOrCode = (pos: number) =>
    insideFence(pos) || blockMathRanges.some((r) => pos >= r.start && pos < r.end);

  // Inline code spans so `$VAR` inside backticks is never treated as KaTeX.
  const inlineCodeRanges: { start: number; end: number }[] = [];
  for (const m of active.matchAll(/`[^`\r\n]+`/g)) {
    const start = m.index ?? 0;
    if (!insideFence(start)) inlineCodeRanges.push({ start, end: start + m[0].length });
  }
  const insideInlineCode = (pos: number) => inlineCodeRanges.some((r) => pos >= r.start && pos < r.end);

  // Inline KaTeX: $...$ (single line, non-empty, neither leading/trailing space nor plain currency `$10`).
  for (const m of active.matchAll(/(?<!\\|\$)\$(?!\$|\s)([^$\r\n]+?)(?<!\\|\s)\$(?!\$)/g)) {
    const start = m.index ?? 0;
    if (insideBlockOrCode(start) || insideInlineCode(start)) continue;
    const inner = m[1]!;
    // Skip simple currency / numeric literals without math operators or LaTeX commands.
    if (/^\d+(?:[.,]\d+)?$/.test(inner)) continue;
    items.push({ index: start, content: `- $${inner}$` });
  }

  items.sort((a, b) => a.index - b.index);
  return items.map((item) => item.content).join("\n\n");
}

function formulas(text: string | null) {
  return extractReviewFormulas(text);
}
export function DropReviewPreview({ writes, placements }: { writes: Change[]; placements: Change[] }) {
  return (
    <>
      <details open>
        <summary>目录位置前后预览</summary>
        {placements.map((p) => (
          <div key={p.path}>
            <strong>{p.path.replace(/^wiki\//, "")}</strong>
            <p>修改前：{p.before}</p>
            <p>修改后：{p.after}</p>
          </div>
        ))}
      </details>
      {writes
        .filter((w) => /\.md$/.test(w.path) && (formulas(w.before) || formulas(w.after)))
        .map((w) => (
          <section key={w.path} className="wiki-drop-assets">
            <h3>公式前后预览 · {w.path.replace(/^wiki\//, "")}</h3>
            <div>
              {[
                { label: "修改前", text: w.before },
                { label: "修改后", text: w.after },
              ].map((v) => (
                <figure key={v.label}>
                  <figcaption>{v.label}</figcaption>
                  <ReactMarkdown
                    skipHtml
                    remarkPlugins={WIKI_REMARK_PLUGINS}
                    rehypePlugins={WIKI_REHYPE_PLUGINS}
                    components={{
                      a: ({ href, children }) => (
                        <ReviewMarkdownLink href={href} currentId={reviewPageId(w.path)}>
                          {children}
                        </ReviewMarkdownLink>
                      ),
                      pre: ({ node, children }) => {
                        const code = (node as HastNode | undefined)?.children?.[0];
                        const source = code ? textOf(code).trim() : "";
                        const cls = code?.properties?.className;
                        if (Array.isArray(cls) && cls.includes("language-calc")) {
                          const calc = parseCalcFence(source);
                          return <CalcBlock {...calc} />;
                        }
                        const rows = textFenceAsCalc(source);
                        return rows ? <CalcBlock rows={rows} /> : <pre>{children}</pre>;
                      },
                    }}
                  >
                    {formulas(v.text) || "无公式"}
                  </ReactMarkdown>
                </figure>
              ))}
            </div>
          </section>
        ))}
    </>
  );
}
