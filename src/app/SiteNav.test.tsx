import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { SiteNav } from "./SiteNav";

function renderNavAt(entry: string): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [entry] }, createElement(SiteNav)),
  );
}

describe("SiteNav 全站导航与工程实验室入口", () => {
  it("包含五大入口（含工程实验室：算账、体检与在线排障）", () => {
    const html = renderNavAt("/wiki");
    expect(html).toContain('aria-label="全站导航"');
    expect(html).toContain("首页");
    expect(html).toContain("主章节");
    expect(html).toContain("工程实验室");
    expect(html).toContain("算账、体检与在线排障");
    expect(html).toContain("模型探索");
    expect(html).toContain("硬件探索");
  });

  it("在 /tools 路由下精准高亮「工程实验室」，不再误高亮「主章节」", () => {
    const toolsHtml = renderNavAt("/tools?tab=doctor");
    expect(toolsHtml).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/tools"/);
    expect(toolsHtml).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/wiki"/);

    const wikiHtml = renderNavAt("/wiki/kv-cache");
    expect(wikiHtml).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/wiki"/);
    expect(wikiHtml).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/tools"/);

    const legacyChaptersHtml = renderNavAt("/chapters");
    expect(legacyChaptersHtml).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/wiki"/);

    const homeHtml = renderNavAt("/archive/home");
    expect(homeHtml).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/home"/);
  });
});
