/** Build and live readers share one content snapshot, including its revision. */
import buildSnapshot from "virtual:wiki-reader-snapshot";
import { createReaderStore } from "./reader-store";
import { buildIndex, type Hit, type Index, type RetrieveOptions, retrieve as retrieveIn } from "./retrieve";
import type { RegistryEntry, RepoRef } from "./schema";

const reader = createReaderStore(buildSnapshot);
export const getReaderState = reader.getState;
export const subscribeReader = reader.subscribe;
export const installReaderSnapshot = reader.install;
export const refreshReaderSnapshot = reader.refresh;
export const getPage = reader.getPage;
export type { WikiPage } from "./reader-store";

/** 仓库名 → GitHub 仓库路径。未列出的仓库不猜 URL。 */
const REPO_GITHUB: Record<string, string> = {
  "vllm-ascend": "vllm-project/vllm-ascend",
  vllm: "vllm-project/vllm",
  rfork: "yangsonglin13/vllm-ascend",
};

export function listPages(): RegistryEntry[] {
  return [...reader.getState().pages];
}

/** id / title / aliases 三者任一命中即可，忽略大小写与首尾空白。 */
export function findByAlias(text: string): RegistryEntry | undefined {
  const key = text.trim().toLowerCase();
  if (!key) return undefined;
  for (const p of reader.getState().pages) {
    if (p.id.toLowerCase() === key) return p;
    if (p.title.toLowerCase() === key) return p;
    if (p.aliases.some((a) => a.toLowerCase() === key)) return p;
  }
  return undefined;
}

export function pageHref(id: string): string {
  return `#/wiki/${id}`;
}

/** `repo@commit:path#L起-L止` → GitHub blob 链接；未知仓库返回 null。 */
export function sourceUrl(ref: RepoRef): string | null {
  const slug = REPO_GITHUB[ref.repo];
  if (!slug) return null;
  const base = `https://github.com/${slug}/blob/${ref.commit}/${ref.path}`;
  if (ref.lineStart === undefined) return base;
  return ref.lineEnd === undefined
    ? `${base}#L${ref.lineStart}`
    : `${base}#L${ref.lineStart}-L${ref.lineEnd}`;
}

/**
 * 正文里的相对 markdown 链接改写成 hash 路由，`#锚点` 跟着带过去（锚点规则见 anchors.ts）。
 * 站点是 hash 路由，页内的裸 `#锚点` 会被当成路径；传了当前页 id 就挂到当前页上。
 * 外链、站内路由与绝对路径原样返回。
 */
export function rewriteRelativeLink(href: string, currentId?: string): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#/") || href.startsWith("/")) return href;
  if (href.startsWith("#")) return currentId ? `${pageHref(currentId)}${href}` : href;
  const cut = href.indexOf("#");
  const path = cut < 0 ? href : href.slice(0, cut);
  const fragment = cut < 0 ? "" : href.slice(cut);
  if (!path.endsWith(".md")) return href;
  const file = path.slice(path.lastIndexOf("/") + 1, -".md".length);
  return `${pageHref(file)}${fragment}`;
}

// ---------- 检索（AC10 的单一入口）----------

let searchIndex: Index | null = null;
reader.subscribe(() => {
  searchIndex = null;
});

function ensureIndex(): Index {
  if (searchIndex) return searchIndex;
  searchIndex = buildIndex(
    reader.getState().pages.map((p) => ({
      id: p.id,
      title: p.title,
      aliases: p.aliases,
      summary: p.summary,
      chapters: p.chapters,
      evidence: p.evidence,
      relations: p.relations,
      text: getPage(p.id)?.body ?? "",
    })),
  );
  return searchIndex;
}

/**
 * 聊天层唯一允许的检索入口。**不要在调用方自己 grep**——换实现（比如给
 * issue 语料接语义检索）时才不必重写聊天层。见 F001 AC10 与风险 R1。
 */
export function retrieve(query: string, opts?: RetrieveOptions): Hit[] {
  return retrieveIn(query, ensureIndex(), opts);
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
