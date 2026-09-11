import type { Backlink, Relation, RelationKind } from "./schema";

/**
 * 把一页的出边与派生入边整理成读者看的「接着看」分组。
 *
 * 「接着看」不再由 agent 手写——它写过一次（正文里）、`related` 里又有一份，
 * 两份还对不上。现在只有一份真相：`relations` 的 `note`。这里只做分组与排序。
 *
 * 分组顺序是有意的，对应读一个知识点的自然次序：
 * 先补前置（不懂它就读不下去）→ 再看谁用到它（知道学了有什么用）→
 * 最后看同层的变体与互斥（建立边界感）。
 */

export interface RelationGroup {
  /** 分组标题，写给读者看，不是 kind 的机器名 */
  title: string;
  /** 一句话说清这一组是什么，第一次看到的人需要 */
  hint: string;
  items: { id: string; note: string }[];
}

/** 出边（写在本页 frontmatter 里的）与入边（由 wiki:build 派生）合起来的展示顺序 */
const ORDER: { kind: string; title: string; hint: string }[] = [
  { kind: "builds-on", title: "先读这些", hint: "本页建立在它们之上，不懂它们会读不下去" },
  { kind: "variant-of", title: "它属于", hint: "本页是下面这件事的一种具体做法" },
  { kind: "enables", title: "谁用到它", hint: "这些特性建立在本页之上" },
  { kind: "has-variant", title: "它的几种做法", hint: "同一件事的不同实现" },
  { kind: "conflicts-with", title: "与它互斥", hint: "不能和本页同时开" },
  { kind: "alternative-to", title: "另一种解法", hint: "解决同一个问题的别的路子" },
];

export function groupRelations(relations: Relation[], backlinks: Backlink[]): RelationGroup[] {
  const byKind = new Map<string, { id: string; note: string }[]>();
  const push = (kind: string, id: string, note: string) => {
    const list = byKind.get(kind) ?? [];
    // 对称边两头都会出现，去重后只留一条
    if (!list.some((x) => x.id === id)) list.push({ id, note });
    byKind.set(kind, list);
  };
  for (const r of relations) push(r.kind, r.to, r.note);
  for (const b of backlinks) push(b.kind, b.from, b.note);

  const out: RelationGroup[] = [];
  for (const g of ORDER) {
    const items = byKind.get(g.kind);
    if (!items?.length) continue;
    out.push({ title: g.title, hint: g.hint, items: [...items].sort((a, b) => a.id.localeCompare(b.id)) });
  }
  return out;
}

/**
 * 问答用的子图：本页 + 各类邻居。
 *
 * 回答「什么是 X」时读一页是不够的——2026-09-11 实测就是读一页就停了。
 * 这里按关系类型给出该走哪几页，让回答能按「它依赖什么 → 它是什么 →
 * 谁用它」组织，而不是复述一页。
 */
export interface Neighborhood {
  /** 地基，回答时先交代 */
  foundations: { id: string; note: string }[];
  /** 下游，回答时说清学了有什么用 */
  dependents: { id: string; note: string }[];
  /** 同层的变体、互斥、替代，用来划边界 */
  siblings: { id: string; note: string }[];
}

const FOUNDATION_KINDS = new Set(["builds-on", "variant-of"]);
const DEPENDENT_KINDS = new Set(["enables", "has-variant"]);

export function neighborhood(relations: Relation[], backlinks: Backlink[]): Neighborhood {
  const out: Neighborhood = { foundations: [], dependents: [], siblings: [] };
  const put = (kind: string, id: string, note: string) => {
    const bucket = FOUNDATION_KINDS.has(kind)
      ? out.foundations
      : DEPENDENT_KINDS.has(kind)
        ? out.dependents
        : out.siblings;
    if (!bucket.some((x) => x.id === id)) bucket.push({ id, note });
  };
  for (const r of relations) put(r.kind, r.to, r.note);
  for (const b of backlinks) put(b.kind, b.from, b.note);
  return out;
}

export const RELATION_TITLES: Record<RelationKind, string> = {
  "builds-on": "建立在",
  "variant-of": "属于",
  "conflicts-with": "互斥于",
  "alternative-to": "替代",
};
