import type { DropReceipt } from "../../src/content/wiki/drop";
import { buildIndex, retrieve } from "../../src/content/wiki/retrieve";
import { diagramRefs } from "./diagrams";
import type { WikiPage } from "./pages";
import { digest } from "./workflow";

export type DropCheckTask = Pick<DropReceipt["checks"][number], "id" | "kind" | "pages" | "asset">;

/** One frozen index per attempt. Page size limits transport, never the search space. */
export class DropDiscovery {
  readonly index;
  readonly snapshot: string;
  readonly queries: DropReceipt["queries"] = [];
  constructor(readonly pages: WikiPage[]) {
    this.snapshot = digest(JSON.stringify(pages));
    this.index = buildIndex(
      pages.map((p) => ({
        id: p.fm.id,
        title: p.fm.title,
        aliases: p.fm.aliases,
        summary: p.fm.summary,
        chapters: p.fm.chapters,
        evidence: p.fm.evidence,
        relations: p.fm.relations,
        related: p.fm.related,
        text: p.body,
      })),
    );
  }
  private page<T>(items: T[], query: string, cursor?: string) {
    const prefix = digest(`${this.snapshot}:${query}`);
    let start = 0;
    if (cursor) {
      const [hash, offset] = cursor.split(":");
      start = Number(offset);
      if (hash !== prefix || !Number.isInteger(start) || start < 0 || start > items.length)
        throw new Error("查询或快照游标不匹配");
    }
    const end = Math.min(items.length, start + 20);
    return {
      snapshot: this.snapshot,
      total: items.length,
      start,
      end,
      items: items.slice(start, end),
      next: end < items.length ? `${prefix}:${end}` : null,
    };
  }
  catalog(cursor?: string) {
    return this.page(
      this.pages.map((p) => ({
        id: p.fm.id,
        path: p.file,
        title: p.fm.title,
        aliases: p.fm.aliases,
        summary: p.fm.summary,
      })),
      "catalog",
      cursor,
    );
  }
  search(query: string, cursor?: string) {
    const all = retrieve(query, this.index, {
      limit: this.pages.length,
      expand: true,
      expansionLimit: this.pages.length,
    });
    const result = this.page(all, query, cursor);
    this.queries.push({
      query,
      ...(cursor ? { cursor } : {}),
      total: result.total,
      ids: result.items.map((h) => h.id),
    });
    return result;
  }
  impact(targets: string[], changedAssets: string[] = []) {
    const selected = new Set(targets);
    const affectedAssets = new Set([
      ...changedAssets,
      ...this.pages.filter((p) => selected.has(p.fm.id)).flatMap((p) => diagramRefs(p.body)),
    ]);
    const tasks = new Map<string, DropCheckTask>();
    const add = (task: DropCheckTask) => tasks.set(task.id, task);
    for (const p of this.pages) {
      const links = new Set([
        ...p.fm.relations.map((r) => r.to),
        ...p.fm.related,
        ...[
          ...p.body.matchAll(
            /\]\((?:\.\.?\/)*(?:(?:concepts|sources|params)\/)?([a-z0-9-]+)\.md(?:#[^)]*)?\)/g,
          ),
        ].map((m) => m[1]!),
      ]);
      for (const to of links) {
        if (to === p.fm.id || (!selected.has(p.fm.id) && !selected.has(to))) continue;
        const pair = [p.fm.id, to].sort();
        add({ id: `relation:${pair.join(":")}`, kind: "relation", pages: pair });
      }
      for (const asset of diagramRefs(p.body))
        if (affectedAssets.has(asset))
          add({ id: `asset:${asset}:${p.fm.id}`, kind: "asset", pages: [p.fm.id], asset });
    }
    return [...tasks.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
