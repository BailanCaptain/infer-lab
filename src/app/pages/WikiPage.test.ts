import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { getReaderState } from "../../content/wiki/index";
import { createReaderStore } from "../../content/wiki/reader-store";
import { buildIndex, serializeSearchIndex } from "../../content/wiki/retrieve";
import { isPlainPrimaryLinkClick, WikiContentLink } from "../wiki/WikiLink";
import {
  canonicalWikiRedirectTarget,
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

  it("PrerequisiteBar 从 page.relations 派生 builds-on 前置导航并保留关系 note，无前置关系时不占位", () => {
    const pages = getReaderState().pages;
    const quant = pages.find((p) => p.id === "quantization")!;
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

    const guide = pages.find((p) => p.id === "learning-guide")!;
    const emptyHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(PrerequisiteBar, { page: { ...guide, relations: [] } }),
      ),
    );
    expect(emptyHtml).toBe("");
  });

  it("PrerequisiteBar 与 WikiContentLink 均展示受保护参数身份派生的展示名而不修改路由 ID", () => {
    const pages = getReaderState().pages;
    const sizePage = pages.find((p) => p.id === "size-40a1c2ca47b8")!;
    const prereqHtml = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(PrerequisiteBar, { page: sizePage })),
    );
    expect(prereqHtml).toContain('href="/wiki/kvpp-config-0445bd352140"');
    expect(prereqHtml).toContain("AscendConfig.kvpp_config");

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
});
