import ReactMarkdown from "react-markdown";
import { CalcBlock } from "../../content/wiki/CalcBlock";
import { parseCalcFence, textFenceAsCalc } from "../../content/wiki/calc";
import { type HastNode, textOf, WIKI_REHYPE_PLUGINS, WIKI_REMARK_PLUGINS } from "../../content/wiki/markdown";

type Change = { path: string; before: string | null; after: string | null };
function formulas(text: string | null) {
  const active = (text ?? "").split("\n## 已废弃的说法")[0]!;
  return [...active.matchAll(/^```([^\n]*)\r?\n([\s\S]*?)^```[\t ]*$/gm)]
    .filter(
      (m) =>
        m[1]!.trim() === "calc" || (["", "text"].includes(m[1]!.trim()) && textFenceAsCalc(m[2]!.trim())),
    )
    .map((m) => m[0])
    .join("\n\n");
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
