import { type RegistryEntry, readerSnapshotSchema, type SkippedPage } from "./schema";

export interface WikiPage {
  fm: RegistryEntry;
  body: string;
}

function stripFrontmatter(text: string): string {
  if (!text.startsWith("---")) return text.trim();
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text.trim();
  const after = text.indexOf("\n", end + 1);
  return after < 0 ? "" : text.slice(after + 1).trim();
}

/** 给写手看：哪些页没进快照、为什么。读者在页面上只看到「该页暂不可用」。 */
function warnSkipped(skipped: SkippedPage[]): void {
  if (!skipped.length) return;
  const lines = skipped.map((p) => `- ${p.file}：${p.reason}`);
  console.warn(`[wiki] 跳过 ${skipped.length} 个不合法的页，其余照常显示：\n${lines.join("\n")}`);
}

/** Atomic reader state, including its identity. It survives SPA route remounts. */
export function createReaderStore(initial: unknown) {
  const prepare = (input: unknown, mode: "build" | "local") => {
    const snapshot = readerSnapshotSchema.parse(input);
    const texts = new Map(snapshot.pageTexts.map((p) => [p.file, p.text]));
    const pages = [...snapshot.registry.pages].sort((a, b) => a.title.localeCompare(b.title, "en"));
    return {
      state: {
        revision: snapshot.revision,
        mode,
        pages,
        // 图跟着同一份快照走：读者看到的画面和页面正文一定是同一个 revision
        diagrams: new Map(snapshot.diagrams.map((d) => [d.id, d.svg])),
        /** 被跳过的坏页 id：路由到这里显示「暂不可用」，而不是「还没有这一页」 */
        skipped: new Set(snapshot.skipped.map((p) => p.id)) as ReadonlySet<string>,
      },
      skipped: snapshot.skipped,
      byId: new Map(pages.map((p) => [p.id, { fm: p, body: stripFrontmatter(texts.get(p.file)!) }])),
    };
  };
  let current = prepare(initial, "build");
  warnSkipped(current.skipped);
  let generation = 0;
  const listeners = new Set<() => void>();
  const install = (input: unknown) => {
    const next = prepare(input, "local");
    generation++;
    current = next;
    warnSkipped(next.skipped);
    for (const listener of listeners) listener();
  };
  return {
    getState: () => current.state,
    getPage: (id: string): WikiPage | undefined => current.byId.get(id),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    install,
    async refresh(load: () => Promise<unknown>, signal?: AbortSignal): Promise<boolean> {
      if (signal?.aborted) return false;
      const request = ++generation;
      const active = () => request === generation && !signal?.aborted;
      try {
        const snapshot = await load();
        if (!active()) return false;
        install(snapshot);
        return true;
      } catch (error) {
        if (!active()) return false;
        throw error;
      }
    },
  };
}
