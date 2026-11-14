import { describe, expect, it, vi } from "vitest";
import { createReaderStore } from "./reader-store";

function snapshot(version: string) {
  return {
    revision: version.repeat(64),
    registry: {
      version: 1,
      pages: [
        {
          id: "a",
          title: version,
          type: "source",
          summary: version,
          file: "sources/a.md",
          sources: ["https://example.com/"],
          evidence: "I",
          updated: "2026-09-15",
        },
      ],
    },
    pageTexts: [{ file: "sources/a.md", text: `---\nid: a\n---\n${version}` }],
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
});
