import { describe, expect, it } from "vitest";
import { buildIndex, type PageIndex } from "../../src/content/wiki/retrieve";
import { CATALOG_MAX, relevantPageIds } from "./navigation";

const page = (id: string, extra: Partial<PageIndex> = {}): PageIndex => ({
  id,
  title: id,
  aliases: [],
  summary: `${id} 的一句话`,
  chapters: [],
  evidence: "C",
  text: "",
  ...extra,
});
const uses = (to: string) => ({ to, kind: "builds-on" as const, note: "用到" });

describe("relevantPageIds", () => {
  it("keeps the catalog the same size however large the wiki grows", () => {
    for (const total of [60, 600]) {
      const pages = Array.from({ length: total }, (_, i) =>
        page(`p${String(i).padStart(3, "0")}`, { chapters: ["11"], text: "块表 block table" }),
      );
      const picked = relevantPageIds(buildIndex(pages), { ids: ["p007"], query: "block table 块表" });
      expect(picked.ids).toHaveLength(CATALOG_MAX);
      expect(picked.ids[0]).toBe("p007");
      expect(picked.omitted).toBe(total - CATALOG_MAX);
    }
  });

  it("lists focus pages, then relation neighbours and query hits in turn, then same-chapter pages", () => {
    const pages = [
      page("focus", { chapters: ["11"], relations: [uses("linked-a")] }),
      page("linked-a"),
      page("linked-b", { relations: [uses("focus")] }),
      page("hit-page", { title: "Block Table" }),
      page("same-chapter", { chapters: ["11"] }),
      page("unrelated", { chapters: ["03"] }),
    ];
    const picked = relevantPageIds(buildIndex(pages), { ids: ["focus"], query: "Block Table" }, 10);
    expect(picked.ids).toEqual(["focus", "linked-a", "hit-page", "linked-b", "same-chapter"]);
    expect(picked.omitted).toBe(1);
  });

  it("uses a draft's relations and chapters without listing the draft itself", () => {
    const pages = [page("a"), page("b", { chapters: ["12"] }), page("c")];
    const draft = { id: "new-draft", chapters: ["12"], relations: [uses("a")] };
    const picked = relevantPageIds(buildIndex(pages), { nodes: [draft] });
    expect(picked.ids).toEqual(["a", "b"]);
    expect(picked.omitted).toBe(1);
  });

  it("drops unknown focus ids and searches only the head of a long query", () => {
    const index = buildIndex([page("x"), page("hit", { title: "Block Table" })]);
    expect(relevantPageIds(index, { ids: ["missing"], query: "Block Table" }).ids).toEqual(["hit"]);
    const buried = `${"无关".repeat(1500)} block table`;
    expect(relevantPageIds(index, { query: buried }).ids).toEqual([]);
  });
});
