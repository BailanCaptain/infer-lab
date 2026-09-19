import { buildRegistry, renderIndex } from "./build";
import { parsePage, type WikiPage } from "./pages";
import { createReview, type Review } from "./review";
import { REGISTRY, wikiContents } from "./review-files";

/** Deterministic proposal assembly; actual publication still uses the shared review validator. */
export async function proposePages(
  root: string,
  before: Map<string, string>,
  updates: Map<string, string>,
  decision: Review["payload"]["decision"],
  repoRoots: Record<string, string> = {},
) {
  const after = new Map(before);
  for (const [path, text] of updates) {
    if (!/^wiki\/(concepts|params|sources)\/[a-z0-9][a-z0-9-]*\.md$/.test(path))
      throw new Error("仅能提出正式页面变更");
    after.set(path, text);
  }
  const pages: WikiPage[] = [];
  for (const [path, text] of after)
    if (/^wiki\/(concepts|params|sources)\/.+\.md$/.test(path)) {
      const parsed = parsePage(path.slice(5), text);
      if (!parsed.page || parsed.problems.length) throw new Error(`待审页面解析失败：${path}`);
      pages.push(parsed.page);
    }
  after.set("wiki/index.md", renderIndex(pages));
  after.set(REGISTRY, `${JSON.stringify(buildRegistry(pages), null, 2)}\n`);
  return createReview(root, before, after, decision, repoRoots);
}
export { wikiContents };
