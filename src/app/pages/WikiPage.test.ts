import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createReaderStore } from "../../content/wiki/reader-store";
import { MissingPage } from "./WikiPage";

/** 一页好页 a；坏页 bad 被构建侧跳过，只留下 id 与给写手看的原因 */
const snapshot = {
  revision: "a".repeat(64),
  registry: {
    version: 1,
    pages: [
      {
        id: "a",
        title: "好页",
        type: "source",
        summary: "好页",
        file: "sources/a.md",
        sources: ["https://example.com/"],
        evidence: "I",
        updated: "2026-10-02",
      },
    ],
  },
  pageTexts: [{ file: "sources/a.md", text: "---\nid: a\n---\n好页正文" }],
  skipped: [{ id: "bad", file: "concepts/bad.md", reason: "[schema] summary: Required" }],
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
});
