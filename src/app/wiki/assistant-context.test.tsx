import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { describe, expect, it } from "vitest";
import { WIKI_REHYPE_PLUGINS, WIKI_REMARK_PLUGINS } from "../../content/wiki/markdown";
import { useOptionalWikiAssistant, useWikiAssistant, WikiAssistantProvider } from "./assistant-context";
import { WikiToolBlock } from "./WikiToolBlock";

function Probe() {
  const ctx = useWikiAssistant();
  return createElement("div", {
    "data-panel": ctx.panel,
    "data-has-open-chat": String(typeof ctx.openChat === "function"),
    "data-has-open-evidence": String(typeof ctx.openEvidence === "function"),
    "data-has-register": String(typeof ctx.registerWikiHost === "function"),
  });
}

function OptionalProbe() {
  const ctx = useOptionalWikiAssistant();
  return createElement("div", { "data-present": String(Boolean(ctx)) });
}

describe("WikiAssistantProvider & WikiToolBlock", () => {
  it("exposes assistant actions inside provider and returns null for useOptionalWikiAssistant outside", () => {
    const outside = renderToStaticMarkup(createElement(OptionalProbe));
    expect(outside).toContain('data-present="false"');
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow("WikiAssistantProvider");

    const inside = renderToStaticMarkup(
      <WikiAssistantProvider active={false}>
        <Probe />
      </WikiAssistantProvider>,
    );
    expect(inside).toContain('data-panel="closed"');
    expect(inside).toContain('data-has-open-chat="true"');
    expect(inside).toContain('data-has-open-evidence="true"');
    expect(inside).toContain('data-has-register="true"');
  });

  it("renders WikiToolBlock placeholder and invalid error state cleanly including ReactMarkdown round-trip", () => {
    const okHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: config-doctor\nmode: minimal\ntitle: 最小起服务体检\nsummary: 核对单机配置",
      }),
    );
    expect(okHtml).toContain('data-testid="wiki-tool-config-doctor"');
    expect(okHtml).toContain("最小起服务体检");
    expect(okHtml).toContain("mode: minimal");
    expect(okHtml).toContain("核对单机配置");

    const badHtml = renderToStaticMarkup(createElement(WikiToolBlock, { source: "tool: nonexistent" }));
    expect(badHtml).toContain('data-testid="wiki-tool-invalid"');
    expect(badHtml).toContain("wiki-tool 语法错误");

    const roundTrip = renderToStaticMarkup(
      createElement(
        ReactMarkdown,
        {
          remarkPlugins: WIKI_REMARK_PLUGINS,
          rehypePlugins: WIKI_REHYPE_PLUGINS,
          components: {
            pre: ({ node, children }) => {
              const code = (
                node as {
                  children?: Array<{
                    tagName?: string;
                    properties?: { className?: string[] };
                    children?: Array<{ value?: string }>;
                  }>;
                }
              )?.children?.[0];
              if (code?.tagName === "code" && code.properties?.className?.includes("language-wiki-tool")) {
                return createElement(WikiToolBlock, { source: code.children?.[0]?.value ?? "" });
              }
              return createElement("pre", null, children);
            },
          },
        },
        "```wiki-tool\ntool: aicore-lab\nmode: single\n```",
      ),
    );
    expect(roundTrip).toContain('data-testid="wiki-tool-aicore-lab"');
  });
});
