/** Build and live readers share one content snapshot, including its revision. */
import buildSnapshot, {
  loadPage,
  loadPageEvidence,
  loadSearchIndex,
  loadWikiGraph,
} from "virtual:wiki-reader-snapshot";
import { repoSourceUrl } from "./evidence-schema";
import { findPageByName } from "./page-names";
import { createReaderStore } from "./reader-store";
import { type Hit, type RetrieveOptions, retrieve as retrieveIn } from "./retrieve";
import { inlineRawSourceHref, type RegistryEntry, type RepoRef, rawSourceHref } from "./schema";

const reader = createReaderStore(buildSnapshot, loadPage, loadSearchIndex, loadPageEvidence, loadWikiGraph);
export const ensurePage = reader.ensurePage;
export const ensurePageEvidence = reader.ensurePageEvidence;
export const ensureWikiGraph = reader.ensureWikiGraph;
export const getPageEvidence = reader.getPageEvidence;
export const getWikiGraph = reader.getWikiGraph;
export const getReaderState = reader.getState;
export const resolvePageId = reader.resolvePageId;
export const subscribeReader = reader.subscribe;
export const installReaderSnapshot = reader.install;
export const refreshReaderSnapshot = reader.refresh;
export const getPage = reader.getPage;
export type {
  DiagramEvidenceGroup,
  DiagramPinEvidence,
  EvidenceEntry,
  EvidenceLine,
  EvidenceTarget,
  EvidenceViewState,
  ReaderPageEvidence,
} from "./evidence-schema";
export { createEvidenceViewController, resolveActiveEvidence } from "./evidence-schema";
export type { WikiPage } from "./reader-store";
export type { ReaderGraph, WikiGraphEdge } from "./schema";
export { resolveCanonicalPageId } from "./schema";

export function listPages(): RegistryEntry[] {
  return [...reader.getState().pages];
}

/** id / title / aliases 三者任一命中即可，忽略大小写与首尾空白。 */
export function findByAlias(text: string): RegistryEntry | undefined {
  return findPageByName(reader.getState().pages, text);
}

export function pageHref(id: string): string {
  return `#/wiki/${id}`;
}

/** `repo@commit:path#L起-L止` → GitHub blob 链接；未知仓库返回 null。 */
export function sourceUrl(ref: RepoRef): string | null {
  return repoSourceUrl(ref);
}

/**
 * 正文里的相对 markdown 链接改写成 hash 路由，`#锚点` 跟着带过去（锚点规则见 anchors.ts）。
 * 站点是 hash 路由，页内的裸 `#锚点` 会被当成路径；传了当前页 id 就挂到当前页上。
 * 外链、站内路由与绝对路径原样返回。
 */
export function rewriteRelativeLink(href: string, currentId?: string): string {
  if (href.startsWith("raw:")) return inlineRawSourceHref(href) ?? "";
  if (/^[a-z]+:/i.test(href) || href.startsWith("#/") || href.startsWith("/")) return href;
  if (href.startsWith("#")) return currentId ? `${pageHref(currentId)}${href}` : href;
  const cut = href.indexOf("#");
  const path = cut < 0 ? href : href.slice(0, cut);
  const fragment = cut < 0 ? "" : href.slice(cut);
  const rawMatch = /(?:^|\/)raw\/(sha256-[a-f0-9]{64}\.md)$/.exec(path);
  if (rawMatch) {
    const mapped = rawSourceHref(`raw:${rawMatch[1]}${fragment || "#L1"}`);
    if (mapped) return mapped;
  }
  if (!path.endsWith(".md")) return href;
  const file = path.slice(path.lastIndexOf("/") + 1, -".md".length);
  return `${pageHref(file)}${fragment}`;
}

// ---------- 检索（AC10 的单一入口）----------

/**
 * 聊天层与前端快捷搜索唯一允许的检索入口。**不要在调用方自己 grep**——
 * 静态构建下按需懒载紧凑预编译索引（不下载全库页面 Markdown 与图），
 * 本地刷新后自动对齐同一快照 revision 的检索索引。见 F001 AC10 与风险 R1。
 */
export async function retrieve(query: string, opts?: RetrieveOptions): Promise<Hit[]> {
  const index = await reader.ensureSearchIndex();
  return retrieveIn(query, index, opts);
}

/**
 * `#/wiki/x#frag` → `/wiki/x#frag`：react-router `<Link to>` 要的是路由路径，不带 hash 路由的 `#`。
 * 不是站内路由（外链、纯页内锚点）就返回 null，调用方照常渲染原生 <a>。
 */
export function routePathOf(href: string): string | null {
  return href.startsWith("#/") ? href.slice(1) : null;
}

export type { Hit } from "./retrieve";
export { citationCheck } from "./retrieve";
