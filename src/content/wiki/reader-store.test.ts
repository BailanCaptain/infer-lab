import { describe, expect, it, vi } from "vitest";
import { packCompiledNode } from "./hast-pack";
import { createReaderStore } from "./reader-store";
import { buildIndex, retrieve, serializeSearchIndex } from "./retrieve";
import type { CompiledNode } from "./schema";

function snapshot(version: string) {
  const revision = version.repeat(64);
  const page = {
    id: "a",
    title: version,
    type: "source" as const,
    summary: version,
    file: "sources/a.md",
    sources: ["https://example.com/"],
    evidence: "I" as const,
    updated: "2026-09-15",
  };
  return {
    revision,
    registry: {
      version: 1 as const,
      pages: [page],
    },
    pageTexts: [{ file: "sources/a.md", text: `---\nid: a\n---\n${version}` }],
    searchIndex: serializeSearchIndex(
      buildIndex([{ ...page, aliases: [], chapters: [], relations: [], related: [], text: version }]),
      revision,
    ),
  };
}

describe("reader snapshot state", () => {
  it("a not-modified response preserves loaded pages while marking the build as current", async () => {
    const store = createReaderStore(snapshot("a"));
    const article = store.getPage("a");
    await store.refresh(async () => null);
    expect(store.getState().mode).toBe("local");
    expect(store.getPage("a")).toBe(article);
    expect(() => store.install(null)).toThrow();
  });
  it("unchanged refreshes preserve article and diagram identity", async () => {
    const store = createReaderStore(snapshot("a"));
    const article = store.getPage("a");
    const diagrams = store.getState().diagrams;
    await store.refresh(async () => snapshot("a"));
    expect(store.getPage("a")).toBe(article);
    expect(store.getState().diagrams).toBe(diagrams);
  });

  it("loads only the requested page once and refuses an old in-flight page after publication", async () => {
    const full = snapshot("a");
    let resolve!: (value: unknown) => void;
    const load = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const store = createReaderStore({ revision: full.revision, registry: full.registry }, load);
    expect(store.getPage("a")).toBeUndefined();
    const first = store.ensurePage("a");
    const second = store.ensurePage("a");
    expect(load).toHaveBeenCalledTimes(1);
    store.install(snapshot("b"));
    resolve({ revision: full.revision, ...full.pageTexts[0], diagrams: [] });
    await Promise.all([first, second]);
    expect(store.getPage("a")?.body).toBe("b");
  });

  it("validates lazy page identity, retries failures and installs its diagrams together", async () => {
    const full = snapshot("a");
    const load = vi
      .fn()
      .mockResolvedValueOnce({ revision: "b".repeat(64), ...full.pageTexts[0], diagrams: [] })
      .mockResolvedValueOnce({
        revision: full.revision,
        ...full.pageTexts[0],
        diagrams: [{ id: "figure", svg: "<svg/>" }],
      });
    const store = createReaderStore({ revision: full.revision, registry: full.registry }, load);
    await expect(store.ensurePage("a")).rejects.toThrow("版本");
    await store.ensurePage("a");
    expect(store.getPage("a")?.body).toBe("a");
    expect(store.getState().diagrams.get("figure")).toBe("<svg/>");
    await store.ensurePage("a");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("keeps the build revision, then replaces body, metadata and revision together", () => {
    const store = createReaderStore(snapshot("a"));
    expect(store.getState()).toMatchObject({ revision: "a".repeat(64), mode: "build" });
    const seen: string[] = [];
    store.subscribe(() => seen.push(`${store.getState().revision}:${store.getPage("a")?.body}`));
    store.install(snapshot("b"));
    expect(seen).toEqual([`${"b".repeat(64)}:b`]);
    expect(store.getPage("a")?.fm.title).toBe("b");
    expect(store.getState().mode).toBe("local");
  });

  it("rejects incomplete or duplicate payloads without changing any reader state", () => {
    const store = createReaderStore(snapshot("a"));
    const initial = store.getState();
    const invalid = [
      { ...snapshot("b"), revision: undefined },
      { ...snapshot("b"), revision: "invalid" },
      { ...snapshot("b"), searchIndex: undefined },
      { ...snapshot("b"), pageTexts: [] },
      { ...snapshot("b"), pageTexts: [...snapshot("b").pageTexts, ...snapshot("b").pageTexts] },
      {
        ...snapshot("b"),
        registry: { version: 1, pages: [...snapshot("b").registry.pages, ...snapshot("b").registry.pages] },
      },
    ];
    for (const input of invalid) {
      expect(() => store.install(input)).toThrow();
      expect(store.getState()).toBe(initial);
      expect(store.getPage("a")?.body).toBe("a");
    }
  });

  it("late responses cannot overwrite a newer snapshot or its failure state", async () => {
    const store = createReaderStore(snapshot("a"));
    let resolveOld!: (value: unknown) => void;
    const old = store.refresh(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    expect(await store.refresh(async () => snapshot("c"))).toBe(true);
    resolveOld(snapshot("b"));
    expect(await old).toBe(false);
    expect(store.getPage("a")?.body).toBe("c");
    let rejectOld!: (error: Error) => void;
    const failed = store.refresh(
      () =>
        new Promise((_, reject) => {
          rejectOld = reject;
        }),
    );
    await store.refresh(async () => snapshot("d"));
    rejectOld(new Error("stale network failure"));
    expect(await failed).toBe(false);
    await expect(
      store.refresh(async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(store.getState().revision).toBe("d".repeat(64));
  });

  it("an unmounted request cannot install its result", async () => {
    const store = createReaderStore(snapshot("a"));
    const controller = new AbortController();
    const result = store.refresh(async () => {
      controller.abort();
      return snapshot("b");
    }, controller.signal);
    expect(await result).toBe(false);
    expect(store.getState().mode).toBe("build");
  });

  it("skipped pages stay out of the list, are known as unavailable, and their reasons go to console only", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const skipped = [{ id: "bad", file: "concepts/bad.md", reason: "[schema] summary: Required" }];
      const store = createReaderStore({ ...snapshot("a"), skipped });
      expect(store.getState().pages.map((p) => p.id)).toEqual(["a"]);
      expect(store.getPage("a")?.body).toBe("a");
      expect(store.getPage("bad")).toBeUndefined();
      expect(store.getState().skipped.has("bad")).toBe(true);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]?.[0]).toContain("concepts/bad.md：[schema] summary: Required");
      // 坏页修好了：新快照里没有跳过的页，也不再 warn
      store.install(snapshot("b"));
      expect(store.getState().skipped.size).toBe(0);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("lazily loads the prebuilt search index without loading page chunks, validates revision, and blocks stale in-flight indexes after live refresh", async () => {
    const revA = snapshot("a");
    const revB = snapshot("b");
    const serializedOf = (s: ReturnType<typeof snapshot>, bodyText: string) =>
      serializeSearchIndex(
        buildIndex(
          s.registry.pages.map((p) => ({
            ...p,
            aliases: [],
            chapters: [],
            relations: [],
            related: [],
            text: bodyText,
          })),
        ),
        s.revision,
      );
    const indexA = serializedOf(revA, "旧版专有词 legacy_alpha");
    const indexB = serializedOf(revB, "新版专有词 fresh_beta");

    const loadPage = vi.fn(async () => {
      throw new Error("检索不应触发单页 chunk 下载");
    });
    let resolveStaleA!: (value: unknown) => void;
    const loadIndex = vi
      .fn()
      .mockResolvedValueOnce({ ...indexA, revision: "c".repeat(64) })
      .mockResolvedValueOnce(indexA);

    const lazyStore = createReaderStore(
      { revision: revA.revision, registry: revA.registry },
      loadPage,
      loadIndex,
    );
    await expect(lazyStore.ensureSearchIndex()).rejects.toThrow("版本");
    // 304 Not Modified flips mode to local while keeping lazy build index valid for the same revision
    await lazyStore.refresh(async () => null);
    expect(lazyStore.getState().mode).toBe("local");
    const loadedIdx = await lazyStore.ensureSearchIndex();
    expect(retrieve("legacy_alpha", loadedIdx).map((h) => h.id)).toEqual(["a"]);
    expect(loadPage).not.toHaveBeenCalled();
    expect(loadIndex).toHaveBeenCalledTimes(2);

    // Stale in-flight build index must never pollute a newer installed live snapshot
    const raceStore = createReaderStore(
      { revision: revA.revision, registry: revA.registry },
      loadPage,
      () =>
        new Promise((done) => {
          resolveStaleA = done;
        }),
    );
    const inFlight = raceStore.ensureSearchIndex();
    expect(() => raceStore.install({ ...revB, searchIndex: { ...indexB, revision: revA.revision } })).toThrow(
      "检索索引",
    );
    raceStore.install({ ...revB, searchIndex: indexB });
    resolveStaleA(indexA);
    const winner = await inFlight;
    expect(retrieve("fresh_beta", winner).map((h) => h.id)).toEqual(["a"]);
    expect(retrieve("legacy_alpha", winner)).toEqual([]);
    expect(retrieve("fresh_beta", await raceStore.ensureSearchIndex()).map((h) => h.id)).toEqual(["a"]);
  });

  it("same-revision live install atomically installs diagrams alongside prefilled pages", async () => {
    const base = snapshot("a");
    const fullWithDiagram = {
      ...base,
      diagrams: [{ id: "figure-alpha", svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' }],
    };
    const loadPage = vi.fn(async () => ({
      revision: base.revision,
      ...base.pageTexts[0]!,
      diagrams: fullWithDiagram.diagrams,
    }));
    const store = createReaderStore(
      { revision: base.revision, registry: base.registry },
      loadPage,
      async () => base.searchIndex,
    );
    store.install(fullWithDiagram);
    await store.ensurePage("a");
    expect(store.getPage("a")?.body).toBe("a");
    expect(store.getState().diagrams.get("figure-alpha")).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("refuses missing prebuilt searchIndex without falling back to all-page downloads or client-side buildIndex", async () => {
    const base = snapshot("a");
    const loadPage = vi.fn(async () => ({
      revision: base.revision,
      ...base.pageTexts[0]!,
      diagrams: [],
    }));
    const legacyStore = createReaderStore({ revision: base.revision, registry: base.registry }, loadPage);
    await expect(legacyStore.ensureSearchIndex()).rejects.toThrow("检索索引");
    expect(loadPage).not.toHaveBeenCalled();
    expect(legacyStore.getState().revision).toBe(base.revision);
  });

  it("resolves legacyIds to canonical pages without duplicate downloads, ignores aliases, and preserves current snapshot on conflicting live install", async () => {
    const revA = "a".repeat(64);
    const pageCurrent = {
      id: "current-page",
      legacyIds: ["former-page", "legacy-v0"],
      title: "Current Page",
      type: "concept" as const,
      summary: "Canonical summary.",
      aliases: ["Human Alias", "alias-kebab"],
      file: "concepts/current-page.md",
      sources: ["https://example.com/source"],
      evidence: "I" as const,
      updated: "2026-11-16",
    };
    const pageOther = {
      id: "other-page",
      title: "Other Page",
      type: "concept" as const,
      summary: "Other summary.",
      aliases: [],
      file: "concepts/other-page.md",
      sources: ["https://example.com/other"],
      evidence: "I" as const,
      updated: "2026-11-16",
    };
    const calls: string[] = [];
    const store = createReaderStore(
      { revision: revA, registry: { version: 1, pages: [pageCurrent, pageOther] } },
      async (id) => {
        calls.push(id);
        return {
          revision: revA,
          file: `concepts/${id}.md`,
          text: `---\nid: ${id}\n---\n## 保留锚点\n\n正文 ${id}`,
          diagrams: [],
        };
      },
    );

    expect(store.resolvePageId("former-page")).toBe("current-page");
    expect(store.resolvePageId("current-page")).toBe("current-page");
    expect(store.resolvePageId("alias-kebab")).toBeUndefined();
    expect(store.resolvePageId("missing-id")).toBeUndefined();

    // 旧新 ID 并发与串行请求均只按规范 ID 下载一次，未知 ID 不发请求
    await Promise.all([
      store.ensurePage("former-page"),
      store.ensurePage("current-page"),
      store.ensurePage("alias-kebab"),
      store.ensurePage("missing-id"),
    ]);
    await store.ensurePage("legacy-v0");
    expect(calls).toEqual(["current-page"]);
    expect(store.getPage("former-page")).toBe(store.getPage("current-page"));
    expect(store.getPage("former-page")?.fm.id).toBe("current-page");
    expect(store.getPage("alias-kebab")).toBeUndefined();
    expect(store.getPage("missing-id")).toBeUndefined();

    // live 快照若含跨页重复 legacyIds 或与 canonical ID 冲突，必须拒绝并完整保留当前可用快照
    const revB = "b".repeat(64);
    const makeLive = (pages: (typeof pageCurrent | typeof pageOther)[]) => ({
      revision: revB,
      registry: { version: 1 as const, pages },
      pageTexts: pages.map((p) => ({ file: p.file, text: `---\nid: ${p.id}\n---\n新版 ${p.id}` })),
      searchIndex: serializeSearchIndex(
        buildIndex(
          pages.map((p) => ({ ...p, chapters: [], relations: [], related: [], text: `新版 ${p.id}` })),
        ),
        revB,
      ),
    });

    const beforeState = store.getState();
    const beforeArticle = store.getPage("current-page");
    const dupConflict = makeLive([
      { ...pageCurrent, legacyIds: ["shared-old"] },
      { ...pageOther, legacyIds: ["shared-old"] },
    ]);
    const canonicalConflict = makeLive([{ ...pageCurrent, legacyIds: ["other-page"] }, pageOther]);
    const skippedConflict = {
      ...makeLive([{ ...pageCurrent, legacyIds: ["skipped-page"] }, pageOther]),
      skipped: [{ id: "skipped-page", file: "concepts/skipped-page.md", reason: "[schema] invalid" }],
    };

    expect(() => store.install(dupConflict)).toThrow();
    expect(() => store.install(skippedConflict)).toThrow();
    await expect(store.refresh(async () => canonicalConflict)).rejects.toThrow();
    await expect(store.refresh(async () => skippedConflict)).rejects.toThrow();
    expect(store.getState()).toBe(beforeState);
    expect(store.getPage("former-page")).toBe(beforeArticle);
    expect(store.resolvePageId("former-page")).toBe("current-page");
  });

  it("hydrates stripped heavy fields + packedCompiled on ensurePage and completes all unloaded pages on same-revision live install", async () => {
    const rev = "e".repeat(64);
    const rawPath = `raw/sha256-${"f".repeat(64)}.md`;
    const compiledTree: CompiledNode = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [{ type: "text", value: "紧凑编译正文" }],
        },
      ],
    };
    const fullA = {
      id: "alpha",
      title: "Alpha",
      type: "concept" as const,
      summary: "Alpha summary",
      file: "concepts/alpha.md",
      sources: [
        "https://example.com/c1",
        "vllm-ascend@28bf3a2e:vllm_ascend/a.py#L1-L5",
        `raw:${rawPath.slice(4)}#L1-L2`,
      ],
      rawSources: [rawPath],
      relations: [{ to: "beta", kind: "builds-on" as const, note: "Alpha 建在 Beta 之上" }],
      backlinks: [],
      evidence: "C" as const,
      updated: "2026-11-24",
    };
    const fullB = {
      id: "beta",
      title: "Beta",
      type: "concept" as const,
      summary: "Beta summary",
      file: "concepts/beta.md",
      sources: ["https://example.com/beta"],
      relations: [],
      backlinks: [{ from: "alpha", kind: "enables", note: "Alpha 建在 Beta 之上" }],
      evidence: "S" as const,
      updated: "2026-11-24",
    };

    const stripHeavy = <T extends Record<string, unknown>>({
      sources: _s,
      rawSources: _rs,
      relations: _rel,
      backlinks: _bl,
      ...light
    }: T) => light;

    let resolveLateBeta!: (val: unknown) => void;
    const loadPage = vi.fn((id: string) => {
      if (id === "alpha") {
        return Promise.resolve({
          revision: rev,
          file: fullA.file,
          packedCompiled: packCompiledNode(compiledTree),
          sources: fullA.sources,
          rawSources: fullA.rawSources,
          relations: fullA.relations,
          backlinks: fullA.backlinks,
          diagrams: [],
        });
      }
      return new Promise((resolve) => {
        resolveLateBeta = resolve;
      });
    });
    const loadGraph = vi.fn(async () => ({
      revision: rev,
      edges: [{ from: "alpha", to: "beta", kind: "builds-on" as const, note: "Alpha 建在 Beta 之上" }],
    }));

    const store = createReaderStore(
      { revision: rev, registry: { version: 1, pages: [stripHeavy(fullA), stripHeavy(fullB)] } },
      loadPage,
      undefined,
      undefined,
      loadGraph,
    );

    // 轻目录初始缺省为空数组
    expect(store.getState().pages.find((p) => p.id === "alpha")?.sources).toEqual([]);
    expect(store.getState().pages.find((p) => p.id === "alpha")?.relations).toEqual([]);
    expect(store.getState().pages.find((p) => p.id === "beta")?.backlinks).toEqual([]);

    // 按需加载图谱无需下载单页
    const graph = await store.ensureWikiGraph();
    expect(graph.edges).toEqual([
      { from: "alpha", to: "beta", kind: "builds-on", note: "Alpha 建在 Beta 之上" },
    ]);
    expect(loadGraph).toHaveBeenCalledTimes(1);
    expect(loadPage).not.toHaveBeenCalled();

    // 加载单页 alpha（无 text，仅 packedCompiled）
    await store.ensurePage("alpha");
    const hydratedAlpha = store.getPage("alpha")!;
    expect(hydratedAlpha.body).toBe("");
    expect(hydratedAlpha.compiled).toEqual(compiledTree);
    expect(hydratedAlpha.fm.sources).toEqual(fullA.sources);
    expect(hydratedAlpha.fm.rawSources).toEqual(fullA.rawSources);
    expect(hydratedAlpha.fm.relations).toEqual(fullA.relations);
    expect(store.getState().pages.find((p) => p.id === "alpha")?.sources).toEqual(fullA.sources);

    // beta 在途请求期间同 revision live install 到达：补齐所有页重字段与正文，且晚到的无 text 构建包不冲掉正文
    const inFlightBeta = store.ensurePage("beta");
    const liveSnapshot = {
      revision: rev,
      registry: { version: 1 as const, pages: [fullA, fullB] },
      pageTexts: [
        { file: fullA.file, text: "---\nid: alpha\n---\nLive Alpha 正文", compiled: compiledTree },
        { file: fullB.file, text: "---\nid: beta\n---\nLive Beta 正文", compiled: compiledTree },
      ],
      searchIndex: serializeSearchIndex(
        buildIndex([
          { ...fullA, aliases: [], chapters: [], related: [], text: "Live Alpha 正文" },
          { ...fullB, aliases: [], chapters: [], related: [], text: "Live Beta 正文" },
        ]),
        rev,
      ),
    };
    store.install(liveSnapshot);
    resolveLateBeta({
      revision: rev,
      file: fullB.file,
      packedCompiled: packCompiledNode(compiledTree),
      sources: fullB.sources,
      relations: fullB.relations,
      backlinks: fullB.backlinks,
      diagrams: [],
    });
    await inFlightBeta;

    expect(store.getState().mode).toBe("local");
    expect(store.getState().pages.find((p) => p.id === "beta")?.backlinks).toEqual(fullB.backlinks);
    expect(store.getPage("beta")?.body).toBe("Live Beta 正文");
    expect(store.getPage("alpha")?.body).toBe("Live Alpha 正文");
  });
});
