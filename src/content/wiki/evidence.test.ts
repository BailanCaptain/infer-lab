import { describe, expect, it, vi } from "vitest";
import {
  createEvidenceViewController,
  normalizeRequestedLineRange,
  type ReaderPageEvidence,
  readerPageEvidenceSchema,
  repoSourceUrl,
  resolveActiveEvidence,
} from "./evidence-schema";
import { createReaderStore } from "./reader-store";
import { buildIndex, serializeSearchIndex } from "./retrieve";

describe("前端证据状态机与 reader-store 按需缓存（Task 045 · 000854）", () => {
  it("支持失败重试恢复、图多 pin 就地切换，且跨页/跨 revision 切换时旧异步结果绝不覆盖新状态", async () => {
    const revA = "a".repeat(64);
    const revB = "b".repeat(64);
    const mkPage = (id: string) => ({
      id,
      title: id,
      type: "concept" as const,
      summary: id,
      file: `concepts/${id}.md`,
      sources: ["https://example.com/a"],
      evidence: "I" as const,
      updated: "2026-11-16",
    });
    const mkPack = (revision: string, pageId: string, url: string): ReaderPageEvidence =>
      readerPageEvidenceSchema.parse({
        version: 1,
        revision,
        pageId,
        pageSources: [url],
        diagrams: [
          {
            diagramId: "fig-1",
            caption: "示意图",
            pins: [
              { pinIndex: 0, ref: "vllm@12345678:a.py#L1-L2", symbols: ["fn_a"] },
              { pinIndex: 1, ref: "vllm@12345678:a.py#L5-L6", symbols: ["fn_b"] },
            ],
          },
        ],
        entries: {
          [url]: { ref: url, kind: "url", status: "external", externalHref: url },
          "vllm@12345678:a.py#L1-L2": {
            ref: "vllm@12345678:a.py#L1-L2",
            kind: "repo",
            status: "ok",
            repo: "vllm",
            commit: "12345678",
            path: "a.py",
            versionRefs: ["v0.15.0"],
            lineStart: 1,
            lineEnd: 2,
            totalLines: 10,
            lines: [
              { number: 1, text: "<script>alert(1)</script>" },
              { number: 2, text: "return 1" },
            ],
            externalHref: "https://github.com/vllm-project/vllm/blob/12345678/a.py#L1-L2",
          },
          "vllm@12345678:a.py#L5-L6": {
            ref: "vllm@12345678:a.py#L5-L6",
            kind: "repo",
            status: "ok",
            repo: "vllm",
            commit: "12345678",
            path: "a.py",
            versionRefs: ["v0.15.0"],
            lineStart: 5,
            lineEnd: 6,
            totalLines: 10,
            lines: [
              { number: 5, text: "def fn_b():" },
              { number: 6, text: "    return 2" },
            ],
            externalHref: "https://github.com/vllm-project/vllm/blob/12345678/a.py#L5-L6",
          },
        },
      });

    let resolveSlowA!: (v: unknown) => void;
    let failOnceB = true;
    const loadEvidence = vi.fn((id: string, rev: string) => {
      if (id === "page-a" && rev === revA) {
        return new Promise((r) => {
          resolveSlowA = r;
        });
      }
      if (id === "page-b" && failOnceB) {
        failOnceB = false;
        return Promise.reject(new Error("网络暂时不可用"));
      }
      return Promise.resolve(mkPack(rev, id, `https://example.com/${rev.slice(0, 4)}/${id}`));
    });

    const store = createReaderStore(
      { revision: revA, registry: { version: 1, pages: [mkPage("page-a"), mkPage("page-b")] } },
      async (id) => ({
        revision: revA,
        file: `concepts/${id}.md`,
        text: `---\nid: ${id}\n---\n正文`,
        diagrams: [],
      }),
      undefined,
      loadEvidence,
    );

    const ctl = createEvidenceViewController({
      loadPageEvidence: (pageId) => store.ensurePageEvidence(pageId),
    });

    const pSlowA = ctl.openForSource("page-a", revA, 0);
    expect(ctl.getState()).toMatchObject({ open: true, pageId: "page-a", status: "loading" });

    await ctl.openForDiagram("page-b", revA, "fig-1", 0);
    expect(ctl.getState().status).toBe("error");
    await ctl.retry();
    expect(ctl.getState()).toMatchObject({ open: true, pageId: "page-b", status: "ready" });
    expect(resolveActiveEvidence(ctl.getState()).selectedPin?.symbols).toEqual(["fn_a"]);
    ctl.selectPin(1);
    expect(resolveActiveEvidence(ctl.getState()).entry).toMatchObject({
      kind: "repo",
      lineStart: 5,
      lineEnd: 6,
    });

    resolveSlowA(mkPack(revA, "page-a", "https://example.com/stale-a"));
    await pSlowA;
    expect(ctl.getState().pageId).toBe("page-b");
    expect(ctl.getState().pack?.pageId).toBe("page-b");

    let resolveStaleRev!: (v: unknown) => void;
    const raceStore = createReaderStore(
      { revision: revA, registry: { version: 1, pages: [mkPage("page-a")] } },
      async (id) => ({ revision: revA, file: `concepts/${id}.md`, text: "x", diagrams: [] }),
      undefined,
      (_id, rev) =>
        rev === revA
          ? new Promise((r) => {
              resolveStaleRev = r;
            })
          : Promise.resolve(mkPack(revB, "page-a", "https://example.com/fresh-b")),
    );

    const inFlightRevA = raceStore.ensurePageEvidence("page-a");
    raceStore.install({
      revision: revB,
      registry: { version: 1, pages: [mkPage("page-a")] },
      pageTexts: [{ file: "concepts/page-a.md", text: "---\nid: page-a\n---\n新版" }],
      searchIndex: serializeSearchIndex(
        buildIndex([
          { ...mkPage("page-a"), aliases: [], chapters: [], relations: [], related: [], text: "新版" },
        ]),
        revB,
      ),
    });
    resolveStaleRev(mkPack(revA, "page-a", "https://example.com/old-a"));
    const resolvedAfterSwap = await inFlightRevA;
    expect(resolvedAfterSwap.revision).toBe(revB);
    expect(raceStore.getPageEvidence("page-a")?.revision).toBe(revB);
  });

  it("单一范围入口与 Schema 守卫：拒绝零/反序/超安全整数伪造行号，且保证 ok 摘录行数与范围严格一致", () => {
    const rev = "c".repeat(64);
    expect(() =>
      readerPageEvidenceSchema.parse({
        version: 1,
        revision: rev,
        pageId: "p",
        pageSources: [],
        diagrams: [],
        entries: {
          "vllm@12345678:a.py#L999999999999999999999": {
            ref: "vllm@12345678:a.py#L999999999999999999999",
            kind: "repo",
            status: "unavailable",
            reason: "out-of-range",
            repo: "vllm",
            commit: "12345678",
            path: "a.py",
            versionRefs: [],
            lineStart: 1e21,
            lineEnd: 1e21,
            externalHref: null,
          },
        },
      }),
    ).toThrow();

    expect(() =>
      readerPageEvidenceSchema.parse({
        version: 1,
        revision: rev,
        pageId: "p",
        pageSources: [],
        diagrams: [],
        entries: {
          "vllm@12345678:a.py#L5-L2": {
            ref: "vllm@12345678:a.py#L5-L2",
            kind: "repo",
            status: "unavailable",
            reason: "out-of-range",
            repo: "vllm",
            commit: "12345678",
            path: "a.py",
            versionRefs: [],
            lineStart: 5,
            lineEnd: 2,
            externalHref: null,
          },
        },
      }),
    ).toThrow();

    expect(() =>
      readerPageEvidenceSchema.parse({
        version: 1,
        revision: rev,
        pageId: "p",
        pageSources: [],
        diagrams: [],
        entries: {
          "vllm@12345678:a.py#L1-L3": {
            ref: "vllm@12345678:a.py#L1-L3",
            kind: "repo",
            status: "ok",
            repo: "vllm",
            commit: "12345678",
            path: "a.py",
            versionRefs: [],
            lineStart: 1,
            lineEnd: 3,
            totalLines: 10,
            lines: [{ number: 1, text: "only_one_line" }],
            externalHref: null,
          },
        },
      }),
    ).toThrow();

    expect(normalizeRequestedLineRange(undefined, undefined)).toEqual({ kind: "none" });
    expect(normalizeRequestedLineRange(0, 2)).toEqual({ kind: "invalid" });
    expect(normalizeRequestedLineRange(2, 0)).toEqual({ kind: "invalid" });
    expect(normalizeRequestedLineRange(5, 2)).toEqual({ kind: "invalid" });
    expect(normalizeRequestedLineRange(1e21, 1e21)).toEqual({ kind: "invalid" });
    expect(normalizeRequestedLineRange(1, 3)).toEqual({ kind: "valid", lineStart: 1, lineEnd: 3 });
    expect(repoSourceUrl({ repo: "vllm", commit: "12345678", path: "a.py", lineStart: 0, lineEnd: 2 })).toBe(
      "https://github.com/vllm-project/vllm/blob/12345678/a.py",
    );
    expect(repoSourceUrl({ repo: "vllm", commit: "12345678", path: "a.py", lineStart: 1e21 })).toBe(
      "https://github.com/vllm-project/vllm/blob/12345678/a.py",
    );
  });
});

describe("证据视图控制器的 (revision, pageId) 缓存与在途去重", () => {
  const revA = "a".repeat(64);
  const revB = "b".repeat(64);
  const mkPack = (revision: string, pageId: string): ReaderPageEvidence =>
    readerPageEvidenceSchema.parse({
      version: 1,
      revision,
      pageId,
      pageSources: ["https://example.com/doc"],
      diagrams: [],
      entries: {
        "https://example.com/doc": {
          ref: "https://example.com/doc",
          kind: "url",
          status: "external",
          externalHref: "https://example.com/doc",
        },
      },
    });

  it("预热与点击共享一次请求；关闭重开、切 source 不重复加载；loader 收到 (pageId, revision)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const loader = vi.fn(async (pageId: string, revision: string) => {
      await gate;
      return mkPack(revision, pageId);
    });
    const ctl = createEvidenceViewController({ loadPageEvidence: loader });
    const warm = ctl.prefetch("page-a", revA);
    const open = ctl.openForSource("page-a", revA, 0);
    expect(ctl.getState().status).toBe("loading");
    ctl.selectSource(0);
    release();
    await Promise.all([warm, open]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith("page-a", revA);
    expect(ctl.getState()).toMatchObject({ open: true, status: "ready", revision: revA });

    ctl.close();
    expect(ctl.getState().open).toBe(false);
    await ctl.openForRef("page-a", revA, "https://example.com/doc");
    expect(ctl.getState()).toMatchObject({ open: true, status: "ready" });
    expect(resolveActiveEvidence(ctl.getState()).entry).toMatchObject({ kind: "url" });
    expect(loader).toHaveBeenCalledTimes(1);

    // 新 revision 是另一个缓存键，需要重新加载
    await ctl.openForSource("page-a", revB, 0);
    expect(ctl.getState()).toMatchObject({ status: "ready", revision: revB });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("A 慢 B 快、关闭后晚到的结果都不覆盖当前状态；失败不缓存，retry 重新请求", async () => {
    const resolvers = new Map<string, (p: ReaderPageEvidence) => void>();
    let failNext = true;
    const loader = vi.fn((pageId: string, revision: string) => {
      if (pageId === "page-c" && failNext) {
        failNext = false;
        return Promise.reject(new Error("暂时失败"));
      }
      if (pageId === "page-b" || pageId === "page-c") return Promise.resolve(mkPack(revision, pageId));
      return new Promise<ReaderPageEvidence>((r) => resolvers.set(pageId, r));
    });
    const ctl = createEvidenceViewController({ loadPageEvidence: loader });
    const slowA = ctl.openForSource("page-a", revA, 0);
    await ctl.openForSource("page-b", revA, 0);
    resolvers.get("page-a")!(mkPack(revA, "page-a"));
    await slowA;
    expect(ctl.getState()).toMatchObject({ pageId: "page-b", status: "ready" });
    expect(ctl.getState().pack?.pageId).toBe("page-b");

    const lateD = ctl.openForSource("page-d", revA, 0);
    ctl.close();
    resolvers.get("page-d")!(mkPack(revA, "page-d"));
    await lateD;
    expect(ctl.getState()).toMatchObject({ open: false, status: "idle" });
    // 晚到的结果仍进入缓存，重开时直接就绪且不再请求
    const calls = loader.mock.calls.length;
    await ctl.openForSource("page-d", revA, 0);
    expect(ctl.getState()).toMatchObject({ open: true, status: "ready", pageId: "page-d" });
    expect(loader.mock.calls.length).toBe(calls);

    await ctl.openForSource("page-c", revA, 0);
    expect(ctl.getState()).toMatchObject({ status: "error", error: "暂时失败" });
    await ctl.retry();
    expect(ctl.getState()).toMatchObject({ status: "ready", pageId: "page-c" });
    expect(loader.mock.calls.filter(([id]) => id === "page-c")).toHaveLength(2);
  });
});
