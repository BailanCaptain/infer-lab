import { Check, Copy } from "lucide-react";
import { memo, type ReactNode, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Link } from "react-router";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";
import { rewriteRelativeLink, routePathOf } from "../../content/wiki/index";
import { type HastNode, rehypeCodeBreaks, textOf } from "../../content/wiki/markdown";

function CodeBlock({
  children,
  source,
  language,
}: {
  children: ReactNode;
  source: string;
  language: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyLabel =
    copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败，请重试" : "复制代码";
  return (
    <figure className="wiki-chat-code-block" data-testid="chat-code-block">
      <figcaption>
        <span>{language || "代码 / 日志"}</span>
        <button
          type="button"
          aria-label={copyLabel}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(source);
              setCopyState("copied");
            } catch {
              setCopyState("failed");
            }
          }}
        >
          {copyState === "copied" ? <Check size={14} /> : <Copy size={14} />}
          <span role="status">{copyLabel}</span>
        </button>
      </figcaption>
      <pre>{children}</pre>
    </figure>
  );
}

const components: Components = {
  a: ({ href, children }) => {
    const to = rewriteRelativeLink(href ?? "");
    const route = routePathOf(to);
    return route ? <Link to={route}>{children}</Link> : <a href={to}>{children}</a>;
  },
  pre: ({ children, node }) => {
    const code = node?.children.find((child) => child.type === "element" && child.tagName === "code");
    const classes = code?.type === "element" ? code.properties.className : undefined;
    const language = Array.isArray(classes)
      ? String(classes.find((name) => String(name).startsWith("language-")) ?? "").replace(/^language-/, "")
      : "";
    return (
      <CodeBlock source={textOf(node as HastNode)} language={language}>
        {children}
      </CodeBlock>
    );
  },
};
const remarkPlugins = [remarkGfm, remarkCjkFriendly];
const rehypePlugins = [rehypeCodeBreaks];

export const ChatMarkdown = memo(function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="wiki-chat-prose">
      <ReactMarkdown
        skipHtml
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
