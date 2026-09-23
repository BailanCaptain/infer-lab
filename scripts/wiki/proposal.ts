import { parsePage } from "./pages";
import { createReview, type Review } from "./review";
import { wikiContents } from "./review-files";

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
  // 注册表与目录发布时重建，不进待审包
  for (const [path, text] of updates) {
    const parsed = parsePage(path.slice(5), text);
    if (!parsed.page || parsed.problems.length) throw new Error(`待审页面解析失败：${path}`);
  }
  return createReview(root, before, after, decision, repoRoots);
}
export { wikiContents };
