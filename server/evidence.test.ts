import { once } from "node:events";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildLockedPageEvidence, buildPageEvidenceFromLocked } from "../scripts/wiki/evidence";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { wikiReaderPlugin } from "../scripts/wiki/reader-plugin";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { readerPageEvidenceSchema } from "../src/content/wiki/evidence-schema";
import { dispatchWikiRequest } from "./app";
import { readLockedEvidenceSnapshot, readReaderSnapshot } from "./snapshot";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

describe("离线源码与原文证据构建、安全边界与 HTTP/静态路由（Task 045 · 000854）", () => {
  it("按页生成绑定 revision 的证据包：保留图多 pin 异/同精确范围、拦截缺失 blob/越界/篡改 raw/未发布 raw、原样保留 HTML 样本文本且不抓外链", async () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/HANDBOOK.md", handbookFixture());

    f.write(
      "repo/src/quant.py",
      `${[
        "def scale_weights(x):",
        '    tag = "<script>alert(\\"xss\\")</script><img src=x onerror=1>"',
        "    return x * 0.5",
        "def per_token_act(a):",
        "    return a.clamp(-127, 127)",
        "def tail_helper():",
        "    return 42",
      ].join("\n")}\n`,
    );
    const pinnedCommit = f.commit("pin quant source");
    f.write("repo/src/quant.py", "WORKTREE_TAMPERED_LINE\n");
    f.write(
      "wiki/seeds/local.yaml",
      `${[
        "repos:",
        "  vllm-ascend:",
        "    url: https://github.com/vllm-project/vllm-ascend.git",
        "    path: ./repo",
        "    refs:",
        `      releases/v0.26.0rc: ${pinnedCommit}`,
        "features: []",
      ].join("\n")}\n`,
    );

    const validRawPath = saveRawSnapshot(
      join(f.root, "wiki"),
      `${["第一行原文", "<div>第二行原生标签不执行</div>", "第三行结论"].join("\n")}\n`,
    );
    const tamperedRawPath = saveRawSnapshot(join(f.root, "wiki"), "原始未篡改第一行\n第二行\n");
    const unpublishedRawPath = saveRawSnapshot(join(f.root, "wiki"), "未发布 Review 私有摘录\n第二行\n");

    const validRawRef = `raw:${validRawPath.slice("raw/".length)}#L1-L2`;
    const outOfRangeRawRef = `raw:${validRawPath.slice("raw/".length)}#L2-L9`;
    const tamperedRawRef = `raw:${tamperedRawPath.slice("raw/".length)}#L1-L1`;
    const unpublishedRawRef = `raw:${unpublishedRawPath.slice("raw/".length)}#L1-L1`;

    f.write(
      "wiki/diagrams/quant-pins.yaml",
      `${[
        "layout: figure",
        "id: quant-pins",
        "caption: 量化对照图",
        "size: [240, 120]",
        "items:",
        "  - { at: [16, 16], size: [80, 32], text: 输入 }",
        "pins:",
        `  - { source: "vllm-ascend@${pinnedCommit.slice(0, 8)}:src/quant.py#L4-L5", symbols: [per_token_act] }`,
        `  - { source: "vllm-ascend@${pinnedCommit.slice(0, 8)}:src/quant.py#L6-L7", symbols: [tail_helper] }`,
        `  - { source: "vllm-ascend@${pinnedCommit.slice(0, 8)}:src/quant.py#L6-L7", symbols: [tail_alias] }`,
      ].join("\n")}\n`,
    );
    f.write(
      "wiki/diagrams/quant-pins.svg",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>\n',
    );
    const pageSources = [
      `vllm-ascend@${pinnedCommit.slice(0, 8)}:src/quant.py#L1-L3`,
      `vllm-ascend@${pinnedCommit.slice(0, 8)}:src/quant.py#L2-L99`,
      `vllm-ascend@${pinnedCommit.slice(0, 8)}:src/missing.py#L1-L2`,
      "vllm-ascend@deadbeef00:src/quant.py#L1-L2",
      "unlisted-repo@12345678:src/a.py#L1-L2",
      validRawRef,
      outOfRangeRawRef,
      "https://docs.vllm.ai/en/latest/quantization.html",
    ];

    f.write(
      "wiki/concepts/quant-sample.md",
      `${[
        "---",
        "id: quant-sample",
        "legacyIds: [former-quant-sample]",
        "title: 量化样本",
        "type: concept",
        "summary: 证据测试样本。",
        "sources:",
        ...pageSources.map((s) => `  - "${s}"`),
        "evidence: C",
        `rawSources: ["${validRawPath}", "${tamperedRawPath}"]`,
        "updated: '2026-11-16'",
        "---",
        "## 一句话",
        "量化权重缩放 [C1]，详见原文 [C6] 与外部说明 [C8]。",
        "",
        "```wiki-diagram",
        "file: quant-pins",
        "```",
      ].join("\n")}\n`,
    );

    const snap = await readReaderSnapshot(f.root);
    const locked = await readLockedEvidenceSnapshot(f.root);
    expect(Object.hasOwn(snap, "evidence")).toBe(false);

    f.write(`wiki/${tamperedRawPath}`, "被篡改后的伪造内容\n第二行\n");

    const pack = buildPageEvidenceFromLocked(f.root, locked, "quant-sample", {
      extraProbeRefs: [tamperedRawRef, unpublishedRawRef],
    });
    const parsed = readerPageEvidenceSchema.parse(pack);
    expect(parsed.revision).toBe(snap.revision);
    expect(parsed.pageId).toBe("quant-sample");

    const okRepo = parsed.entries[pageSources[0]!];
    expect(okRepo).toMatchObject({
      kind: "repo",
      status: "ok",
      repo: "vllm-ascend",
      versionRefs: ["v0.26.0rc"],
      lineStart: 1,
      lineEnd: 3,
      externalHref: `https://github.com/vllm-project/vllm-ascend/blob/${pinnedCommit.slice(0, 8)}/src/quant.py#L1-L3`,
    });
    if (okRepo?.kind === "repo" && okRepo.status === "ok") {
      expect(okRepo.lines.map((l) => l.text).join("\n")).toContain('<script>alert(\\"xss\\")</script>');
      expect(okRepo.lines.map((l) => l.text).join("\n")).not.toContain("WORKTREE_TAMPERED_LINE");
    }

    expect(parsed.diagrams).toHaveLength(1);
    expect(parsed.diagrams[0]?.pins.map((p) => `${p.symbols[0]}:${p.ref.split("#")[1]}`)).toEqual([
      "per_token_act:L4-L5",
      "tail_helper:L6-L7",
      "tail_alias:L6-L7",
    ]);
    const pin0Entry = parsed.entries[parsed.diagrams[0]!.pins[0]!.ref];
    expect(
      pin0Entry?.kind === "repo" && pin0Entry.status === "ok" ? pin0Entry.lines.map((l) => l.number) : [],
    ).toEqual([4, 5]);

    expect(parsed.entries[pageSources[1]!]).toMatchObject({
      kind: "repo",
      status: "unavailable",
      reason: "out-of-range",
    });
    expect(parsed.entries[pageSources[2]!]).toMatchObject({
      kind: "repo",
      status: "unavailable",
      reason: "missing-file",
    });
    expect(parsed.entries[pageSources[3]!]).toMatchObject({
      kind: "repo",
      status: "unavailable",
      reason: "invalid-commit",
    });
    expect(parsed.entries[pageSources[4]!]).toMatchObject({
      kind: "repo",
      status: "unavailable",
      reason: "unknown-repo",
      externalHref: null,
    });
    expect(parsed.entries[validRawRef]).toMatchObject({
      kind: "raw",
      status: "ok",
      lines: [
        { number: 1, text: "第一行原文" },
        { number: 2, text: "<div>第二行原生标签不执行</div>" },
      ],
    });
    expect(parsed.entries[outOfRangeRawRef]).toMatchObject({
      kind: "raw",
      status: "unavailable",
      reason: "out-of-range",
    });
    expect(parsed.entries[tamperedRawRef]).toMatchObject({
      kind: "raw",
      status: "unavailable",
      reason: "tampered-raw",
      rawViewerHref: null,
    });
    expect(parsed.entries[unpublishedRawRef]).toMatchObject({
      kind: "raw",
      status: "unavailable",
      reason: "unpublished-raw",
      rawViewerHref: null,
    });
    expect(parsed.entries[pageSources[7]!]).toEqual({
      ref: "https://docs.vllm.ai/en/latest/quantization.html",
      kind: "url",
      status: "external",
      externalHref: "https://docs.vllm.ai/en/latest/quantization.html",
    });

    f.write(`wiki/${tamperedRawPath}`, "原始未篡改第一行\n第二行\n");
    const srv = createServer((req, res) => void dispatchWikiRequest(req, res, f.root));
    srv.listen(0, "127.0.0.1");
    await once(srv, "listening");
    const port = (srv.address() as { port: number }).port;
    try {
      const okRes = await fetch(
        `http://127.0.0.1:${port}/api/wiki/evidence?page=former-quant-sample&revision=${snap.revision}`,
      );
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get("x-content-type-options")).toBe("nosniff");
      const livePack = readerPageEvidenceSchema.parse(await okRes.json());
      expect(livePack.pageId).toBe("quant-sample");

      const staleRes = await fetch(
        `http://127.0.0.1:${port}/api/wiki/evidence?page=quant-sample&revision=${"f".repeat(64)}`,
      );
      expect(staleRes.status).toBe(409);

      const crossOriginRes = await fetch(
        `http://127.0.0.1:${port}/api/wiki/evidence?page=quant-sample&revision=${snap.revision}`,
        { headers: { Origin: "http://evil.example" } },
      );
      expect(crossOriginRes.status).toBe(403);
    } finally {
      await new Promise((r) => srv.close(r));
    }
  });

  it("真实仓库样本核验：quantization 的 35 条图 pins 保留与页 sources 不同的精确行范围且首屏快照不含摘录", async () => {
    const repoRoot = resolve(import.meta.dirname, "..");
    const pack = await buildLockedPageEvidence(repoRoot, "quantization");
    const parsed = readerPageEvidenceSchema.parse(pack);
    const totalPins = parsed.diagrams.reduce((n, d) => n + d.pins.length, 0);
    expect(parsed.pageSources).toHaveLength(55);
    expect(totalPins).toBe(35);
    const pageSourceSet = new Set(parsed.pageSources);
    const distinctRangePins = parsed.diagrams
      .flatMap((d) => d.pins)
      .filter((pin) => !pageSourceSet.has(pin.ref));
    expect(distinctRangePins.length).toBeGreaterThanOrEqual(6);
    const hasLocalRepos = existsSync(join(repoRoot, "tools/repos/vllm-ascend"));
    for (const pin of distinctRangePins) {
      const entry = parsed.entries[pin.ref];
      if (hasLocalRepos) {
        expect(entry?.status).toBe("ok");
      } else {
        // Open-source checkout without multi-GB tools/repos/* clones degrades cleanly to unavailable + externalHref
        expect(entry).toMatchObject({ kind: "repo", status: "unavailable", reason: "unknown-repo" });
        if (entry?.kind === "repo") expect(entry.externalHref).toMatch(/^https:\/\//);
      }
    }
  }, 30_000);

  it("静态构建产物隔离：按页生成 ./wiki-evidence/<revision>/<id>.json，首屏主包与检索索引绝不内联摘录", async () => {
    const { build: viteBuild } = await import("vite");
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/HANDBOOK.md", handbookFixture());
    const uniqueMarker = "UNIQUE_EXCERPT_PAYLOAD_DO_NOT_BUNDLE_984512";
    const rawPath = saveRawSnapshot(join(f.root, "wiki"), `${uniqueMarker}\n第二行\n`);
    f.write(
      "wiki/concepts/build-sample.md",
      `${[
        "---",
        "id: build-sample",
        "title: 构建样本",
        "type: concept",
        "summary: 静态证据拆包核验。",
        `sources: ["raw:${rawPath.slice("raw/".length)}#L1-L2"]`,
        "evidence: C",
        `rawSources: ["${rawPath}"]`,
        "updated: '2026-11-16'",
        "---",
        "正文内容。",
      ].join("\n")}\n`,
    );
    f.write(
      "entry.js",
      'import snap, { loadPageEvidence, loadSearchIndex } from "virtual:wiki-reader-snapshot"; globalThis.__wiki = { snap, loadPageEvidence, loadSearchIndex };\n',
    );
    await viteBuild({
      root: f.root,
      configFile: false,
      logLevel: "silent",
      plugins: [wikiReaderPlugin()],
      build: {
        outDir: "dist",
        rollupOptions: { input: join(f.root, "entry.js") },
      },
    });
    const snap = await readReaderSnapshot(f.root);
    const evidenceFile = join(f.root, "dist", "wiki-evidence", snap.revision, "build-sample.json");
    expect(existsSync(evidenceFile)).toBe(true);
    const emitted = readerPageEvidenceSchema.parse(JSON.parse(readFileSync(evidenceFile, "utf8")));
    expect(JSON.stringify(emitted)).toContain(uniqueMarker);

    const searchJson = readFileSync(
      join(f.root, "dist", "wiki-search", `index-${snap.revision}.json`),
      "utf8",
    );
    expect(searchJson).not.toContain(uniqueMarker);

    const assetsDir = join(f.root, "dist", "assets");
    const jsBundles = readdirSync(assetsDir)
      .filter((n) => n.endsWith(".js"))
      .map((n) => readFileSync(join(assetsDir, n), "utf8"))
      .join("\n");
    expect(jsBundles).not.toContain(uniqueMarker);
    expect(jsBundles).toContain("./wiki-evidence/");
  }, 20_000);

  it("异常行号范围回归（000862 P2）：零起/零止/反序/超安全整数及 unknown-repo/missing-file/invalid-commit 同根分支不炸整包，同页好来源与静态构建照常产出", async () => {
    const { build: viteBuild } = await import("vite");
    const { buildAllLockedEvidence } = await import("../scripts/wiki/evidence");
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/HANDBOOK.md", handbookFixture());
    f.write("repo/src/ok.py", "line_one = 1\nline_two = 2\nline_three = 3\n");
    const commit = f.commit("pin ok.py");
    f.write(
      "wiki/seeds/local.yaml",
      `${[
        "repos:",
        "  vllm:",
        "    url: https://github.com/vllm-project/vllm.git",
        "    path: ./repo",
        "    refs:",
        `      main: ${commit}`,
        "features: []",
      ].join("\n")}\n`,
    );
    const rawPath = saveRawSnapshot(join(f.root, "wiki"), "合法原文第一行\n合法原文第二行\n");
    const goodRepoRef = `vllm@${commit.slice(0, 8)}:src/ok.py#L1-L2`;
    const goodRawRef = `raw:${rawPath.slice("raw/".length)}#L1-L2`;
    const zeroStartRef = `vllm@${commit.slice(0, 8)}:src/ok.py#L0-L2`;
    const zeroSingleRef = `vllm@${commit.slice(0, 8)}:src/ok.py#L0`;
    const zeroEndRef = `vllm@${commit.slice(0, 8)}:src/ok.py#L2-L0`;
    const reversedRef = `vllm@${commit.slice(0, 8)}:src/ok.py#L3-L1`;
    const unsafeIntRef = `vllm@${commit.slice(0, 8)}:src/ok.py#L999999999999999999999`;
    const unsafeEndRef = `vllm@${commit.slice(0, 8)}:src/ok.py#L1-L999999999999999999999`;
    const unknownRepoZeroRef = "unlisted-repo@12345678:src/ok.py#L0-L2";
    const missingFileRevRef = `vllm@${commit.slice(0, 8)}:src/missing.py#L5-L2`;
    const invalidCommitUnsafeRef = "vllm@deadbeef00:src/ok.py#L999999999999999999999";

    const sources = [
      goodRepoRef,
      goodRawRef,
      zeroStartRef,
      zeroSingleRef,
      zeroEndRef,
      reversedRef,
      unsafeIntRef,
      unsafeEndRef,
      unknownRepoZeroRef,
      missingFileRevRef,
      invalidCommitUnsafeRef,
    ];
    f.write(
      "wiki/concepts/mixed-ranges.md",
      `${[
        "---",
        "id: mixed-ranges",
        "title: 混合边界样本",
        "type: concept",
        "summary: 坏范围与好来源同页共存。",
        "sources:",
        ...sources.map((s) => `  - "${s}"`),
        "evidence: C",
        `rawSources: ["${rawPath}"]`,
        "updated: '2026-11-16'",
        "---",
        "正常引用 [C1] [C2]，异常引用 [C3]。",
      ].join("\n")}\n`,
    );
    f.write(
      "entry.js",
      'import snap, { loadPageEvidence } from "virtual:wiki-reader-snapshot"; globalThis.__wiki = { snap, loadPageEvidence };\n',
    );

    const locked = await readLockedEvidenceSnapshot(f.root);
    expect(locked.registry.pages.some((p) => p.id === "mixed-ranges")).toBe(true);

    const pack = readerPageEvidenceSchema.parse(buildPageEvidenceFromLocked(f.root, locked, "mixed-ranges"));
    expect(buildAllLockedEvidence(f.root, locked).size).toBe(1);

    expect(pack.entries[goodRepoRef]).toMatchObject({
      kind: "repo",
      status: "ok",
      lineStart: 1,
      lineEnd: 2,
      lines: [
        { number: 1, text: "line_one = 1" },
        { number: 2, text: "line_two = 2" },
      ],
    });
    expect(pack.entries[goodRawRef]).toMatchObject({ kind: "raw", status: "ok", lineStart: 1, lineEnd: 2 });

    for (const badRef of [zeroStartRef, zeroSingleRef, zeroEndRef, reversedRef, unsafeIntRef, unsafeEndRef]) {
      const entry = pack.entries[badRef];
      expect(entry).toMatchObject({
        ref: badRef,
        kind: "repo",
        status: "unavailable",
        reason: "out-of-range",
        totalLines: 3,
        externalHref: `https://github.com/vllm-project/vllm/blob/${commit.slice(0, 8)}/src/ok.py`,
      });
      if (entry?.kind === "repo" && entry.status === "unavailable") {
        expect(entry.lineStart).toBeUndefined();
        expect(entry.lineEnd).toBeUndefined();
      }
    }

    expect(pack.entries[unknownRepoZeroRef]).toMatchObject({
      ref: unknownRepoZeroRef,
      kind: "repo",
      status: "unavailable",
      reason: "unknown-repo",
      externalHref: null,
    });
    expect("lineStart" in (pack.entries[unknownRepoZeroRef] ?? {})).toBe(false);

    expect(pack.entries[missingFileRevRef]).toMatchObject({
      ref: missingFileRevRef,
      kind: "repo",
      status: "unavailable",
      reason: "missing-file",
      externalHref: `https://github.com/vllm-project/vllm/blob/${commit.slice(0, 8)}/src/missing.py`,
    });
    expect("lineStart" in (pack.entries[missingFileRevRef] ?? {})).toBe(false);

    expect(pack.entries[invalidCommitUnsafeRef]).toMatchObject({
      ref: invalidCommitUnsafeRef,
      kind: "repo",
      status: "unavailable",
      reason: "invalid-commit",
      externalHref: "https://github.com/vllm-project/vllm/blob/deadbeef00/src/ok.py",
    });
    expect("lineStart" in (pack.entries[invalidCommitUnsafeRef] ?? {})).toBe(false);

    await viteBuild({
      root: f.root,
      configFile: false,
      logLevel: "silent",
      plugins: [wikiReaderPlugin()],
      build: {
        outDir: "dist",
        rollupOptions: { input: join(f.root, "entry.js") },
      },
    });
    const emittedPath = join(f.root, "dist", "wiki-evidence", locked.revision, "mixed-ranges.json");
    expect(existsSync(emittedPath)).toBe(true);
    const emitted = readerPageEvidenceSchema.parse(JSON.parse(readFileSync(emittedPath, "utf8")));
    expect(emitted.entries[goodRepoRef]?.status).toBe("ok");
    expect(emitted.entries[zeroStartRef]).toMatchObject({ status: "unavailable", reason: "out-of-range" });
  }, 20_000);
});
