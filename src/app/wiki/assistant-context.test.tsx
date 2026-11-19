import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { WIKI_REHYPE_PLUGINS, WIKI_REMARK_PLUGINS } from "../../content/wiki/markdown";
import { AppShell } from "../AppShell";
import { WikiPage } from "../pages/WikiPage";
import {
  createWikiAssistantController,
  useOptionalWikiAssistant,
  useWikiAssistant,
  WikiAssistantProvider,
} from "./assistant-context";
import { createChatController } from "./ChatDrawer";
import { WikiPanel } from "./WikiPanel";
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
    expect(okHtml).toContain("最小起服务");
    expect(okHtml).toContain('data-mode="minimal"');
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

  it("does not replay stale open state across WikiPanel unmount/remount and resets panel when inactive", () => {
    const storageData = new Map<string, string>();
    const chatController = createChatController({
      storage: {
        getItem: (k) => storageData.get(k) ?? null,
        setItem: (k, v) => {
          storageData.set(k, v);
        },
      },
    });
    const assistant = createWikiAssistantController({
      active: true,
      getChat: () => chatController.getState(),
    });
    const renderPanel = () =>
      renderToStaticMarkup(
        createElement(WikiPanel, {
          revision: "rev-test",
          mode: "build",
          chat: chatController.getState(),
          layout: assistant.getState().panel,
          lastTriggerRef: assistant.lastTriggerRef,
          onLayout: assistant.setPanel,
          onRefresh: async () => false,
        }),
      );

    expect(assistant.getState().panel).toBe("closed");
    expect(renderPanel()).toContain('data-testid="chat-open"');

    // Open via openEvidence, close panel, unmount (active=false), remount (active=true)
    assistant.openEvidence();
    expect(assistant.getState().panel).toBe("evidence");
    expect(renderPanel()).toContain('data-testid="chat-drawer"');
    assistant.setPanel("closed");
    expect(assistant.getState().panel).toBe("closed");
    assistant.setActive(false);
    expect(assistant.getState().panel).toBe("closed");
    assistant.setActive(true);
    expect(assistant.getState().panel).toBe("closed");
    const remountedAfterEvidence = renderPanel();
    expect(remountedAfterEvidence).toContain('data-testid="chat-open"');
    expect(remountedAfterEvidence).not.toContain('data-testid="chat-drawer"');

    // Open via openChat, leave open when active becomes false -> panel resets to closed and does not reopen
    assistant.openChat({ prompt: "草稿", submit: false });
    expect(assistant.getState().panel).toBe("chat");
    assistant.setActive(false);
    expect(assistant.getState().panel).toBe("closed");
    assistant.setActive(true);
    expect(assistant.getState().panel).toBe("closed");
    const remountedAfterChat = renderPanel();
    expect(remountedAfterChat).toContain('data-testid="chat-open"');
    expect(remountedAfterChat).not.toContain('data-testid="chat-drawer"');

    chatController.dispose();
  });

  it("preserves prompt in input when openChat({ prompt, submit: true }) is called while chat.busy is true", async () => {
    let releaseStream!: () => void;
    const streamGate = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });
    let fetchCalls = 0;
    const chatController = createChatController({
      fetchImpl: async () => {
        fetchCalls += 1;
        await streamGate;
        const body = new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('event: done\ndata: {"sessionId":"s1"}\n\n'));
            c.close();
          },
        });
        return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
      },
    });
    const assistant = createWikiAssistantController({
      active: true,
      getChat: () => chatController.getState(),
    });

    const firstTurn = chatController.send("第一问");
    expect(chatController.getState().busy).toBe(true);

    assistant.openChat({ prompt: "排队中的新问题", submit: true });
    expect(assistant.getState().panel).toBe("chat");
    expect(fetchCalls).toBe(1);
    expect(chatController.getState().input).toBe("排队中的新问题");

    releaseStream();
    await firstTurn;
    chatController.dispose();
  });

  it("renders AppShell and WikiPage cleanly during SSR renderToStaticMarkup without Missing getServerSnapshot", async () => {
    const handler = createStaticHandler([
      {
        path: "/",
        Component: AppShell,
        children: [
          { path: "home", element: createElement("div", { "data-testid": "ssr-home" }) },
          { path: "wiki/:id", Component: WikiPage },
        ],
      },
    ]);

    const homeContext = await handler.query(new Request("http://localhost/home"));
    if (homeContext instanceof Response) throw new Error("unexpected redirect on /home");
    const homeRouter = createStaticRouter(handler.dataRoutes, homeContext);
    const homeHtml = renderToStaticMarkup(
      createElement(StaticRouterProvider, { router: homeRouter, context: homeContext }),
    );
    expect(homeHtml).toContain('data-testid="ssr-home"');
    expect(homeHtml).not.toContain("reader-quick-search-slot");
    expect(homeHtml).not.toContain('data-testid="chat-open"');

    const wikiContext = await handler.query(new Request("http://localhost/wiki/block-table"));
    if (wikiContext instanceof Response) throw new Error("unexpected redirect on /wiki/block-table");
    const wikiRouter = createStaticRouter(handler.dataRoutes, wikiContext);
    const wikiHtml = renderToStaticMarkup(
      createElement(StaticRouterProvider, { router: wikiRouter, context: wikiContext }),
    );
    expect(wikiHtml).toContain("reader-quick-search-slot");
    expect(wikiHtml).toContain('data-testid="chat-open"');
  });
});
