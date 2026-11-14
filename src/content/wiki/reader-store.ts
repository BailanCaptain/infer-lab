import {
  type CompiledNode,
  type RegistryEntry,
  readerManifestSchema,
  readerPageSchema,
  readerSnapshotSchema,
  type SkippedPage,
} from "./schema";

export interface WikiPage {
  fm: RegistryEntry;
  body: string;
  compiled?: CompiledNode | undefined;
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
export function createReaderStore(initial: unknown, loadPage?: (id: string) => Promise<unknown>) {
  const prepare = (input: unknown, mode: "build" | "local", lazy = false) => {
    const snapshot = lazy
      ? { ...readerManifestSchema.parse(input), pageTexts: [], diagrams: [] }
      : readerSnapshotSchema.parse(input);
    const texts = new Map(snapshot.pageTexts.map((p) => [p.file, p]));
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
      byId: new Map(
        pages
          .filter((p) => texts.has(p.file))
          .map((p) => [
            p.id,
            { fm: p, body: stripFrontmatter(texts.get(p.file)!.text), compiled: texts.get(p.file)!.compiled },
          ]),
      ),
    };
  };
  let current = prepare(initial, "build", !!loadPage);
  warnSkipped(current.skipped);
  let generation = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const pending = new Map<string, Promise<void>>();
  const install = (input: unknown) => {
    const next = prepare(input, "local");
    generation++;
    if (next.state.revision === current.state.revision) {
      // A successful live check changes the status, not the article's identity.
      if (current.state.mode !== "local") {
        current.state = { ...current.state, mode: "local" };
        notify();
      }
      return;
    }
    current = next;
    warnSkipped(next.skipped);
    notify();
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
    ensurePage(id: string): Promise<void> {
      if (current.byId.has(id) || !loadPage) return Promise.resolve();
      const fm = current.state.pages.find((p) => p.id === id);
      if (!fm) return Promise.resolve();
      const revision = current.state.revision;
      const key = `${revision}/${id}`;
      const existing = pending.get(key);
      if (existing) return existing;
      const task = loadPage(id)
        .then((input) => {
          if (current.state.revision !== revision) return;
          const page = readerPageSchema.parse(input);
          if (page.revision !== revision || page.file !== fm.file)
            throw new Error("正文版本与目录不一致，请刷新知识库。");
          current.byId.set(id, { fm, body: stripFrontmatter(page.text), compiled: page.compiled });
          current.state = {
            ...current.state,
            diagrams: new Map([
              ...current.state.diagrams,
              ...page.diagrams.map((d) => [d.id, d.svg] as const),
            ]),
          };
          notify();
        })
        .finally(() => pending.delete(key));
      pending.set(key, task);
      return task;
    },
    async refresh(load: () => Promise<unknown>, signal?: AbortSignal): Promise<boolean> {
      if (signal?.aborted) return false;
      const request = ++generation;
      const active = () => request === generation && !signal?.aborted;
      try {
        const snapshot = await load();
        if (!active()) return false;
        if (snapshot === null) {
          if (current.state.mode !== "local") {
            current.state = { ...current.state, mode: "local" };
            notify();
          }
        } else install(snapshot);
        return true;
      } catch (error) {
        if (!active()) return false;
        throw error;
      }
    },
  };
}
