import { buildAdjacency, type RelationNode } from "../../src/content/wiki/relations";
import { type Index, retrieve } from "../../src/content/wiki/retrieve";

/**
 * 模型输入里「库里还有哪些页」的目录，一律按相关性挑、条数有上限。
 *
 * 2026-09-23 之前，编译、补料、整合、交叉审视、覆盖诊断每次调用都带全库目录（或截掉一段的全库索引），
 * 问答则把整份 index.md 放进系统提示：104 页时补料目录已占 2.4 万字符，库到约 175 页就撑满
 * 4 万字符的结构化输入上限，批量导入后必然超限。改成按需挑之后，目录长度不随库变大而增长。
 *
 * 挑选顺序：焦点页本身 → 焦点的一跳关系邻居（含反向边）与检索命中（含一跳扩展）交替放入 →
 * 与焦点同章的页。邻居与命中交替，是为了枢纽页（邻居三十多个）不把检索命中挤掉。
 * 目录只用于定位与建链；omitted 要如实告诉模型，没列出的页不等于不存在。
 */
export const CATALOG_MAX = 30;

/** 检索只看查询开头这么多字：挑选本身的耗时也不随材料变长 */
const QUERY_MAX_CHARS = 2000;

export interface CatalogFocus {
  /** 已在库里、必须列出的页 */
  ids?: string[];
  /** 不在库里的焦点（例如待整合的草稿）：只贡献关系与章节，本身不列出 */
  nodes?: (RelationNode & { chapters: string[] })[];
  /** 检索用的文字，例如问题、草稿标题与摘要、编译材料的开头 */
  query?: string;
}

export function relevantPageIds(
  index: Index,
  focus: CatalogFocus,
  max = CATALOG_MAX,
): { ids: string[]; omitted: number } {
  const known = (id: string) => index.byId.has(id);
  const focusIds = [...new Set(focus.ids ?? [])].filter(known);
  const nodes = focus.nodes ?? [];
  const adjacency = nodes.length ? buildAdjacency([...index.pages, ...nodes]) : index.adjacency;
  const neighbours = [
    ...new Set([...focusIds, ...nodes.map((n) => n.id)].flatMap((id) => adjacency.get(id) ?? [])),
  ].sort();
  const query = focus.query?.slice(0, QUERY_MAX_CHARS).trim();
  const hits = query ? retrieve(query, index, { limit: max, expand: true }).map((h) => h.id) : [];
  const chapters = new Set([
    ...focusIds.flatMap((id) => index.byId.get(id)!.chapters),
    ...nodes.flatMap((n) => n.chapters),
  ]);
  const sameChapter = index.pages
    .filter((p) => p.chapters.some((c) => chapters.has(c)))
    .map((p) => p.id)
    .sort();
  const alternating = Array.from({ length: Math.max(neighbours.length, hits.length) }, (_, i) => [
    neighbours[i],
    hits[i],
  ]).flat();
  const picked = new Set(focusIds);
  for (const id of [...alternating, ...sameChapter]) {
    if (picked.size >= max) break;
    if (id !== undefined && known(id)) picked.add(id);
  }
  return { ids: [...picked], omitted: index.pages.length - picked.size };
}
