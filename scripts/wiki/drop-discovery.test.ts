import { expect, it } from "vitest";
import { DropDiscovery } from "./drop-discovery";
import { parsePage } from "./pages";

const page = (id: string, body: string, extra = "") =>
  parsePage(
    `sources/${id}.md`,
    `---\nid: ${id}\ntitle: ${id}\ntype: source\nsummary: 索引测试\nsources: [https://example.com]\nevidence: I\nupdated: '2026-10-06'\n${extra}---\n${body}`,
  ).page!;

it("finds body-only evidence and exposes all result and catalog pages with snapshot-bound cursors", () => {
  const pages = Array.from({ length: 45 }, (_, i) => page(`page-${i}`, "needlecondition only in body"));
  const d = new DropDiscovery(pages);
  const found: string[] = [];
  let result = d.search("needlecondition");
  while (true) {
    found.push(...result.items.map((p) => p.id));
    if (!result.next) break;
    result = d.search("needlecondition", result.next);
  }
  expect(new Set(found).size).toBe(45);
  expect(() => d.search("different", d.search("needlecondition").next!)).toThrow("游标");
  const all: string[] = [];
  let catalog = d.catalog();
  while (true) {
    all.push(...catalog.items.map((p) => p.id));
    if (!catalog.next) break;
    catalog = d.catalog(catalog.next);
  }
  expect(all).toHaveLength(45);
});

it("includes inverse links and every shared diagram user as individual check tasks", () => {
  const pages = [
    page("a", "```wiki-diagram\nfile: shared\n```"),
    page("b", "[A](a.md)"),
    page("c", "```wiki-diagram\nfile: shared\n```"),
    page("d", "```wiki-diagram\nfile: shared\n```"),
  ];
  const tasks = new DropDiscovery(pages).impact(["a"]);
  expect(tasks.some((t) => t.pages.includes("a") && t.pages.includes("b"))).toBe(true);
  expect(
    tasks
      .filter((t) => t.asset === "shared")
      .flatMap((t) => t.pages)
      .sort(),
  ).toEqual(["a", "c", "d"]);
});
