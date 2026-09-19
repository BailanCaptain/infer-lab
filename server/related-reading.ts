import { citedPageLinks } from "../src/content/wiki/retrieve";
import type { KnowledgeSnapshot } from "./snapshot";

/** Navigation comes from the same snapshot as the answer, not invented link labels from the model. */
export function relatedReading(answer: string, snapshot: Pick<KnowledgeSnapshot, "registry">) {
  const cited = new Set(citedPageLinks(answer).map((path) => path.split("/").at(-1)!.replace(/\.md$/, "")));
  const links = new Map<string, { id: string; title: string; href: string; note: string }>();
  for (const page of snapshot.registry.pages.filter((p) => cited.has(p.id))) {
    for (const edge of [
      ...page.relations.map((r) => ({ id: r.to, note: r.note })),
      ...page.backlinks.map((r) => ({ id: r.from, note: r.note })),
    ]) {
      const target = snapshot.registry.pages.find((p) => p.id === edge.id);
      if (target && !cited.has(target.id) && !links.has(target.id))
        links.set(target.id, {
          id: target.id,
          title: target.title,
          href: `#/wiki/${target.id}`,
          note: edge.note,
        });
    }
  }
  return [...links.values()].slice(0, 5);
}
