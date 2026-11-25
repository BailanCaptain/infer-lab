import { type ReaderPageEvidence, readerPageEvidenceSchema } from "./evidence-schema";
import { unpackCompiledNode } from "./hast-pack";
import { deriveParamDisplayTitle, pageDisplayTitle } from "./param-display";
import { deserializeSearchIndex, type Index } from "./retrieve";
import {
  type CompiledNode,
  extractReaderGraph,
  type ReaderGraph,
  type ReaderSearchIndex,
  type RegistryEntry,
  readerGraphSchema,
  readerManifestSchema,
  readerPageSchema,
  readerSearchIndexSchema,
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
export function createReaderStore(
  initial: unknown,
  loadPage?: (id: string) => Promise<unknown>,
  loadSearchIndex?: () => Promise<unknown>,
  loadPageEvidence?: (id: string, revision: string) => Promise<unknown>,
  loadWikiGraph?: () => Promise<unknown>,
) {
  const prepare = (input: unknown, mode: "build" | "local", lazy = false) => {
    const snapshot = lazy
      ? {
          ...readerManifestSchema.parse(input),
          pageTexts: [],
          diagrams: [],
          searchIndex: undefined as ReaderSearchIndex | undefined,
        }
      : readerSnapshotSchema.parse(input);
    const texts = new Map(snapshot.pageTexts.map((p) => [p.file, p]));
    const normalizedPages = snapshot.registry.pages.map((p) => {
      if (p.displayTitle) return p;
      const raw = texts.get(p.file)?.text;
      if (!raw) return p;
      const derived = deriveParamDisplayTitle(p, raw);
      return derived !== p.title ? { ...p, displayTitle: derived } : p;
    });
    const pages = [...normalizedPages].sort((a, b) =>
      pageDisplayTitle(a).localeCompare(pageDisplayTitle(b), "en"),
    );
    const skippedSet = new Set(snapshot.skipped.map((p) => p.id));
    const canonicalIdByRouteId = new Map<string, string>();
    for (const p of pages) {
      canonicalIdByRouteId.set(p.id, p.id);
      for (const legacyId of p.legacyIds ?? []) {
        if (!skippedSet.has(legacyId)) canonicalIdByRouteId.set(legacyId, p.id);
      }
    }
    return {
      state: {
        revision: snapshot.revision,
        mode,
        pages,
        // 图跟着同一份快照走：读者看到的画面和页面正文一定是同一个 revision
        diagrams: new Map(snapshot.diagrams.map((d) => [d.id, d.svg])),
        /** 被跳过的坏页 id：路由到这里显示「暂不可用」，而不是「还没有这一页」 */
        skipped: skippedSet as ReadonlySet<string>,
      },
      skipped: snapshot.skipped,
      lazy,
      serializedIndex: snapshot.searchIndex,
      index: undefined as Index | undefined,
      graph: lazy ? (undefined as ReaderGraph | undefined) : extractReaderGraph(snapshot.revision, pages),
      canonicalIdByRouteId,
      evidenceById: new Map<string, ReaderPageEvidence>(),
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
  const pendingEvidence = new Map<string, Promise<ReaderPageEvidence>>();
  let pendingIndex: { revision: string; task: Promise<Index> } | undefined;
  let pendingGraph: { revision: string; task: Promise<ReaderGraph> } | undefined;
  const install = (input: unknown) => {
    const next = prepare(input, "local");
    generation++;
    if (next.state.revision === current.state.revision) {
      if (!current.serializedIndex && next.serializedIndex) {
        current.serializedIndex = next.serializedIndex;
      }
      if (!current.graph && next.graph) {
        current.graph = next.graph;
      }
      let diagrams = current.state.diagrams;
      let diagramsChanged = false;
      let pages = current.state.pages;
      let pagesChanged = false;
      if (
        next.state.pages.length === current.state.pages.length &&
        next.state.pages.some((p, i) => p.displayTitle !== current.state.pages[i]?.displayTitle)
      ) {
        pages = next.state.pages;
        pagesChanged = true;
      }
      if (!next.lazy && current.lazy) {
        pages = next.state.pages;
        pagesChanged = true;
        for (const [id, page] of next.byId) {
          const existing = current.byId.get(id);
          if (!existing) {
            current.byId.set(id, page);
          } else {
            current.byId.set(id, {
              fm: page.fm,
              body: existing.body || page.body,
              compiled: existing.compiled ?? page.compiled,
            });
          }
        }
        if (next.state.diagrams.size > 0) {
          const merged = new Map(current.state.diagrams);
          for (const [id, svg] of next.state.diagrams) {
            if (merged.get(id) !== svg) {
              merged.set(id, svg);
              diagramsChanged = true;
            }
          }
          if (diagramsChanged) diagrams = merged;
        }
        current.lazy = false;
      }
      // A successful live check changes the status, not the article's identity.
      if (current.state.mode !== "local" || diagramsChanged || pagesChanged) {
        current.state = { ...current.state, mode: "local", pages, diagrams };
        notify();
      }
      return;
    }
    current = next;
    warnSkipped(next.skipped);
    notify();
  };
  const ensurePage = (id: string): Promise<void> => {
    const canonicalId = current.canonicalIdByRouteId.get(id);
    if (!canonicalId || current.byId.has(canonicalId) || !loadPage) return Promise.resolve();
    const fm = current.state.pages.find((p) => p.id === canonicalId);
    if (!fm) return Promise.resolve();
    const revision = current.state.revision;
    const key = `${revision}/${canonicalId}`;
    const existing = pending.get(key);
    if (existing) return existing;
    const task = loadPage(canonicalId)
      .then((input) => {
        if (current.state.revision !== revision || current.byId.has(canonicalId)) return;
        const page = readerPageSchema.parse(input);
        const latestFm = current.state.pages.find((p) => p.id === canonicalId) ?? fm;
        if (page.revision !== revision || page.file !== latestFm.file)
          throw new Error("正文版本与目录不一致，请刷新知识库。");
        const compiled =
          page.compiled ??
          (page.packedCompiled !== undefined ? unpackCompiledNode(page.packedCompiled) : undefined);
        const rawSources = page.rawSources ?? latestFm.rawSources;
        let hydratedFm: RegistryEntry = {
          ...latestFm,
          sources: page.sources ?? latestFm.sources,
          relations: page.relations ?? latestFm.relations,
          backlinks: page.backlinks ?? latestFm.backlinks,
          ...(rawSources !== undefined ? { rawSources } : {}),
        };
        if (!hydratedFm.displayTitle && page.text) {
          const derived = deriveParamDisplayTitle(hydratedFm, page.text);
          if (derived !== hydratedFm.title) {
            hydratedFm = { ...hydratedFm, displayTitle: derived };
          }
        }
        const body = page.text ? stripFrontmatter(page.text) : "";
        current.byId.set(canonicalId, { fm: hydratedFm, body, compiled });
        const nextPages = current.state.pages.map((p) => (p.id === canonicalId ? hydratedFm : p));
        const nextDiagrams =
          page.diagrams.length > 0
            ? new Map([...current.state.diagrams, ...page.diagrams.map((d) => [d.id, d.svg] as const)])
            : current.state.diagrams;
        current.state = {
          ...current.state,
          pages: nextPages,
          diagrams: nextDiagrams,
        };
        notify();
      })
      .finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
  const ensureSearchIndex = (): Promise<Index> => {
    if (current.index) return Promise.resolve(current.index);
    if (current.serializedIndex) {
      current.index = deserializeSearchIndex(current.serializedIndex);
      return Promise.resolve(current.index);
    }
    if (!loadSearchIndex) {
      return Promise.reject(new Error("当前构建快照缺少预编译检索索引，请重新构建或连接最新问答服务。"));
    }
    const revision = current.state.revision;
    if (pendingIndex?.revision === revision) return pendingIndex.task;
    const task = loadSearchIndex()
      .then(
        (input): Promise<Index> | Index => {
          if (current.state.revision !== revision) return ensureSearchIndex();
          const parsed = readerSearchIndexSchema.parse(input);
          if (parsed.revision !== revision) {
            throw new Error("检索索引版本与目录不一致，请刷新知识库。");
          }
          const built = deserializeSearchIndex(parsed);
          current.serializedIndex = parsed;
          current.index = built;
          return built;
        },
        (error) => {
          if (current.state.revision !== revision) return ensureSearchIndex();
          throw error;
        },
      )
      .finally(() => {
        if (pendingIndex?.task === task) pendingIndex = undefined;
      });
    pendingIndex = { revision, task };
    return task;
  };
  const ensurePageEvidence = (id: string): Promise<ReaderPageEvidence> => {
    const canonicalId = current.canonicalIdByRouteId.get(id);
    if (!canonicalId) return Promise.reject(new Error("未找到对应知识库页面。"));
    const cached = current.evidenceById.get(canonicalId);
    if (cached) return Promise.resolve(cached);
    if (!loadPageEvidence) return Promise.reject(new Error("当前环境未配置证据读取入口。"));
    const revision = current.state.revision;
    const key = `${revision}/${canonicalId}`;
    const existing = pendingEvidence.get(key);
    if (existing) return existing;
    const task = loadPageEvidence(canonicalId, revision)
      .then(
        (input): Promise<ReaderPageEvidence> | ReaderPageEvidence => {
          if (current.state.revision !== revision) return ensurePageEvidence(canonicalId);
          const parsed = readerPageEvidenceSchema.parse(input);
          if (parsed.revision !== revision || parsed.pageId !== canonicalId) {
            throw new Error("证据版本与当前页面不一致，请刷新知识库。");
          }
          current.evidenceById.set(canonicalId, parsed);
          notify();
          return parsed;
        },
        (error) => {
          if (current.state.revision !== revision) return ensurePageEvidence(canonicalId);
          throw error;
        },
      )
      .finally(() => pendingEvidence.delete(key));
    pendingEvidence.set(key, task);
    return task;
  };
  const ensureWikiGraph = (): Promise<ReaderGraph> => {
    if (current.graph) return Promise.resolve(current.graph);
    if (!loadWikiGraph) {
      return Promise.reject(new Error("当前构建快照缺少知识图谱数据，请重新构建或连接最新问答服务。"));
    }
    const revision = current.state.revision;
    if (pendingGraph?.revision === revision) return pendingGraph.task;
    const task = loadWikiGraph()
      .then(
        (input): Promise<ReaderGraph> | ReaderGraph => {
          if (current.state.revision !== revision) return ensureWikiGraph();
          const parsed = readerGraphSchema.parse(input);
          if (parsed.revision !== revision) {
            throw new Error("知识图谱版本与目录不一致，请刷新知识库。");
          }
          current.graph = parsed;
          notify();
          return parsed;
        },
        (error) => {
          if (current.state.revision !== revision) return ensureWikiGraph();
          throw error;
        },
      )
      .finally(() => {
        if (pendingGraph?.task === task) pendingGraph = undefined;
      });
    pendingGraph = { revision, task };
    return task;
  };
  return {
    getState: () => current.state,
    getWikiGraph: (): ReaderGraph | undefined => current.graph,
    resolvePageId: (id: string): string | undefined => current.canonicalIdByRouteId.get(id),
    getPage: (id: string): WikiPage | undefined => {
      const canonicalId = current.canonicalIdByRouteId.get(id);
      return canonicalId ? current.byId.get(canonicalId) : undefined;
    },
    getPageEvidence: (id: string): ReaderPageEvidence | undefined => {
      const canonicalId = current.canonicalIdByRouteId.get(id);
      return canonicalId ? current.evidenceById.get(canonicalId) : undefined;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    install,
    ensurePage,
    ensureSearchIndex,
    ensurePageEvidence,
    ensureWikiGraph,
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
