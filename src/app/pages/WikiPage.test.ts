import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createEvidenceViewController } from "../../content/wiki/evidence-schema";
import { ensurePage, getPage, getReaderState, retrieve } from "../../content/wiki/index";
import { pageDisplayTitle } from "../../content/wiki/param-display";
import { createReaderStore } from "../../content/wiki/reader-store";
import { buildIndex, serializeSearchIndex } from "../../content/wiki/retrieve";
import { buildToc } from "../../content/wiki/toc";
import { buildContextualStarters, ChatPane, createChatController } from "../wiki/ChatDrawer";
import { EvidencePane } from "../wiki/EvidencePane";
import {
  createQuickSearchController,
  OPEN_QUICK_SEARCH_EVENT,
  QuickSearchDialog,
  requestOpenQuickSearch,
} from "../wiki/QuickSearch";
import { isPlainPrimaryLinkClick, WikiContentLink } from "../wiki/WikiLink";
import { WikiPanel } from "../wiki/WikiPanel";
import {
  Article,
  canonicalWikiRedirectTarget,
  computeTocScrollTopAfterActivate,
  MissingPage,
  PrerequisiteBar,
  resolveDirectoryDrawerState,
} from "./WikiPage";

/** 一页好页 a；坏页 bad 被构建侧跳过，只留下 id 与给写手看的原因 */
const goodPage = {
  id: "a",
  title: "好页",
  type: "source" as const,
  summary: "好页",
  file: "sources/a.md",
  sources: ["https://example.com/"],
  evidence: "I" as const,
  updated: "2026-10-02",
};
const snapshot = {
  revision: "a".repeat(64),
  registry: {
    version: 1 as const,
    pages: [goodPage],
  },
  pageTexts: [{ file: "sources/a.md", text: "---\nid: a\n---\n好页正文" }],
  skipped: [{ id: "bad", file: "concepts/bad.md", reason: "[schema] summary: Required" }],
  searchIndex: serializeSearchIndex(
    buildIndex([{ ...goodPage, aliases: [], chapters: [], relations: [], related: [], text: "好页正文" }]),
    "a".repeat(64),
  ),
};

describe("a route whose page is not in the reader snapshot", () => {
  const store = (() => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      return createReaderStore(snapshot);
    } finally {
      warn.mockRestore();
    }
  })();
  const render = (id: string) =>
    renderToStaticMarkup(createElement(MissingPage, { id, skipped: store.getState().skipped }));

  it("a skipped page shows a short unavailable card with its id, never the validation details", () => {
    const html = render("bad");
    expect(html).toContain('data-testid="wiki-unavailable"');
    expect(html).toContain("<strong>bad</strong>");
    expect(html).toContain("该页暂不可用");
    expect(html).not.toContain("schema");
    expect(html).not.toContain("concepts/bad.md");
  });

  it("a page that never existed keeps the not-found card", () => {
    const html = render("nope");
    expect(html).toContain('data-testid="wiki-notfound"');
    expect(html).not.toContain("该页暂不可用");
  });

  it("canonicalWikiRedirectTarget 仅对命中的旧路由 ID 生成保留 query 与中文/编码锚点的 replace 目标", () => {
    expect(
      canonicalWikiRedirectTarget("former-quantization", "quantization", {
        search: "?via=legacy&term=FP8%20%E9%87%8F%E5%8C%96",
        hash: "#%E6%80%8E%E4%B9%88%E5%BC%80",
      }),
    ).toEqual({
      pathname: "/wiki/quantization",
      search: "?via=legacy&term=FP8%20%E9%87%8F%E5%8C%96",
      hash: "#%E6%80%8E%E4%B9%88%E5%BC%80",
    });
    expect(
      canonicalWikiRedirectTarget("quantization", "quantization", {
        search: "?a=1",
        hash: "#怎么开",
      }),
    ).toBeNull();
    expect(canonicalWikiRedirectTarget("unknown-id", undefined, { search: "", hash: "#x" })).toBeNull();
    expect(canonicalWikiRedirectTarget(undefined, undefined, { search: "", hash: "" })).toBeNull();
  });

  it("isPlainPrimaryLinkClick 仅放行未阻止的普通主键激活，排除 Ctrl/Meta/Shift/Alt 与中右键", () => {
    const base = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    };
    expect(isPlainPrimaryLinkClick(base)).toBe(true);
    expect(isPlainPrimaryLinkClick({ ...base, defaultPrevented: true })).toBe(false);
    expect(isPlainPrimaryLinkClick({ ...base, button: 1 })).toBe(false);
    expect(isPlainPrimaryLinkClick({ ...base, button: 2 })).toBe(false);
    expect(isPlainPrimaryLinkClick({ ...base, ctrlKey: true })).toBe(false);
    expect(isPlainPrimaryLinkClick({ ...base, metaKey: true })).toBe(false);
    expect(isPlainPrimaryLinkClick({ ...base, shiftKey: true })).toBe(false);
    expect(isPlainPrimaryLinkClick({ ...base, altKey: true })).toBe(false);
  });

  it("resolveDirectoryDrawerState 在跨过桌面断点时清零窄窗临时展开态，同侧重绘保持原状", () => {
    // 1440px 桌面初始态
    let state = { desktop: true, directoryOpen: false };
    expect(resolveDirectoryDrawerState(state, true)).toBe(state);

    // 1440 -> 1000 首次缩窄：默认收起
    state = resolveDirectoryDrawerState(state, false);
    expect(state).toEqual({ desktop: false, directoryOpen: false });

    // 1000 窄窗下手动展开目录，且窄窗内重绘保持展开
    state = { ...state, directoryOpen: true };
    expect(resolveDirectoryDrawerState(state, false)).toBe(state);

    // 1000 -> 1440 跨回桌面：窄窗临时展开态清零（桌面自身由 desktop=true 保持常驻）
    state = resolveDirectoryDrawerState(state, true);
    expect(state).toEqual({ desktop: true, directoryOpen: false });

    // 1440 -> 1000 再次缩窄：不会残留上次窄窗展开态
    state = resolveDirectoryDrawerState(state, false);
    expect(state).toEqual({ desktop: false, directoryOpen: false });
  });

  it("轻目录在未加载任何单页前剥离重字段，且可直接完成目录编排与 QuickSearch 检索", async () => {
    const initialPages = getReaderState().pages;
    const unloaded = initialPages.find((p) => p.id === "block-table")!;
    expect(getPage("block-table")).toBeUndefined();
    expect(unloaded.sources).toEqual([]);
    expect(unloaded.rawSources).toBeUndefined();
    expect(unloaded.relations).toEqual([]);
    expect(unloaded.backlinks).toEqual([]);

    const toc = buildToc(initialPages);
    expect(toc.length).toBeGreaterThan(0);
    const tocPageIds = toc.flatMap((part) => part.sections.flatMap((sec) => sec.pages.map((p) => p.id)));
    expect(tocPageIds).toContain("block-table");
    const sizeInManifest = initialPages.find((p) => p.id === "size-40a1c2ca47b8")!;
    expect(pageDisplayTitle(sizeInManifest)).toBe("KVPPConfig.size");

    const controller = createQuickSearchController({
      search: (q, opts) => retrieve(q, opts),
      getPages: () => getReaderState().pages,
      onNavigate: () => {},
    });
    controller.openSearch();
    await controller.setQuery("Block Table");
    expect(controller.getState().status).toBe("ready");
    expect(controller.getState().items.length).toBeGreaterThan(0);
    expect(controller.getState().items[0]?.typeLabel).toBeTruthy();
    expect(getPage("block-table")).toBeUndefined();
  }, 20_000);

  it("PrerequisiteBar 按需加载单页后从 hydrated page.relations 派生 builds-on 前置导航并保留关系 note，无前置关系时不占位", async () => {
    await ensurePage("quantization");
    const quant = getPage("quantization")!.fm;
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(PrerequisiteBar, { page: quant })),
    );
    expect(html).toContain('data-testid="wiki-prereq-bar"');
    expect(html).toContain('aria-label="前置概念"');
    expect(html).toContain("先读基础");
    expect(html).toContain('href="/wiki/matmul-and-weights"');
    expect(html).toContain("矩阵乘讲清 Y=XW 与权重的存法");
    expect(html.indexOf("/wiki/matmul-and-weights")).toBeLessThan(
      html.indexOf("/wiki/low-precision-formats"),
    );

    await ensurePage("learning-guide");
    const guide = getPage("learning-guide")!.fm;
    const emptyHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(PrerequisiteBar, { page: { ...guide, relations: [] } }),
      ),
    );
    expect(emptyHtml).toBe("");
  });

  it("PrerequisiteBar、Article 直出编译视图与 WikiContentLink 均展示受保护参数身份派生的展示名而不修改路由 ID", async () => {
    await ensurePage("size-40a1c2ca47b8");
    const sizeLoaded = getPage("size-40a1c2ca47b8")!;
    const prereqHtml = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(PrerequisiteBar, { page: sizeLoaded.fm })),
    );
    expect(prereqHtml).toContain('href="/wiki/kvpp-config-0445bd352140"');
    expect(prereqHtml).toContain("AscendConfig.kvpp_config");

    const prodArticleHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(Article, {
          page: sizeLoaded.fm,
          body: "",
          compiled: sizeLoaded.compiled,
          diagrams: getReaderState().diagrams,
        }),
      ),
    );
    expect(prodArticleHtml).toContain("KVPPConfig.size");
    expect(prodArticleHtml).toContain('data-testid="wiki-sources"');
    expect(sizeLoaded.fm.sources.length).toBeGreaterThan(0);

    const linkHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiContentLink, { href: "../params/size-40a1c2ca47b8.md", currentId: "kvpp" }, "size"),
      ),
    );
    expect(linkHtml).toContain('href="/wiki/size-40a1c2ca47b8"');
    expect(linkHtml).toContain('title="KVPPConfig.size"');
  });

  it("computeTocScrollTopAfterActivate 在条目已处于可视区时保持零位移，仅对上方/下方越界条目平移目录 scrollTop", () => {
    // 已在可视区内（哪怕靠近顶/底边缘）：严格保持原 scrollTop，点击目录绝不跳回顶部或抖动
    expect(
      computeTocScrollTopAfterActivate({
        scrollTop: 520,
        navTop: 80,
        navBottom: 880,
        itemTop: 84,
        itemBottom: 120,
      }),
    ).toBe(520);
    expect(
      computeTocScrollTopAfterActivate({
        scrollTop: 520,
        navTop: 80,
        navBottom: 880,
        itemTop: 840,
        itemBottom: 878,
      }),
    ).toBe(520);

    // 外部跳到目录下方远处条目：向下平移至底边距 padding=24
    expect(
      computeTocScrollTopAfterActivate({
        scrollTop: 0,
        navTop: 80,
        navBottom: 880,
        itemTop: 1200,
        itemBottom: 1236,
      }),
    ).toBe(380);

    // 外部跳到目录上方未显示条目：向上拉回且不小于 0
    expect(
      computeTocScrollTopAfterActivate({
        scrollTop: 400,
        navTop: 80,
        navBottom: 880,
        itemTop: 20,
        itemBottom: 56,
      }),
    ).toBe(316);
    expect(
      computeTocScrollTopAfterActivate({
        scrollTop: 10,
        navTop: 80,
        navBottom: 880,
        itemTop: 20,
        itemBottom: 56,
      }),
    ).toBe(0);
  });

  it("QuickSearch 支持带初始查询词一键打开（搜全文联动），且工具/3D 徽章使用语义类而非裸 hex", async () => {
    const controller = createQuickSearchController({
      search: (q, opts) => retrieve(q, opts),
      getPages: () => getReaderState().pages,
      onNavigate: () => {},
    });
    controller.openSearch("EI0006");
    expect(controller.getState().open).toBe(true);
    expect(controller.getState().query).toBe("EI0006");
    await vi.waitFor(() => expect(controller.getState().status).toBe("ready"));
    expect(controller.getState().items.length).toBeGreaterThan(0);

    const dialogHtml = renderToStaticMarkup(
      createElement(QuickSearchDialog, {
        state: controller.getState(),
        onQueryChange: () => {},
        onSelectIndex: () => {},
        onPickItem: () => {},
        onRetry: () => {},
        onClose: () => {},
        onInputKeyDown: () => {},
      }),
    );
    expect(dialogHtml).toContain("wiki-quick-search-type is-tool");
    expect(dialogHtml).not.toContain("#ddf4ef");
    expect(dialogHtml).not.toContain("#e85b32");

    if (typeof window !== "undefined") {
      let receivedQuery = "";
      const onOpen = (ev: Event) => {
        receivedQuery = (ev as CustomEvent<{ query?: string }>).detail?.query ?? "";
      };
      window.addEventListener(OPEN_QUICK_SEARCH_EVENT, onOpen);
      try {
        requestOpenQuickSearch({ query: "RoPE" });
        expect(receivedQuery).toBe("RoPE");
      } finally {
        window.removeEventListener(OPEN_QUICK_SEARCH_EVENT, onOpen);
      }
    }
  });

  it("Article 切页过渡保留外框标记，WikiPanel 合并在线刷新按钮并次级化维护页签，ChatPane 动态追问与新对话清空闭环", async () => {
    await ensurePage("quantization");
    const quant = getPage("quantization")!;
    const transitioningHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(Article, {
          page: quant.fm,
          body: "",
          compiled: quant.compiled,
          diagrams: getReaderState().diagrams,
          isTransitioning: true,
        }),
      ),
    );
    expect(transitioningHtml).toContain('data-transitioning="true"');

    // 按当前阅读页类型动态派生 3 条追问胶囊
    const conceptStarters = buildContextualStarters(quant.fm);
    expect(conceptStarters).toHaveLength(3);
    expect(conceptStarters[0]).toContain(pageDisplayTitle(quant.fm).split(/[：:]/)[0]!);

    await ensurePage("size-40a1c2ca47b8");
    const paramEntry = getPage("size-40a1c2ca47b8")!.fm;
    const paramStarters = buildContextualStarters(paramEntry);
    expect(paramStarters).toHaveLength(3);
    expect(paramStarters[0]).toContain("KVPPConfig.size");

    // chatController.clear() 清空消息、会话与挂起附件，保留输入框未发草稿且隔离在途流
    const memory = new Map<string, string>();
    const storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memory.set(k, v);
      },
    };
    const chatCtl = createChatController({
      storage,
      getBackendAvailability: () => "online",
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              const enc = new TextEncoder();
              c.enqueue(
                enc.encode(
                  'event: model\ndata: {"answeredBy":"gpt-5.4","provider":"codex","switched":false,"switches":[]}\n\n',
                ),
              );
              c.enqueue(enc.encode('event: text\ndata: {"text":"量化通过降低权重位宽减少带宽压力。"}\n\n'));
              c.enqueue(
                enc.encode(
                  `event: quality\ndata: {"status":"checked","decision":{"satisfied":true,"classification":"grounded","reason":"材料一致"}}\n\n`,
                ),
              );
              c.enqueue(
                enc.encode(`event: done\ndata: {"sessionId":"sid-q","answerId":"${"d".repeat(64)}"}\n\n`),
              );
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
    });

    await chatCtl.send("解释量化");
    chatCtl.setInput("下一问未发草稿");

    const onlinePanelHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiPanel, {
          revision: "abcdef1234567890",
          mode: "local",
          backendAvailable: "online",
          currentId: "quantization",
          chat: chatCtl.getState(),
          layout: "chat",
          onLayout: () => {},
          onRefresh: async () => false,
        }),
      ),
    );
    expect(onlinePanelHtml).toContain('data-testid="wiki-refresh-btn"');
    expect(onlinePanelHtml).not.toContain('class="wiki-panel-status"');
    expect(onlinePanelHtml).toContain('data-tier="reader"');
    expect(onlinePanelHtml).toContain('data-tier="authoring"');

    const chatHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ChatPane, {
          id: "wiki-panel-chat",
          chat: chatCtl.getState(),
          backendAvailable: "online",
          currentId: "quantization",
          hidden: false,
          onReview: () => {},
        }),
      ),
    );
    expect(chatHtml).toContain('data-testid="chat-context-pill"');
    expect(chatHtml).toContain("当前阅读：");
    expect(chatHtml).toContain('data-testid="chat-clear"');
    expect(chatHtml).not.toContain("Codex 账户额度");
    expect(chatHtml).toContain("作答模型 gpt-5.4");
    expect(chatHtml).toContain('data-testid="chat-copy-reply"');
    expect(chatHtml).toContain("存进 Wiki");
    expect(chatHtml).toContain("wiki-chat-quality-ok");
    expect(chatHtml).toContain('data-testid="chat-followups"');

    chatCtl.clear();
    expect(chatCtl.getState().msgs).toEqual([]);
    expect(chatCtl.getState().input).toBe("下一问未发草稿");

    // EvidencePane 加载骨架态与空态微排版校验
    let releaseEvidence!: () => void;
    const evCtl = createEvidenceViewController({
      loadPageEvidence: () =>
        new Promise((resolve) => {
          releaseEvidence = () =>
            resolve({
              version: 1,
              revision: "a".repeat(64),
              pageId: "quantization",
              pageSources: [],
              diagrams: [],
              entries: {},
            });
        }),
    });
    const pendingOpen = evCtl.openForSource("quantization", "a".repeat(64), 0);
    const evLoadingHtml = renderToStaticMarkup(
      createElement(EvidencePane, { id: "wiki-panel-evidence", hidden: false, controller: evCtl }),
    );
    expect(evLoadingHtml).toContain('data-testid="evidence-loading"');
    expect(evLoadingHtml).toContain("正在读取当前页面的离线证据摘录");
    releaseEvidence();
    await pendingOpen;
  });
});
