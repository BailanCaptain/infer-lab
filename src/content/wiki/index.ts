/**
 * wiki 页面读取器：registry.json 提供 frontmatter，import.meta.glob 提供正文原文。
 *
 * 正文来自仓库根的 `wiki/`（不在 src/ 下），用绝对 glob 路径读取；registry 由
 * `pnpm wiki:build` 派生，两者的一致性由本文件的测试保证。
 */
import registryJson from "./registry.json";
import { buildIndex, type Hit, type Index, type RetrieveOptions, retrieve as retrieveIn } from "./retrieve";
import { type RegistryEntry, type RepoRef, registrySchema } from "./schema";

const registry = registrySchema.parse(registryJson);

/** 仓库名 → GitHub 仓库路径。未列出的仓库不猜 URL。 */
const REPO_GITHUB: Record<string, string> = {
  "vllm-ascend": "vllm-project/vllm-ascend",
  vllm: "vllm-project/vllm",
};

const RAW_MODULES = import.meta.glob("/wiki/{concepts,sources}/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** 文件路径 → id（文件名去掉 .md）。HANDBOOK 规定文件名与 id 一致。 */
const bodyById = new Map<string, string>();
for (const [path, text] of Object.entries(RAW_MODULES)) {
  const id = path.slice(path.lastIndexOf("/") + 1, -".md".length);
  bodyById.set(id, stripFrontmatter(text));
}

/** 去掉开头的 YAML frontmatter，只留正文。前端不需要再解析一遍 YAML。 */
function stripFrontmatter(text: string): string {
  if (!text.startsWith("---")) return text.trim();
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text.trim();
  const after = text.indexOf("\n", end + 1);
  return after < 0 ? "" : text.slice(after + 1).trim();
}

export interface WikiPage {
  fm: RegistryEntry;
  body: string;
}

const byId = new Map(registry.pages.map((p) => [p.id, p]));

export function listPages(): RegistryEntry[] {
  return [...registry.pages].sort((a, b) => a.title.localeCompare(b.title, "en"));
}

export function getPage(id: string): WikiPage | undefined {
  const fm = byId.get(id);
  const body = bodyById.get(id);
  if (!fm || body === undefined) return undefined;
  return { fm, body };
}

/** id / title / aliases 三者任一命中即可，忽略大小写与首尾空白。 */
export function findByAlias(text: string): RegistryEntry | undefined {
  const key = text.trim().toLowerCase();
  if (!key) return undefined;
  for (const p of registry.pages) {
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

/** 正文里的相对 markdown 链接改写成 hash 路由；外链与锚点原样返回。 */
export function rewriteRelativeLink(href: string): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#") || href.startsWith("/")) return href;
  if (!href.endsWith(".md")) return href;
  const file = href.slice(href.lastIndexOf("/") + 1, -".md".length);
  return pageHref(file);
}

// ---------- 检索（AC10 的单一入口）----------

let searchIndex: Index | null = null;

function ensureIndex(): Index {
  if (searchIndex) return searchIndex;
  searchIndex = buildIndex(
    registry.pages.map((p) => ({
      id: p.id,
      title: p.title,
      aliases: p.aliases,
      summary: p.summary,
      chapters: p.chapters,
      evidence: p.evidence,
      text: bodyById.get(p.id) ?? "",
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

export type { Hit } from "./retrieve";
export { citationCheck } from "./retrieve";
